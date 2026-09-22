#!/usr/bin/env python3
"""Refresh the cached Lichess team snapshot used by the public team page."""

import json
import os
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

TEAM_ID = "the-racing-kings-master"
TEAM_URL = "https://lichess.org/team/" + TEAM_ID
TEAM_API = "https://lichess.org/api/team/" + TEAM_ID
MEMBERS_API = TEAM_API + "/users"
OUTPUT = "json/lichess-team.json"
RETRIES = 5
USER_AGENT = (
    "RacingKingsMaster/2.0 "
    "(+https://github.com/spidermandavi/The-Racing-Kings-Master)"
)


def fetch_text(url, accept):
    last_error = None

    for attempt in range(RETRIES):
        try:
            request = Request(
                url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": accept,
                },
            )

            with urlopen(request, timeout=45) as response:
                return response.read().decode("utf-8")

        except HTTPError as exc:
            last_error = exc
            if exc.code not in (429, 500, 502, 503, 504):
                raise
        except (URLError, TimeoutError) as exc:
            last_error = exc

        time.sleep(min(2 ** attempt, 20))

    raise RuntimeError("Failed to fetch " + url + ": " + str(last_error))


def fetch_json(url):
    payload = fetch_text(url, "application/json")
    data = json.loads(payload)

    if not isinstance(data, dict):
        raise RuntimeError("Expected a JSON object from " + url)

    return data


def fetch_members():
    payload = fetch_text(MEMBERS_API, "application/x-ndjson, application/json")
    payload = payload.strip()

    if not payload:
        return []

    # Be tolerant if the endpoint or a proxy returns a JSON array/object.
    try:
        decoded = json.loads(payload)
        if isinstance(decoded, list):
            return [item for item in decoded if isinstance(item, dict)]
        if isinstance(decoded, dict):
            return [decoded]
    except json.JSONDecodeError:
        pass

    members = []
    for line in payload.splitlines():
        line = line.strip()
        if not line:
            continue

        try:
            item = json.loads(line)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Invalid NDJSON member response") from exc

        if isinstance(item, dict):
            members.append(item)

    return members


def normalise_leaders(team):
    raw = team.get("leaders")

    if raw is None:
        raw = team.get("leader")

    if raw is None:
        return []

    if not isinstance(raw, list):
        raw = [raw]

    names = []
    for leader in raw:
        if isinstance(leader, str):
            name = leader
        elif isinstance(leader, dict):
            name = leader.get("username") or leader.get("id")
        else:
            name = None

        if name:
            names.append(str(name))

    return list(dict.fromkeys(names))


def normalise_member(user):
    username = user.get("username") or user.get("id")
    if not username:
        return None

    perfs = user.get("perfs") or {}
    racing_kings = perfs.get("racingKings") or {}

    return {
        "id": user.get("id") or username,
        "username": username,
        "title": user.get("title"),
        "perfs": {
            "racingKings": {
                "rating": racing_kings.get("rating"),
            }
        },
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

    temporary = OUTPUT + ".tmp"
    with open(temporary, "w", encoding="utf-8") as output:
        json.dump(data, output, ensure_ascii=False, indent=2)
        output.write("\n")

    os.replace(temporary, OUTPUT)


def main():
    existing = load_existing()
    now = datetime.now(timezone.utc).isoformat()

    try:
        team = fetch_json(TEAM_API)
        raw_members = fetch_members()

        members = []
        seen = set()

        for user in raw_members:
            member = normalise_member(user)
            if not member:
                continue

            key = str(member["username"]).casefold()
            if key in seen:
                continue

            seen.add(key)
            members.append(member)

        data = {
            "source": "Lichess API",
            "teamId": TEAM_ID,
            "teamUrl": TEAM_URL,
            "variant": "Racing Kings",
            "updatedAt": now,
            "lastSuccessfulUpdate": now,
            "health": "healthy",
            "errors": {},
            "team": {
                "id": team.get("id") or TEAM_ID,
                "name": team.get("name") or "The Racing Kings Master",
                "description": team.get("description") or "",
                "leaders": normalise_leaders(team),
            },
            "memberCount": len(members),
            "members": members,
        }

        write_snapshot(data)
        print(
            "Lichess team snapshot refreshed: "
            + str(len(members))
            + " members."
        )

    except Exception:
        if existing:
            # Keep the last known-good snapshot intact. A failed hourly refresh
            # must never replace working public data with an empty response.
            raise
        raise


if __name__ == "__main__":
    main()
