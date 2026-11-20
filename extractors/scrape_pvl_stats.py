"""Scrape official PVL player statistics from pvl.ph.

Players are discovered from the skill leader tables (pvl.ph/leaders) of each
conference, so no player list or profile crawl is needed; each player's full
line comes from the endpoint the profile page uses, a few requests at a time.
The app itself refreshes Supabase with `npm run pvl:stats`; this script is
for spreadsheet exports.

Usage:
    python -m pip install requests beautifulsoup4 pandas openpyxl
    python scrape_pvl_stats.py                    # conference in progress
    python scrape_pvl_stats.py --conference 18    # one conference (repeatable;
                                                  # ids not in the dropdown work too)
    python scrape_pvl_stats.py --all              # every listed conference + career rows

Output:
    pvl_player_stats_YYYYMMDD_HHMMSS.xlsx (new file each run)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

LEADERS_URL = "https://pvl.ph/leaders"
CONFERENCE_STATS_URL = "https://pvl.ph/players/filter_by_careerstats_conference"
# Leader tables whose rows identify a conference's players.
LEADER_CATEGORIES = ("scorer", "digger", "setter", "receiver", "blocker", "server")
OUTPUT_PREFIX = "pvl_player_stats"
HEADERS = {"User-Agent": "Sportsmetric/1.0 (sportsmetric.ph)"}
SCRIPT_DIR = Path(__file__).resolve().parent

# (output column, points/excellent key, fault key, continue key)
SKILLS = (
    ("atk", "AtkPoint", "AtkFault", "AtkCont"),
    ("blk", "BlkPoint", "BlkFault", "BlkCont"),
    ("ace", "SrvPoint", "SrvFault", "SrvCont"),
    ("set", "SetExcel", "SetFault", "SetCont"),
    ("dig", "DigExcel", "DigFault", "DigCont"),
    ("rec", "RecExcel", "RecFault", "RecCont"),
)
POINT_COLUMNS = {"atk": "pts_atk", "blk": "pts_blk", "ace": "pts_ace", "set": "exe_set", "dig": "exe_dig", "rec": "exe_rec"}
FAULT_COLUMNS = {"atk": "fault_atk", "blk": "fault_blk", "ace": "fault_srv", "set": "fault_set", "dig": "fault_dig", "rec": "fault_rec"}
COUNT_COLUMNS = ["sets_played", *POINT_COLUMNS.values(), *FAULT_COLUMNS.values(), *(f"total_{s}" for s, *_ in SKILLS)]
PROFILE_COLUMNS = ["player_name", "team", "position", "jersey", "height", "school"]


def output_excel_path() -> Path:
    return SCRIPT_DIR / f"{OUTPUT_PREFIX}_{datetime.now():%Y%m%d_%H%M%S}.xlsx"


def count(value) -> int:
    try:
        number = float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return 0
    return int(round(number)) if number > 0 else 0


def leader_conferences(session: requests.Session) -> list[dict]:
    resp = session.get(LEADERS_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    options = [
        {"id": int(o["value"]), "name": o.get_text(" ", strip=True), "selected": o.has_attr("selected")}
        for o in soup.select("#selectedConferenceId option")
        if (o.get("value") or "").isdigit()
    ]
    if not options:
        raise ValueError("pvl.ph/leaders has no conference list; the page may have changed")
    return options


def leader_slugs(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    slugs: list[str] = []
    for row in soup.select("#stats tr"):
        link = row.select_one("a[href*='/players/']")
        match = re.search(r"/players/([a-z0-9-]+)/?$", link.get("href", "") if link else "", re.I)
        if match and match.group(1).lower() not in slugs:
            slugs.append(match.group(1).lower())
    return slugs


def conference_players(session: requests.Session, conference: dict) -> list[str]:
    """Union of every leader table. The conference in progress is served by the
    leader pages; past conferences only by the filter endpoints."""
    found: list[str] = []
    for category in LEADER_CATEGORIES:
        def filtered() -> str:
            resp = session.post(f"https://pvl.ph/{category}-conference-filter", data={"competition_id": conference["id"]}, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            return resp.text
        if conference["selected"]:
            resp = session.get(f"{LEADERS_URL}/{category}s", headers=HEADERS, timeout=30)
            resp.raise_for_status()
            slugs = leader_slugs(resp.text) or leader_slugs(filtered())
        else:
            slugs = leader_slugs(filtered())
        found.extend(s for s in slugs if s not in found)
    return found


def player_line(slug: str, conference: dict) -> dict | None:
    resp = requests.post(CONFERENCE_STATS_URL, data={"conferenceId": conference["id"], "playerslug": slug}, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    text = resp.text.strip()
    if not text or text == "false":
        return None
    data = json.loads(text)
    if data.get("slug") != slug or str(data.get("competitionId")) != str(conference["id"]):
        raise ValueError("response is for a different player or conference")
    row = {
        "player_slug": slug,
        "player_name": f"{(data.get('firstName') or '').strip()} {(data.get('lastName') or '').strip()}".strip() or slug,
        "team": data.get("teamName") or "",
        "position": data.get("position") or "",
        "jersey": data.get("jersey_number") or "",
        "height": data.get("height") or "",
        "school": data.get("school") or "",
        "stat_type": "conference",
        "conference_id": conference["id"],
        "conference_name": conference["name"],
        "sets_played": count(data.get("setsPlayed")),
    }
    for skill, point, fault, cont in SKILLS:
        row[POINT_COLUMNS[skill]] = count(data.get(point))
        row[FAULT_COLUMNS[skill]] = count(data.get(fault))
        row[f"total_{skill}"] = count(data.get(point)) + count(data.get(fault)) + count(data.get(cont))
    return with_rates(row)


def with_rates(row: dict) -> dict:
    """Points, per-set averages, success and efficiency, as the app derives them."""
    sets = row["sets_played"]
    row["total_points"] = row["pts_atk"] + row["pts_blk"] + row["pts_ace"]
    row["avg_per_set"] = round(row["total_points"] / sets, 2) if sets else 0
    for skill, *_ in SKILLS:
        good, fault, total = row[POINT_COLUMNS[skill]], row[FAULT_COLUMNS[skill]], row[f"total_{skill}"]
        row[f"avg_{skill}"] = round(good / sets, 2) if sets else 0
        row[f"success_{skill}"] = round(good / total * 100, 2) if total else 0
        row[f"efficiency_{skill}"] = round((good - fault) / total * 100, 2) if total else 0
    return row


def career_rows(rows: list[dict]) -> list[dict]:
    """Career line per player: the sum of every conference scraped."""
    by_player: dict[str, list[dict]] = {}
    for row in rows:
        by_player.setdefault(row["player_slug"], []).append(row)
    careers = []
    for slug, lines in by_player.items():
        latest = max(lines, key=lambda r: r["conference_id"])
        career = {"player_slug": slug, **{k: latest[k] for k in PROFILE_COLUMNS}, "team": "", "stat_type": "career", "conference_id": "", "conference_name": ""}
        for column in COUNT_COLUMNS:
            career[column] = sum(line[column] for line in lines)
        careers.append(with_rates(career))
    return careers


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape official PVL player statistics into a spreadsheet.")
    parser.add_argument("--conference", type=int, action="append", default=[], help="pvl.ph conference id (repeatable)")
    parser.add_argument("--all", action="store_true", help="every conference listed on pvl.ph/leaders, plus career rows")
    parser.add_argument("--workers", type=int, default=4, help="player requests in flight (default 4)")
    args = parser.parse_args()

    session = requests.Session()
    try:
        listed = leader_conferences(session)
    except (requests.RequestException, ValueError) as exc:
        print(f"Error: failed to load pvl.ph/leaders: {exc}", file=sys.stderr)
        sys.exit(1)
    by_id = {c["id"]: c for c in listed}
    if args.all:
        conferences = listed
    elif args.conference:
        conferences = [by_id.get(i, {"id": i, "name": f"Conference {i}", "selected": False}) for i in args.conference]
    else:
        conferences = [next((c for c in listed if c["selected"]), listed[0])]

    rows: list[dict] = []
    failed = 0
    for conference in conferences:
        try:
            slugs = conference_players(session, conference)
        except requests.RequestException as exc:
            print(f"Warning: {conference['name']}: could not list players: {exc}", file=sys.stderr)
            continue
        print(f"{conference['name']} (#{conference['id']}): {len(slugs)} players")

        def fetch(slug: str):
            try:
                return slug, player_line(slug, conference), None
            except (requests.RequestException, ValueError) as exc:
                return slug, None, exc

        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
            for slug, row, error in pool.map(fetch, slugs):
                if error:
                    failed += 1
                    print(f"Warning: {slug}: {error}", file=sys.stderr)
                elif row:
                    rows.append(row)

    if not rows:
        print("Error: no player statistics collected.", file=sys.stderr)
        sys.exit(1)
    if args.all:
        rows.extend(career_rows([r for r in rows if r["stat_type"] == "conference"]))

    output_path = output_excel_path()
    df = pd.DataFrame(rows).sort_values(["player_name", "stat_type", "conference_name"])
    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Player Stats")
    print(f"Done. Stat rows written: {len(df)}, failed: {failed} -> {output_path.name}")


if __name__ == "__main__":
    main()
