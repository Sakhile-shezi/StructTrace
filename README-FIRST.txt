StructTrace: build fix + AIVisual "Mark Topic Complete" fix
===========================================================

1. DELETE these (in Visual Studio: right-click > Delete, or in File Explorer).
   They are duplicate copies that cause the 14 build errors:

   StructTrace.Web\StructTrace.Web\            (the whole inner folder)
   StructTrace.Web\source\                     (the whole folder)
   StructTrace.Web\wwwroot\notes.html
   StructTrace.Web\wwwroot\js\ai-notes.js
   StructTrace.Web\wwwroot\css\ai-notes.css

   KEEP: Controllers\AiNotesController.cs, Models\AiNote.cs and your
   Data\ApplicationDbContext.cs. They are correct as they are.

2. Close Visual Studio, then extract this zip into the folder that holds
   StructTrace.sln and choose "Replace the files in the destination".

3. Open the solution, then Build > Rebuild Solution (expect 0 errors).

4. Package Manager Console:
       Add-Migration AddAiNotes
       Update-Database

5. Run the site, sign in, open AIVisual > Exam notes, and try any topic's
   "Mark Topic Complete". Press Ctrl+F5 once if the browser shows old pages.
