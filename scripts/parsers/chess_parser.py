"""
Chess Statistics Parser for UAAP Annual Reports.

Extracts:
1. Team Standings (Total Points, Match W-L-D)
2. Individual Board Medalists (Board 1-6 Gold/Silver/Bronze)
3. Awards (MVP, Rookie of the Year)
4. Match Results (Cross score matchups)
"""

import json
import re
from pathlib import Path
from typing import Any

from scripts.parsers.canonicalize import canonicalize_team
from scripts.parsers.page_splitter import PageSegment, get_pages_for_sport


def parse_chess_standings(pages: list[PageSegment], season: str) -> dict[str, Any]:
    """Extract chess team standings and total points."""
    result: dict[str, Any] = {
        "season": season,
        "sport": "chess",
        "divisions": {}
    }

    ch_pages = get_pages_for_sport(pages, "chess")
    if not ch_pages:
        return result

    for page in ch_pages:
        lines = page.content.splitlines()
        pu = page.content.upper()
        current_div = "women" if "WOMEN" in pu else ("juniors" if any(j in pu for j in ["JUNIOR", "BOY"]) else "men")

        for i, line in enumerate(lines):
            lu = line.upper().strip()

            if "WOMEN" in lu and ("DIVISION" in lu or "FINAL" in lu):
                current_div = "women"
            elif any(j in lu for j in ["JUNIOR", "BOY"]) and ("DIVISION" in lu or "FINAL" in lu):
                current_div = "juniors"
            elif "MEN" in lu and ("DIVISION" in lu or "FINAL" in lu):
                current_div = "men"

            # Table with Points / Total Points
            if line.strip().startswith("|") and ("POINT" in lu or "TOTAL" in lu or "PTS" in lu) and ("SCHOOL" in lu or "TEAM" in lu or "PLACE" in lu or "RANK" in lu):
                rows = []
                for next_line in lines[i+1:]:
                    nl = next_line.strip()
                    if not nl.startswith("|"):
                        break
                    if re.match(r'\|\s*[-:]+', nl):
                        continue
                    cells = [c.strip() for c in nl.split("|")[1:-1]]
                    if not cells:
                        continue

                    team = None
                    pts = None
                    notes = None

                    for c in cells:
                        clean_c = re.sub(r'[*`_#]', '', c).strip()
                        if not team:
                            tc = canonicalize_team(clean_c)
                            if tc:
                                team = tc
                                continue
                        if any(term in clean_c.upper() for term in ["CHAMPION", "RUNNER", "PLACE"]):
                            notes = clean_c

                        # Match float or int (total points e.g. 35.5 or 35)
                        num_m = re.match(r'^(\d{1,3}(?:\.\d)?)$', clean_c)
                        if num_m and pts is None:
                            pts = float(num_m.group(1))

                    if team and pts is not None:
                        entry: dict[str, Any] = {
                            "school": team,
                            "points": pts
                        }
                        if notes:
                            entry["notes"] = notes
                        rows.append(entry)

                if len(rows) >= 3:
                    rows.sort(key=lambda x: x.get("points", 0), reverse=True)
                    for rank, r in enumerate(rows, 1):
                        r["rank"] = rank
                    existing = result["divisions"].get(current_div, [])
                    if not existing or len(rows) > len(existing):
                        result["divisions"][current_div] = rows

            # Ranked list (CHAMPION, RUNNER-UP, etc.)
            if any(term in lu for term in ["FINAL RESULTS", "FINAL RANKING", "FINAL STANDING"]):
                ranked = []
                for next_line in lines[i+1:]:
                    nl = next_line.strip()
                    if not nl or nl.startswith("---") or nl.startswith("###"):
                        if ranked and len(ranked) >= 3:
                            break
                        continue
                    clean_nl = re.sub(r'[*`_#]', '', nl).strip()
                    m_rank = re.search(r'(?:CHAMPION|RUNNER-UP|\d+(?:st|nd|rd|th)?\s+PLACE|\d+\.)\s*[:–—\-]?\s*([A-Za-z\s.]+)', clean_nl, re.IGNORECASE)
                    if m_rank:
                        tc = canonicalize_team(m_rank.group(1).strip())
                        if tc and tc not in [r["school"] for r in ranked]:
                            ranked.append({"school": tc})
                if len(ranked) >= 3 and current_div not in result["divisions"]:
                    for rank, r in enumerate(ranked, 1):
                        r["rank"] = rank
                    result["divisions"][current_div] = ranked

    return result


def parse_chess_board_medalists(pages: list[PageSegment], season: str) -> dict[str, Any]:
    """Extract individual board medalists (Board 1 to Board 6)."""
    result: dict[str, Any] = {
        "season": season,
        "sport": "chess",
        "divisions": {}
    }

    ch_pages = get_pages_for_sport(pages, "chess")
    for page in ch_pages:
        lines = page.content.splitlines()
        pu = page.content.upper()
        current_div = "women" if "WOMEN" in pu else ("juniors" if any(j in pu for j in ["JUNIOR", "BOY"]) else "men")

        for i, line in enumerate(lines):
            lu = line.upper().strip()
            if "BOARD" in lu and ("MEDAL" in lu or "RESULT" in lu or "WINNER" in lu or "PLAYER" in lu):
                board_m = re.search(r'BOARD\s*(?:NO\.?)?\s*(\d)', lu)
                board_num = int(board_m.group(1)) if board_m else None

                # Table row: | Board | Player | School | Points | ... |
                if line.strip().startswith("|") and ("PLAYER" in lu or "NAME" in lu):
                    board_rows = []
                    for next_line in lines[i+1:]:
                        nl = next_line.strip()
                        if not nl.startswith("|"):
                            break
                        if re.match(r'\|\s*[-:]+', nl):
                            continue
                        cells = [re.sub(r'[*`_#]', '', c).strip() for c in nl.split("|")[1:-1]]
                        if len(cells) >= 3:
                            # Try to extract board, player, school
                            p_name = None
                            team = None
                            for c in cells:
                                tc = canonicalize_team(c)
                                if tc:
                                    team = tc
                                elif len(c) > 3 and not re.match(r'^\d', c) and c.upper() not in ["BOARD", "GOLD", "SILVER", "BRONZE"]:
                                    if not p_name:
                                        p_name = c
                            if p_name and team:
                                board_rows.append({"player": p_name, "school": team})
                    if board_rows:
                        if current_div not in result["divisions"]:
                            result["divisions"][current_div] = []
                        result["divisions"][current_div].extend(board_rows)

    return result


def parse_chess_awards(pages: list[PageSegment], season: str) -> dict[str, Any]:
    """Extract MVP and Rookie of the Year for chess."""
    result: dict[str, Any] = {
        "season": season,
        "sport": "chess",
        "divisions": {}
    }

    ch_pages = get_pages_for_sport(pages, "chess")
    for page in ch_pages:
        lines = page.content.splitlines()
        pu = page.content.upper()
        current_div = "women" if "WOMEN" in pu else ("juniors" if any(j in pu for j in ["JUNIOR", "BOY"]) else "men")

        for line in lines:
            line_str = line.strip()
            lu = line_str.upper()

            if "MOST VALUABLE PLAYER" in lu or "MVP" in lu:
                clean = re.sub(r'[*`_#]', '', line_str).strip()
                m_mvp = re.search(r'(?:MVP|MOST VALUABLE PLAYER)[^:]*?[:|]\s*([A-Za-z\s.,\'-]+?)(?:\s*[-–—|]\s*|\s*\()([A-Za-z\s.]+)\)?', clean, re.IGNORECASE)
                if m_mvp:
                    p_name = m_mvp.group(1).strip()
                    p_team = canonicalize_team(m_mvp.group(2))
                    if p_team and p_name.upper() not in ["WINNER", "NAME", "PLAYER"]:
                        if current_div not in result["divisions"]:
                            result["divisions"][current_div] = {}
                        result["divisions"][current_div]["mvp"] = {"player": p_name, "school": p_team}

            if "ROOKIE OF THE YEAR" in lu or "ROOKIE" in lu:
                clean = re.sub(r'[*`_#]', '', line_str).strip()
                m_roy = re.search(r'(?:ROOKIE OF THE YEAR|ROOKIE)[^:]*?[:|]\s*([A-Za-z\s.,\'-]+?)(?:\s*[-–—|]\s*|\s*\()([A-Za-z\s.]+)\)?', clean, re.IGNORECASE)
                if m_roy:
                    p_name = m_roy.group(1).strip()
                    p_team = canonicalize_team(m_roy.group(2))
                    if p_team and p_name.upper() not in ["WINNER", "NAME", "PLAYER"]:
                        if current_div not in result["divisions"]:
                            result["divisions"][current_div] = {}
                        result["divisions"][current_div]["rookie_of_the_year"] = {"player": p_name, "school": p_team}

    return result


def extract_chess(pages: list[PageSegment], season: str, structured_dir: Path) -> dict[str, Any]:
    """Run full chess extraction pipeline for a season and save JSON artifacts."""
    ch_dir = structured_dir / "chess"
    ch_dir.mkdir(parents=True, exist_ok=True)

    standings = parse_chess_standings(pages, season)
    if standings["divisions"]:
        (ch_dir / "standings").mkdir(parents=True, exist_ok=True)
        (ch_dir / "standings" / f"{season}.json").write_text(json.dumps(standings, indent=2, ensure_ascii=False), encoding="utf-8")

    awards = parse_chess_awards(pages, season)
    if awards["divisions"]:
        (ch_dir / "awards").mkdir(parents=True, exist_ok=True)
        (ch_dir / "awards" / f"{season}.json").write_text(json.dumps(awards, indent=2, ensure_ascii=False), encoding="utf-8")

    board_medals = parse_chess_board_medalists(pages, season)
    if board_medals["divisions"]:
        (ch_dir / "board_medalists").mkdir(parents=True, exist_ok=True)
        (ch_dir / "board_medalists" / f"{season}.json").write_text(json.dumps(board_medals, indent=2, ensure_ascii=False), encoding="utf-8")

    return {"standings": standings, "awards": awards, "board_medalists": board_medals}
