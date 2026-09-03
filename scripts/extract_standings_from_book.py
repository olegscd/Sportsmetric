"""
Scalable UAAP Team Standings Extractor (Gemini Structured Output).

Reads the compiled season book Markdown and uses Gemini's structured JSON
output to extract all team standings across all sports and divisions.

Works for ANY season — no hardcoded page references.

Usage:
    python scripts/extract_standings_from_book.py --season 2003-2004
    python scripts/extract_standings_from_book.py --season 2003-2004 --model gemini-2.5-flash
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

def load_env_local():
    env_file = Path(__file__).resolve().parent.parent / ".env.local"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("#") or not line or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip("\"'")
                if key not in os.environ:
                    os.environ[key] = val

load_env_local()

# Standard UAAP school code mapping
SCHOOL_CODES = {
    'ATENEO': 'ADMU', 'ADMU': 'ADMU', 'ATENEO DE MANILA': 'ADMU', 'ATENEO DE MANILA UNIVERSITY': 'ADMU',
    'DE LA SALLE': 'DLSU', 'DLSU': 'DLSU', 'DE LA SALLE UNIVERSITY': 'DLSU', 'LA SALLE': 'DLSU',
    'FAR EASTERN': 'FEU', 'FEU': 'FEU', 'FAR EASTERN UNIVERSITY': 'FEU',
    'NATIONAL UNIVERSITY': 'NU', 'NU': 'NU',
    'UNIVERSITY OF THE EAST': 'UE', 'UE': 'UE',
    'UNIVERSITY OF THE PHILIPPINES': 'UP', 'UP': 'UP', 'UPIS': 'UPIS',
    'UNIVERSITY OF SANTO TOMAS': 'UST', 'UST': 'UST', 'UNIVERSITY OF STO TOMAS': 'UST',
    'STO TOMAS': 'UST', 'STO. TOMAS': 'UST', 'SANTO TOMAS': 'UST',
    'ADAMSON': 'AdU', 'ADU': 'AdU', 'ADAMSON UNIVERSITY': 'AdU',
    'DE LA SALLE - ZOBEL': 'DLSZ', 'DE LA SALLE – ZOBEL': 'DLSZ', 'DLSZ': 'DLSZ', 'ZOBEL': 'DLSZ',
}

def normalize_school(name: str) -> str:
    """Normalize a school name to its standard UAAP code."""
    s = re.sub(r'[*_`:]', '', str(name)).strip()
    s = re.sub(r'^\d+[\.)\s]+', '', s).strip()
    up = s.upper()
    for k, v in SCHOOL_CODES.items():
        if up == k or up.startswith(k + ' ') or up.endswith(' ' + k):
            return v
    return s


EXTRACTION_PROMPT = """You are a sports data extraction system. Your ONLY job is to extract TEAM STANDINGS from the provided UAAP Annual Report text.

RULES:
1. Extract ONLY team-level standings (ranked lists of schools with wins/losses/records).
2. DO NOT extract individual player statistics, individual match scores, or MVP awards.
3. For each standing you find, output it as a JSON object with these exact fields:
   - "sport": The sport name (e.g., "Basketball", "Volleyball", "Badminton", "Table Tennis", "Tae Kwon Do", "Judo", "Baseball", "Softball", "Football", "Fencing", "Chess", "Lawn Tennis")
   - "division": The division (e.g., "Men's", "Women's", "Juniors", "Girls", "Boys")
   - "stage": Either "Elimination Round" (regular season W-L records) or "Final Standings" (official end-of-season podium/final placement)
   - "rank": Integer rank (1 = champion/1st place, 2 = runner-up, etc.)
   - "team": The school's standard UAAP code: ADMU, DLSU, FEU, NU, UE, UP, UST, AdU, DLSZ, UPIS
   - "wins": Integer number of wins (null if not available in the source)
   - "losses": Integer number of losses (null if not available in the source)
   - "pct": Win percentage as a decimal (e.g., 0.786). Calculate from W/L if not shown. null if W/L unavailable.
   - "details": Brief note like "Champion", "Runner-Up", "3rd Place", or relevant tournament context. null if none.
   - "source_page": The source page filename (e.g., "IMG_0600") if visible in the text.

4. CRITICAL: Read the actual numbers from the tables. If a table shows Win=11, Loss=3, that's what you output. Do NOT guess or approximate.
5. If a sport has BOTH elimination round standings AND final standings, extract BOTH separately.
6. For round-robin or cross-table formats, tally the wins and losses from the grid if a summary row isn't provided.
7. Output ONLY a JSON array of objects. No commentary, no markdown, no explanation.

Here is the text to extract from:

"""


def chunk_book_by_sport(book_text: str) -> list:
    """Split the compiled book into chunks by sport section.
    
    Uses the <!-- START PAGE --> markers and major heading lines to detect
    the first occurrence of each sport section. Works for any season layout.
    
    Returns list of (sport_name, section_text) tuples.
    """
    # Canonical sport names and their matching patterns
    sport_patterns = [
        ('Badminton',    ['BADMINTON']),
        ('Baseball',     ['BASEBALL']),
        ('Basketball',   ['BASKETBALL']),
        ('Chess',        ['CHESS']),
        ('Fencing',      ['FENCING']),
        ('Football',     ['FOOTBALL']),
        ('Judo',         ['JUDO']),
        ('Lawn Tennis',  ['LAWN TENNIS']),
        ('Softball',     ['SOFTBALL']),
        ('Table Tennis', ['TABLE TENNIS']),
        ('Tae Kwon Do',  ['TAE KWON DO', 'TAEKWONDO']),
        ('Volleyball',   ['VOLLEYBALL']),
    ]
    
    lines = book_text.split('\n')
    
    # Find the FIRST heading line for each sport (the section cover page)
    found_sports = []  # (line_index, canonical_name)
    seen_sports = set()
    
    for i, line in enumerate(lines):
        # Only look at heading lines (start with #)
        if not line.strip().startswith('#'):
            continue
        stripped = re.sub(r'[#*_`\s]', ' ', line).strip().upper()
        if not stripped:
            continue
        
        for canonical, keywords in sport_patterns:
            if canonical in seen_sports:
                continue
            # Check if this heading line contains the sport keyword
            # AND the line is short enough to be a section header (not a sentence)
            for kw in keywords:
                if kw in stripped and len(stripped) < 50:
                    found_sports.append((i, canonical))
                    seen_sports.add(canonical)
                    break
    
    # Sort by line number
    found_sports.sort(key=lambda x: x[0])
    
    if not found_sports:
        return [("All Sports", book_text)]
    
    chunks = []
    for idx, (start_line, sport_name) in enumerate(found_sports):
        end_line = found_sports[idx + 1][0] if idx + 1 < len(found_sports) else len(lines)
        section_text = '\n'.join(lines[start_line:end_line])
        
        # Only include sections with meaningful content (tables)
        if '|' in section_text and len(section_text) > 200:
            chunks.append((sport_name, section_text))
    
    return chunks


def extract_standings_with_gemini(client, text: str, model_name: str, sport_hint: str = "") -> list:
    """Send text to Gemini and get structured standings data back."""
    from google.genai import types
    
    prompt = EXTRACTION_PROMPT
    if sport_hint:
        prompt += f"\n[CONTEXT: This section is about {sport_hint}]\n\n"
    prompt += text
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    response_mime_type="application/json",
                )
            )
            
            raw = response.text.strip()
            # Parse JSON
            data = json.loads(raw)
            
            if isinstance(data, dict) and "standings" in data:
                data = data["standings"]
            
            if not isinstance(data, list):
                print(f"  [WARN] Expected list, got {type(data).__name__}. Wrapping.")
                data = [data]
            
            return data
            
        except json.JSONDecodeError as e:
            print(f"  [WARN] JSON parse error on attempt {attempt+1}: {e}")
            # Try to extract JSON array from response
            m = re.search(r'\[[\s\S]*\]', raw)
            if m:
                try:
                    return json.loads(m.group(0))
                except:
                    pass
            if attempt == max_retries - 1:
                print(f"  [ERROR] Failed to parse JSON after {max_retries} attempts")
                return []
        except Exception as e:
            if "429" in str(e) or "ResourceExhausted" in str(e):
                wait = (attempt + 1) * 5
                print(f"  [Rate limit] waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"  [ERROR] {e}")
                if attempt == max_retries - 1:
                    return []
                time.sleep(2)
    
    return []


def normalize_record(record: dict, season: str) -> dict:
    """Clean and normalize a single standings record."""
    team = normalize_school(record.get('team', ''))
    wins = record.get('wins')
    losses = record.get('losses')
    pct = record.get('pct')
    
    # Ensure wins/losses are ints or None
    if wins is not None:
        try:
            wins = int(float(wins))
        except (ValueError, TypeError):
            wins = None
    if losses is not None:
        try:
            losses = int(float(losses))
        except (ValueError, TypeError):
            losses = None
    
    # Recalculate pct if we have W/L
    if wins is not None and losses is not None and (wins + losses) > 0:
        pct = round(wins / (wins + losses), 3)
    elif pct is not None:
        try:
            pct = round(float(pct), 3)
        except (ValueError, TypeError):
            pct = None
    
    # Normalize rank
    rank = record.get('rank', 0)
    try:
        rank = int(rank)
    except (ValueError, TypeError):
        rank = 0
    
    return {
        'season': season,
        'sport': record.get('sport', '').strip(),
        'division': record.get('division', '').strip(),
        'stage': record.get('stage', '').strip(),
        'rank': rank,
        'team': team,
        'wins': wins,
        'losses': losses,
        'pct': pct,
        'details': record.get('details') or None,
        'source_page': (record.get('source_page') or '').replace('.md', '').strip() or None,
    }


def validate_standings(records: list) -> tuple:
    """Validate extracted standings for consistency.
    
    Returns (warnings, errors) lists.
    """
    warnings = []
    errors = []
    
    valid_schools = {'ADMU', 'DLSU', 'FEU', 'NU', 'UE', 'UP', 'UST', 'AdU', 'DLSZ', 'UPIS'}
    valid_sports = {
        'Badminton', 'Baseball', 'Basketball', 'Chess', 'Fencing',
        'Football', 'Judo', 'Lawn Tennis', 'Softball', 'Table Tennis',
        'Tae Kwon Do', 'Volleyball'
    }
    
    # Check 1: Valid school codes
    for r in records:
        if r['team'] not in valid_schools:
            warnings.append(f"Unknown school code: '{r['team']}' in {r['sport']} {r['division']}")
    
    # Check 2: Valid sport names
    sports_found = set(r['sport'] for r in records)
    for s in sports_found:
        if s not in valid_sports:
            warnings.append(f"Unknown sport: '{s}'")
    
    # Check 3: No duplicate team in same sport/division/stage
    seen = set()
    for r in records:
        key = (r['sport'], r['division'], r['stage'], r['team'])
        if key in seen:
            errors.append(f"Duplicate: {r['team']} in {r['sport']} {r['division']} ({r['stage']})")
        seen.add(key)
    
    # Check 4: Rank 1 should exist for Final Standings
    final_groups = {}
    for r in records:
        if r['stage'] == 'Final Standings':
            gk = (r['sport'], r['division'])
            final_groups.setdefault(gk, []).append(r['rank'])
    for gk, ranks in final_groups.items():
        if 1 not in ranks:
            errors.append(f"No rank 1 (champion) in {gk[0]} {gk[1]} Final Standings")
    
    # Check 5: W + L consistency within a division's elimination round
    elim_groups = {}
    for r in records:
        if r['stage'] == 'Elimination Round' and r['wins'] is not None and r['losses'] is not None:
            gk = (r['sport'], r['division'])
            elim_groups.setdefault(gk, []).append(r)
    
    for gk, group in elim_groups.items():
        total_wins = sum(r['wins'] for r in group)
        total_losses = sum(r['losses'] for r in group)
        if total_wins != total_losses:
            warnings.append(
                f"{gk[0]} {gk[1]} Elimination: total wins ({total_wins}) != total losses ({total_losses})"
            )
    
    # Check 6: Win % sanity
    for r in records:
        if r['pct'] is not None:
            if r['pct'] < 0 or r['pct'] > 1.0:
                errors.append(f"Invalid win%: {r['pct']} for {r['team']} in {r['sport']} {r['division']}")
    
    return warnings, errors


def run_extraction(season: str, model_name: str):
    from google import genai
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("\n[ERROR] GEMINI_API_KEY not found in environment or .env.local")
        sys.exit(1)
    
    base_dir = Path(__file__).resolve().parent.parent / "data" / "seasons" / season
    book_file = None
    
    # Find the compiled book
    for f in base_dir.glob("*.md"):
        if "Annual_Report" in f.name:
            book_file = f
            break
    
    if not book_file or not book_file.exists():
        # Try to compile from digital pages
        pages_dir = base_dir / "digital_pages"
        if pages_dir.exists():
            print(f"No compiled book found. Reading individual pages from {pages_dir}")
            md_files = sorted(pages_dir.glob("*.md"))
            book_text = ""
            for mf in md_files:
                book_text += f"\n<!-- START PAGE ({mf.name}) -->\n"
                book_text += mf.read_text(encoding="utf-8")
                book_text += "\n---\n"
        else:
            print(f"[ERROR] No book or digital pages found in {base_dir}")
            sys.exit(1)
    else:
        book_text = book_file.read_text(encoding="utf-8")
    
    print(f"\n{'='*60}")
    print(f" UAAP STANDINGS EXTRACTOR (Gemini Structured Output)")
    print(f" Season: {season}")
    print(f" Model: {model_name}")
    print(f" Book size: {len(book_text):,} chars (~{len(book_text)//4:,} tokens)")
    print(f"{'='*60}\n")
    
    # Chunk by sport
    chunks = chunk_book_by_sport(book_text)
    print(f"Found {len(chunks)} sport sections to process:\n")
    for sport_name, section in chunks:
        print(f"  - {sport_name} ({len(section):,} chars)")
    
    client = genai.Client(api_key=api_key)
    
    all_records = []
    
    for i, (sport_name, section_text) in enumerate(chunks, 1):
        print(f"\n[{i}/{len(chunks)}] Extracting: {sport_name} ({len(section_text):,} chars)...", flush=True)
        
        raw_records = extract_standings_with_gemini(client, section_text, model_name, sport_hint=sport_name)
        print(f"  -> Got {len(raw_records)} raw records")
        
        # Normalize
        normalized = [normalize_record(r, season) for r in raw_records]
        
        # Filter out empty/invalid records
        valid = [r for r in normalized if r['sport'] and r['team'] and r['rank'] > 0]
        print(f"  -> {len(valid)} valid records after normalization")
        
        all_records.extend(valid)
        
        # Brief pause between chunks
        time.sleep(1.0)
    
    # Post-process: Fix multi-event sports where the LLM extracted sub-events
    # as the same stage. Incorporate the sub-event into the stage name.
    for r in all_records:
        detail = (r.get('details') or '').strip()
        
        # Fencing: Team Foil, Team Sabre, Team Épée are distinct events
        if r['sport'] == 'Fencing' and r['stage'] == 'Final Standings':
            detail_upper = detail.upper()
            if 'FOIL' in detail_upper:
                r['stage'] = 'Final Standings - Team Foil'
            elif 'SABRE' in detail_upper:
                r['stage'] = 'Final Standings - Team Sabre'
            elif any(x in detail_upper for x in ['EPEE', 'ÉPÉE']):
                r['stage'] = 'Final Standings - Team Epee'
        
        # Table Tennis: First Round and Second Round are separate stages
        if r['sport'] == 'Table Tennis' and r['stage'] == 'Elimination Round':
            detail_upper = detail.upper()
            if 'FIRST' in detail_upper or '1ST' in detail_upper:
                r['stage'] = 'Elimination Round - 1st Round'
            elif 'SECOND' in detail_upper or '2ND' in detail_upper:
                r['stage'] = 'Elimination Round - 2nd Round'
        
        # Tae Kwon Do: Multiple weight class tallies vs overall
        if r['sport'] == 'Tae Kwon Do' and r['stage'] == 'Final Standings':
            detail_upper = detail.upper()
            if 'POOMSAE' in detail_upper:
                r['stage'] = 'Final Standings - Poomsae'
            elif 'KYORUGI' in detail_upper:
                r['stage'] = 'Final Standings - Kyorugi'
    
    # Deduplicate (now with more granular stages)
    seen = set()
    deduped = []
    for r in all_records:
        key = (r['sport'], r['division'], r['stage'], r['rank'], r['team'])
        if key not in seen:
            seen.add(key)
            deduped.append(r)
    
    print(f"\n{'='*60}")
    print(f" EXTRACTION COMPLETE")
    print(f" Total records: {len(deduped)} ({len(all_records) - len(deduped)} duplicates removed)")
    print(f"{'='*60}\n")
    
    # Validate
    warnings, errors = validate_standings(deduped)
    
    if errors:
        print(f"ERRORS ({len(errors)}):")
        for e in errors:
            print(f"  - {e}")
    
    if warnings:
        print(f"\nWARNINGS ({len(warnings)}):")
        for w in warnings:
            print(f"  - {w}")
    
    if not errors:
        print("No critical errors found!")
    
    # Sort
    deduped.sort(key=lambda r: (r['sport'], r['division'], r['stage'], r['rank']))
    
    # Summary table
    print(f"\n{'='*60}")
    print(f" SUMMARY BY SPORT")
    print(f"{'='*60}")
    sports_summary = {}
    for r in deduped:
        sk = r['sport']
        sports_summary.setdefault(sk, {'total': 0, 'with_wl': 0, 'divisions': set(), 'stages': set()})
        sports_summary[sk]['total'] += 1
        sports_summary[sk]['divisions'].add(r['division'])
        sports_summary[sk]['stages'].add(r['stage'])
        if r['wins'] is not None and r['losses'] is not None:
            sports_summary[sk]['with_wl'] += 1
    
    print(f"\n{'Sport':<16} {'Records':>8} {'W/L':>6} {'Divisions':<30} {'Stages'}")
    print("-" * 90)
    for sport in sorted(sports_summary.keys()):
        s = sports_summary[sport]
        divs = ", ".join(sorted(s['divisions']))
        stages = ", ".join(sorted(s['stages']))
        print(f"{sport:<16} {s['total']:>8} {s['with_wl']:>6} {divs:<30} {stages}")
    
    # Save outputs
    out_dir = Path(__file__).resolve().parent.parent / "data"
    
    # SAFETY: Do not overwrite existing data with empty results
    if not deduped:
        print("\n[ABORT] No records extracted. Existing data files preserved.")
        print("Check the errors above and re-run.\n")
        return deduped
    
    # JSON (for the UI)
    out_json = out_dir / "uaap_standings.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(deduped, f, indent=2, ensure_ascii=False)
    print(f"\n-> Saved JSON: {out_json.resolve()}")
    
    # CSV
    out_csv = out_dir / f"uaap_{season.replace('-', '_')}_team_standings.csv"
    try:
        import pandas as pd
        df = pd.DataFrame(deduped)
        df.to_csv(out_csv, index=False, encoding="utf-8-sig")
        print(f"-> Saved CSV: {out_csv.resolve()}")
        
        # Excel with per-sport tabs
        out_xlsx = out_dir / "uaap_all_sports_team_standings.xlsx"
        with pd.ExcelWriter(out_xlsx, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="Master_Standings", index=False)
            for sport, grp in df.groupby("sport"):
                sheet_name = re.sub(r'[\\/*?:\[\]]', '', str(sport))[:30]
                grp.to_excel(writer, sheet_name=sheet_name, index=False)
        print(f"-> Saved Excel: {out_xlsx.resolve()}")
    except ImportError:
        # Fallback: save CSV without pandas
        import csv
        with open(out_csv, "w", newline="", encoding="utf-8-sig") as f:
            if deduped:
                writer = csv.DictWriter(f, fieldnames=deduped[0].keys())
                writer.writeheader()
                writer.writerows(deduped)
        print(f"-> Saved CSV: {out_csv.resolve()}")
    
    print(f"\nTotal API cost: ~${len(chunks) * 0.02:.2f} (estimated)")
    print(f"Done!\n")
    
    return deduped


def main():
    parser = argparse.ArgumentParser(
        description="Extract UAAP team standings from a season's compiled book using Gemini structured output."
    )
    parser.add_argument("--season", default="2003-2004", help="Season name/folder (default: 2003-2004)")
    parser.add_argument("--model", default="gemini-3.6-flash", help="Gemini model (default: gemini-3.6-flash)")
    args = parser.parse_args()
    
    run_extraction(season=args.season, model_name=args.model)


if __name__ == "__main__":
    main()
