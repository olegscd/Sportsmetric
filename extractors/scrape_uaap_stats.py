"""Scrape UAAP LiveStats player box scores from uaap.livestats.ph.

Usage:
    python -m pip install -r requirements.txt
    # Add games to match_ids.txt (tournament_slug,game_id or full URL)
    python scrape_uaap_stats.py

Output:
    uaap_season_stats_YYYYMMDD_HHMMSS.xlsx (new file each run)
"""

from __future__ import annotations

import re
import sys
import time
import warnings
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pandas as pd
import requests
import urllib3
from bs4 import BeautifulSoup

BASE_URL = "https://uaap.livestats.ph/tournaments/{tournament}?game_id={game_id}"
MATCH_IDS_FILE = "match_ids.txt"
OUTPUT_PREFIX = "uaap_season_stats"
REQUEST_DELAY_SEC = 2
HEADERS = {"User-Agent": "Mozilla/5.0"}

SCRIPT_DIR = Path(__file__).resolve().parent


def output_excel_path() -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return SCRIPT_DIR / f"{OUTPUT_PREFIX}_{timestamp}.xlsx"


STAT_COLUMNS = {
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

SKIP_PLAYER_NAMES = {"starters", "bench", "team totals", "team / coach"}


@dataclass(frozen=True)
class GameRef:
    tournament: str
    game_id: str

    @property
    def label(self) -> str:
        return f"{self.tournament}?game_id={self.game_id}"


def read_games(path: Path) -> list[GameRef]:
    if not path.exists():
        print(f"Error: {path} not found.", file=sys.stderr)
        sys.exit(1)

    seen: set[tuple[str, str]] = set()
    games: list[GameRef] = []

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        game = parse_game_line(stripped)
        if game is None:
            print(f"Warning: skipping invalid entry '{stripped}'", file=sys.stderr)
            continue

        key = (game.tournament, game.game_id)
        if key in seen:
            continue

        seen.add(key)
        games.append(game)

    return games


def parse_game_line(line: str) -> GameRef | None:
    if line.startswith("http://") or line.startswith("https://"):
        parsed = urlparse(line)
        if "uaap.livestats.ph" not in parsed.netloc:
            return None

        game_ids = parse_qs(parsed.query).get("game_id", [])
        if not game_ids or not game_ids[0].isdigit():
            return None

        tournament = parsed.path.strip("/").removeprefix("tournaments/")
        if not tournament:
            return None

        return GameRef(tournament=tournament, game_id=game_ids[0])

    if "," in line:
        tournament, game_id = [part.strip() for part in line.split(",", 1)]
        if tournament and game_id.isdigit():
            return GameRef(tournament=tournament, game_id=game_id)
        return None

    return None


def fetch_game_html(game: GameRef) -> str:
    url = BASE_URL.format(tournament=game.tournament, game_id=game.game_id)
    resp = requests.get(url, headers=HEADERS, timeout=30, verify=False)
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


def parse_player_rows(game: GameRef, html: str) -> list[dict]:
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
                    "tournament": game.tournament,
                    "game_id": game.game_id,
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
                    "ft_pct": parse_number(cell_value(cells, STAT_COLUMNS["ft_pct"])),
                    "plus_minus": parse_number(cell_value(cells, STAT_COLUMNS["plus_minus"])),
                }
            )

    if not rows:
        raise ValueError("no player rows found")

    return rows


def main() -> None:
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    warnings.filterwarnings("ignore", message="Unverified HTTPS request")

    games_path = SCRIPT_DIR / MATCH_IDS_FILE
    output_path = output_excel_path()

    games = read_games(games_path)
    if not games:
        print("Error: no valid games found in match_ids.txt.", file=sys.stderr)
        sys.exit(1)

    all_rows: list[dict] = []
    fetched = 0
    failed = 0

    for index, game in enumerate(games):
        try:
            html = fetch_game_html(game)
            rows = parse_player_rows(game, html)
            all_rows.extend(rows)
            fetched += 1
            print(f"Fetched {game.label}: {len(rows)} player rows")
        except requests.HTTPError as exc:
            failed += 1
            status = exc.response.status_code if exc.response is not None else "unknown"
            print(f"Warning: {game.label} failed with HTTP {status}", file=sys.stderr)
        except (requests.RequestException, ValueError) as exc:
            failed += 1
            print(f"Warning: {game.label} failed: {exc}", file=sys.stderr)

        if index < len(games) - 1:
            time.sleep(REQUEST_DELAY_SEC)

    if not all_rows:
        print("Error: no player data collected.", file=sys.stderr)
        sys.exit(1)

    df = pd.DataFrame(all_rows)
    df = df.sort_values(["tournament", "game_id", "team", "pts"], ascending=[True, True, True, False])
    df.to_excel(output_path, index=False, sheet_name="Player Stats")

    print(
        f"Done. Games fetched: {fetched}, failed: {failed}, "
        f"player rows written: {len(df)} -> {output_path.name}"
    )


if __name__ == "__main__":
    main()
