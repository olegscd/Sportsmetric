"""
Volleyball Statistics Parser for UAAP Annual Reports.

Extracts:
1. Standings / W-L records (Men, Women, Juniors/Boys/Girls)
2. Match Results (Sets, winner, loser)
3. Individual Awards (MVP, Rookie of the Year)
"""

import json
import re
from pathlib import Path
from typing import Any

from scripts.parsers.canonicalize import canonicalize_team
from scripts.parsers.page_splitter import PageSegment, get_pages_for_sport


def parse_volleyball_standings(pages: list[PageSegment], season: str) -> dict[str, Any]:
    """Extract volleyball team standings / final rankings."""
    result: dict[str, Any] = {
        "season": season,
        "sport": "volleyball",
        "divisions": {}
    }

    vb_pages = get_pages_for_sport(pages, "volleyball")
    if not vb_pages:
        return result

    for page in vb_pages:
        lines = page.content.splitlines()
        pu = page.content.upper()

        current_div = "men"
        if "WOMEN" in pu:
            current_div = "women"
        elif any(j in pu for j in ["JUNIOR", "BOY", "GIRL"]):
            current_div = "juniors"

        for i, line in enumerate(lines):
            lu = line.upper().strip()

            if "WOMEN" in lu and any(t in lu for t in ["DIVISION", "FINAL", "RESULTS"]):
                current_div = "women"
            elif any(t in lu for t in ["JUNIOR", "BOY", "GIRL"]) and any(t in lu for t in ["DIVISION", "FINAL", "RESULTS"]):
                current_div = "juniors"
            elif any(t in lu for t in ["MEN", "SENIOR"]) and any(t in lu for t in ["DIVISION", "FINAL", "RESULTS"]):
                current_div = "men"

            # Table with W and L
            if line.strip().startswith("|") and (" W " in f" {lu} " or "WIN" in lu or "WON" in lu) and (" L " in f" {lu} " or "LOSS" in lu or "LOST" in lu):
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

                        num_m = re.match(r'^(\d{1,2})$', clean_c)
                        if num_m:
                            num = int(num_m.group(1))
                            if w is None:
                                w = num
                            elif l is None:
                                l = num

                    if team and w is not None and l is not None:
                        total_g = w + l
                        pct = round(w / total_g, 3) if total_g > 0 else 0.0
                        entry: dict[str, Any] = {
                            "school": team,
                            "wins": w,
                            "losses": l,
                            "pct": pct
                        }
                        if notes:
                            entry["notes"] = notes
                        rows.append(entry)

                if len(rows) >= 4:
                    rows.sort(key=lambda x: (x.get("wins", 0), -x.get("losses", 0)), reverse=True)
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
                        if ranked and len(ranked) >= 4:
                            break
                        continue
                    clean_nl = re.sub(r'[*`_#]', '', nl).strip()
                    m_rank = re.search(r'(?:CHAMPION|RUNNER-UP|\d+(?:st|nd|rd|th)?\s+PLACE|\d+\.)\s*[:–—\-]?\s*([A-Za-z\s.]+)', clean_nl, re.IGNORECASE)
                    if m_rank:
                        tc = canonicalize_team(m_rank.group(1).strip())
                        if tc and tc not in [r["school"] for r in ranked]:
                            ranked.append({"school": tc})
                if len(ranked) >= 4 and current_div not in result["divisions"]:
                    for rank, r in enumerate(ranked, 1):
                        r["rank"] = rank
                    result["divisions"][current_div] = ranked

    return result


def parse_volleyball_awards(pages: list[PageSegment], season: str) -> dict[str, Any]:
    """Extract MVP and Rookie of the Year awards for volleyball."""
    result: dict[str, Any] = {
        "season": season,
        "sport": "volleyball",
        "divisions": {}
    }

    vb_pages = get_pages_for_sport(pages, "volleyball")
    for page in vb_pages:
        lines = page.content.splitlines()
        pu = page.content.upper()
        current_div = "women" if "WOMEN" in pu else ("juniors" if any(j in pu for j in ["JUNIOR", "BOY"]) else "men")

        for line in lines:
            line_str = line.strip()
            lu = line_str.upper()

            if "WOMEN" in lu and "DIVISION" in lu:
                current_div = "women"
            elif any(j in lu for j in ["JUNIOR", "BOY"]) and "DIVISION" in lu:
                current_div = "juniors"
            elif "MEN" in lu and "DIVISION" in lu:
                current_div = "men"

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


def parse_volleyball_games(pages: list[PageSegment], season: str) -> list[dict[str, Any]]:
    """Parse volleyball match scores."""
    vb_pages = get_pages_for_sport(pages, "volleyball")
    games: list[dict[str, Any]] = []
    current_div = "men"
    current_round = "elimination"

    for page in vb_pages:
        lines = page.content.splitlines()
        pu = page.content.upper()
        if "WOMEN" in pu: current_div = "women"
        elif any(j in pu for j in ["JUNIOR", "BOY", "GIRL"]): current_div = "juniors"

        for line in lines:
            line_str = line.strip()
            lu = line_str.upper()

            if "WOMEN" in lu and "DIVISION" in lu: current_div = "women"
            elif any(j in lu for j in ["JUNIOR", "BOY"]) and "DIVISION" in lu: current_div = "juniors"
            elif "MEN" in lu and "DIVISION" in lu: current_div = "men"

            if "CHAMPIONSHIP" in lu or "FINALS" in lu: current_round = "championship"
            elif "SECOND ROUND" in lu: current_round = "second_round"
            elif "FIRST ROUND" in lu: current_round = "first_round"

            # Table row: | DLSU | defeated | UST | 3 - 1 |
            # or | UST | d | FEU | 3-2 |
            if line_str.startswith("|") and ("defeated" in line_str.lower() or " d " in line_str.lower() or " d. " in line_str.lower()):
                cells = [re.sub(r'[*`_#]', '', c).strip() for c in line_str.split("|")[1:-1]]
                if len(cells) >= 4:
                    t1 = canonicalize_team(cells[0])
                    t2 = canonicalize_team(cells[2])
                    score_m = re.search(r'(\d)\s*[-–—]\s*(\d)', cells[3])
                    if t1 and t2:
                        s1 = int(score_m.group(1)) if score_m else 3
                        s2 = int(score_m.group(2)) if score_m else 0
                        games.append({
                            "season": season,
                            "sport": "volleyball",
                            "division": current_div,
                            "round": current_round,
                            "winner": {"school": t1, "score": s1},
                            "loser": {"school": t2, "score": s2},
                            "is_championship": current_round == "championship"
                        })
                        continue

            # Inline text / bullet: UST defeated FEU 3-1
            # * DLSU def. UST: 3-0
            m_inline = re.search(r'(?:[\*\-•]\s*)?([A-Za-z0-9.\-\s]+?)\s+(?:defeated|def\.?|d\.?|d)\s+([A-Za-z0-9.\-\s]+?)[:\s]+(\d)\s*[-–—]\s*(\d)', line_str, re.IGNORECASE)
            if m_inline and not line_str.startswith("|"):
                t1 = canonicalize_team(m_inline.group(1))
                t2 = canonicalize_team(m_inline.group(2))
                s1 = int(m_inline.group(3))
                s2 = int(m_inline.group(4))
                if t1 and t2:
                    games.append({
                        "season": season,
                        "sport": "volleyball",
                        "division": current_div,
                        "round": current_round,
                        "winner": {"school": t1, "score": s1},
                        "loser": {"school": t2, "score": s2},
                        "is_championship": current_round == "championship"
                    })

    return games


def extract_volleyball(pages: list[PageSegment], season: str, structured_dir: Path) -> dict[str, Any]:
    """Run full volleyball extraction pipeline for a season and save JSON artifacts."""
    vb_dir = structured_dir / "volleyball"
    vb_dir.mkdir(parents=True, exist_ok=True)

    standings = parse_volleyball_standings(pages, season)
    if standings["divisions"]:
        (vb_dir / "standings").mkdir(parents=True, exist_ok=True)
        (vb_dir / "standings" / f"{season}.json").write_text(json.dumps(standings, indent=2, ensure_ascii=False), encoding="utf-8")

    games = parse_volleyball_games(pages, season)
    games_doc = {"season": season, "sport": "volleyball", "total_games": len(games), "games": games}
    if games:
        (vb_dir / "games").mkdir(parents=True, exist_ok=True)
        (vb_dir / "games" / f"{season}.json").write_text(json.dumps(games_doc, indent=2, ensure_ascii=False), encoding="utf-8")

    awards = parse_volleyball_awards(pages, season)
    if awards["divisions"]:
        (vb_dir / "awards").mkdir(parents=True, exist_ok=True)
        (vb_dir / "awards" / f"{season}.json").write_text(json.dumps(awards, indent=2, ensure_ascii=False), encoding="utf-8")

    return {"standings": standings, "games": games_doc, "awards": awards}
