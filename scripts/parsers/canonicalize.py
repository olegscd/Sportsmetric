"""
Team Name Canonicalization for UAAP data.

Maps the dozens of inconsistent school name variants found across 1987-2004
annual reports into a single canonical 2-4 letter code.

Usage:
    from scripts.parsers.canonicalize import canonicalize_team, SCHOOL_FULL_NAMES

    canonicalize_team("ATENEO DE MANILA UNIVERSITY")  # -> "ADMU"
    canonicalize_team("A D M U")                       # -> "ADMU"
    canonicalize_team("ATENEO")                         # -> "ADMU"
    SCHOOL_FULL_NAMES["ADMU"]                           # -> "Ateneo de Manila University"

To add a new school (e.g., if UAAP expands):
    1. Add an entry to SCHOOL_ALIASES
    2. Add an entry to SCHOOL_FULL_NAMES
    That's it. All parsers will pick it up automatically.
"""

import re

# Canonical code -> list of known aliases (UPPERCASE for matching)
SCHOOL_ALIASES: dict[str, list[str]] = {
    "ADMU": [
        "ATENEO DE MANILA UNIVERSITY",
        "ATENEO DE MANILA UNIV",
        "ATENEO DE MANILA UNIV.",
        "ATENEO DE MANILA U.",
        "ATENEO DE MANILA",
        "ATENEO",
        "A D M U",
        "ADMU",
    ],
    "DLSU": [
        "DE LA SALLE UNIVERSITY",
        "DE LA SALLE ZOBEL",
        "DE LA SALLE UNIV.",
        "DE LA SALLE UNIV",
        "DE LA SALLE",
        "LA SALLE",
        "D L S U",
        "DLS-Z",
        "DLSZ",
        "DLS-2",
        "DLSU",
    ],
    "UST": [
        "UNIVERSITY OF SANTO TOMAS",
        "UNIVERSITY OF STO. TOMAS",
        "UNIV. OF STO. TOMAS",
        "U. OF STO. TOMAS",
        "UNIVERSITY OF STO TOMAS",
        "U S T",
        "UST",
    ],
    "FEU": [
        "FAR EASTERN UNIVERSITY",
        "FAR EASTERN UNIV.",
        "FAR EASTERN UNIV",
        "F E U",
        "FEU",
    ],
    "UE": [
        "UNIVERSITY OF THE EAST",
        "UNIV. OF THE EAST",
        "U E",
        "U.E.",
        "UE",
    ],
    "UP": [
        "UNIVERSITY OF THE PHILIPPINES",
        "UNIV. OF THE PHILS.",
        "UNIV. OF THE PHILIPPINES",
        "UPIS",
        "U P",
        "U.P.",
        "UP",
    ],
    "NU": [
        "NATIONAL UNIVERSITY",
        "N U",
        "N.U.",
        "NU",
    ],
    "ADU": [
        "ADAMSON UNIVERSITY",
        "ADAMSON UNIV.",
        "ADAMSON UNIV",
        "ADAMSON",
        "AdU",
        "ADU",
    ],
}

# Canonical code -> official full name (for display purposes)
SCHOOL_FULL_NAMES: dict[str, str] = {
    "ADMU": "Ateneo de Manila University",
    "DLSU": "De La Salle University",
    "UST":  "University of Santo Tomas",
    "FEU":  "Far Eastern University",
    "UE":   "University of the East",
    "UP":   "University of the Philippines",
    "NU":   "National University",
    "ADU":  "Adamson University",
}

# Build reverse lookup: uppercase alias -> canonical code
# Sorted by length descending so longer matches take priority
_ALIAS_MAP: dict[str, str] = {}
_SORTED_ALIASES: list[tuple[str, str]] = []

def _build_lookup():
    global _ALIAS_MAP, _SORTED_ALIASES
    pairs = []
    for code, aliases in SCHOOL_ALIASES.items():
        for alias in aliases:
            upper = alias.upper().strip()
            _ALIAS_MAP[upper] = code
            pairs.append((upper, code))
    # Sort by alias length descending -> longest match first
    _SORTED_ALIASES = sorted(pairs, key=lambda x: len(x[0]), reverse=True)

_build_lookup()


def canonicalize_team(name: str) -> str | None:
    """
    Convert any known school name variant to its canonical code.

    Args:
        name: Raw team name string from a markdown page.

    Returns:
        Canonical 2-4 letter code (e.g., "ADMU"), or None if unrecognized.
    """
    if not name:
        return None

    # Clean up the input
    cleaned = name.upper().strip()
    # Remove bold markers, underline tags, asterisks
    cleaned = re.sub(r'\*+', '', cleaned)
    cleaned = re.sub(r'</?[uUbB]>', '', cleaned)
    cleaned = cleaned.strip()

    # Direct match
    if cleaned in _ALIAS_MAP:
        return _ALIAS_MAP[cleaned]

    # Try substring match (for cases like "**UNIVERSITY OF SANTO TOMAS**")
    for alias, code in _SORTED_ALIASES:
        if alias in cleaned:
            return code

    return None


def canonicalize_team_strict(name: str) -> str:
    """
    Like canonicalize_team but raises ValueError if unrecognized.
    Use when you're confident the input should be a valid school name.
    """
    result = canonicalize_team(name)
    if result is None:
        raise ValueError(f"Unrecognized school name: '{name}'")
    return result


def find_teams_in_text(text: str) -> list[str]:
    """
    Find all school canonical codes mentioned in a block of text.
    Returns a list of unique codes in the order they first appear.
    """
    found = []
    seen = set()
    upper = text.upper()
    for alias, code in _SORTED_ALIASES:
        if code not in seen and alias in upper:
            found.append(code)
            seen.add(code)
    return found
