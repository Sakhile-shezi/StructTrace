document.addEventListener("DOMContentLoaded", () => {
    const MODULES = [
        { num: 1, title: "1. Big-O", full: "Module 1: Foundations & Big-O", path: "module-01-foundations/index.html" },
        { num: 2, title: "2. Linked Lists", full: "Module 2: Singly, Doubly & Circular Lists", path: "module-02-linked-lists/index.html" },
        { num: 3, title: "3. Stacks & Queues", full: "Module 3: Stacks, Queues & Deques", path: "module-03-stacks-queues/index.html" },
        { num: 4, title: "4. Heaps", full: "Module 4: Binary Min-Heaps", path: "module-04-heaps/index.html" },
        { num: 5, title: "5. BST", full: "Module 5: Binary Search Trees", path: "module-05-bst/index.html" },
        { num: 6, title: "6. Balanced Trees", full: "Module 6: AVL & Red-Black Trees", path: "module-06-balanced-trees/index.html" },
        { num: 7, title: "7. Hashing", full: "Module 7: Sets, Maps & Hash Tables", path: "module-07-hashing/index.html" },
        { num: 8, title: "8. Graphs & Algos", full: "Module 8: Graphs & Classic Algorithms", path: "module-08-graphs-algorithms/index.html" },
    ];

    const currentHref = window.location.href;
    const activeIndex = MODULES.findIndex((m) => currentHref.includes(m.path.split("/")[0]));
    const isRootHub = activeIndex === -1;
    const prefix = isRootHub ? "" : "../";

    // 1. Synchronize Top Navbar Links Across All Pages
    const navList = document.querySelector(".site-header .nav-links");
    if (navList) {
        const moduleLinks = MODULES.map((m, idx) => {
            const isActive = idx === activeIndex ? ' class="active"' : "";
            return `<li><a href="${prefix}${m.path}"${isActive}>${m.title}</a></li>`;
        }).join("");

        const backToAppLink = `<li><a href="/Sandbox" style="color: #93c5fd; border: 1px solid #334155;">← Sandbox</a></li>`;
        navList.innerHTML = moduleLinks + backToAppLink;
    }

    // 2. Inject Bottom Sequential Navigation Footer on Module Pages
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
                : `<a href="${prefix}index.html" class="btn secondary">← Curriculum Hub</a>`
            }
      </div>
      <div>
        ${nextMod
                ? `<a href="${prefix}${nextMod.path}" class="btn primary">${nextMod.full} →</a>`
                : `<a href="${prefix}index.html" class="btn primary">Finish & Return to Hub →</a>`
            }
      </div>
    `;
        mainEl.appendChild(footerNav);
    }
});