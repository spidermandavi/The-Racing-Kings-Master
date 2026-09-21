#!/usr/bin/env python3
"""Refresh the cached Racing Kings peak-rating leaderboard from Google Sheets.

The source spreadsheet is intentionally read by GitHub Actions and converted
into a small JSON snapshot so the public site does not have to contact Google
Sheets for every visitor.
"""

import csv
import io
import json
import os
import re
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SHEET_ID = "1HFcPCSp_31L8KgwjkNeyHHDwNMJ7gdB_fk6LU1z608o"
SHEET_GID = os.environ.get("GOOGLE_SHEET_GID", "0")
SHEET_URL = (
    f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export"
    f"?format=csv&gid={SHEET_GID}"
)
OUTPUT = "json/peak-lichess-ratings.json"
LIMIT = 20
RETRIES = 4
USER_AGENT = "RacingKingsMaster/2.0 (+https://github.com/spidermandavi/The-Racing-Kings-Master)"

USERNAME_HEADERS = {
    "username",
    "lichessusername",
    "lichessuser",
    "lichessaccount",
    "player",
    "playername",
    "name",
    "user",
    "account",
}
PEAK_HEADERS = {
    "peak",
    "peakrating",
    "lichesspeakrating",
    "highestrating",
    "highestrating",
    "maxrating",
    "maximumrating",
    "peaklichessrating",
}


def normalise_header(value):
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def fetch_csv():
    last_error = None
    for attempt in range(RETRIES):
        try:
            request = Request(
                SHEET_URL,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "text/csv,text/plain;q=0.9,*/*;q=0.8",
                },
            )
            with urlopen(request, timeout=30) as response:
                raw = response.read().decode("utf-8-sig")
            return list(csv.reader(io.StringIO(raw)))
        except HTTPError as exc:
            last_error = exc
            if exc.code not in (429, 500, 502, 503, 504):
                raise
        except (URLError, TimeoutError) as exc:
            last_error = exc

    raise RuntimeError(f"Failed to fetch Google Sheet: {last_error}")


def parse_rating(value):
    text = str(value or "").strip().replace("\u00a0", " ")
    if not text:
        return None
    match = re.search(r"\d[\d,]*(?:\.\d+)?", text)
    if not match:
        return None
    try:
        rating = float(match.group(0).replace(",", ""))
    except ValueError:
        return None
    if not 100 <= rating <= 5000:
        return None
    return int(rating)


def find_column(headers, candidates):
    normalised = [normalise_header(header) for header in headers]

    for candidate in candidates:
        if candidate in normalised:
            return normalised.index(candidate)

    for index, header in enumerate(normalised):
        if not header:
            continue
        if any(candidate in header or header in candidate for candidate in candidates):
            return index

    return None


def parse_rows(rows):
    if not rows:
        raise RuntimeError("Google Sheet returned no rows")

    headers = rows[0]
    username_index = find_column(headers, USERNAME_HEADERS)
    peak_index = find_column(headers, PEAK_HEADERS)

    # Sensible fallback for a simple two-column sheet with a header row.
    if username_index is None and len(headers) >= 1:
        username_index = 0
    if peak_index is None and len(headers) >= 2:
        peak_index = 1

    if username_index is None or peak_index is None:
        raise RuntimeError(
            "Could not identify the Lichess username and peak-rating columns"
        )

    records = {}
    for row_number, row in enumerate(rows[1:], start=2):
        if max(username_index, peak_index) >= len(row):
            continue

        username = str(row[username_index] or "").strip()
        rating = parse_rating(row[peak_index])

        if not username or rating is None:
            continue

        key = username.casefold()
        previous = records.get(key)
        if previous is None or rating > previous["peakRating"]:
            records[key] = {
                "username": username,
                "peakRating": rating,
                "sourceRow": row_number,
            }

    players = sorted(
        records.values(),
        key=lambda player: (-player["peakRating"], player["username"].casefold()),
    )[:LIMIT]

    if not players:
        raise RuntimeError("No valid Lichess peak-rating records were found")

    for rank, player in enumerate(players, start=1):
        player["rank"] = rank

    return players


def load_existing():
    try:
        with open(OUTPUT, encoding="utf-8") as source:
            data = json.load(source)
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def write_snapshot(data):
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as output:
        json.dump(data, output, ensure_ascii=False, indent=2)
        output.write("\n")


def main():
    existing = load_existing()
    now = datetime.now(timezone.utc).isoformat()

    try:
        rows = fetch_csv()
        players = parse_rows(rows)
    except Exception as exc:
        if existing.get("players"):
            stale = dict(existing)
            stale.update(
                {
                    "updatedAt": now,
                    "lastSuccessfulUpdate": existing.get("lastSuccessfulUpdate"),
                    "health": "stale",
                    "errors": {"refresh": str(exc)},
                }
            )
            write_snapshot(stale)
            raise RuntimeError(
                "Peak-rating refresh failed; previous snapshot preserved"
            ) from exc
        raise

    data = {
        "source": "Google Sheets",
        "spreadsheetId": SHEET_ID,
        "spreadsheetUrl": f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit",
        "sheetGid": SHEET_GID,
        "sourceUrl": SHEET_URL,
        "variant": "Racing Kings",
        "limit": LIMIT,
        "updatedAt": now,
        "lastSuccessfulUpdate": now,
        "health": "healthy",
        "errors": {},
        "players": players,
    }
    write_snapshot(data)


if __name__ == "__main__":
    main()
