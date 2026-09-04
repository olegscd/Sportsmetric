# UAAP Statistics Parsers Package
"""
Modular parser system for extracting structured data from UAAP Annual Report
markdown files. Each sport has its own parser module. All parsers emit
canonical JSON-compatible dicts using standardized team codes.

Adding a new sport:
  1. Create {sport}_parser.py in this directory
  2. Implement parse(pages, season) -> dict
  3. Register it in SPORT_PARSERS below

Adding a new season:
  - No code changes needed. Just run extract_statistics.py --season YYYY-YYYY
"""

SPORT_PARSERS = {}

def register_parser(sport_name):
    """Decorator to register a sport parser."""
    def wrapper(cls):
        SPORT_PARSERS[sport_name] = cls
        return cls
    return wrapper
