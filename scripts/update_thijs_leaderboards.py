#!/usr/bin/env python3
"""Build the static Racing Kings leaderboard snapshot from the exact Thijs pages."""

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

# Exact zero-based column indexes from the table structure supplied for this site:
# 0 ranking, 1 name, 2 first places, 3 second places, 4 third places,
# 5 total points, 6 total events, 7 first/last date, 8 average score, 9 max score.
METRIC_COLUMNS = {
    "points": 5,
    "maximum": 9,
    "events": 6,
    # The shield leaderboard's requested value is the amount of 1st places.
    "trophies": 2,
}

USER_AGENT = "RacingKingsMaster/1.0"
RETRIES = 4


def fetch(url):
    last_error = None
    for attempt in range(RETRIES):
        try:
            req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
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


def parse_number(value):
    value = clean(value)
    match = re.search(r"-?\d+(?:[,.]\d+)?", value)
    if not match:
        return None
    number = match.group(0).replace(",", "")
    return float(number) if "." in number else int(number)


def parse_table(html, metric):
    table_match = re.search(r"<table[^>]*>([\s\S]*?)</table>", html, re.I)
    if not table_match:
        raise RuntimeError(f"No table found for {metric}")

    target_column = METRIC_COLUMNS[metric]
    table = table_match.group(1)
    raw_rows = re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", table, re.I)
    rows = []

    for raw_row in raw_rows:
        cells = re.findall(r"<(?:td|th)[^>]*>([\s\S]*?)</(?:td|th)>", raw_row, re.I)
        if len(cells) <= target_column:
            continue

        texts = [clean(cell) for cell in cells]
        # Data rows always start with the ranking; skip the header safely.
        if not re.fullmatch(r"\d+\.?", texts[0]):
            continue

        # The player name is the second column. Extracting its visible text keeps
        # titles such as GM/FM/NM out of the username even if they are nested in HTML.
        username = texts[1]
        if not username:
            continue

        value = parse_number(cells[target_column])
        if value is None:
            continue

        rows.append({
            "username": username,
            "primary": value,
            "metric": metric,
            "rank": int(texts[0].rstrip(".")),
            "meta": "",
        })

    if not rows:
        raise RuntimeError(f"No player rows parsed for {metric}")
    return rows


def main():
    data = {
        "thijsSource": "https://lichess.thijs.com",
        "variant": "Racing Kings",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "views": {},
        "errors": {},
    }

    for metric, url in SOURCES.items():
        try:
            data["views"][metric] = parse_table(fetch(url), metric)
        except Exception as exc:
            data["views"][metric] = []
            data["errors"][metric] = str(exc)

    with open("json/thijs-leaderboards.json", "w", encoding="utf-8") as output:
        json.dump(data, output, ensure_ascii=False, indent=2)

    print(json.dumps({
        "updatedAt": data["updatedAt"],
        "counts": {key: len(value) for key, value in data["views"].items()},
        "errors": data["errors"],
    }, indent=2))


if __name__ == "__main__":
    main()
