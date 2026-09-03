"""
UAAP Team Standings Extractor.

Extracts all team-level standings across all sports from the transcribed
annual report books into a clean, normalized CSV and Excel dataset.

Filters out individual player stats, focusing strictly on:
- Season / Year
- Sport
- Division (Men's, Women's, Juniors, Boys, Girls, Co-ed)
- Stage (Final Standing, Elimination Round, Round-Robin, etc.)
- Rank (1, 2, 3... Champion, Runner-up)
- School (UST, DLSU, ADMU, FEU, UE, UP, NU, AdU)
- Wins / Losses (if available)
- Points / Match Score (if available)
- Source Page ID

Usage:
    python scripts/extract_team_standings.py --season 2003-2004
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
import pandas as pd

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

EXTRACT_STANDINGS_PROMPT = """
You are a sports database architect. Your task is to extract ALL TEAM STANDINGS from this UAAP Annual Report text.

STRICT INSTRUCTIONS:
1. FOCUS ONLY ON TEAM STANDINGS (Rank, School, Wins, Losses, Points/Record).
2. DO NOT extract individual player statistics (e.g., top scorers, MVPs, rebound leaders, single match scores). ONLY TEAM rankings/standings.
3. Include both Final Standings and Elimination/Round-Robin standings if present.
4. Standardize School Names to their standard UAAP codes or full names:
   - Ateneo de Manila University -> ADMU
   - De La Salle University -> DLSU
   - Far Eastern University -> FEU
   - National University -> NU
   - University of the East -> UE
   - University of the Philippines -> UP (or UPIS for high school)
   - University of Santo Tomas -> UST
   - Adamson University -> AdU (or Adamson)
   - De La Salle Zobel -> DLSZ

Return ONLY a JSON array of objects with this schema:
[
  {
    "sport": "Badminton | Basketball | Volleyball | Judo | Table Tennis | Tae Kwon Do | Baseball | Softball | Chess | Fencing",
    "division": "Men's | Women's | Juniors | Boys | Girls",
    "stage": "Final Standings | Elimination Round | First Round | Second Round",
    "rank": 1,
    "team": "FEU",
    "wins": 11,
    "losses": 3,
    "pct": "0.786",
    "points": null,
    "details": "optional notes, e.g. Champion, 21-2 match score"
  }
]
If there are no team standings on this page, return an empty array: []
"""

def extract_standings_from_text(client, text: str, model_name: str) -> list:
    from google.genai import types

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=[
                f"SOURCE TEXT TO EXTRACT FROM:\n\n{text}\n\n{EXTRACT_STANDINGS_PROMPT}"
            ],
            config=types.GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json"
            )
        )
        res_text = response.text.strip()
        data = json.loads(res_text)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and "standings" in data:
            return data["standings"]
        return []
    except Exception as e:
        print(f"Extraction error: {e}")
        return []


def process_season_standings(season_name: str, model_name: str):
    from google import genai

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[ERROR] GEMINI_API_KEY not found in environment or .env.local")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    base_dir = Path(__file__).resolve().parent.parent / "data" / "seasons" / season_name
    pages_dir = base_dir / "digital_pages"

    if not pages_dir.exists():
        print(f"[ERROR] Directory not found: {pages_dir}")
        return

    md_files = sorted(pages_dir.glob("*.md"))
    print(f"Scanning {len(md_files)} pages in Season {season_name} for team standings...")

    # Filter pages likely to contain team standings
    standings_keywords = [
        "STANDING", "FINAL RESULT", "FINAL RANK", "TEAM TALLY",
        "ROUND RESULTS", "TEAM STANDING", "ROUND SUMMARY", "CROSS-TABLE"
    ]

    target_files = []
    for f in md_files:
        content = f.read_text(encoding="utf-8").upper()
        # Must have at least one standings keyword and school mention
        if any(k in content for k in standings_keywords) and any(s in content for s in ["UST", "FEU", "UP", "DLSU", "UE", "ADMU", "ADU", "NU", "ATENEO", "SANTO TOMAS"]):
            target_files.append(f)

    print(f"Found {len(target_files)} relevant pages with team standings.\n")

    all_records = []

    for idx, page_file in enumerate(target_files, 1):
        print(f"[{idx}/{len(target_files)}] Extracting standings from {page_file.name}...", end=" ", flush=True)
        text = page_file.read_text(encoding="utf-8")
        extracted = extract_standings_from_text(client, text, model_name)

        count = 0
        for item in extracted:
            item["season"] = season_name
            item["source_page"] = page_file.stem
            all_records.append(item)
            count += 1

        print(f"Found {count} standings rows.")
        time.sleep(0.5)

    if not all_records:
        print("No standings extracted.")
        return

    df = pd.DataFrame(all_records)

    # Standardize column order
    cols = ["season", "sport", "division", "stage", "rank", "team", "wins", "losses", "pct", "points", "details", "source_page"]
    for c in cols:
        if c not in df.columns:
            df[c] = None
    df = df[cols]

    # Deduplicate in case overlapping pages had the same stage/rank
    df = df.drop_duplicates(subset=["season", "sport", "division", "stage", "rank", "team"])

    # Sort logically
    df = df.sort_values(by=["sport", "division", "stage", "rank"], ascending=[True, True, True, True])

    # Save to data directory
    output_dir = Path(__file__).resolve().parent.parent / "data"
    csv_path = output_dir / f"uaap_{season_name.replace('-', '_')}_team_standings.csv"
    xlsx_path = output_dir / f"uaap_{season_name.replace('-', '_')}_team_standings.xlsx"
    all_seasons_xlsx = output_dir / "uaap_all_sports_team_standings.xlsx"

    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"\n-> Saved CSV: {csv_path.resolve()}")

    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="All_Standings", index=False)
        # Also group by sport
        for sport_name, group_df in df.groupby("sport"):
            sheet_title = re.sub(r'[\\/*?:\[\]]', '', str(sport_name))[:30]
            group_df.to_excel(writer, sheet_name=sheet_title, index=False)

    print(f"-> Saved Season Excel: {xlsx_path.resolve()}")

    # Also update the master multi-season file
    with pd.ExcelWriter(all_seasons_xlsx, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Master_Standings", index=False)
        for sport_name, group_df in df.groupby("sport"):
            sheet_title = re.sub(r'[\\/*?:\[\]]', '', str(sport_name))[:30]
            group_df.to_excel(writer, sheet_name=sheet_title, index=False)

    print(f"-> Saved Master All-Sports Excel: {all_seasons_xlsx.resolve()}")
    sports_list = sorted([str(s) for s in df['sport'].unique() if pd.notna(s)])
    print(f"\nTotal Standings Rows Extracted: {len(df)}")
    print(f"Sports Covered: {', '.join(sports_list)}")


def main():
    parser = argparse.ArgumentParser(description="Extract all team standings across sports from annual report markdown.")
    parser.add_argument("--season", default="2003-2004", help="Season name (default: 2003-2004)")
    parser.add_argument("--model", default="gemini-3.6-flash", help="Gemini model name")
    args = parser.parse_args()

    process_season_standings(args.season, args.model)


if __name__ == "__main__":
    main()
