#!/usr/bin/env python3
"""Build the static Racing Kings tournament leaderboard snapshot.

The public Lichess tournament-history and shield pages are HTML-only and do not
send browser CORS headers. This script runs server-side in GitHub Actions, so
leaderboard.html can consume the resulting JSON from GitHub Pages.

The snapshot contains:
  - Thijs' historical Racing Kings rankings (points/high score/events/trophies)
  - daily/weekly/monthly/yearly Racing Kings tournament winners
  - aggregated most-wins data
  - Racing Kings shield winners

All Lichess HTML requests identify themselves with a User-Agent and use a small
worker pool plus retry/backoff to avoid hammering the service.
"""

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html import unescape
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE = "https://lichess.thijs.com/rankings/racingkings/all/"
VIEWS = {
    "points": "list_players_points.html",
    "maximum": "list_players_maximum.html",
    "events": "list_players_events.html",
    "trophies": "list_players_trophies.html",
}

HISTORY_URL = "https://lichess.org/tournament/history/{freq}?page={page}"
SHIELD_URL = "https://lichess.org/tournament/shields/racingKings"

PAGES = {
    "daily": 20,
    "weekly": 20,
    "monthly": 25,
    "yearly": 30,
}

USER_AGENT = "RacingKingsMaster/1.0"
MAX_WORKERS = 8
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
            retry_after = exc.headers.get("Retry-After")
            delay = int(retry_after) if retry_after and retry_after.isdigit() else 2 ** attempt
            time.sleep(min(delay, 20))
        except (URLError, TimeoutError) as exc:
            last_error = exc
            time.sleep(min(2 ** attempt, 20))
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def clean_html_text(value):
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", unescape(value)).strip()


def parse_thijs_table(html, view):
    """Parse a Thijs player table while using the page's actual column labels."""
    table_match = re.search(r"<table[^>]*>([\s\S]*?)</table>", html, re.I)
    if not table_match:
        return []

    table = table_match.group(1)
    header_match = re.search(r"<tr[^>]*>([\s\S]*?)</tr>", table, re.I)
    headers = []
    if header_match:
        headers = [clean_html_text(x).lower() for x in re.findall(r"<(?:th|td)[^>]*>([\s\S]*?)</(?:th|td)>", header_match.group(1), re.I)]

    rows = []
    for raw_row in re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", table, re.I)[1:]:
        cells = re.findall(r"<(?:td|th)[^>]*>([\s\S]*?)</(?:td|th)>", raw_row, re.I)
        text = [clean_html_text(cell) for cell in cells]
        if len(text) < 2 or not re.match(r"^\d+\.?$", text[0]):
            continue

        user_match = re.search(r'href=["\']/@/([^"\'?]+)', raw_row, re.I)
        username = unescape(user_match.group(1)) if user_match else None
        if not username:
            # Fallback for markup changes: the second cell is normally username.
            candidate = text[1] if len(text) > 1 else ""
            if re.fullmatch(r"[A-Za-z0-9_\-]{2,40}", candidate):
                username = candidate
        if not username:
            continue

        primary = None
        meta = ""

        # Prefer semantic header matching, because column positions differ by view.
        for index, header in enumerate(headers):
            if index >= len(text):
                continue
            cell = text[index]
            if view == "points" and "points" in header:
                number = re.search(r"[\d,]+(?:\.\d+)?", cell)
                if number:
                    primary = float(number.group(0).replace(",", ""))
                    meta = cell
                    break
            elif view == "events" and header.strip() == "events":
                number = re.search(r"[\d,]+", cell)
                if number:
                    primary = int(number.group(0).replace(",", ""))
                    break
            elif view == "maximum" and (header == "max" or "high score" in header):
                number = re.search(r"[\d,]+", cell)
                if number:
                    primary = int(number.group(0).replace(",", ""))
                    break
            elif view == "trophies" and "troph" in header:
                number = re.search(r"[\d,]+", cell)
                if number:
                    primary = int(number.group(0).replace(",", ""))
                    break

        if primary is None:
            # Conservative fallbacks for known Thijs layouts.
            numeric = [re.sub(r"[^\d.]", "", value) for value in text if re.search(r"\d", value)]
            numeric = [value for value in numeric if value]
            if numeric:
                if view == "maximum":
                    primary = int(float(numeric[-1]))
                elif view == "points":
                    points_cell = next((value for value in text if "/" in value and re.search(r"\d", value)), "")
                    match = re.search(r"[\d,]+", points_cell)
                    primary = int(match.group(0).replace(",", "")) if match else int(float(numeric[-1]))
                elif view == "events":
                    points_cell = next((value for value in text if "/" in value and re.search(r"\d", value)), "")
                    match = re.search(r"/\s*([\d,]+)", points_cell)
                    primary = int(match.group(1).replace(",", "")) if match else int(float(numeric[-1]))
                else:
                    primary = int(float(numeric[-1]))

        if primary is not None:
            rows.append({"username": username, "primary": primary, "meta": meta})

    return rows


def fetch_thijs_view(view, filename):
    return parse_thijs_table(fetch(BASE + filename), view)


def parse_tournament_rows(html):
    rows = []
    tr_re = re.compile(r'<tr class="paginated">([\s\S]*?)</tr>', re.I)
    for row in tr_re.findall(html):
        if not re.search(r"•\s*Racing Kings\s*•", row, re.I):
            continue

        tournament_id = re.search(r'href=["\']/tournament/([A-Za-z0-9]+)', row, re.I)
        name = re.search(r'<span class="name">([^<]+)</span>', row, re.I)
        dt = re.search(r'datetime=["\']([^"\']+)', row, re.I)
        user = re.search(r'<a[^>]*class=["\'][^"\']*user-link[^"\']*["\'][^>]*href=["\']/@/([^"\']+)["\'][^>]*>([\s\S]*?)</a>', row, re.I)
        players = re.search(r'<span>([\d,]+)\s*players?</span>', row, re.I)

        if not tournament_id or not name or not dt or not user:
            continue

        winner_html = user.group(2)
        title_match = re.search(r'<span class="utitle"[^>]*>([^<]+)</span>', winner_html, re.I)
        winner = {
            "name": unescape(user.group(1)),
            "title": clean_html_text(title_match.group(1)) if title_match else None,
        }

        try:
            finishes_at = datetime.fromisoformat(dt.group(1).replace("Z", "+00:00")).timestamp() * 1000
        except ValueError:
            finishes_at = 0

        rows.append({
            "id": tournament_id.group(1),
            "fullName": clean_html_text(name.group(1)),
            "finishesAt": int(finishes_at),
            "nbPlayers": int(players.group(1).replace(",", "")) if players else 0,
            "winner": winner,
        })
    return rows


def fetch_history_page(freq, page):
    return parse_tournament_rows(fetch(HISTORY_URL.format(freq=freq, page=page)))


def collect_history():
    result = {freq: [] for freq in PAGES}
    jobs = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for freq, count in PAGES.items():
            for page in range(1, count + 1):
                jobs[executor.submit(fetch_history_page, freq, page)] = (freq, page)

        for future in as_completed(jobs):
            freq, page = jobs[future]
            try:
                result[freq].extend(future.result())
            except Exception as exc:
                print(f"Warning: failed {freq} page {page}: {exc}")

    for freq in result:
        deduped = {row["id"]: row for row in result[freq] if row.get("id")}
        result[freq] = sorted(deduped.values(), key=lambda row: row.get("finishesAt", 0), reverse=True)

    return result


def aggregate_wins(tournaments):
    totals = {}
    for row in tournaments:
        winner = row.get("winner") or {}
        name = winner.get("name")
        if not name:
            continue
        key = name.casefold()
        item = totals.setdefault(key, {
            "username": name,
            "wins": 0,
            "firstWin": row.get("finishesAt", 0),
            "lastWin": row.get("finishesAt", 0),
        })
        item["wins"] += 1
        item["firstWin"] = min(item["firstWin"], row.get("finishesAt", 0))
        item["lastWin"] = max(item["lastWin"], row.get("finishesAt", 0))
    return sorted(totals.values(), key=lambda x: (-x["wins"], -x["lastWin"], x["username"].casefold()))


def parse_shields(html):
    heading = re.search(r"Tournament shields", html, re.I)
    if not heading:
        return []
    tail = html[heading.end():]
    ordered = re.search(r"<ol[^>]*>([\s\S]*?)</ol>", tail, re.I)
    if not ordered:
        return []

    items = []
    for li in re.findall(r"<li>([\s\S]*?)</li>", ordered.group(1), re.I):
        user = re.search(r'<a[^>]*class=["\'][^"\']*user-link[^"\']*["\'][^>]*href=["\']/@/([^"\']+)["\'][^>]*>([\s\S]*?)</a>', li, re.I)
        tour = re.search(r'href=["\']/tournament/([A-Za-z0-9]+)["\'][^>]*>([^<]+)', li, re.I)
        if not user or not tour:
            continue
        title_match = re.search(r'<span class="utitle"[^>]*>([^<]+)</span>', user.group(2), re.I)
        try:
            finishes_at = datetime.fromisoformat(clean_html_text(tour.group(2)).replace("Z", "+00:00")).timestamp() * 1000
        except ValueError:
            finishes_at = 0
        items.append({
            "id": tour.group(1),
            "name": unescape(user.group(1)),
            "title": clean_html_text(title_match.group(1)) if title_match else None,
            "finishesAt": int(finishes_at),
        })
    return items


def aggregate_shields(items):
    totals = {}
    for item in items:
        name = item.get("name")
        if not name:
            continue
        key = name.casefold()
        entry = totals.setdefault(key, {"username": name, "trophies": 0})
        entry["trophies"] += 1
    return sorted(totals.values(), key=lambda x: (-x["trophies"], x["username"].casefold()))


def main():
    data = {
        "source": "https://lichess.org",
        "thijsSource": "https://lichess.thijs.com",
        "variant": "Racing Kings",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "views": {},
        "tournaments": {},
        "shields": [],
        "mostWins": [],
        "errors": {},
    }

    for view, filename in VIEWS.items():
        try:
            data["views"][view] = fetch_thijs_view(view, filename)
        except Exception as exc:
            data["views"][view] = []
            data["errors"][f"thijs:{view}"] = str(exc)

    try:
        history = collect_history()
        data["tournaments"] = history
        all_tournaments = []
        for rows in history.values():
            all_tournaments.extend(rows)
        data["mostWins"] = aggregate_wins(all_tournaments)
    except Exception as exc:
        data["errors"]["tournaments"] = str(exc)

    try:
        data["shields"] = parse_shields(fetch(SHIELD_URL))
        data["shieldTotals"] = aggregate_shields(data["shields"])
    except Exception as exc:
        data["errors"]["shields"] = str(exc)
        data["shieldTotals"] = []

    with open("json/thijs-leaderboards.json", "w", encoding="utf-8") as output:
        json.dump(data, output, ensure_ascii=False, indent=2)

    print(json.dumps({
        "updatedAt": data["updatedAt"],
        "views": {key: len(value) for key, value in data["views"].items()},
        "tournaments": {key: len(value) for key, value in data["tournaments"].items()},
        "mostWins": len(data["mostWins"]),
        "shields": len(data["shields"]),
        "errors": data["errors"],
    }, indent=2))


if __name__ == "__main__":
    main()
