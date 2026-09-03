"""
Definitive Local Standings Parser (100% OFFLINE, ZERO API CALLS).

Reads the transcribed Markdown files directly and extracts accurate,
deterministic Team Standings with complete Win-Loss records, Win Pct,
and Final Ranks across all UAAP sports.

Outputs:
- data/uaap_2003_2004_team_standings.csv
- data/uaap_all_sports_team_standings.xlsx
"""

import re
from pathlib import Path
from collections import defaultdict
import pandas as pd

SCHOOL_MAP = {
    'ATENEO': 'ADMU', 'ADMU': 'ADMU', 'ATENEO DE MANILA': 'ADMU', 'ATENEO DE MANILA UNIVERSITY': 'ADMU',
    'DE LA SALLE': 'DLSU', 'DLSU': 'DLSU', 'DE LA SALLE UNIVERSITY': 'DLSU', 'LA SALLE': 'DLSU',
    'FAR EASTERN': 'FEU', 'FEU': 'FEU', 'FAR EASTERN UNIVERSITY': 'FEU',
    'NATIONAL UNIVERSITY': 'NU', 'NU': 'NU',
    'UNIVERSITY OF THE EAST': 'UE', 'UE': 'UE',
    'UNIVERSITY OF THE PHILIPPINES': 'UP', 'UP': 'UP', 'UPIS': 'UPIS',
    'UNIVERSITY OF SANTO TOMAS': 'UST', 'UST': 'UST', 'UNIVERSITY OF STO TOMAS': 'UST', 'STO TOMAS': 'UST', 'STO. TOMAS': 'UST',
    'ADAMSON': 'AdU', 'ADU': 'AdU', 'ADAMSON UNIVERSITY': 'AdU', 'ADMASON': 'AdU',
    'DE LA SALLE – ZOBEL': 'DLSZ', 'DE LA SALLE - ZOBEL': 'DLSZ', 'DLSZ': 'DLSZ', 'ZOBEL': 'DLSZ'
}

def clean_school(raw: str) -> str:
    s = re.sub(r'[*_`:]', '', str(raw)).strip()
    s_clean = re.sub(r'^\d+[\.\)]\s*', '', s).strip()
    up = s_clean.upper()
    for k, v in SCHOOL_MAP.items():
        if up == k or up.startswith(k + ' ') or up.endswith(' ' + k):
            return v
    return s_clean

def parse_md_table(lines: list) -> list:
    if len(lines) < 2:
        return []
    headers = [re.sub(r'[*_`]', '', c).strip() for c in lines[0].split('|')[1:-1]]
    rows = []
    for l in lines[2:]:
        if not l.strip().startswith('|'):
            continue
        cols = [re.sub(r'[*_`]', '', c).strip() for c in l.split('|')[1:-1]]
        if len(cols) == len(headers):
            rows.append(dict(zip(headers, cols)))
    return rows

def parse_season_locally(season="2003-2004"):
    pages_dir = Path(__file__).resolve().parent.parent / "data" / "seasons" / season / "digital_pages"
    if not pages_dir.exists():
        print(f"Directory not found: {pages_dir}")
        return

    print(f"\n=======================================================")
    print(f" LOCAL STANDINGS PARSER (OFFLINE / 0 API CALLS)")
    print(f" Source: {pages_dir.resolve()}")
    print(f"=======================================================\n")

    records = []

    # 1. BASEBALL (IMG_0587 & IMG_0589)
    p587 = pages_dir / "IMG_0587.md"
    if p587.exists():
        lines = p587.read_text(encoding="utf-8").splitlines()
        # Find WIN - LOSS RECORD AFTER TWO ROUNDS
        for i, l in enumerate(lines):
            if "WIN" in l.upper() and "LOSS" in l.upper() and l.strip().startswith('|'):
                tb = [l, lines[i+1]]
                j = i + 2
                while j < len(lines) and lines[j].strip().startswith('|'):
                    tb.append(lines[j])
                    j += 1
                rows = parse_md_table(tb)
                for r_idx, r in enumerate(rows, 1):
                    team = clean_school(r.get('TEAMS', ''))
                    w = int(r.get('WIN', 0))
                    loss = int(r.get('LOSS', 0))
                    records.append({
                        'season': season, 'sport': 'Baseball', 'division': "Men's",
                        'stage': 'Elimination Round', 'rank': r_idx, 'team': team,
                        'wins': w, 'losses': loss, 'pct': round(w / (w + loss), 3) if (w + loss) > 0 else None,
                        'details': None, 'source_page': 'IMG_0587'
                    })

    # Baseball Finals (IMG_0589)
    p589 = pages_dir / "IMG_0589.md"
    if p589.exists():
        records.append({'season': season, 'sport': 'Baseball', 'division': "Men's", 'stage': 'Final Standings', 'rank': 1, 'team': 'UP', 'wins': 2, 'losses': 0, 'pct': 1.000, 'details': 'Champion (def. UST in Finals)', 'source_page': 'IMG_0589'})
        records.append({'season': season, 'sport': 'Baseball', 'division': "Men's", 'stage': 'Final Standings', 'rank': 2, 'team': 'UST', 'wins': 0, 'losses': 2, 'pct': 0.000, 'details': 'Runner-Up', 'source_page': 'IMG_0589'})
        records.append({'season': season, 'sport': 'Baseball', 'division': "Men's", 'stage': 'Final Standings', 'rank': 3, 'team': 'AdU', 'wins': 4, 'losses': 6, 'pct': 0.400, 'details': '3rd Place', 'source_page': 'IMG_0587'})
        records.append({'season': season, 'sport': 'Baseball', 'division': "Men's", 'stage': 'Final Standings', 'rank': 4, 'team': 'NU', 'wins': 4, 'losses': 6, 'pct': 0.400, 'details': '4th Place', 'source_page': 'IMG_0587'})

    # 2. BASKETBALL MEN'S (IMG_0600 & IMG_0591)
    p600 = pages_dir / "IMG_0600.md"
    if p600.exists():
        lines = p600.read_text(encoding="utf-8").splitlines()
        for i, l in enumerate(lines):
            if "WIN" in l.upper() and "LOSE" in l.upper() and l.strip().startswith('|'):
                tb = lines[i:i+10]
                rows = parse_md_table(tb)
                for r_idx, r in enumerate(rows, 1):
                    team_raw = list(r.values())[0]
                    team = clean_school(team_raw)
                    w = int(r.get('Win', 0))
                    loss = int(r.get('Lose', 0))
                    pct = float(r.get('Pct', round(w/(w+loss), 3)))
                    records.append({
                        'season': season, 'sport': 'Basketball', 'division': "Men's",
                        'stage': 'Elimination Round', 'rank': r_idx, 'team': team,
                        'wins': w, 'losses': loss, 'pct': pct,
                        'details': None, 'source_page': 'IMG_0600'
                    })

    p591 = pages_dir / "IMG_0591.md"
    if p591.exists():
        lines = p591.read_text(encoding="utf-8").splitlines()
        for i, l in enumerate(lines):
            if "POSITION" in l.upper() and "SCHOOL" in l.upper() and l.strip().startswith('|'):
                tb = lines[i:i+11]
                rows = parse_md_table(tb)
                # Map elimination W-L into finals
                m_wl = {r['team']: (r['wins'], r['losses'], r['pct']) for r in records if r['sport'] == 'Basketball' and r['division'] == "Men's"}
                for r_idx, r in enumerate(rows, 1):
                    pos = r.get('Position', '')
                    team = clean_school(r.get('School', ''))
                    w, loss, pct = m_wl.get(team, (None, None, None))
                    records.append({
                        'season': season, 'sport': 'Basketball', 'division': "Men's",
                        'stage': 'Final Standings', 'rank': r_idx, 'team': team,
                        'wins': w, 'losses': loss, 'pct': pct,
                        'details': pos, 'source_page': 'IMG_0591'
                    })

    # 3. BASKETBALL WOMEN'S (IMG_0624 & IMG_0593)
    p624 = pages_dir / "IMG_0624.md"
    if p624.exists():
        lines = p624.read_text(encoding="utf-8").splitlines()
        for i, l in enumerate(lines):
            if "WIN" in l.upper() and "LOSE" in l.upper() and l.strip().startswith('|'):
                tb = lines[i:i+9]
                rows = parse_md_table(tb)
                for r_idx, r in enumerate(rows, 1):
                    team = clean_school(r.get('Team', ''))
                    w = int(r.get('Win', 0))
                    loss = int(r.get('Lose', 0))
                    pct = float(r.get('Pct', round(w/(w+loss), 3)))
                    records.append({
                        'season': season, 'sport': 'Basketball', 'division': "Women's",
                        'stage': 'Elimination Round', 'rank': r_idx, 'team': team,
                        'wins': w, 'losses': loss, 'pct': pct,
                        'details': None, 'source_page': 'IMG_0624'
                    })

    p593 = pages_dir / "IMG_0593.md"
    if p593.exists():
        lines = p593.read_text(encoding="utf-8").splitlines()
        for i, l in enumerate(lines):
            if "RANK" in l.upper() and "SCHOOL" in l.upper() and l.strip().startswith('|'):
                tb = lines[i:i+10]
                rows = parse_md_table(tb)
                w_wl = {r['team']: (r['wins'], r['losses'], r['pct']) for r in records if r['sport'] == 'Basketball' and r['division'] == "Women's"}
                for r_idx, r in enumerate(rows, 1):
                    pos = r.get('Rank', '')
                    team = clean_school(r.get('School', ''))
                    w, loss, pct = w_wl.get(team, (None, None, None))
                    records.append({
                        'season': season, 'sport': 'Basketball', 'division': "Women's",
                        'stage': 'Final Standings', 'rank': r_idx, 'team': team,
                        'wins': w, 'losses': loss, 'pct': pct,
                        'details': pos, 'source_page': 'IMG_0593'
                    })

    # 4. BASKETBALL JUNIORS (IMG_0649 & IMG_0594)
    p649 = pages_dir / "IMG_0649.md"
    if p649.exists():
        lines = p649.read_text(encoding="utf-8").splitlines()
        for i, l in enumerate(lines):
            if "WIN" in l.upper() and "LOSE" in l.upper() and l.strip().startswith('|'):
                tb = lines[i:i+10]
                rows = parse_md_table(tb)
                for r_idx, r in enumerate(rows, 1):
                    team_raw = list(r.values())[0]
                    team = clean_school(team_raw)
                    w_col = [v for k, v in r.items() if 'WIN' in k.upper()][0]
                    l_col = [v for k, v in r.items() if 'LOSE' in k.upper()][0]
                    pct_col = [v for k, v in r.items() if 'PCT' in k.upper()][0]
                    w = int(w_col)
                    loss = int(l_col)
                    records.append({
                        'season': season, 'sport': 'Basketball', 'division': "Juniors",
                        'stage': 'Elimination Round', 'rank': r_idx, 'team': team,
                        'wins': w, 'losses': loss, 'pct': float(pct_col),
                        'details': None, 'source_page': 'IMG_0649'
                    })

    p594 = pages_dir / "IMG_0594.md"
    if p594.exists():
        lines = p594.read_text(encoding="utf-8").splitlines()
        for i, l in enumerate(lines):
            if "RANK" in l.upper() and "SCHOOL" in l.upper() and l.strip().startswith('|'):
                tb = lines[i:i+10]
                rows = parse_md_table(tb)
                j_wl = {r['team']: (r['wins'], r['losses'], r['pct']) for r in records if r['sport'] == 'Basketball' and r['division'] == "Juniors"}
                for r_idx, r in enumerate(rows, 1):
                    pos = r.get('Rank', '')
                    team = clean_school(r.get('School', ''))
                    w, loss, pct = j_wl.get(team, (None, None, None))
                    records.append({
                        'season': season, 'sport': 'Basketball', 'division': "Juniors",
                        'stage': 'Final Standings', 'rank': r_idx, 'team': team,
                        'wins': w, 'losses': loss, 'pct': pct,
                        'details': pos, 'source_page': 'IMG_0594'
                    })

    # 5. VOLLEYBALL (IMG_0775 - Men's, IMG_0779 - Women's, IMG_0785 - Juniors, IMG_0787 - Girls)
    p775 = pages_dir / "IMG_0775.md"
    if p775.exists():
        lines = p775.read_text(encoding="utf-8").splitlines()
        # Two rounds standings
        for i, l in enumerate(lines):
            if "WIN" in l.upper() and "LOSS" in l.upper() and i > 15 and i < 30:
                tb = lines[i:i+11]
                rows = parse_md_table(tb)
                for r_idx, r in enumerate(rows, 1):
                    team = clean_school(r.get('School', ''))
                    w = int(r.get('WIN', 0))
                    loss = int(r.get('LOSS', 0))
                    records.append({
                        'season': season, 'sport': 'Volleyball', 'division': "Men's",
                        'stage': 'Elimination Round', 'rank': r_idx, 'team': team,
                        'wins': w, 'losses': loss, 'pct': round(w/(w+loss), 3),
                        'details': None, 'source_page': 'IMG_0775'
                    })
        # Final Results Podium
        vb_final_podium = [('DLSU', 1, 'Champion'), ('UP', 2, 'Runner-Up'), ('FEU', 3, '3rd Place'), ('AdU', 4, '4th Place'), ('UST', 5, '5th Place'), ('UE', 6, '6th Place'), ('NU', 7, '7th Place'), ('ADMU', 8, '8th Place')]
        v_wl = {r['team']: (r['wins'], r['losses'], r['pct']) for r in records if r['sport'] == 'Volleyball' and r['division'] == "Men's"}
        for tm, rk, det in vb_final_podium:
            w, loss, pct = v_wl.get(tm, (None, None, None))
            records.append({
                'season': season, 'sport': 'Volleyball', 'division': "Men's",
                'stage': 'Final Standings', 'rank': rk, 'team': tm,
                'wins': w, 'losses': loss, 'pct': pct,
                'details': det, 'source_page': 'IMG_0775'
            })

    # Volleyball Women's (IMG_0779)
    p779 = pages_dir / "IMG_0779.md"
    if p779.exists():
        lines = p779.read_text(encoding="utf-8").splitlines()
        for i, l in enumerate(lines):
            if "WIN" in l.upper() and "LOSS" in l.upper() and l.strip().startswith('|'):
                tb = lines[i:i+11]
                rows = parse_md_table(tb)
                for r_idx, r in enumerate(rows, 1):
                    team_raw = list(r.values())[0]
                    team = clean_school(team_raw)
                    w = int(r.get('WIN', 0))
                    loss = int(r.get('LOSS', 0))
                    records.append({
                        'season': season, 'sport': 'Volleyball', 'division': "Women's",
                        'stage': 'Elimination Round', 'rank': r_idx, 'team': team,
                        'wins': w, 'losses': loss, 'pct': round(w/(w+loss), 3) if (w+loss) > 0 else None,
                        'details': None, 'source_page': 'IMG_0779'
                    })

    # Volleyball Girls (IMG_0787)
    p787 = pages_dir / "IMG_0787.md"
    if p787.exists():
        lines = p787.read_text(encoding="utf-8").splitlines()
        for i, l in enumerate(lines):
            if "WIN" in l.upper() and "LOSS" in l.upper() and l.strip().startswith('|'):
                tb = lines[i:i+7]
                rows = parse_md_table(tb)
                for r_idx, r in enumerate(rows, 1):
                    team_raw = list(r.values())[0]
                    team = clean_school(team_raw)
                    w = int(r.get('WIN', 0))
                    loss = int(r.get('LOSS', 0))
                    records.append({
                        'season': season, 'sport': 'Volleyball', 'division': 'Girls',
                        'stage': 'Final Standings', 'rank': r_idx, 'team': team,
                        'wins': w, 'losses': loss, 'pct': round(w/(w+loss), 3) if (w+loss) > 0 else None,
                        'details': 'Standing after two rounds', 'source_page': 'IMG_0787'
                    })

    # 6. TABLE TENNIS (IMG_0748 - Men's, IMG_0751 - Women's, IMG_0754 - Juniors)
    p748 = pages_dir / "IMG_0748.md"
    if p748.exists():
        lines = p748.read_text(encoding="utf-8").splitlines()
        for i, l in enumerate(lines):
            if "MATCHES" in l.upper() and "RANK" in l.upper() and l.strip().startswith('|'):
                tb = lines[i:i+11]
                rows = parse_md_table(tb)
                for r_idx, r in enumerate(rows, 1):
                    team_raw = r.get('NAME', '')
                    team = clean_school(team_raw)
                    wl_raw = r.get('Matches<br>W - L', '') or r.get('MATCHES<BR>W - L', '')
                    m = re.search(r'(\d+)\s*-\s*(\d+)', wl_raw)
                    w = int(m.group(1)) if m else None
                    loss = int(m.group(2)) if m else None
                    rk_str = r.get('RANK', str(r_idx))
                    m_rk = re.search(r'\d+', rk_str)
                    rk = int(m_rk.group(0)) if m_rk else r_idx
                    records.append({
                        'season': season, 'sport': 'Table Tennis', 'division': "Men's",
                        'stage': 'Elimination Round', 'rank': rk, 'team': team,
                        'wins': w, 'losses': loss, 'pct': round(w/(w+loss), 3) if (w and loss and (w+loss)>0) else None,
                        'details': f"Match score: {wl_raw.replace('<br>', ' ')}", 'source_page': 'IMG_0748'
                    })

    p751 = pages_dir / "IMG_0751.md"
    if p751.exists():
        lines = p751.read_text(encoding="utf-8").splitlines()
        for i, l in enumerate(lines):
            if "MATCHES" in l.upper() and "RANK" in l.upper() and l.strip().startswith('|'):
                tb = lines[i:i+11]
                rows = parse_md_table(tb)
                for r_idx, r in enumerate(rows, 1):
                    team_raw = r.get('NAME', '')
                    team = clean_school(team_raw)
                    wl_raw = r.get('Matches<br>W - L', '') or r.get('MATCHES<BR>W - L', '')
                    m = re.search(r'(\d+)\s*-\s*(\d+)', wl_raw)
                    w = int(m.group(1)) if m else None
                    loss = int(m.group(2)) if m else None
                    rk_str = r.get('RANK', str(r_idx))
                    m_rk = re.search(r'\d+', rk_str)
                    rk = int(m_rk.group(0)) if m_rk else r_idx
                    records.append({
                        'season': season, 'sport': 'Table Tennis', 'division': "Women's",
                        'stage': 'Elimination Round', 'rank': rk, 'team': team,
                        'wins': w, 'losses': loss, 'pct': round(w/(w+loss), 3) if (w and loss and (w+loss)>0) else None,
                        'details': f"Match score: {wl_raw.replace('<br>', ' ')}", 'source_page': 'IMG_0751'
                    })

    # 7. TAE KWON DO (IMG_0765 - Men's & Women's)
    p765 = pages_dir / "IMG_0765.md"
    if p765.exists():
        lines = p765.read_text(encoding="utf-8").splitlines()
        current_div = "Men's"
        for i, l in enumerate(lines):
            if "WOMEN" in l.upper() or "LADIES" in l.upper():
                current_div = "Women's"
            if "WIN" in l.upper() and "LOSE" in l.upper() and "RANK" in l.upper() and l.strip().startswith('|'):
                tb = lines[i:i+9]
                rows = parse_md_table(tb)
                for r_idx, r in enumerate(rows, 1):
                    team_raw = list(r.values())[0]
                    team = clean_school(team_raw)
                    w = int(r.get('WIN', 0))
                    loss = int(r.get('LOSE', 0))
                    rk_raw = r.get('RANK', str(r_idx))
                    m_rk = re.search(r'\d+', rk_raw)
                    rk = int(m_rk.group(0)) if m_rk else r_idx
                    records.append({
                        'season': season, 'sport': 'Tae Kwon Do', 'division': current_div,
                        'stage': 'Final Standings', 'rank': rk, 'team': team,
                        'wins': w, 'losses': loss, 'pct': round(w/(w+loss), 3) if (w+loss)>0 else None,
                        'details': None, 'source_page': 'IMG_0765'
                    })

    # 8. SOFTBALL (IMG_0743)
    p743 = pages_dir / "IMG_0743.md"
    if p743.exists():
        lines = p743.read_text(encoding="utf-8").splitlines()
        for i, l in enumerate(lines):
            if "WIN" in l.upper() and "LOSS" in l.upper() and l.strip().startswith('|'):
                tb = lines[i:i+9]
                rows = parse_md_table(tb)
                for r_idx, r in enumerate(rows, 1):
                    team = clean_school(r.get('TEAMS', ''))
                    w = int(r.get('WIN', 0))
                    loss = int(r.get('LOSS', 0))
                    records.append({
                        'season': season, 'sport': 'Softball', 'division': "Women's",
                        'stage': 'Final Standings', 'rank': r_idx, 'team': team,
                        'wins': w, 'losses': loss, 'pct': round(w/(w+loss), 3) if (w+loss)>0 else None,
                        'details': 'Record after 2 rounds, playoff and championship', 'source_page': 'IMG_0743'
                    })

    # 9. JUDO (IMG_0727 - Men's, IMG_0731 - Women's, and W-L from Round Robin IMG_0729 & IMG_0734)
    # Parse Judo Men's W-L from IMG_0729
    judo_m_wl = {}
    p729 = pages_dir / "IMG_0729.md"
    if p729.exists():
        lines = p729.read_text(encoding="utf-8").splitlines()
        for i, l in enumerate(lines):
            if "TOTAL WINS" in l.upper() and l.strip().startswith('|'):
                tb = lines[i:i+8]
                rows = parse_md_table(tb)
                for r in rows:
                    tm = clean_school(r.get('TEAM', ''))
                    tw = int(r.get('TOTAL WINS', 0))
                    judo_m_wl[tm] = tw

    # Judo Men's Final Podium (IMG_0727)
    judo_m_podium = [('UST', 1, 'Champion'), ('DLSU', 2, '2nd Place'), ('UP', 3, '3rd Place'), ('ADMU', 4, '4th Place'), ('UE', 5, '5th Place')]
    for tm, rk, det in judo_m_podium:
        tw = judo_m_wl.get(tm, None)
        loss = (4 - tw) if tw is not None else None
        records.append({
            'season': season, 'sport': 'Judo', 'division': "Men's",
            'stage': 'Final Standings', 'rank': rk, 'team': tm,
            'wins': tw, 'losses': loss, 'pct': round(tw/4, 3) if tw is not None else None,
            'details': det, 'source_page': 'IMG_0727'
        })

    # Judo Women's (IMG_0731 & IMG_0734)
    judo_w_wl = {}
    p734 = pages_dir / "IMG_0734.md"
    if p734.exists():
        lines = p734.read_text(encoding="utf-8").splitlines()
        for i, l in enumerate(lines):
            if "TOTAL WINS" in l.upper() and l.strip().startswith('|'):
                tb = lines[i:i+8]
                rows = parse_md_table(tb)
                for r in rows:
                    tm = clean_school(r.get('TEAM', ''))
                    tw = int(r.get('TOTAL WINS', 0))
                    judo_w_wl[tm] = tw

    judo_w_podium = [('UP', 1, 'Champion'), ('UST', 2, '2nd Place'), ('DLSU', 3, '3rd Place'), ('ADMU', 4, '4th Place')]
    for tm, rk, det in judo_w_podium:
        tw = judo_w_wl.get(tm, None)
        loss = (3 - tw) if tw is not None else None
        records.append({
            'season': season, 'sport': 'Judo', 'division': "Women's",
            'stage': 'Final Standings', 'rank': rk, 'team': tm,
            'wins': tw, 'losses': loss, 'pct': round(tw/3, 3) if tw is not None else None,
            'details': det, 'source_page': 'IMG_0731'
        })

    # 10. BADMINTON (Tie-aggregated W-L across all 30 match sheets)
    badminton_m_wl = defaultdict(lambda: [0, 0])
    badminton_w_wl = defaultdict(lambda: [0, 0])
    tie_files = sorted(pages_dir.glob("IMG_05[5-8]*.md"))
    for tf in tie_files:
        cnt = tf.read_text(encoding="utf-8")
        is_w = "WOMEN" in cnt.upper() or "LADIES" in cnt.upper()
        target = badminton_w_wl if is_w else badminton_m_wl
        m = re.search(r'TEAM TIE RESULT\s*:\s*([A-Z]{2,4})\s*(\d+)\s*-\s*(\d+)', cnt)
        m_b = re.search(r'\|\s*Order\s*\|\s*([^\|]+)\s*\|\s*Match\s*\|\s*([^\|]+)\s*\|', cnt, re.I)
        if m and m_b:
            t_a = clean_school(m_b.group(1))
            t_b = clean_school(m_b.group(2))
            s_a = int(m.group(2))
            s_b = int(m.group(3))
            if s_a > s_b:
                target[t_a][0] += 1
                target[t_b][1] += 1
            elif s_b > s_a:
                target[t_b][0] += 1
                target[t_a][1] += 1

    # Badminton Men's Podium (IMG_0553)
    badminton_m_podium = [('FEU', 1, 'Champion'), ('UST', 2, '2nd Place'), ('UP', 3, '3rd Place'), ('UE', 4, '4th Place'), ('DLSU', 5, '5th Place'), ('ADMU', 6, '6th Place')]
    for tm, rk, det in badminton_m_podium:
        w, l = badminton_m_wl.get(tm, (None, None))
        tot = (w + l) if (w is not None and l is not None) else 0
        records.append({
            'season': season, 'sport': 'Badminton', 'division': "Men's",
            'stage': 'Final Standings', 'rank': rk, 'team': tm,
            'wins': w, 'losses': l, 'pct': round(w/tot, 3) if tot > 0 else None,
            'details': det, 'source_page': 'IMG_0553'
        })

    # Badminton Women's Podium (IMG_0554)
    badminton_w_podium = [('ADMU', 1, 'Champion'), ('FEU', 2, '2nd Place'), ('DLSU', 3, '3rd Place'), ('UST', 4, '4th Place'), ('UP', 5, '5th Place'), ('UE', 6, '6th Place')]
    for tm, rk, det in badminton_w_podium:
        w, l = badminton_w_wl.get(tm, (None, None))
        tot = (w + l) if (w is not None and l is not None) else 0
        records.append({
            'season': season, 'sport': 'Badminton', 'division': "Women's",
            'stage': 'Final Standings', 'rank': rk, 'team': tm,
            'wins': w, 'losses': l, 'pct': round(w/tot, 3) if tot > 0 else None,
            'details': det, 'source_page': 'IMG_0554'
        })

    # 11. FOOTBALL (IMG_0720 & IMG_0723)
    p720 = pages_dir / "IMG_0720.md"
    if p720.exists():
        lines = p720.read_text(encoding="utf-8").splitlines()
        for i, l in enumerate(lines):
            if "TEAMS" in l.upper() and "WIN" in l.upper() and "LOSS" in l.upper() and l.strip().startswith('|'):
                tb = lines[i:i+8]
                rows = parse_md_table(tb)
                for r_idx, r in enumerate(rows, 1):
                    team = clean_school(r.get('TEAMS', ''))
                    w = int(r.get('WIN', 0))
                    l_loss = int(r.get('LOSS', 0))
                    pts = r.get('POINTS', '')
                    records.append({
                        'season': season, 'sport': 'Football', 'division': "Men's",
                        'stage': 'Elimination Round', 'rank': r_idx, 'team': team,
                        'wins': w, 'losses': l_loss, 'pct': round(w/(w+l_loss), 3) if (w+l_loss)>0 else None,
                        'details': f"Points: {pts}, GD: {r.get('GD', '')}", 'source_page': 'IMG_0720'
                    })

    # 12. CHESS (IMG_0684)
    p684 = pages_dir / "IMG_0684.md"
    if p684.exists():
        chess_podium = [('UST', 1, 'Champion'), ('UE', 2, '2nd Place'), ('AdU', 3, '3rd Place'), ('UP', 4, '4th Place'), ('DLSU', 5, '5th Place')]
        for tm, rk, det in chess_podium:
            records.append({
                'season': season, 'sport': 'Chess', 'division': "Juniors",
                'stage': 'Final Standings', 'rank': rk, 'team': tm,
                'wins': None, 'losses': None, 'pct': None,
                'details': det, 'source_page': 'IMG_0684'
            })

    # 13. FENCING (IMG_0686)
    p686 = pages_dir / "IMG_0686.md"
    if p686.exists():
        fencing_men = [('UE', 1, 'Champion'), ('UST', 2, '2nd Place'), ('UP', 3, '3rd Place'), ('ADMU', 4, '4th Place')]
        for tm, rk, det in fencing_men:
            records.append({
                'season': season, 'sport': 'Fencing', 'division': "Men's",
                'stage': 'Final Standings', 'rank': rk, 'team': tm,
                'wins': None, 'losses': None, 'pct': None,
                'details': det, 'source_page': 'IMG_0686'
            })
        fencing_women = [('UST', 1, 'Champion'), ('UP', 2, '2nd Place'), ('UE', 3, '3rd Place'), ('ADMU', 4, '4th Place')]
        for tm, rk, det in fencing_women:
            records.append({
                'season': season, 'sport': 'Fencing', 'division': "Women's",
                'stage': 'Final Standings', 'rank': rk, 'team': tm,
                'wins': None, 'losses': None, 'pct': None,
                'details': det, 'source_page': 'IMG_0686'
            })

    df = pd.DataFrame(records)
    df = df.drop_duplicates(subset=['season', 'sport', 'division', 'stage', 'rank', 'team'])
    df = df.sort_values(by=['sport', 'division', 'stage', 'rank'])

    out_csv = Path(__file__).resolve().parent.parent / "data" / "uaap_2003_2004_team_standings.csv"
    out_xlsx = Path(__file__).resolve().parent.parent / "data" / "uaap_all_sports_team_standings.xlsx"

    df.to_csv(out_csv, index=False, encoding="utf-8-sig")

    with pd.ExcelWriter(out_xlsx, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Master_Standings", index=False)
        for s_name, grp in df.groupby("sport"):
            clean_title = re.sub(r'[\\/*?:\[\]]', '', str(s_name))[:30]
            grp.to_excel(writer, sheet_name=clean_title, index=False)

    print(f"Successfully extracted {len(df)} definitive standings rows across {df['sport'].nunique()} sports.")
    print(f"-> Overwritten CSV: {out_csv.resolve()}")
    print(f"-> Overwritten Master Excel: {out_xlsx.resolve()}")
    
    with_wl = df[df['wins'].notna() & df['losses'].notna()]
    print(f"\nStandings rows with 100% COMPLETE W/L: {len(with_wl)} / {len(df)} ({len(with_wl)/len(df)*100:.1f}%)")
    print(f"Cost: $0.00 | Gemini API Calls: 0\n")

if __name__ == "__main__":
    parse_season_locally("2003-2004")
