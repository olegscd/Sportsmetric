"""
OCR Sample UAAP Annual Report Pages to Excel using Vision LLM (Gemini 2.0 Flash).

Prerequisites:
    pip install google-genai pandas openpyxl pillow

Usage:
    1. Place 3 to 5 sample photos into a folder (e.g. data/sample_pages/)
    2. Set your GEMINI_API_KEY environment variable (or put it in .env.local)
    3. Run:
       python scripts/ocr_sample_to_excel.py --input data/sample_pages/ --output data/uaap_sample_extracted.xlsx
"""

import argparse
import json
import os
import sys
from pathlib import Path

def load_env_local():
    """Load GEMINI_API_KEY from .env.local if present and not already in os.environ."""
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

PROMPT = """
You are an expert sports data archivist extracting historical statistics from physical UAAP (University Athletic Association of the Philippines) Annual Report book pages.

Analyze this page image carefully:
1. Identify the UAAP Season (e.g. "Season 72", "72", or academic year like "2009-2010"). If not explicit, deduce or mark null.
2. Identify the Sport (e.g. "Basketball", "Volleyball", "Table Tennis", "Judo", "Tennis", "Badminton", "Swimming", "Track and Field", "Football", etc.).
3. Identify the Division (e.g. "Men", "Women", "Boys", "Girls", "Juniors", "Seniors", "Coed").
4. Extract all structured information into the following JSON categories:

- "standings": list of objects for team standings/rankings on this page:
    - "rank": integer rank (1, 2, 3...) or null
    - "team": standardized school code: "UST", "DLSU", "ADMU", "FEU", "UE", "UP", "NU", "ADU" (or full name if other)
    - "wins": integer or null
    - "losses": integer or null
    - "points": numeric points/score or null
    - "notes": string (e.g. "Champion", "Runner-up", "Semifinalist", gold/silver/bronze count) or null

- "awards": list of individual awards or medalists if listed on this page:
    - "award_name": string (e.g. "MVP", "Rookie of the Year", "Gold Medal", "Mythical Five", "Best Attacker")
    - "recipient_name": player or coach name
    - "team": standardized school code
    - "category": weight class, event (e.g. "Under 55kg", "Singles", "Doubles", "50m Freestyle") or null

- "matches": list of game/match/tie results if detailed game scores are on this page:
    - "stage": string (e.g. "Eliminations", "Round 1", "Semifinals", "Finals", "Game 1") or null
    - "home_team": standardized school code
    - "away_team": standardized school code
    - "home_score": numeric score or null
    - "away_score": numeric score or null
    - "details": string with set scores, bout details, or quarter scores (e.g. "Sets: 25-21, 22-25, 15-12") or null

- "page_summary": a 1-sentence description of what this page contains.

CRITICAL INSTRUCTIONS:
- Return ONLY valid JSON matching this schema. Do not enclose in markdown blocks if using structured output.
- If a category is not present on the page, return an empty array [] for it.
- Fix obvious OCR distortions (e.g., lowercase 'l' for '1', 'O' for '0' in numeric columns) based on context.
"""

SCHEMA = {
    "type": "object",
    "properties": {
        "season": {"type": "string"},
        "sport": {"type": "string"},
        "division": {"type": "string"},
        "page_summary": {"type": "string"},
        "standings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "rank": {"type": "integer"},
                    "team": {"type": "string"},
                    "wins": {"type": "integer"},
                    "losses": {"type": "integer"},
                    "points": {"type": "number"},
                    "notes": {"type": "string"}
                },
                "required": ["team"]
            }
        },
        "awards": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "award_name": {"type": "string"},
                    "recipient_name": {"type": "string"},
                    "team": {"type": "string"},
                    "category": {"type": "string"}
                },
                "required": ["award_name", "recipient_name"]
            }
        },
        "matches": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "stage": {"type": "string"},
                    "home_team": {"type": "string"},
                    "away_team": {"type": "string"},
                    "home_score": {"type": "number"},
                    "away_score": {"type": "number"},
                    "details": {"type": "string"}
                },
                "required": ["home_team", "away_team"]
            }
        }
    },
    "required": ["sport", "standings", "awards", "matches"]
}

def process_images(input_dir: Path, output_excel: Path, api_key: str, model_name: str = "gemini-3.6-flash"):
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("\n[ERROR] 'google-genai' is not installed.")
        print("Please run: pip install google-genai pandas openpyxl pillow\n")
        sys.exit(1)

    import pandas as pd
    from PIL import Image

    client = genai.Client(api_key=api_key)

    # Supported image extensions
    valid_exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    image_files = sorted([f for f in input_dir.iterdir() if f.suffix.lower() in valid_exts])

    if not image_files:
        print(f"[!] No images found in {input_dir}. Supported formats: {valid_exts}")
        return

    print(f"\n=======================================================")
    print(f" Found {len(image_files)} image(s) to process in {input_dir}")
    print(f" Model: {model_name}")
    print(f"=======================================================\n")

    all_standings = []
    all_awards = []
    all_matches = []
    page_logs = []

    for idx, img_path in enumerate(image_files, start=1):
        print(f"[{idx}/{len(image_files)}] Processing: {img_path.name} ...", end=" ", flush=True)

        try:
            with open(img_path, "rb") as f:
                img_bytes = f.read()

            # Determine mime type
            ext = img_path.suffix.lower()
            mime_type = "image/png" if ext == ".png" else "image/jpeg"

            response = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(data=img_bytes, mime_type=mime_type),
                    PROMPT
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=SCHEMA,
                    temperature=0.1
                )
            )

            data = json.loads(response.text)

            season = data.get("season") or "Unknown"
            sport = data.get("sport") or "Unknown"
            division = data.get("division") or "Unknown"
            summary = data.get("page_summary") or ""

            # 1. Standings
            for item in data.get("standings", []):
                all_standings.append({
                    "season": season,
                    "sport": sport,
                    "division": division,
                    "rank": item.get("rank"),
                    "team": item.get("team"),
                    "wins": item.get("wins"),
                    "losses": item.get("losses"),
                    "points": item.get("points"),
                    "notes": item.get("notes"),
                    "source_file": img_path.name
                })

            # 2. Awards
            for item in data.get("awards", []):
                all_awards.append({
                    "season": season,
                    "sport": sport,
                    "division": division,
                    "award": item.get("award_name"),
                    "recipient": item.get("recipient_name"),
                    "team": item.get("team"),
                    "category": item.get("category"),
                    "source_file": img_path.name
                })

            # 3. Matches
            for item in data.get("matches", []):
                all_matches.append({
                    "season": season,
                    "sport": sport,
                    "division": division,
                    "stage": item.get("stage"),
                    "home_team": item.get("home_team"),
                    "away_team": item.get("away_team"),
                    "home_score": item.get("home_score"),
                    "away_score": item.get("away_score"),
                    "details": item.get("details"),
                    "source_file": img_path.name
                })

            page_logs.append({
                "file_name": img_path.name,
                "season": season,
                "sport": sport,
                "division": division,
                "standings_count": len(data.get("standings", [])),
                "awards_count": len(data.get("awards", [])),
                "matches_count": len(data.get("matches", [])),
                "summary": summary
            })

            print(f"DONE! (Detected: {sport} - {division})")

        except Exception as e:
            print(f"FAILED! Error: {e}")
            page_logs.append({
                "file_name": img_path.name,
                "season": "ERROR",
                "sport": "ERROR",
                "division": "ERROR",
                "standings_count": 0,
                "awards_count": 0,
                "matches_count": 0,
                "summary": f"Failed extraction: {e}"
            })

    # Export to Excel with multiple sheets
    output_excel.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(output_excel, engine="openpyxl") as writer:
        df_logs = pd.DataFrame(page_logs)
        df_logs.to_excel(writer, sheet_name="Pages_Summary", index=False)

        df_standings = pd.DataFrame(all_standings) if all_standings else pd.DataFrame(columns=["season", "sport", "division", "rank", "team", "wins", "losses", "points", "notes", "source_file"])
        df_standings.to_excel(writer, sheet_name="Standings", index=False)

        df_awards = pd.DataFrame(all_awards) if all_awards else pd.DataFrame(columns=["season", "sport", "division", "award", "recipient", "team", "category", "source_file"])
        df_awards.to_excel(writer, sheet_name="Awards", index=False)

        df_matches = pd.DataFrame(all_matches) if all_matches else pd.DataFrame(columns=["season", "sport", "division", "stage", "home_team", "away_team", "home_score", "away_score", "details", "source_file"])
        df_matches.to_excel(writer, sheet_name="Matches", index=False)

    print(f"\nSUCCESS! Results exported to:")
    print(f"-> {output_excel.resolve()}\n")
    print("Sheets created:")
    print(f" - Pages_Summary: {len(page_logs)} rows")
    print(f" - Standings:     {len(all_standings)} rows")
    print(f" - Awards:        {len(all_awards)} rows")
    print(f" - Matches:       {len(all_matches)} rows")


def main():
    parser = argparse.ArgumentParser(description="OCR UAAP annual report pages to Excel using Gemini Vision.")
    parser.add_argument("--input", default="data/sample_pages", help="Directory containing sample photos")
    parser.add_argument("--output", default="data/uaap_sample_extracted.xlsx", help="Output Excel filepath")
    parser.add_argument("--api-key", default=None, help="Gemini API Key (optional if GEMINI_API_KEY env is set)")
    parser.add_argument("--model", default="gemini-3.6-flash", help="Gemini vision model name (default: gemini-3.6-flash)")
    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("\n[!] GEMINI_API_KEY is not set.")
        print("You can get an API key at: https://aistudio.google.com/app/apikey")
        api_key = input("Enter your Gemini API key (or press Ctrl+C to exit): ").strip()
        if not api_key:
            print("No key provided. Exiting.")
            sys.exit(1)

    input_path = Path(args.input)
    if not input_path.exists():
        input_path.mkdir(parents=True, exist_ok=True)
        print(f"\nCreated input folder: {input_path.resolve()}")
        print(f"Please drop your sample images into this folder, then run the command again!\n")
        return

    output_path = Path(args.output)
    process_images(input_path, output_path, api_key, model_name=args.model)


if __name__ == "__main__":
    main()
