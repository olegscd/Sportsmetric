"""
UAAP Statistics Extraction Pipeline.

Master script that reads compiled season markdown books and extracts
structured JSON data using sport-specific parsers.

Usage:
    python scripts/extract_statistics.py --season 1987-1988
    python scripts/extract_statistics.py --all
    python scripts/extract_statistics.py --season 2003-2004 --sport basketball

Adding a new season:
    Just run with --season YYYY-YYYY. No code changes needed.

Adding a new sport parser:
    1. Create scripts/parsers/{sport}_parser.py
    2. Import and call it in the _extract_sport_data() function below
"""

import argparse
import json
import sys
from pathlib import Path

# Ensure project root is on path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.parsers.page_splitter import split_and_classify, print_classification_summary
from scripts.parsers.overall_standings_parser import parse_overall_standings, save_overall_standings
from scripts.parsers.basketball_parser import extract_basketball
from scripts.parsers.volleyball_parser import extract_volleyball
from scripts.parsers.baseball_parser import extract_baseball
from scripts.parsers.chess_parser import extract_chess
from scripts.parsers.other_sports_parser import extract_other_sports, OTHER_SPORTS


SEASONS_DIR = PROJECT_ROOT / "data" / "seasons"
STRUCTURED_DIR = PROJECT_ROOT / "data" / "structured"


def get_available_seasons() -> list[str]:
    """Discover all seasons that have compiled books."""
    seasons = []
    for d in sorted(SEASONS_DIR.iterdir()):
        if d.is_dir() and list(d.glob("UAAP_*_Annual_Report.md")):
            seasons.append(d.name)
    return seasons


def get_compiled_book(season: str) -> Path | None:
    """Get the compiled book path for a season."""
    season_dir = SEASONS_DIR / season
    books = list(season_dir.glob("UAAP_*_Annual_Report.md"))
    return books[0] if books else None


def extract_season(season: str, sports: list[str] | None = None):
    """Run the full extraction pipeline for a single season."""
    book_path = get_compiled_book(season)
    if not book_path:
        print(f"[!] No compiled book found for season {season}")
        return

    print(f"\n{'=' * 60}")
    print(f" EXTRACTING: Season {season}")
    print(f" Source: {book_path.name} ({book_path.stat().st_size // 1024} KB)")
    print(f"{'=' * 60}")

    # Step 1: Split and classify pages
    print(f"\n[1/3] Splitting and classifying pages...")
    pages = split_and_classify(book_path)
    print_classification_summary(pages)

    # Step 2: Extract overall standings (always)
    if not sports or "overall" in sports:
        print(f"\n[2/3] Extracting overall standings...")
        standings = parse_overall_standings(pages, season)
        if standings["divisions"]:
            save_overall_standings(standings, STRUCTURED_DIR / "overall_standings")
            for div, rankings in standings["divisions"].items():
                print(f"  {div.title()} Division: {len(rankings)} schools")
                for r in rankings[:3]:
                    print(f"    #{r['rank']} {r['school']}: {r['total_points']} pts")
                if len(rankings) > 3:
                    print(f"    ... and {len(rankings) - 3} more")
        else:
            print("  [!] No overall standings found in this book")

    # Step 3: Sport-specific extraction
    print(f"\n[3/3] Sport-specific extraction...")
    if not sports or "basketball" in sports:
        print("  Extracting basketball data...")
        bb_data = extract_basketball(pages, season, STRUCTURED_DIR)
        
        st_divs = bb_data["standings"].get("divisions", {})
        if st_divs:
            print(f"    Standings: {', '.join(f'{k} ({len(v)} teams)' for k, v in st_divs.items())}")
        else:
            print("    Standings: none found")

        total_games = bb_data["games"].get("total_games", 0)
        print(f"    Games: {total_games} games parsed")

        aw_divs = bb_data["awards"].get("divisions", {})
        if aw_divs:
            aw_parts = []
            for div, awards in aw_divs.items():
                keys = list(awards.keys())
                aw_parts.append(f"{div} ({', '.join(keys)})")
            print(f"    Awards: {'; '.join(aw_parts)}")
        else:
            print("    Awards: none found")

        total_players = bb_data.get("player_stats", {}).get("total_players", 0)
        if total_players > 0:
            print(f"    Player Box Scores: {total_players} players extracted")

        lb_divs = bb_data.get("leaderboards", {}).get("divisions", {})
        if any(lb_divs.values()):
            lb_summary = []
            for div, cats in lb_divs.items():
                if cats:
                    lb_summary.append(f"{div} ({len(cats)} categories)")
            print(f"    Leaderboards: {'; '.join(lb_summary)}")

    if not sports or "volleyball" in sports:
        print("  Extracting volleyball data...")
        vb_data = extract_volleyball(pages, season, STRUCTURED_DIR)
        st = vb_data["standings"].get("divisions", {})
        gm = vb_data["games"].get("total_games", 0)
        aw = vb_data["awards"].get("divisions", {})
        print(f"    Standings: {len(st)} divs, Games: {gm} parsed, Awards: {len(aw)} divs")

    if not sports or "baseball" in sports:
        print("  Extracting baseball data...")
        b_data = extract_baseball(pages, season, STRUCTURED_DIR)
        st = b_data["standings"].get("divisions", {})
        gm = b_data["games"].get("total_games", 0)
        aw = b_data["awards"].get("divisions", {})
        print(f"    Standings: {len(st)} divs, Games: {gm} parsed, Awards: {len(aw)} divs")

    if not sports or "chess" in sports:
        print("  Extracting chess data...")
        ch_data = extract_chess(pages, season, STRUCTURED_DIR)
        st = ch_data["standings"].get("divisions", {})
        bm = ch_data.get("board_medalists", {}).get("divisions", {})
        aw = ch_data["awards"].get("divisions", {})
        print(f"    Standings: {len(st)} divs, Board Medalists: {len(bm)} divs, Awards: {len(aw)} divs")

    if not sports or any(s in OTHER_SPORTS for s in (sports or [])):
        print("  Extracting other tournament sports...")
        other_summary = extract_other_sports(pages, season, STRUCTURED_DIR)
        if other_summary:
            sports_found = list(other_summary.keys())
            print(f"    Sports extracted: {', '.join(sports_found)}")

    print(f"\n{'=' * 60}")
    print(f" DONE: Season {season}")
    print(f"{'=' * 60}\n")


def main():
    parser = argparse.ArgumentParser(
        description="Extract structured statistics from UAAP Annual Report books."
    )
    parser.add_argument(
        "--season",
        help="Season to extract (e.g., 1987-1988). Use --all for all seasons."
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Extract all available seasons."
    )
    parser.add_argument(
        "--sport",
        nargs="*",
        help="Specific sports to extract (default: all). E.g., --sport basketball volleyball"
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available seasons and exit."
    )
    args = parser.parse_args()

    if args.list:
        seasons = get_available_seasons()
        print(f"\nAvailable seasons ({len(seasons)}):")
        for s in seasons:
            book = get_compiled_book(s)
            size = book.stat().st_size // 1024 if book else 0
            print(f"  {s}  ({size} KB)")
        return

    if args.all:
        seasons = get_available_seasons()
    elif args.season:
        seasons = [args.season]
    else:
        parser.print_help()
        return

    for season in seasons:
        extract_season(season, args.sport)

    # Print summary
    print(f"\n{'=' * 60}")
    print(f" EXTRACTION SUMMARY")
    print(f"{'=' * 60}")
    
    standings_dir = STRUCTURED_DIR / "overall_standings"
    if standings_dir.exists():
        json_files = sorted(standings_dir.glob("*.json"))
        print(f"\n  Overall Standings: {len(json_files)} seasons extracted")
        for jf in json_files:
            data = json.loads(jf.read_text(encoding="utf-8"))
            divs = data.get("divisions", {})
            div_summary = ", ".join(
                f"{k}: {len(v)} schools" for k, v in divs.items()
            )
            print(f"    {jf.stem}: {div_summary}")

    # Summary of all sports
    print(f"\n  Structured Sports Extraction Summary:")
    sport_dirs = sorted([d for d in STRUCTURED_DIR.iterdir() if d.is_dir() and d.name != "overall_standings"])
    for sdir in sport_dirs:
        subdirs = sorted([sd for sd in sdir.iterdir() if sd.is_dir()])
        sub_info = []
        for sd in subdirs:
            flist = list(sd.glob("*.json"))
            sub_info.append(f"{sd.name}: {len(flist)} seasons")
        print(f"    {sdir.name.replace('_', ' ').title():20s} -> {', '.join(sub_info)}")

    print(f"\n  Output directory: {STRUCTURED_DIR.resolve()}")
    print()


if __name__ == "__main__":
    main()
