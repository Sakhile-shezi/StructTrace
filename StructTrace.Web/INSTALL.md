# StructTrace — the "10/10" update

## What is new

| Area | Change |
|---|---|
| **Progress follows the student** | Topics completed, ticked checklists and finished exercises in AIVisual and DSAVisual are saved to the account (`/api/progress`) and appear on every device. The Profile page shows both visualizers' progress from the database. |
| **Site search (pgvector)** | A **Search topics** button in every top bar (or press `/` or `Ctrl+K`). It searches all AIVisual, DSAVisual and Code Sandbox topics, tolerates typos ("dijsktra") and jumps straight to the right section. The vectors are stored in PostgreSQL with pgvector, which also fills the `Lessons.Embedding` column at last. |
| **Code Sandbox runs Python for real** | **▶ Run Python** runs the editor's code in the student's browser (Python 3.14 through Pyodide), with `input()`, a Stop button, a 10-second limit and clean error messages. Each of the 10 structures has a runnable Python program that uses the input box and the Test Target menu. C++, Java and C# are labelled as read-and-copy; **Build trace** still works for every language. |
| **"Topics" everywhere** | DSAVisual addresses are now `/dsa-visualizer/topic-01-foundations/…` (old `module-…` links redirect). AIVisual's "Module 01", "Mark Module Complete" etc. now say "Topic". |
| **Phones** | Every page fits a 390 px phone. Wide trees and charts show "Swipe sideways…" and start centred on the root. |
| **Speed** | Visualizer pages, styles and scripts are sent compressed (a topic page goes from 146 KB to 34 KB). Account pages are deliberately not compressed (BREACH protection). |
| **Tests + CI** | `StructTrace.Tests` (104 tests) and a GitHub Actions workflow that builds, tests and syntax-checks every script on each push. |


## 1. Copy the files

1. In your project, **delete** `wwwroot/dsa-visualizer` and `wwwroot/ai-visualizer` (DSAVisual's folders were renamed, so copying on top would leave the old ones behind).
2. Copy everything in `StructTrace.Web/` over your `StructTrace.Web` project, keeping the folders.
3. Put `StructTrace.Tests/` **next to** `StructTrace.Web/` (not inside it), and `.github/` at the top of your repository:

```
your-repo/
  .github/workflows/ci.yml
  StructTrace.Web/          (your project)
  StructTrace.Tests/        (new)
```

4. Optional: add the test project to your solution, either in Visual Studio (right-click the solution → Add → Existing Project…) or with `dotnet sln add StructTrace.Tests/StructTrace.Tests.csproj`.

No new NuGet packages are needed in StructTrace.Web.

| New or changed | What it is |
|---|---|
| `Program.cs` | Registers progress, search, compression, the `/api` endpoints and the old-address redirects |
| `Models/StudyModels.cs` (new) | `StudyProgress` and `SearchDocument` tables |
| `Data/ApplicationDbContext.cs` | The two new tables (nothing else changed) |
| `Endpoints/StructTraceApi.cs`, `Endpoints/LegacyUrls.cs` (new) | `/api/progress`, `/api/search`, `module-…` → `topic-…` redirects |
| `Services/Progress/*` (new) | Saving and merging progress |
| `Services/Search/*` (new) | Reading the pages, vectors, pgvector search |
| `Controllers/ProfileController.cs`, `Models/AccountViewModels.cs`, `Views/Profile/Index.cshtml` | Profile shows account progress for both visualizers |
| `Views/Shared/_Layout.cshtml`, `_LoginPartial.cshtml` | Search button in the navbar |
| `Views/SandBox/Index.cshtml` | Run Python, Stop, program input, honest labels, `?topic=` links |
| `Services/Email/EmailTemplates.cs` | Welcome email describes the Sandbox correctly |
| `wwwroot/js/visualizer-guard.js` | Progress sync, search button, swipe hints, section jumps |
| `wwwroot/js/structtrace-search.js`, `wwwroot/css/structtrace-search.css` (new) | The search panel |
| `wwwroot/js/sandbox-python.js`, `wwwroot/js/sandbox-python-worker.js` (new) | Runs Python in a Web Worker |
| `wwwroot/css/structtrace-theme.css`, `structtrace-topbar.css` | Profile progress, search button, swipe hint styles |
| `wwwroot/ai-visualizer/`, `wwwroot/dsa-visualizer/` | "Topics" wording, renamed DSA folders, phone fixes |


## 2. Create the two new tables (once)

In Visual Studio open **Tools → NuGet Package Manager → Package Manager Console**, choose `StructTrace.Web` as the default project and run:

```
Add-Migration AddSearchAndProgress
Update-Database
```

(Command line instead: `dotnet ef migrations add AddSearchAndProgress` then `dotnet ef database update`.)

Before `Update-Database`, open the new migration file: it should only **create** `StudyProgress` and `SearchDocuments` (with their indexes). If it drops or changes anything else, don't run it; send it to me first.

Render uses the same Neon database, so running this once from your computer is enough.

If you deploy before running the migration, the site still works: progress stays in each browser and search runs from memory. The log then says that the tables are missing.


## 3. Deploy

Commit and push as usual; Render rebuilds the site. There are no new settings or environment variables.

When the site starts it reads every topic page, builds the search vectors (about a second) and stores them in `SearchDocuments` and `Lessons.Embedding`. This is skipped on later starts if no page has changed.


## 4. Check that it works

1. **Progress:** open DSAVisual and tick a topic. Open the site in another browser or on your phone and sign in: the tick is there. Your Profile shows both visualizers under "Learning progress — Saved to your account".
2. **Search:** press `/` and type `alpha beta`. Choose **Alpha-Beta Pruning**: Topic 5 opens at that section. Try a typo such as `dijsktra`.
3. **Python:** open the Code Sandbox, choose **Python** and press **▶ Run Python**. The first run downloads Python once (about 6 MB, a few seconds); after that, runs take a fraction of a second.
4. **Old links:** `/dsa-visualizer/module-05-bst/index.html` should open `/dsa-visualizer/topic-05-bst/index.html`.
5. **Tests:** `dotnet test StructTrace.Tests` should report 104 passed. After you push, the **Actions** tab on GitHub shows the same run.


## Good to know

* **Search** uses keyword vectors, so no paid AI service or API key is needed. It understands the course's abbreviations (BFS, A*, AVL, CSP, MRV, …) and small typos, but not synonyms it hasn't been told about. You can add more in `TextVectorizer.Expansions`. To switch to a real embedding model later, keep 384 dimensions and replace `TextVectorizer.Embed`.
* **Python** runs on the student's computer: nothing runs on your server and there is no daily limit. It needs internet the first time (Pyodide is loaded from the jsDelivr CDN) and has the full standard library. C++, Java and C# are not run.
* **Progress** is saved in the browser first and uploaded within a second. Offline changes are uploaded on the next visit. When someone else signs in on the same browser, the previous person's progress is cleared from that browser (it stays in their account).
* **Versioned files** (`…css?v=4`, `…js?v=6`) are kept by browsers for a day. When you change a file in `wwwroot/css` or `wwwroot/js`, also raise its `?v=` number where it is linked.
* The JSON API is described in `API.md`.
