"""Scrape PBA LiveStats player box scores from pba-api01.actech2.com.

Usage:
    python -m pip install -r requirements.txt
    # Add game IDs to pba_match_ids.txt (one number per line)
    python scrape_pba_stats.py

Output:
    pba_season_stats_YYYYMMDD_HHMMSS.xlsx (new file each run)
"""

from __future__ import annotations

import re
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pandas as pd
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://pba-api01.actech2.com/tournaments/{tournament}?game_id={game_id}"
TOURNAMENT = "pba-50th-season-commissioner-s-cup"
MATCH_IDS_FILE = "pba_match_ids.txt"
OUTPUT_PREFIX = "pba_season_stats"
REQUEST_DELAY_SEC = 2
HEADERS = {"User-Agent": "Mozilla/5.0"}

SCRIPT_DIR = Path(__file__).resolve().parent

STAT_COLUMNS = {
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

SKIP_PLAYER_NAMES = {"starters", "bench", "team totals", "team / coach"}


def output_excel_path() -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return SCRIPT_DIR / f"{OUTPUT_PREFIX}_{timestamp}.xlsx"


def read_game_ids(path: Path) -> list[str]:
    if not path.exists():
        print(f"Error: {path} not found.", file=sys.stderr)
        sys.exit(1)

    seen: set[str] = set()
    game_ids: list[str] = []

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        game_id = parse_game_id_line(stripped)
        if game_id is None:
            print(f"Warning: skipping invalid entry '{stripped}'", file=sys.stderr)
            continue

        if game_id in seen:
            continue

        seen.add(game_id)
        game_ids.append(game_id)

    return game_ids


def parse_game_id_line(line: str) -> str | None:
    if line.startswith("http://") or line.startswith("https://"):
        parsed = urlparse(line)
        game_ids = parse_qs(parsed.query).get("game_id", [])
        if game_ids and game_ids[0].isdigit():
            return game_ids[0]
        return None

    if line.isdigit():
        return line

    return None


def fetch_game_html(game_id: str) -> str:
    url = BASE_URL.format(tournament=TOURNAMENT, game_id=game_id)
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.text


def parse_number(value: str) -> float | int | None:
    cleaned = value.strip().replace(",", "")
    if not cleaned:
        return None
    try:
        number = float(cleaned)
    except ValueError:
        return None
    return int(number) if number.is_integer() else number


def team_short_name(title_text: str) -> str:
    cleaned = re.sub(r"\s*Coach:.*$", "", title_text, flags=re.I).strip()
    return cleaned.split()[0] if cleaned else cleaned


def cell_value(cells: list[str], index: int) -> str:
    if index >= len(cells):
        return ""
    return cells[index].strip()


def parse_game_details(soup: BeautifulSoup) -> dict[str, str]:
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


def parse_player_rows(game_id: str, html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    details = parse_game_details(soup)
    wraps = soup.select(".boxscorewrap")

    if not wraps:
        raise ValueError("no box score tables found")

    teams: list[dict] = []
    for wrap in wraps:
        title = wrap.find_previous("div", class_="box-score_title")
        if title is None:
            raise ValueError("missing team title for box score table")

        totals_row = wrap.select_one("tr.team-totals")
        if totals_row is None:
            raise ValueError("missing team totals row")

        totals_cells = [td.get_text(" ", strip=True) for td in totals_row.select("td")]
        teams.append(
            {
                "team": team_short_name(title.get_text(" ", strip=True)),
                "team_score": parse_number(cell_value(totals_cells, 4)),
                "wrap": wrap,
            }
        )

    if len(teams) < 2:
        raise ValueError("expected two teams in box score")

    rows: list[dict] = []
    for index, team_info in enumerate(teams):
        opponent = teams[1 - index]["team"]
        table = team_info["wrap"].select_one("table")
        if table is None:
            continue

        for tr in table.select("tbody tr"):
            if tr.get("class") and any(
                cls in {"team-totals", "team-coach", "bsheader_type"} for cls in tr.get("class", [])
            ):
                continue

            cells = [td.get_text(" ", strip=True) for td in tr.select("td")]
            if len(cells) < 5:
                continue

            player = cell_value(cells, 1)
            if not player or player.lower() in SKIP_PLAYER_NAMES:
                continue

            rows.append(
                {
                    "tournament": TOURNAMENT,
                    "game_id": game_id,
                    "competition": details.get("competition", ""),
                    "game_date": details.get("game_date", ""),
                    "venue": details.get("venue", ""),
                    "team": team_info["team"],
                    "opponent": opponent,
                    "team_score": team_info["team_score"],
                    "player": player,
                    "jersey": cell_value(cells, 0),
                    "mins": cell_value(cells, STAT_COLUMNS["mins"]),
                    "pts": parse_number(cell_value(cells, STAT_COLUMNS["pts"])),
                    "reb": parse_number(cell_value(cells, STAT_COLUMNS["reb"])),
                    "ast": parse_number(cell_value(cells, STAT_COLUMNS["ast"])),
                    "to": parse_number(cell_value(cells, STAT_COLUMNS["to"])),
                    "stl": parse_number(cell_value(cells, STAT_COLUMNS["stl"])),
                    "blk": parse_number(cell_value(cells, STAT_COLUMNS["blk"])),
                    "pf": parse_number(cell_value(cells, STAT_COLUMNS["pf"])),
                    "fls_on": parse_number(cell_value(cells, STAT_COLUMNS["fls_on"])),
                    "fg2_pct": parse_number(cell_value(cells, STAT_COLUMNS["fg2_pct"])),
                    "fg3_pct": parse_number(cell_value(cells, STAT_COLUMNS["fg3_pct"])),
                    "fg4": cell_value(cells, STAT_COLUMNS["fg4"]),
                    "fg4_pct": parse_number(cell_value(cells, STAT_COLUMNS["fg4_pct"])),
                    "ft_pct": parse_number(cell_value(cells, STAT_COLUMNS["ft_pct"])),
                    "plus_minus": parse_number(cell_value(cells, STAT_COLUMNS["plus_minus"])),
                }
            )

    if not rows:
        raise ValueError("no player rows found")

    return rows


def main() -> None:
    game_ids_path = SCRIPT_DIR / MATCH_IDS_FILE
    output_path = output_excel_path()

    game_ids = read_game_ids(game_ids_path)
    if not game_ids:
        print("Error: no valid game IDs found in pba_match_ids.txt.", file=sys.stderr)
        sys.exit(1)

    all_rows: list[dict] = []
    fetched = 0
    failed = 0

    for index, game_id in enumerate(game_ids):
        label = f"{TOURNAMENT}?game_id={game_id}"
        try:
            html = fetch_game_html(game_id)
            rows = parse_player_rows(game_id, html)
            all_rows.extend(rows)
            fetched += 1
            print(f"Fetched {label}: {len(rows)} player rows")
        except requests.HTTPError as exc:
            failed += 1
            status = exc.response.status_code if exc.response is not None else "unknown"
            print(f"Warning: {label} failed with HTTP {status}", file=sys.stderr)
        except (requests.RequestException, ValueError) as exc:
            failed += 1
            print(f"Warning: {label} failed: {exc}", file=sys.stderr)

        if index < len(game_ids) - 1:
            time.sleep(REQUEST_DELAY_SEC)

    if not all_rows:
        print("Error: no player data collected.", file=sys.stderr)
        sys.exit(1)

    df = pd.DataFrame(all_rows)
    df = df.sort_values(["game_id", "team", "pts"], ascending=[True, True, False])
    df.to_excel(output_path, index=False, sheet_name="Player Stats")

    print(
        f"Done. Games fetched: {fetched}, failed: {failed}, "
        f"player rows written: {len(df)} -> {output_path.name}"
    )


if __name__ == "__main__":
    main()
