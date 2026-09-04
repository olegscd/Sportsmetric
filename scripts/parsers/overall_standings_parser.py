"""
Overall Team Standings Parser for UAAP Annual Reports.

Extracts the general championship / overall points-based standings that appear
in every season's annual report. These tables rank schools by total points
across all sports for a given season.

Handles two formats:
  - Simple: School | TOTAL POINTS (early era, some modern)
  - Detailed: School | Sport1 | Sport2 | ... | TOTAL POINTS (per-sport breakdown)

Both College Division and Junior Division standings are extracted.
"""

import json
import re
from pathlib import Path

from scripts.parsers.canonicalize import canonicalize_team
from scripts.parsers.page_splitter import PageSegment


def _parse_simple_standings_table(lines: list[str], division: str) -> list[dict]:
    """
    Parse a simple two-column standings table:
      | School Name | Points |
    """
    rankings = []
    rank = 0
    for line in lines:
        line = line.strip()
        if not line.startswith("|"):
            continue
        # Skip separator rows
        if re.match(r'\|\s*[-:]+', line):
            continue
        
        cells = [c.strip() for c in line.split("|") if c.strip()]
        if len(cells) < 2:
            continue
        
        # Skip header rows
        first_upper = cells[0].upper().strip()
        if any(kw in first_upper for kw in ["SCHOOL", "TOTAL", "---"]):
            continue
        
        # Try to find school name and points
        school_name = cells[0]
        points_str = cells[-1]
        
        # Clean up points
        points_str = re.sub(r'[^0-9.\-½]', '', points_str)
        if '½' in cells[-1]:
            points_str = points_str.replace('½', '') 
            try:
                points = float(points_str) + 0.5 if points_str else 0.5
            except ValueError:
                continue
        else:
            try:
                points = float(points_str) if points_str else 0
            except ValueError:
                continue
        
        if points == 0 and rank == 0:
            continue
            
        team_code = canonicalize_team(school_name)
        if not team_code:
            continue
        
        rank += 1
        rankings.append({
            "rank": rank,
            "school": team_code,
            "total_points": points,
        })
    
    return rankings


def _parse_detailed_standings_table(lines: list[str], division: str) -> list[dict]:
    """
    Parse a detailed multi-column standings table with per-sport breakdowns:
      | School | BB M | BB W | VB M | ... | TOTAL POINTS |
    """
    rankings = []
    header_line = None
    sport_columns = []
    
    for line in lines:
        line = line.strip()
        if not line.startswith("|"):
            continue
        if re.match(r'\|\s*[-:]+', line):
            continue
        
        cells = [c.strip() for c in line.split("|") if c.strip()]
        if not cells:
            continue
        
        first_upper = cells[0].upper()
        
        # Detect header row (contains sport abbreviations or SCHOOL)
        if "SCHOOL" in first_upper or ("BB" in re.sub(r'<[^>]+>', '', first_upper) and len(cells) > 5):
            header_line = cells
            # Extract sport column names (everything except SCHOOL and TOTAL)
            sport_columns = []
            for i, h in enumerate(cells):
                # Clean HTML tags
                h_clean = re.sub(r'<[^>]+>', ' ', h).strip()
                h_upper = h_clean.upper().strip()
                if h_upper in ("SCHOOL", "", "TOTAL POINTS", "TOTAL", "PLACES"):
                    continue
                sport_columns.append((i, h_clean.strip()))

            continue
        
        # Skip sub-header rows (M/W indicators)
        if first_upper in ("M", "W", ""):
            continue
        
        # Data row
        team_code = canonicalize_team(cells[0])
        if not team_code:
            continue
        
        # Get total points (last column)
        total_str = re.sub(r'[^0-9.\-½]', '', cells[-1])
        if '½' in cells[-1]:
            total_str = total_str.replace('½', '')
            try:
                total = float(total_str) + 0.5 if total_str else 0.5
            except ValueError:
                total = 0
        else:
            try:
                total = float(total_str) if total_str else 0
            except ValueError:
                total = 0
        
        # Extract per-sport points
        sport_points = {}
        for col_idx, sport_name in sport_columns:
            if col_idx < len(cells):
                val = cells[col_idx].strip()
                if val in ("-", "", "—"):
                    sport_points[sport_name] = 0
                else:
                    try:
                        sp_val = re.sub(r'[^0-9.\-½]', '', val)
                        if '½' in val:
                            sp_val = sp_val.replace('½', '')
                            sport_points[sport_name] = float(sp_val) + 0.5 if sp_val else 0.5
                        else:
                            sport_points[sport_name] = float(sp_val) if sp_val else 0
                    except ValueError:
                        sport_points[sport_name] = 0
        
        entry = {
            "rank": len(rankings) + 1,
            "school": team_code,
            "total_points": total,
        }
        if sport_points:
            entry["sport_points"] = sport_points
        
        rankings.append(entry)
    
    return rankings


def parse_overall_standings(pages: list[PageSegment], season: str) -> dict:
    """
    Extract overall team standings from classified pages.
    
    Returns a dict with:
    {
        "season": "1987-1988",
        "divisions": {
            "college": [...],
            "junior": [...]
        }
    }
    """
    result = {
        "season": season,
        "divisions": {}
    }
    
    for page in pages:
        upper = page.content.upper()
        
        # Check if this page has overall standings (including SCOREBOARD)
        has_overall = any(term in upper for term in [
            "OVER-ALL TEAM STANDING",
            "OVERALL TEAM STANDING",
            "OVER-ALL STANDING OF TEAMS",
            "TEAM STANDING\nSY",
            "UAAP SCOREBOARD",
        ])
        if not has_overall:
            continue
        
        lines = page.content.split("\n")
        
        # Find division sections
        current_division = None
        section_lines: list[str] = []
        
        for line in lines:
            line_upper = line.upper().strip()
            # Remove markdown/HTML formatting for matching
            line_clean = re.sub(r'[#*<>/\\_]', '', line_upper).strip()
            
            # Detect division headers
            if ("COLLEGE" in line_clean and ("DIVISION" in line_clean or not any(kw in line_clean for kw in ["JUNIOR", "HIGH SCHOOL"]))) \
                or line_clean == "COLLEGE DIVISION" or line_clean == "COLLEGE":
                # Save previous section
                if current_division and section_lines:
                    _process_section(result, current_division, section_lines)
                current_division = "college"
                section_lines = []
                continue
            elif any(kw in line_clean for kw in ["JUNIOR DIVISION", "HIGH SCHOOL DIVISION", "HIGH SCHOOL", "JUNIOR'S DIVISION"]):
                if current_division and section_lines:
                    _process_section(result, current_division, section_lines)
                current_division = "junior"
                section_lines = []
                continue

            
            if current_division:
                section_lines.append(line)
        
        # Process last section
        if current_division and section_lines:
            _process_section(result, current_division, section_lines)
    
    return result


def _parse_scoreboard_table(lines: list[str], division: str) -> list[dict]:
    """
    Parse a transposed scoreboard table (schools as columns, sports as rows):
      | | UST | DLS-Z | ADMU | ... |
      | Athletics | 10 | 6 | 12 | ... |
      | TOTAL | 97 | 70 | 69 | ... |
    """
    school_columns = []
    sport_rows = []
    total_row = None

    for line in lines:
        line = line.strip()
        if not line.startswith("|") or re.match(r'\|\s*[-:]+', line):
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if not cells:
            continue

        matched_schools = []
        for i, c in enumerate(cells):
            clean_c = re.sub(r'<[^>]+>|\*+', '', c).strip()
            team = canonicalize_team(clean_c)
            if team:
                matched_schools.append((i, team))

        if len(matched_schools) >= 4 and not school_columns:
            school_columns = matched_schools
            continue

        first_col_clean = re.sub(r'<[^>]+>|\*+', '', cells[0]).upper().strip()
        second_col_clean = re.sub(r'<[^>]+>|\*+', '', cells[1]).upper().strip() if len(cells) > 1 else ""
        if "TOTAL" in first_col_clean or "TOTAL" in second_col_clean:
            total_row = cells
            continue

        if school_columns:
            sport_name = re.sub(r'<[^>]+>|\*+', '', cells[0]).strip()
            if len(cells) > 1 and cells[1].startswith("(") and cells[1].endswith(")"):
                sport_name += " " + cells[1].strip()
            sport_rows.append((sport_name, cells))

    if not school_columns or not total_row:
        return []

    rankings = []
    for col_idx, school_code in school_columns:
        if col_idx < len(total_row):
            t_str = re.sub(r'[^0-9.]', '', total_row[col_idx])
            try:
                tot = float(t_str) if t_str else 0.0
            except ValueError:
                tot = 0.0
        else:
            tot = 0.0

        sport_pts = {}
        for sp_name, row_cells in sport_rows:
            if col_idx < len(row_cells):
                p_str = re.sub(r'[^0-9.]', '', row_cells[col_idx])
                try:
                    pts = float(p_str) if p_str else 0.0
                except ValueError:
                    pts = 0.0
                if pts > 0:
                    sport_pts[sp_name] = pts

        rankings.append({
            "school": school_code,
            "total_points": tot,
            "division": division,
            "sport_points": sport_pts
        })

    rankings.sort(key=lambda x: x["total_points"], reverse=True)
    for rank, r in enumerate(rankings, 1):
        r["rank"] = rank

    return rankings


def _process_section(result: dict, division: str, lines: list[str]):
    """Process a division section and add results."""
    table_lines = [l for l in lines if l.strip().startswith("|")]
    if not table_lines:
        return

    # First try transposed scoreboard table
    scoreboard_rankings = _parse_scoreboard_table(lines, division)
    if scoreboard_rankings:
        rankings = scoreboard_rankings
    else:
        first_data = table_lines[0]
        col_count = first_data.count("|") - 1
        if col_count > 4:
            rankings = _parse_detailed_standings_table(lines, division)
        else:
            rankings = _parse_simple_standings_table(lines, division)

    if rankings:
        existing = result["divisions"].get(division, [])
        if not existing or (rankings and len(rankings) > len(existing)):
            result["divisions"][division] = rankings


def save_overall_standings(standings: dict, output_dir: Path):
    """Save extracted standings to JSON."""
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"{standings['season']}.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(standings, f, indent=2, ensure_ascii=False)
    print(f"  -> Saved: {output_file}")
