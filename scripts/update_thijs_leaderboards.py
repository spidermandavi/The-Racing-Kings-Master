#!/usr/bin/env python3
"""Build a resilient static Racing Kings leaderboard snapshot from lichess.thijs.com.

The source pages do not all have the same number/order of columns, so metrics are
identified from table headers instead of hard-coded cell positions. Failed refreshes
never erase the last successfully saved leaderboard.
"""

import json
import re
import time
from datetime import datetime, timezone
from html import unescape
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SOURCES = {
    "points": "https://lichess.thijs.com/rankings/racingkings/all/list_players_points.html",
    "maximum": "https://lichess.thijs.com/rankings/racingkings/all/list_players_maximum.html",
    "events": "https://lichess.thijs.com/rankings/racingkings/all/list_players_events.html",
    "trophies": "https://lichess.thijs.com/rankings/racingkings/shield/list_players_trophies.html",
}

# Header names vary slightly between pages. These are matched after lower-casing
# and removing punctuation/extra spaces.
HEADER_ALIASES = {
    "points": ("total points", "points", "point"),
    "maximum": ("maximum", "max", "highest score", "best score"),
    "events": ("total events", "events", "event", "tournaments", "tournament"),
    "trophies": ("trophies", "trophy", "shield trophies", "shields", "shield wins"),
}
NAME_ALIASES = ("player", "name", "username", "user")
RANK_ALIASES = ("rank", "#", "no", "number", "place")
USER_AGENT = "RacingKingsMaster/2.0 (+https://github.com/spidermandavi/The-Racing-Kings-Master)"
RETRIES = 4


def fetch(url):
    last_error = None
    for attempt in range(RETRIES):
        try:
            req = Request(url, headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
            })
            with urlopen(req, timeout=30) as response:
                return response.read().decode("utf-8", "replace")
        except HTTPError as exc:
            last_error = exc
            if exc.code != 429 and exc.code < 500:
                raise
            time.sleep(min(2 ** attempt, 20))
        except (URLError, TimeoutError) as exc:
            last_error = exc
            time.sleep(min(2 ** attempt, 20))
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def clean(value):
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", unescape(value)).strip()


def header_key(value):
    return re.sub(r"[^a-z0-9]+", " ", clean(value).lower()).strip()


def parse_number(value):
    text = clean(value).replace("\u00a0", " ")
    match = re.search(r"-?\d[\d,.\s]*", text)
    if not match:
        return None
    token = match.group(0).replace(" ", "")
    # Treat comma as decimal only when there is no dot and exactly 1-2 digits follow it.
    if token.count(",") == 1 and "." not in token and re.search(r",\d{1,2}$", token):
        token = token.replace(",", ".")
    else:
        token = token.replace(",", "")
    try:
        number = float(token)
        return int(number) if number.is_integer() else number
    except ValueError:
        return None


def split_cells(raw_row):
    return re.findall(r"<(td|th)\b[^>]*>([\s\S]*?)</\1>", raw_row, re.I)


def username_from_name_cell(cell):
    patterns = (
        r'href=["\'][^"\']*lichess\.org/@/([^"\'?/#<]+)',
        r'href=["\'][^"\']*/@/([^"\'?/#<]+)',
        r'href=["\'][^"\']*player/([^"\'?/#<]+)',
    )
    for pattern in patterns:
        match = re.search(pattern, cell, re.I)
        if match:
            return unescape(match.group(1)).strip()
    value = clean(cell)
    value = re.sub(r"\b(?:GM|IM|FM|CM|NM|WGM|WIM|WFM|WCM)\b", "", value).strip()
    return value or None


def find_index(headers, aliases):
    for index, header in enumerate(headers):
        for alias in aliases:
            if header == alias or alias in header:
                return index
    return None


def parse_table(html, metric):
    tables = re.findall(r"<table\b[^>]*>([\s\S]*?)</table>", html, re.I)
    if not tables:
        raise RuntimeError(f"No table found for {metric}")

    best_rows = []
    for table in tables:
        raw_rows = re.findall(r"<tr\b[^>]*>([\s\S]*?)</tr>", table, re.I)
        parsed_rows = [split_cells(row) for row in raw_rows]
        parsed_rows = [row for row in parsed_rows if row]
        if len(parsed_rows) < 2:
            continue

        header_row = next((row for row in parsed_rows if any(kind.lower() == "th" for kind, _ in row)), parsed_rows[0])
        headers = [header_key(cell) for _, cell in header_row]
        metric_index = find_index(headers, HEADER_ALIASES[metric])
        name_index = find_index(headers, NAME_ALIASES)
        rank_index = find_index(headers, RANK_ALIASES)

        # Some Thijs tables omit semantic headers. Use safe per-page fallbacks only
        # after checking that the row actually contains the expected column.
        if name_index is None:
            name_index = 1 if len(headers) > 1 else 0
        if metric_index is None:
            fallback = {"points": 5, "maximum": 9, "events": 6, "trophies": 2}[metric]
            metric_index = fallback if len(headers) > fallback else None
        if metric_index is None:
            continue

        rows = []
        for row in parsed_rows:
            if row is header_row:
                continue
            cells = [cell for _, cell in row]
            if len(cells) <= max(name_index, metric_index):
                continue
            username = username_from_name_cell(cells[name_index])
            value = parse_number(cells[metric_index])
            if not username or value is None:
                continue
            rank = parse_number(cells[rank_index]) if rank_index is not None and len(cells) > rank_index else None
            rows.append({
                "username": username,
                "primary": value,
                "metric": metric,
                "rank": int(rank) if isinstance(rank, (int, float)) else len(rows) + 1,
                "meta": "",
            })

        if len(rows) > len(best_rows):
            best_rows = rows

    if not best_rows:
        raise RuntimeError(f"No player rows parsed for {metric}")
    return best_rows


def load_existing():
    try:
        with open("json/thijs-leaderboards.json", encoding="utf-8") as source:
            existing = json.load(source)
        return existing if isinstance(existing, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def main():
    existing = load_existing()
    previous_views = existing.get("views") if isinstance(existing.get("views"), dict) else {}
    views = dict(previous_views)
    errors = {}
    successful = []

    for metric, url in SOURCES.items():
        try:
            rows = parse_table(fetch(url), metric)
            views[metric] = rows
            successful.append(metric)
        except Exception as exc:
            errors[metric] = str(exc)
            # Keep the previous non-empty data instead of replacing it with [].
            if not isinstance(views.get(metric), list):
                views[metric] = []

    now = datetime.now(timezone.utc).isoformat()
    data = {
        "thijsSource": "https://lichess.thijs.com",
        "variant": "Racing Kings",
        "updatedAt": now,
        "lastSuccessfulUpdate": now if successful else existing.get("lastSuccessfulUpdate"),
        "successfulMetrics": successful,
        "views": views,
        "errors": errors,
    }

    with open("json/thijs-leaderboards.json", "w", encoding="utf-8") as output:
        json.dump(data, output, ensure_ascii=False, indent=2)

    if not successful:
        raise RuntimeError("No tournament leaderboard could be refreshed; previous snapshot was preserved")


if __name__ == "__main__":
    main()
