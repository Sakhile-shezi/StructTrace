# AIVisual — changes (Nov 2026)

## Fixes
- Topics 01–03 had no page styling (their CSS had been overwritten). Added `css/topic-base.css`, one shared layout for every topic page, plus styles for the Topic 01–03 widgets (agent world, quiz, timeline, water jugs, search graph).
- Topic 10's N-Queens, Sudoku and cryptarithm labs had no CSS (the chessboard collapsed to one ♛). Now styled like the other workbenches.
- Topic 04 linked a missing `css/topic04.css` (404). Link removed.
- Topic 05 loaded `topic05.js` twice. Now loaded once.
- `topic-pages.css`: the Module 08 block was pasted twice (2,417 duplicate lines). Duplicate removed.
- Checklists in Topics 06–10 had no checkbox ids, so ticks were never saved. Ids added.
- `btn primary / secondary / danger` buttons were unstyled on several pages, and `.btn-secondary` had near-white text on white cards.
- Topic pages had no way to navigate on phones (links hidden, no menu button). Menu button added.
- `ai-visualizer.js` warned "Topic is not registered" every time a module was completed.

## Consistency
- Every topic page: same stylesheet and script order, `body.aiv-topic`, "Module NN" labels and titles.
- Same header nav everywhere: Course Home · ← previous · current · next → · DSAVisual.
- Same bottom nav everywhere (Topic 01 had none; several pages had no "Next" link).
- Homepage: all 10 modules listed and tracked (only 1 was linked; the rest said "Coming Soon").

## New Test 1 revision labs
- Module 02 §09 — two-grid colour-swap game: interactive grids, h = mismatches ÷ 2, goal test, successors, memo answers Q1–Q6, aipython class. (`topic02-colour-swap.js`)
- Module 10 §03 — backtracking with forward checking step table in the memo format (A = [1], B = [-]), board and domains per step, strict trace vs the memo's 18 steps. (`topic10-fc-steps.js`)
- Module 06 §6.5–6.7 — PMX and cycle crossover explained with worked examples and Python, plus a TSP lab: PMX → fittest two → cycle crossover with A–P / AA–PP answers. (`topic06-permutation-crossover.js`)

## Maintenance note
New shared styles go in `topic-base.css` under `.aiv-topic`. Lab panels reuse the `xlab-*` classes.

## Private access (same as DSAVisual)
- `Program.cs` sign-in check now covers `/ai-visualizer` as well as `/dsa-visualizer` (signed-out visitors are sent to the login page and back).
- Red **Logout** link (`/account/instant-logout`) added to the AIVisual homepage and every topic header, styled like DSAVisual's.
