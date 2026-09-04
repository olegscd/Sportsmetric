"""
Basketball Statistics Parser for UAAP Annual Reports.

Extracts structured basketball data across all eras (1987–2004):
1. Standings / Final Rankings (Men, Women, Juniors)
2. Game Results (Format variants A, B, C, D)
3. Individual Awards (MVP, Rookie of the Year, Mythical Five)

Emits canonical JSON matching data/structured/basketball/ schema.
"""

import json
import re
from pathlib import Path
from typing import Any

from scripts.parsers.canonicalize import canonicalize_team, SCHOOL_FULL_NAMES
from scripts.parsers.page_splitter import PageSegment, get_pages_for_sport


def parse_basketball_standings(pages: list[PageSegment], season: str) -> dict[str, Any]:
    """Extract basketball standings / final team rankings across divisions."""
    result: dict[str, Any] = {
        "season": season,
        "sport": "basketball",
        "divisions": {}
    }

    bb_pages = get_pages_for_sport(pages, "basketball")
    if not bb_pages:
        return result

    for page in bb_pages:
        lines = page.content.splitlines()
        pu = page.content.upper()

        current_div = "men"
        if any(w in pu for w in ["WOMEN'S DIVISION", "WOMENS DIVISION", "VARSITY - WOMEN", "VARSITY — WOMEN", "WOMEN' DIVISION"]):
            if not any(m in pu for m in ["MEN'S DIVISION", "MENS DIVISION", "VARSITY - MEN"]):
                current_div = "women"
        elif any(j in pu for j in ["JUNIOR'S DIVISION", "JUNIORS DIVISION", "HIGH SCHOOL - BOYS", "HIGH SCHOOL", "BOY'S", "BOYS"]):
            current_div = "juniors"

        for i, line in enumerate(lines):
            lu = line.upper().strip()

            # Detect division headers
            if "WOMEN" in lu and any(term in lu for term in ["DIVISION", "VARSITY", "FINAL", "TOURNAMENT"]):
                current_div = "women"
            elif any(term in lu for term in ["JUNIOR", "BOY", "HIGH SCHOOL"]) and any(term in lu for term in ["DIVISION", "VARSITY", "TOURNAMENT", "FINAL"]):
                current_div = "juniors"
            elif any(term in lu for term in ["MEN", "SENIOR"]) and any(term in lu for term in ["DIVISION", "VARSITY", "FINAL", "TOURNAMENT"]):
                current_div = "men"

            # Case 1: Standings table with W and L columns
            if line.strip().startswith("|") and (" W " in f" {lu} " or "WIN" in lu or "W-L" in lu) and (" L " in f" {lu} " or "LOSS" in lu):
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

                    # Check for Champion / Runner-up text
                    for c in cells:
                        clean_c = re.sub(r'[*`_#]', '', c).strip()
                        if not team:
                            t_cand = canonicalize_team(clean_c)
                            if t_cand:
                                team = t_cand
                                continue
                        if any(term in clean_c.upper() for term in ["CHAMPION", "RUNNER-UP", "RUNNER UP", "PLACE"]):
                            notes = clean_c

                        # Match numbers (wins / losses)
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
                    # Assign rank
                    rows.sort(key=lambda x: (x.get("wins", 0), -x.get("losses", 0)), reverse=True)
                    for rank, r in enumerate(rows, 1):
                        r["rank"] = rank
                    existing = result["divisions"].get(current_div, [])
                    if not existing or len(rows) > len(existing):
                        result["divisions"][current_div] = rows

            # Case 2: Ranked List format (e.g. 2000-2001, 2003-2004, 1989-1990)
            # CHAMPION : ATENEO DE MANILA UNIVERSITY
            # 2nd PLACE : UNIVERSITY OF SANTO TOMAS
            # or Table: | Champion | Far Eastern University |
            if any(term in lu for term in ["FINAL RESULTS", "FINAL RANKING", "FINAL TEAM STANDINGS"]) and not line.strip().startswith("|"):
                ranked_teams = []
                for next_line in lines[i+1:]:
                    nl = next_line.strip()
                    if not nl or nl.startswith("---") or nl.startswith("###"):
                        if ranked_teams and len(ranked_teams) >= 4:
                            break
                        continue

                    # Table row: | Rank | School |
                    if nl.startswith("|"):
                        cells = [re.sub(r'[*`_#<>]', '', c).strip() for c in nl.split("|")[1:-1] if c.strip()]
                        for c in cells:
                            tc = canonicalize_team(c)
                            if tc and tc not in [rt["school"] for rt in ranked_teams]:
                                ranked_teams.append({"school": tc})
                        continue

                    # Bullet or colon: CHAMPION : DLSU / 1. DLSU / * CHAMPION: DLSU
                    clean_nl = re.sub(r'[*`_#]', '', nl).strip()
                    m_rank = re.search(r'(?:CHAMPION|RUNNER-UP|\d+(?:st|nd|rd|th)?\s+PLACE|\d+\.)\s*[:–—\-]?\s*([A-Za-z\s.]+)', clean_nl, re.IGNORECASE)
                    if m_rank:
                        cand = m_rank.group(1).strip()
                        tc = canonicalize_team(cand)
                        if tc and tc not in [rt["school"] for rt in ranked_teams]:
                            ranked_teams.append({"school": tc})

                if len(ranked_teams) >= 4 and current_div not in result["divisions"]:
                    for rank, rt in enumerate(ranked_teams, 1):
                        rt["rank"] = rank
                    result["divisions"][current_div] = ranked_teams

    return result


def parse_basketball_awards(pages: list[PageSegment], season: str) -> dict[str, Any]:
    """Extract MVP, Rookie of the Year, Mythical Five awards for modern seasons."""
    result: dict[str, Any] = {
        "season": season,
        "sport": "basketball",
        "divisions": {}
    }

    bb_pages = get_pages_for_sport(pages, "basketball")
    if not bb_pages:
        return result

    for page in bb_pages:
        lines = page.content.splitlines()
        pu = page.content.upper()

        current_div = "men"
        if any(w in pu for w in ["WOMEN'S DIVISION", "WOMENS DIVISION", "WOMEN' DIVISION", "WOMEN"]):
            if not any(m in pu for m in ["MEN'S DIVISION", "MENS DIVISION", "VARSITY - MEN"]):
                current_div = "women"
        elif any(j in pu for j in ["JUNIOR'S DIVISION", "JUNIORS DIVISION", "HIGH SCHOOL", "BOYS"]):
            current_div = "juniors"

        in_mythical = False
        mythical_list: list[dict[str, Any]] = []

        for line in lines:
            line_str = line.strip()
            lu = line_str.upper()

            # Division switch
            if "WOMEN" in lu and any(t in lu for t in ["DIVISION", "VARSITY", "BASKETBALL", "FINAL"]):
                current_div = "women"
            elif any(t in lu for t in ["JUNIOR", "BOY", "HIGH SCHOOL"]) and any(t in lu for t in ["DIVISION", "VARSITY", "BASKETBALL", "FINAL"]):
                current_div = "juniors"
            elif any(t in lu for t in ["MEN", "SENIOR"]) and any(t in lu for t in ["DIVISION", "VARSITY", "BASKETBALL", "FINAL"]):
                current_div = "men"

            # Mythical Five detection
            if "MYTHICAL" in lu or "MYHTICAL" in lu:
                in_mythical = True
                continue

            if in_mythical:
                # Stop if hitting another major heading
                if line_str.startswith("#") or "FINAL" in lu or "STANDINGS" in lu or "SCHEDULE" in lu:
                    if mythical_list:
                        if current_div not in result["divisions"]:
                            result["divisions"][current_div] = {}
                        result["divisions"][current_div]["mythical_five"] = mythical_list[:5]
                        mythical_list = []
                    in_mythical = False

                clean = re.sub(r'[*`_#]', '', line_str).strip()
                if clean.startswith("|"):
                    cells = [c.strip() for c in clean.split("|")[1:-1] if c.strip()]
                    if len(cells) >= 2:
                        team = None
                        pos = None
                        player = None
                        for c in cells:
                            tc = canonicalize_team(c)
                            if tc:
                                team = tc
                            elif any(pos_kw in c.upper() for pos_kw in ["GUARD", "FORWARD", "CENTER", "G", "F", "C", "OFF-GUARD", "POINT GUARD"]):
                                pos = c
                            elif c not in ["-", ":", "Position", "Player", "Team", "Name"]:
                                if not player and len(c) > 2 and not c.startswith("(") and not re.match(r'^\d+$', c):
                                    player = c
                        if player and team and player.upper() not in ["MVP", "ROOKIE", "CHAMPION", "ROOKIE OF THE YEAR"]:
                            if not any(m["player"] == player for m in mythical_list):
                                mythical_list.append({"player": player, "school": team, "position": pos})
                else:
                    m_bullet = re.search(r'([A-Za-z\s.,\'-]+?)\s*[-–—:]\s*(?:([A-Za-z\s/]+)\s*)?\(([A-Za-z\s.]+)\)', clean)
                    if m_bullet:
                        p_name = m_bullet.group(1).strip()
                        p_pos = m_bullet.group(2).strip() if m_bullet.group(2) else None
                        p_team = canonicalize_team(m_bullet.group(3))
                        if p_team and p_name.upper() not in ["MVP", "ROOKIE", "CHAMPION", "ROOKIE OF THE YEAR", "WINNER"] and len(p_name) > 2:
                            if not any(m["player"] == p_name for m in mythical_list):
                                mythical_list.append({"player": p_name, "school": p_team, "position": p_pos})

            # MVP parsing
            if "MOST VALUABLE PLAYER" in lu or "MVP" in lu:
                clean = re.sub(r'[*`_#]', '', line_str).strip()
                m_mvp = re.search(r'(?:MVP|MOST VALUABLE PLAYER)[^:]*?[:|]\s*([A-Za-z\s.,\'-]+?)(?:\s*[-–—|]\s*|\s*\()([A-Za-z\s.]+)\)?', clean, re.IGNORECASE)
                if m_mvp:
                    p_name = m_mvp.group(1).strip()
                    p_team = canonicalize_team(m_mvp.group(2))
                    if p_team and p_name.upper() not in ["WINNER", "NAME", "PLAYER", "SCHOOL"]:
                        if current_div not in result["divisions"]:
                            result["divisions"][current_div] = {}
                        result["divisions"][current_div]["mvp"] = {"player": p_name, "school": p_team}

            # Rookie of the Year parsing
            if "ROOKIE OF THE YEAR" in lu or "ROOKIE" in lu:
                clean = re.sub(r'[*`_#]', '', line_str).strip()
                m_roy = re.search(r'(?:ROOKIE OF THE YEAR|ROOKIE)[^:]*?[:|]\s*([A-Za-z\s.,\'-]+?)(?:\s*[-–—|]\s*|\s*\()([A-Za-z\s.]+)\)?', clean, re.IGNORECASE)
                if m_roy:
                    p_name = m_roy.group(1).strip()
                    p_team = canonicalize_team(m_roy.group(2))
                    if p_team and p_name.upper() not in ["WINNER", "NAME", "PLAYER", "SCHOOL"]:
                        if current_div not in result["divisions"]:
                            result["divisions"][current_div] = {}
                        result["divisions"][current_div]["rookie_of_the_year"] = {"player": p_name, "school": p_team}

        if mythical_list:
            if current_div not in result["divisions"]:
                result["divisions"][current_div] = {}
            if "mythical_five" not in result["divisions"][current_div]:
                result["divisions"][current_div]["mythical_five"] = mythical_list[:5]

    return result


def parse_basketball_game_results(pages: list[PageSegment], season: str) -> list[dict[str, Any]]:
    """
    Parse basketball game results across all seasons, handling all 4 format variants:
      - Format A: 1987-1988, 1988-1989 (Early Era Game Boxes, Tables, & Inline Text)
      - Format B: 1989-1990 (Compact tabular d. matches)
      - Format C: 1998-1999, 1999-2000 (Transitional tabular & bullet defeated matches)
      - Format D: 2000-2001, 2003-2004 (Modern schedule tables & shorthand scores)
    """
    bb_pages = get_pages_for_sport(pages, "basketball")
    if not bb_pages:
        return []

    games: list[dict[str, Any]] = []
    current_div = "men"
    current_round = "elimination"
    current_date: str | None = None
    current_venue: str | None = None

    # Track multi-line game box state (for 1988-1989 format)
    box_game_no: int | None = None
    box_team1: str | None = None
    box_team2: str | None = None
    box_scores: list[int] = []
    box_is_champ = False

    def commit_box_game():
        nonlocal box_game_no, box_team1, box_team2, box_scores, box_is_champ
        if box_team1 and box_team2 and len(box_scores) >= 2:
            s1, s2 = box_scores[0], box_scores[1]
            w_team, w_score = (box_team1, s1) if s1 >= s2 else (box_team2, s2)
            l_team, l_score = (box_team2, s2) if s1 >= s2 else (box_team1, s1)
            # Avoid duplicate game entries
            if not any(g.get("game_number") == box_game_no and g["winner"]["school"] == w_team for g in games):
                games.append({
                    "season": season,
                    "sport": "basketball",
                    "division": current_div,
                    "round": "championship" if box_is_champ else current_round,
                    "game_number": box_game_no,
                    "date": current_date,
                    "venue": current_venue,
                    "winner": {"school": w_team, "score": w_score},
                    "loser": {"school": l_team, "score": l_score},
                    "is_championship": box_is_champ
                })
        box_game_no = None
        box_team1 = None
        box_team2 = None
        box_scores = []
        box_is_champ = False

    for page in bb_pages:
        lines = page.content.splitlines()
        pu = page.content.upper()

        if any(w in pu for w in ["WOMEN'S DIVISION", "WOMENS DIVISION", "VARSITY - WOMEN", "VARSITY — WOMEN"]):
            if not any(m in pu for m in ["MEN'S DIVISION", "MENS DIVISION", "VARSITY - MEN"]):
                current_div = "women"
        elif any(j in pu for j in ["JUNIOR'S DIVISION", "JUNIORS DIVISION", "HIGH SCHOOL - BOYS", "HIGH SCHOOL", "BOY'S", "BOYS", "BOY’S"]):
            current_div = "juniors"

        for line in lines:
            line_str = line.strip()
            lu = line_str.upper()

            # Division tracking
            if "WOMEN" in lu and any(t in lu for t in ["DIVISION", "VARSITY", "BASKETBALL"]):
                current_div = "women"
            elif any(t in lu for t in ["JUNIOR", "BOY", "HIGH SCHOOL"]) and any(t in lu for t in ["DIVISION", "VARSITY", "BASKETBALL", "TOURNAMENT"]):
                current_div = "juniors"
            elif any(t in lu for t in ["MEN", "SENIOR"]) and any(t in lu for t in ["DIVISION", "VARSITY", "BASKETBALL"]):
                current_div = "men"

            # Round tracking
            if "FIRST ROUND" in lu or "1ST ROUND" in lu or "1^ST^ ROUND" in lu:
                current_round = "first_round"
            elif "SECOND ROUND" in lu or "2ND ROUND" in lu or "2^ND^ ROUND" in lu:
                current_round = "second_round"
            elif "FINAL FOUR" in lu or "SEMI FINAL" in lu or "SEMI-FINAL" in lu:
                current_round = "final_four"
            elif "CHAMPIONSHIP" in lu or "FINALS" in lu:
                current_round = "championship"
            elif "PLAYOFF" in lu or "PLAY-OFF" in lu:
                current_round = "playoff"

            # Date tracking
            dm = re.search(r'Date:?\s*([A-Za-z0-9,\s\-–—]+(?:19\d\d|20\d\d))', line_str, re.IGNORECASE)
            if not dm:
                dm = re.search(r'([0-9]{1,2}\s+[A-Za-z]+\s+(?:19\d\d|20\d\d))', line_str)
            if not dm:
                dm = re.search(r'([A-Za-z]+,\s+[A-Za-z]+\s+[0-9]{1,2},\s+(?:19\d\d|20\d\d))', line_str)
            if dm:
                current_date = dm.group(1).strip()

            vm = re.search(r'Venue:?\s*([^#*<\n]+)', line_str, re.IGNORECASE)
            if vm:
                current_venue = vm.group(1).strip()

            # Game No tracking
            gn_m = re.search(r'GAME NO\.?\s*(\d+)', lu)
            if gn_m:
                commit_box_game()
                box_game_no = int(gn_m.group(1))
                box_is_champ = "CHAMPIONSHIP" in lu

            # Format D1: Schedule table (2003-2004)
            # | Saturday | 12-Jul-03 Araneta Coliseum | 2:00 PM | 70 | UP | vs. | NU | 74 | Srs |
            if line_str.startswith("|") and " vs." in line_str:
                cells = [c.strip() for c in line_str.split("|")[1:-1]]
                try:
                    vs_idx = -1
                    for idx, c in enumerate(cells):
                        if c.lower() == "vs.":
                            vs_idx = idx
                            break
                    if vs_idx >= 2 and vs_idx + 2 < len(cells):
                        t1 = canonicalize_team(cells[vs_idx - 1])
                        s1_str = re.sub(r'[^\d]', '', cells[vs_idx - 2])
                        t2 = canonicalize_team(cells[vs_idx + 1])
                        s2_str = re.sub(r'[^\d]', '', cells[vs_idx + 2])

                        div_code = cells[-1].lower() if len(cells) > vs_idx + 3 else ""
                        div = current_div
                        if "srs" in div_code or "men" in div_code: div = "men"
                        elif "jrs" in div_code or "boy" in div_code: div = "juniors"
                        elif "w" in div_code or "women" in div_code: div = "women"

                        if t1 and t2 and s1_str and s2_str:
                            s1, s2 = int(s1_str), int(s2_str)
                            w_team, w_score = (t1, s1) if s1 >= s2 else (t2, s2)
                            l_team, l_score = (t2, s2) if s1 >= s2 else (t1, s1)
                            games.append({
                                "season": season,
                                "sport": "basketball",
                                "division": div,
                                "round": current_round,
                                "date": current_date,
                                "venue": current_venue,
                                "winner": {"school": w_team, "score": w_score},
                                "loser": {"school": l_team, "score": l_score},
                                "is_championship": current_round == "championship"
                            })
                            continue
                except Exception:
                    pass

            # Format B: Compact table row (1989-1990)
            # | Match No. 1 | — | F E U | 93 | d. | U P | 74 | 46 | — | 34 |
            if line_str.startswith("|") and (" d. " in line_str or " d " in line_str or " def " in line_str or " def. " in line_str):
                cells = [c.strip() for c in line_str.split("|")[1:-1]]
                team_cells = []
                num_cells = []
                for c in cells:
                    tc = canonicalize_team(c)
                    if tc:
                        team_cells.append(tc)
                    elif re.match(r'^\d{2,3}$', c):
                        num_cells.append(int(c))
                if len(team_cells) >= 2 and len(num_cells) >= 2:
                    t1, t2 = team_cells[0], team_cells[1]
                    s1, s2 = num_cells[0], num_cells[1]
                    ht = None
                    if len(num_cells) >= 4:
                        ht = {"winner": num_cells[2], "loser": num_cells[3]}
                    w_team, w_score = (t1, s1) if s1 >= s2 else (t2, s2)
                    l_team, l_score = (t2, s2) if s1 >= s2 else (t1, s1)
                    games.append({
                        "season": season,
                        "sport": "basketball",
                        "division": current_div,
                        "round": current_round,
                        "date": current_date,
                        "venue": current_venue,
                        "winner": {"school": w_team, "score": w_score},
                        "loser": {"school": l_team, "score": l_score},
                        "halftime": ht,
                        "is_championship": current_round == "championship"
                    })
                    continue

            # Format A1 & C1: Table row with Defeated
            # | 1st Game | U.P. | 88 | Defeated | ATENEO | 80 | (43 - 48) |
            # | **UE** | defeated | **ADMU** | 77 - 68 |
            if line_str.startswith("|") and ("defeated" in line_str.lower() or "def." in line_str.lower()):
                cells = [re.sub(r'[*`_#]', '', c).strip() for c in line_str.split("|")[1:-1]]
                if len(cells) >= 4:
                    t1 = canonicalize_team(cells[0])
                    t2 = canonicalize_team(cells[2])
                    score_m = re.search(r'(\d{2,3})\s*[-–—]\s*(\d{2,3})', cells[3])
                    if t1 and t2 and score_m:
                        s1, s2 = int(score_m.group(1)), int(score_m.group(2))
                        w_team, w_score = (t1, s1) if s1 >= s2 else (t2, s2)
                        l_team, l_score = (t2, s2) if s1 >= s2 else (t1, s1)
                        games.append({
                            "season": season,
                            "sport": "basketball",
                            "division": current_div,
                            "round": current_round,
                            "date": current_date,
                            "venue": current_venue,
                            "winner": {"school": w_team, "score": w_score},
                            "loser": {"school": l_team, "score": l_score},
                            "is_championship": current_round == "championship"
                        })
                        continue

                # Also try multi-cell format: team1 in cell 1, score1 in cell 2, team2 in cell 4, score2 in cell 5
                if len(cells) >= 6:
                    t1_c = canonicalize_team(cells[1])
                    t2_c = canonicalize_team(cells[4])
                    if t1_c and t2_c and cells[2].isdigit() and cells[5].isdigit():
                        s1, s2 = int(cells[2]), int(cells[5])
                        ht = None
                        if len(cells) >= 7:
                            htm = re.search(r'\(?(\d{1,3})\s*[-–—]\s*(\d{1,3})\)?', cells[6])
                            if htm:
                                ht = {"winner": int(htm.group(1)), "loser": int(htm.group(2))}
                        w_team, w_score = (t1_c, s1) if s1 >= s2 else (t2_c, s2)
                        l_team, l_score = (t2_c, s2) if s1 >= s2 else (t1_c, s1)
                        games.append({
                            "season": season,
                            "sport": "basketball",
                            "division": current_div,
                            "round": current_round,
                            "date": current_date,
                            "venue": current_venue,
                            "winner": {"school": w_team, "score": w_score},
                            "loser": {"school": l_team, "score": l_score},
                            "halftime": ht,
                            "is_championship": current_round == "championship"
                        })
                        continue

            # Format A2 & C2 & D2: Inline / Bullet defeated text
            # 1st Game ATENEO 98 Defeated DLSU 89 (52 - 49)
            # ADMU defeated UE 75 - 44
            # * AdU d DLSU: 63-58
            # * FIRST PLACE: UE 55 def. UP 50
            inline_m = re.search(
                r'(?:(?:[\*\-•]\s*|\d+(?:st|nd|rd|th)?\s+Game\s+)?([A-Za-z0-9.\-\s]+?))\s+(?:defeated|def\.?|d\.?|d)\s+([A-Za-z0-9.\-\s]+?)[:\s]+(\d{2,3})\s*[-–—]\s*(\d{2,3})',
                line_str,
                re.IGNORECASE
            )
            if inline_m and not line_str.startswith("|"):
                t1 = canonicalize_team(inline_m.group(1))
                t2 = canonicalize_team(inline_m.group(2))
                s1 = int(inline_m.group(3))
                s2 = int(inline_m.group(4))
                if t1 and t2:
                    w_team, w_score = (t1, s1) if s1 >= s2 else (t2, s2)
                    l_team, l_score = (t2, s2) if s1 >= s2 else (t1, s1)
                    games.append({
                        "season": season,
                        "sport": "basketball",
                        "division": current_div,
                        "round": current_round,
                        "date": current_date,
                        "venue": current_venue,
                        "winner": {"school": w_team, "score": w_score},
                        "loser": {"school": l_team, "score": l_score},
                        "is_championship": current_round == "championship"
                    })
                    continue

            # Early era inline variant: ATENEO 94 Defeated U.E. 92 (38 - 51)
            inline_score_first = re.search(
                r'(?:(\d+(?:st|nd|rd|th)?\s+Game)\s+)?([A-Za-z\s.]+?)\s+(\d{2,3})\s+(?:Defeated|def\.?|d\.?)\s+([A-Za-z\s.]+?)\s+(\d{2,3})(?:\s*\((\d{1,3})\s*[-–—]\s*(\d{1,3})\))?',
                line_str,
                re.IGNORECASE
            )
            if inline_score_first and not line_str.startswith("|"):
                t1 = canonicalize_team(inline_score_first.group(2))
                s1 = int(inline_score_first.group(3))
                t2 = canonicalize_team(inline_score_first.group(4))
                s2 = int(inline_score_first.group(5))
                if t1 and t2:
                    ht = None
                    if inline_score_first.group(6) and inline_score_first.group(7):
                        ht = {"winner": int(inline_score_first.group(6)), "loser": int(inline_score_first.group(7))}
                    w_team, w_score = (t1, s1) if s1 >= s2 else (t2, s2)
                    l_team, l_score = (t2, s2) if s1 >= s2 else (t1, s1)
                    games.append({
                        "season": season,
                        "sport": "basketball",
                        "division": current_div,
                        "round": current_round,
                        "date": current_date,
                        "venue": current_venue,
                        "winner": {"school": w_team, "score": w_score},
                        "loser": {"school": l_team, "score": l_score},
                        "halftime": ht,
                        "is_championship": current_round == "championship"
                    })
                    continue

            # Multi-line box parsing (1988-1989)
            if box_game_no is not None:
                if "DEFEATED" in lu:
                    parts = re.split(r'DEFEATED', line_str, flags=re.IGNORECASE)
                    if len(parts) == 2:
                        t1_c = canonicalize_team(re.sub(r'[*_#`]', '', parts[0]))
                        t2_c = canonicalize_team(re.sub(r'[*_#`]', '', parts[1]))
                        if t1_c: box_team1 = t1_c
                        if t2_c: box_team2 = t2_c
                score_m = re.search(r'FINAL\s+SCORE:?\s*[*`]?(\d{2,3})(?:\s*[-–—]\s*(\d{2,3}))?', line_str, re.IGNORECASE)
                if score_m:
                    s1 = int(score_m.group(1))
                    if s1 not in box_scores:
                        box_scores.append(s1)
                    if score_m.group(2):
                        s2 = int(score_m.group(2))
                        if s2 not in box_scores:
                            box_scores.append(s2)
                t_cand = canonicalize_team(re.sub(r'[*_#`]', '', line_str))
                if t_cand:
                    if not box_team1:
                        box_team1 = t_cand
                    elif not box_team2 and t_cand != box_team1:
                        box_team2 = t_cand

    commit_box_game()
    return games


def save_basketball_data(data: dict[str, Any], data_type: str, output_dir: Path) -> Path:
    """Save structured basketball JSON to data/structured/basketball/{data_type}/{season}.json."""
    type_dir = output_dir / data_type
    type_dir.mkdir(parents=True, exist_ok=True)
    out_path = type_dir / f"{data['season']}.json"
    out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return out_path


def extract_basketball(pages: list[PageSegment], season: str, structured_dir: Path) -> dict[str, Any]:
    """Run full basketball extraction pipeline for a season and save JSON artifacts."""
    bb_dir = structured_dir / "basketball"
    bb_dir.mkdir(parents=True, exist_ok=True)

    # 1. Standings
    standings = parse_basketball_standings(pages, season)
    if standings["divisions"]:
        save_basketball_data(standings, "standings", bb_dir)

    # 2. Games
    games = parse_basketball_game_results(pages, season)
    games_doc = {
        "season": season,
        "sport": "basketball",
        "total_games": len(games),
        "games": games
    }
    if games:
        save_basketball_data(games_doc, "games", bb_dir)

    # 3. Awards
    awards = parse_basketball_awards(pages, season)
    if awards["divisions"]:
        save_basketball_data(awards, "awards", bb_dir)

    return {
        "standings": standings,
        "games": games_doc,
        "awards": awards
    }
