"""Scrape PVL game box scores from PDF match reports on dashboard.pvl.ph.

Usage:
    python -m pip install -r requirements.txt
    # Add conference IDs to pvl_match_ids.txt (one per line)
    python scrape_pvl_games.py

Output:
    pvl_stats_<conference_slug>.xlsx (one file per conference)
"""

from __future__ import annotations

import re
import sys
import time
from pathlib import Path
from urllib.parse import unquote, urlparse

import pandas as pd
import pdfplumber
import requests
from bs4 import BeautifulSoup

FILTER_URL = "https://pvl.ph/filter-by-conference"
MATCH_IDS_FILE = "pvl_match_ids.txt"
REQUEST_DELAY_SEC = 0.5
HEADERS = {"User-Agent": "Mozilla/5.0"}

SCRIPT_DIR = Path(__file__).resolve().parent
CACHE_DIR = SCRIPT_DIR / "pdf_cache"

OUTPUT_COLUMNS = [
    "tournament",
    "game_id",
    "competition",
    "game_date",
    "venue",
    "team",
    "opponent",
    "team_score",
    "opp_score",
    "player",
    "jersey",
    "position",
    "pts",
    "is_libero",
    "pdf_url",
]

PLAYER_LINE = re.compile(
    r"^(\d+)\s+(?:L\s+)?(.+?)(?:\s+(?:L|[\u0028\u0029\u003d\uf028\uf03d]+\s*)+)?(?:\s+(\d+))?\s*$"
)
TEAM_CODE = re.compile(r"\b([A-Z]{2,4})\b")


def read_conference_ids(path: Path) -> list[str]:
    if not path.exists():
        raise FileNotFoundError(f"missing input file: {path.name}")

    ids: list[str] = []
    seen: set[str] = set()
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("http"):
            continue
        if not stripped.isdigit():
            print(f"Warning: skipping invalid conference id line: {raw_line}", file=sys.stderr)
            continue
        if stripped in seen:
            continue
        seen.add(stripped)
        ids.append(stripped)
    return ids


def slugify_conference(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower())
    return slug.strip("_") or "conference"


def format_player_name(raw: str) -> str:
    cleaned = re.sub(r"\s+", "", raw)
    match = re.match(r"^([A-Z]+(?:-[A-Z]+)*)([A-Z][a-z].*)$", cleaned)
    if not match:
        return raw.strip()

    last_name = " ".join(part.title() for part in match.group(1).split("-"))
    first_parts = re.findall(r"[A-Z][a-z]*", match.group(2))
    first_name = " ".join(first_parts)
    return f"{first_name} {last_name}".strip()


def parse_number(value: str | None) -> int:
    if value is None:
        return 0
    try:
        return int(value)
    except ValueError:
        return 0


def extract_team_code(header: str) -> str:
    match = re.match(r"^([A-Z]{2,4})", header.strip())
    return match.group(1) if match else ""


def parse_roster_cell(cell: str | None, team_code: str) -> list[dict]:
    if not cell:
        return []

    players: list[dict] = []
    for line in cell.split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("Coach:") or stripped.startswith("Assistant:"):
            continue

        is_libero = bool(re.match(r"^\d+\s+L\s+", stripped))
        match = PLAYER_LINE.match(stripped)
        if not match:
            continue

        raw_name = match.group(2).strip()
        if not raw_name or raw_name.isdigit():
            continue

        players.append(
            {
                "team": team_code,
                "jersey": match.group(1),
                "player": format_player_name(raw_name),
                "pts": parse_number(match.group(3)),
                "is_libero": is_libero,
                "position": "L" if is_libero else "OH",
            }
        )
    return players


def parse_match_metadata(lines: list[str], tables: list[list[list[str | None]]]) -> dict:
    tournament = lines[1] if len(lines) > 1 else ""
    competition = lines[2] if len(lines) > 2 else ""

    game_id = 0
    game_date = ""
    match_line = lines[3] if len(lines) > 3 else ""
    match_info = re.search(r"Match:\s*(\d+).*?Date:\s*([\d/]+)", match_line)
    if match_info:
        game_id = int(match_info.group(1))
        game_date = match_info.group(2)

    city = ""
    hall = ""
    for line in lines[4:7]:
        if line.lower().startswith("city:"):
            city = line.split(":", 1)[1].strip()
        elif line.lower().startswith("hall:"):
            hall = line.split(":", 1)[1].strip()

    city_name = re.sub(r"\b[A-Z]{2,4}\b.*", "", city).strip()
    hall_name = re.sub(r"\b[A-Z]{2,4}\b.*", "", hall).strip()
    venue = ", ".join(part for part in (city_name, hall_name) if part)

    teams: list[dict] = []
    if tables:
        for row in tables[0][1:3]:
            if not row or not row[0]:
                continue
            code = str(row[0]).strip()
            teams.append(
                {
                    "team": code,
                    "team_score": parse_number(str(row[1]).strip() if len(row) > 1 and row[1] else None),
                }
            )

    if len(teams) < 2 and len(lines) > 5:
        teams = []
        for line in (lines[4], lines[5]):
            if not line.lower().startswith(("city:", "hall:")):
                continue
            prefix, rest = line.split(":", 1)
            rest = rest.strip()
            code_match = TEAM_CODE.search(rest)
            if not code_match:
                continue
            code = code_match.group(1)
            after_code = rest[code_match.end() :].strip()
            sets_match = re.match(r"(\d+)", after_code)
            teams.append(
                {
                    "team": code,
                    "team_score": parse_number(sets_match.group(1) if sets_match else None),
                }
            )

    return {
        "tournament": tournament,
        "competition": competition,
        "game_id": game_id,
        "game_date": game_date,
        "venue": venue,
        "teams": teams,
    }


def parse_pvl_pdf(pdf_path: Path, pdf_url: str) -> list[dict]:
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]
        text = page.extract_text() or ""
        tables = page.extract_tables() or []

    lines = [line.strip() for line in text.split("\n") if line.strip()]
    metadata = parse_match_metadata(lines, tables)
    if len(metadata["teams"]) < 2:
        raise ValueError("could not determine both teams")

    home = metadata["teams"][0]
    away = metadata["teams"][1]
    team_lookup = {home["team"]: away, away["team"]: home}

    roster_tables = tables[1:3] if len(tables) >= 3 else []
    rows: list[dict] = []

    for table in roster_tables:
        if not table or not table[0] or not table[0][0]:
            continue
        header = str(table[0][0])
        team_code = extract_team_code(header)
        if not team_code:
            continue

        opponent_info = team_lookup.get(team_code)
        if opponent_info is None:
            continue

        roster_cell = table[1][0] if len(table) > 1 and table[1] else None
        for player in parse_roster_cell(str(roster_cell) if roster_cell else None, team_code):
            rows.append(
                {
                    "tournament": metadata["tournament"],
                    "game_id": metadata["game_id"],
                    "competition": metadata["competition"] or metadata["tournament"],
                    "game_date": metadata["game_date"],
                    "venue": metadata["venue"],
                    "team": team_code,
                    "opponent": opponent_info["team"],
                    "team_score": home["team_score"] if team_code == home["team"] else away["team_score"],
                    "opp_score": opponent_info["team_score"],
                    "player": player["player"],
                    "jersey": player["jersey"],
                    "position": player["position"],
                    "pts": player["pts"],
                    "is_libero": player["is_libero"],
                    "pdf_url": pdf_url,
                }
            )

    if not rows:
        raise ValueError("no player rows found")
    return rows


def fetch_pdf_urls(conference_id: str) -> list[str]:
    response = requests.post(
        FILTER_URL,
        data={"conferenceId": conference_id},
        headers=HEADERS,
        timeout=30,
    )
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    urls: list[str] = []
    seen: set[str] = set()
    for link in soup.find_all("a", href=True):
        href = link["href"].strip()
        if ".pdf" not in href.lower():
            continue
        if href.startswith("//"):
            href = "https:" + href
        elif href.startswith("/"):
            href = "https://dashboard.pvl.ph" + href
        if href not in seen:
            seen.add(href)
            urls.append(href)
    return urls


def cache_path_for_url(pdf_url: str) -> Path:
    filename = unquote(Path(urlparse(pdf_url).path).name)
    return CACHE_DIR / filename


def download_pdf(pdf_url: str) -> Path:
    CACHE_DIR.mkdir(exist_ok=True)
    target = cache_path_for_url(pdf_url)
    if target.exists() and target.stat().st_size > 0:
        return target

    response = requests.get(pdf_url, headers=HEADERS, timeout=60)
    response.raise_for_status()
    target.write_bytes(response.content)
    return target


def scrape_conference(conference_id: str) -> tuple[str, list[dict], int, int]:
    pdf_urls = fetch_pdf_urls(conference_id)
    if not pdf_urls:
        raise ValueError(f"no PDF links found for conference {conference_id}")

    all_rows: list[dict] = []
    fetched = 0
    failed = 0
    conference_slug = f"conference_{conference_id}"

    print(f"Processing Conference ID {conference_id} ({len(pdf_urls)} match PDFs)...")

    for index, pdf_url in enumerate(pdf_urls):
        label = Path(urlparse(pdf_url).path).name
        try:
            pdf_path = download_pdf(pdf_url)
            rows = parse_pvl_pdf(pdf_path, pdf_url)
            all_rows.extend(rows)
            fetched += 1
            if rows:
                conference_slug = slugify_conference(rows[0]["tournament"])
        except requests.HTTPError as exc:
            failed += 1
            status = exc.response.status_code if exc.response is not None else "unknown"
            print(f"  Warning: Failed {label}: HTTP {status}", file=sys.stderr)
        except (requests.RequestException, ValueError, OSError) as exc:
            failed += 1
            print(f"  Warning: Failed {label}: {exc}", file=sys.stderr)

        if index < len(pdf_urls) - 1:
            time.sleep(REQUEST_DELAY_SEC)

    return conference_slug, all_rows, fetched, failed


def main() -> None:
    ids_path = SCRIPT_DIR / MATCH_IDS_FILE
    conference_ids = read_conference_ids(ids_path)
    if not conference_ids:
        print(f"Error: no valid conference IDs found in {MATCH_IDS_FILE}.", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(conference_ids)} conferences to process.")

    any_output = False
    for conference_id in conference_ids:
        try:
            slug, rows, fetched, failed = scrape_conference(conference_id)
        except (requests.RequestException, ValueError) as exc:
            print(f"Warning: conference {conference_id} skipped: {exc}", file=sys.stderr)
            continue

        if not rows:
            print(f"Warning: conference {conference_id} produced no rows.", file=sys.stderr)
            continue

        df = pd.DataFrame(rows)
        for column in OUTPUT_COLUMNS:
            if column not in df.columns:
                df[column] = ""
        df = df[OUTPUT_COLUMNS]
        df = df.sort_values(["game_id", "team", "pts"], ascending=[True, True, False])

        output_path = SCRIPT_DIR / f"pvl_stats_{slug}.xlsx"
        df.to_excel(output_path, index=False, sheet_name="Player Stats")
        match_count = df["game_id"].nunique()
        print(
            f"Saved {len(df)} rows across {match_count} matches -> {output_path.name}"
        )
        any_output = True

        if failed:
            print(f"  ({fetched} PDFs parsed, {failed} failed)", file=sys.stderr)

    if not any_output:
        print("Error: no conference data collected.", file=sys.stderr)
        sys.exit(1)

    print("All PVL conferences completed successfully!")


if __name__ == "__main__":
    main()
