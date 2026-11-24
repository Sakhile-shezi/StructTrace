document.addEventListener("DOMContentLoaded", () => {
    const MODULES = [
        { num: 1, title: "1. Big-O", full: "Topic 1: Foundations & Big-O", path: "topic-01-foundations/index.html" },
        { num: 2, title: "2. Linked Lists", full: "Topic 2: Singly, Doubly & Circular Lists", path: "topic-02-linked-lists/index.html" },
        { num: 3, title: "3. Stacks & Queues", full: "Topic 3: Stacks, Queues & Deques", path: "topic-03-stacks-queues/index.html" },
        { num: 4, title: "4. Heaps", full: "Topic 4: Binary Min-Heaps", path: "topic-04-heaps/index.html" },
        { num: 5, title: "5. BST", full: "Topic 5: Binary Search Trees", path: "topic-05-bst/index.html" },
        { num: 6, title: "6. Balanced Trees", full: "Topic 6: AVL & Red-Black Trees", path: "topic-06-balanced-trees/index.html" },
        { num: 7, title: "7. Hashing", full: "Topic 7: Sets, Maps & Hash Tables", path: "topic-07-hashing/index.html" },
        { num: 8, title: "8. Graphs", full: "Topic 8: Graphs & Traversals", path: "topic-08-graphs-algorithms/index.html" }, 
        { num: 9, title: "9. Algorithms", full: "Topic 9: Dijkstra & Classic Algorithms", path: "topic-09-dijkstra-algorithm/index.html" },
    ];

    const currentPath = window.location.pathname.toLowerCase();
    const activeIndex = MODULES.findIndex((m) => currentPath.includes(m.path.split("/")[0]));
    const isRootHub = activeIndex === -1;
    const prefix = isRootHub ? "" : "../";

    // Point DSAVisual brand link to cache-busted 9-topic hub
    const brandLink = document.querySelector(".site-header .brand");
    if (brandLink) {
        brandLink.setAttribute("href", `${prefix}index.html?v=6`);
    }

    // Render unified top navigation bar across root hub and all 9 topics
    const navList = document.querySelector(".site-header .nav-links");
    if (navList) {
        const moduleLinks = MODULES.map((m, idx) => {
            const isActive = idx === activeIndex ? ' class="active"' : "";
            return `<li><a href="${prefix}${m.path}?v=6"${isActive}>${m.title}</a></li>`;
        }).join("");

        // Home, Code Sandbox, AIVisual, Admin, your name and Logout are in the
        // shared StructTrace top bar drawn by /js/visualizer-guard.js.
        const appLinks = "";

        navList.innerHTML = moduleLinks + appLinks;
    }

    // Render sequential Previous / Next footer navigation on topic pages
    const mainEl = document.querySelector("main.container");
    if (mainEl && !isRootHub) {
        const prevMod = activeIndex > 0 ? MODULES[activeIndex - 1] : null;
        const nextMod = activeIndex < MODULES.length - 1 ? MODULES[activeIndex + 1] : null;

        const footerNav = document.createElement("nav");
        footerNav.className = "module-seq-nav";
        footerNav.setAttribute("aria-label", "Sequential Topic Navigation");

        footerNav.innerHTML = `
      <div>
        ${prevMod
                ? `<a href="${prefix}${prevMod.path}?v=6" class="btn secondary">← ${prevMod.full}</a>`
                : `<a href="${prefix}index.html?v=6" class="btn secondary">← Curriculum Hub</a>`
            }
      </div>
      <div>
        ${nextMod
                ? `<a href="${prefix}${nextMod.path}?v=6" class="btn primary">${nextMod.full} →</a>`
                : `<a href="${prefix}index.html?v=6" class="btn primary">Finish & Return to Hub →</a>`
            }
      </div>
    `;
        mainEl.appendChild(footerNav);
    }
});