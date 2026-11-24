/* =========================================================
   STRUCTTRACE - CODE SANDBOX PYTHON WORKER (module worker)
   Runs the student's Python in a Web Worker with Pyodide
   (CPython 3.14 compiled to WebAssembly), so a slow or endless
   program never freezes the page. The page can stop it at any
   time by terminating this worker (see /js/sandbox-python.js).

   Messages in:  { id, code, globals: { NAME: string }, stdin: string }
   Messages out: { type: "ready" | "stdout" | "stderr" | "done" | "error", ... }
   ========================================================= */

const PYODIDE_VERSION = "314.0.8";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`;

let pyodidePromise = null;

function loadPython() {
    if (!pyodidePromise) {
        pyodidePromise = import(PYODIDE_URL)
            .then(({ loadPyodide }) => loadPyodide())
            .then((pyodide) => {
                self.postMessage({ type: "ready", version: pyodide.version });
                return pyodide;
            })
            .catch((error) => {
                pyodidePromise = null;
                throw error;
            });
    }
    return pyodidePromise;
}

// Keep only the student's own frames in a traceback (not Pyodide's internals).
function cleanTraceback(text) {
    const lines = String(text || "").split("\n");
    const out = [];
    let skipping = false;

    for (const line of lines) {
        const frame = /^\s*File "([^"]+)"/.exec(line);
        if (frame) {
            skipping = frame[1] !== "main.py";
            if (skipping) continue;
        } else if (skipping && /^\s{4}/.test(line)) {
            continue;
        } else {
            skipping = false;
        }
        out.push(line);
    }

    return out.join("\n").trim();
}

self.onmessage = async (event) => {
    const message = event.data || {};

    if (message.type === "warm-up") {
        try { await loadPython(); } catch (error) { self.postMessage({ type: "load-error", text: String(error && error.message || error) }); }
        return;
    }

    const { id, code, globals, stdin } = message;
    let pyodide;

    try {
        pyodide = await loadPython();
    } catch (error) {
        self.postMessage({ id, type: "load-error", text: String(error && error.message || error) });
        return;
    }

    const inputLines = String(stdin || "").split(/\r?\n/);
    if (inputLines.length && inputLines[inputLines.length - 1] === "") inputLines.pop();

    pyodide.setStdout({ batched: (text) => self.postMessage({ id, type: "stdout", text }) });
    pyodide.setStderr({ batched: (text) => self.postMessage({ id, type: "stderr", text }) });
    pyodide.setStdin({
        stdin: () => {
            if (!inputLines.length) return null;
            const line = inputLines.shift();
            self.postMessage({ id, type: "stdin", text: line });
            return line + "\n";
        }
    });

    // A fresh namespace for every run, with the Sandbox's inputs as variables.
    const namespace = pyodide.globals.get("dict")();
    namespace.set("__name__", "__main__");
    for (const [name, value] of Object.entries(globals || {})) {
        namespace.set(name, String(value));
    }

    const started = performance.now();

    try {
        await pyodide.loadPackagesFromImports(code, { messageCallback: () => { }, errorCallback: () => { } });
        await pyodide.runPythonAsync(code, { globals: namespace, filename: "main.py" });
        self.postMessage({ id, type: "done", ms: Math.round(performance.now() - started) });
    } catch (error) {
        const raw = error && error.message ? error.message : String(error);
        self.postMessage({ id, type: "error", text: cleanTraceback(raw), ms: Math.round(performance.now() - started) });
    } finally {
        namespace.destroy();
    }
};
