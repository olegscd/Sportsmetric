# Extractor Scripts

Python exports of official statistics to spreadsheets. None of them need a
hand-kept list of game or player IDs:

| Script | Source | How it finds what to fetch |
| --- | --- | --- |
| `scrape_uaap_stats.py` | uaap.livestats.ph box scores | Final games from the tournament page's match cards |
| `scrape_pba_stats.py` | pba-api01.actech2.com box scores | Final games from the tournament page's match cards |
| `scrape_pvl_stats.py` | pvl.ph player statistics | Players from the conference's skill leader tables |
| `scrape_pvl_games.py` | pvl.ph match reports | — |
| `extract_single_game.py` | one game URL or PDF | — |

`livestats_common.py` holds the shared UAAP/PBA logic. Run any script with
`--help` for options (another tournament, single games, `--limit`, PVL
`--conference` / `--all`).

```bash
python -m pip install requests beautifulsoup4 pandas openpyxl
python scrape_uaap_stats.py --limit 5
python scrape_pvl_stats.py --conference 18
```

The app does not read these spreadsheets at runtime: games are imported by
the automatic updater or the admin importer, and official PVL player stats are
refreshed in Supabase with `npm run pvl:stats`.
