"""
Compile all structured UAAP statistics into unified datasets for the web application.

Generates:
1. data/uaap_standings.json: Complete historical standings across all 7 seasons and 14 sports + General Championship.
2. data/uaap_archive_extras.json: Awards, match games, board medalists, and player stats keyed by sport and season.
"""

import json
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
STRUCTURED_DIR = PROJECT_ROOT / "data" / "structured"
DATA_DIR = PROJECT_ROOT / "data"

SPORT_NAME_MAP = {
    "basketball": "Basketball",
    "volleyball": "Volleyball",
    "badminton": "Badminton",
    "table_tennis": "Table Tennis",
    "taekwondo": "Tae Kwon Do",
    "baseball": "Baseball",
    "softball": "Softball",
    "judo": "Judo",
    "football": "Football",
    "fencing": "Fencing",
    "chess": "Chess",
    "tennis": "Lawn Tennis",
    "swimming": "Swimming",
    "overall_standings": "General Championship",
}

DIV_MAP = {
    "men": "Men's",
    "women": "Women's",
    "juniors": "Juniors",
    "college": "Collegiate",
    "high_school": "Juniors",
    "boys": "Boys",
    "girls": "Girls",
}


def compile_standings() -> list[dict[str, Any]]:
    records = []

    # 1. Overall / General Championship
    overall_dir = STRUCTURED_DIR / "overall_standings"
    if overall_dir.exists():
        for f in sorted(overall_dir.glob("*.json")):
            season = f.stem
            data = json.loads(f.read_text(encoding="utf-8"))
            for div_key, entries in data.get("divisions", {}).items():
                div_name = DIV_MAP.get(div_key, div_key.title())
                for item in entries:
                    pts = item.get("total_points")
                    pts_str = f"{pts:g} pts" if pts is not None else None
                    records.append({
                        "season": season,
                        "sport": "General Championship",
                        "division": div_name,
                        "stage": "Final Standings",
                        "rank": item.get("rank", 1),
                        "team": item.get("school", "Unknown"),
                        "wins": None,
                        "losses": None,
                        "pct": None,
                        "points": pts,
                        "details": pts_str,
                        "source_page": "UAAP Annual Report",
                    })

    # 2. All other sports
    for sdir in sorted(STRUCTURED_DIR.iterdir()):
        if not sdir.is_dir() or sdir.name == "overall_standings":
            continue
        sport_key = sdir.name
        sport_name = SPORT_NAME_MAP.get(sport_key, sport_key.replace("_", " ").title())

        st_dir = sdir / "standings"
        if st_dir.exists():
            for f in sorted(st_dir.glob("*.json")):
                season = f.stem
                data = json.loads(f.read_text(encoding="utf-8"))
                for div_key, entries in data.get("divisions", {}).items():
                    div_name = DIV_MAP.get(div_key, div_key.title())
                    for item in entries:
                        pts = item.get("points")
                        pts_str = f"{pts:g} pts" if pts is not None else None
                        notes = item.get("notes") or item.get("details") or pts_str
                        records.append({
                            "season": season,
                            "sport": sport_name,
                            "division": div_name,
                            "stage": "Final Standings",
                            "rank": item.get("rank", 1),
                            "team": item.get("school", "Unknown"),
                            "wins": item.get("wins"),
                            "losses": item.get("losses"),
                            "pct": item.get("pct"),
                            "points": pts,
                            "details": notes,
                            "source_page": "UAAP Annual Report",
                        })

    return records


def compile_extras() -> dict[str, Any]:
    """Compile awards, games, board medalists, and player stats."""
    extras: dict[str, Any] = {
        "awards": {},
        "games": {},
        "chess_medalists": {},
        "leaderboards": {},
    }

    # Awards across all sports
    for sdir in sorted(STRUCTURED_DIR.iterdir()):
        if not sdir.is_dir() or sdir.name == "overall_standings":
            continue
        sport_name = SPORT_NAME_MAP.get(sdir.name, sdir.name.replace("_", " ").title())
        aw_dir = sdir / "awards"
        if aw_dir.exists():
            for f in sorted(aw_dir.glob("*.json")):
                season = f.stem
                data = json.loads(f.read_text(encoding="utf-8"))
                divs = data.get("divisions", {})
                if divs:
                    key = f"{sport_name}|{season}"
                    clean_divs = {}
                    for dk, dv in divs.items():
                        clean_divs[DIV_MAP.get(dk, dk.title())] = dv
                    extras["awards"][key] = clean_divs

    # Games (basketball, volleyball, baseball)
    for sp in ["basketball", "volleyball", "baseball"]:
        sport_name = SPORT_NAME_MAP[sp]
        gm_dir = STRUCTURED_DIR / sp / "games"
        if gm_dir.exists():
            for f in sorted(gm_dir.glob("*.json")):
                season = f.stem
                data = json.loads(f.read_text(encoding="utf-8"))
                games_list = data.get("games", [])
                if games_list:
                    key = f"{sport_name}|{season}"
                    extras["games"][key] = games_list

    # Chess board medalists
    ch_bm_dir = STRUCTURED_DIR / "chess" / "board_medalists"
    if ch_bm_dir.exists():
        for f in sorted(ch_bm_dir.glob("*.json")):
            season = f.stem
            data = json.loads(f.read_text(encoding="utf-8"))
            divs = data.get("divisions", {})
            if divs:
                key = f"Chess|{season}"
                clean_divs = {}
                for dk, dv in divs.items():
                    clean_divs[DIV_MAP.get(dk, dk.title())] = dv
                extras["chess_medalists"][key] = clean_divs

    # Basketball leaderboards
    bb_lb_dir = STRUCTURED_DIR / "basketball" / "leaderboards"
    if bb_lb_dir.exists():
        for f in sorted(bb_lb_dir.glob("*.json")):
            season = f.stem
            data = json.loads(f.read_text(encoding="utf-8"))
            divs = data.get("divisions", {})
            if divs:
                key = f"Basketball|{season}"
                extras["leaderboards"][key] = divs

    return extras


def main():
    print("Compiling UAAP structured data for the web UI...")
    standings = compile_standings()
    out_standings = DATA_DIR / "uaap_standings.json"
    out_standings.write_text(json.dumps(standings, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Saved {len(standings)} standing records to {out_standings.resolve()}")

    extras = compile_extras()
    out_extras = DATA_DIR / "uaap_archive_extras.json"
    out_extras.write_text(json.dumps(extras, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Saved extras to {out_extras.resolve()}:")
    print(f"  Awards: {len(extras['awards'])} sport-seasons")
    print(f"  Game sets: {len(extras['games'])} sport-seasons")
    print(f"  Chess Medalists: {len(extras['chess_medalists'])} seasons")
    print(f"  Leaderboards: {len(extras['leaderboards'])} seasons")


if __name__ == "__main__":
    main()
