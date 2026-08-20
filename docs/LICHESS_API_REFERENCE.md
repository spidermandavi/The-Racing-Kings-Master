# Lichess API Reference for The Racing Kings Master

A practical reference of Lichess HTTP API endpoints that are potentially useful for this project. This is not intended to duplicate every Lichess endpoint. It prioritizes features useful for Racing Kings profiles, leaderboards, title applications/checkers, tournament verification, statistics, tools, and future site features.

Official documentation: https://lichess.org/api
API tips and rate-limit guidance: https://lichess.org/page/api-tips

## Important API rules

- Prefer the official HTTP API instead of web scraping.
- Make requests sequentially where practical: Lichess recommends making only one request at a time.
- If a request returns HTTP 429, wait a full minute before resuming API usage.
- Some endpoints are public and require no authentication; others require OAuth tokens and specific scopes.
- Game export endpoints can return PGN or NDJSON depending on the `Accept` header.

## Highest-priority endpoints for this project

### 1. Get a user profile
`GET /api/user/{username}`

Useful for validating a Lichess username and retrieving profile/account information, including performance data. Good for profile pages, title applications, player validation, and rating displays.

### 2. Get multiple users
`GET /api/users`

Useful for efficiently refreshing information for many leaderboard players instead of requesting every player individually. Best candidate for batch leaderboard/profile updates.

### 3. Get user status
`GET /api/users/status?ids=...`

Useful for showing whether players are online and, where enabled by the endpoint parameters, additional current-game/status information.

### 4. Autocomplete users
`GET /api/player/autocomplete`

Useful for username search boxes and admin/title tools. Can provide suggestions while typing instead of requiring exact usernames.

### 5. Get user performance statistics
`GET /api/user/{username}/perf/{perfType}`

Useful for detailed performance information for a specific category/variant. Potentially useful when Racing Kings ratings or historical performance need more detail than the main user profile.

### 6. Get Racing Kings leaderboard
`GET /api/player/top/{nb}/racingKings`

Potentially very useful for finding the strongest Racing Kings players directly from Lichess. Could support discovery tools, title-candidate scouting, or comparisons with the site's own title leaderboard.

### 7. Export a user's games
`GET /api/games/user/{username}`

One of the most important endpoints for title verification and statistics. Supports filters such as variant/performance, dates, rated/casual games, opponent, colour, maximum number of games, and more. Can return PGN or structured NDJSON.

Possible uses:
- Count Racing Kings games.
- Verify games in a date range.
- Check games against a particular opponent.
- Analyse wins/losses and title requirements.
- Download PGNs for the PGN converter or analysis tools.

### 8. Export games by IDs
`POST /api/games/export/_ids`

Useful when the site already knows exact game IDs and needs detailed data for only those games.

### 9. Get one game
`GET /game/export/{gameId}` or the corresponding documented single-game export operation.

Useful for checking or displaying one specific game submitted as evidence for a title application.

### 10. Import a game
`POST /api/import`

Potentially useful for future PGN tools: send a PGN to Lichess and receive an imported game/study-style analysis link. Requires careful UX and should only be used when users intentionally submit PGN content.

## Tournament endpoints

### 11. Get a tournament
`GET /api/tournament/{id}`

Useful for verifying a specific Racing Kings arena, its metadata, standings, winners, and participating players.

### 12. Get tournament results
`GET /api/tournament/{id}/results`

Important for title verification when requirements involve tournament placement or victories. Recent API versions can expose additional result/history information.

### 13. Get tournaments played by a user
`GET /api/user/{username}/tournament/played`

Extremely useful for the title checker. Can retrieve tournaments a player participated in, helping automatically inspect Racing Kings tournaments and possible wins/placements.

### 14. Get current tournaments
`GET /api/tournament`

Useful for a future live/events section showing current or scheduled Lichess tournaments, including Racing Kings events where available.

### 15. Get tournament winners
`GET /api/tournament/winners`

Potentially useful for historical achievements and automated verification of certain tournament-winning requirements.

## Team endpoints

### 16. Get a team
`GET /api/team/{teamId}`

Useful if the project later links official Racing Kings teams or communities.

### 17. Get team members
`GET /api/team/{teamId}/users`

Useful for importing or comparing members of a relevant team. The API can include membership information such as join dates.

### 18. Search teams
`GET /api/team/search`

Useful for admin tools or future discovery features.

### 19. Get teams of a user
`GET /api/team/of/{username}`

Potentially useful for profile enrichment or verifying community/team participation, if such requirements are ever added.

## Relations and social data

### 20. Get followers/following information
Lichess provides relation endpoints for authenticated use cases.

Potential future use: social/profile features. Not currently a priority and authentication/privacy requirements should be considered before using these endpoints.

## Studies and educational tools

### 21. Export a study
`GET /api/study/{studyId}.pgn`

Useful for the future opening trainer, educational resources, or sharing Racing Kings studies.

### 22. Export a study chapter
`GET /api/study/{studyId}/{chapterId}.pgn`

Useful for importing a single chapter into a trainer or displaying a focused lesson. Options can include orientation metadata.

### 23. Get or manage studies
The API includes additional study operations, with many requiring OAuth and appropriate scopes.

Potential future use: authenticated users creating or managing Racing Kings training studies directly through the site.

## TV and live-game features

### 24. Lichess TV feed
`GET /api/tv/feed`

Provides a live stream of TV games.

### 25. Variant/channel TV feed
`GET /api/tv/{channel}/feed`

Potentially useful for a live Racing Kings section if a matching TV channel is available. This is better than repeatedly polling ordinary pages.

## Puzzle endpoints

### 26. Get the daily puzzle
`GET /api/puzzle/daily`

Useful for a future daily chess feature.

### 27. Get a random/new puzzle
The API includes puzzle endpoints for retrieving puzzles and related data.

These are lower priority because standard puzzles are not Racing Kings-specific, but could still support a general chess feature.

## Opening Explorer / game analysis data

Lichess also exposes analysis-related services and data. These can be useful for future opening or position tools, but should be evaluated separately because some are outside the main authenticated HTTP API workflow.

Potential uses:
- Racing Kings position exploration.
- Opening trainer enhancements.
- Position statistics.

## Broadcast endpoints

Lichess provides API endpoints for broadcasts, rounds, users' broadcasts, and related PGN data.

Potential uses:
- Showing official event broadcasts on the site.
- Linking or tracking community tournaments.
- Importing broadcast PGNs for educational content.

Not currently a core Racing Kings Master feature, but worth remembering for future event coverage.

## Bulk pairing and automated tournament tools

The API includes endpoints for bulk pairings and automation. These are mainly intended for software that creates and manages large numbers of pairings/challenges.

Potential future use:
- Organising special Racing Kings events.
- Building automated qualification tournaments.

These endpoints are not currently needed for the public website and generally require authentication and careful permission handling.

## Account, OAuth and authenticated features

Lichess supports OAuth authentication and token-based API access. Authenticated operations can include account actions, playing/challenges, team management, studies, preferences, and other user-authorised actions depending on scopes.

For this project:
- Do NOT expose OAuth tokens or private API secrets in GitHub Pages frontend JavaScript.
- If authenticated Lichess actions are added later, use a secure backend such as Supabase Edge Functions or another server-side service.
- Request the minimum OAuth scopes necessary.

## Recommended endpoint mapping for current site features

| Site feature | Recommended API |
|---|---|
| Validate username during application | `/api/user/{username}` |
| Display player ratings/profile info | `/api/user/{username}` or `/api/users` |
| Refresh many leaderboard players efficiently | `/api/users` |
| Find top Racing Kings players | `/api/player/top/{nb}/racingKings` |
| Title checker: inspect games | `/api/games/user/{username}` |
| Title checker: inspect tournaments | `/api/user/{username}/tournament/played` |
| Verify specific tournament | `/api/tournament/{id}` |
| Verify tournament placement/results | `/api/tournament/{id}/results` |
| Username search/autocomplete | `/api/player/autocomplete` |
| Detailed variant performance | `/api/user/{username}/perf/{perfType}` |
| PGN tool | `/api/games/user/{username}` and game export endpoints |
| Future study/opening tools | Study export endpoints |
| Future live section | `/api/tv/feed` or `/api/tv/{channel}/feed` |

## Racing Kings-specific notes

- Lichess commonly uses the variant/performance key `racingKings` in API contexts.
- Always verify the exact current parameter names and response schemas in the official API documentation before implementing a new endpoint.
- When filtering game exports, explicitly filter for Racing Kings where supported instead of downloading unnecessary games and filtering everything client-side.
- Large game histories can be expensive to process. Use parameters such as `max`, `since`, `until`, and variant/performance filters whenever possible.
- For leaderboard refreshes, batch user lookups when possible and cache results to reduce API traffic.
- Do not assume an API response field will remain unchanged forever; the Lichess API is documented and updated over time.

## Implementation checklist before adding a new Lichess API feature

1. Check the exact operation in the official documentation.
2. Confirm whether it is public or requires OAuth.
3. Check required scopes for authenticated operations.
4. Check parameters and accepted response formats.
5. Add variant/date/max filters to minimise data transfer.
6. Handle HTTP errors, especially 404 and 429.
7. Cache non-live data where appropriate.
8. Avoid parallel request bursts; respect Lichess rate-limit guidance.
9. Never place private tokens in public frontend code.
10. Test with real Racing Kings accounts and tournaments before relying on the result for title decisions.

## Primary sources

- Official API documentation: https://lichess.org/api
- Official API tips: https://lichess.org/page/api-tips
- Lichess developers page: https://lichess.org/developers
- Lichess API source/documentation repository is linked from the official Lichess source page.

Last reviewed: 2026-08-20
