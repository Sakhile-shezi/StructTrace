using Microsoft.EntityFrameworkCore;
using StructTrace.Web.Models;

namespace StructTrace.Web.Data;

public static class DbSeeder
{
    public static async Task SeedLessonsAsync(ApplicationDbContext db)
    {
        if (!await db.Database.CanConnectAsync()) return;

        var existingSlugs = await db.Lessons.Select(l => l.Slug).ToListAsync();

        var lessons = new List<DataStructureLesson>
        {
            new()
            {
                Slug = "binary-search-tree",
                Title = "Binary Search Tree (BST)",
                Category = "Hierarchical Trees",
                TimeComplexity = "Avg O(log n) | Worst O(n)",
                SpaceComplexity = "O(n)",
                ConceptNotes = "Every node in the left subtree holds a key strictly less than its parent, and every node in the right subtree holds a key greater than its parent.",
                CppTemplate = "#include <iostream>\nstruct Node {\n    int val; Node *left, *right;\n    Node(int v) : val(v), left(nullptr), right(nullptr) {}\n};\nNode* insert(Node* root, int v) {\n    if (!root) return new Node(v);\n    if (v < root->val) root->left = insert(root->left, v);\n    else if (v > root->val) root->right = insert(root->right, v);\n    return root;\n}",
                JavaTemplate = "class Node {\n    int val; Node left, right;\n    Node(int v) { val = v; }\n}\nNode insert(Node root, int v) {\n    if (root == null) return new Node(v);\n    if (v < root.val) root.left = insert(root.left, v);\n    else if (v > root.val) root.right = insert(root.right, v);\n    return root;\n}",
                PythonTemplate = "class Node:\n    def __init__(self, val):\n        self.val, self.left, self.right = val, None, None\n\ndef insert(root, v):\n    if not root: return Node(v)\n    if v < root.val: root.left = insert(root.left, v)\n    elif v > root.val: root.right = insert(root.right, v)\n    return root",
                CSharpTemplate = "public class Node(int val) {\n    public int Val = val; public Node? Left, Right;\n}\nNode Insert(Node? root, int v) {\n    if (root is null) return new Node(v);\n    if (v < root.Val) root.Left = Insert(root.Left, v);\n    else if (v > root.Val) root.Right = Insert(root.Right, v);\n    return root;\n}"
            },
            new()
            {
                Slug = "singly-linked-list",
                Title = "Singly Linked List",
                Category = "Linear Structures",
                TimeComplexity = "Head O(1) | Tail/Search O(n)",
                SpaceComplexity = "O(n)",
                ConceptNotes = "A sequence of heap-allocated nodes where each node stores a value and a pointer/reference to the next node, ending at null.",
                CppTemplate = "struct Node {\n    int data; Node* next;\n    Node(int d) : data(d), next(nullptr) {}\n};\nvoid append(Node*& head, int val) {\n    if (!head) { head = new Node(val); return; }\n    Node* curr = head;\n    while (curr->next) curr = curr->next;\n    curr->next = new Node(val);\n}",
                JavaTemplate = "class Node {\n    int data; Node next;\n    Node(int d) { data = d; }\n}\nNode append(Node head, int val) {\n    if (head == null) return new Node(val);\n    Node curr = head;\n    while (curr.next != null) curr = curr.next;\n    curr.next = new Node(val);\n    return head;\n}",
                PythonTemplate = "class Node:\n    def __init__(self, data):\n        self.data, self.next = data, None\n\ndef append(head, val):\n    if not head: return Node(val)\n    curr = head\n    while curr.next: curr = curr.next\n    curr.next = Node(val)\n    return head",
                CSharpTemplate = "public class Node(int data) {\n    public int Data = data; public Node? Next;\n}\nNode Append(Node? head, int val) {\n    if (head is null) return new Node(val);\n    var curr = head;\n    while (curr.Next is not null) curr = curr.Next;\n    curr.Next = new Node(val);\n    return head;\n}"
            },
            new()
            {
                Slug = "stack-lifo",
                Title = "Stack (LIFO)",
                Category = "Linear Structures",
                TimeComplexity = "Push O(1) | Pop O(1) | Peek O(1)",
                SpaceComplexity = "O(n)",
                ConceptNotes = "A Last-In, First-Out (LIFO) abstract data type where insertions (push) and removals (pop) occur exclusively at the top pointer.",
                CppTemplate = "#include <vector>\nclass Stack {\n    std::vector<int> data;\npublic:\n    void push(int x) { data.push_back(x); }\n    void pop() { if (!data.empty()) data.pop_back(); }\n    int top() const { return data.back(); }\n};",
                JavaTemplate = "import java.util.ArrayDeque;\nclass IntStack {\n    private final ArrayDeque<Integer> stack = new ArrayDeque<>();\n    public void push(int x) { stack.push(x); }\n    public int pop() { return stack.pop(); }\n    public int peek() { return stack.peek(); }\n}",
                PythonTemplate = "class Stack:\n    def __init__(self):\n        self._items = []\n    def push(self, x): self._items.append(x)\n    def pop(self): return self._items.pop()\n    def peek(self): return self._items[-1]",
                CSharpTemplate = "public class IntStack {\n    private readonly Stack<int> _items = new();\n    public void Push(int x) => _items.Push(x);\n    public int Pop() => _items.Pop();\n    public int Peek() => _items.Peek();\n}"
            },
            new()
            {
                Slug = "graph-bfs",
                Title = "Graph Breadth-First Search (BFS)",
                Category = "Graphs & Traversal",
                TimeComplexity = "O(V + E)",
                SpaceComplexity = "O(V)",
                ConceptNotes = "BFS explores a graph level-by-level from a start vertex using a FIFO queue and a visited set, guaranteeing the shortest path in unweighted graphs.",
                CppTemplate = "#include <vector>\n#include <queue>\nstd::vector<int> bfs(int start, const std::vector<std::vector<int>>& adj) {\n    std::vector<int> order, vis(adj.size(), 0);\n    std::queue<int> q;\n    vis[start] = 1; q.push(start);\n    while (!q.empty()) {\n        int u = q.front(); q.pop();\n        order.push_back(u);\n        for (int v : adj[u]) if (!vis[v]) { vis[v] = 1; q.push(v); }\n    }\n    return order;\n}",
                JavaTemplate = "import java.util.*;\nList<Integer> bfs(int start, List<List<Integer>> adj) {\n    List<Integer> order = new ArrayList<>();\n    boolean[] vis = new boolean[adj.size()];\n    Queue<Integer> q = new ArrayDeque<>();\n    vis[start] = true; q.add(start);\n    while (!q.isEmpty()) {\n        int u = q.poll(); order.add(u);\n        for (int v : adj.get(u)) if (!vis[v]) { vis[v] = true; q.add(v); }\n    }\n    return order;\n}",
                PythonTemplate = "from collections import deque\ndef bfs(start, adj):\n    vis, order, q = {start}, [], deque([start])\n    while q:\n        u = q.popleft()\n        order.append(u)\n        for v in adj[u]:\n            if v not in vis:\n                vis.add(v)\n                q.append(v)\n    return order",
                CSharpTemplate = "List<int> Bfs(int start, List<int>[] adj) {\n    var order = new List<int>();\n    var vis = new bool[adj.Length];\n    var q = new Queue<int>();\n    vis[start] = true; q.Enqueue(start);\n    while (q.Count > 0) {\n        int u = q.Dequeue(); order.Add(u);\n        foreach (int v in adj[u]) if (!vis[v]) { vis[v] = true; q.Enqueue(v); }\n    }\n    return order;\n}"
            }
        };

        foreach (var lesson in lessons)
        {
            if (!existingSlugs.Contains(lesson.Slug))
            {
                db.Lessons.Add(lesson);
            }
        }

        await db.SaveChangesAsync();
    }
}