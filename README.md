# The Racing Kings Master

**The Racing Kings Master** is an independently operated community website for competitive Racing Kings. Its main purpose is to provide a public title system, leaderboards, player profiles, title checking, community membership, news, and administration tools.

The project is actively developed. A release does not mean development stops; new features and improvements can continue after launch.

## Current architecture

The production website is a **static frontend**. It does not require a Flask server.

```text
Browser
  │
  ├── HTML / CSS / JavaScript
  │
  ├── Supabase
  │     ├── Authentication
  │     ├── Profiles / members
  │     ├── Titles
  │     ├── Title applications
  │     ├── News
  │     ├── Notifications
  │     └── Community data
  │
  └── Lichess API
        ├── Racing Kings ratings
        ├── Player statistics
        └── Title-checker data

GitHub Actions
  └── Refreshes json/thijs-leaderboards.json periodically
```

This architecture is suitable for static hosting such as GitHub Pages, Vercel, Cloudflare Pages, or another static web host. Supabase is the backend/database service; the host only serves the frontend files.

## Main technologies

### Frontend

- HTML for pages and structure
- CSS for the visual design and responsive layout
- JavaScript for authentication integration, menus, API calls, dynamic data, and interactive features

### Supabase

Supabase is the **source of truth for user accounts, profiles, title records, applications, and other database-backed community data**.

The browser uses the Supabase publishable key. It is not a secret and must not be replaced with a service-role key.

Important database rules are enforced with Row Level Security. In particular, official Racing Kings titles are publicly readable, but awarding, changing, or removing titles is restricted to administrators.

Approved title applications can create the corresponding title record automatically. This means titled players do **not** need to be maintained manually in a JSON file.

### Lichess

The site uses the public Lichess API for live Racing Kings information, including ratings and player statistics. The title checker uses Lichess activity to calculate the requirements that can currently be verified automatically.

RKWC is intentionally different: it is an admin-awarded achievement and is not automatically verified by the title checker yet.

### GitHub Actions

The workflow in `.github/workflows/update-thijs-leaderboards.yml` periodically runs `scripts/update_thijs_leaderboards.py` and updates `json/thijs-leaderboards.json`.

This provides static pages with historical tournament leaderboards without requiring a server-side application.

## Main pages

| Page | Purpose |
|---|---|
| `index.html` | Homepage, statistics, latest news, and newest members |
| `leaderboard.html` | Rating, title-holder, and tournament leaderboards |
| `titles.html` | Official Racing Kings title requirements and current holders |
| `title-checker.html` | Automatic eligibility checking for the titles that can currently be verified |
| `players.html` | Lichess Racing Kings player browser/search |
| `profile.html` | Player profiles, statistics, rating history, titles, and eligibility |
| `auth.html` | Registration and login |
| `admin.html` | Administrator tools |
| `chat.html` | Community chat |
| `about.html` | About the project |
| `hall-of-fame.html` | Historical/community recognition |
| `settings.html` | Logged-in user settings |
| `player-specific-training.html` | Admin-only placeholder for the training system currently being rebuilt |

## Title data

Official title records are stored in the Supabase `titles` table.

The supported title codes currently include:

- `RKSGM`
- `RKGM`
- `RKIM`
- `RKM`
- `RKCM`
- `RKV`
- `RKHM`
- `RKWC`

There are currently no awarded title records in the production database, so the public title-holder areas should correctly show zero holders until the first title is awarded.

### How titles are awarded

For automatically checkable titles, a user can submit an application. An administrator reviews it. When an application is approved, the database automatically creates the title record.

For manually awarded achievements such as RKWC, an administrator can award the title directly. The title checker does not attempt to verify RKWC automatically.

## Title Checker

The Title Checker uses Lichess data for requirements that can be computed from the public API.

It does **not** automatically verify every manually awarded or community-recognized achievement. In particular, RKWC remains an administrator decision at this stage.

Current Blitz-norm recognition in the checker is intentionally limited to the controls implemented there: `3+0`, `3+2`, and `5+0`.

## Player data

`players.json` is no longer the source of truth for official title holders. It is currently empty and should not be populated manually with production title records.

Supabase profiles and the `titles` table are the authoritative data source for registered members and awarded titles.

## Important folders

```text
css/                      Shared and page-specific styles
js/                       Shared JavaScript and Supabase integration
json/                     Static generated data such as Thijs leaderboards
scripts/                  GitHub Actions data-refresh scripts
.github/workflows/        Automated GitHub Actions workflows
artifacts/                Development/design artifacts, not the production app
Images/                   Site images and visual assets
```

## Development notes

The repository is intentionally simple to deploy: normal production pages are plain HTML/CSS/JS and do not need a build step.

`artifacts/leaderboard-redesign/` is a separate development/design artifact. Its React/Vite dependencies are not required to serve the main website.

`package.json` and related Node tooling may exist for development artifacts; they are not the runtime requirement for the main static site.

The previous Flask/SQLite architecture is no longer the production architecture. Do not reintroduce `app.py`, `db.py`, or a second authentication system unless the project is deliberately redesigned again.

## Data and security rules

- Supabase is the source of truth for current members and official title records.
- Never put a Supabase service-role key in frontend code.
- Keep title-awarding operations protected by database RLS, not only by hiding buttons in the UI.
- Do not manually add placeholder users or fake title holders to production data.
- Lichess data can change independently from the site's official title records.
- Generated tournament JSON should be refreshed by the existing GitHub Action rather than manually edited when possible.

## Release model

The site can be released while still being developed. A production release should mean that the existing core features work reliably; it does not mean every future idea is finished.

Before a public release, check at minimum:

- Supabase authentication and session persistence
- public profile access and RLS
- administrator access and title-awarding permissions
- title applications and approval flow
- title-holder leaderboard
- title requirements / title checker consistency
- Lichess API availability and error handling
- GitHub Actions refresh of tournament data
- mobile layout and navigation
- all internal links

## Updating the project

When adding or changing a feature, first determine which system owns its data:

- Supabase for current members, profiles, applications, and awarded titles
- Lichess for live chess data
- GitHub-generated JSON for the automated historical tournament snapshot
- Static HTML/CSS/JS for presentation and client-side logic

Keeping one clear source of truth prevents the site from gradually drifting back toward manual JSON maintenance.
