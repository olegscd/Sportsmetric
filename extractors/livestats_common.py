"""Shared LiveStats (UAAP / PBA) box-score scraping.

Game IDs are discovered from each tournament page's match cards
(`a.schedule-box`, labelled "Final" once a game is complete) -- the same
source the app's automatic updater reads -- so no hand-kept ID list is needed.
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse

import pandas as pd
import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Sportsmetric/1.0 (sportsmetric.ph)"}
SKIP_PLAYER_NAMES = {"starters", "bench", "team totals", "team / coach"}
# Columns holding "made-attempted" strings or minutes; every other stat is numeric.
TEXT_COLUMNS = {"mins", "fg2", "fg3", "fg4", "ft"}


@dataclass(frozen=True)
class League:
    name: str
    host: str
    tournaments: tuple[str, ...]
    stat_columns: dict[str, int]
    output_prefix: str


@dataclass(frozen=True)
class GameRef:
    tournament: str
    game_id: str

    @property
    def label(self) -> str:
        return f"{self.tournament}?game_id={self.game_id}"


def tournament_url(league: League, tournament: str) -> str:
    return f"https://{league.host}/tournaments/{tournament}"


def discover_games(session: requests.Session, league: League, tournament: str, include_unfinished: bool = False) -> list[GameRef]:
    """Lists the tournament's games from its match cards, oldest first."""
    url = tournament_url(league, tournament)
    resp = session.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return parse_tournament_games(resp.text, url, tournament, include_unfinished)


def parse_tournament_games(html: str, url: str, tournament: str, include_unfinished: bool = False) -> list[GameRef]:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("a.schedule-box[href]")
    if not cards:
        raise ValueError(f"no match cards on {url}; the page may have changed")
    expected_path = urlparse(url).path
    seen: set[str] = set()
    games: list[GameRef] = []
    for card in cards:
        link = urlparse(urljoin(url, card["href"]))
        game_id = (parse_qs(link.query).get("game_id") or [""])[0]
        if link.path != expected_path or not game_id.isdigit() or game_id in seen:
            continue
        details = card.select_one(".schedule-details")
        final = details is not None and details.get_text(" ", strip=True).lower() == "final"
        if final or include_unfinished:
            seen.add(game_id)
            games.append(GameRef(tournament, game_id))
    return sorted(games, key=lambda g: int(g.game_id))


def parse_game_arg(league: League, value: str) -> GameRef:
    """`tournament,game_id` or a full LiveStats game URL."""
    if value.startswith(("http://", "https://")):
        parsed = urlparse(value)
        game_id = (parse_qs(parsed.query).get("game_id") or [""])[0]
        tournament = parsed.path.strip("/").removeprefix("tournaments/")
        if parsed.hostname == league.host and game_id.isdigit() and tournament:
            return GameRef(tournament, game_id)
    elif "," in value:
        tournament, game_id = (part.strip() for part in value.split(",", 1))
        if tournament and game_id.isdigit():
            return GameRef(tournament, game_id)
    raise argparse.ArgumentTypeError(f"not a {league.name} game: {value}")


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
    return cells[index].strip() if index < len(cells) else ""


def parse_game_details(soup: BeautifulSoup) -> dict[str, str]:
    details: dict[str, str] = {}
    for element in soup.select(".game-detail"):
        text = element.get_text(" ", strip=True)
        lower = text.lower()
        if lower.startswith("competition "):
            details["competition"] = text[len("Competition "):].strip()
        elif lower.startswith("venue "):
            details["venue"] = text[len("Venue "):].strip()
        elif lower.startswith("game details "):
            details["game_date"] = text[len("Game Details "):].strip()
    return details


def parse_player_rows(game: GameRef, html: str, stat_columns: dict[str, int]) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    details = parse_game_details(soup)
    wraps = soup.select(".boxscorewrap")
    if not wraps:
        raise ValueError("no box score tables found")

    teams: list[dict] = []
    for wrap in wraps:
        title = wrap.find_previous("div", class_="box-score_title")
        totals_row = wrap.select_one("tr.team-totals")
        if title is None or totals_row is None:
            raise ValueError("box score table is missing its team title or totals")
        totals_cells = [td.get_text(" ", strip=True) for td in totals_row.select("td")]
        teams.append({"team": team_short_name(title.get_text(" ", strip=True)), "team_score": parse_number(cell_value(totals_cells, 4)), "wrap": wrap})
    if len(teams) < 2:
        raise ValueError("expected two teams in box score")

    rows: list[dict] = []
    for index, team_info in enumerate(teams):
        table = team_info["wrap"].select_one("table")
        if table is None:
            continue
        for tr in table.select("tbody tr"):
            if any(cls in {"team-totals", "team-coach", "bsheader_type"} for cls in tr.get("class", [])):
                continue
            cells = [td.get_text(" ", strip=True) for td in tr.select("td")]
            player = cell_value(cells, 1)
            if len(cells) < 5 or not player or player.lower() in SKIP_PLAYER_NAMES:
                continue
            row = {
                "tournament": game.tournament,
                "game_id": game.game_id,
                "competition": details.get("competition", ""),
                "game_date": details.get("game_date", ""),
                "venue": details.get("venue", ""),
                "team": team_info["team"],
                "opponent": teams[1 - index]["team"],
                "team_score": team_info["team_score"],
                "player": player,
                "jersey": cell_value(cells, 0),
            }
            for key, column in stat_columns.items():
                raw = cell_value(cells, column)
                row[key] = raw if key in TEXT_COLUMNS else parse_number(raw)
            rows.append(row)
    if not rows:
        raise ValueError("no player rows found")
    return rows


def main(league: League) -> None:
    parser = argparse.ArgumentParser(description=f"Scrape {league.name} LiveStats box scores into a spreadsheet.")
    parser.add_argument("tournaments", nargs="*", default=list(league.tournaments),
                        help=f"tournament slugs on {league.host} (default: {', '.join(league.tournaments)})")
    parser.add_argument("--game", action="append", default=[], type=lambda v: parse_game_arg(league, v),
                        help="scrape only this game: tournament,game_id or a full game URL (repeatable)")
    parser.add_argument("--limit", type=int, default=0, help="only the N most recent final games per tournament")
    parser.add_argument("--delay", type=float, default=0.5, help="seconds between game page requests (default 0.5)")
    args = parser.parse_args()

    session = requests.Session()
    games: list[GameRef] = list(args.game)
    if not games:
        for tournament in args.tournaments:
            try:
                found = discover_games(session, league, tournament)
            except (requests.RequestException, ValueError) as exc:
                print(f"Warning: could not list {tournament}: {exc}", file=sys.stderr)
                continue
            if args.limit > 0:
                found = found[-args.limit:]
            print(f"{tournament}: {len(found)} final games")
            games.extend(found)
    if not games:
        print("Error: no final games found.", file=sys.stderr)
        sys.exit(1)

    all_rows: list[dict] = []
    failed = 0
    for index, game in enumerate(games):
        try:
            resp = session.get(f"{tournament_url(league, game.tournament)}?game_id={game.game_id}", headers=HEADERS, timeout=30)
            resp.raise_for_status()
            rows = parse_player_rows(game, resp.text, league.stat_columns)
            all_rows.extend(rows)
            print(f"Fetched {game.label}: {len(rows)} player rows")
        except (requests.RequestException, ValueError) as exc:
            failed += 1
            print(f"Warning: {game.label} failed: {exc}", file=sys.stderr)
        if index < len(games) - 1 and args.delay > 0:
            time.sleep(args.delay)

    if not all_rows:
        print("Error: no player data collected.", file=sys.stderr)
        sys.exit(1)
    output_path = Path(__file__).resolve().parent / f"{league.output_prefix}_{datetime.now():%Y%m%d_%H%M%S}.xlsx"
    df = pd.DataFrame(all_rows).sort_values(["tournament", "game_id", "team", "pts"], ascending=[True, True, True, False])
    df.to_excel(output_path, index=False, sheet_name="Player Stats")
    print(f"Done. Games fetched: {len(games) - failed}, failed: {failed}, player rows written: {len(df)} -> {output_path.name}")
