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
    """Extract the actual numeric value, never a title such as GM/FM/NM."""
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

    table = table_match.group(1)
    raw_rows = re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", table, re.I)
    rows = []

    for raw_row in raw_rows:
        cells = re.findall(r"<(?:td|th)[^>]*>([\s\S]*?)</(?:td|th)>", raw_row, re.I)
        if not cells:
            continue

        texts = [clean(cell) for cell in cells]
        rank_index = next((i for i, text in enumerate(texts) if re.fullmatch(r"\d+\.?", text)), None)
        if rank_index is None:
            continue

        # Username comes from the actual player link, not from surrounding title text.
        user_match = re.search(r'href=["\'][^"\']*/@/([^"\'?/#]+)', raw_row, re.I)
        if not user_match:
            user_match = re.search(r'href=["\']player/([^"\'?/#]+)', raw_row, re.I)
        if not user_match:
            continue
        username = unescape(user_match.group(1)).strip()

        # Find the LAST numeric data cell after the player information. This avoids
        # treating rank or title cells as the score. Thijs ranking tables place the
        # requested metric in the final data column.
        value = None
        value_index = None
        for index in range(len(cells) - 1, rank_index, -1):
            candidate = parse_number(cells[index])
            if candidate is not None:
                value = candidate
                value_index = index
                break

        if value is None:
            continue

        rows.append({
            "username": username,
            "primary": value,
            "metric": metric,
            "rank": int(texts[rank_index].rstrip(".")),
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
