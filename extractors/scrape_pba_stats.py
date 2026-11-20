"""Scrape PBA LiveStats player box scores from pba-api01.actech2.com.

Final games are discovered from each tournament page; no ID list is needed.

Usage:
    python -m pip install requests beautifulsoup4 pandas openpyxl
    python scrape_pba_stats.py                                        # current tournaments
    python scrape_pba_stats.py pba-49th-season-philippine-cup         # another tournament
    python scrape_pba_stats.py --game pba-50th-season-commissioner-s-cup,199

Output:
    pba_season_stats_YYYYMMDD_HHMMSS.xlsx (new file each run)
"""

from livestats_common import League, main

PBA = League(
    name="PBA",
    host="pba-api01.actech2.com",
    tournaments=("pba-50th-season-commissioner-s-cup",),
    stat_columns={
        "mins": 3,
        "pts": 4,
        "fg2": 5, "fg2_pct": 8,      # "m-a" string, then %
        "fg3": 9, "fg3_pct": 10,
        "fg4": 11, "fg4_pct": 12,    # PBA four-point line
        "ft": 13, "ft_pct": 14,
        "reb": 17, "ast": 18, "to": 19, "stl": 20, "blk": 21, "pf": 22,
        "fls_on": 23, "plus_minus": 24,
    },
    output_prefix="pba_season_stats",
)

if __name__ == "__main__":
    main(PBA)
