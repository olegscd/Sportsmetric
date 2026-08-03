import json
import math
import os
import pandas as pd

EXCEL_PATH = os.path.join("PVL stats", "pvl_player_stats_20260803_084546.xlsx")
OUT_JSON_PATH = os.path.join("scripts", "generated", "pvl-official-player-stats.json")

def sanitize(val):
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (int, float)):
        if math.isnan(val) or math.isinf(val):
            return None
        if isinstance(val, float) and val.is_integer():
            return int(val)
    return val

def main():
    print(f"Reading {EXCEL_PATH}...")
    df = pd.read_excel(EXCEL_PATH)
    df = df.where(pd.notnull(df), None)

    records_by_slug = {}

    for _, row in df.iterrows():
        slug = str(row['player_slug']).strip()
        if not slug or slug == 'None':
            continue

        stat_item = {
            "playerSlug": slug,
            "playerName": str(row['player_name']).strip() if row['player_name'] else "",
            "team": str(row['team']).strip() if row['team'] else None,
            "position": str(row['position']).strip() if row['position'] else None,
            "jersey": sanitize(row['jersey']),
            "height": str(row['height']).strip() if row['height'] else None,
            "school": str(row['school']).strip() if row['school'] else None,
            "statType": str(row['stat_type']).strip() if row['stat_type'] else "conference",
            "conferenceId": sanitize(row['conference_id']),
            "conferenceName": str(row['conference_name']).strip() if row['conference_name'] else None,
            "setsPlayed": sanitize(row['sets_played']) or 0,
            "totalPoints": sanitize(row['total_points']) or 0,
            "avgPerSet": sanitize(row['avg_per_set']) or 0.0,
            "ptsAtk": sanitize(row['pts_atk']) or 0,
            "ptsBlk": sanitize(row['pts_blk']) or 0,
            "ptsAce": sanitize(row['pts_ace']) or 0,
            "exeSet": sanitize(row['exe_set']) or 0,
            "exeDig": sanitize(row['exe_dig']) or 0,
            "exeRec": sanitize(row['exe_rec']) or 0,
            "faultAtk": sanitize(row['fault_atk']) or 0,
            "faultBlk": sanitize(row['fault_blk']) or 0,
            "faultSrv": sanitize(row['fault_srv']) or 0,
            "faultSet": sanitize(row['fault_set']) or 0,
            "faultDig": sanitize(row['fault_dig']) or 0,
            "faultRec": sanitize(row['fault_rec']) or 0,
            "totalAtk": sanitize(row['total_atk']) or 0,
            "totalBlk": sanitize(row['total_blk']) or 0,
            "totalAce": sanitize(row['total_ace']) or 0,
            "totalSet": sanitize(row['total_set']) or 0,
            "totalDig": sanitize(row['total_dig']) or 0,
            "totalRec": sanitize(row['total_rec']) or 0,
            "avgAtk": sanitize(row['avg_atk']) or 0.0,
            "avgBlk": sanitize(row['avg_blk']) or 0.0,
            "avgAce": sanitize(row['avg_ace']) or 0.0,
            "avgSet": sanitize(row['avg_set']) or 0.0,
            "avgDig": sanitize(row['avg_dig']) or 0.0,
            "avgRec": sanitize(row['avg_rec']) or 0.0,
            "successAtk": sanitize(row['success_atk']) or 0.0,
            "successBlk": sanitize(row['success_blk']) or 0.0,
            "successAce": sanitize(row['success_ace']) or 0.0,
            "successSet": sanitize(row['success_set']) or 0.0,
            "successDig": sanitize(row['success_dig']) or 0.0,
            "successRec": sanitize(row['success_rec']) or 0.0,
            "efficiencyAtk": sanitize(row['efficiency_atk']) or 0.0,
            "efficiencyBlk": sanitize(row['efficiency_blk']) or 0.0,
            "efficiencyAce": sanitize(row['efficiency_ace']) or 0.0,
            "efficiencySet": sanitize(row['efficiency_set']) or 0.0,
            "efficiencyDig": sanitize(row['efficiency_dig']) or 0.0,
            "efficiencyRec": sanitize(row['efficiency_rec']) or 0.0,
        }

        if slug not in records_by_slug:
            records_by_slug[slug] = {
                "playerSlug": slug,
                "playerName": stat_item["playerName"],
                "position": stat_item["position"],
                "jersey": stat_item["jersey"],
                "height": stat_item["height"],
                "school": stat_item["school"],
                "career": None,
                "conferences": []
            }

        if stat_item["statType"] == "career":
            records_by_slug[slug]["career"] = stat_item
        else:
            records_by_slug[slug]["conferences"].append(stat_item)

    os.makedirs(os.path.dirname(OUT_JSON_PATH), exist_ok=True)
    with open(OUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(records_by_slug, f, indent=2)

    print(f"Saved {len(records_by_slug)} player profiles to {OUT_JSON_PATH}")

if __name__ == "__main__":
    main()
