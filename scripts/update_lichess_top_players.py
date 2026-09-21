#!/usr/bin/env python3
"""Refresh the cached top Racing Kings players from Lichess.

The Players page reads this snapshot instead of requesting the Lichess top
leaderboard on every page load. The scheduled GitHub Actions workflow refreshes
it hourly. Individual Racing Kings performance stats are fetched with a modest
delay to respect the public API rate limit.
"""

import json
import os
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

TOP_URL = "https://lichess.org/api/player/top/20/racingKings"
PERF_URL = "https://lichess.org/api/user/{username}/perf/racingKings"
OUTPUT = "json/lichess-top-players.json"
LIMIT = 20
RETRIES = 4
REQUEST_DELAY = 1.1
USER_AGENT = "RacingKingsMaster/2.0 (+https://github.com/spidermandavi/The-Racing-Kings-Master)"


def fetch_json(url):
    last_error = None
    for attempt in range(RETRIES):
        try:
            request = Request(
                url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json",
                },
            )
            with urlopen(request, timeout=30) as response:
                return json.load(response)
        except HTTPError as exc:
            last_error = exc
            if exc.code not in (429, 500, 502, 503, 504):
                raise
            time.sleep(min(2 ** attempt, 20))
        except (URLError, TimeoutError) as exc:
            last_error = exc
            time.sleep(min(2 ** attempt, 20))
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def load_existing():
    try:
        with open(OUTPUT, encoding="utf-8") as source:
            data = json.load(source)
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def normalise_player(user, rank, perf_stats=None, previous=None):
    racing_kings = user.get("perfs", {}).get("racingKings") or {}
    previous = previous if isinstance(previous, dict) else {}
    previous_count = previous.get("rkPerfCount") or {}

    count = (perf_stats or {}).get("stat", {}).get("count") or {}
    highest = (perf_stats or {}).get("stat", {}).get("highest") or {}

    games = count.get("all")
    wins = count.get("win")
    highest_rating = highest.get("int")

    if games is None:
        games = previous_count.get("all")
    if wins is None:
        wins = previous_count.get("win")
    if highest_rating is None:
        highest_rating = previous.get("rkHighestRating")

    win_rate = None
    if isinstance(games, (int, float)) and games > 0 and isinstance(wins, (int, float)):
        win_rate = round((wins / games) * 100, 2)

    return {
        "id": user.get("id") or user.get("username"),
        "username": user.get("username") or user.get("id"),
        "title": user.get("title"),
        "perfs": {
            "racingKings": {
                "rating": racing_kings.get("rating"),
                "games": games,
            }
        },
        "rkPerfCount": {
            "all": games,
            "win": wins,
        },
        "rkHighestRating": highest_rating,
        "winRate": win_rate,
        "rank": rank,
    }


def main():
    existing = load_existing()
    previous_players = {
        str(player.get("username", "")).lower(): player
        for player in existing.get("players", [])
        if isinstance(player, dict) and player.get("username")
    }

    errors = {}
    now = datetime.now(timezone.utc).isoformat()

    try:
        payload = fetch_json(TOP_URL)
    except Exception as exc:
        errors["top"] = str(exc)
        if existing.get("players"):
            data = dict(existing)
            data.update({
                "updatedAt": now,
                "lastSuccessfulUpdate": existing.get("lastSuccessfulUpdate"),
                "errors": errors,
                "health": "stale",
            })
            with open(OUTPUT, "w", encoding="utf-8") as output:
                json.dump(data, output, ensure_ascii=False, indent=2)
            raise RuntimeError("Top Racing Kings leaderboard refresh failed; previous snapshot preserved")
        raise

    users = payload.get("users") or []
    if len(users) < LIMIT:
        raise RuntimeError(f"Lichess returned only {len(users)} top players; expected {LIMIT}")

    players = []
    for rank, user in enumerate(users[:LIMIT], start=1):
        username = user.get("username") or user.get("id")
        if not username:
            errors[f"player_{rank}"] = "Missing username in Lichess top-player response"
            continue

        perf_stats = None
        try:
            time.sleep(REQUEST_DELAY if rank > 1 else 0)
            perf_stats = fetch_json(PERF_URL.format(username=username))
        except Exception as exc:
            errors[username] = str(exc)

        players.append(
            normalise_player(
                user,
                rank,
                perf_stats=perf_stats,
                previous=previous_players.get(username.lower()),
            )
        )

    if len(players) != LIMIT:
        raise RuntimeError(f"Only {len(players)} valid top players could be stored; expected {LIMIT}")

    data = {
        "source": "https://lichess.org",
        "endpoint": TOP_URL,
        "variant": "Racing Kings",
        "limit": LIMIT,
        "updatedAt": now,
        "lastSuccessfulUpdate": now if not errors else existing.get("lastSuccessfulUpdate"),
        "health": "healthy" if not errors else "partial",
        "errors": errors,
        "players": players,
    }

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as output:
        json.dump(data, output, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
