/* =========================================================
   STRUCTTRACE - CODE SANDBOX: RUN PYTHON IN THE BROWSER
   Python runs for real with Pyodide (CPython 3.14 compiled to
   WebAssembly) inside a Web Worker: /js/sandbox-python-worker.js.
   Nothing is sent to the server and there is no daily limit.

   window.SandboxPython:
     templates      runnable Python program for each Sandbox structure
     warmUp()       start downloading Python in the background
     run(options)   run code → Promise<{ status, ms, text }>
                    status: done | error | timeout | stopped | limit | load-error
     stop()         stop the running program
     onStatus(fn)   fn("loading" | "ready" | "load-error", detail)
   ========================================================= */
(function () {
    "use strict";

    var WORKER_URL = "/js/sandbox-python-worker.js?v=1";
    var MAX_LINES = 2000;
    var MAX_CHARS = 100000;

    var worker = null;
    var ready = false;
    var loading = false;
    var version = "";
    var current = null;
    var nextId = 1;
    var listeners = [];

    function status(state, detail) {
        listeners.forEach(function (fn) { try { fn(state, detail); } catch (e) { /* ignore */ } });
    }

    function createWorker() {
        worker = new Worker(WORKER_URL, { type: "module" });
        ready = false;
        worker.onmessage = onMessage;
        worker.onerror = function (event) {
            var text = (event && event.message) || "Python could not be started in this browser.";
            discardWorker();
            status("load-error", text);
            finish("load-error", { text: text });
        };
    }

    function discardWorker() {
        if (worker) worker.terminate();
        worker = null;
        ready = false;
        loading = false;
    }

    function warmUp() {
        if (!window.Worker) return;
        if (!worker) createWorker();
        if (!ready && !loading) {
            loading = true;
            status("loading");
            worker.postMessage({ type: "warm-up" });
        }
    }

    function startTimer() {
        if (current && !current.timer && current.timeoutMs) {
            current.timer = setTimeout(function () { stop("timeout"); }, current.timeoutMs);
        }
    }

    function onMessage(event) {
        var m = event.data || {};

        if (m.type === "ready") {
            ready = true;
            loading = false;
            version = m.version || "";
            status("ready", version);
            startTimer();
            return;
        }

        if (m.type === "load-error") {
            discardWorker();
            status("load-error", m.text);
            finish("load-error", { text: m.text });
            return;
        }

        if (!current || m.id !== current.id) return;

        if (m.type === "stdout" || m.type === "stderr" || m.type === "stdin") {
            current.lines += 1;
            current.chars += (m.text || "").length;
            if (current.lines > MAX_LINES || current.chars > MAX_CHARS) {
                stop("limit");
                return;
            }
            current.onOutput(m.type, m.text || "");
        } else if (m.type === "done") {
            finish("done", { ms: m.ms });
        } else if (m.type === "error") {
            finish("error", { text: m.text, ms: m.ms });
        }
    }

    function finish(state, extra) {
        if (!current) return;
        var run = current;
        current = null;
        if (run.timer) clearTimeout(run.timer);
        var result = { status: state, ms: (extra && extra.ms) || Math.round(performance.now() - run.started), text: (extra && extra.text) || "" };
        run.resolve(result);
    }

    function run(options) {
        options = options || {};
        if (current) stop("stopped");
        if (!window.Worker) {
            return Promise.resolve({ status: "load-error", ms: 0, text: "This browser cannot run Python (Web Workers are not available)." });
        }

        if (!worker) createWorker();
        if (!ready && !loading) {
            loading = true;
            status("loading");
        }

        return new Promise(function (resolve) {
            var id = nextId++;
            current = {
                id: id,
                resolve: resolve,
                onOutput: options.onOutput || function () { },
                lines: 0,
                chars: 0,
                timer: null,
                timeoutMs: options.timeoutMs || 10000,
                started: performance.now()
            };

            // The time limit starts when Python is ready, so a slow download never counts.
            if (ready) startTimer();

            worker.postMessage({ id: id, code: String(options.code || ""), globals: options.globals || {}, stdin: options.stdin || "" });
        });
    }

    function stop(reason) {
        if (!current) return;
        discardWorker();   // the only way to interrupt running Python: start a new worker next time
        finish(reason || "stopped");
    }


    // ------------------------------------------------------------- runnable programs
    // INPUT and TARGET are set by the Sandbox from the input box (left) and the
    // Test Target menu. The globals().get(...) defaults let the same file run anywhere.

    var templates = {};

    templates.BST = [
        "# Binary search tree - this runs for real in your browser (Python 3.14).",
        "# INPUT  = the \"Node Insertion Sequence\" box on the left",
        "# TARGET = the Test Target menu, e.g. \"search:40\" or \"inorder\"",
        "INPUT = globals().get(\"INPUT\", \"50, 30, 70, 20, 40, 60, 80\")",
        "TARGET = globals().get(\"TARGET\", \"search:40\")",
        "",
        "",
        "class Node:",
        "    def __init__(self, key):",
        "        self.key = key",
        "        self.left = None",
        "        self.right = None",
        "",
        "",
        "def insert(root, key):",
        "    if root is None:",
        "        return Node(key)",
        "    if key < root.key:",
        "        root.left = insert(root.left, key)",
        "    elif key > root.key:",
        "        root.right = insert(root.right, key)",
        "    return root                     # duplicates are ignored",
        "",
        "",
        "def search(root, key):",
        "    path = []",
        "    while root is not None:",
        "        path.append(root.key)",
        "        if key == root.key:",
        "            return True, path",
        "        root = root.left if key < root.key else root.right",
        "    return False, path",
        "",
        "",
        "def inorder(root):",
        "    return [] if root is None else inorder(root.left) + [root.key] + inorder(root.right)",
        "",
        "",
        "def height(root):",
        "    return 0 if root is None else 1 + max(height(root.left), height(root.right))",
        "",
        "",
        "root = None",
        "for key in [int(v) for v in INPUT.replace(\",\", \" \").split()]:",
        "    root = insert(root, key)",
        "    print(f\"insert {key:>3}   height is now {height(root)}\")",
        "",
        "print(\"In-order (sorted):\", inorder(root))",
        "",
        "if TARGET.startswith(\"search:\"):",
        "    text = TARGET.split(\":\", 1)[1]",
        "    if text.lstrip(\"-\").isdigit():",
        "        found, path = search(root, int(text))",
        "        print(f\"search {text}:\", \"found\" if found else \"not found\", \"| path:\", \" -> \".join(map(str, path)))",
        "    else:",
        "        print(\"Type a key in the box next to the Test Target menu.\")"
    ].join("\n");

    templates.LinkedList = [
        "# Singly linked list - this runs for real in your browser (Python 3.14).",
        "# INPUT  = the \"Append Sequence\" box on the left",
        "# TARGET = the Test Target menu, e.g. \"find:30\" or \"headTail\"",
        "INPUT = globals().get(\"INPUT\", \"10, 20, 30, 40, 50\")",
        "TARGET = globals().get(\"TARGET\", \"find:30\")",
        "",
        "",
        "class Node:",
        "    def __init__(self, data):",
        "        self.data = data",
        "        self.next = None",
        "",
        "",
        "class SinglyLinkedList:",
        "    def __init__(self):",
        "        self.head = None",
        "        self.tail = None",
        "        self.size = 0",
        "",
        "    def append(self, data):          # O(1) thanks to the tail pointer",
        "        node = Node(data)",
        "        if self.head is None:",
        "            self.head = self.tail = node",
        "        else:",
        "            self.tail.next = node",
        "            self.tail = node",
        "        self.size += 1",
        "",
        "    def find(self, value):           # O(n): walk from the head",
        "        current, index = self.head, 0",
        "        while current is not None:",
        "            if current.data == value:",
        "                return index",
        "            current, index = current.next, index + 1",
        "        return -1",
        "",
        "    def __str__(self):",
        "        parts, current = [], self.head",
        "        while current is not None:",
        "            parts.append(str(current.data))",
        "            current = current.next",
        "        return \" -> \".join(parts + [\"None\"])",
        "",
        "",
        "items = SinglyLinkedList()",
        "for value in [int(v) for v in INPUT.replace(\",\", \" \").split()]:",
        "    items.append(value)",
        "    print(f\"append {value:>3}:  {items}\")",
        "",
        "if TARGET.startswith(\"find:\"):",
        "    text = TARGET.split(\":\", 1)[1]",
        "    if text.lstrip(\"-\").isdigit():",
        "        index = items.find(int(text))",
        "        print(f\"find {text}:\", f\"found at index {index}\" if index >= 0 else \"not in the list\")",
        "    else:",
        "        print(\"Type a value in the box next to the Test Target menu.\")",
        "elif TARGET == \"headTail\":",
        "    print(\"HEAD:\", items.head.data if items.head else None,",
        "          \"| TAIL:\", items.tail.data if items.tail else None, \"| size:\", items.size)"
    ].join("\n");

    templates.DoublyLinkedList = [
        "# Doubly linked list - this runs for real in your browser (Python 3.14).",
        "# INPUT  = the \"Append Sequence\" box on the left",
        "# TARGET = the Test Target menu, e.g. \"removeTail\" or \"find:20\"",
        "INPUT = globals().get(\"INPUT\", \"10, 20, 30, 40\")",
        "TARGET = globals().get(\"TARGET\", \"removeTail\")",
        "",
        "",
        "class DNode:",
        "    def __init__(self, value):",
        "        self.value = value",
        "        self.prev = None",
        "        self.next = None",
        "",
        "",
        "class DoublyLinkedList:",
        "    def __init__(self):",
        "        self.head = None",
        "        self.tail = None",
        "",
        "    def append(self, value):",
        "        node = DNode(value)",
        "        if self.tail is None:",
        "            self.head = self.tail = node",
        "        else:",
        "            node.prev = self.tail",
        "            self.tail.next = node",
        "            self.tail = node",
        "",
        "    def remove_tail(self):           # O(1): tail.prev is the new tail",
        "        if self.tail is None:",
        "            return None",
        "        removed = self.tail",
        "        self.tail = removed.prev",
        "        if self.tail is None:",
        "            self.head = None",
        "        else:",
        "            self.tail.next = None",
        "        return removed.value",
        "",
        "    def find(self, value):",
        "        current, index = self.head, 0",
        "        while current is not None:",
        "            if current.value == value:",
        "                return index",
        "            current, index = current.next, index + 1",
        "        return -1",
        "",
        "    def forward(self):",
        "        out, current = [], self.head",
        "        while current:",
        "            out.append(current.value)",
        "            current = current.next",
        "        return out",
        "",
        "    def backward(self):",
        "        out, current = [], self.tail",
        "        while current:",
        "            out.append(current.value)",
        "            current = current.prev",
        "        return out",
        "",
        "",
        "items = DoublyLinkedList()",
        "for value in [int(v) for v in INPUT.replace(\",\", \" \").split()]:",
        "    items.append(value)",
        "print(\"forward :\", \" <-> \".join(map(str, items.forward())))",
        "print(\"backward:\", \" <-> \".join(map(str, items.backward())))",
        "",
        "if TARGET == \"removeTail\":",
        "    print(\"removed tail:\", items.remove_tail(), \"| list now:\", items.forward())",
        "elif TARGET.startswith(\"find:\"):",
        "    text = TARGET.split(\":\", 1)[1]",
        "    if text.lstrip(\"-\").isdigit():",
        "        index = items.find(int(text))",
        "        print(f\"find {text}:\", f\"found at index {index}\" if index >= 0 else \"not in the list\")",
        "    else:",
        "        print(\"Type a value in the box next to the Test Target menu.\")"
    ].join("\n");

    templates.Stack = [
        "# Stack (LIFO) - this runs for real in your browser (Python 3.14).",
        "# INPUT  = the \"Stack Operations\" box, e.g. \"push 15, push 30, pop\"",
        "# TARGET = the Test Target menu: \"peek\" or \"popAll\"",
        "INPUT = globals().get(\"INPUT\", \"push 15, push 30, push 45, pop, push 60\")",
        "TARGET = globals().get(\"TARGET\", \"peek\")",
        "",
        "",
        "class Stack:",
        "    def __init__(self):",
        "        self._items = []",
        "",
        "    def push(self, value):          # O(1)",
        "        self._items.append(value)",
        "",
        "    def pop(self):                  # O(1)",
        "        if self.is_empty():",
        "            raise IndexError(\"pop from an empty stack (underflow)\")",
        "        return self._items.pop()",
        "",
        "    def peek(self):",
        "        return None if self.is_empty() else self._items[-1]",
        "",
        "    def is_empty(self):",
        "        return not self._items",
        "",
        "    def __str__(self):",
        "        return \"bottom \" + str(self._items) + \" top\"",
        "",
        "",
        "stack = Stack()",
        "for step in [s.strip() for s in INPUT.split(\",\") if s.strip()]:",
        "    words = step.split()",
        "    try:",
        "        if words[0].lower() == \"push\" and len(words) == 2 and words[1].lstrip(\"-\").isdigit():",
        "            stack.push(int(words[1]))",
        "            print(f\"{step:<10} {stack}\")",
        "        elif words[0].lower() == \"pop\":",
        "            value = stack.pop()",
        "            print(f\"{step:<10} {stack}   (popped {value})\")",
        "        else:",
        "            print(f\"{step:<10} skipped: use 'push N' or 'pop'\")",
        "    except IndexError as error:",
        "        print(f\"{step:<10} {error}\")",
        "",
        "if TARGET == \"peek\":",
        "    print(\"peek ->\", stack.peek())",
        "elif TARGET == \"popAll\":",
        "    order = []",
        "    while not stack.is_empty():",
        "        order.append(stack.pop())",
        "    print(\"drained in LIFO order:\", order)"
    ].join("\n");

    templates.Queue = [
        "# Queue (FIFO) - this runs for real in your browser (Python 3.14).",
        "# INPUT  = the \"Queue Operations\" box, e.g. \"enqueue 10, enqueue 20, dequeue\"",
        "# TARGET = the Test Target menu: \"front\" or \"dequeueNext\"",
        "from collections import deque",
        "",
        "INPUT = globals().get(\"INPUT\", \"enqueue 10, enqueue 20, enqueue 30, dequeue, enqueue 40\")",
        "TARGET = globals().get(\"TARGET\", \"front\")",
        "",
        "queue = deque()                    # O(1) at both ends",
        "",
        "for step in [s.strip() for s in INPUT.split(\",\") if s.strip()]:",
        "    words = step.split()",
        "    if words[0].lower() == \"enqueue\" and len(words) == 2 and words[1].lstrip(\"-\").isdigit():",
        "        queue.append(int(words[1]))",
        "        print(f\"{step:<12} front {list(queue)} rear\")",
        "    elif words[0].lower() == \"dequeue\":",
        "        if queue:",
        "            value = queue.popleft()",
        "            print(f\"{step:<12} front {list(queue)} rear   (removed {value})\")",
        "        else:",
        "            print(f\"{step:<12} the queue is empty (underflow)\")",
        "    else:",
        "        print(f\"{step:<12} skipped: use 'enqueue N' or 'dequeue'\")",
        "",
        "if TARGET == \"front\":",
        "    print(\"FRONT:\", queue[0] if queue else None, \"| REAR:\", queue[-1] if queue else None)",
        "elif TARGET == \"dequeueNext\":",
        "    print(\"next out (FIFO):\", queue.popleft() if queue else \"nothing - the queue is empty\")"
    ].join("\n");

    templates.MinHeap = [
        "# Binary min-heap stored in a list - this runs for real in your browser (Python 3.14).",
        "# INPUT  = the \"Heap Insertion Sequence\" box",
        "# TARGET = the Test Target menu: \"peekMin\" or \"extractMin\"",
        "INPUT = globals().get(\"INPUT\", \"40, 25, 60, 10, 30, 50, 15\")",
        "TARGET = globals().get(\"TARGET\", \"extractMin\")",
        "",
        "heap = []",
        "",
        "",
        "def sift_up(i):",
        "    while i > 0:",
        "        parent = (i - 1) // 2",
        "        if heap[i] >= heap[parent]:",
        "            break",
        "        heap[i], heap[parent] = heap[parent], heap[i]",
        "        i = parent",
        "",
        "",
        "def sift_down(i):",
        "    n = len(heap)",
        "    while True:",
        "        left, right, smallest = 2 * i + 1, 2 * i + 2, i",
        "        if left < n and heap[left] < heap[smallest]:",
        "            smallest = left",
        "        if right < n and heap[right] < heap[smallest]:",
        "            smallest = right",
        "        if smallest == i:",
        "            return",
        "        heap[i], heap[smallest] = heap[smallest], heap[i]",
        "        i = smallest",
        "",
        "",
        "def insert(value):                 # O(log n)",
        "    heap.append(value)",
        "    sift_up(len(heap) - 1)",
        "",
        "",
        "def extract_min():                 # O(log n)",
        "    smallest = heap[0]",
        "    last = heap.pop()",
        "    if heap:",
        "        heap[0] = last",
        "        sift_down(0)",
        "    return smallest",
        "",
        "",
        "for value in [int(v) for v in INPUT.replace(\",\", \" \").split()]:",
        "    insert(value)",
        "    print(f\"insert {value:>3}: {heap}\")",
        "",
        "if not heap:",
        "    print(\"The heap is empty.\")",
        "elif TARGET == \"peekMin\":",
        "    print(\"min (index 0):\", heap[0])",
        "elif TARGET == \"extractMin\":",
        "    print(\"extract min ->\", extract_min(), \"| heap now:\", heap)"
    ].join("\n");

    templates.HashTable = [
        "# Hash table with separate chaining - this runs for real in your browser (Python 3.14).",
        "# INPUT  = the \"Keys to Hash\" box",
        "# TARGET = the Test Target menu, e.g. \"buckets=7\" (hash = key mod 7)",
        "INPUT = globals().get(\"INPUT\", \"15, 22, 8, 29, 3, 17\")",
        "TARGET = globals().get(\"TARGET\", \"buckets=7\")",
        "",
        "size = int(TARGET.split(\"=\")[1]) if TARGET.startswith(\"buckets=\") else 7",
        "buckets = [[] for _ in range(size)]",
        "",
        "",
        "def put(key):",
        "    index = key % size",
        "    chain = buckets[index]",
        "    if key in chain:",
        "        return index, False",
        "    chain.append(key)",
        "    return index, True",
        "",
        "",
        "collisions = 0",
        "for key in [int(v) for v in INPUT.replace(\",\", \" \").split()]:",
        "    index, added = put(key)",
        "    if added and len(buckets[index]) > 1:",
        "        collisions += 1",
        "    note = \"collision\" if added and len(buckets[index]) > 1 else (\"duplicate\" if not added else \"\")",
        "    print(f\"put {key:>3}: {key} mod {size} = {index}  {note}\")",
        "",
        "print()",
        "for index, chain in enumerate(buckets):",
        "    print(f\"bucket {index}: {chain}\")",
        "",
        "count = sum(len(chain) for chain in buckets)",
        "print(f\"load factor = {count}/{size} = {count / size:.2f}, collisions: {collisions}\")"
    ].join("\n");

    var graphParse = [
        "def read_graph(text):",
        "    graph = {}",
        "    for edge in [e.strip() for e in text.split(\",\") if e.strip()]:",
        "        a, b = [v.strip() for v in edge.split(\"-\", 1)]",
        "        graph.setdefault(a, set()).add(b)",
        "        graph.setdefault(b, set()).add(a)       # undirected",
        "    return {v: sorted(n) for v, n in sorted(graph.items())}",
        "",
        "",
        "graph = read_graph(INPUT)",
        "start = TARGET.split(\"=\", 1)[1] if TARGET.startswith(\"start=\") else next(iter(graph), \"A\")",
        "for vertex, neighbours in graph.items():",
        "    print(f\"{vertex}: {neighbours}\")",
        "print()"
    ];

    templates.BFS = [
        "# Breadth-first search - this runs for real in your browser (Python 3.14).",
        "# INPUT  = the \"Undirected Edges\" box, e.g. \"A-B, A-C, B-D\"",
        "# TARGET = the Test Target menu, e.g. \"start=A\"",
        "from collections import deque",
        "",
        "INPUT = globals().get(\"INPUT\", \"A-B, A-C, B-D, B-E, C-F, E-F\")",
        "TARGET = globals().get(\"TARGET\", \"start=A\")",
        "",
        ""
    ].concat(graphParse, [
        "if start not in graph:",
        "    print(f\"'{start}' is not a vertex of this graph.\")",
        "else:",
        "    visited, queue, order = {start}, deque([start]), []",
        "    while queue:",
        "        vertex = queue.popleft()                 # FIFO: oldest first",
        "        order.append(vertex)",
        "        for neighbour in graph[vertex]:",
        "            if neighbour not in visited:",
        "                visited.add(neighbour)",
        "                queue.append(neighbour)",
        "        print(f\"visit {vertex}   queue: {list(queue)}\")",
        "    print(\"BFS order:\", \" -> \".join(order))"
    ]).join("\n");

    templates.DFS = [
        "# Depth-first search - this runs for real in your browser (Python 3.14).",
        "# INPUT  = the \"Undirected Edges\" box, e.g. \"A-B, A-C, B-D\"",
        "# TARGET = the Test Target menu, e.g. \"start=A\"",
        "INPUT = globals().get(\"INPUT\", \"A-B, A-C, B-D, B-E, C-F, E-F\")",
        "TARGET = globals().get(\"TARGET\", \"start=A\")",
        "",
        ""
    ].concat(graphParse, [
        "order = []",
        "",
        "",
        "def dfs(vertex, visited, depth=0):",
        "    visited.add(vertex)",
        "    order.append(vertex)",
        "    print(\"  \" * depth + f\"visit {vertex}\")",
        "    for neighbour in graph[vertex]:              # alphabetical order",
        "        if neighbour not in visited:",
        "            dfs(neighbour, visited, depth + 1)",
        "",
        "",
        "if start not in graph:",
        "    print(f\"'{start}' is not a vertex of this graph.\")",
        "else:",
        "    dfs(start, set())",
        "    print(\"DFS order:\", \" -> \".join(order))"
    ]).join("\n");

    templates.Dijkstra = [
        "# Dijkstra's shortest paths - this runs for real in your browser (Python 3.14).",
        "# INPUT  = the \"Weighted Edges\" box, e.g. \"A-B:4, A-C:2\"",
        "# TARGET = the Test Target menu, e.g. \"start=A\"",
        "import heapq",
        "",
        "INPUT = globals().get(\"INPUT\", \"A-B:4, A-C:2, B-C:1, B-D:5, C-D:8, C-E:10, D-E:2\")",
        "TARGET = globals().get(\"TARGET\", \"start=A\")",
        "",
        "graph = {}",
        "for edge in [e.strip() for e in INPUT.split(\",\") if e.strip()]:",
        "    ends, weight = edge.split(\":\")",
        "    a, b = [v.strip() for v in ends.split(\"-\", 1)]",
        "    graph.setdefault(a, []).append((b, int(weight)))",
        "    graph.setdefault(b, []).append((a, int(weight)))   # undirected",
        "",
        "start = TARGET.split(\"=\", 1)[1] if TARGET.startswith(\"start=\") else \"A\"",
        "",
        "if start not in graph:",
        "    print(f\"'{start}' is not a vertex of this graph.\")",
        "else:",
        "    dist = {v: float(\"inf\") for v in graph}",
        "    previous = {}",
        "    dist[start] = 0",
        "    frontier = [(0, start)]                     # min-priority queue",
        "",
        "    while frontier:",
        "        d, vertex = heapq.heappop(frontier)",
        "        if d > dist[vertex]:",
        "            continue                            # stale entry",
        "        print(f\"settle {vertex} at distance {d}\")",
        "        for neighbour, weight in graph[vertex]:",
        "            if d + weight < dist[neighbour]:",
        "                dist[neighbour] = d + weight",
        "                previous[neighbour] = vertex",
        "                heapq.heappush(frontier, (dist[neighbour], neighbour))",
        "                print(f\"   relax {vertex}-{neighbour}: {neighbour} = {dist[neighbour]}\")",
        "",
        "    print()",
        "    for vertex in sorted(graph):",
        "        path, step = [], vertex",
        "        while step in previous or step == start:",
        "            path.append(step)",
        "            if step == start:",
        "                break",
        "            step = previous[step]",
        "        shown = \" -> \".join(reversed(path)) if dist[vertex] < float(\"inf\") else \"unreachable\"",
        "        print(f\"{start} to {vertex}: {dist[vertex]:>3}   {shown}\")"
    ].join("\n");

    window.SandboxPython = {
        templates: templates,
        warmUp: warmUp,
        run: run,
        stop: stop,
        isRunning: function () { return current !== null; },
        isReady: function () { return ready; },
        version: function () { return version; },
        onStatus: function (fn) { listeners.push(fn); }
    };
})();
