"""
Unified Tournament Sports Parser for UAAP Annual Reports.

Handles all remaining Olympic and tournament sports:
- table_tennis
- tennis
- football
- taekwondo
- badminton
- judo
- fencing
- softball
- swimming
- track_field

Extracts:
1. Team Standings / Final Rankings (Points, W-L records, Medals)
2. Individual Awards (MVP, Rookie of the Year)
3. Match Results (where recorded)
"""

import json
import re
from pathlib import Path
from typing import Any

from scripts.parsers.canonicalize import canonicalize_team
from scripts.parsers.page_splitter import PageSegment, get_pages_for_sport

OTHER_SPORTS = [
    "table_tennis",
    "tennis",
    "football",
    "taekwondo",
    "badminton",
    "judo",
    "fencing",
    "softball",
    "swimming",
    "track_field"
]


def parse_sport_standings(pages: list[PageSegment], sport: str, season: str) -> dict[str, Any]:
    """Extract team standings or final ranked places for a given sport."""
    result: dict[str, Any] = {
        "season": season,
        "sport": sport,
        "divisions": {}
    }

    sport_pages = get_pages_for_sport(pages, sport)
    if not sport_pages:
        return result

    for page in sport_pages:
        lines = page.content.splitlines()
        pu = page.content.upper()
        current_div = "women" if "WOMEN" in pu else ("juniors" if any(j in pu for j in ["JUNIOR", "BOY", "GIRL"]) else "men")

        for i, line in enumerate(lines):
            lu = line.upper().strip()

            if "WOMEN" in lu and any(t in lu for t in ["DIVISION", "FINAL", "RESULTS"]):
                current_div = "women"
            elif any(t in lu for t in ["JUNIOR", "BOY", "GIRL"]) and any(t in lu for t in ["DIVISION", "FINAL", "RESULTS"]):
                current_div = "juniors"
            elif any(t in lu for t in ["MEN", "SENIOR"]) and any(t in lu for t in ["DIVISION", "FINAL", "RESULTS"]):
                current_div = "men"

            # Table with W and L or Points
            if line.strip().startswith("|") and (" W " in f" {lu} " or "WIN" in lu or "WON" in lu or "POINTS" in lu or "PTS" in lu) and (" L " in f" {lu} " or "LOSS" in lu or "TOTAL" in lu):
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
                    w = None
                    l = None
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

                        num_m = re.match(r'^(\d{1,3}(?:\.\d)?)$', clean_c)
                        if num_m:
                            num = float(num_m.group(1)) if "." in num_m.group(1) else int(num_m.group(1))
                            if w is None:
                                w = num
                            elif l is None:
                                l = num
                            elif pts is None:
                                pts = num

                    if team and (w is not None or pts is not None):
                        entry: dict[str, Any] = {"school": team}
                        if w is not None and l is not None:
                            entry["wins"] = w
                            entry["losses"] = l
                            total_g = w + l
                            if total_g > 0:
                                entry["pct"] = round(w / total_g, 3)
                        elif w is not None:
                            entry["points"] = w
                        if pts is not None:
                            entry["points"] = pts
                        if notes:
                            entry["notes"] = notes
                        rows.append(entry)

                if len(rows) >= 3:
                    rows.sort(key=lambda x: (x.get("points", 0), x.get("wins", 0)), reverse=True)
                    for rank, r in enumerate(rows, 1):
                        r["rank"] = rank
                    existing = result["divisions"].get(current_div, [])
                    if not existing or len(rows) > len(existing):
                        result["divisions"][current_div] = rows

            # Ranked list or table (CHAMPION, RUNNER-UP, SECOND PLACE, etc.)
            if any(term in lu for term in ["FINAL RESULTS", "FINAL RANKING", "FINAL STANDING", "FINAL TEAM STANDINGS"]):
                ranked = []
                rank_words = {
                    "CHAMPION": 1, "WINNER": 1, "FIRST": 1, "1ST": 1,
                    "RUNNER": 2, "SECOND": 2, "2ND": 2,
                    "THIRD": 3, "3RD": 3,
                    "FOURTH": 4, "4TH": 4,
                    "FIFTH": 5, "5TH": 5,
                    "SIXTH": 6, "6TH": 6,
                    "SEVENTH": 7, "7TH": 7,
                    "EIGHTH": 8, "8TH": 8,
                }

                for next_line in lines[i+1:]:
                    nl = next_line.strip()
                    if not nl:
                        continue
                    if nl.startswith("---") or (nl.startswith("##") and not any(r in nl.upper() for r in ["DIVISION", "MEN", "WOMEN", "JUNIOR"])):
                        if len(ranked) >= 3:
                            break

                    nlu = nl.upper()
                    if "WOMEN" in nlu and "DIVISION" in nlu:
                        current_div = "women"
                    elif any(j in nlu for j in ["JUNIOR", "BOY"]) and "DIVISION" in nlu:
                        current_div = "juniors"
                    elif "MEN" in nlu and "DIVISION" in nlu:
                        current_div = "men"

                    # Markdown table row: | Place | : | School | or | Place | School |
                    if nl.startswith("|"):
                        if re.match(r'\|\s*[-:]+', nl):
                            continue
                        cells = [re.sub(r'[*`_#]', '', c).strip() for c in nl.split("|")[1:-1]]
                        cells = [c for c in cells if c and c != ":"]
                        if len(cells) >= 2:
                            r_num = None
                            for rw, num in rank_words.items():
                                if rw in cells[0].upper():
                                    r_num = num
                                    break
                            tc = canonicalize_team(cells[1])
                            if not tc and len(cells) > 2:
                                tc = canonicalize_team(cells[2])
                            if tc and (tc not in [r["school"] for r in ranked]):
                                entry = {"school": tc, "rank": r_num or (len(ranked) + 1)}
                                if r_num:
                                    entry["details"] = cells[0]
                                ranked.append(entry)
                        continue

                    clean_nl = re.sub(r'[*`_#]', '', nl).strip()
                    m_rank = re.search(r'(?:CHAMPION|RUNNER-UP|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|\d+(?:st|nd|rd|th)?\s+PLACE|\d+\.)\s*[:–—\-]?\s*([A-Za-z\s.]+)', clean_nl, re.IGNORECASE)
                    if m_rank:
                        tc = canonicalize_team(m_rank.group(1).strip())
                        if tc and tc not in [r["school"] for r in ranked]:
                            ranked.append({"school": tc, "rank": len(ranked) + 1})

                if len(ranked) >= 3:
                    ranked.sort(key=lambda x: x.get("rank", 99))
                    for rank_idx, r in enumerate(ranked, 1):
                        r["rank"] = rank_idx
                    result["divisions"][current_div] = ranked

    return result


def parse_sport_awards(pages: list[PageSegment], sport: str, season: str) -> dict[str, Any]:
    """Extract MVP and Rookie of the Year for a given sport."""
    result: dict[str, Any] = {
        "season": season,
        "sport": sport,
        "divisions": {}
    }

    sport_pages = get_pages_for_sport(pages, sport)
    for page in sport_pages:
        lines = page.content.splitlines()
        pu = page.content.upper()
        current_div = "women" if "WOMEN" in pu else ("juniors" if any(j in pu for j in ["JUNIOR", "BOY"]) else "men")

        for idx, line in enumerate(lines):
            line_str = line.strip()
            lu = line_str.upper()

            if "WOMEN" in lu and "DIVISION" in lu: current_div = "women"
            elif any(j in lu for j in ["JUNIOR", "BOY"]) and "DIVISION" in lu: current_div = "juniors"
            elif "MEN" in lu and "DIVISION" in lu: current_div = "men"

            if "MOST VALUABLE PLAYER" in lu or "MVP" in lu:
                clean = re.sub(r'[*`_#]', '', line_str).strip()
                m_mvp = re.search(r'(?:MVP|MOST VALUABLE PLAYER)[^:]*?[:|–—\-]\s*([A-Za-z\s.,\'-]+?)(?:\s*[-–—|]\s*|\s*\()([A-Za-z\s.]+)\)?', clean, re.IGNORECASE)
                if m_mvp:
                    p_name = m_mvp.group(1).strip()
                    p_team = canonicalize_team(m_mvp.group(2))
                    if p_team and p_name.upper() not in ["WINNER", "NAME", "PLAYER"]:
                        if current_div not in result["divisions"]:
                            result["divisions"][current_div] = {}
                        result["divisions"][current_div]["mvp"] = {"player": p_name, "school": p_team}
                else:
                    # Look ahead 1-4 lines for recipient
                    for next_line in lines[idx+1:idx+5]:
                        nl_clean = re.sub(r'[*`_#<>]|br|/br', '', next_line).strip()
                        if not nl_clean:
                            continue
                        if nl_clean.startswith("---") or "ROOKIE" in nl_clean.upper():
                            break
                        m_next = re.search(r'^([A-Za-z\s.,\'-]+?)(?:\s*[-–—|]\s*|\s*\()([A-Za-z\s.]+)\)?$', nl_clean)
                        if m_next:
                            p_name = m_next.group(1).strip()
                            p_team = canonicalize_team(m_next.group(2))
                            if p_team and p_name.upper() not in ["WINNER", "NAME", "PLAYER"]:
                                if current_div not in result["divisions"]:
                                    result["divisions"][current_div] = {}
                                result["divisions"][current_div]["mvp"] = {"player": p_name, "school": p_team}
                                break

            if "ROOKIE OF THE YEAR" in lu or "ROOKIE" in lu:
                clean = re.sub(r'[*`_#]', '', line_str).strip()
                m_roy = re.search(r'(?:ROOKIE OF THE YEAR|ROOKIE)[^:]*?[:|–—\-]\s*([A-Za-z\s.,\'-]+?)(?:\s*[-–—|]\s*|\s*\()([A-Za-z\s.]+)\)?', clean, re.IGNORECASE)
                if m_roy:
                    p_name = m_roy.group(1).strip()
                    p_team = canonicalize_team(m_roy.group(2))
                    if p_team and p_name.upper() not in ["WINNER", "NAME", "PLAYER"]:
                        if current_div not in result["divisions"]:
                            result["divisions"][current_div] = {}
                        result["divisions"][current_div]["rookie_of_the_year"] = {"player": p_name, "school": p_team}
                else:
                    # Look ahead 1-4 lines
                    for next_line in lines[idx+1:idx+5]:
                        nl_clean = re.sub(r'[*`_#<>]|br|/br', '', next_line).strip()
                        if not nl_clean:
                            continue
                        if nl_clean.startswith("---") or "MVP" in nl_clean.upper():
                            break
                        m_next = re.search(r'^([A-Za-z\s.,\'-]+?)(?:\s*[-–—|]\s*|\s*\()([A-Za-z\s.]+)\)?$', nl_clean)
                        if m_next:
                            p_name = m_next.group(1).strip()
                            p_team = canonicalize_team(m_next.group(2))
                            if p_team and p_name.upper() not in ["WINNER", "NAME", "PLAYER"]:
                                if current_div not in result["divisions"]:
                                    result["divisions"][current_div] = {}
                                result["divisions"][current_div]["rookie_of_the_year"] = {"player": p_name, "school": p_team}
                                break

    return result


def extract_other_sports(pages: list[PageSegment], season: str, structured_dir: Path) -> dict[str, Any]:
    """Extract standings and awards across all remaining Olympic and tournament sports."""
    summary = {}
    for sport in OTHER_SPORTS:
        standings = parse_sport_standings(pages, sport, season)
        awards = parse_sport_awards(pages, sport, season)

        if standings["divisions"] or awards["divisions"]:
            s_dir = structured_dir / sport
            s_dir.mkdir(parents=True, exist_ok=True)
            if standings["divisions"]:
                (s_dir / "standings").mkdir(parents=True, exist_ok=True)
                (s_dir / "standings" / f"{season}.json").write_text(json.dumps(standings, indent=2, ensure_ascii=False), encoding="utf-8")
            if awards["divisions"]:
                (s_dir / "awards").mkdir(parents=True, exist_ok=True)
                (s_dir / "awards" / f"{season}.json").write_text(json.dumps(awards, indent=2, ensure_ascii=False), encoding="utf-8")

            summary[sport] = {
                "standings_divs": list(standings["divisions"].keys()),
                "awards_divs": list(awards["divisions"].keys())
            }

    return summary
