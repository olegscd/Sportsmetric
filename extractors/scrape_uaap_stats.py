"""Scrape UAAP LiveStats player box scores from uaap.livestats.ph.

Final games are discovered from each tournament page; no ID list is needed.

Usage:
    python -m pip install requests beautifulsoup4 pandas openpyxl
    python scrape_uaap_stats.py                                   # current tournaments
    python scrape_uaap_stats.py uaap-season-88-men-s-basketball   # another tournament
    python scrape_uaap_stats.py --game uaap-season-89-men-s-basketball,50

Output:
    uaap_season_stats_YYYYMMDD_HHMMSS.xlsx (new file each run)
"""

from livestats_common import League, main

UAAP = League(
    name="UAAP",
    host="uaap.livestats.ph",
    tournaments=("uaap-season-89-men-s-basketball",),
    stat_columns={
        "mins": 3,
        "pts": 4,
        "fg2": 5, "fg2_pct": 8,      # "m-a" string, then %
        "fg3": 9, "fg3_pct": 10,
        "ft": 11, "ft_pct": 12,
        "reb": 15, "ast": 16, "to": 17, "stl": 18, "blk": 19, "pf": 20,
        "fls_on": 21, "plus_minus": 22,
    },
    output_prefix="uaap_season_stats",
)

if __name__ == "__main__":
    main(UAAP)
