"""
Page Splitter and Section Classifier for UAAP Annual Report compiled books.

Splits a compiled markdown book into individual page segments using the
<!-- START PAGE --> markers, then classifies each page by sport and data type.

This is the first step in the extraction pipeline: raw markdown → classified
page segments → routed to sport-specific parsers.
"""

import re
from pathlib import Path


# Sport detection patterns: (canonical_sport_name, list of heading keywords)
SPORT_PATTERNS: list[tuple[str, list[str]]] = [
    ("basketball",   ["BASKETBALL"]),
    ("volleyball",   ["VOLLEYBALL"]),
    ("baseball",     ["BASEBALL"]),
    ("softball",     ["SOFTBALL"]),
    ("chess",        ["CHESS"]),
    ("table_tennis", ["TABLE TENNIS"]),
    ("tennis",       ["LAWN TENNIS", "TENNIS TOURNAMENT", "TENNIS RESULTS"]),
    ("football",     ["FOOTBALL"]),
    ("taekwondo",    ["TAEKWONDO", "TAE-KWON-DO", "TAE KWON DO", "TAEKNOWDO"]),
    ("badminton",    ["BADMINTON"]),
    ("judo",         ["JUDO"]),
    ("fencing",      ["FENCING"]),
    ("swimming",     ["SWIMMING", "FREESTYLE", "BACKSTROKE", "BREASTSTROKE", "BUTTERFLY"]),
    ("track_field",  ["TRACK & FIELD", "TRACK AND FIELD"]),
]

# Data type detection patterns
DATA_TYPE_PATTERNS: list[tuple[str, list[str]]] = [
    ("overall_standings", [
        "OVER-ALL TEAM STANDING",
        "OVERALL TEAM STANDING",
        "OVER-ALL STANDING OF TEAMS",
        "TEAM STANDING\nSY",
        "UAAP SCOREBOARD",
    ]),
    ("sport_champions",   ["TEAM STANDING\n", "CHAMPION"]),
    ("game_results",      ["RESULT", "DEFEATED", "GAME NO", "MATCH NO"]),
    ("player_stats",      ["PLAYER", "STATISTIC", "FIELD GOAL", "REBOUND"]),
    ("awards",            ["MVP", "MOST VALUABLE", "ROOKIE OF THE YEAR", "MYTHICAL"]),
    ("standings",         ["STANDING", "WIN", "LOSS", "W-L", "W |"]),
    ("schedule",          ["SCHEDULE"]),
]

OVERALL_PATTERNS = [
    "OVER-ALL TEAM STANDING",
    "OVERALL TEAM STANDING",
    "OVER-ALL STANDING OF TEAMS",
    "TEAM STANDING\nSY",
    "UAAP SCOREBOARD",
]


class PageSegment:
    """A single page extracted from the compiled book."""

    def __init__(self, page_num: int, source_file: str, content: str):
        self.page_num = page_num
        self.source_file = source_file
        self.content = content
        self.sport: str | None = None
        self.data_types: list[str] = []

    def __repr__(self):
        sport_str = self.sport or "UNCLASSIFIED"
        types_str = ", ".join(self.data_types) if self.data_types else "unknown"
        return f"Page {self.page_num} ({self.source_file}): [{sport_str}] {types_str}"


def split_pages(compiled_book_path: Path) -> list[PageSegment]:
    """
    Split a compiled markdown book into individual page segments.

    Uses the <!-- START PAGE N (filename.md) --> markers that the
    transcription pipeline inserts during compilation.
    """
    text = compiled_book_path.read_text(encoding="utf-8")

    # Pattern: <!-- START PAGE N (FILENAME.md) -->
    pattern = re.compile(
        r'<!-- START PAGE (\d+) \(([^)]+)\) -->'
    )

    matches = list(pattern.finditer(text))
    if not matches:
        # Fallback: treat entire file as one page
        return [PageSegment(1, compiled_book_path.stem, text)]

    pages = []
    for i, match in enumerate(matches):
        page_num = int(match.group(1))
        source_file = match.group(2).replace(".md", "")
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        pages.append(PageSegment(page_num, source_file, content))

    return pages


def detect_sport_heading(page_content: str) -> str | None:
    """Detect if the page top lines / headings initiate a sport section."""
    lines = [l.strip() for l in page_content.splitlines() if l.strip() and not l.strip().startswith("*(")]
    if not lines:
        return None

    top_block = "\n".join(lines[:12]).upper()

    # If it is overall standings, it is not a specific sport
    if any(p in top_block for p in OVERALL_PATTERNS):
        return None

    for sport_name, keywords in SPORT_PATTERNS:
        for kw in keywords:
            for line in lines[:8]:
                lu = line.upper()
                if kw in lu:
                    is_heading = (
                        line.startswith("#") or
                        any(term in lu for term in [
                            "TOURNAMENT", "CHAMPIONSHIP", "RESULTS", "DIVISION",
                            "SCHEDULE", "SCOREBOARD", "UAAP"
                        ]) or
                        len(line) < 35
                    )
                    # Don't trigger on venue mentions like "Venue: UST Basketball Gymnasium"
                    if ("GYMNASIUM" in lu or "GYM" in lu) and not any(t in lu for t in ["TOURNAMENT", "CHAMPIONSHIP"]):
                        continue
                    if is_heading:
                        return sport_name
    return None


def classify_page(page: PageSegment) -> PageSegment:
    """Classify data types present on a page."""
    upper_content = page.content.upper()

    for dtype, patterns in DATA_TYPE_PATTERNS:
        for pat in patterns:
            if pat in upper_content:
                if dtype not in page.data_types:
                    page.data_types.append(dtype)
                break

    return page


def split_and_classify(compiled_book_path: Path) -> list[PageSegment]:
    """Split a book into pages, carry forward active sport sections, and classify data types."""
    pages = split_pages(compiled_book_path)
    current_sport: str | None = None

    for page in pages:
        detected = detect_sport_heading(page.content)
        upper = page.content.upper()

        if any(pat in upper for pat in OVERALL_PATTERNS):
            page.sport = "overall"
            current_sport = None
        elif detected:
            current_sport = detected
            page.sport = current_sport
        else:
            page.sport = current_sport

        classify_page(page)

    return pages


def get_pages_for_sport(pages: list[PageSegment], sport: str) -> list[PageSegment]:
    """Filter pages belonging to a specific sport."""
    return [p for p in pages if p.sport == sport]


def get_pages_by_data_type(pages: list[PageSegment], dtype: str) -> list[PageSegment]:
    """Filter pages containing a specific data type."""
    return [p for p in pages if dtype in p.data_types]


def print_classification_summary(pages: list[PageSegment]):
    """Print a summary of page classifications for debugging."""
    sport_counts: dict[str | None, int] = {}
    dtype_counts: dict[str, int] = {}

    for p in pages:
        sport_counts[p.sport] = sport_counts.get(p.sport, 0) + 1
        for dt in p.data_types:
            dtype_counts[dt] = dtype_counts.get(dt, 0) + 1

    print(f"\n  Total pages: {len(pages)}")
    print(f"  By sport:")
    for sport, count in sorted(sport_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"    {sport or 'UNCLASSIFIED':20s} {count} pages")
    print(f"  By data type:")
    for dtype, count in sorted(dtype_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"    {dtype:20s} {count} pages")
