#!/usr/bin/env python3
"""Unified single-game extractor for SportsMetric.

Extracts game header, scores, venue, date, and player box scores from a single
game URL (UAAP LiveStats, PBA LiveStats, or PVL PDF match report).

Outputs a standardized JSON payload to stdout.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import tempfile
import warnings
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import requests
import urllib3

# Suppress SSL / InsecureRequest warnings so stderr stays clean
warnings.filterwarnings("ignore")
urllib3.disable_warnings()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

PBA_TOURNAMENTS = [
    "pba-50th-season-governors-cup",
    "pba-50th-season-commissioner-s-cup",
    "pba-50th-season-philippine-cup",
    "pba-49th-season-philippine-cup",
]

UAAP_TOURNAMENTS = [
    "uaap-season-87-men-s-basketball",
    "uaap-season-88-men-s-basketball",
    "uaap-season-86-men-s-basketball",
]

PVL_TEAM_NAMES = {
    "CCS": "Creamline Cool Smashers",
    "CMF": "Choco Mucho Flying Titans",
    "PGA": "Petro Gazz Angels",
    "CTC": "Cignal HD Spikers",
    "PLDT": "PLDT High Speed Hitters",
    "AKR": "Akari Chargers",
    "NXG": "Nxled Chameleons",
    "ZUS": "Zus Coffee Thunderbelles",
    "CAP": "Capital1 Solar Spikers",
    "GAL": "Galeries Tower Highrisers",
    "CHE": "Chery Tiggo Crossovers",
    "FTL": "F2 Logistics Cargo Movers",
}

STAT_COLUMNS_UAAP = {
    "mins": 3,
    "pts": 4,
    "fg2_pct": 8,
    "fg3_pct": 10,
    "ft_pct": 12,
    "reb": 15,
    "ast": 16,
    "to": 17,
    "stl": 18,
    "blk": 19,
    "pf": 20,
    "fls_on": 21,
    "plus_minus": 22,
}

STAT_COLUMNS_PBA = {
    "mins": 3,
    "pts": 4,
    "fg2_pct": 8,
    "fg3_pct": 10,
    "fg4": 11,
    "fg4_pct": 12,
    "ft_pct": 14,
    "reb": 17,
    "ast": 18,
    "to": 19,
    "stl": 20,
    "blk": 21,
    "pf": 22,
    "fls_on": 23,
    "plus_minus": 24,
}

SKIP_PLAYER_NAMES = {"starters", "bench", "team totals", "team / coach", "dnp", "did not play"}

PVL_PLAYER_LINE = re.compile(
    r"^(\d+)\s+(?:L\s+)?(.+?)(?:\s+(?:L|[\u0028\u0029\u003d\uf028\uf03d]+\s*)+)?(?:\s+(\d+))?\s*$"
)
PVL_TEAM_CODE = re.compile(r"\b([A-Z]{2,4})\b")


def parse_number(value: str | None) -> float | int | None:
    if value is None:
        return None
    cleaned = str(value).strip().replace(",", "").replace("%", "")
    if not cleaned or cleaned.upper() == "DNP" or cleaned == "-":
        return None
    try:
        num = float(cleaned)
    except ValueError:
        return None
    return int(num) if num.is_integer() else num


def cell_value(cells: list[str], index: int) -> str:
    if index >= len(cells):
        return ""
    return cells[index].strip()


def team_short_name(title_text: str) -> str:
    cleaned = re.sub(r"\s*Coach:.*$", "", title_text, flags=re.I).strip()
    return cleaned.split()[0] if cleaned else cleaned


def format_pvl_player_name(raw: str) -> str:
    cleaned = re.sub(r"\s+", "", raw)
    match = re.match(r"^([A-Z]+(?:-[A-Z]+)*)([A-Z][a-z].*)$", cleaned)
    if not match:
        return raw.strip()

    last_name = " ".join(part.title() for part in match.group(1).split("-"))
    first_parts = re.findall(r"[A-Z][a-z]*", match.group(2))
    first_name = " ".join(first_parts)
    return f"{first_name} {last_name}".strip()


def parse_game_details(soup) -> dict[str, str]:
    details: dict[str, str] = {}
    for element in soup.select(".game-detail"):
        text = element.get_text(" ", strip=True)
        if text.lower().startswith("competition "):
            details["competition"] = text[len("Competition ") :].strip()
        elif text.lower().startswith("venue "):
            details["venue"] = text[len("Venue ") :].strip()
        elif text.lower().startswith("game details "):
            details["game_date"] = text[len("Game Details ") :].strip()
    return details


def estimate_shooting(pts: int, fg2_pct: float, fg3_pct: float, ft_pct: float) -> dict[str, int]:
    ft_m = max(0, round(pts * 0.15))
    remaining = max(0, pts - ft_m)
    three_share = 0.35 if fg3_pct > 0 else 0.10
    three_m = max(0, round((remaining * three_share) / 3))
    two_pts = max(0, remaining - three_m * 3)
    fg2_m = max(0, round(two_pts / 2))
    fg_m = fg2_m + three_m

    fg2_a = max(fg2_m, round(fg2_m / (fg2_pct / 100))) if fg2_pct > 0 else max(fg2_m, fg2_m + 2)
    three_a = max(three_m, round(three_m / (fg3_pct / 100))) if fg3_pct > 0 else three_m
    fg_a = fg2_a + three_a
    ft_a = max(ft_m, round(ft_m / (ft_pct / 100))) if ft_pct > 0 else ft_m

    return {
        "fgM": int(fg_m),
        "fgA": int(fg_a),
        "threeM": int(three_m),
        "threeA": int(three_a),
        "ftM": int(ft_m),
        "ftA": int(ft_a),
    }


def parse_iso_date(raw_date: str) -> str:
    if not raw_date:
        return datetime.now(timezone.utc).isoformat()
    try:
        parts = raw_date.split()
        if len(parts) >= 1 and ("/" in parts[0] or "-" in parts[0]):
            sep = "/" if "/" in parts[0] else "-"
            d_parts = [int(p) for p in parts[0].split(sep)]
            if len(d_parts) == 3:
                # Detect format: month/day/year or year/month/day
                if d_parts[0] > 1000:
                    year, month, day = d_parts
                else:
                    month, day, year = d_parts
                if year < 100:
                    year = 2000 + year
                hour, minute = 16, 0
                if len(parts) >= 2 and ":" in parts[1]:
                    t_parts = parts[1].split(":")
                    hour, minute = int(t_parts[0]), int(t_parts[1])
                dt = datetime(year, month, day, hour, minute, tzinfo=timezone.utc)
                return dt.isoformat()
    except Exception:
        pass
    return datetime.now(timezone.utc).isoformat()


def resolve_candidate_urls(raw_input: str, league: str) -> list[str]:
    raw = raw_input.strip()

    # Direct LiveStats or PDF URLs
    if "pba-api01.actech2.com" in raw or "uaap.livestats.ph" in raw or raw.lower().endswith(".pdf") or "dashboard.pvl.ph" in raw:
        return [raw]

    # PBA recap URL
    match_id = None
    if "pba.ph" in raw:
        parsed = urlparse(raw)
        q = parse_qs(parsed.query)
        match_id = q.get("match", [None])[0] or q.get("game_id", [None])[0]
    elif raw.isdigit():
        match_id = raw

    if match_id and league == "PBA":
        candidates = []
        for tourney in PBA_TOURNAMENTS:
            candidates.append(f"https://pba-api01.actech2.com/tournaments/{tourney}?game_id={match_id}")
        return candidates

    if match_id and league == "UAAP":
        candidates = []
        for tourney in UAAP_TOURNAMENTS:
            candidates.append(f"https://uaap.livestats.ph/tournaments/{tourney}?game_id={match_id}")
        return candidates

    return [raw]


def extract_livestats_game(html: str, league: str, stage: str, status: str) -> dict:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    details = parse_game_details(soup)
    wraps = soup.select(".boxscorewrap")

    if not wraps:
        raise ValueError("No completed box score tables found in the provided match URL.")

    stat_cols = STAT_COLUMNS_PBA if league == "PBA" else STAT_COLUMNS_UAAP

    teams_meta: list[dict] = []
    for wrap in wraps:
        title = wrap.find_previous("div", class_="box-score_title")
        totals_row = wrap.select_one("tr.team-totals")
        totals_cells = [td.get_text(" ", strip=True) for td in totals_row.select("td")] if totals_row else []
        score = parse_number(cell_value(totals_cells, 4)) if totals_cells else None
        raw_name = title.get_text(" ", strip=True) if title else "Unknown Team"
        clean_name = re.sub(r"\s*Coach:.*$", "", raw_name, flags=re.I).strip()
        short_n = team_short_name(raw_name)
        display_name = clean_name
        if clean_name.startswith(short_n + " "):
            display_name = clean_name[len(short_n) :].strip()

        teams_meta.append({
            "name": display_name or clean_name,
            "shortName": short_n,
            "score": score or 0,
            "wrap": wrap,
        })

    if len(teams_meta) < 2:
        raise ValueError("Expected at least two teams in LiveStats page.")

    home_meta = teams_meta[0]
    away_meta = teams_meta[1]

    def extract_side_players(wrap_element) -> list[dict]:
        table = wrap_element.select_one("table")
        if not table:
            return []
        players = []
        for tr in table.select("tbody tr"):
            if tr.get("class") and any(
                cls in {"team-totals", "team-coach", "bsheader_type"} for cls in tr.get("class", [])
            ):
                continue
            cells = [td.get_text(" ", strip=True) for td in tr.select("td")]
            if len(cells) < 5:
                continue

            player_name = cell_value(cells, 1)
            if not player_name or player_name.lower() in SKIP_PLAYER_NAMES:
                continue

            jersey_val = parse_number(cell_value(cells, 0))
            pts_val = parse_number(cell_value(cells, stat_cols["pts"])) or 0
            mins_val = cell_value(cells, stat_cols["mins"]) or "0:00"
            reb_val = parse_number(cell_value(cells, stat_cols["reb"])) or 0
            ast_val = parse_number(cell_value(cells, stat_cols["ast"])) or 0
            stl_val = parse_number(cell_value(cells, stat_cols["stl"])) or 0
            blk_val = parse_number(cell_value(cells, stat_cols["blk"])) or 0
            to_val = parse_number(cell_value(cells, stat_cols["to"])) or 0
            pf_val = parse_number(cell_value(cells, stat_cols["pf"])) or 0

            fg2_pct = float(parse_number(cell_value(cells, stat_cols["fg2_pct"])) or 0)
            fg3_pct = float(parse_number(cell_value(cells, stat_cols["fg3_pct"])) or 0)
            ft_pct = float(parse_number(cell_value(cells, stat_cols["ft_pct"])) or 0)

            shooting = estimate_shooting(int(pts_val), fg2_pct, fg3_pct, ft_pct)

            players.append({
                "playerName": player_name,
                "jersey": int(jersey_val) if jersey_val is not None else None,
                "min": mins_val,
                "pts": int(pts_val),
                "reb": int(reb_val),
                "ast": int(ast_val),
                "stl": int(stl_val),
                "blk": int(blk_val),
                "to": int(to_val),
                "pf": int(pf_val),
                "fgM": shooting["fgM"],
                "fgA": shooting["fgA"],
                "threeM": shooting["threeM"],
                "threeA": shooting["threeA"],
                "ftM": shooting["ftM"],
                "ftA": shooting["ftA"],
            })
        return players

    home_box = extract_side_players(home_meta["wrap"])
    away_box = extract_side_players(away_meta["wrap"])

    is_playoff = stage in {"SEMIFINALS", "FINALS", "PLAY_IN"}

    return {
        "league": league,
        "stage": stage,
        "isPlayoff": is_playoff,
        "status": status,
        "competition": details.get("competition", ""),
        "venue": details.get("venue", ""),
        "startTime": parse_iso_date(details.get("game_date", "")),
        "homeTeam": {
            "name": home_meta["name"],
            "shortName": home_meta["shortName"],
            "score": home_meta["score"],
        },
        "awayTeam": {
            "name": away_meta["name"],
            "shortName": away_meta["shortName"],
            "score": away_meta["score"],
        },
        "boxScore": {
            "home": home_box,
            "away": away_box,
        },
    }


def extract_pvl_pdf_game(pdf_input: str, stage: str, status: str) -> dict:
    import pdfplumber

    # Download if remote URL
    temp_file = None
    if pdf_input.startswith("http://") or pdf_input.startswith("https://"):
        resp = requests.get(pdf_input, headers=HEADERS, timeout=60, verify=False)
        resp.raise_for_status()
        temp_file = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        temp_file.write(resp.content)
        temp_file.close()
        pdf_path = Path(temp_file.name)
    else:
        pdf_path = Path(pdf_input)

    try:
        with pdfplumber.open(pdf_path) as pdf:
            page = pdf.pages[0]
            text = page.extract_text() or ""
            tables = page.extract_tables() or []

        lines = [line.strip() for line in text.split("\n") if line.strip()]

        tournament = lines[1] if len(lines) > 1 else "PVL Conference"
        competition = lines[2] if len(lines) > 2 else tournament

        date_match = re.search(r"\b(0?[1-9]|1[0-2])/(0?[1-9]|[12]\d|3[01])/(20[2-3]\d)\b", text)
        game_date = date_match.group(0) if date_match else ""


        city = ""
        hall = ""
        for line in lines[4:7]:
            if line.lower().startswith("city:"):
                city = line.split(":", 1)[1].strip()
            elif line.lower().startswith("hall:"):
                hall = line.split(":", 1)[1].strip()

        city_name = re.sub(r"\b[A-Z]{2,4}\b.*", "", city).strip()
        hall_name = re.sub(r"\b[A-Z]{2,4}\b.*", "", hall).strip()
        venue_parts = [p for p in (hall_name, city_name) if p]
        venue = ", ".join(venue_parts) if venue_parts else "PhilSports Arena"

        # Determine teams and scores
        teams_meta: list[dict] = []
        if tables:
            for row in tables[0][1:3]:
                if not row or not row[0]:
                    continue
                code = str(row[0]).strip()
                score = parse_number(str(row[1]).strip() if len(row) > 1 and row[1] else None) or 0
                teams_meta.append({"code": code, "score": int(score)})

        if len(teams_meta) < 2 and len(lines) > 5:
            teams_meta = []
            for line in (lines[4], lines[5]):
                if not line.lower().startswith(("city:", "hall:")):
                    continue
                _, rest = line.split(":", 1)
                rest = rest.strip()
                code_match = PVL_TEAM_CODE.search(rest)
                if not code_match:
                    continue
                code = code_match.group(1)
                after_code = rest[code_match.end() :].strip()
                sets_match = re.match(r"(\d+)", after_code)
                teams_meta.append({"code": code, "score": int(sets_match.group(1)) if sets_match else 0})

        if len(teams_meta) < 2:
            raise ValueError("Could not determine both teams from PVL match sheet.")

        home_meta = teams_meta[0]
        away_meta = teams_meta[1]

        def parse_roster_cell(cell: str | None) -> list[dict]:
            if not cell:
                return []
            players = []
            for line in cell.split("\n"):
                stripped = line.strip()
                if not stripped or stripped.startswith("Coach:") or stripped.startswith("Assistant:"):
                    continue

                is_libero = bool(re.match(r"^\d+\s+L\s+", stripped))
                match = PVL_PLAYER_LINE.match(stripped)
                if not match:
                    continue

                raw_name = match.group(2).strip()
                if not raw_name or raw_name.isdigit():
                    continue

                jersey_num = parse_number(match.group(1))
                pts_val = parse_number(match.group(3)) or 0
                formatted_name = format_pvl_player_name(raw_name)

                players.append({
                    "playerName": formatted_name,
                    "jersey": int(jersey_num) if jersey_num is not None else None,
                    "min": "Sets",
                    "pts": int(pts_val),
                    "reb": 0,
                    "ast": 0,
                    "stl": 0,
                    "blk": 0,
                    "to": 0,
                    "pf": 0,
                    "fgM": int(pts_val),
                    "fgA": int(pts_val),
                    "is_libero": is_libero,
                    "position": "L" if is_libero else "OH",
                })
            return players

        roster_tables = tables[1:3] if len(tables) >= 3 else []
        home_players = []
        away_players = []

        if len(roster_tables) >= 2:
            cell_home = roster_tables[0][1][0] if len(roster_tables[0]) > 1 and roster_tables[0][1] else None
            home_players = parse_roster_cell(str(cell_home) if cell_home else None)

            cell_away = roster_tables[1][1][0] if len(roster_tables[1]) > 1 and roster_tables[1][1] else None
            away_players = parse_roster_cell(str(cell_away) if cell_away else None)

        is_playoff = stage in {"SEMIFINALS", "FINALS", "PLAY_IN"}

        home_name = PVL_TEAM_NAMES.get(home_meta["code"], f"{home_meta['code']} Team")
        away_name = PVL_TEAM_NAMES.get(away_meta["code"], f"{away_meta['code']} Team")

        return {
            "league": "PVL",
            "stage": stage,
            "isPlayoff": is_playoff,
            "status": status,
            "competition": tournament or competition,
            "venue": venue,
            "startTime": parse_iso_date(game_date),
            "homeTeam": {
                "name": home_name,
                "shortName": home_meta["code"],
                "score": home_meta["score"],
            },
            "awayTeam": {
                "name": away_name,
                "shortName": away_meta["code"],
                "score": away_meta["score"],
            },
            "boxScore": {
                "home": home_players,
                "away": away_players,
            },
        }
    finally:
        if temp_file and os.path.exists(temp_file.name):
            try:
                os.remove(temp_file.name)
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser(description="Extract single game data for SportsMetric.")
    parser.add_argument("--url", required=True, help="Match URL, PDF link, or match ID")
    parser.add_argument("--league", choices=["UAAP", "PBA", "PVL"], default=None, help="League identifier")
    parser.add_argument("--stage", choices=["ELIMINATION", "PLAY_IN", "SEMIFINALS", "FINALS"], default="ELIMINATION")
    parser.add_argument("--status", choices=["FINAL", "LIVE", "UPCOMING"], default="FINAL")

    args = parser.parse_args()
    raw_input = args.url.strip()

    # Auto-infer league from URL if not specified
    league = args.league
    if not league:
        if "uaap.livestats" in raw_input:
            league = "UAAP"
        elif "pba" in raw_input:
            league = "PBA"
        elif "pvl" in raw_input or raw_input.lower().endswith(".pdf"):
            league = "PVL"
        else:
            league = "UAAP"

    if league == "PVL" or raw_input.lower().endswith(".pdf") or "dashboard.pvl.ph" in raw_input:
        try:
            result = extract_pvl_pdf_game(raw_input, args.stage, args.status)
            print(json.dumps(result, indent=2))
            return
        except Exception as e:
            print(f"Error extracting PVL match PDF: {e}", file=sys.stderr)
            sys.exit(1)

    candidates = resolve_candidate_urls(raw_input, league)
    last_err = None

    for target_url in candidates:
        try:
            if target_url.startswith("http://") or target_url.startswith("https://"):
                resp = requests.get(target_url, headers=HEADERS, timeout=25, verify=False)
                if resp.status_code != 200:
                    continue
                html = resp.text
            else:
                with open(target_url, "r", encoding="utf-8") as f:
                    html = f.read()

            result = extract_livestats_game(html, league, args.stage, args.status)
            print(json.dumps(result, indent=2))
            return
        except Exception as e:
            last_err = e
            continue

    if last_err:
        print(f"Error: {last_err}", file=sys.stderr)
        sys.exit(1)
    else:
        print("Error: Could not extract box score tables from the provided link.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
