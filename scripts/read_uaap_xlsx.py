"""Reads season stats xlsx and writes JSON rows to stdout or an output file."""
import json
import sys

import pandas as pd


def main() -> None:
    path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else None
    df = pd.read_excel(path).fillna("")
    rows = [{str(k): str(v) for k, v in row.items()} for _, row in df.iterrows()]
    payload = json.dumps(rows)
    if out_path:
        with open(out_path, "w", encoding="utf8") as f:
            f.write(payload)
    else:
        print(payload)


if __name__ == "__main__":
    main()
