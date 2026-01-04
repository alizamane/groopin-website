# Recommendations MVP

This document describes the lightweight recommendation system added for launch.

## Goals

- Show relevant offers quickly with simple, stable rules.
- Keep the system easy to tune without heavy ML.
- Provide a safe fallback when user signals are missing.

## API

Endpoint (auth required):
- `GET /api/offers/recommended?lite=1&limit=6&trending_limit=6`

Response shape:
```
{
  "data": {
    "recommended": [/* lite offers */],
    "trending": [/* lite offers */]
  },
  "meta": {
    "recommended_count": 6,
    "trending_count": 6,
    "strategy": "interests_city_time_popularity"
  }
}
```

## Ranking logic

Recommended section:
1) Candidate pool:
   - Active offers with end_at in the future
   - Excludes offers owned by the user
   - Excludes offers the user already joined or requested
   - Excludes offers from blocked owners
2) Interest match:
   - Uses user dynamic answer "interests" (category ids)
   - Matches either category_id or parent category id
3) City boost:
   - If user has dynamic answer "city", sort that city first
4) Sort:
   - start_date asc, start_time asc

Fallback:
- If not enough interest matches, fill with the base pool sorted by time,
  still boosted by city when available.

Trending section:
- Same base pool, excluding recommended ids
- Sort by participants_count desc, favorited_by_count desc,
  then start_date/start_time asc

## Caching

Backend:
- Cached with ApiCache for 60 seconds.
- Cache key includes user id, locale, and query params.
- Use `?no_cache=1` to bypass cache.

Frontend:
- The web client caches the response for 15 seconds.

## UI usage (web)

Route:
- `/app/auth/drawer/tabs` in `app/app/auth/drawer/tabs/page.jsx`

Behavior:
- Recommended/trending render only when no filters and no search are active.
- Recommended/trending offers are removed from the main list to avoid duplicates.

## Parameters

- `limit`: number of recommended offers (default 10, capped at 50)
- `trending_limit`: number of trending offers (default 6, capped at 50)
- `lite=1`: returns lite offers
- `no_cache=1`: bypasses cache

## Notes

- This is not ML. It is a rules-based baseline that is safe for launch.
- Once we add event tracking, we can tune weights or move to ML ranking.
