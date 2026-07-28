---
name: Site state
description: Current site name, homepage structure, and title rules in effect.
---

**Site name:** "The Racing Kings Master" (renamed July 2026 from "Racing Kings Titles"). Updated in all HTML `<title>` tags and the main hero heading.

**Homepage (index.html):** Full redesign — hero with gradient title, live stat tiles (titled players, members, titles awarded, title tiers), 6-card nav grid, 2-col layout with news placeholder + newest members. Stats from `/api/stats`; newest members from `/api/members/newest` (both added to app.py).

**Title rules (as of July 2026):**
- RKCM: 500 games, 2100 rating, 2 blitz norms + 2 standard norms (perf ≥2100)
- RKM: 1000 games, 2200 rating, 2 blitz norms + 2 standard norms (perf ≥2200)
- RKIM: 3000 games, 2300 rating, 1 blitz norm + 1 standard norm (perf ≥2300)
- RKGM: 5000 games, 2400 rating, 1 blitz norm + 1 standard norm (perf ≥2400)
- RKSGM: 10000 games, 2500 rating, RKWC OR 1 blitz + 1 standard norm (perf ≥2450)
- RKWC merged into RKSGM — winners get RKSGM + admin-awarded RKWC badge
- All titles: account ≥3 months old, ≥10 games per norm, winning not required
- RKV and RKHM remain unchanged (non-competitive special titles)

**Why:** user explicitly specified all updated requirements in July 2026 session.
