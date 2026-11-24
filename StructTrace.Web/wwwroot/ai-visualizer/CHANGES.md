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
- Module 10 §04 (was §03) — backtracking with forward checking step table in the memo format (A = [1], B = [-]), board and domains per step, strict trace vs the memo's 18 steps. (`topic10-fc-steps.js`)
- Module 06 §6.5–6.7 — PMX and cycle crossover explained with worked examples and Python, plus a TSP lab: PMX → fittest two → cycle crossover with A–P / AA–PP answers. (`topic06-permutation-crossover.js`)

## Maintenance note
New shared styles go in `topic-base.css` under `.aiv-topic`. Lab panels reuse the `xlab-*` classes.

## Private access (same as DSAVisual)
- `Program.cs` sign-in check now covers `/ai-visualizer` as well as `/dsa-visualizer` (signed-out visitors are sent to the login page and back).
- Red **Logout** link (`/account/instant-logout`) added to the AIVisual homepage and every topic header, styled like DSAVisual's.

## Screen fit (24 Nov 2026)
- **View size** control in every AIVisual nav bar: *Fit screen* (default) picks 80 / 90 / 100 % from the window size; 80–110 % can be chosen and is remembered per browser. (`js/ai-fit.js`, `css/ai-fit.css`, loaded last in `<head>`.)
- Smaller header and hero, tighter sidebar (scrolls on short screens).
- **Trace dock**: when a step-by-step lab is on screen but its own buttons have scrolled away, a floating bar shows the latest step text and the same buttons (Next, Run, Reset, ⤒ back to the controls). Works on all 14 tracing labs.
- Long trace logs and the Sudoku domain table now scroll inside their own box (sticky headings) and follow the newest row.
- Module 10 N-Queens step table: step cards on the left, board and domains on the right in a pane that stays in view, with its own ← / → buttons; equal-height board rows.
- Module 05: MAX/MIN labels were black on the dark tree; "leaves evaluated" counted internal nodes too.

## New content (24 Nov 2026), from the COMP304 study guide and the 2024 paper
- 01 §08 PEAS, task environments and agent types + environment classifier
- 02 §10 Counting states and successors (exam template, eight coins)
- 03 §10 Writing traces the memo way + maze.py
- 04 §11 Dominance, combining heuristics, weighted A*; §12 Local search with an annealing calculator
- 05 §10 Alpha-beta on a printed tree; textbook tree (3, 12, 8 / 2, 4, 6 / 14, 5, 2) added to the simulator
- 06 §12 Operator catalogue and GA design template + binary crossover workbench
- 07 §11 Activation functions, cost and gradient descent + activation explorer
- 08 §10 2024 exam Q6 worked answer; trainer datasets "2024 Exam" and "Lecture four-input example"
- 09 §10 Semantics and the 2024 panther resolution proof (stepper)
- 10 §02 Possible worlds and generate-and-test + possible-worlds counter
- Widget logic: `js/ai-extras.js`; styles in `topic-base.css` PART 6.
