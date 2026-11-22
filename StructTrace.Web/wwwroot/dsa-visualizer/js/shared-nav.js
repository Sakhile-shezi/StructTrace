document.addEventListener("DOMContentLoaded", () => {
    const MODULES = [
        { num: 1, title: "1. Big-O", full: "Module 1: Foundations & Big-O", path: "module-01-foundations/index.html" },
        { num: 2, title: "2. Linked Lists", full: "Module 2: Singly, Doubly & Circular Lists", path: "module-02-linked-lists/index.html" },
        { num: 3, title: "3. Stacks & Queues", full: "Module 3: Stacks, Queues & Deques", path: "module-03-stacks-queues/index.html" },
        { num: 4, title: "4. Heaps", full: "Module 4: Binary Min-Heaps", path: "module-04-heaps/index.html" },
        { num: 5, title: "5. BST", full: "Module 5: Binary Search Trees", path: "module-05-bst/index.html" },
        { num: 6, title: "6. Balanced Trees", full: "Module 6: AVL & Red-Black Trees", path: "module-06-balanced-trees/index.html" },
        { num: 7, title: "7. Hashing", full: "Module 7: Sets, Maps & Hash Tables", path: "module-07-hashing/index.html" },
        { num: 8, title: "8. Graphs", full: "Module 8: Graphs & Traversals", path: "module-08-graphs-algorithms/index.html" }, 
        { num: 9, title: "9. Algorithms", full: "Module 9: Dijkstra & Classic Algorithms", path: "module-09-dijkstra-algorithm/index.html" },
    ];

    const currentPath = window.location.pathname.toLowerCase();
    const activeIndex = MODULES.findIndex((m) => currentPath.includes(m.path.split("/")[0]));
    const isRootHub = activeIndex === -1;
    const prefix = isRootHub ? "" : "../";

    // Point DSAVisual brand link to cache-busted 9-module hub
    const brandLink = document.querySelector(".site-header .brand");
    if (brandLink) {
        brandLink.setAttribute("href", `${prefix}index.html?v=2`);
    }

    // Render unified top navigation bar across root hub and all 9 modules
    const navList = document.querySelector(".site-header .nav-links");
    if (navList) {
        const moduleLinks = MODULES.map((m, idx) => {
            const isActive = idx === activeIndex ? ' class="active"' : "";
            return `<li><a href="${prefix}${m.path}"${isActive}>${m.title}</a></li>`;
        }).join("");

        const appLinks = `
      <li><a href="/" class="nav-app-link" style="border: 1px solid #334155; color: #e2e8f0; margin-left: 0.25rem;">Home</a></li>
      <li><a href="/Sandbox" class="nav-app-link nav-sandbox-link" style="border: 1px solid #1d4ed8; color: #93c5fd;">Sandbox</a></li>
      <li><a href="/account/instant-logout" class="nav-app-link nav-logout-link" style="border: 1px solid #7f1d1d; color: #fca5a5;">Logout</a></li>
    `;

        navList.innerHTML = moduleLinks + appLinks;
    }

    // Render sequential Previous / Next footer navigation on module pages
    const mainEl = document.querySelector("main.container");
    if (mainEl && !isRootHub) {
        const prevMod = activeIndex > 0 ? MODULES[activeIndex - 1] : null;
        const nextMod = activeIndex < MODULES.length - 1 ? MODULES[activeIndex + 1] : null;

        const footerNav = document.createElement("nav");
        footerNav.className = "module-seq-nav";
        footerNav.setAttribute("aria-label", "Sequential Module Navigation");

        footerNav.innerHTML = `
      <div>
        ${prevMod
                ? `<a href="${prefix}${prevMod.path}" class="btn secondary">← ${prevMod.full}</a>`
                : `<a href="${prefix}index.html?v=2" class="btn secondary">← Curriculum Hub</a>`
            }
      </div>
      <div>
        ${nextMod
                ? `<a href="${prefix}${nextMod.path}" class="btn primary">${nextMod.full} →</a>`
                : `<a href="${prefix}index.html?v=2" class="btn primary">Finish & Return to Hub →</a>`
            }
      </div>
    `;
        mainEl.appendChild(footerNav);
    }
});