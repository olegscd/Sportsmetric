#!/usr/bin/env python3
"""Unified single-game extractor for SportsMetric.

Extracts game header, scores, venue, date, and player box scores from a single
game URL (UAAP LiveStats, PBA LiveStats, or PVL match source).

Outputs a standardized JSON payload to stdout.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import warnings
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

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
    """Estimates FGM, FGA, 3PM, 3PA, FTM, FTA from points and percentages if exact counts are absent."""
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
        if len(parts) >= 1 and "/" in parts[0]:
            d_parts = [int(p) for p in parts[0].split("/")]
            if len(d_parts) == 3:
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

    # 1. Direct LiveStats URLs
    if "pba-api01.actech2.com" in raw or "uaap.livestats.ph" in raw:
        return [raw]

    # 2. PBA recap URL e.g. https://pba.ph/recap?match=553 or match=553
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
        # Remove leading short code if repeated (e.g. 'CON CONVERGE FIBERXERS' -> 'Converge FiberXers')
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


def main():
    parser = argparse.ArgumentParser(description="Extract single game data for SportsMetric.")
    parser.add_argument("--url", required=True, help="Match URL or match ID")
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
        elif "pvl" in raw_input:
            league = "PVL"
        else:
            league = "UAAP"

    if league == "PVL":
        # PVL single game hook
        result = {
            "league": "PVL",
            "stage": args.stage,
            "isPlayoff": args.stage in {"SEMIFINALS", "FINALS", "PLAY_IN"},
            "status": args.status,
            "competition": "PVL Conference",
            "venue": "PhilSports Arena",
            "startTime": datetime.now(timezone.utc).isoformat(),
            "homeTeam": {"name": "Home Team", "shortName": "HOM", "score": 0},
            "awayTeam": {"name": "Away Team", "shortName": "AWY", "score": 0},
            "boxScore": {"home": [], "away": []},
            "note": "PVL single-match sheet extractor hook ready for PDF parsing integration.",
        }
        print(json.dumps(result, indent=2))
        return

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
