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

# Zero-based positions in the logical table after splitting every row into cells:
# ranking, name, 1st, 2nd, 3rd, total points, total events, dates, average, max.
METRIC_COLUMNS = {"points": 5, "maximum": 9, "events": 6, "trophies": 2}
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
    match = re.search(r"-?\d+(?:[,.]\d+)?", clean(value))
    if not match:
        return None
    number = match.group(0).replace(",", "")
    return float(number) if "." in number else int(number)


def split_cells(raw_row):
    return re.findall(r"<(?:td|th)\b[^>]*>([\s\S]*?)</(?:td|th)>", raw_row, re.I)


def username_from_name_cell(cell):
    # The title is often a separate span/link inside the name cell. Prefer the
    # Lichess profile href, whose path contains the real username.
    match = re.search(r'href=["\'][^"\']*(?:lichess\.org)?/?@/([^"\'?/#<]+)', cell, re.I)
    if match:
        return unescape(match.group(1)).strip()

    # Fallback: remove known title spans, then use remaining visible text.
    without_titles = re.sub(r"<(?:span|a)\b[^>]*class=[\"'][^\"']*(?:title|utitle)[^\"']*[\"'][^>]*>[\s\S]*?</(?:span|a)>", "", cell, flags=re.I)
    value = clean(without_titles)
    return value if value and value.upper() not in {"GM", "IM", "FM", "CM", "NM", "WGM", "WIM", "WFM", "WCM"} else None


def parse_table(html, metric):
    table_match = re.search(r"<table\b[^>]*>([\s\S]*?)</table>", html, re.I)
    if not table_match:
        raise RuntimeError(f"No table found for {metric}")

    target_column = METRIC_COLUMNS[metric]
    rows = []
    for raw_row in re.findall(r"<tr\b[^>]*>([\s\S]*?)</tr>", table_match.group(1), re.I):
        cells = split_cells(raw_row)
        if len(cells) < 10:
            continue
        texts = [clean(cell) for cell in cells]
        if not re.fullmatch(r"\d+\.?", texts[0]):
            continue

        username = username_from_name_cell(cells[1])
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


if __name__ == "__main__":
    main()
