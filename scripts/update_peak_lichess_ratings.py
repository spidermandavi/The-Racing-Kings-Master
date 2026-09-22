#!/usr/bin/env python3
"""Refresh the cached Racing Kings peak-rating leaderboard from Google Sheets.

GitHub Actions reads the public spreadsheet and converts it into a small JSON
snapshot so the public site does not have to contact Google Sheets for every
visitor. The parser deliberately tolerates different column names/orderings
and sheets with a title/header row before the actual data.
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
SHEET_GID = os.environ.get("GOOGLE_SHEET_GID", "0").strip() or "0"
OUTPUT = "json/peak-lichess-ratings.json"
LIMIT = 20
RETRIES = 4
MAX_HEADER_SCAN_ROWS = 12
USER_AGENT = "RacingKingsMaster/2.0 (+https://github.com/spidermandavi/The-Racing-Kings-Master)"

SHEET_URLS = [
    (
        f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export"
        f"?format=csv&gid={SHEET_GID}"
    ),
    (
        f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq"
        f"?tqx=out:csv&gid={SHEET_GID}"
    ),
    f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv",
]

USERNAME_HEADERS = {
    "username",
    "lichessusername",
    "lichessuser",
    "lichessaccount",
    "lichesshandle",
    "lichessid",
    "player",
    "playername",
    "playerusername",
    "name",
    "user",
    "account",
    "handle",
}
PEAK_HEADERS = {
    "peak",
    "peakrating",
    "lichesspeak",
    "lichesspeakrating",
    "highestrating",
    "highest",
    "maxrating",
    "maximumrating",
    "maximum",
    "peaklichessrating",
    "bestrating",
    "best",
}


def normalise_header(value):
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def extract_username(value):
    text = str(value or "").strip()
    if not text:
        return None

    # Accept common Lichess profile forms as well as plain usernames.
    match = re.search(r"lichess\.org/@/([A-Za-z0-9_-]+)", text, re.IGNORECASE)
    if match:
        text = match.group(1)
    else:
        text = text.lstrip("@").strip()

    if not re.fullmatch(r"[A-Za-z0-9_-]{2,32}", text):
        return None

    # Avoid treating ordinary header words as usernames.
    if normalise_header(text) in {
        "username",
        "lichessusername",
        "player",
        "playername",
        "name",
        "user",
        "account",
        "handle",
    }:
        return None

    return text


def parse_rating(value):
    text = str(value or "").strip().replace("\u00a0", " ")
    if not text:
        return None

    # Accept common spreadsheet number formats:
    # 2527, 2,527, 2.527, 2527.5 and 2.527,5.
    compact = re.sub(r"(?<=\d)\s+(?=\d)", "", text)
    match = re.search(r"(?<!\d)\d[\d.,]*(?!\d)", compact)
    if not match:
        return None

    token = match.group(0)
    try:
        if "," in token and "." in token:
            if token.rfind(",") > token.rfind("."):
                normalised = token.replace(".", "").replace(",", ".")
            else:
                normalised = token.replace(",", "")
            rating = float(normalised)
        elif "," in token:
            left, right = token.rsplit(",", 1)
            if len(right) == 3 and len(left) <= 2:
                rating = float(left + right)
            else:
                rating = float(left + "." + right)
        elif "." in token:
            left, right = token.rsplit(".", 1)
            if len(right) == 3 and len(left) <= 2:
                rating = float(left + right)
            else:
                rating = float(left + "." + right)
        else:
            rating = float(token)
    except ValueError:
        return None

    if not 100 <= rating <= 5000:
        return None

    return int(round(rating))
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


def fetch_rows():
    errors = []

    for source_url in SHEET_URLS:
        last_error = None

        for _attempt in range(RETRIES):
            try:
                request = Request(
                    source_url,
                    headers={
                        "User-Agent": USER_AGENT,
                        "Accept": "text/csv,text/plain;q=0.9,*/*;q=0.8",
                    },
                )
                with urlopen(request, timeout=30) as response:
                    raw = response.read().decode("utf-8-sig")

                stripped = raw.lstrip().lower()
                if stripped.startswith("<!doctype html") or stripped.startswith("<html"):
                    raise RuntimeError("Google Sheets returned HTML instead of CSV")

                rows = list(csv.reader(io.StringIO(raw)))
                if rows:
                    return rows, source_url

                raise RuntimeError("Google Sheets returned an empty CSV")
            except HTTPError as exc:
                last_error = exc
                if exc.code not in (429, 500, 502, 503, 504):
                    break
            except (URLError, TimeoutError, RuntimeError) as exc:
                last_error = exc

        errors.append(f"{source_url}: {last_error}")

    raise RuntimeError("Failed to fetch Google Sheet: " + " | ".join(errors))


def detect_layout(rows):
    if not rows:
        raise RuntimeError("Google Sheet returned no rows")

    max_columns = max(len(row) for row in rows)
    scan_limit = min(MAX_HEADER_SCAN_ROWS, len(rows))

    # First prefer an explicit header row anywhere near the top of the sheet.
    for header_row_index in range(scan_limit):
        headers = rows[header_row_index]
        username_index = find_column(headers, USERNAME_HEADERS)
        peak_index = find_column(headers, PEAK_HEADERS)

        if (
            username_index is not None
            and peak_index is not None
            and username_index != peak_index
        ):
            return header_row_index, username_index, peak_index, True

    # Otherwise infer the two useful columns from their actual cell values.
    # This also handles sheets with title rows, translated headers, or no
    # conventional header at all.
    for header_row_index in range(scan_limit):
        data_rows = rows[header_row_index + 1 :] or rows[header_row_index:]
        username_scores = []
        rating_scores = []

        for column_index in range(max_columns):
            username_count = 0
            rating_count = 0

            for row in data_rows:
                if column_index >= len(row):
                    continue
                if extract_username(row[column_index]):
                    username_count += 1
                if parse_rating(row[column_index]) is not None:
                    rating_count += 1

            username_scores.append(username_count)
            rating_scores.append(rating_count)

        if not username_scores or not rating_scores:
            continue

        username_index = max(range(max_columns), key=username_scores.__getitem__)
        rating_candidates = [
            index
            for index, score in enumerate(rating_scores)
            if index != username_index and score > 0
        ]
        if not rating_candidates:
            continue

        peak_index = max(rating_candidates, key=rating_scores.__getitem__)

        if username_scores[username_index] > 0 and rating_scores[peak_index] > 0:
            return (
                header_row_index,
                username_index,
                peak_index,
                False,
            )

    raise RuntimeError(
        "Could not identify Lichess usernames and peak ratings in the sheet"
    )


def parse_rows(rows):
    (
        header_row_index,
        username_index,
        peak_index,
        has_explicit_headers,
    ) = detect_layout(rows)

    data_start = header_row_index + 1 if has_explicit_headers else header_row_index
    records = {}

    for row_number, row in enumerate(rows[data_start:], start=data_start + 1):
        if max(username_index, peak_index) >= len(row):
            continue

        username = extract_username(row[username_index])
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
        key=lambda player: (
            -player["peakRating"],
            player["username"].casefold(),
        ),
    )[:LIMIT]

    if not players:
        raise RuntimeError(
            "No valid Lichess peak-rating records were found "
            f"(detected username column {username_index}, "
            f"rating column {peak_index})"
        )

    for rank, player in enumerate(players, start=1):
        player["rank"] = rank

    return players, {
        "headerRow": header_row_index + 1,
        "usernameColumn": username_index + 1,
        "peakRatingColumn": peak_index + 1,
        "headerDetected": has_explicit_headers,
    }


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
        rows, source_url = fetch_rows()
        players, layout = parse_rows(rows)
    except Exception as exc:
        if existing.get("players"):
            stale = dict(existing)
            stale.update(
                {
                    "updatedAt": now,
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
        "spreadsheetUrl": (
            f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit"
        ),
        "sheetGid": SHEET_GID,
        "sourceUrl": source_url,
        "variant": "Racing Kings",
        "limit": LIMIT,
        "updatedAt": now,
        "lastSuccessfulUpdate": now,
        "health": "healthy",
        "errors": {},
        "layout": layout,
        "players": players,
    }
    write_snapshot(data)


if __name__ == "__main__":
    main()
