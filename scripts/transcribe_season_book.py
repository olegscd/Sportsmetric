"""
Digital Document Rebuilder & Archival Transcriber for UAAP Annual Reports.

Reconstructs physical book pages into 1-to-1 digital Markdown documents with exact
tables, headers, athlete names, match scores, and metadata.

Features:
- Resume capability: skips pages already transcribed.
- Rate-limit handling and automatic retries.
- Compiles individual pages into a unified searchable digital book (`compiled_book.md`).

Usage:
    python scripts/transcribe_season_book.py --season 2003-2004
"""

import argparse
import os
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

TRANSCRIBE_PROMPT = """
You are a master sports archivist and digital typesetter.
Your task is to transcribe this physical page from a UAAP Annual Report book into a clean, 1-to-1 Markdown document replica.

CRITICAL ARCHIVAL GUIDELINES:
1. PRESERVE 100% OF THE DATA:
   - Do NOT summarize or omit anything.
   - Every single athlete name, school name/code, score, time, weight class, division, date, venue, and footnote must be transcribed.
   - If there are official signatures or signatories (e.g., Referee, Tournament Director, Board Member), note them at the bottom.

2. TABLES:
   - Convert all tabular grids, standings, cross-tables, brackets, and score sheets into clean GitHub Flavored Markdown tables.
   - Keep column headers exact.
   - If a cell has walkover ("w.o."), unplayed, or blank, transcribe it accurately.
   - For multi-line entries (e.g. doubles partners in one cell), format cleanly (e.g., "Player A / Player B" or with <br>).

3. ORIENTATION & IMAGE QUALITY:
   - The photo may be rotated sideways (landscape/portrait). Read it according to its natural text orientation.
   - Ignore background shadows, fingers holding pages, binding curves, or ink bleed-through from reverse pages. Focus strictly on the primary printed text of this page.

4. FORMATTING:
   - Use standard Markdown headings (#, ##, ###, ####) reflecting visual hierarchy.
   - Bold school names, champions, awards, or key figures where appropriate.
   - Output ONLY the transcription in Markdown. Do NOT include meta-commentary like "Here is the transcription:" or wrap the entire output in ```markdown code blocks.

5. STRICT PAGE BOUNDARY & BLEED-THROUGH FILTER:
   - Focus STRICTLY on the primary page being photographed.
   - Do NOT transcribe partial rows, chopped table columns, or cropped text peeking in from the margins or the opposite page.
   - Completely ignore faint ink bleed-through from the back of the paper.
   - NEVER output ellipsis ("...", "[...]") attempting to transcribe cut-off text from outside the page. If a table belongs to another page, omit it entirely.
"""

def transcribe_page(client, image_path: Path, model_name: str) -> str:
    from google.genai import types

    with open(image_path, "rb") as f:
        img_bytes = f.read()

    ext = image_path.suffix.lower()
    mime_type = "image/png" if ext == ".png" else "image/jpeg"

    # Retry with exponential backoff for rate limits or transient issues
    max_retries = 5
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(data=img_bytes, mime_type=mime_type),
                    TRANSCRIBE_PROMPT
                ],
                config=types.GenerateContentConfig(
                    temperature=0.1
                )
            )
            text = response.text.strip()
            # Strip outer markdown fence if the model accidentally wrapped it
            if text.startswith("```markdown"):
                text = text[11:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            return text.strip()
        except Exception as e:
            if "429" in str(e) or "ResourceExhausted" in str(e):
                wait_sec = (attempt + 1) * 12
                print(f"[Rate limit] waiting {wait_sec}s...")
                time.sleep(wait_sec)
            else:
                if attempt == max_retries - 1:
                    raise e
                time.sleep(3)
    raise RuntimeError("Failed after retries")


def compile_book(digital_pages_dir: Path, compiled_book_path: Path, season_name: str):
    md_files = sorted(digital_pages_dir.glob("*.md"))
    if not md_files:
        return

    print(f"\nCompiling {len(md_files)} pages into: {compiled_book_path.name} ...")

    with open(compiled_book_path, "w", encoding="utf-8") as out:
        out.write(f"# UAAP Annual Report — Season {season_name}\n\n")
        out.write(f"*Digital Archival Edition compiled on {time.strftime('%Y-%m-%d')}*\n\n")
        out.write("---\n\n")

        for idx, page_file in enumerate(md_files, start=1):
            page_content = page_file.read_text(encoding="utf-8")
            out.write(f"<!-- START PAGE {idx} ({page_file.name}) -->\n")
            out.write(f"*(Page {idx} — Source: `{page_file.stem}`)*\n\n")
            out.write(page_content)
            out.write("\n\n---\n\n")

    print(f"-> Book compilation complete: {compiled_book_path.resolve()}\n")


def run_transcription(season_name: str, model_name: str, force: bool = False):
    from google import genai

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("\n[ERROR] GEMINI_API_KEY not found in environment or .env.local")
        sys.exit(1)

    base_dir = Path(__file__).resolve().parent.parent / "data" / "seasons" / season_name
    raw_dir = base_dir / "raw_photos"
    pages_dir = base_dir / "digital_pages"
    book_file = base_dir / f"UAAP_{season_name.replace('-', '_')}_Annual_Report.md"

    raw_dir.mkdir(parents=True, exist_ok=True)
    pages_dir.mkdir(parents=True, exist_ok=True)

    valid_exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    photos = sorted([f for f in raw_dir.iterdir() if f.suffix.lower() in valid_exts])

    if not photos:
        print(f"\n[!] No photos found in:")
        print(f"    -> {raw_dir.resolve()}")
        print("\nPlease paste/dump your season photos into that folder and run this script again!")
        return

    client = genai.Client(api_key=api_key)

    print(f"\n=======================================================")
    print(f" UAAP ARCHIVE: Season {season_name}")
    print(f" Total Photos Found: {len(photos)}")
    print(f" Model: {model_name}")
    print(f" Target Folder: {pages_dir.resolve()}")
    print(f"=======================================================\n")

    completed = 0
    skipped = 0

    for idx, photo_path in enumerate(photos, start=1):
        target_md = pages_dir / f"{photo_path.stem}.md"

        if target_md.exists() and not force:
            print(f"[{idx}/{len(photos)}] [SKIPPED] {photo_path.name} (already transcribed)")
            skipped += 1
            continue

        print(f"[{idx}/{len(photos)}] Transcribing: {photo_path.name} ...", end=" ", flush=True)
        try:
            markdown_content = transcribe_page(client, photo_path, model_name)
            target_md.write_text(markdown_content, encoding="utf-8")
            print("DONE!")
            completed += 1
            # Pacing delay to strictly stay under the 15 RPM Gemini free tier limit
            time.sleep(4.5)
        except Exception as e:
            print(f"FAILED! Error: {e}")

    print(f"\nProcessing summary: {completed} new pages transcribed, {skipped} skipped.")
    compile_book(pages_dir, book_file, season_name)

    # Automatically generate interactive HTML book viewer and printable PDF
    try:
        print("\n--- Generating Digital Book Viewer and PDF ---")
        try:
            from scripts.build_book_pdf_and_viewer import generate_html_and_pdf
        except ImportError:
            from build_book_pdf_and_viewer import generate_html_and_pdf
        generate_html_and_pdf(season_name)
    except Exception as e:
        print(f"[!] PDF/Viewer generation notice: {e}")


def main():
    parser = argparse.ArgumentParser(description="Transcribe an entire UAAP annual report book season into digital Markdown.")
    parser.add_argument("--season", default="2003-2004", help="Season name/folder (default: 2003-2004)")
    parser.add_argument("--model", default="gemini-3.5-flash", help="Model name (default: gemini-3.5-flash)")
    parser.add_argument("--force", action="store_true", help="Re-transcribe pages even if .md already exists")
    args = parser.parse_args()

    run_transcription(season_name=args.season, model_name=args.model, force=args.force)


if __name__ == "__main__":
    main()
