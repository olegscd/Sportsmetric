"""Scrape PVL player statistics from pvl.ph/players.

Usage:
    python -m pip install -r requirements.txt
    python scrape_pvl_stats.py

Output:
    pvl_player_stats_YYYYMMDD_HHMMSS.xlsx (new file each run)
"""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
import requests
from bs4 import BeautifulSoup

PLAYERS_URL = "https://pvl.ph/players"
PLAYER_URL = "https://pvl.ph/players/{slug}"
CONFERENCE_STATS_URL = "https://pvl.ph/players/filter_by_careerstats_conference"
OUTPUT_PREFIX = "pvl_player_stats"
REQUEST_DELAY_SEC = 2
HEADERS = {"User-Agent": "Mozilla/5.0"}

SCRIPT_DIR = Path(__file__).resolve().parent

STAT_FIELDS = [
    "sets_played",
    "total_points",
    "avg_per_set",
    "pts_atk",
    "pts_blk",
    "pts_ace",
    "exe_set",
    "exe_dig",
    "exe_rec",
    "fault_atk",
    "fault_blk",
    "fault_srv",
    "fault_set",
    "fault_dig",
    "fault_rec",
    "total_atk",
    "total_blk",
    "total_ace",
    "total_set",
    "total_dig",
    "total_rec",
    "avg_atk",
    "avg_blk",
    "avg_ace",
    "avg_set",
    "avg_dig",
    "avg_rec",
    "success_atk",
    "success_blk",
    "success_ace",
    "success_set",
    "success_dig",
    "success_rec",
    "efficiency_atk",
    "efficiency_blk",
    "efficiency_ace",
    "efficiency_set",
    "efficiency_dig",
    "efficiency_rec",
]

SECTION_LABEL_MAP = {
    ("Pts", "Atk"): "pts_atk",
    ("Pts", "Blk"): "pts_blk",
    ("Pts", "Ace"): "pts_ace",
    ("Exe", "Set"): "exe_set",
    ("Exe", "Dig"): "exe_dig",
    ("Exe", "Rec"): "exe_rec",
    ("Fault", "Atk"): "fault_atk",
    ("Fault", "Blk"): "fault_blk",
    ("Fault", "Srv"): "fault_srv",
    ("Fault", "Set"): "fault_set",
    ("Fault", "Dig"): "fault_dig",
    ("Fault", "Rec"): "fault_rec",
    ("Total", "Atk"): "total_atk",
    ("Total", "Blk"): "total_blk",
    ("Total", "Ace"): "total_ace",
    ("Total", "Set"): "total_set",
    ("Total", "Dig"): "total_dig",
    ("Total", "Rec"): "total_rec",
    ("Ave/Set", "Atk"): "avg_atk",
    ("Ave/Set", "Blk"): "avg_blk",
    ("Ave/Set", "Ace"): "avg_ace",
    ("Ave/Set", "Set"): "avg_set",
    ("Ave/Set", "Dig"): "avg_dig",
    ("Ave/Set", "Rec"): "avg_rec",
    ("Success %", "Atk"): "success_atk",
    ("Success %", "Blk"): "success_blk",
    ("Success %", "Ace"): "success_ace",
    ("Success %", "Set"): "success_set",
    ("Success %", "Dig"): "success_dig",
    ("Success %", "Rec"): "success_rec",
    ("EFFICIENCY %", "Atk"): "efficiency_atk",
    ("EFFICIENCY %", "Blk"): "efficiency_blk",
    ("EFFICIENCY %", "Ace"): "efficiency_ace",
    ("EFFICIENCY %", "Set"): "efficiency_set",
    ("EFFICIENCY %", "Dig"): "efficiency_dig",
    ("EFFICIENCY %", "Rec"): "efficiency_rec",
}


def output_excel_path() -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return SCRIPT_DIR / f"{OUTPUT_PREFIX}_{timestamp}.xlsx"


def parse_number(value: str | None) -> float | int | None:
    if value is None:
        return None
    cleaned = str(value).strip().replace(",", "").replace("%", "")
    if not cleaned:
        return None
    try:
        number = float(cleaned)
    except ValueError:
        return None
    return int(number) if number.is_integer() else number


def player_slug_from_href(href: str) -> str | None:
    path = urlparse(href).path.strip("/")
    if not path.startswith("players/"):
        return None
    slug = path.removeprefix("players/")
    return slug or None


def fetch_player_slugs() -> list[str]:
    resp = requests.get(PLAYERS_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    slugs: list[str] = []
    seen: set[str] = set()
    for link in soup.select("a[href*='/players/']"):
        href = link.get("href", "")
        slug = player_slug_from_href(href)
        if slug and slug not in seen:
            seen.add(slug)
            slugs.append(slug)

    if not slugs:
        raise ValueError("no player links found on pvl.ph/players")

    return slugs


def parse_player_name(soup: BeautifulSoup) -> str:
    if soup.title:
        name = soup.title.get_text(strip=True).split(" - ")[0].strip()
        if name:
            return name

    heading = soup.select_one("h2, h3, h4")
    return heading.get_text(" ", strip=True) if heading else ""


def parse_profile_field(soup: BeautifulSoup, label: str) -> str:
    for row in soup.select(".player-info .d-flex"):
        label_el = row.select_one(".fw-bold")
        value_el = label_el.find_next_sibling("div") if label_el else None
        if label_el and value_el and label_el.get_text(strip=True).startswith(label):
            return value_el.get_text(" ", strip=True)
    return ""


def parse_listing_card_info(soup: BeautifulSoup) -> dict[str, str]:
    card = soup.select_one("a[href*='/players/'] .player-position")
    jersey = ""
    position = ""
    if card:
        spans = card.select("span")
        if spans:
            jersey = spans[0].get_text(strip=True).lstrip("#")
        if len(spans) > 1:
            position = spans[1].get_text(strip=True)

    team_img = soup.select_one(".team-image img")
    team = team_img.get("alt", "").strip() if team_img else ""
    return {"jersey": jersey, "position": position, "team": team}


def parse_stat_blocks(container) -> dict[str, float | int | None]:
    stats: dict[str, float | int | None] = {}

    for row in container.select(".row.gx-0"):
        titles = row.select(".table-title")
        if not titles:
            continue

        section = titles[0].get_text(strip=True)
        if section in {"Conference Stats", "Career Stats"}:
            wrappers = row.select(".table-column-wrapper")
            labels = ["sets_played", "total_points", "avg_per_set"]
            for wrapper, key in zip(wrappers, labels):
                spans = wrapper.select("span")
                if len(spans) >= 2:
                    stats[key] = parse_number(spans[0].get_text(" ", strip=True))
            continue

        for wrapper in row.select(".table-column-wrapper"):
            spans = wrapper.select("span")
            if len(spans) < 2:
                continue
            value = spans[0].get_text(" ", strip=True)
            label = spans[1].get_text(strip=True)
            key = SECTION_LABEL_MAP.get((section, label))
            if key:
                stats[key] = parse_number(value)

    return stats


def parse_career_stats(soup: BeautifulSoup) -> dict[str, float | int | None]:
    career = soup.select_one("#career")
    if career is None:
        return {}
    return parse_stat_blocks(career)


def parse_conferences(soup: BeautifulSoup) -> list[tuple[str, str]]:
    select = soup.select_one("#careerStatsFilter")
    if select is None:
        return []

    conferences: list[tuple[str, str]] = []
    for option in select.select("option"):
        value = option.get("value")
        if not value:
            continue
        conferences.append((value, option.get_text(strip=True)))
    return conferences


def conference_stats_from_api(slug: str, conference_id: str) -> dict | None:
    resp = requests.post(
        CONFERENCE_STATS_URL,
        data={"conferenceId": conference_id, "playerslug": slug},
        headers=HEADERS,
        timeout=30,
    )
    resp.raise_for_status()
    text = resp.text.strip()
    if not text or text == "false":
        return None
    return json.loads(text)


def build_row_from_api(
    slug: str,
    stat_type: str,
    conference_id: str,
    conference_name: str,
    data: dict,
    profile: dict[str, str],
) -> dict:
    sets_played = parse_number(data.get("setsPlayed"))
    atk_point = parse_number(data.get("AtkPoint")) or 0
    blk_point = parse_number(data.get("BlkPoint")) or 0
    srv_point = parse_number(data.get("SrvPoint")) or 0
    total_points = atk_point + blk_point + srv_point
    avg_per_set = None
    if sets_played:
        avg_per_set = round(total_points / sets_played, 2)

    row = {
        "player_slug": slug,
        "player_name": f"{data.get('firstName', '').strip()} {data.get('lastName', '').strip()}".strip()
        or profile.get("player_name", ""),
        "team": data.get("teamName") or profile.get("team", ""),
        "position": data.get("position") or profile.get("position", ""),
        "jersey": data.get("jersey_number") or profile.get("jersey", ""),
        "height": data.get("height") or profile.get("height", ""),
        "school": data.get("school") or profile.get("school", ""),
        "stat_type": stat_type,
        "conference_id": conference_id,
        "conference_name": conference_name,
        "sets_played": sets_played,
        "total_points": total_points,
        "avg_per_set": avg_per_set,
        "pts_atk": parse_number(data.get("AtkPoint")),
        "pts_blk": parse_number(data.get("BlkPoint")),
        "pts_ace": parse_number(data.get("SrvPoint")),
        "exe_set": parse_number(data.get("SetExcel")),
        "exe_dig": parse_number(data.get("DigExcel")),
        "exe_rec": parse_number(data.get("RecExcel")),
        "fault_atk": parse_number(data.get("AtkFault")),
        "fault_blk": parse_number(data.get("BlkFault")),
        "fault_srv": parse_number(data.get("SrvFault")),
        "fault_set": parse_number(data.get("SetFault")),
        "fault_dig": parse_number(data.get("DigFault")),
        "fault_rec": parse_number(data.get("RecFault")),
        "total_atk": sum(
            parse_number(data.get(key)) or 0 for key in ("AtkFault", "AtkCont", "AtkPoint")
        ),
        "total_blk": sum(
            parse_number(data.get(key)) or 0 for key in ("BlkFault", "BlkCont", "BlkPoint")
        ),
        "total_ace": sum(
            parse_number(data.get(key)) or 0 for key in ("SrvFault", "SrvCont", "SrvPoint")
        ),
        "total_set": sum(
            parse_number(data.get(key)) or 0 for key in ("SetFault", "SetCont", "SetExcel")
        ),
        "total_dig": sum(
            parse_number(data.get(key)) or 0 for key in ("DigFault", "DigCont", "DigExcel")
        ),
        "total_rec": sum(
            parse_number(data.get(key)) or 0 for key in ("RecFault", "RecCont", "RecExcel")
        ),
    }

    if sets_played:
        row["avg_atk"] = round((parse_number(data.get("AtkPoint")) or 0) / sets_played, 2)
        row["avg_blk"] = round((parse_number(data.get("BlkPoint")) or 0) / sets_played, 2)
        row["avg_ace"] = round((parse_number(data.get("SrvPoint")) or 0) / sets_played, 2)
        row["avg_set"] = round((parse_number(data.get("SetExcel")) or 0) / sets_played, 2)
        row["avg_dig"] = round((parse_number(data.get("DigExcel")) or 0) / sets_played, 2)
        row["avg_rec"] = round((parse_number(data.get("RecExcel")) or 0) / sets_played, 2)

    for total_key, point_key in (
        ("total_atk", "AtkPoint"),
        ("total_blk", "BlkPoint"),
        ("total_ace", "SrvPoint"),
        ("total_set", "SetExcel"),
        ("total_dig", "DigExcel"),
        ("total_rec", "RecExcel"),
    ):
        total = row.get(total_key)
        points = parse_number(data.get(point_key))
        if total:
            row[f"success_{total_key.removeprefix('total_')}"] = round((points or 0) / total * 100, 2)

    return row


def build_row_from_career(
    slug: str,
    profile: dict[str, str],
    stats: dict[str, float | int | None],
) -> dict:
    row = {
        "player_slug": slug,
        "player_name": profile.get("player_name", ""),
        "team": profile.get("team", ""),
        "position": profile.get("position", ""),
        "jersey": profile.get("jersey", ""),
        "height": profile.get("height", ""),
        "school": profile.get("school", ""),
        "stat_type": "career",
        "conference_id": "",
        "conference_name": "",
    }
    for field in STAT_FIELDS:
        row[field] = stats.get(field)
    return row


def scrape_player(slug: str) -> list[dict]:
    resp = requests.get(PLAYER_URL.format(slug=slug), headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    profile = {
        "player_name": parse_player_name(soup),
        "height": parse_profile_field(soup, "Height:"),
        "position": parse_profile_field(soup, "Position:"),
        "school": parse_profile_field(soup, "School:"),
        "birthday": parse_profile_field(soup, "Birthday:"),
        "birth_place": parse_profile_field(soup, "Birth Place:"),
    }
    profile.update(parse_listing_card_info(soup))
    if not profile["position"]:
        profile["position"] = parse_profile_field(soup, "Position:")

    rows: list[dict] = []

    career_stats = parse_career_stats(soup)
    if career_stats:
        rows.append(build_row_from_career(slug, profile, career_stats))

    for conference_id, conference_name in parse_conferences(soup):
        data = conference_stats_from_api(slug, conference_id)
        if data is None:
            continue
        rows.append(
            build_row_from_api(
                slug,
                "conference",
                conference_id,
                conference_name,
                data,
                profile,
            )
        )

    if not rows:
        raise ValueError("no statistics found")

    return rows


def main() -> None:
    output_path = output_excel_path()

    try:
        slugs = fetch_player_slugs()
    except (requests.RequestException, ValueError) as exc:
        print(f"Error: failed to load player list: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(slugs)} players on pvl.ph/players")

    all_rows: list[dict] = []
    fetched = 0
    failed = 0

    for index, slug in enumerate(slugs):
        try:
            rows = scrape_player(slug)
            all_rows.extend(rows)
            fetched += 1
            print(f"Fetched {slug}: {len(rows)} stat rows")
        except requests.HTTPError as exc:
            failed += 1
            status = exc.response.status_code if exc.response is not None else "unknown"
            print(f"Warning: {slug} failed with HTTP {status}", file=sys.stderr)
        except (requests.RequestException, ValueError, json.JSONDecodeError) as exc:
            failed += 1
            print(f"Warning: {slug} failed: {exc}", file=sys.stderr)

        if index < len(slugs) - 1:
            time.sleep(REQUEST_DELAY_SEC)

    if not all_rows:
        print("Error: no player statistics collected.", file=sys.stderr)
        sys.exit(1)

    df = pd.DataFrame(all_rows)
    sort_cols = [col for col in ["player_name", "stat_type", "conference_name"] if col in df.columns]
    if sort_cols:
        df = df.sort_values(sort_cols)

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Player Stats")

    print(
        f"Done. Players fetched: {fetched}, failed: {failed}, "
        f"stat rows written: {len(df)} -> {output_path.name}"
    )


if __name__ == "__main__":
    main()
