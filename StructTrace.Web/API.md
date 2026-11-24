# StructTrace JSON API

Every endpoint needs a signed-in user (the normal login cookie). A signed-out caller gets
`401` (never a redirect to the login page). Each user may make 120 requests a minute;
more gives `429`. Code: `Endpoints/StructTraceApi.cs`.

## GET /api/progress

The signed-in user's saved progress for both visualizers.

```json
{
  "uid": "959540bf1289a007",
  "now": 1795507986143,
  "areas": {
    "ai":  { "aivisual_progress_v1": { "value": "{\"topic-01-introduction\":true}", "t": 1795507986201 } },
    "dsa": { "dsa_visual_progress_v2": { "value": "{\"mod3\":true}", "t": 1795507990112 } }
  }
}
```

* `uid` – a short, anonymous id for the account (lets the browser notice a different user).
* `now` – server time in Unix milliseconds (the browser uses it to correct a wrong clock).
* Each item is a browser `localStorage` key: `value` is its text (or `null` when it was removed),
  `t` is when it last changed (Unix ms).

## PUT /api/progress/{area}

Saves progress for `ai` (AIVisual) or `dsa` (DSAVisual). Send the header
`X-Requested-With: XMLHttpRequest`. Browsers only allow that header on same-site requests,
so another website cannot change a student's progress.

```json
{ "items": { "dsa_visual_progress_v2": { "value": "{\"mod3\":true,\"mod5\":true}", "t": 1795508000000 } } }
```

Each key is merged on its own: the newest change wins, so two devices that change different
things never overwrite each other. The answer has the area as now stored.

Accepted keys: `aivisual_progress_v1`, `aiv_checklist_state`, `aiv_uninformed_completed_v1`,
`aiv_heuristic_completed_v3`, `aiv_game_trees_v2` (ai) and `dsa_visual_progress_v2`,
`dsav_checklist_state` (dsa). At most 32 KB per value. Anything else gives `400`.

## GET /api/search?q=…

Searches every AIVisual, DSAVisual and Code Sandbox topic.

| Parameter | |
|---|---|
| `q` | what to search for (2–120 characters) |
| `limit` | 1–20 results (default 8) |
| `source` | optional: `AIVisual`, `DSAVisual` or `Sandbox` |

```json
{
  "query": "alpha beta",
  "terms": ["alpha", "beta"],
  "engine": "pgvector",
  "results": [
    {
      "title": "Alpha-Beta Pruning",
      "page": "Game Trees Minimax · Alpha-Beta Pruning",
      "source": "AIVisual",
      "url": "/ai-visualizer/modules/topic-05-game-trees/index.html#alpha-beta",
      "snippet": "Alpha-Beta Pruning improves minimax by avoiding branches that cannot influence the final decision. …",
      "score": 1.95
    }
  ]
}
```

`engine` is `pgvector` when the nearest sections came from PostgreSQL, or `memory` while
the database is unavailable. Results are then re-ranked so that sections containing the
searched words (or a one-letter typo of them) come first.
