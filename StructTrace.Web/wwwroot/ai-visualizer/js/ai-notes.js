/* ---- core.js ---- */
/* AI Notes core helpers */
window.AIN = window.AIN || { engines: {}, problems: [] };
(function (A) {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.esc = esc;
  A.h = function (tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
    return e;
  };
  A.svgNS = 'http://www.w3.org/2000/svg';
  A.arrowDefs = id => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>`;
  // seeded RNG
  A.rng = function (seed) {
    let s = (seed >>> 0) || 1;
    const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    r.int = n => Math.floor(r() * n);
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    r.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    r.sample = (n, k) => r.shuffle([...Array(n).keys()]).slice(0, k);
    return r;
  };
  // binary heap
  A.Heap = class {
    constructor(cmp) { this.a = []; this.cmp = cmp; }
    get size() { return this.a.length; }
    push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (this.cmp(a[i], a[p]) < 0) { [a[i], a[p]] = [a[p], a[i]]; i = p; } else break; } }
    pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && this.cmp(a[l], a[m]) < 0) m = l; if (r < a.length && this.cmp(a[r], a[m]) < 0) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top; }
  };
  /* Stepper: shared prev / next / play / reset bar.
     opts: { count(), render(i), labels?:fn(i), start?:0 } */
  A.stepper = function (host, opts) {
    let i = opts.start || 0, timer = null;
    const label = A.h('span', { class: 'st-count', 'aria-live': 'polite' });
    const bPrev = A.h('button', { class: 'btn', type: 'button', onclick: () => go(i - 1), 'aria-label': 'Previous step' }, '◀ Back');
    const bNext = A.h('button', { class: 'btn primary', type: 'button', onclick: () => go(i + 1), 'aria-label': 'Next step' }, 'Next ▶');
    const bPlay = A.h('button', { class: 'btn', type: 'button', onclick: () => toggle() }, 'Play');
    const bReset = A.h('button', { class: 'btn ghost', type: 'button', onclick: () => { stop(); go(0); } }, 'Reset');
    const bEnd = A.h('button', { class: 'btn ghost', type: 'button', onclick: () => { stop(); go(opts.count() - 1); } }, 'Show all');
    const bar = A.h('div', { class: 'stepbar' }, bReset, bPrev, bNext, bPlay, bEnd, label);
    host.append(bar);
    function go(n) {
      const c = opts.count();
      i = Math.max(0, Math.min(c - 1, n));
      bPrev.disabled = i <= 0; bNext.disabled = i >= c - 1;
      label.textContent = opts.labels ? opts.labels(i) : `Step ${i + 1} of ${c}`;
      opts.render(i);
      if (i >= c - 1) stop();
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; bPlay.textContent = 'Play'; } }
    function toggle() {
      if (timer) return stop();
      if (i >= opts.count() - 1) go(0);
      bPlay.textContent = 'Pause';
      timer = setInterval(() => go(i + 1), opts.speed || 900);
    }
    bar.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { go(i + 1); e.preventDefault(); } if (e.key === 'ArrowLeft') { go(i - 1); e.preventDefault(); } });
    const api = { go, get i() { return i; }, stop, refresh: () => go(Math.min(i, opts.count() - 1)), bar };
    setTimeout(() => go(i), 0);
    return api;
  };
  // small line chart (SVG) for GA runs
  A.lineChart = function (svg, series, opts = {}) {
    const W = svg.clientWidth || 520, H = svg.clientHeight || 200;
    const m = { l: 48, r: 14, t: 12, b: 26 };
    const all = series.flatMap(s => s.values).filter(v => isFinite(v));
    if (!all.length) { svg.innerHTML = ''; return; }
    let lo = Math.min(...all), hi = Math.max(...all);
    if (lo === hi) { lo -= 1; hi += 1; }
    const n = Math.max(...series.map(s => s.values.length));
    const x = k => m.l + (n <= 1 ? 0 : (k / (n - 1)) * (W - m.l - m.r));
    const y = v => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
    let out = `<line x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}" class="axis"/>`;
    for (const v of [lo, (lo + hi) / 2, hi]) out += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" class="tick">${Math.round(v * 100) / 100}</text><line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`;
    out += `<text x="${W - m.r}" y="${H - 6}" text-anchor="end" class="tick">generation ${n - 1}</text><text x="${m.l}" y="${H - 6}" class="tick">0</text>`;
    for (const s of series) {
      const pts = s.values.map((v, k) => `${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      out += `<polyline points="${pts}" class="${s.cls || 'line'}" fill="none"/>`;
    }
    svg.innerHTML = out;
  };
  A.table = (heads, rows, cls = '') => `<div class="scroll"><table class="${cls}"><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${(r.cells || r).map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  A.chip = (t, cls = '') => `<span class="chip ${cls}">${t}</span>`;
})(window.AIN);

/* ---- engines/alphabeta.js ---- */
/* Alpha-beta pruning stepper on a printed game tree */
(function (A) {
  A.engines.alphaBeta = function (host, cfg) {
    const T = cfg.tree, root = cfg.root || 'A';
    // build node table
    const nodes = {}, edges = [], leaves = [];
    let leafN = 0;
    function build(id, depth, isMax, parentEdge) {
      const kids = T[id] || [];
      const n = { id, name: cfg.hideNames ? '' : id, depth, isMax, leaf: false, kids: [], parentEdge };
      nodes[id] = n;
      kids.forEach(([lab, c]) => {
        let cid;
        if (typeof c === 'number') {
          cid = 'leaf' + (leafN++);
          nodes[cid] = { id: cid, name: '', depth: depth + 1, isMax: !isMax, leaf: true, value: c, kids: [] };
        } else cid = c;
        const e = { id: 'e' + edges.length, from: id, to: cid, label: lab };
        edges.push(e); n.kids.push(e);
        if (typeof c === 'number') nodes[cid].parentEdge = e; else build(c, depth + 1, !isMax, e);
      });
    }
    build(root, 0, cfg.rootMax !== false, null);
    // layout
    let li = 0, maxD = 0;
    (function lay(id) {
      const n = nodes[id]; maxD = Math.max(maxD, n.depth);
      if (n.leaf || !n.kids.length) { n.x = li++; return; }
      n.kids.forEach(e => lay(e.to));
      n.x = (nodes[n.kids[0].to].x + nodes[n.kids[n.kids.length - 1].to].x) / 2;
    })(root);
    const SP = cfg.spacing || 46, W = Math.max(520, li * SP + 60), LV = cfg.levelGap || 86, H = maxD * LV + 34 + 26;
    const px = n => 30 + n.x * SP + SP / 2, py = n => 34 + n.depth * LV;
    // run alpha-beta, log events
    const ev = [];
    const fmt = v => v === Infinity ? '+∞' : v === -Infinity ? '−∞' : String(v);
    function subtreeEdges(id, out) { const n = nodes[id]; n.kids.forEach(e => { out.push(e.id); subtreeEdges(e.to, out); }); return out; }
    function run(id, a, b) {
      const n = nodes[id];
      if (n.leaf) { ev.push({ t: 'leaf', node: id, v: n.value, msg: `Leaf reached: value ${n.value}.` }); return n.value; }
      ev.push({ t: 'enter', node: id, a, b, msg: `Enter ${n.isMax ? 'MAX' : 'MIN'} node ${n.name || ''} with α = ${fmt(a)}, β = ${fmt(b)}.` });
      let v = n.isMax ? -Infinity : Infinity;
      for (let k = 0; k < n.kids.length; k++) {
        const e = n.kids[k];
        ev.push({ t: 'edge', edge: e.id, node: id });
        const cv = run(e.to, a, b);
        const old = v;
        v = n.isMax ? Math.max(v, cv) : Math.min(v, cv);
        const cut = cfg.prune !== false && (n.isMax ? v >= b : v <= a);
        if (cut) {
          const rest = n.kids.slice(k + 1);
          if (rest.length) {
            const inner = [];
            rest.forEach(r => subtreeEdges(r.to, inner));
            ev.push({ t: 'prune', node: id, v, a, b, cut: rest.map(r => r.id), inner, msg: `${n.name || 'Node'} now has v = ${fmt(v)} and ${n.isMax ? `v ≥ β (${fmt(b)})` : `v ≤ α (${fmt(a)})`}, so its remaining ${rest.length === 1 ? 'branch is' : rest.length + ' branches are'} pruned.` });
          } else ev.push({ t: 'update', node: id, v, a, b, msg: `${n.name || 'Node'}: v = ${fmt(v)} (${n.isMax ? `≥ β = ${fmt(b)}` : `≤ α = ${fmt(a)}`}), but there are no branches left to prune.` });
          ev.push({ t: 'ret', node: id, v, msg: `${n.name || 'Node'} returns ${fmt(v)}.` });
          return v;
        }
        if (n.isMax) a = Math.max(a, v); else b = Math.min(b, v);
        ev.push({ t: 'update', node: id, v, a, b, msg: `${n.name || 'Node'}: child returned ${fmt(cv)} → v = ${n.isMax ? 'max' : 'min'}(${fmt(old)}, ${fmt(cv)}) = ${fmt(v)}` + (cfg.prune === false ? '.' : `; ${n.isMax ? `α = ${fmt(a)}` : `β = ${fmt(b)}`}.`) });
      }
      ev.push({ t: 'ret', node: id, v, msg: `${n.name || 'Node'} returns ${fmt(v)}.` });
      return v;
    }
    const rootVal = run(root, -Infinity, Infinity);
    ev.push({ t: 'done', node: root, v: rootVal, msg: `Done. Root value = ${rootVal}.` });
    // UI
    const wrap = A.h('div', { class: 'ab' });
    const fig = A.h('div', { class: 'scroll figbox' });
    const svg = document.createElementNS(A.svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('class', 'abtree');
    fig.append(svg);
    const msg = A.h('div', { class: 'stepmsg' });
    const log = A.h('ol', { class: 'evlog' });
    wrap.append(fig);
    host.append(wrap);
    const st = A.stepper(host, { count: () => ev.length, render, speed: 700 });
    host.append(msg, A.h('details', { class: 'logbox' }, A.h('summary', null, 'Full event log'), log));
    log.innerHTML = ev.map((e, k) => `<li data-k="${k}">${e.msg || (e.t === 'edge' ? 'Follow branch ' + (edges.find(x => x.id === e.edge).label || '') : '')}</li>`).join('');
    function render(i) {
      const val = {}, ab = {}, trav = new Set(), cut = new Set(), inner = new Set(), seen = new Set();
      let cur = null;
      for (let k = 0; k <= i; k++) {
        const e = ev[k];
        if (e.t === 'enter') { ab[e.node] = [e.a, e.b]; seen.add(e.node); cur = e.node; }
        if (e.t === 'leaf') { val[e.node] = e.v; seen.add(e.node); cur = e.node; }
        if (e.t === 'edge') trav.add(e.edge);
        if (e.t === 'update' || e.t === 'prune') { val[e.node] = e.v; ab[e.node] = [e.a, e.b]; cur = e.node; }
        if (e.t === 'prune') { e.cut.forEach(x => cut.add(x)); e.inner.forEach(x => inner.add(x)); }
        if (e.t === 'ret') { val[e.node] = e.v; cur = e.node; }
      }
      let s = '';
      if (cfg.levelLabels) for (let d = 0; d <= maxD; d++) s += `<text x="6" y="${34 + d * LV + 5}" class="lvl">${cfg.levelLabels[d] || ''}</text>`;
      for (const e of edges) {
        const a = nodes[e.from], b = nodes[e.to];
        const x1 = px(a), y1 = py(a) + 14, x2 = px(b), y2 = py(b) - 14;
        const cls = cut.has(e.id) ? 'cut' : inner.has(e.id) ? 'inner' : trav.has(e.id) ? 'trav' : 'todo';
        s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="edge ${cls}"/>`;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        if (cut.has(e.id)) s += `<g class="xmark" transform="translate(${mx},${my})"><line x1="-7" y1="-7" x2="7" y2="7"/><line x1="-7" y1="7" x2="7" y2="-7"/></g>`;
        if (e.label && cfg.edgeLabels !== false) s += `<text x="${mx + (x2 > x1 ? 6 : x2 < x1 ? -6 : 7)}" y="${my - 4}" text-anchor="${x2 > x1 ? 'start' : x2 < x1 ? 'end' : 'start'}" class="elab">${e.label}</text>`;
      }
      for (const id in nodes) {
        const n = nodes[id], x = px(n), y = py(n);
        const isCur = id === cur, done = seen.has(id);
        if (n.leaf) {
          s += `<rect x="${x - 15}" y="${y - 13}" width="30" height="26" rx="3" class="leaf ${done ? 'seen' : ''} ${isCur ? 'cur' : ''}"/><text x="${x}" y="${y + 5}" text-anchor="middle" class="lv">${n.value}</text>`;
        } else {
          const tri = n.isMax ? `M${x},${y - 15} L${x + 17},${y + 13} L${x - 17},${y + 13} Z` : `M${x},${y + 15} L${x + 17},${y - 13} L${x - 17},${y - 13} Z`;
          s += `<path d="${tri}" class="nd ${n.isMax ? 'max' : 'min'} ${done ? 'seen' : ''} ${isCur ? 'cur' : ''}"/>`;
          s += `<text x="${x}" y="${y + (n.isMax ? 9 : -1)}" text-anchor="middle" class="nm">${n.name}</text>`;
          if (val[id] !== undefined && isFinite(val[id])) s += `<text x="${x + 20}" y="${y + 4}" class="nv">${val[id]}</text>`;
          if (isCur && ab[id] && !n.leaf && cfg.prune !== false) s += `<text x="${x}" y="${y - 20}" text-anchor="middle" class="abl">α ${fmt(ab[id][0])}  β ${fmt(ab[id][1])}</text>`;
        }
      }
      svg.innerHTML = s;
      const e = ev[i];
      msg.innerHTML = e.msg ? A.esc(e.msg) : (e.t === 'edge' ? `Follow branch ${A.esc(edges.find(x => x.id === e.edge).label || '')} down to ${A.esc(nodes[edges.find(x => x.id === e.edge).to].name || 'the child')}.` : '');
      [...log.children].forEach((li, k) => li.classList.toggle('on', k === i));
    }
    // final answer table
    const visitedNodes = new Set(ev.filter(e => e.t === 'enter').map(e => e.node));
    const finalVal = {};
    ev.forEach(e => { if (e.t === 'ret') finalVal[e.node] = e.v; });
    const named = Object.values(nodes).filter(n => !n.leaf && n.name).sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name));
    const allCut = new Set(ev.filter(e => e.t === 'prune').flatMap(e => e.cut));
    const allInner = new Set(ev.filter(e => e.t === 'prune').flatMap(e => e.inner));
    let res = `<h4>Answer sheet</h4><div class="ansgrid">`;
    if (named.length) res += A.table(['Node', 'Value'], named.map(n => [n.name, visitedNodes.has(n.id) ? `<b>${finalVal[n.id]}</b>` : '<span class="muted">NOT VISITED</span>']), 'compact');
    const lab = edges.filter(e => e.label);
    if (lab.length && cfg.prune !== false) res += A.table(['Branch', 'State'], lab.map(e => [e.label, allCut.has(e.id) ? '<b class="bad">PRUNED</b> (cut here)' : allInner.has(e.id) ? '<b class="bad">PRUNED</b> (inside a cut subtree)' : 'NOT PRUNED']), 'compact');
    res += `</div>`;
    const leafEval = ev.filter(e => e.t === 'leaf').length;
    res += cfg.prune === false ? `<p>Root value <b>${rootVal}</b> (plain minimax over all ${leafN} leaves).</p>` : `<p>Root value <b>${rootVal}</b>. Alpha-beta looked at <b>${leafEval}</b> of ${leafN} leaves.</p>`;
    host.append(A.h('div', { class: 'answer', html: res }));
  };
})(window.AIN);

/* ---- engines/csp.js ---- */
/* CSP engines: five-knights stepper, generic backtracking + forward checking, possible-world counter, truth tables */
(function (A) {
  // ---------- five knights on 3x3 ----------
  A.engines.knights = function (host, cfg) {
    const cols = ['A', 'B', 'C'];
    const att = (a, b) => { const dc = Math.abs(cols.indexOf(a[0]) - cols.indexOf(b[0])), dr = Math.abs(+a[1] - +b[1]); return (dc === 1 && dr === 2) || (dc === 2 && dr === 1); };
    const all = []; for (const c of cols) for (let r = 1; r <= 3; r++) all.push(c + r);
    const steps = cfg.steps;
    const board = A.h('div', { class: 'kboard-wrap' });
    const side = A.h('div', { class: 'kside' });
    host.append(A.h('div', { class: 'kgrid' }, board, side));
    const msg = A.h('div', { class: 'stepmsg' });
    A.stepper(host, { count: () => steps.length, render, labels: i => steps[i].label || `Step ${i + 1}` });
    host.append(msg);
    function render(i) {
      const s = steps[i], K = new Set(s.k);
      const attacked = new Set(all.filter(c => !K.has(c) && s.k.some(k => att(k, c))));
      let h = '<table class="kboard"><tr><th></th>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
      for (let r = 1; r <= 3; r++) {
        h += `<tr><th>${r}</th>`;
        for (const c of cols) { const id = c + r, dark = (cols.indexOf(c) + r) % 2 === 1; h += `<td class="${dark ? 'dk' : 'lt'} ${K.has(id) ? 'kn' : ''} ${attacked.has(id) ? 'att' : ''}">${K.has(id) ? '♞' : attacked.has(id) ? '✕' : ''}</td>`; }
        h += '</tr>';
      }
      board.innerHTML = h + '</table>';
      const dom = cols.map(c => { const rows = [1, 2, 3].filter(r => !K.has(c + r) && !attacked.has(c + r)); return `<div class="dom"><b>${c}</b> ${K.size && s.k.some(k => k[0] === c) ? 'has ' + s.k.filter(k => k[0] === c).map(k => k[1]).join(',') + '; ' : ''}free rows {${rows.join(', ')}}</div>`; }).join('');
      side.innerHTML = `<div class="answer-line">State: ${all.map(id => `${id}=${K.has(id) ? 'K' : '-'}`).join(' ')}</div>${dom}<p>Knights placed: <b>${K.size}</b>${s.k.length === 5 ? ' — solution' : ''}</p>`;
      msg.innerHTML = s.text;
    }
    // sandbox
    const sb = A.h('div', { class: 'sandbox' });
    host.append(A.h('h4', null, 'Try it yourself'), A.h('p', { class: 'muted' }, 'Click squares to place or remove knights. Attacked squares show ✕.'), sb);
    const placed = new Set();
    function drawSb() {
      const attacked = new Set(all.filter(c => !placed.has(c) && [...placed].some(k => att(k, c))));
      const clash = [...placed].filter(a => [...placed].some(b => b !== a && att(a, b)));
      let h = '<table class="kboard"><tr><th></th>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
      for (let r = 1; r <= 3; r++) { h += `<tr><th>${r}</th>`; for (const c of cols) { const id = c + r, dark = (cols.indexOf(c) + r) % 2 === 1; h += `<td data-id="${id}" tabindex="0" class="${dark ? 'dk' : 'lt'} ${placed.has(id) ? 'kn' : ''} ${attacked.has(id) ? 'att' : ''} ${clash.includes(id) ? 'clash' : ''}">${placed.has(id) ? '♞' : attacked.has(id) ? '✕' : ''}</td>`; } h += '</tr>'; }
      sb.innerHTML = h + `</table><p>${placed.size} knight${placed.size === 1 ? '' : 's'}${clash.length ? ' — <b class="bad">two knights attack each other</b>' : placed.size === 5 ? ' — <b class="good">valid 5-knight solution</b>' : ''}</p>`;
      sb.querySelectorAll('td[data-id]').forEach(td => { const t = () => { const id = td.dataset.id; placed.has(id) ? placed.delete(id) : placed.add(id); drawSb(); }; td.onclick = t; td.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } }; });
    }
    drawSb();
  };

  // ---------- generic backtracking (+ optional forward checking) ----------
  A.engines.csp = function (host, cfg) {
    const vars = cfg.vars, dom0 = cfg.domains; const cons = cfg.constraints; // [a,b,fn(va,vb),label]
    const ok = (asg, v, val) => cons.every(([a, b, f]) => { if (a === v && b in asg) return f(val, asg[b]); if (b === v && a in asg) return f(asg[a], val); return true; });
    const events = [];
    let fc = !!cfg.forwardChecking;
    function run() {
      events.length = 0;
      const domains = {}; vars.forEach(v => domains[v] = dom0[v].slice());
      (function bt(asg, doms, depth) {
        if (Object.keys(asg).length === vars.length) { events.push({ t: 'sol', asg: { ...asg }, doms, msg: 'Every variable assigned and all constraints hold: a model (solution)' + (cfg.all ? ' — record it and keep searching for more.' : '.') }); return !cfg.all; }
        const v = vars.find(x => !(x in asg));
        for (const val of doms[v]) {
          if (!ok(asg, v, val)) { events.push({ t: 'fail', asg: { ...asg, [v]: val }, doms, bad: v, msg: `Try ${v} = ${val}: violates a constraint with an assigned variable → prune.` }); continue; }
          const na = { ...asg, [v]: val };
          let nd = doms, wipe = null;
          if (fc) {
            nd = {}; vars.forEach(x => nd[x] = doms[x].slice()); nd[v] = [val];
            for (const x of vars) if (!(x in na)) { nd[x] = nd[x].filter(y => ok(na, x, y)); if (!nd[x].length && !wipe) wipe = x; }
          }
          events.push({ t: 'assign', asg: na, doms: nd, msg: `Assign ${v} = ${val}.` + (fc ? (wipe ? ` Forward checking empties dom(${wipe}) → backtrack.` : ' Forward check: cross out values that clash with it.') : '') });
          if (wipe) continue;
          if (bt(na, nd, depth + 1)) return true;
          events.push({ t: 'back', asg: { ...asg }, doms, msg: `Back up from ${v} = ${val} and try its next value.` });
        }
        return false;
      })({}, domains, 0);
    }
    run();
    const ctl = A.h('div', { class: 'ctlrow' });
    if (cfg.allowFcToggle !== false) {
      const cb = A.h('input', { type: 'checkbox', id: (cfg.id || 'csp') + '-fc', checked: fc, onchange: e => { fc = e.target.checked; run(); st.go(0); summary(); } });
      ctl.append(A.h('label', { class: 'chk', for: (cfg.id || 'csp') + '-fc' }, cb, ' Forward checking'));
    }
    host.append(ctl);
    const pic = A.h('div', { class: 'figbox scroll' });
    const domBox = A.h('div', { class: 'tracebox' });
    const msg = A.h('div', { class: 'stepmsg' });
    host.append(pic);
    const st = A.stepper(host, { count: () => events.length, render });
    host.append(msg, domBox);
    const sumBox = A.h('div', { class: 'answer' }); host.append(sumBox);
    function summary() { const sols = events.filter(e => e.t === 'sol'); if (cfg.all) { sumBox.innerHTML = `${fc ? 'With' : 'Without'} forward checking: <b>${events.filter(e => e.t === 'assign').length}</b> assignments, <b>${events.filter(e => e.t === 'fail').length}</b> rejected tries. Models found (${sols.length}): ${sols.map(e => '<b>(' + vars.map(v => v + '=' + e.asg[v]).join(', ') + ')</b>').join(' ')}`; return; } const sol = sols[0]; sumBox.innerHTML = `${fc ? 'With' : 'Without'} forward checking: <b>${events.filter(e => e.t === 'assign').length}</b> assignments and <b>${events.filter(e => e.t === 'fail').length}</b> rejected tries before the first model${sol ? ': <b>' + vars.map(v => v + ' = ' + sol.asg[v]).join(', ') + '</b>' : ' (no model)'}.`; }
    summary();
    function render(i) {
      const e = events[i];
      pic.innerHTML = cfg.draw ? cfg.draw(e.asg, e.doms, e) : '';
      domBox.innerHTML = A.table(['Variable', 'Value', 'Domain now'], vars.map(v => [v, v in e.asg ? `<b class="${e.t === 'fail' && e.bad === v ? 'bad' : ''}">${e.asg[v]}</b>` : '–', '{' + (e.doms[v] || []).join(', ') + '}']), 'compact');
      msg.textContent = e.msg;
    }
  };

  // ---------- possible-world counter ----------
  A.engines.worldCount = function (host, cfg) {
    const rows = cfg.examples;
    host.innerHTML = A.table(['Problem', 'Variables', 'Domain', 'Possible worlds'], rows.map(r => [r.name, r.vars, r.dom, `<b>${r.count}</b>`]), 'compact');
    const n = A.h('input', { type: 'number', id: 'wc-n', min: 1, max: 60, value: 7, class: 'inp' });
    const d = A.h('input', { type: 'number', id: 'wc-d', min: 1, max: 50, value: 3, class: 'inp' });
    const out = A.h('div', { class: 'big' });
    const calc = () => { const k = Math.max(1, +n.value || 1), s = Math.max(1, +d.value || 1); const v = BigInt(s) ** BigInt(k); out.innerHTML = `${s}<sup>${k}</sup> = ${v.toLocaleString('en-ZA')}`; };
    n.oninput = calc; d.oninput = calc;
    host.append(A.h('div', { class: 'calc' }, A.h('label', { for: 'wc-n' }, 'Variables k '), n, A.h('label', { for: 'wc-d' }, ' Domain size d '), d), out);
    calc();
  };

  // ---------- truth tables ----------
  A.engines.truthTable = function (host, cfg) {
    for (const t of cfg.tables) {
      const n = t.vars.length; const rows = [];
      for (let m = (1 << n) - 1; m >= 0; m--) {
        const v = {}; t.vars.forEach((x, k) => v[x] = !!(m >> (n - 1 - k) & 1));
        rows.push([...t.vars.map(x => v[x] ? 1 : 0), ...t.cols.map(c => c.f(v) ? 1 : 0)]);
      }
      const eq = t.equal ? rows.every(r => r[n + t.equal[0]] === r[n + t.equal[1]]) : null;
      host.append(A.h('h4', { html: t.title }));
      host.insertAdjacentHTML('beforeend', A.table([...t.vars, ...t.cols.map(c => c.label)], rows.map(r => r.map((x, k) => t.equal && (k === n + t.equal[0] || k === n + t.equal[1]) ? `<b>${x}</b>` : x)), 'compact tt'));
      if (eq !== null) host.append(A.h('p', { html: eq ? '<b class="good">The two bold columns match in all ' + rows.length + ' rows, so the formulas are equivalent.</b>' : '<b class="bad">The columns differ.</b>' }));
    }
  };
})(window.AIN);

/* ---- engines/ga.js ---- */
/* Genetic algorithm runner, operator lab, problem kinds; machine servicing editor; bit/digit chromosome lab */
(function (A) {
  A.gaKinds = {};
  A.engines.ga = function (host, cfg) {
    const K = A.gaKinds[cfg.kind];
    const P = { pop: cfg.pop || 30, gens: cfg.gens || 80, pc: cfg.pc ?? 0.9, pm: cfg.pm ?? 0.2, seed: cfg.seed || 7 };
    const better = K.better || 'max';
    const cmpF = (a, b) => better === 'max' ? b.f - a.f : a.f - b.f;
    const ctl = A.h('div', { class: 'gactl' });
    const mk = (k, label, step) => { const id = `${cfg.id || cfg.kind}-${k}`; const i = A.h('input', { type: 'number', id, value: P[k], step: step || 1, class: 'inp', onchange: e => { P[k] = +e.target.value; } }); ctl.append(A.h('label', { for: id }, label), i); };
    mk('pop', 'Population'); mk('gens', 'Generations'); mk('pc', 'Crossover rate', 0.05); mk('pm', 'Mutation rate', 0.05); mk('seed', 'Seed');
    host.append(ctl);
    const btns = A.h('div', { class: 'ctlrow' });
    host.append(btns);
    const chartBox = A.h('div', { class: 'chart' }); const svg = document.createElementNS(A.svgNS, 'svg'); chartBox.append(svg);
    const best = A.h('div', { class: 'gabest' });
    const popBox = A.h('div', { class: 'tracebox' });
    const lab = A.h('div', { class: 'galab' });
    host.append(A.h('div', { class: 'split' }, A.h('div', null, A.h('h4', null, `Best and mean fitness per generation${better === 'min' ? ' (lower is better)' : ''}`), chartBox), A.h('div', null, A.h('h4', null, 'Best so far'), best)), A.h('h4', null, 'Population (best first)'), popBox, A.h('h4', null, 'Operator lab'), lab);
    let rng, pop, gen, hist;
    const ev = ch => ({ ch, f: K.fitness(ch) });
    function reset() { rng = A.rng(P.seed); pop = Array.from({ length: P.pop }, () => ev(K.generate(rng))); pop.sort(cmpF); gen = 0; hist = { best: [pop[0].f], mean: [mean()] }; show(); }
    const mean = () => pop.reduce((s, x) => s + x.f, 0) / pop.length;
    const tour = () => { let b = null; for (let i = 0; i < 3; i++) { const c = pop[rng.int(pop.length)]; if (!b || cmpF(c, b) < 0) b = c; } return b; };
    function step() {
      const next = pop.slice(0, 2).map(x => ({ ch: x.ch.slice(), f: x.f })); // elitism
      while (next.length < P.pop) {
        const a = tour().ch, b = tour().ch;
        let kids = rng() < P.pc ? K.crossover(rng, a.slice(), b.slice()).kids : [a.slice(), b.slice()];
        kids = kids.map(k => rng() < P.pm ? K.mutate(rng, k.slice()).ch : k);
        kids.forEach(k => { if (next.length < P.pop) next.push(ev(k)); });
      }
      pop = next.sort(cmpF); gen++; hist.best.push(pop[0].f); hist.mean.push(mean());
    }
    function show() {
      A.lineChart(svg, [{ values: hist.mean, cls: 'line2' }, { values: hist.best, cls: 'line' }]);
      best.innerHTML = `<p>Generation <b>${gen}</b> · fitness <b>${round(pop[0].f)}</b>${K.optimum !== undefined ? ` · known optimum ${K.optimum}${pop[0].f === K.optimum ? ' <b class="good">reached</b>' : ''}` : ''}</p>` + K.show(pop[0].ch);
      popBox.innerHTML = A.table(['#', 'Chromosome', 'Fitness'], pop.slice(0, 8).map((x, i) => [i + 1, `<code>${K.str ? K.str(x.ch) : x.ch.join(' ')}</code>`, round(x.f)]), 'compact');
    }
    const round = v => Math.round(v * 100) / 100;
    btns.append(
      A.h('button', { class: 'btn primary', type: 'button', onclick: () => { reset(); for (let g = 0; g < P.gens; g++) step(); show(); } }, 'Run all generations'),
      A.h('button', { class: 'btn', type: 'button', onclick: () => { step(); show(); } }, 'Step one generation'),
      A.h('button', { class: 'btn ghost', type: 'button', onclick: reset }, 'New population'));
    // operator lab
    const labOut = A.h('div');
    const parents = () => cfg.labParents ? cfg.labParents.map(p => p.slice()) : [pop[0].ch.slice(), pop[1].ch.slice()];
    lab.append(A.h('div', { class: 'ctlrow' },
      A.h('button', { class: 'btn', type: 'button', onclick: () => { const [a, b] = parents(); const r = K.crossover(rng, a.slice(), b.slice()); labOut.innerHTML = `<p><b>Crossover</b>${r.note ? ' — ' + r.note : ''}</p>` + A.table(['', 'Chromosome', 'Fitness'], [['Parent 1', `<code>${K.str ? K.str(a) : a.join(' ')}</code>`, round(K.fitness(a))], ['Parent 2', `<code>${K.str ? K.str(b) : b.join(' ')}</code>`, round(K.fitness(b))], ...r.kids.map((k, i) => [`Child ${i + 1}`, `<code>${K.str ? K.str(k) : k.join(' ')}</code>`, round(K.fitness(k))])], 'compact'); } }, 'Show a crossover'),
      A.h('button', { class: 'btn', type: 'button', onclick: () => { const [a] = parents(); const r = K.mutate(rng, a.slice()); labOut.innerHTML = `<p><b>Mutation</b>${r.note ? ' — ' + r.note : ''}</p>` + A.table(['', 'Chromosome', 'Fitness'], [['Before', `<code>${K.str ? K.str(a) : a.join(' ')}</code>`, round(K.fitness(a))], ['After', `<code>${K.str ? K.str(r.ch) : r.ch.join(' ')}</code>`, round(K.fitness(r.ch))]], 'compact'); } }, 'Show a mutation'),
      cfg.example ? A.h('button', { class: 'btn ghost', type: 'button', onclick: () => { labOut.innerHTML = `<p><b>Exam example</b> <code>${K.str ? K.str(cfg.example) : cfg.example.join(' ')}</code> has fitness <b>${round(K.fitness(cfg.example))}</b></p>` + K.show(cfg.example); } }, 'Evaluate the exam example') : null), labOut);
    reset();
  };

  // ---------- kinds ----------
  const ratings = [55, 50, 47, 45, 40, 36, 32, 28, 24], price = [6, 4, 3];
  A.gaKinds.adverts = {
    better: 'max', optimum: 1648,
    fitness: ch => ch.reduce((s, a, i) => s + price[a - 1] * ratings[i], 0) - 1000 * [1, 2, 3].reduce((s, a) => s + Math.abs(ch.filter(x => x === a).length - 3), 0),
    generate: r => r.shuffle([1, 1, 1, 2, 2, 2, 3, 3, 3]),
    repair: ch => { for (let i = 0; i < ch.length; i++) { const a = ch[i]; if (ch.filter(x => x === a).length > 3) { const s = [1, 2, 3].find(b => ch.filter(x => x === b).length < 3); ch[i] = s; } } return ch; },
    crossover(r, a, b) { const cut = 1 + r.int(8); const c1 = a.slice(0, cut).concat(b.slice(cut)), c2 = b.slice(0, cut).concat(a.slice(cut)); const raw = [c1.join(''), c2.join('')]; return { kids: [this.repair(c1), this.repair(c2)], note: `single point after slot ${cut}; raw children ${raw.join(' and ')} were repaired so each advertiser keeps exactly 3 slots` }; },
    mutate(r, ch) { let i, j; do { [i, j] = r.sample(9, 2); } while (ch[i] === ch[j]); [ch[i], ch[j]] = [ch[j], ch[i]]; return { ch, note: `swap slots t${i + 1} and t${j + 1} (counts stay 3/3/3)` }; },
    str: ch => '[' + ch.join(',') + ']',
    show: ch => A.table(['Advertiser', 'Slots', 'Revenue'], [1, 2, 3].map(a => { const s = ch.map((x, i) => x === a ? i : -1).filter(i => i >= 0); return [`A${a} (×${price[a - 1]})`, s.map(i => `t${i + 1}(${ratings[i]})`).join(', '), `R${price[a - 1] * s.reduce((t, i) => t + ratings[i], 0)}`]; }), 'compact')
  };
  // TSP 6 cities
  const cities = { A: [40, 40], B: [200, 30], C: [290, 120], D: [230, 220], E: [90, 230], F: [20, 140] };
  const cn = Object.keys(cities); const dd = (a, b) => Math.round(Math.hypot(cities[a][0] - cities[b][0], cities[a][1] - cities[b][1]));
  const tourLen = t => t.reduce((s, c, i) => s + dd(c, t[(i + 1) % t.length]), 0);
  A.gaKinds.tsp = {
    better: 'min', fitness: tourLen,
    generate: r => r.shuffle(cn.slice()),
    crossover(r, a, b) { let i = r.int(6), j = r.int(6); if (i > j) [i, j] = [j, i]; const ox = (p, q) => { const child = Array(6).fill(null); for (let k = i; k <= j; k++) child[k] = p[k]; const rest = q.filter(c => !child.includes(c)); let z = 0; for (let k = 0; k < 6; k++) if (!child[k]) child[k] = rest[z++]; return child; }; return { kids: [ox(a, b), ox(b, a)], note: `order crossover (OX): keep positions ${i + 1}–${j + 1} from one parent, fill the rest in the other parent's order` }; },
    mutate(r, ch) { const [i, j] = r.sample(6, 2); [ch[i], ch[j]] = [ch[j], ch[i]]; return { ch, note: `swap mutation: cities at positions ${i + 1} and ${j + 1} exchange places` }; },
    str: ch => ch.join(''),
    show: ch => { let s = `<svg viewBox="0 0 320 260" width="320" height="260" class="tsp"><polygon points="${ch.map(c => cities[c].join(',')).join(' ')}" class="tour"/>`; for (const c of cn) s += `<circle cx="${cities[c][0]}" cy="${cities[c][1]}" r="11" class="city"/><text x="${cities[c][0]}" y="${cities[c][1] + 4}" text-anchor="middle">${c}</text>`; return s + `</svg><p>Tour ${ch.join(' → ')} → ${ch[0]}, length ${tourLen(ch)} (sample city map).</p>`; }
  };
  const items = [['A', 5, 12, 2], ['B', 3, 5, 4], ['C', 7, 10, 1], ['D', 2, 7, 6]], CAP = 12;
  const kw = ch => ch.reduce((s, k, i) => s + k * items[i][1], 0), kv = ch => ch.reduce((s, k, i) => s + k * items[i][2], 0);
  A.gaKinds.knapsack = {
    better: 'max', optimum: 42,
    fitness: ch => kw(ch) <= CAP ? kv(ch) : 0,
    generate: r => items.map(it => r.int(it[3] + 1)),
    crossover(r, a, b) { const cut = 1 + r.int(3); return { kids: [a.slice(0, cut).concat(b.slice(cut)), b.slice(0, cut).concat(a.slice(cut))], note: `single point after gene ${cut}` }; },
    mutate(r, ch) { const i = r.int(4); const old = ch[i]; ch[i] = Math.max(0, Math.min(items[i][3], ch[i] + (r() < 0.5 ? -1 : 1))); return { ch, note: `item ${items[i][0]} count ${old} → ${ch[i]}` }; },
    str: ch => '[' + ch.join(', ') + ']',
    show: ch => `<p>${items.map((it, i) => `${ch[i]}× ${it[0]}`).join(', ')} → weight ${kw(ch)} kg / ${CAP} kg, value $${kv(ch)}${kw(ch) > CAP ? ' <b class="bad">overweight → fitness 0</b>' : ''}</p>`
  };
  const coins = [].concat(Array(7).fill(5), Array(5).fill(7), Array(9).fill(8), Array(6).fill(10), Array(3).fill(16));
  const shares = ch => { const v = [0, 0, 0, 0]; ch.forEach((n, i) => v[n - 1] += coins[i]); return v; };
  A.gaKinds.coins = {
    better: 'min', optimum: 2,
    fitness: ch => shares(ch).reduce((s, v) => s + Math.abs(v - 62.5), 0),
    generate: r => coins.map(() => 1 + r.int(4)),
    crossover(r, a, b) { const cut = 1 + r.int(29); return { kids: [a.slice(0, cut).concat(b.slice(cut)), b.slice(0, cut).concat(a.slice(cut))], note: `single point after coin ${cut}; every coin still has exactly one owner` }; },
    mutate(r, ch) { const i = r.int(30); const old = ch[i]; let n; do { n = 1 + r.int(4); } while (n === old); ch[i] = n; return { ch, note: `coin ${i + 1} (R${coins[i]}) moves from nephew ${old} to nephew ${n}` }; },
    str: ch => ch.join(''),
    show: ch => `<p>Shares: ${shares(ch).map((v, i) => `N${i + 1} R${v}`).join(' · ')} (ideal R62.50 each, total R250)</p>`
  };
  // Latin square 4x4, fixed cells
  const fixed = { 0: 0, 6: 1, 9: 3, 15: 2 };
  const lsConf = g => { let c = 0; for (let i = 0; i < 4; i++) { const row = g.slice(i * 4, i * 4 + 4), col = [0, 1, 2, 3].map(k => g[k * 4 + i]); c += 4 - new Set(row).size + 4 - new Set(col).size; } return c; };
  A.gaKinds.latin = {
    better: 'min', optimum: 0,
    fitness: lsConf,
    generate: r => { const g = []; for (let i = 0; i < 4; i++) { const fx = [0, 1, 2, 3].filter(c => fixed[i * 4 + c] !== undefined).map(c => fixed[i * 4 + c]); const free = r.shuffle([0, 1, 2, 3].filter(s => !fx.includes(s))); let z = 0; for (let c = 0; c < 4; c++) g.push(fixed[i * 4 + c] !== undefined ? fixed[i * 4 + c] : free[z++]); } return g; },
    crossover(r, a, b) { const cut = 1 + r.int(3); return { kids: [a.slice(0, cut * 4).concat(b.slice(cut * 4)), b.slice(0, cut * 4).concat(a.slice(cut * 4))], note: `whole rows swapped after row ${cut}: rows stay permutations and fixed cells are equal in both parents` }; },
    mutate(r, ch) { const row = r.int(4); const free = [0, 1, 2, 3].filter(c => fixed[row * 4 + c] === undefined); const [i, j] = r.sample(free.length, 2).map(k => row * 4 + free[k]); [ch[i], ch[j]] = [ch[j], ch[i]]; return { ch, note: `swap two non-fixed cells in row ${row + 1}` }; },
    str: ch => ch.join(''),
    show: ch => `<table class="lsq">${[0, 1, 2, 3].map(i => `<tr>${[0, 1, 2, 3].map(j => `<td class="${fixed[i * 4 + j] !== undefined ? 'fx' : ''}">${ch[i * 4 + j]}</td>`).join('')}</tr>`).join('')}</table><p>${lsConf(ch)} duplicate${lsConf(ch) === 1 ? '' : 's'} across rows and columns</p>`
  };
  const qAtt = c => { let n = 0; for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if (c[i] === c[j] || Math.abs(c[i] - c[j]) === j - i) n++; return n; };
  A.gaKinds.queens8 = {
    better: 'max', optimum: 28,
    fitness: c => 28 - qAtt(c),
    generate: r => Array.from({ length: 8 }, () => 1 + r.int(8)),
    crossover(r, a, b) { const cut = 1 + r.int(7); return { kids: [a.slice(0, cut).concat(b.slice(cut)), b.slice(0, cut).concat(a.slice(cut))], note: `single point after column ${cut}` }; },
    mutate(r, ch) { const i = r.int(8), old = ch[i]; ch[i] = 1 + r.int(8); return { ch, note: `column ${i + 1}: row ${old} → ${ch[i]}` }; },
    str: ch => ch.join(''),
    show: ch => { let s = `<svg viewBox="0 0 242 242" width="242" height="242" class="qsvg small">`; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) s += `<rect x="${1 + c * 30}" y="${1 + r * 30}" width="30" height="30" class="${(r + c) % 2 ? 'dk' : 'lt'}"/>`; ch.forEach((row, c) => s += `<text x="${1 + c * 30 + 15}" y="${1 + (8 - row) * 30 + 22}" text-anchor="middle" class="qq">♛</text>`); return s + `</svg><p>${qAtt(ch)} attacking pairs → fitness ${28 - qAtt(ch)} non-attacking pairs (max 28)</p>`; }
  };

  // ---------- machine servicing editor ----------
  A.engines.machines = function (host, cfg) {
    const cap = cfg.cap, req = cfg.req, n = cap.length, p = cfg.p;
    let ch = cfg.example.replace(/\s/g, '').split('').map(Number);
    const rng = A.rng(11);
    const box = A.h('div', { class: 'tracebox' }), res = A.h('div', { class: 'answer' }), note = A.h('div', { class: 'stepmsg' });
    host.append(box, res);
    const fit = c => { const outs = [...Array(p).keys()].map(k => cap.reduce((s, w, i) => s + (c[k * n + i] ? 0 : w), 0)); const cnt = cap.map((_, i) => [...Array(p).keys()].reduce((s, k) => s + c[k * n + i], 0)); const viol = cnt.reduce((s, v, i) => s + Math.abs(v - req[i]), 0); return { outs, cnt, viol, total: outs.reduce((a, b) => a + b, 0) }; };
    function draw() {
      const f = fit(ch);
      let h = '<table class="mgrid"><thead><tr><th>Period</th>' + cap.map((_, i) => `<th>M${i + 1}</th>`).join('') + '<th>Output</th></tr></thead><tbody>';
      for (let k = 0; k < p; k++) h += `<tr><th>P${k + 1}</th>` + cap.map((_, i) => `<td><button type="button" class="bit ${ch[k * n + i] ? 'one' : ''}" data-k="${k * n + i}" aria-label="period ${k + 1} machine ${i + 1}">${ch[k * n + i]}</button></td>`).join('') + `<td class="num">${f.outs[k]}</td></tr>`;
      h += '<tr><th>Services</th>' + f.cnt.map((v, i) => `<td class="${v === req[i] ? 'good' : 'bad'}">${v}/${req[i]}</td>`).join('') + '<td></td></tr></tbody></table>';
      box.innerHTML = h;
      box.querySelectorAll('.bit').forEach(b => b.onclick = () => { const k = +b.dataset.k; ch[k] = 1 - ch[k]; draw(); });
      res.innerHTML = `Chromosome <code>${[...Array(p).keys()].map(k => ch.slice(k * n, k * n + n).join('')).join(' ')}</code><br>Total output Σ = ${f.outs.join(' + ')} = <b>${f.total}</b> · service violations V = <b>${f.viol}</b> · fitness = total − 100·V = <b>${f.total - 100 * f.viol}</b> · lowest period output ${Math.min(...f.outs)}`;
    }
    const gen = () => { const c = Array(p * n).fill(0); req.forEach((r, i) => rng.sample(p, r).forEach(k => c[k * n + i] = 1)); return c; };
    host.append(A.h('div', { class: 'ctlrow' },
      A.h('button', { class: 'btn', type: 'button', onclick: () => { ch = cfg.example.replace(/\s/g, '').split('').map(Number); note.textContent = ''; draw(); } }, 'Exam example'),
      A.h('button', { class: 'btn', type: 'button', onclick: () => { ch = gen(); note.textContent = 'Random feasible chromosome: for each machine i, pick req[i] distinct periods at random and set those bits.'; draw(); } }, 'Generate (3.1 procedure)'),
      A.h('button', { class: 'btn', type: 'button', onclick: () => { const a = ch.slice(), b = gen(), cut = 1 + rng.int(n - 1); const c = a.map((v, k) => (k % n) < cut ? v : b[k]); note.innerHTML = `Machine-wise crossover: child takes machines 1–${cut} (all periods) from the current chromosome and machines ${cut + 1}–${n} from a second parent <code>${b.join('')}</code>. Each machine keeps one parent's whole column, so its service count is unchanged.`; ch = c; draw(); } }, 'Crossover demo (3.4)'),
      A.h('button', { class: 'btn', type: 'button', onclick: () => { const i = rng.int(n); const ones = [...Array(p).keys()].filter(k => ch[k * n + i]), zeros = [...Array(p).keys()].filter(k => !ch[k * n + i]); if (!ones.length || !zeros.length) { note.textContent = `Machine ${i + 1} is serviced in every period or none: pick again.`; return; } const a = rng.pick(ones), b = rng.pick(zeros); ch[a * n + i] = 0; ch[b * n + i] = 1; note.textContent = `Swap mutation: machine ${i + 1}'s service moves from period ${a + 1} to period ${b + 1}. Its count stays the same.`; draw(); } }, 'Mutation demo (3.5)')), note);
    draw();
  };

  // ---------- bit / digit chromosome lab ----------
  A.engines.chromLab = function (host, cfg) {
    let pop = cfg.pop.map(x => x.slice ? x.slice() : x);
    const f = cfg.fitness, dec = cfg.decode || (s => s);
    const tb = A.h('div', { class: 'tracebox' }), out = A.h('div', { class: 'answer' });
    host.append(tb);
    const total = () => pop.reduce((s, c) => s + f(c), 0);
    function draw() {
      const T = total();
      tb.innerHTML = A.table(['Name', 'Chromosome', ...(cfg.showDecoded ? [cfg.decodedLabel || 'x'] : []), 'Fitness', ...(cfg.roulette ? ['P(select)', 'Running total'] : [])], (() => { let run = 0; return pop.map((c, i) => { run += f(c); return [cfg.names[i], `<code>${c}</code>`, ...(cfg.showDecoded ? [dec(c)] : []), f(c), ...(cfg.roulette ? [`${f(c)}/${T} = ${(f(c) / T).toFixed(4)}`, run] : [])]; }); })(), 'compact') + `<p>Total fitness ${T}, average <b>${Math.round(T / pop.length * 1000) / 1000}</b></p>`;
    }
    draw();
    if (cfg.cross) {
      const L = pop[0].length;
      const sa = A.h('select', { class: 'sel', id: (cfg.id || 'cl') + '-a', 'aria-label': 'Parent 1' }), sb = A.h('select', { class: 'sel', id: (cfg.id || 'cl') + '-b', 'aria-label': 'Parent 2' });
      cfg.names.forEach((nm, i) => { sa.append(A.h('option', { value: i }, nm)); sb.append(A.h('option', { value: i }, nm)); });
      sa.value = cfg.cross.a; sb.value = cfg.cross.b;
      const pts = A.h('input', { class: 'inp', id: (cfg.id || 'cl') + '-pts', value: cfg.cross.points.join(','), 'aria-label': 'Crossover points' });
      const res = A.h('div');
      const go = () => {
        const a = pop[+sa.value], b = pop[+sb.value];
        const ps = pts.value.split(/[\s,]+/).filter(Boolean).map(Number).filter(x => x > 0 && x < L).sort((x, y) => x - y);
        let c1 = '', c2 = '', sw = false, last = 0;
        for (const q of [...ps, L]) { c1 += (sw ? b : a).slice(last, q); c2 += (sw ? a : b).slice(last, q); sw = !sw; last = q; }
        const mark = s => { let o = '', l = 0; for (const q of [...ps, L]) { o += s.slice(l, q) + (q < L ? '|' : ''); l = q; } return o; };
        res.innerHTML = A.table(['', 'Chromosome', ...(cfg.showDecoded ? [cfg.decodedLabel || 'x'] : []), 'Fitness'], [[cfg.names[+sa.value], `<code>${mark(a)}</code>`, ...(cfg.showDecoded ? [dec(a)] : []), f(a)], [cfg.names[+sb.value], `<code>${mark(b)}</code>`, ...(cfg.showDecoded ? [dec(b)] : []), f(b)], ['Child 1', `<code>${mark(c1)}</code>`, ...(cfg.showDecoded ? [dec(c1)] : []), `<b>${f(c1)}</b>`], ['Child 2', `<code>${mark(c2)}</code>`, ...(cfg.showDecoded ? [dec(c2)] : []), `<b>${f(c2)}</b>`]], 'compact');
      };
      [sa, sb, pts].forEach(e => e.oninput = go);
      host.append(A.h('h4', null, 'Crossover'), A.h('div', { class: 'calc' }, A.h('label', { for: sa.id }, 'Parent 1 '), sa, A.h('label', { for: sb.id }, ' Parent 2 '), sb, A.h('label', { for: pts.id }, ` Cut points (gene boundary, 0 = far left, length ${L}) `), pts), res);
      go();
    }
    if (cfg.plot) {
      const s = A.h('div', { class: 'chart' }); const svg = document.createElementNS(A.svgNS, 'svg'); s.append(svg); host.append(A.h('h4', null, cfg.plot.title), s);
      const draw = () => { const W = svg.clientWidth || 520, H = svg.clientHeight || 220, m = 40; const xs = [...Array(cfg.plot.max + 1).keys()]; const ys = xs.map(cfg.plot.f); const lo = Math.min(...ys), hi = Math.max(...ys); const X = x => m + x / cfg.plot.max * (W - m - 12), Y = y => 10 + (1 - (y - lo) / (hi - lo)) * (H - 40);
        let g = `<polyline points="${xs.map(x => X(x) + ',' + Y(ys[x])).join(' ')}" class="line" fill="none"/>`;
        pop.forEach((c, i) => { const x = parseInt(c, 2); g += `<circle cx="${X(x)}" cy="${Y(cfg.plot.f(x))}" r="5" class="pt"/><text x="${X(x)}" y="${Y(cfg.plot.f(x)) - 9}" text-anchor="middle" class="tick">${cfg.names[i]}</text>`; });
        g += `<text x="${X(10)}" y="${H - 8}" text-anchor="middle" class="tick">x = 10 (max ${cfg.plot.f(10)})</text><text x="${m}" y="${H - 8}" class="tick">0</text><text x="${W - 12}" y="${H - 8}" text-anchor="end" class="tick">31</text>`;
        svg.innerHTML = g; };
      const ro = new ResizeObserver(draw); ro.observe(svg);
    }
    host.append(out);
  };
})(window.AIN);

/* ---- engines/learn.js ---- */
/* Perceptron table, BAM, proof stepper, quiz cards */
(function (A) {
  const r2 = x => Math.round(x * 1000) / 1000;
  A.engines.perceptron = function (host, cfg) {
    const n = cfg.X[0].length, rows = [];
    let w = (cfg.w0 || Array(n).fill(0)).slice(), b = cfg.b0 || 0;
    const al = cfg.alpha ?? 1, th = cfg.theta ?? 0, neg = cfg.rule === 'negnevitsky';
    for (let ep = 1; ep <= cfg.epochs; ep++) {
      let changed = false;
      cfg.X.forEach((x, k) => {
        const t = cfg.T[k], w0 = w.slice(), b0 = b;
        let yin, y, dw, db, e;
        if (neg) { yin = r2(x.reduce((s, xi, i) => s + xi * w[i], 0)); y = yin - th >= 0 ? 1 : 0; e = t - y; dw = x.map(xi => r2(al * xi * e)); db = 0; }
        else { yin = r2(b + x.reduce((s, xi, i) => s + xi * w[i], 0)); y = yin > th ? 1 : yin === th ? 0 : -1; e = y === t ? 0 : 1; dw = e ? x.map(xi => al * t * xi) : Array(n).fill(0); db = e ? al * t : 0; }
        if (dw.some(v => v) || db) changed = true;
        w = w.map((wi, i) => r2(wi + dw[i])); b = r2(b + db);
        rows.push({ ep, x, t, yin, y, e, dw, db, w: w.slice(), b, w0, b0 });
      });
      rows.push({ sep: true, ep, changed });
      if (!changed && cfg.stopWhenStable) break;
    }
    const data = rows.filter(r => !r.sep);
    const heads = neg ? ['Ep', ...cfg.X[0].map((_, i) => 'x' + (i + 1)), 'Yd', 'Σxw', 'Y', 'e', ...w.map((_, i) => 'w' + (i + 1))]
      : ['Ep', ...cfg.X[0].map((_, i) => 'x' + (i + 1)), 't', 'y<sub>in</sub>', 'y', ...w.map((_, i) => 'Δw' + (i + 1)), 'Δb', ...w.map((_, i) => 'w' + (i + 1)), 'b'];
    const tb = A.h('div', { class: 'tracebox' });
    const msg = A.h('div', { class: 'stepmsg' });
    host.append(tb);
    A.stepper(host, { count: () => data.length, render, labels: i => `Epoch ${data[i].ep}, row ${(i % cfg.X.length) + 1}` });
    host.append(msg);
    function render(i) {
      tb.innerHTML = A.table(heads, data.slice(0, i + 1).map((r, k) => ({ cls: (k === i ? 'on ' : '') + ((r.dw.some(v => v) || r.db) ? 'upd' : ''), cells: neg ? [r.ep, ...r.x, r.t, r.yin, r.y, r.e, ...r.w] : [r.ep, ...r.x, r.t, r.yin, r.y, ...r.dw, r.db, ...r.w, r.b] })), 'compact num');
      const r = data[i];
      const sum = neg ? r.x.map((xi, k) => `${xi}×${r.w0[k]}`).join(' + ') + ` = ${r.yin}` : `${r.b0} + ` + r.x.map((xi, k) => `(${xi})(${r.w0[k]})`).join(' + ') + ` = ${r.yin}`;
      msg.innerHTML = neg ? `Σ x·w = ${sum}; Σ − θ = ${r2(r.yin - th)} → Y = ${r.y}; e = ${r.t} − ${r.y} = ${r.e}${r.e ? `; Δw = α·x·e → new w = (${r.w.join(', ')})` : '; no change'}.`
        : `y<sub>in</sub> = b + Σ x·w = ${sum} → y = ${r.y}. Target t = ${r.t}: ${r.y === r.t ? 'correct, no change.' : `wrong, so Δw = α·t·x and Δb = α·t → w = (${r.w.join(', ')}), b = ${r.b}.`}`;
    }
    const last = data[data.length - 1];
    let res = `<p>After ${cfg.epochs} epoch${cfg.epochs > 1 ? 's' : ''}: <b>w = (${last.w.join(', ')})</b>${neg ? '' : `, <b>b = ${last.b}</b>`}.</p>`;
    const sepRows = rows.filter(r => r.sep);
    res += `<p>${sepRows.map(s => `Epoch ${s.ep}: ${s.changed ? 'weights changed' : 'no weight change (training has converged)'}`).join(' · ')}</p>`;
    if (cfg.test) {
      const wt = cfg.testWeights || { w: last.w, b: last.b };
      const yin = r2(wt.b + cfg.test.reduce((s, xi, i) => s + xi * wt.w[i], 0));
      const y = yin > th ? 1 : yin === th ? 0 : -1;
      res += `<p>Test [${cfg.test.join(', ')}]: y<sub>in</sub> = ${wt.b} + ${cfg.test.map((xi, i) => `(${xi})(${wt.w[i]})`).join(' + ')} = <b>${yin}</b> → output <b>${y}</b>${cfg.testLabel ? ' (' + cfg.testLabel(y) + ')' : ''}.</p>`;
    }
    host.append(A.h('div', { class: 'answer', html: res }));
  };

  // ---------- BAM ----------
  A.engines.bam = function (host, cfg) {
    const X = cfg.X, Y = cfg.Y, n = X[0].length, m = Y[0].length;
    const W = Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => X.reduce((s, x, k) => s + x[i] * Y[k][j], 0)));
    const mat = (M, rl, cl) => A.table(['', ...cl], M.map((row, i) => [rl[i], ...row]), 'compact num');
    const steps = X.map((x, k) => ({ k, M: x.map(xi => Y[k].map(yj => xi * yj)) }));
    const tb = A.h('div', { class: 'tracebox' });
    host.append(A.h('p', { html: `Training stores each pair with W = Σ X<sub>k</sub><sup>T</sup> Y<sub>k</sub>. Step through the ${X.length} outer products:` }), tb);
    A.stepper(host, { count: () => steps.length + 1, render: i => {
      if (i < steps.length) tb.innerHTML = `<p><b>${cfg.names[i]}</b>: X = [${X[i].join(', ')}], Y = [${Y[i].join(', ')}]. Outer product X<sup>T</sup>Y:</p>` + mat(steps[i].M, cfg.xLabels, cfg.yLabels);
      else tb.innerHTML = '<p><b>Sum of all outer products — the weight matrix W</b>:</p>' + mat(W, cfg.xLabels, cfg.yLabels);
    }, labels: i => i < steps.length ? `Pair ${i + 1} of ${steps.length}` : 'Final W' });
    const sgn = (v, p) => v > 0 ? 1 : v < 0 ? -1 : p;
    const fwd = x => { const net = Array.from({ length: m }, (_, j) => x.reduce((s, xi, i) => s + xi * W[i][j], 0)); return { net, out: net.map(v => sgn(v, 0)) }; };
    const bwd = y => { const net = W.map(row => row.reduce((s, wij, j) => s + wij * y[j], 0)); return { net, out: net.map(v => sgn(v, 0)) }; };
    let h = '<h4>Recall test</h4>' + A.table(['Pattern', 'X → net = X·W → Y', 'Y → net = W·Y → X'], X.map((x, k) => {
      const f = fwd(x), b = bwd(Y[k]); const okf = f.out.every((v, j) => v === Y[k][j]), okb = b.out.every((v, i) => v === x[i]);
      return [cfg.names[k], `[${f.net.join(', ')}] → [${f.out.join(', ')}] ${okf ? '<b class="good">✓</b>' : '<b class="bad">✗</b>'}`, `[${b.net.join(', ')}] → [${b.out.join(', ')}] ${okb ? '<b class="good">✓</b>' : '<b class="bad">✗</b>'}`];
    }), 'compact');
    host.append(A.h('div', { class: 'answer', html: h }));
    // custom probe
    const inp = A.h('input', { class: 'inp wide', id: (cfg.id || 'bam') + '-probe', value: (cfg.probe || X[0]).join(', '), 'aria-label': 'Input vector' });
    const out = A.h('div', { class: 'stepmsg' });
    const go = () => { const x = inp.value.split(/[\s,]+/).filter(Boolean).map(Number); if (x.length !== n || x.some(isNaN)) { out.textContent = `Enter ${n} numbers (1, −1, or 0 for unknown).`; return; } const f = fwd(x); const hit = Y.findIndex(y => y.every((v, j) => v === f.out[j])); out.innerHTML = `X·W = [${f.net.join(', ')}] → Y = [${f.out.join(', ')}] ${hit >= 0 ? `= <b>${cfg.names[hit]}</b>` : '(not a stored pattern)'}`; };
    inp.oninput = go;
    host.append(A.h('div', { class: 'calc' }, A.h('label', { for: (cfg.id || 'bam') + '-probe' }, 'Probe X (use 0 for an unknown feature): '), inp), out);
    go();
  };

  // ---------- proof / reasoning steps ----------
  A.engines.proof = function (host, cfg) {
    const base = cfg.clauses || [];
    const list = A.h('ol', { class: 'clauses' });
    const detail = A.h('div', { class: 'stepmsg' });
    host.append(A.h('div', { class: 'proofgrid' }, A.h('div', null, A.h('h4', null, cfg.clauseTitle || 'Clauses'), list), A.h('div', null, A.h('h4', null, cfg.stepTitle || 'Step'), detail)));
    A.stepper(host, { count: () => cfg.steps.length, render, labels: i => `Step ${i + 1} of ${cfg.steps.length}` });
    function render(i) {
      const s = cfg.steps[i];
      const derived = cfg.steps.slice(0, i + 1).filter(x => x.result).map(x => x.result);
      const used = new Set(s.uses || []);
      list.innerHTML = [...base, ...derived].map(c => `<li class="${used.has(c.id) ? 'use' : ''} ${s.result && s.result.id === c.id ? 'new' : ''}"><span class="cid">${c.id}</span> ${c.t}</li>`).join('');
      detail.innerHTML = (s.goals ? `<div class="goals">Goals: ${s.goals.length ? s.goals.map(g => `<span class="chip">${g}</span>`).join(' ') : '<b class="good">none left — proved</b>'}</div>` : '') + `<p>${s.text}</p>` + (s.result ? `<p class="derive">⇒ <b>${s.result.id}</b>: ${s.result.t}</p>` : '');
    }
  };

  // ---------- quiz / flashcards ----------
  A.engines.quiz = function (host, cfg) {
    let score = 0, done = 0;
    const sc = A.h('div', { class: 'score' });
    cfg.items.forEach((it, k) => {
      const card = A.h('div', { class: 'qcard' });
      card.append(A.h('div', { class: 'qq', html: `<b>${it.n || k + 1}.</b> ${it.q}` }));
      if (it.options) {
        const opts = A.h('div', { class: 'qopts' });
        const fb = A.h('div', { class: 'qfb' });
        it.options.forEach((o, j) => opts.append(A.h('button', { type: 'button', class: 'qopt', onclick: e => {
          if (card.dataset.done) return; card.dataset.done = 1; done++;
          const right = j === it.answer; if (right) score++;
          e.target.classList.add(right ? 'right' : 'wrong'); opts.children[it.answer].classList.add('right');
          fb.innerHTML = `${right ? '<b class="good">Correct.</b>' : '<b class="bad">Not quite.</b>'} ${it.why || ''}`;
          sc.textContent = `Score: ${score} / ${done} answered (${cfg.items.filter(x => x.options).length} questions)`;
        } }, o)));
        card.append(opts, fb);
      } else {
        const ans = A.h('div', { class: 'qans', html: it.a, hidden: true });
        card.append(A.h('button', { type: 'button', class: 'btn ghost', onclick: e => { ans.hidden = !ans.hidden; e.target.textContent = ans.hidden ? 'Show answer' : 'Hide answer'; } }, 'Show answer'), ans);
      }
      host.append(card);
    });
    if (cfg.items.some(x => x.options)) host.prepend(sc), sc.textContent = 'Pick an answer for each question.';
  };
})(window.AIN);

/* ---- engines/misc.js ---- */
/* Semantic networks / conceptual graphs, Prolog tracer, blocks match game, word ladder */
(function (A) {
  A.engines.semnet = function (host, cfg) {
    const W = cfg.w || 640, H = cfg.h || 380;
    const N = {}; cfg.nodes.forEach(n => N[n.id] = n);
    const fig = A.h('div', { class: 'scroll figbox' });
    host.append(fig);
    const sz = n => { const w = Math.max(54, n.label.length * 7.4 + 22); return [w, n.kind === 'rel' ? 26 : 30]; };
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="semnet">${A.arrowDefs('sn-' + (cfg.id || 'x'))}`;
    for (const [a, b, l] of cfg.edges) {
      const p = N[a], q = N[b]; const [pw, ph] = sz(p), [qw, qh] = sz(q);
      const dx = q.x - p.x, dy = q.y - p.y; const L = Math.hypot(dx, dy) || 1;
      const clip = (w, h) => { const tx = Math.abs(dx) > 1e-6 ? (w / 2) / Math.abs(dx) : Infinity, ty = Math.abs(dy) > 1e-6 ? (h / 2) / Math.abs(dy) : Infinity; return Math.min(tx, ty); };
      const t1 = clip(pw, ph), t2 = clip(qw, qh);
      const x1 = p.x + dx * t1, y1 = p.y + dy * t1, x2 = q.x - dx * (t2 + 4 / L), y2 = q.y - dy * (t2 + 4 / L);
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="se" marker-end="url(#sn-${cfg.id || 'x'})"/>`;
      if (l) { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; s += `<text x="${mx}" y="${my - 4}" text-anchor="middle" class="sel">${l}</text>`; }
    }
    for (const n of cfg.nodes) { const [w, h] = sz(n); s += n.kind === 'rel' ? `<ellipse cx="${n.x}" cy="${n.y}" rx="${w / 2}" ry="${h / 2}" class="sn rel"/>` : `<rect x="${n.x - w / 2}" y="${n.y - h / 2}" width="${w}" height="${h}" rx="${n.kind === 'inst' ? 15 : 4}" class="sn ${n.kind || ''}"/>`; s += `<text x="${n.x}" y="${n.y + 5}" text-anchor="middle" class="snl">${n.label}</text>`; }
    fig.innerHTML = s + '</svg>';
    if (cfg.legend) host.append(A.h('p', { class: 'muted', html: cfg.legend }));
  };

  // ---------- Prolog list predicates tracer ----------
  A.engines.prolog = function (host, cfg) {
    const q = A.h('select', { class: 'sel', id: 'pl-q', 'aria-label': 'Query' });
    [['el', 'listContainsElement(L, X)'], ['ll', 'listContainsList(L1, L2)'], ['lll', 'listsContainList(L1, L2, L3)']].forEach(([v, t]) => q.append(A.h('option', { value: v }, t)));
    const a1 = A.h('input', { class: 'inp', id: 'pl-a1', value: '1,2,3', 'aria-label': 'first list' }), a2 = A.h('input', { class: 'inp', id: 'pl-a2', value: '3', 'aria-label': 'second argument' }), a3 = A.h('input', { class: 'inp', id: 'pl-a3', value: '3', 'aria-label': 'third argument' });
    const out = A.h('div', { class: 'trace pre' });
    host.append(A.h('div', { class: 'calc' }, A.h('label', { for: 'pl-q' }, 'Query '), q, A.h('label', { for: 'pl-a1' }, ' arg 1 '), a1, A.h('label', { for: 'pl-a2' }, ' arg 2 '), a2, A.h('label', { for: 'pl-a3' }, ' arg 3 '), a3), out);
    const L = s => s.split(',').map(x => x.trim()).filter(x => x !== '');
    const fmt = l => '[' + l.join(',') + ']';
    function run() {
      const lines = []; let d = 0;
      const log = (k, t) => lines.push(`${'  '.repeat(d)}${k.padEnd(5)} ${t}`);
      function el(list, x) { log('Call', `listContainsElement(${fmt(list)}, ${x})`); d++;
        let r = false;
        if (!list.length) log('Fail', 'no clause matches []');
        else if (list[0] === x) { log('', `clause 1: head ${list[0]} = ${x}`); r = true; }
        else { log('', `clause 1 fails (${list[0]} ≠ ${x}); clause 2 recurses on the tail`); r = el(list.slice(1), x); }
        d--; log(r ? 'Exit' : 'Fail', `listContainsElement(${fmt(list)}, ${x})`); return r; }
      function ll(l1, l2) { log('Call', `listContainsList(${fmt(l1)}, ${fmt(l2)})`); d++; let r;
        if (!l2.length) { log('', 'clause 1: second list is [] → true'); r = true; }
        else { r = el(l1, l2[0]) && ll(l1, l2.slice(1)); }
        d--; log(r ? 'Exit' : 'Fail', `listContainsList(${fmt(l1)}, ${fmt(l2)})`); return r; }
      let res;
      if (q.value === 'el') res = el(L(a1.value), a2.value.trim());
      else if (q.value === 'll') res = ll(L(a1.value), L(a2.value));
      else { log('Call', `listsContainList(${fmt(L(a1.value))}, ${fmt(L(a2.value))}, ${fmt(L(a3.value))})`); d++; res = ll(L(a1.value), L(a3.value)) && ll(L(a2.value), L(a3.value)); d--; log(res ? 'Exit' : 'Fail', 'listsContainList'); }
      out.textContent = lines.join('\n') + `\n\n?- ${res ? 'true.' : 'false.'}`;
      a3.disabled = q.value !== 'lll';
    }
    [q, a1, a2, a3].forEach(e => e.oninput = run);
    q.onchange = () => { if (q.value === 'el') { a1.value = '1,2,3'; a2.value = '3'; } else if (q.value === 'll') { a1.value = '1,2,3'; a2.value = '3,1'; } else { a1.value = '1,2,3'; a2.value = '3,1'; a3.value = '3'; } run(); };
    run();
  };

  // ---------- blocks match game ----------
  A.engines.blocks = function (host, cfg) {
    const props = { shape: ['circle', 'square', 'triangle'], colour: ['red', 'yellow', 'blue'], block: ['grey', 'white', 'black'] };
    let row = cfg.start.map(b => ({ ...b }));
    const rng = A.rng(5);
    const box = A.h('div', { class: 'blocks' }), out = A.h('div', { class: 'answer' });
    host.append(box);
    const fill = { red: '#e0332f', yellow: '#f2b705', blue: '#5b9bd5', grey: '#a6a6a6', white: '#ffffff', black: '#111111' };
    const shapeSvg = b => { const f = fill[b.colour]; return b.shape === 'circle' ? `<circle cx="40" cy="40" r="26" fill="${f}" stroke="#222"/>` : b.shape === 'square' ? `<rect x="16" y="16" width="48" height="48" fill="${f}" stroke="#222"/>` : `<path d="M40,12 L68,64 L12,64 Z" fill="${f}" stroke="#222"/>`; };
    const check = r => Object.keys(props).map(p => { const v = r.map(b => b[p]); const same = v.every(x => x === v[0]), diff = new Set(v).size === 3; return { p, v, ok: same || diff, why: same ? 'all the same' : diff ? 'all different' : 'two the same, one different' }; });
    let guess = null;
    function draw() {
      box.innerHTML = row.map(b => `<svg viewBox="0 0 80 80" width="96" height="96" class="blk"><rect x="2" y="2" width="76" height="76" fill="${fill[b.block]}" stroke="#222"/>${shapeSvg(b)}</svg>`).join('');
      const c = check(row), match = c.every(x => x.ok);
      const code = k => row.map(b => b[k][0].toUpperCase() + (b[k] === 'black' ? 'k' : b[k] === 'blue' ? 'u' : '')).join('');
      out.innerHTML = `<p>State: shapeTypes = [${row.map(b => `'${b.shape[0].toUpperCase()}'`).join(', ')}], shapeColours = [${row.map(b => `'${b.colour}'`).join(', ')}], blockColours = [${row.map(b => `'${b.block}'`).join(', ')}]</p>` + A.table(['Property', 'Values', 'Rule'], c.map(x => [x.p, x.v.join(', '), `${x.ok ? '<b class="good">✓</b>' : '<b class="bad">✗</b>'} ${x.why}`]), 'compact') + `<p>Overall: <b>${match ? 'MATCH' : 'NOT a match'}</b>${guess !== null ? ` — your guess was ${guess === match ? '<b class="good">right</b>' : '<b class="bad">wrong</b>'}` : ''}</p>`;
    }
    host.append(A.h('div', { class: 'ctlrow' },
      A.h('button', { class: 'btn', type: 'button', onclick: () => { guess = true; draw(); } }, 'I say: match'),
      A.h('button', { class: 'btn', type: 'button', onclick: () => { guess = false; draw(); } }, 'I say: no match'),
      A.h('button', { class: 'btn primary', type: 'button', onclick: () => { row = [0, 1, 2].map(() => ({ shape: rng.pick(props.shape), colour: rng.pick(props.colour), block: rng.pick(props.block) })); guess = null; draw(); } }, 'Deal 3 new blocks'),
      A.h('button', { class: 'btn ghost', type: 'button', onclick: () => { row = cfg.start.map(b => ({ ...b })); guess = null; draw(); } }, 'Exam start state')), out);
    draw();
  };

  // ---------- word ladder ----------
  A.engines.wordLadder = function (host, cfg) {
    const words = new Set(cfg.words);
    const s = A.h('input', { class: 'inp', id: 'wl-s', value: 'FOOL', maxlength: 4, 'aria-label': 'start word' }), g = A.h('input', { class: 'inp', id: 'wl-g', value: 'SAGE', maxlength: 4, 'aria-label': 'goal word' });
    const out = A.h('div', { class: 'answer' });
    host.append(A.h('div', { class: 'calc' }, A.h('label', { for: 'wl-s' }, 'Start '), s, A.h('label', { for: 'wl-g' }, ' Goal '), g, A.h('button', { class: 'btn primary', type: 'button', onclick: run }, 'Search')), out);
    const nb = w => { const o = []; for (let i = 0; i < 4; i++) for (let c = 65; c < 91; c++) { const ch = String.fromCharCode(c); if (ch === w[i]) continue; const t = w.slice(0, i) + ch + w.slice(i + 1); if (words.has(t)) o.push([t, 1, `${w}→${t}`]); } return o; };
    const hd = (w, goal) => [...w].filter((ch, i) => ch !== goal[i]).length;
    function run() {
      const a = s.value.toUpperCase(), b = g.value.toUpperCase();
      if (!words.has(a) || !words.has(b)) { out.textContent = 'Both words must be in this page’s small word list (common 4-letter words).'; return; }
      const bfs = A.solve(a, w => w === b, nb, () => 0), ast = A.solve(a, w => w === b, nb, w => hd(w, b));
      out.innerHTML = bfs.cost === null ? 'No ladder exists in this word list.' : `Shortest ladder: <b>${[a, ...ast.plan.map(p => p[1])].join(' → ')}</b> (${ast.cost} steps). h(${a}) = ${hd(a, b)} letters differ, so at least ${hd(a, b)} steps are needed. Uniform-cost/BFS expanded ${bfs.expanded} words; A* with the letter-difference heuristic expanded ${ast.expanded}.`;
    }
    run();
  };
})(window.AIN);
(function (A) {
  A.engines.eightPuzzle = function (host, cfg) {
    const S = cfg.start, G = cfg.goal;
    const pos = (b, t) => { const i = b.indexOf(t); return [Math.floor(i / 3), i % 3]; };
    const board = (b, title) => `<div><h4>${title}</h4><table class="lsq">${[0, 1, 2].map(r => `<tr>${[0, 1, 2].map(c => `<td>${b[r * 3 + c] || ''}</td>`).join('')}</tr>`).join('')}</table></div>`;
    const rows = []; let h1 = 0, h2 = 0;
    for (let t = 1; t <= 8; t++) { const [r, c] = pos(S, t), [gr, gc] = pos(G, t); const mis = r !== gr || c !== gc; const d = Math.abs(r - gr) + Math.abs(c - gc); h1 += mis; h2 += d; rows.push([t, mis ? 'yes' : 'no', `|${r}−${gr}| + |${c}−${gc}| = ${d}`]); }
    host.append(A.h('div', { class: 'ctlrow', html: board(S, 'Start') + board(G, 'Goal') }));
    host.insertAdjacentHTML('beforeend', A.table(['Tile', 'Misplaced?', 'Manhattan distance'], rows, 'compact'));
    host.append(A.h('div', { class: 'answer', html: `h<sub>1</sub> (misplaced tiles) = <b>${h1}</b> · h<sub>2</sub> (total Manhattan distance) = <b>${h2}</b>` }));
  };
})(window.AIN);

/* ---- engines/puzzles.js ---- */
/* State-space puzzles: eight coins, warehouse robot, insect, n-queens, discs, lights, jugs, diamond maze, moor/swamp lab */
(function (A) {
  // shared: A* / UCS over hashable string states. succ(s) -> [[t, cost, label]]
  A.solve = function (start, isGoal, succ, h, limit = 400000) {
    const g = new Map([[start, 0]]), prev = new Map(); let n = 0;
    const heap = new A.Heap((a, b) => a[0] - b[0] || b[1] - a[1]);
    heap.push([h(start), 0, start]);
    while (heap.size) {
      const [f, gg, s] = heap.pop();
      if (gg > g.get(s)) continue;
      n++;
      if (isGoal(s)) { const plan = []; let x = s; while (prev.has(x)) { const [p, lab] = prev.get(x); plan.push([lab, x]); x = p; } return { cost: gg, plan: plan.reverse(), expanded: n }; }
      if (n > limit) break;
      for (const [t, c, lab] of succ(s)) { const ng = gg + c; if (ng < (g.has(t) ? g.get(t) : Infinity)) { g.set(t, ng); prev.set(t, [s, lab]); heap.push([ng + h(t), ng, t]); } }
    }
    return { cost: null, plan: [], expanded: n };
  };
  const playBar = (host, getPlan, show) => {
    let k = 0, timer = null;
    const lab = A.h('span', { class: 'st-count' });
    const go = j => { const p = getPlan(); k = Math.max(0, Math.min(p.length, j)); lab.textContent = `Move ${k} of ${p.length}`; show(k); };
    const bar = A.h('div', { class: 'stepbar' },
      A.h('button', { class: 'btn ghost', type: 'button', onclick: () => go(0) }, 'Start'),
      A.h('button', { class: 'btn', type: 'button', onclick: () => go(k - 1) }, '◀ Back'),
      A.h('button', { class: 'btn primary', type: 'button', onclick: () => go(k + 1) }, 'Next ▶'),
      A.h('button', { class: 'btn', type: 'button', onclick: e => { if (timer) { clearInterval(timer); timer = null; e.target.textContent = 'Play'; return; } e.target.textContent = 'Pause'; timer = setInterval(() => { if (k >= getPlan().length) { clearInterval(timer); timer = null; e.target.textContent = 'Play'; return; } go(k + 1); }, 450); } }, 'Play'), lab);
    host.append(bar); return { go, get k() { return k; } };
  };

  // ---------- eight coins ----------
  A.engines.coins = function (host, cfg) {
    const adj = { 8: [1, 3, 5, 7] }; for (let i = 0; i < 8; i++) adj[i] = [(i + 1) % 8, (i + 7) % 8].concat(i % 2 ? [8] : []);
    const dist = []; for (let a = 0; a < 9; a++) { const d = Array(9).fill(-1); d[a] = 0; const q = [a]; while (q.length) { const x = q.shift(); for (const y of adj[x]) if (d[y] < 0) { d[y] = d[x] + 1; q.push(y); } } dist.push(d); }
    const home = c => c - 1;
    const h1 = s => [...s].reduce((t, ch, i) => t + (ch !== '0' && home(+ch) !== i ? 1 : 0), 0);
    const h2 = s => [...s].reduce((t, ch, i) => t + (ch !== '0' ? dist[i][home(+ch)] : 0), 0);
    const GOAL = '123456780';
    const succ = s => { const e = s.indexOf('0'); return adj[e].map(j => { const a = s.split(''); a[e] = a[j]; a[j] = '0'; return [a.join(''), 1, `move coin ${s[j]}`]; }); };
    let state = cfg.start, moves = 0, plan = null, planStart = null;
    const pos = i => i === 8 ? [0, 0] : [Math.sin(i * Math.PI / 4) * 110, -Math.cos(i * Math.PI / 4) * 110];
    const svgBox = A.h('div', { class: 'coinbox' });
    const info = A.h('div', { class: 'coininfo' });
    host.append(A.h('div', { class: 'split' }, svgBox, info));
    const ctl = A.h('div', { class: 'ctlrow' });
    const out = A.h('div', { class: 'answer' });
    host.append(ctl, out);
    function draw(s) {
      const e = s.indexOf('0');
      let g = `<svg viewBox="-150 -150 300 300" width="300" height="300" class="coins"><circle r="110" class="ring"/>`;
      for (const i of [1, 3, 5, 7]) { const [x, y] = pos(i); g += `<line x1="0" y1="0" x2="${x}" y2="${y}" class="spoke"/>`; }
      for (let i = 0; i < 9; i++) { const [x, y] = pos(i), c = s[i], movable = adj[e].includes(i); g += `<g class="slot ${c === '0' ? 'empty' : ''} ${movable ? 'mov' : ''}" data-i="${i}" tabindex="${movable ? 0 : -1}" role="button" aria-label="${c === '0' ? 'empty circle' : 'coin ' + c}"><circle cx="${x}" cy="${y}" r="24"/>${c !== '0' ? `<text x="${x}" y="${y + 7}" text-anchor="middle">${c}</text>` : ''}</g>`; }
      svgBox.innerHTML = g + '</svg>';
      svgBox.querySelectorAll('.slot.mov').forEach(el => { const mv = () => { const j = +el.dataset.i; const a = state.split(''); a[e] = a[j]; a[j] = '0'; state = a.join(''); moves++; plan = null; draw(state); }; el.onclick = mv; el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); mv(); } }; });
      const succN = adj[e].length;
      info.innerHTML = `<div class="kv"><span>Coins out of place, h₁</span><b>${h1(s)}</b></div><div class="kv"><span>Sum of line distances, h₂</span><b>${h2(s)}</b></div><div class="kv"><span>Successors of this state</span><b>${succN}</b></div><div class="kv"><span>Your moves</span><b>${moves}</b></div>${s === GOAL ? '<p class="good"><b>Solved: 1 at 12 o’clock, clockwise.</b></p>' : '<p class="muted">Click a highlighted coin to slide it into the empty circle.</p>'}`;
    }
    ctl.append(
      A.h('button', { class: 'btn', type: 'button', onclick: () => { state = cfg.start; moves = 0; draw(state); } }, 'Exam start state'),
      A.h('button', { class: 'btn primary', type: 'button', onclick: () => solveBoth() }, 'Solve with A* (h₁ vs h₂)'));
    const pb = A.h('div'); host.append(pb);
    let bar = null;
    function solveBoth() {
      out.innerHTML = 'Searching…';
      setTimeout(() => {
        const s0 = state;
        const r1 = A.solve(s0, s => s === GOAL, succ, h1), r2 = A.solve(s0, s => s === GOAL, succ, h2);
        plan = r2.plan; planStart = s0;
        out.innerHTML = r2.cost === null ? 'This arrangement cannot reach the goal (wrong parity half of the state space).' : `Optimal solution: <b>${r2.cost} moves</b>. A* expanded <b>${r1.expanded.toLocaleString()}</b> states with h₁ and only <b>${r2.expanded.toLocaleString()}</b> with h₂ — same answer, far less work.`;
        if (!bar && r2.cost !== null) bar = playBar(pb, () => plan || [], k => { state = k ? plan[k - 1][1] : planStart; draw(state); });
        if (bar) bar.go(0);
      }, 30);
    }
    draw(state);
  };

  // ---------- warehouse robot ----------
  A.engines.warehouse = function (host, cfg) {
    const R = cfg.rows, C = cfg.cols, ids = Object.keys(cfg.crates);
    const enc = (r, cs) => r.join(',') + '|' + cs.map(p => p.join(',')).join('|');
    const dec = s => { const parts = s.split('|').map(p => p.split(',').map(Number)); return [parts[0], parts.slice(1)]; };
    const start = enc(cfg.robot, ids.map(i => cfg.crates[i]));
    const goalC = ids.map(i => cfg.targets[i].join(',')).join('|');
    const isGoal = s => s.slice(s.indexOf('|') + 1) === goalC;
    const D = [[-1, 0, 'Up'], [1, 0, 'Down'], [0, -1, 'Left'], [0, 1, 'Right']];
    const succ = s => { const [r, cs] = dec(s), out = []; for (const [dr, dc, nm] of D) { const q = [r[0] + dr, r[1] + dc]; if (q[0] < 0 || q[1] < 0 || q[0] >= R || q[1] >= C) continue; const k = cs.findIndex(p => p[0] === q[0] && p[1] === q[1]); if (k >= 0) { const q2 = [q[0] + dr, q[1] + dc]; if (q2[0] < 0 || q2[1] < 0 || q2[0] >= R || q2[1] >= C || cs.some(p => p[0] === q2[0] && p[1] === q2[1])) continue; const ncs = cs.map(p => p.slice()); ncs[k] = q2; out.push([enc(q, ncs), 2, `Push crate ${ids[k]} ${nm}`]); } else out.push([enc(q, cs), 1, `Move ${nm}`]); } return out; };
    const h = s => { const [, cs] = dec(s); return 2 * cs.reduce((t, p, k) => t + Math.abs(p[0] - cfg.targets[ids[k]][0]) + Math.abs(p[1] - cfg.targets[ids[k]][1]), 0); };
    let cur = start, cost = 0;
    const box = A.h('div', { class: 'figbox' }), info = A.h('div', { class: 'stepmsg' });
    host.append(box, info);
    function draw(s) {
      const [r, cs] = dec(s), Z = 52;
      let g = `<svg viewBox="0 0 ${C * Z + 2} ${R * Z + 2}" width="${C * Z + 2}" height="${R * Z + 2}" class="wh">`;
      for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) g += `<rect x="${1 + j * Z}" y="${1 + i * Z}" width="${Z}" height="${Z}" class="wcell"/>`;
      ids.forEach(id => { const [i, j] = cfg.targets[id]; g += `<rect x="${1 + j * Z}" y="${1 + i * Z}" width="${Z}" height="${Z}" class="wtarget"/><text x="${1 + j * Z + Z / 2}" y="${1 + i * Z + Z / 2 + 7}" text-anchor="middle" class="wtl">${id}</text>`; });
      cs.forEach((p, k) => { const on = p[0] === cfg.targets[ids[k]][0] && p[1] === cfg.targets[ids[k]][1]; g += `<g class="crate ${on ? 'on' : ''}"><rect x="${1 + p[1] * Z + 6}" y="${1 + p[0] * Z + 6}" width="${Z - 12}" height="${Z - 12}" rx="3"/><path d="M${1 + p[1] * Z + 6},${1 + p[0] * Z + 6} l${Z - 12},${Z - 12} M${1 + p[1] * Z + Z - 6},${1 + p[0] * Z + 6} l${-(Z - 12)},${Z - 12}"/><text x="${1 + p[1] * Z + Z / 2}" y="${1 + p[0] * Z + Z / 2 + 6}" text-anchor="middle">${ids[k]}</text></g>`; });
      g += `<g class="robot"><circle cx="${1 + r[1] * Z + Z / 2}" cy="${1 + r[0] * Z + Z / 2}" r="15"/><circle cx="${1 + r[1] * Z + Z / 2 - 5}" cy="${1 + r[0] * Z + Z / 2 - 3}" r="2.6" class="eye"/><circle cx="${1 + r[1] * Z + Z / 2 + 5}" cy="${1 + r[0] * Z + Z / 2 - 3}" r="2.6" class="eye"/></g>`;
      box.innerHTML = g + '</svg>';
      info.innerHTML = `State = (robot (${r.join(',')}), ${cs.map((p, k) => `crate ${ids[k]} (${p.join(',')})`).join(', ')}) · h = ${h(s)} · cost so far ${cost}${isGoal(s) ? ' · <b class="good">goal reached</b>' : ''}`;
    }
    const pad = A.h('div', { class: 'ctlrow' });
    D.forEach(([, , nm]) => pad.append(A.h('button', { class: 'btn', type: 'button', onclick: () => { const m = succ(cur).find(x => x[2].endsWith(nm)); if (m) { cur = m[0]; cost += m[1]; draw(cur); } } }, nm)));
    pad.append(A.h('button', { class: 'btn ghost', type: 'button', onclick: () => { cur = start; cost = 0; draw(cur); } }, 'Reset'));
    host.append(A.h('p', { class: 'muted' }, 'Drive the robot yourself (moving into a crate pushes it), or let search find the cheapest plan.'), pad);
    const out = A.h('div', { class: 'answer' });
    let plan = null; const pb = A.h('div');
    host.append(A.h('button', { class: 'btn primary', type: 'button', onclick: () => { out.textContent = 'Searching…'; setTimeout(() => { const a = A.solve(start, isGoal, succ, h, 2000000); plan = a.plan; out.innerHTML = `Minimum-cost plan: <b>cost ${a.cost}</b> (${a.plan.filter(p => p[0].startsWith('Push')).length} pushes × 2 + ${a.plan.filter(p => p[0].startsWith('Move')).length} moves × 1). A* with h expanded ${a.expanded.toLocaleString()} states; uniform-cost search (h = 0) needs about 695,000 for the same plan.<ol class="plan">${a.plan.map(p => `<li>${p[0]}</li>`).join('')}</ol>`; if (!pb.firstChild) playBar(pb, () => plan, k => { cur = k ? plan[k - 1][1] : start; cost = 0; for (let j = 0; j < k; j++) cost += plan[j][0].startsWith('Push') ? 2 : 1; draw(cur); }); }, 30); } }, 'Find the minimum-cost plan'), pb, out);
    draw(cur);
  };

  // ---------- insect ----------
  A.engines.insect = function (host, cfg) {
    const M = cfg.map, R = M.length, C = M[0].length;
    let A_ = cfg.air || 2;
    const box = A.h('div', { class: 'figbox' }), info = A.h('div', { class: 'stepmsg' }), out = A.h('div', { class: 'answer' });
    const sl = A.h('input', { type: 'range', min: 0, max: 6, value: A_, id: 'ins-air', class: 'range' });
    const slv = A.h('b', null, String(A_));
    host.append(A.h('div', { class: 'calc' }, A.h('label', { for: 'ins-air' }, 'Breath limit A = '), slv, sl), box, info);
    let plan = [], k = 0;
    const pb = A.h('div'); host.append(pb, out);
    let bar = null;
    function solve() {
      const st = [cfg.start[0], cfg.start[1], A_]; const key = s => s.join(','); const prev = new Map([[key(st), null]]); const q = [st]; let end = null;
      while (q.length) { const s = q.shift(); if (M[s[0]][s[1]] === 'X') { end = s; break; } for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]]) { const r = s[0] + dr, c = s[1] + dc; if (r < 0 || c < 0 || r >= R || c >= C || M[r][c] === '#') continue; let a; if (M[r][c] === '~') { if (s[2] < 1) continue; a = s[2] - 1; } else a = A_; const t = [r, c, a]; if (!prev.has(key(t))) { prev.set(key(t), s); q.push(t); } } }
      plan = []; let s = end; while (s) { plan.push(s); s = prev.get(key(s)); } plan.reverse();
      out.innerHTML = end ? `With A = ${A_} the shortest route takes <b>${plan.length - 1}</b> time steps. States visited: ${plan.map(s => `(${s.join(',')})`).join(' → ')}` : `With A = ${A_} the insect cannot reach X: some stretch of flooded squares is longer than ${A_}.`;
      if (!bar) bar = playBar(pb, () => plan.slice(1), j => { k = j; draw(); });
      bar.go(0);
    }
    function draw() {
      const Z = 50, s = plan[k] || [cfg.start[0], cfg.start[1], A_];
      let g = `<svg viewBox="0 0 ${C * Z + 2} ${R * Z + 2}" width="${C * Z + 2}" height="${R * Z + 2}" class="ins">`;
      for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { const t = M[i][j]; g += `<rect x="${1 + j * Z}" y="${1 + i * Z}" width="${Z}" height="${Z}" class="${t === '#' ? 'wall' : t === '~' ? 'water' : 'free'}"/>`; if (t === 'X') g += `<text x="${1 + j * Z + Z / 2}" y="${1 + i * Z + Z / 2 + 8}" text-anchor="middle" class="xgoal">X</text>`; }
      const trail = plan.slice(0, k + 1).map(p => `${1 + p[1] * Z + Z / 2},${1 + p[0] * Z + Z / 2}`).join(' ');
      if (plan.length) g += `<polyline points="${trail}" class="gpath"/>`;
      g += `<g class="bug"><ellipse cx="${1 + s[1] * Z + Z / 2}" cy="${1 + s[0] * Z + Z / 2}" rx="14" ry="12"/><line x1="${1 + s[1] * Z + Z / 2}" y1="${1 + s[0] * Z + Z / 2 - 12}" x2="${1 + s[1] * Z + Z / 2}" y2="${1 + s[0] * Z + Z / 2 + 12}"/></g>`;
      box.innerHTML = g + '</svg>';
      info.innerHTML = `State (row, col, air) = <b>(${s.join(', ')})</b> · air ${'●'.repeat(s[2])}${'○'.repeat(Math.max(0, A_ - s[2]))}`;
    }
    sl.oninput = () => { A_ = +sl.value; slv.textContent = A_; k = 0; solve(); };
    solve();
  };

  // ---------- n-queens board ----------
  A.engines.queens = function (host, cfg) {
    let n = cfg.n || 6; let Q = new Set(cfg.start.map(([r, c]) => r + ',' + c));
    const box = A.h('div', { class: 'qbox' }), info = A.h('div', { class: 'stepmsg' });
    host.append(box, info);
    const pairs = () => { const q = [...Q].map(s => s.split(',').map(Number)), out = []; for (let i = 0; i < q.length; i++) for (let j = i + 1; j < q.length; j++) { const [a, b] = [q[i], q[j]]; if (a[0] === b[0] || a[1] === b[1] || Math.abs(a[0] - b[0]) === Math.abs(a[1] - b[1])) out.push([a, b]); } return out; };
    function draw() {
      const Z = 46, P = pairs();
      let g = `<svg viewBox="0 0 ${n * Z + 2} ${n * Z + 2}" width="${n * Z + 2}" height="${n * Z + 2}" class="qsvg">`;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) g += `<rect data-rc="${r},${c}" x="${1 + c * Z}" y="${1 + r * Z}" width="${Z}" height="${Z}" class="${(r + c) % 2 ? 'dk' : 'lt'}"/>`;
      for (const [a, b] of P) g += `<line x1="${1 + a[1] * Z + Z / 2}" y1="${1 + a[0] * Z + Z / 2}" x2="${1 + b[1] * Z + Z / 2}" y2="${1 + b[0] * Z + Z / 2}" class="qatt"/>`;
      for (const s of Q) { const [r, c] = s.split(',').map(Number); g += `<text x="${1 + c * Z + Z / 2}" y="${1 + r * Z + Z / 2 + 10}" text-anchor="middle" class="qq">♛</text>`; }
      box.innerHTML = g + '</svg>';
      box.querySelectorAll('rect').forEach(el => el.onclick = () => { const k = el.dataset.rc; Q.has(k) ? Q.delete(k) : Q.add(k); draw(); });
      info.innerHTML = `${Q.size} queen${Q.size === 1 ? '' : 's'} on the board, <b>${P.length}</b> attacking pair${P.length === 1 ? '' : 's'} → h = (n − queens) + attacking pairs = ${n - Q.size} + ${P.length} = <b>${n - Q.size + P.length}</b>${Q.size === n && !P.length ? ' · <b class="good">solution</b>' : ''}. Click squares to add or remove queens.`;
    }
    const ctl = A.h('div', { class: 'ctlrow' },
      A.h('button', { class: 'btn', type: 'button', onclick: () => { n = cfg.n || 6; Q = new Set(cfg.start.map(([r, c]) => r + ',' + c)); draw(); } }, 'Exam configuration'),
      A.h('button', { class: 'btn ghost', type: 'button', onclick: () => { Q = new Set(); draw(); } }, 'Empty board'),
      A.h('button', { class: 'btn primary', type: 'button', onclick: () => { const sol = []; let tries = 0; (function bt(c) { if (c === n) return true; for (let r = 0; r < n; r++) { tries++; if (sol.every(([rr, cc]) => rr !== r && Math.abs(rr - r) !== c - cc)) { sol.push([r, c]); if (bt(c + 1)) return true; sol.pop(); } } return false; })(0); Q = new Set(sol.map(([r, c]) => r + ',' + c)); draw(); info.innerHTML += ` Depth-first backtracking (one queen per column) tried ${tries} placements.`; } }, 'Solve by DFS backtracking'));
    host.append(ctl); draw();
  };

  // ---------- discs (odds / evens) ----------
  A.engines.discs = function (host, cfg) {
    const names = ['A', 'B', 'C', 'D', 'E'];
    const start = [[], [], [], [], [8, 7, 6, 5, 4, 3, 2, 1]];
    const enc = s => s.map(p => p.join('.')).join('/');
    const dec = k => k.split('/').map(p => p ? p.split('.').map(Number) : []);
    const succ = k => { const s = dec(k), out = []; s.forEach((src, i) => { if (!src.length) return; const d = src[src.length - 1]; s.forEach((dst, j) => { if (i === j) return; if (dst.length && (dst[dst.length - 1] < d || dst[dst.length - 1] % 2 !== d % 2)) return; const t = s.map(p => p.slice()); t[i].pop(); t[j].push(d); out.push([enc(t), 1, `disc ${d}: ${names[i]} → ${names[j]}`]); }); }); return out; };
    const isGoal = k => { const s = dec(k); return !s[4].length && s[0].concat(s[2]).every(d => d % 2) && s[1].concat(s[3]).every(d => !(d % 2)); };
    const h = k => { const s = dec(k); let w = s[4].length; s.forEach((p, i) => { if (i === 0 || i === 2) w += p.filter(d => !(d % 2)).length; if (i === 1 || i === 3) w += p.filter(d => d % 2).length; }); return w; };
    let cur = enc(start), sel = null, moves = 0;
    const box = A.h('div', { class: 'discs' }), info = A.h('div', { class: 'stepmsg' }), out = A.h('div', { class: 'answer' });
    host.append(box, info);
    function draw() {
      const s = dec(cur);
      box.innerHTML = names.map((nm, i) => `<button type="button" class="pile ${i % 2 === 0 && i < 4 ? 'odd' : i < 4 ? 'even' : 'mid'} ${sel === i ? 'sel' : ''}" data-i="${i}" aria-label="pile ${nm}"><span class="stack">${s[i].slice().reverse().map(d => `<span class="disc d${d}">${d}</span>`).join('')}</span><span class="pl">${nm}${i < 4 ? (i % 2 === 0 ? ' · odd' : ' · even') : ' · centre'}</span></button>`).join('');
      box.querySelectorAll('.pile').forEach(b => b.onclick = () => { const i = +b.dataset.i; if (sel === null) { if (dec(cur)[i].length) sel = i; } else { const m = succ(cur).find(x => x[2].endsWith(`${names[sel]} → ${names[i]}`)); if (m) { cur = m[0]; moves++; } sel = null; } draw(); });
      info.innerHTML = `State: ${names.map((nm, i) => `${nm}=[${s[i].join(',')}]`).join(' ')} (bottom → top) · h = ${h(cur)} · moves ${moves}${isGoal(cur) ? ' · <b class="good">goal</b>' : ''}. Click a pile, then the pile to move its top disc to.`;
    }
    let plan = null; const pb = A.h('div');
    host.append(A.h('div', { class: 'ctlrow' }, A.h('button', { class: 'btn ghost', type: 'button', onclick: () => { cur = enc(start); moves = 0; sel = null; draw(); } }, 'Reset'), A.h('button', { class: 'btn primary', type: 'button', onclick: () => {
      // reachable count
      const seen = new Set([enc(start)]), q = [enc(start)]; while (q.length) { const k = q.shift(); for (const [t] of succ(k)) if (!seen.has(t)) { seen.add(t); q.push(t); } }
      const r = A.solve(enc(start), isGoal, succ, h); plan = r.plan;
      out.innerHTML = `States reachable from the start: <b>${seen.size.toLocaleString()}</b>. Start has <b>${succ(enc(start)).length}</b> successors. Fewest moves to a goal: <b>${r.cost}</b> (A* with h expanded ${r.expanded.toLocaleString()} states).<ol class="plan">${r.plan.map(p => `<li>${p[0]}</li>`).join('')}</ol>`;
      if (!pb.firstChild) playBar(pb, () => plan, k => { cur = k ? plan[k - 1][1] : enc(start); moves = k; draw(); });
    } }, 'Count states and solve')), pb, out);
    draw();
  };

  // ---------- lights ----------
  A.engines.lights = function (host, cfg) {
    const N = 5; const parse = rows => rows.map(r => [...r].map(ch => ch === '1'));
    let g = parse(cfg.start), moves = 0;
    const box = A.h('div', { class: 'lights' }), info = A.h('div', { class: 'stepmsg' }), out = A.h('div', { class: 'answer' });
    host.append(box, info);
    const on = () => g.flat().filter(Boolean).length;
    const press = (grid, r, c) => { const t = grid.map(x => x.slice()); for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) { const i = r + dr, j = c + dc; if (i >= 0 && j >= 0 && i < N && j < N) t[i][j] = !t[i][j]; } return t; };
    function draw() {
      box.innerHTML = g.map((row, r) => row.map((v, c) => `<button type="button" class="lamp ${v ? 'on' : ''}" data-r="${r}" data-c="${c}" ${v ? '' : 'disabled'} aria-label="row ${r + 1} column ${c + 1} ${v ? 'on' : 'off'}"></button>`).join('')).join('');
      box.querySelectorAll('.lamp.on').forEach(b => b.onclick = () => { g = press(g, +b.dataset.r, +b.dataset.c); moves++; draw(); });
      info.innerHTML = `Lights on: <b>${on()}</b> · successors (= lit cells) ${on()} · h = ⌈on / 5⌉ = <b>${Math.ceil(on() / 5)}</b> · moves ${moves}${on() === 0 ? ' · <b class="good">solved</b>' : ''}`;
    }
    const enc = grid => grid.flat().map(v => v ? 1 : 0).join('');
    let plan = null; const pb = A.h('div');
    host.append(A.h('div', { class: 'ctlrow' }, A.h('button', { class: 'btn ghost', type: 'button', onclick: () => { g = parse(cfg.start); moves = 0; draw(); } }, 'Exam start'), A.h('button', { class: 'btn primary', type: 'button', onclick: () => {
      const s0 = enc(g); const dec = s => Array.from({ length: N }, (_, r) => [...s.slice(r * N, r * N + N)].map(x => x === '1'));
      const succ = s => { const out = []; for (let i = 0; i < N * N; i++) if (s[i] === '1') out.push([enc(press(dec(s), Math.floor(i / N), i % N)), 1, `select row ${Math.floor(i / N) + 1}, col ${i % N + 1}`]); return out; };
      const r = A.solve(s0, s => !s.includes('1'), succ, s => Math.ceil((s.match(/1/g) || []).length / 5), 300000);
      plan = r.plan; const st = s0;
      out.innerHTML = r.cost === null ? 'No solution found within the search limit.' : `Fewest moves: <b>${r.cost}</b> (A* expanded ${r.expanded.toLocaleString()} states).<ol class="plan">${r.plan.map(p => `<li>${p[0]}</li>`).join('')}</ol>`;
      pb.innerHTML = ''; playBar(pb, () => plan, k => { g = dec(k ? plan[k - 1][1] : st); moves = k; draw(); });
    } }, 'Solve with A*')), pb, out);
    draw();
  };

  // ---------- water jugs ----------
  A.engines.jugs = function (host, cfg) {
    const [CA, CB] = cfg.caps;
    const succ = s => { const [a, b] = s.split(',').map(Number), out = []; const add = (x, y, c, l) => out.push([x + ',' + y, c, l]);
      if (a < CA) add(CA, b, CA - a, `fill ${CA}L (draw ${CA - a})`); if (b < CB) add(a, CB, CB - b, `fill ${CB}L (draw ${CB - b})`);
      if (a) add(0, b, 0, `empty ${CA}L`); if (b) add(a, 0, 0, `empty ${CB}L`);
      if (a && b < CB) { const t = Math.min(a, CB - b); add(a - t, b + t, 0, `pour ${CA}L → ${CB}L`); } if (b && a < CA) { const t = Math.min(b, CA - a); add(a + t, b - t, 0, `pour ${CB}L → ${CA}L`); } return out; };
    const isGoal = s => s === '1,0' || s === '0,1';
    const r = A.solve('0,0', isGoal, succ, () => 0);
    const box = A.h('div', { class: 'jugs' }), info = A.h('div', { class: 'stepmsg' });
    host.append(box, info);
    let k = 0;
    const draw = () => { const s = k ? r.plan[k - 1][1] : '0,0'; const [a, b] = s.split(',').map(Number); const drawn = r.plan.slice(0, k).reduce((t, p) => t + (+((p[0].match(/draw (\d+)/) || [0, 0])[1])), 0);
      box.innerHTML = [[a, CA], [b, CB]].map(([v, c]) => `<div class="jug"><div class="jugin" style="height:${(c / CB) * 160}px"><div class="water" style="height:${(v / c) * 100}%"></div></div><span>${v} / ${c} L</span></div>`).join('');
      info.innerHTML = `State (x, y) = <b>(${a}, ${b})</b> · water drawn so far <b>${drawn} L</b>${k ? ' · last action: ' + r.plan[k - 1][0] : ''}${isGoal(s) ? ' · <b class="good">goal</b>' : ''}`; };
    playBar(host, () => r.plan, j => { k = j; draw(); });
    host.append(A.h('div', { class: 'answer', html: `Uniform-cost search (cost = litres drawn) finds the cheapest plan: <b>${r.cost} litres</b>.<ol class="plan">${r.plan.map(p => `<li>${p[0]} → (${p[1].replace(',', ', ')})</li>`).join('')}</ol>` }));
    draw();
  };

  // ---------- diamond maze (walls) ----------
  A.engines.diamondMaze = function (host, cfg) {
    const R = 6, C = 6, walls = new Set(cfg.walls); // "r,c|r2,c2"
    const wall = (a, b) => walls.has(a + '|' + b) || walls.has(b + '|' + a);
    const dia = cfg.diamonds; // [[r,c],...]
    let pos = [0, 0], got = 0, steps = 0;
    const box = A.h('div', { class: 'figbox' }), info = A.h('div', { class: 'stepmsg' }), out = A.h('div', { class: 'answer' });
    host.append(box, info);
    const nb = ([r, c]) => [[-1, 0, 'Up'], [1, 0, 'Down'], [0, -1, 'Left'], [0, 1, 'Right']].map(([dr, dc, n]) => [[r + dr, c + dc], n]).filter(([[i, j]]) => i >= 0 && j >= 0 && i < R && j < C && !wall(`${r},${c}`, `${i},${j}`));
    const pick = (p, mask) => { const k = dia.findIndex(d => d[0] === p[0] && d[1] === p[1]); return k >= 0 ? mask | (1 << k) : mask; };
    function draw(trail) {
      const Z = 54; let g = `<svg viewBox="-4 -4 ${C * Z + 8} ${R * Z + 8}" width="${C * Z + 8}" height="${R * Z + 8}" class="dmaze">`;
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) g += `<rect x="${c * Z}" y="${r * Z}" width="${Z}" height="${Z}" class="dcell"/>`;
      g += `<text x="${Z / 2}" y="${-1}" text-anchor="middle" class="dlab"></text>`;
      // walls
      for (const w of walls) { const [a, b] = w.split('|').map(s => s.split(',').map(Number)); if (a[0] === b[0]) { const x = Math.max(a[1], b[1]) * Z; g += `<line x1="${x}" y1="${a[0] * Z}" x2="${x}" y2="${a[0] * Z + Z}" class="dwall"/>`; } else { const y = Math.max(a[0], b[0]) * Z; g += `<line x1="${a[1] * Z}" y1="${y}" x2="${a[1] * Z + Z}" y2="${y}" class="dwall"/>`; } }
      g += `<rect x="0" y="0" width="${C * Z}" height="${R * Z}" class="dborder"/><line x1="0" y1="4" x2="0" y2="${Z - 4}" class="dgap"/><line x1="${C * Z}" y1="${5 * Z + 4}" x2="${C * Z}" y2="${6 * Z - 4}" class="dgap"/>`;
      dia.forEach((d, k) => { if (!(got >> k & 1)) g += `<path d="M${d[1] * Z + Z / 2},${d[0] * Z + 14} l12,12 l-12,14 l-12,-14 z" class="gem"/>`; });
      if (trail) g += `<polyline points="${trail.map(p => `${p[1] * Z + Z / 2},${p[0] * Z + Z / 2}`).join(' ')}" class="gpath"/>`;
      g += `<circle cx="${pos[1] * Z + Z / 2}" cy="${pos[0] * Z + Z / 2}" r="13" class="agent"/>`;
      box.innerHTML = g + '</svg>';
      info.innerHTML = `State = (row ${pos[0] + 1}, column ${'ABCDEF'[pos[1]]}, diamonds collected {${dia.map((d, k) => got >> k & 1 ? 'ABCDEF'[d[1]] + (d[0] + 1) : null).filter(Boolean).join(', ')}}) · moves ${steps}${pos[0] === 5 && pos[1] === 5 ? ' · at the exit' + (got === (1 << dia.length) - 1 ? ' with every diamond: <b class="good">goal</b>' : '') : ''}`;
    }
    const pad = A.h('div', { class: 'ctlrow' });
    ['Up', 'Down', 'Left', 'Right'].forEach(nm => pad.append(A.h('button', { class: 'btn', type: 'button', onclick: () => { const m = nb(pos).find(x => x[1] === nm); if (m) { pos = m[0]; got = pick(pos, got); steps++; draw(); } } }, nm)));
    pad.append(A.h('button', { class: 'btn ghost', type: 'button', onclick: () => { pos = [0, 0]; got = 0; steps = 0; draw(); } }, 'Reset'));
    pad.append(A.h('button', { class: 'btn primary', type: 'button', onclick: () => {
      const full = (1 << dia.length) - 1; const key = (p, m) => p.join(',') + '#' + m;
      const solveTo = needAll => { const s0 = [[0, 0], pick([0, 0], 0)]; const prev = new Map([[key(...s0), null]]); const q = [s0]; let end = null, n = 0; while (q.length) { const [p, m] = q.shift(); n++; if (p[0] === 5 && p[1] === 5 && (!needAll || m === full)) { end = [p, m]; break; } for (const [np] of nb(p)) { const nm = pick(np, m); const k = key(np, nm); if (!prev.has(k)) { prev.set(k, [p, m]); q.push([np, nm]); } } } const path = []; let s = end; while (s) { path.push(s[0]); s = prev.get(key(...s)); } return { path: path.reverse(), n }; };
      const a = solveTo(false), b = solveTo(true);
      pos = [5, 5]; got = full; steps = b.path.length - 1; draw(b.path);
      out.innerHTML = `BFS over states (row, col): shortest route to the exit = <b>${a.path.length - 1}</b> moves. BFS over states (row, col, diamonds collected): shortest route that collects all ${dia.length} diamonds and exits = <b>${b.path.length - 1}</b> moves. Same squares, different state — the collected set has to be part of the state.`;
    } }, 'Solve with BFS'));
    host.append(pad, out); draw();
  };

  // ---------- swamp / moor lab (editable) ----------
  A.engines.swampLab = function (host, cfg) {
    let R = cfg.rows, C = cfg.cols, dry = cfg.dry.map(r => [...r].map(ch => ch === '.')), entry = cfg.entry;
    const box = A.h('div', { class: 'figbox' }), out = A.h('div', { class: 'answer' });
    host.append(A.h('p', { class: 'muted' }, 'Click squares to switch dry land and water. The search re-runs on every change.'), box, out);
    function solve() {
      if (!dry[entry][0]) return null;
      const q = [[entry, 0]], prev = new Map([[entry + ',0', null]]);
      while (q.length) { const [r, c] = q.shift(); if (c === C - 1) { const p = []; let k = r + ',' + c; while (k) { p.push(k.split(',').map(Number)); k = prev.get(k); } return p.reverse(); } for (const dr of [-1, 0, 1]) { const i = r + dr, j = c + 1; if (i < 0 || i >= R || j >= C || !dry[i][j]) continue; const k = i + ',' + j; if (!prev.has(k)) { prev.set(k, r + ',' + c); q.push([i, j]); } } }
      return null;
    }
    function draw() {
      const Z = 44, p = solve();
      let g = `<svg viewBox="0 0 ${C * Z + 2} ${R * Z + 2}" width="${C * Z + 2}" height="${R * Z + 2}" class="swamp">`;
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) g += `<rect data-rc="${r},${c}" x="${1 + c * Z}" y="${1 + r * Z}" width="${Z}" height="${Z}" class="${dry[r][c] ? 'dry' : 'wet'} ${r === entry && c === 0 ? 'entry' : ''}"/>`;
      if (p) g += `<polyline points="${p.map(([r, c]) => `${1 + c * Z + Z / 2},${1 + r * Z + Z / 2}`).join(' ')}" class="gpath"/>`;
      box.innerHTML = g + '</svg>';
      box.querySelectorAll('rect').forEach(el => el.onclick = () => { const [r, c] = el.dataset.rc.split(',').map(Number); dry[r][c] = !dry[r][c]; draw(); });
      out.innerHTML = p ? `Path found (BFS, fewest moves): ${p.map(([r, c]) => `(${r},${c})`).join(' → ')} — states are just (row, column) of the walker.` : 'No path: every route right is blocked by water.';
    }
    draw();
  };
})(window.AIN);

/* ---- engines/search.js ---- */
/* Graph / grid search tracer: A*, UCS, BFS, DFS, greedy, hill climbing, depth-limited */
(function (A) {
  const NAMES = { astar: 'A* (g+h)', ucs: 'Uniform cost (g)', bfs: 'Breadth-first', dfs: 'Depth-first', greedy: 'Greedy best-first (h)', hill: 'Hill climbing', dls: 'Depth-limited' };
  function trace(cfg, mode, goals, hset) {
    const H = n => (hset ? hset[n] : (cfg.nodes[n] && cfg.nodes[n].h)) || 0;
    const adj = {};
    if (cfg.adj) for (const k in cfg.adj) adj[k] = cfg.adj[k].map(x => Array.isArray(x) ? x : [x, cfg.costOf ? cfg.costOf(k, x) : 1]);
    else for (const [a, b, c] of cfg.edges) { (adj[a] = adj[a] || []).push([b, c]); if (!cfg.directed) (adj[b] = adj[b] || []).push([a, c]); }
    const kidsOf = n => { const k = (adj[n] || []).slice(); if (cfg.order !== 'given') k.sort((x, y) => x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0); return k; };
    const key = p => { const e = p.nodes[p.nodes.length - 1]; const pr = mode === 'astar' ? p.g + H(e) : mode === 'ucs' ? p.g : H(e); return [pr, cfg.tie === 'h' ? H(e) : 0, e, p.nodes.join(',')]; };
    const cmp = (a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 4; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; } return 0; };
    const steps = []; const order = [];
    const goalSet = new Set(goals);
    if (mode === 'hill') {
      let cur = { nodes: [cfg.start], g: 0 };
      for (let it = 0; it < 60; it++) {
        const e = cur.nodes[cur.nodes.length - 1]; order.push(e);
        if (goalSet.has(e)) { steps.push({ pop: cur, frontier: [], goal: true, note: `${e} is a goal: stop.` }); return { steps, order, result: cur }; }
        const kids = kidsOf(e).filter(([c]) => !cur.nodes.includes(c)).map(([c, w]) => ({ nodes: [...cur.nodes, c], g: cur.g + w }));
        kids.sort((a, b) => H(a.nodes[a.nodes.length - 1]) - H(b.nodes[b.nodes.length - 1]) || (a.nodes[a.nodes.length - 1] < b.nodes[b.nodes.length - 1] ? -1 : 1));
        const best = kids[0];
        const strict = cfg.hillStrict !== false;
        if (!best || (strict && H(best.nodes[best.nodes.length - 1]) >= H(e))) { steps.push({ pop: cur, frontier: kids, goal: false, note: best ? `No child improves on h(${e}) = ${H(e)}: hill climbing stops here (stuck).` : `${e} has no children: stuck.` }); return { steps, order, result: null }; }
        steps.push({ pop: cur, frontier: kids, goal: false, note: `Move to the child with the lowest h: ${best.nodes[best.nodes.length - 1]} (h = ${H(best.nodes[best.nodes.length - 1])}).` });
        cur = best;
      }
      return { steps, order, result: null };
    }
    let fr = [{ nodes: [cfg.start], g: 0 }];
    const expanded = new Set();
    for (let it = 0; it < (cfg.maxSteps || 400) && fr.length; it++) {
      if (['astar', 'ucs', 'greedy'].includes(mode)) fr.sort(cmp);
      const p = fr.shift(); const e = p.nodes[p.nodes.length - 1];
      if (cfg.explored && expanded.has(e)) { steps.push({ pop: p, frontier: fr.slice(), goal: false, skipped: true, note: `${e} was already expanded: discard this path (multiple-path pruning).` }); continue; }
      order.push(e);
      if (goalSet.has(e)) { steps.push({ pop: p, frontier: fr.slice(), goal: true }); return { steps, order, result: p }; }
      expanded.add(e);
      let kids = [];
      if (!(mode === 'dls' && p.nodes.length - 1 >= (cfg.limit || 3)))
        for (const [c, w] of kidsOf(e)) {
          if (cfg.cycleCheck !== false && p.nodes.includes(c)) continue;
          if (cfg.explored && expanded.has(c)) continue;
          kids.push({ nodes: [...p.nodes, c], g: p.g + w });
        }
      if (mode === 'dfs' || mode === 'dls') fr = kids.concat(fr); else fr = fr.concat(kids);
      if (['astar', 'ucs', 'greedy'].includes(mode)) fr.sort(cmp);
      steps.push({ pop: p, frontier: fr.slice(), goal: false, kids: kids.length });
    }
    return { steps, order, result: null };
  }
  A.searchTrace = trace;

  A.engines.graphSearch = function (host, cfg) {
    const algos = cfg.algos || ['astar'];
    const goalSets = cfg.goalSets || [{ label: 'Goal', goals: cfg.goals }];
    const hsets = cfg.hsets || null;
    let mode = cfg.default || algos[0], gi = 0, hi = 0;
    const sep = cfg.sep || '→';
    const ctl = A.h('div', { class: 'ctlrow' });
    const algoSel = A.h('div', { class: 'seg', role: 'group', 'aria-label': 'Algorithm' });
    algos.forEach(a => algoSel.append(A.h('button', { type: 'button', class: 'segb', 'data-a': a, onclick: () => { mode = a; rebuild(); } }, cfg.algoNames && cfg.algoNames[a] || NAMES[a])));
    ctl.append(algoSel);
    if (goalSets.length > 1) {
      const gs = A.h('select', { class: 'sel', id: (cfg.id || 'gs') + '-goals', 'aria-label': 'Goal set', onchange: e => { gi = +e.target.value; rebuild(); } });
      goalSets.forEach((g, k) => gs.append(A.h('option', { value: k }, g.label)));
      ctl.append(gs);
    }
    if (hsets) {
      const hs = A.h('select', { class: 'sel', 'aria-label': 'Heuristic', onchange: e => { hi = +e.target.value; rebuild(); } });
      hsets.forEach((g, k) => hs.append(A.h('option', { value: k }, g.label)));
      ctl.append(hs);
    }
    host.append(ctl);
    const fig = A.h('div', { class: 'scroll figbox' });
    host.append(fig);
    const now = A.h('div', { class: 'stepmsg' });
    const stepHost = A.h('div');
    host.append(stepHost, now);
    const tbl = A.h('div', { class: 'tracebox' });
    const result = A.h('div', { class: 'answer' });
    host.append(tbl, result);
    let tr, st;
    const H = n => hsets ? hsets[hi].h[n] || 0 : (cfg.nodes[n] && cfg.nodes[n].h) || 0;
    const lab = n => cfg.nodes[n] && cfg.nodes[n].label || n;
    const fmtP = p => {
      const e = p.nodes[p.nodes.length - 1], nm = cfg.nodesOnly ? lab(e) : p.nodes.map(lab).join(sep);
      if (mode === 'astar') return `${nm}(${p.g}+${H(e)}=${p.g + H(e)})`;
      if (mode === 'greedy' || mode === 'hill') return `${nm}(h=${H(e)})`;
      if (mode === 'ucs') return `${nm}(${p.g})`;
      return cfg.showCostAlways ? `${nm}(${p.g})` : nm;
    };
    function rebuild() {
      [...algoSel.children].forEach(b => b.classList.toggle('on', b.dataset.a === mode));
      const goals = goalSets[gi].goals;
      tr = trace(cfg, mode, goals, hsets ? hsets[hi].h : null);
      stepHost.innerHTML = '';
      st = A.stepper(stepHost, { count: () => tr.steps.length, render, labels: i => `Iteration ${i + 1} of ${tr.steps.length}` });
      tbl.innerHTML = A.table(['#', mode === 'hill' ? 'Current' : 'Removed', mode === 'hill' ? 'Children (h)' : 'Frontier after expanding (in priority order)'],
        tr.steps.map((s, k) => ({ cls: 'r' + k, cells: [k + 1, fmtP(s.pop) + (s.goal ? ' <b class="good">GOAL</b>' : s.skipped ? ' <span class="muted">discarded</span>' : ''), s.goal ? '<span class="muted">stop: goal removed</span>' : (s.note && mode === 'hill' ? s.frontier.map(fmtP).join(', ') + `<br><span class="muted">${s.note}</span>` : '[' + s.frontier.map(fmtP).join(', ') + ']')] })), 'trace');
      const r = tr.result;
      const vis = tr.order.map(lab).join(', ');
      result.innerHTML = r ? `<b>${NAMES[mode]}</b> returns <b>${r.nodes.map(lab).join(sep === '→' ? '-' : sep)}</b>, cost <b>${r.g}</b>${cfg.stepCosts !== false ? ` (steps ${stepCosts(r).join(' + ')})` : ''}. Nodes removed in order: ${vis}.`
        : `<b>${NAMES[mode]}</b> finds no goal. Order: ${vis}.`;
    }
    function stepCosts(p) { const out = []; for (let k = 1; k < p.nodes.length; k++) { const a = p.nodes[k - 1], b = p.nodes[k]; const e = (cfg.edges || []).find(x => (x[0] === a && x[1] === b) || (!cfg.directed && x[0] === b && x[1] === a)); out.push(e ? e[2] : (cfg.costOf ? cfg.costOf(a, b) : 1)); } return out; }
    function render(i) {
      const s = tr.steps[i];
      [...tbl.querySelectorAll('tbody tr')].forEach((r, k) => r.classList.toggle('on', k === i));
      const expanded = new Set(tr.steps.slice(0, i).filter(x => !x.skipped).map(x => x.pop.nodes[x.pop.nodes.length - 1]));
      const front = new Map(); s.frontier.forEach(p => { const e = p.nodes[p.nodes.length - 1]; if (!front.has(e)) front.set(e, p); });
      draw(s.pop.nodes, expanded, front, s.goal);
      now.innerHTML = s.goal ? `Removed <b>${A.esc(fmtP(s.pop))}</b>, a goal. Search stops.` : s.note ? A.esc(s.note) : `Removed <b>${A.esc(fmtP(s.pop))}</b> and added ${s.kids} ${s.kids === 1 ? 'child' : 'children'}.`;
    }
    function draw(path, expanded, front, isGoal) {
      const goals = new Set(goalSets[gi].goals);
      if (cfg.render === 'grid') return drawGrid(path, expanded, front, goals);
      const W = cfg.w || 600, Hh = cfg.h || 340, R = cfg.r || 19;
      let s = `<svg viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" class="gsvg">${A.arrowDefs('ah-' + (cfg.id || 'g'))}`;
      const onPath = new Set(); for (let k = 1; k < path.length; k++) onPath.add(path[k - 1] + '>' + path[k]);
      for (const [a, b, c] of cfg.edges) {
        const p = cfg.nodes[a], q = cfg.nodes[b]; if (!p || !q) continue;
        const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
        const x1 = p.x + ux * R, y1 = p.y + uy * R, x2 = q.x - ux * (R + 2), y2 = q.y - uy * (R + 2);
        const hot = onPath.has(a + '>' + b) || (!cfg.directed && onPath.has(b + '>' + a));
        s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ge ${hot ? 'hot' : ''}" ${cfg.directed ? `marker-end="url(#ah-${cfg.id || 'g'})"` : ''}/>`;
        if (cfg.costLabels !== false && c !== undefined) { const mx = (x1 + x2) / 2 - uy * 11, my = (y1 + y2) / 2 + ux * 11; s += `<text x="${mx}" y="${my + 4}" text-anchor="middle" class="gc">${c}</text>`; }
      }
      const last = path[path.length - 1];
      for (const n in cfg.nodes) {
        const p = cfg.nodes[n]; if (p.x === undefined) continue;
        const cls = [n === last ? 'cur' : '', expanded.has(n) ? 'exp' : '', front.has(n) ? 'fr' : '', goals.has(n) ? 'goal' : '', p.kind || ''].join(' ');
        if (p.kind === 'diamond') s += `<path d="M${p.x},${p.y - R} L${p.x + R},${p.y} L${p.x},${p.y + R} L${p.x - R},${p.y} Z" class="gn ${cls}"/>`;
        else if (p.kind === 'box') s += `<rect x="${p.x - R + 3}" y="${p.y - R + 5}" width="${2 * R - 6}" height="${2 * R - 10}" class="gn ${cls}"/>`;
        else s += `<circle cx="${p.x}" cy="${p.y}" r="${R}" class="gn ${cls}"/>`;
        s += `<text x="${p.x}" y="${p.y + 5}" text-anchor="middle" class="gl">${lab(n)}</text>`;
        if (cfg.showH !== false && (hsets || p.h !== undefined)) s += `<text x="${p.x + R + 3}" y="${p.y - R + 4}" class="gh">h=${H(n)}</text>`;
      }
      fig.innerHTML = s + '</svg>';
    }
    function drawGrid(path, expanded, front, goals) {
      const g = cfg.grid, C = g.cell || 58, W = g.cols * C + 2, Hh = g.rows * C + 2;
      let s = `<svg viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" class="gsvg grid">`;
      for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
        const info = g.cells[r][c], n = info.n;
        const cls = [info.cls || '', n && expanded.has(n) ? 'exp' : '', n && front.has(n) ? 'fr' : '', n && goals.has(n) ? 'goal' : '', n === path[path.length - 1] ? 'cur' : ''].join(' ');
        s += `<rect x="${1 + c * C}" y="${1 + r * C}" width="${C}" height="${C}" class="gcell ${cls}"/>`;
        if (info.t) s += `<text x="${1 + c * C + C / 2}" y="${1 + r * C + C / 2 + 2}" text-anchor="middle" class="gct">${info.t}</text>`;
        if (n && front.has(n) && mode !== 'bfs' && mode !== 'dfs') { const p = front.get(n); const e = n; const v = mode === 'astar' ? p.g + H(e) : mode === 'ucs' ? p.g : H(e); s += `<text x="${1 + c * C + C - 4}" y="${1 + r * C + 12}" text-anchor="end" class="gfv">${mode === 'astar' ? 'f' : mode === 'ucs' ? 'g' : 'h'}=${v}</text>`; }
        if (n && cfg.showH !== false && info.cls !== 'wall') s += `<text x="${1 + c * C + 4}" y="${1 + r * C + C - 5}" class="ghs">h${H(n)}</text>`;
      }
      const pts = path.map(n => { const [r, c] = g.pos[n]; return `${1 + c * C + C / 2},${1 + r * C + C / 2}`; }).join(' ');
      s += `<polyline points="${pts}" class="gpath"/>`;
      path.forEach(n => { const [r, c] = g.pos[n]; s += `<circle cx="${1 + c * C + C / 2}" cy="${1 + r * C + C / 2}" r="4" class="gdot"/>`; });
      fig.innerHTML = s + '</svg>';
    }
    rebuild();
  };
})(window.AIN);

/* ---- data/01-quizzes-csp.js ---- */
(function (A) {
  const P = A.problems;
  const G1 = 'Learn quizzes (Test 2)';
  // ---------- Five knights ----------
  P.push({
    id: 'quiz-knights', group: G1, code: 'Quiz Q1', title: 'Five knights: backtracking with forward checking', topic: 'CSP', marks: '24 marks', keywords: 'knights 3x3 forward checking steps',
    question: `<p>Place 5 knights on a 3×3 board (columns A–C, rows 1–3) so that no two attack each other. Model it as a CSP with variables <b>A, B, C</b> (one per column), each with initial domain <b>{1, 2, 3}</b>. A knight attacks a square two squares away in one direction and one square away in the other.</p><p>Run backtracking with forward checking from an empty board, columns A → C and rows 1 → 3 in increasing order. Give the board after each of the <b>8 steps</b> (K = knight, – = empty).</p>`,
    sim: { engine: 'knights', steps: [
      { k: ['A1'], label: 'Step 1', text: 'Place a knight on <b>A1</b> (first column, lowest row). Forward checking crosses out the squares A1 attacks: <b>B3</b> and <b>C2</b>.' },
      { k: ['A1', 'A2'], label: 'Step 2', text: 'Knights in the same column never attack each other, so <b>A2</b> is still free: place it. A2 attacks <b>C1</b> and <b>C3</b>, which are crossed out. Column C now has no free rows.' },
      { k: ['A1', 'A2', 'A3'], label: 'Step 3', text: '<b>A3</b> is free, so place it. A3 attacks <b>B1</b> and <b>C2</b>. Only B2 is left anywhere on the board.' },
      { k: ['A1', 'A2', 'A3', 'B2'], label: 'Step 4', text: 'Move to column B. B1 and B3 are crossed out, so place <b>B2</b> (the centre attacks nothing). No free square remains and only 4 knights are placed: <b>dead end, backtrack</b>. Undo B2 and A3. Keeping A1 and A2 together can never work, because A1 removes C2 and A2 removes C1 and C3, so column C is always empty and at most 4 knights fit. So A2 is dropped and column A tries its next row, A3.' },
      { k: ['A1', 'A3'], label: 'Step 5', text: 'State {A1, A3}. A1 removes B3, C2; A3 removes B1, C2. Domains: B {2}, C {1, 3}. At most 2 + 1 + 2 = 5 knights still fit, so carry on.' },
      { k: ['A1', 'A3', 'B2'], label: 'Step 6', text: 'Column B: the only free row is 2. Place <b>B2</b>.' },
      { k: ['A1', 'A3', 'B2', 'C1'], label: 'Step 7', text: 'Column C, lowest free row first: place <b>C1</b>. It attacks A2 and B3, both empty.' },
      { k: ['A1', 'A3', 'B2', 'C1', 'C3'], label: 'Step 8', text: 'Place <b>C3</b>. Five knights, none attacking: <b>solution</b> {A1, A3, B2, C1, C3} — the four corners plus the centre.' }] },
    solution: `<table><thead><tr><th>Step</th><th>Knights (K)</th><th>Everything else</th></tr></thead><tbody>
<tr><td>1</td><td>A1</td><td>–</td></tr><tr><td>2</td><td>A1, A2</td><td>–</td></tr><tr><td>3</td><td>A1, A2, A3</td><td>–</td></tr><tr><td>4</td><td>A1, A2, A3, B2</td><td>–</td></tr>
<tr><td>5</td><td>A1, A3</td><td>–</td></tr><tr><td>6</td><td>A1, A3, B2</td><td>–</td></tr><tr><td>7</td><td>A1, A3, B2, C1</td><td>–</td></tr><tr><td>8</td><td>A1, A3, B2, C1, C3</td><td>–</td></tr></tbody></table>
<p>Steps 1–4 agree with the ticks in your marked attempt (for example step 4 = A1, A2, A3, B2 with B1 and B3 empty). Steps 5–8 follow from backtracking out of that dead end, and they reach the solution in exactly 8 steps as the question says.</p>
<div class="note">The pictured board (A2, B1, B2, B3, C2) is the <i>other</i> solution. Searching in ascending order reaches the corners-plus-centre solution first, because it keeps A1.</div>`,
    notes: `<ul><li>On a 3×3 board the centre B2 attacks nothing, and the 8 outer squares form one cycle of knight moves: A1–B3–C1–A2–C3–B1–A3–C2–A1. You can take at most every second square of that cycle (4 knights) plus the centre: that is why there are exactly two 5-knight solutions.</li><li><b>Forward checking</b>: after each placement, cross out every free square the new knight attacks. A column whose free rows are all crossed out is a wiped-out domain.</li><li>Order matters: columns A → C, rows 1 → 3. Always try the lowest free row first, and when you backtrack, move to the next row of the most recent column that still has one.</li><li>Exam habit: draw the board for every step, mark crossed squares with ✕, and write the remaining domain of each column beside it.</li></ul>`
  });
  // ---------- alpha-beta trees ----------
  P.push({
    id: 'quiz-ab-an', group: G1, code: 'Quiz Q4', title: 'Alpha-beta: tree A–N with branches AA–YY', topic: 'Game trees', marks: '39 marks', keywords: 'alpha beta pruning PRUNED NOT VISITED',
    question: `<p>MAX root A with children B (branch AA) and C (BB). B → D (CC), E (DD); C → F (EE), G (FF). D → H (GG), I (HH); E → J (II), K (JJ); F → L (KK), M (LL); G → N (MM). Leaves: H: NN=3, OO=17 · I: PP=2, QQ=12 · J: RR=15 · K: SS=25, TT=0 · L: UU=2, VV=5 · M: WW=3 · N: XX=2, YY=14.</p><p>Apply minimax with alpha-beta pruning. Give the value of each node A–N (or NOT VISITED) and mark every branch AA–YY as PRUNED or NOT PRUNED.</p>`,
    sim: { engine: 'alphaBeta', root: 'A', levelLabels: ['MAX', 'MIN', 'MAX', 'MIN', ''], tree: { A: [['AA', 'B'], ['BB', 'C']], B: [['CC', 'D'], ['DD', 'E']], C: [['EE', 'F'], ['FF', 'G']], D: [['GG', 'H'], ['HH', 'I']], E: [['II', 'J'], ['JJ', 'K']], F: [['KK', 'L'], ['LL', 'M']], G: [['MM', 'N']], H: [['NN', 3], ['OO', 17]], I: [['PP', 2], ['QQ', 12]], J: [['RR', 15]], K: [['SS', 25], ['TT', 0]], L: [['UU', 2], ['VV', 5]], M: [['WW', 3]], N: [['XX', 2], ['YY', 14]] } },
    solution: `<p><b>Values:</b> A = 3, B = 3, C = 3, D = 3, E = 15, F = 3, G = NOT VISITED, H = 3, I = 2, J = 15, K = NOT VISITED, L = 2, M = 3, N = NOT VISITED.</p>
<p><b>Cuts:</b> QQ (I already ≤ α = 3 after leaf 2), JJ (E already ≥ β = 3 after J = 15), VV (L ≤ α = 3 after leaf 2), FF (C = 3 ≤ α = 3 after F).</p>
<p><b>Inside cut subtrees</b> (never traversed): SS, TT under K and MM, XX, YY under G. Mark these PRUNED too — every edge you never traverse gets an X.</p>
<p>All other branches (AA, BB, CC, DD, EE, GG, HH, II, KK, LL, NN, OO, PP, RR, UU, WW) are NOT PRUNED. Root value 3.</p>`,
    notes: `<ul><li>α (best for MAX on the path) only changes at MAX nodes; β (best for MIN) only at MIN nodes. Both start at −∞ and +∞ and are copied down to children.</li><li>After each child returns: test the cut first (MAX: v ≥ β, MIN: v ≤ α), then update α or β.</li><li>At M the single leaf 3 equals α = 3 — that is still a cut (≤), but nothing is left to prune.</li><li>Branches below a cut are never visited: their nodes are NOT VISITED and their edges count as pruned.</li></ul>`
  });
  P.push({
    id: 'quiz-ab-am', group: G1, code: 'Quiz Q3', title: 'Alpha-beta: three-way tree A–M', topic: 'Game trees', marks: '44 marks', keywords: 'alpha beta pruning',
    question: `<p>MAX root A → B (AA), C (BB), D (CC), all MIN. B → E (DD), F (EE), leaf 16 (FF). E → 4 (KK), 13 (LL). F → J (MM), 11 (NN); J → 5 (WW), 10 (XX). C → G (GG), 12 (HH). G → K (OO), 9 (PP), L (QQ); K → 1 (YY), 8 (ZZ); L → 6 (AAA), 12 (BBB). D → H (II), I (JJ). H → 10 (RR), 8 (SS), M (TT); M → 2 (CCC), 5 (DDD), 7 (EEE). I → 7 (UU), 4 (VV). Levels: MAX, MIN, MAX, MIN.</p><p>Apply minimax with alpha-beta pruning and give the value of nodes A–M.</p>`,
    sim: { engine: 'alphaBeta', root: 'A', levelLabels: ['MAX', 'MIN', 'MAX', 'MIN', ''], spacing: 50, tree: { A: [['AA', 'B'], ['BB', 'C'], ['CC', 'D']], B: [['DD', 'E'], ['EE', 'F'], ['FF', 16]], E: [['KK', 4], ['LL', 13]], F: [['MM', 'J'], ['NN', 11]], J: [['WW', 5], ['XX', 10]], C: [['GG', 'G'], ['HH', 12]], G: [['OO', 'K'], ['PP', 9], ['QQ', 'L']], K: [['YY', 1], ['ZZ', 8]], L: [['AAA', 6], ['BBB', 12]], D: [['II', 'H'], ['JJ', 'I']], H: [['RR', 10], ['SS', 8], ['TT', 'M']], M: [['CCC', 2], ['DDD', 5], ['EEE', 7]], I: [['UU', 7], ['VV', 4]] } },
    solution: `<p><b>Values:</b> A = 11, B = 11, C = 9, D = 10, E = 13, F = 11, G = 9, H = 10, I = NOT VISITED, J = 5, K = 1, L = 6, M = 2.</p>
<p><b>Cuts:</b> ZZ (K: 1 ≤ α = 11), BBB (L: 6 ≤ 11), HH (C: 9 ≤ 11), DDD and EEE (M: 2 ≤ 11), JJ (D: 10 ≤ 11, so I is never visited; its leaves UU, VV go with it).</p>
<p>MAX moves A → B (branch AA) for a guaranteed 11.</p>`,
    notes: `<ul><li>Here α = 11 is fixed at the root after the first subtree, and it travels down into every MIN node of C and D. Each time a MIN node's value drops to 11 or below, the rest of that MIN node is skipped.</li><li>H gets value 10 even though it is a MAX node: its children were 10, 8 and M = 2. It cannot beat α = 11, but MAX nodes only prune on v ≥ β, and β = +∞ there.</li><li>A leaf hanging straight off a MIN node (16 under B, 12 under C) is just another child.</li></ul>`
  });
  const ao = { A: [['', 'B'], ['', 'C']], B: [['', 'D'], ['', 'E']], C: [['', 'F'], ['', 'G']], D: [['', 'H'], ['', 'I']], E: [['', 'J'], ['', 'K']], F: [['', 'L'], ['', 'M']], G: [['', 'N'], ['', 'O']] };
  [4, 48, 15, 25, 35, 23, 19, -5, -25, 11, -46, 7, 45, -9, 48, 10].forEach((v, i) => { const n = 'HIJKLMNO'[i >> 1]; (ao[n] = ao[n] || []).push(['', v]); });
  P.push({
    id: 'quiz-ab-ao', group: G1, code: 'Quiz', title: 'Alpha-beta: binary tree A–O', topic: 'Game trees', keywords: 'alpha beta binary tree negative leaves',
    question: `<p>Binary tree: MAX A; MIN B, C; MAX D, E, F, G; MIN H–O. Leaves left to right: 4, 48 | 15, 25 | 35, 23 | 19, −5 | −25, 11 | −46, 7 | 45, −9 | 48, 10 (two under each of H, I, J, K, L, M, N, O).</p><p>Give the value of each visited node A–O and NOT VISITED for the rest.</p>`,
    sim: { engine: 'alphaBeta', root: 'A', levelLabels: ['MAX', 'MIN', 'MAX', 'MIN', ''], tree: ao },
    solution: `<p>A = <b>15</b>, B = 15, C = −25, D = 15, E = 23, F = −25, G = NOT VISITED, H = 4, I = 15, J = 23, K = NOT VISITED, L = −25, M = −46, N = NOT VISITED, O = NOT VISITED.</p><p>Cuts: E–K (E = 23 ≥ β = 15), L's second leaf 11 (−25 ≤ α = 15), M's second leaf 7 (−46 ≤ 15), C–G (C = −25 ≤ 15).</p>`,
    notes: `<ul><li>Negative leaves change nothing about the rules: compare with α and β exactly as with positive numbers.</li><li>Once the root has α = 15, the whole right half only has to show that C can be held to 15 or less — the first leaf (−25) of L already does that for F, and F's value −25 ends C immediately.</li></ul>`
  });

  // ---------- Chapter 6 CSP ----------
  const G2 = 'Chapter 6: CSPs (lecture slides)';
  P.push({
    id: 'ch6-basics', group: G2, code: 'Ch 6 · 1', title: 'Variables, domains, possible worlds and models', topic: 'CSP', keywords: 'possible worlds count crossword sudoku n-queens map colouring scope constraints',
    question: `<p>Lecture checks: count possible worlds for the Mars explorer, crossword, Sudoku, N-queens and map colouring; say which assignments satisfy which constraint sets; find the models of a small CSP; give the complexity of generate-and-test.</p>`,
    sims: [{ engine: 'worldCount', title: 'Counting possible worlds', examples: [
      { name: 'Mars explorer', vars: 'Weather, Temperature, Longitude, Latitude', dom: '2, 81, 360, 180 values', count: '2 × 81 × 360 × 180 = 10,497,600' },
      { name: 'Crossword, representation 1', vars: '63 words', dom: '≈ 15,000 words', count: '15,000<sup>63</sup>' },
      { name: 'Crossword, representation 2', vars: '193 cells (15×15 − 32)', dom: '26 letters', count: '26<sup>193</sup>' },
      { name: 'Sudoku', vars: '51 empty cells', dom: '1–9', count: '9<sup>51</sup>' },
      { name: '4-queens (anywhere)', vars: '4 queen locations', dom: '16 squares', count: 'C(16,4) = 1,820' },
      { name: 'Australia map colouring', vars: 'WA, NT, Q, SA, NSW, V, T', dom: '3 colours', count: '3<sup>7</sup> = 2,187' },
      { name: '30 binary features', vars: '30', dom: '2', count: '2<sup>30</sup> = 1,073,741,824' }] },
    { engine: 'quiz', title: 'Lecture clicker questions', items: [
      { q: 'How many possible worlds does map colouring have?', options: ['2<sup>regions</sup>', '2<sup>colours</sup>', 'colours × regions', 'regions<sup>colours</sup>', 'colours<sup>regions</sup>'], answer: 4, why: 'Each region independently takes one of the colours: |dom|<sup>number of variables</sup>.' },
      { q: 'Variables A, B, C, domains 1–10. W = {A=1, B=2, C=10}. Set 1 = {A = B, C > B}; set 2 = {A ≠ B, C > B, (A, C) ∈ {(10,1), (1,10)}}. Which is true?', options: ['W satisfies both', 'W satisfies set 1 only', 'W satisfies set 2 only', 'W satisfies neither'], answer: 2, why: 'A = 1 ≠ B = 2 breaks A = B, so set 1 fails; all three constraints of set 2 hold.' },
      { q: 'V = {V1, V2}, dom(V1) = {1,2,3}, dom(V2) = {1,2}; C1: V2 ≠ 2, C2: V1 + V2 < 5, C3: V1 > V2. Which assignments are models?', options: ['{V1=2, V2=1} only', '{V1=2, V2=1} and {V1=3, V2=1}', '{V1=1, V2=1} and {V1=3, V2=1}', 'All three'], answer: 1, why: '{V1=1, V2=1} fails V1 > V2. The other two satisfy all three constraints.' },
      { q: 'k variables, domain size d, c constraints: complexity of generate-and-test?', options: ['O(ckd)', 'O(ck<sup>d</sup>)', 'O(cd<sup>k</sup>)', 'O(d<sup>ck</sup>)'], answer: 2, why: 'There are d<sup>k</sup> possible worlds and each needs c constraint checks.' },
      { q: 'Every CSP solution is at depth n. Is there a role for a heuristic function (distance estimate)?', options: ['Yes', 'No', 'It depends'], answer: 1, why: 'All goals are equally far away, so a distance-to-goal estimate adds nothing. (Variable/value ordering “heuristics” are a different idea.)' },
      { q: 'The CSP search space is always…', options: ['finite with cycles', 'infinite without cycles', 'finite without cycles', 'infinite with cycles'], answer: 2, why: 'Each step assigns one more variable, so depth ≤ n and no state repeats.' },
      { q: 'Which search strategy suits CSPs best?', options: ['BFS', 'A*', 'IDS', 'DFS'], answer: 3, why: 'Solutions are all at depth n, so DFS reaches them directly with linear memory.' }] }],
    solution: `<ul><li><b>CSP</b> = variables + a domain for each + constraints. A <b>possible world</b> assigns every variable; a <b>model</b> is a possible world that satisfies every constraint.</li><li>Number of possible worlds = product of the domain sizes = d<sup>k</sup> when all domains have size d. N-queens uses C(N², N) = (N²)! / ((N² − N)! N!), not (N²)<sup>N</sup>, because queens are identical and cannot share a square.</li><li>Constraint <b>scope</b> = the variables it mentions: V2 ≠ 2 has scope {V2}; V1 > V2 has {V1, V2}; V1 + V2 + V4 &lt; 5 has {V1, V2, V4}. A k-ary constraint has k variables in its scope.</li><li>Constraints can be <b>explicit</b> (list allowed tuples: (A, B) ∈ {(1,1), (1,2), (2,2)}) or <b>implicit</b> (a function: A ≤ B).</li><li>Generate-and-test is O(c·d<sup>k</sup>): it always works but is hopeless for large k.</li><li>Deciding whether a model exists is NP-hard, so the game plan is consistency algorithms, special cases, approximation and algorithms that are fast on typical cases.</li></ul>`,
    notes: `<ul><li>Planning (Ch 3) cares about the path; identification (CSP) only cares about the goal.</li><li>Feature-based states: 30 binary features describe 2<sup>30</sup> ≈ 10<sup>9</sup> states without listing them.</li><li>Crossword representation 1: variables are words, constraints say crossing words share a letter. Representation 2: variables are cells, constraints say each run of cells spells a word.</li><li>CSP solvers can reject a partial assignment early; state-space searchers can only test complete states.</li></ul>`
  });
  P.push({
    id: 'ch6-toy', group: G2, code: 'Ch 6 · 2', title: 'Backtracking on the toy problem A < B < C', topic: 'CSP', keywords: 'formulation 2 backtracking B first',
    question: `<p>Variables A, B, C, each with domain {1, 2, 3, 4}; constraints A &lt; B and B &lt; C. Using formulation 2, assign B first, then A, then C, and find every model with backtracking.</p>`,
    sim: { engine: 'csp', all: true, allowFcToggle: true, vars: ['B', 'A', 'C'], domains: { A: [1, 2, 3, 4], B: [1, 2, 3, 4], C: [1, 2, 3, 4] }, constraints: [['A', 'B', (a, b) => a < b], ['B', 'C', (b, c) => b < c]] },
    solution: `<ul><li>B = 1: no A &lt; 1 → all four A values fail.</li><li>B = 2: A = 1 only; then C = 3 ✓ and C = 4 ✓.</li><li>B = 3: A = 1 ✓, A = 2 ✓; each needs C = 4.</li><li>B = 4: no C &gt; 4 → fail.</li></ul><p><b>4 models (A, B, C):</b> (1,2,3), (1,2,4), (1,3,4), (2,3,4).</p><p>Assigning B first lets both constraints be checked as soon as A or C is set, so failures appear one level earlier than with the order A, B, C.</p>`,
    notes: `<ul><li><b>Backtracking</b> = DFS that checks each constraint as soon as all its variables are assigned, and prunes the whole subtree when one fails.</li><li>Formulation 1 fixes a variable order V1…Vn in advance. Formulation 2 may assign any unassigned variable next.</li><li>Efficiency depends heavily on the variable order: choose the variable in the most constraints, or with the fewest remaining values (“fail early”).</li><li>Tick “Forward checking” in the simulation to see the domains shrink before each choice.</li></ul>`
  });
  const qDraw = n => (asg, doms) => { const Z = 46; let s = `<svg viewBox="0 0 ${n * Z + 34} ${n * Z + 30}" width="${n * Z + 34}" height="${n * Z + 30}" class="qsvg">`; for (let c = 0; c < n; c++) s += `<text x="${30 + c * Z + Z / 2}" y="16" text-anchor="middle" class="tick">X${c + 1}</text>`; for (let r = 0; r < n; r++) { s += `<text x="12" y="${26 + r * Z + Z / 2 + 4}" class="tick">${r + 1}</text>`; for (let c = 0; c < n; c++) { const v = 'X' + (c + 1); const has = asg[v] === r + 1, out = !(v in asg) && !(doms[v] || []).includes(r + 1); s += `<rect x="${30 + c * Z}" y="${24 + r * Z}" width="${Z}" height="${Z}" class="${(r + c) % 2 ? 'dk' : 'lt'}"/>`; if (has) s += `<text x="${30 + c * Z + Z / 2}" y="${24 + r * Z + Z / 2 + 10}" text-anchor="middle" class="qq">♛</text>`; else if (out) s += `<circle cx="${30 + c * Z + Z / 2}" cy="${24 + r * Z + Z / 2}" r="9" fill="#7b2a8c"/>`; } } return s + '</svg>'; };
  const qcons = []; for (let i = 1; i <= 4; i++) for (let j = i + 1; j <= 4; j++) qcons.push(['X' + i, 'X' + j, (a, b) => a !== b && Math.abs(a - b) !== j - i]);
  P.push({
    id: 'ch6-4queens', group: G2, code: 'Ch 6 · 3', title: '4-queens with backtracking + forward checking', topic: 'CSP', keywords: 'forward checking filtering 4 queens X1 X2 X3 X4',
    question: `<p>Variables X1–X4: Xi is the row of the queen in column i, domain {1, 2, 3, 4}. Constraints: no two queens share a row or a diagonal. Solve with backtracking + forward checking, showing the domains after each assignment.</p>`,
    sim: { engine: 'csp', forwardChecking: true, vars: ['X1', 'X2', 'X3', 'X4'], domains: { X1: [1, 2, 3, 4], X2: [1, 2, 3, 4], X3: [1, 2, 3, 4], X4: [1, 2, 3, 4] }, constraints: qcons, draw: qDraw(4) },
    solution: `<ol><li>X1 = 1 → forward check: X2 {3,4}, X3 {2,4}, X4 {2,3}.</li><li>X2 = 3 → X3 {} (wiped out) → backtrack.</li><li>X2 = 4 → X3 {2}, X4 {3}.</li><li>X3 = 2 → X4 {} → backtrack. X1 = 1 has failed.</li><li>X1 = 2 → X2 {4}, X3 {1,3}, X4 {1,3,4}.</li><li>X2 = 4 → X3 {1}, X4 {1,3}.</li><li>X3 = 1 → X4 {3}.</li><li>X4 = 3 → <b>solution (2, 4, 1, 3)</b>.</li></ol>`,
    notes: `<ul><li><b>Filtering</b>: keep the domains of unassigned variables up to date and cross off values that can no longer work.</li><li><b>Forward checking</b>: after an assignment, remove from each unassigned neighbour every value that conflicts with it. If any domain becomes empty, backtrack at once — no need to try that branch.</li><li>Forward checking only looks one step ahead (assigned vs unassigned). It does not compare two unassigned variables with each other.</li></ul>`
  });
  const aus = ['WA', 'NT', 'Q', 'SA', 'NSW', 'V', 'T'];
  const adjA = [['WA', 'NT'], ['WA', 'SA'], ['NT', 'SA'], ['NT', 'Q'], ['SA', 'Q'], ['SA', 'NSW'], ['SA', 'V'], ['Q', 'NSW'], ['NSW', 'V']];
  const posA = { WA: [60, 120], NT: [170, 50], Q: [290, 70], SA: [180, 150], NSW: [310, 170], V: [250, 240], T: [260, 310] };
  const colHex = { red: '#e0332f', green: '#2ea44f', blue: '#2f6fd6' };
  P.push({
    id: 'ch6-map', group: G2, code: 'Ch 6 · 4', title: 'Map colouring and its constraint network', topic: 'CSP', keywords: 'australia constraint network WA NT SA',
    question: `<p>Colour the seven regions of Australia (WA, NT, Q, SA, NSW, V, T) with {red, green, blue} so neighbours differ. Draw the constraint network and solve it by backtracking with forward checking.</p>`,
    sim: { engine: 'csp', forwardChecking: true, vars: aus, domains: Object.fromEntries(aus.map(v => [v, ['red', 'green', 'blue']])), constraints: adjA.map(([a, b]) => [a, b, (x, y) => x !== y]),
      draw: asg => { let s = `<svg viewBox="0 0 370 350" width="370" height="350" class="gsvg">`; adjA.forEach(([a, b]) => s += `<line x1="${posA[a][0]}" y1="${posA[a][1]}" x2="${posA[b][0]}" y2="${posA[b][1]}" class="ge"/>`); aus.forEach(v => s += `<circle cx="${posA[v][0]}" cy="${posA[v][1]}" r="26" fill="${asg[v] ? colHex[asg[v]] : 'var(--card)'}" stroke="var(--ink)" stroke-width="2"/><text x="${posA[v][0]}" y="${posA[v][1] + 5}" text-anchor="middle" class="gl" style="fill:${asg[v] ? '#fff' : 'var(--ink)'};stroke:none">${v}</text>`); return s + '</svg>'; } },
    solution: `<p>Constraint network: nodes are regions, edges join neighbours: WA–NT, WA–SA, NT–SA, NT–Q, SA–Q, SA–NSW, SA–V, Q–NSW, NSW–V. T has no edges.</p><p>With order WA, NT, Q, SA, NSW, V, T and colours tried red → green → blue, the first model is <b>WA = red, NT = green, Q = red, SA = blue, NSW = green, V = red, T = red</b> — found with no backtracking because forward checking keeps every domain non-empty.</p><p>A CSP as graph search: state = partial assignment; successor = assign one more variable; goal = all assigned and all constraints hold; no heuristic needed (all solutions at depth n).</p>`,
    notes: `<ul><li>SA touches five regions, so it is the most constrained variable — a good one to colour first (“fail early”).</li><li>Explicit form of one constraint: (WA, NT) ∈ {(r,g), (r,b), (g,r), (g,b), (b,r), (b,g)}; implicit form: WA ≠ NT.</li><li>T is isolated in the network: any colour works, independent of the rest.</li></ul>`
  });
})(window.AIN);

/* ---- data/02-exam-2025-2024.js ---- */
(function (A) {
  const P = A.problems;
  const G = 'Nov 2025 exam';
  P.push({
    id: 'e25-q1', group: G, code: '2025 Q1', title: 'A* on the S–F graph (and which goal is found first)', topic: 'Search', marks: '15 marks', keywords: 'A* frontier admissible UCS BFS D goal',
    question: `<p>Directed graph with start S: S→A (5), S→B (3), S→C (2), A→D (6), B→D (7), B→E (4), C→B (3), C→F (8). Goal E. Heuristic h: S 5, A 3, B 2, C 3, D 3, E 0, F 2.</p><p>1.1 Run A*: give the frontier at each iteration (order matters) and the first path to the goal with its cost. 1.2 Is A* guaranteed to find the shortest path here? 1.3 If D is also a goal, which goal do A*, uniform-cost search and breadth-first search find first?</p>`,
    sim: { engine: 'graphSearch', directed: true, start: 'S', algos: ['astar', 'ucs', 'bfs', 'dfs', 'greedy'], goalSets: [{ label: 'Goal: E', goals: ['E'] }, { label: 'Goals: E and D (1.3)', goals: ['E', 'D'] }], w: 560, h: 330,
      nodes: { S: { x: 280, y: 40, h: 5 }, A: { x: 90, y: 150, h: 3 }, B: { x: 280, y: 150, h: 2 }, C: { x: 470, y: 150, h: 3 }, D: { x: 180, y: 285, h: 3 }, E: { x: 340, y: 285, h: 0 }, F: { x: 470, y: 285, h: 2 } },
      edges: [['S', 'A', 5], ['S', 'B', 3], ['S', 'C', 2], ['A', 'D', 6], ['B', 'D', 7], ['B', 'E', 4], ['C', 'B', 3], ['C', 'F', 8]] },
    solution: `<p><b>1.1</b> (ties broken alphabetically on the end node; goal tested when removed)</p><pre>1) S(0+5=5)        [S→B(3+2=5), S→C(2+3=5), S→A(5+3=8)]
2) S→B(5)          [S→C(5), S→B→E(7+0=7), S→A(8), S→B→D(10+3=13)]
3) S→C(5)          [S→C→B(5+2=7), S→B→E(7), S→A(8), S→C→F(10+2=12), S→B→D(13)]
4) S→C→B(7)        [S→B→E(7), S→A(8), S→C→B→E(9+0=9), S→C→F(12), S→B→D(13), S→C→B→D(12+3=15)]
5) S→B→E(7)  goal  </pre><p>First path: <b>S → B → E, cost 7</b> (steps 3 + 4). At iteration 4 the tie at f = 7 goes to S→C→B because B comes before E; if you break ties on the whole path string, S→B→E is removed one step earlier — same answer.</p>
<p><b>1.2</b> Yes. h never overestimates: h(S) = 5 ≤ 7, h(B) = 2 ≤ 4, h(C) = 3 ≤ 7 (C→B→E), h(E) = 0; A, D and F cannot reach E at all, so any finite h is below their true cost (∞). All arc costs are positive and the graph is finite, so A* with an admissible h returns an optimal path.</p>
<p><b>1.3</b> A*: <b>E</b> via S→B→E (f = 7) — S→B→D has f = 13 and S→A→D f = 17, so E is removed first. (h(D) = 3 now overestimates, since D is a goal with true cost 0, but it does not change the result.) Uniform cost: <b>E</b> (cost 7 beats D's best cost 10). Breadth-first: <b>D</b> via S→A→D — depth-2 paths are queued A's children first, so S→A→D is removed before S→B→E.</p>`,
    notes: `<ul><li>Course trace format: write the path removed, then the whole frontier after expanding it, in priority order, with g+h in brackets.</li><li>Goal test on <b>removal</b>, not on generation: S→B→E is on the frontier at iteration 2 but the search continues until it is removed.</li><li>Admissibility check = compare h(n) with the cheapest real cost from n to a goal, node by node. Dead-end nodes have true cost ∞.</li><li>BFS ignores costs completely; it finds the shallowest goal, with ties in the order the children were queued.</li></ul>`
  });
  P.push({
    id: 'e25-q2', group: G, code: '2025 Q2', title: 'Warehouse robot: state space and admissible heuristic', topic: 'State-space formulation', marks: '15 marks', keywords: 'sokoban crates push robot heuristic manhattan admissible',
    question: `<p>A robot on a 6×6 grid moves Up/Down/Left/Right into empty cells (cost 1). It can push one crate at a time if the cell behind the crate is empty (cost 2, including its own move). It cannot walk into crates. Each numbered crate has its own target square. Find the minimum-cost plan.</p><p>Layout (row, col from top-left, 0-based): robot (0,1); crate 3 at (1,1), crate 1 at (1,4), crate 2 at (4,1); target 1 at (2,1), target 2 at (1,3), target 3 at (3,3).</p><p>2.1.1 Describe a state representation. 2.1.2 Give the start state and the goal condition. 2.2.1 Propose an admissible heuristic. 2.2.2 Explain why it is admissible.</p>`,
    sim: { engine: 'warehouse', rows: 6, cols: 6, robot: [0, 1], crates: { 1: [1, 4], 2: [4, 1], 3: [1, 1] }, targets: { 1: [2, 1], 2: [1, 3], 3: [3, 3] } },
    solution: `<p><b>2.1.1 State</b> = (robot position, position of crate 1, crate 2, crate 3) = ((r<sub>R</sub>, c<sub>R</sub>), (r<sub>1</sub>, c<sub>1</sub>), (r<sub>2</sub>, c<sub>2</sub>), (r<sub>3</sub>, c<sub>3</sub>)). Crates are kept in a fixed order because each has its own target. The grid size and target squares never change, so they are not part of the state. Use a tuple so states can be stored in sets.</p>
<p><b>2.1.2 Start</b> = ((0,1), (1,4), (4,1), (1,1)). <b>Goal</b>: crate 1 at (2,1), crate 2 at (1,3) and crate 3 at (3,3); the robot may be anywhere: <code>is_goal(s) = s[1:] == ((2,1), (1,3), (3,3))</code>.</p>
<p><b>2.2.1 Heuristic</b> h(s) = 2 × Σ<sub>i</sub> Manhattan(crate i, target i). At the start: crate 1 needs 1 + 3 = 4, crate 2 needs 3 + 2 = 5, crate 3 needs 2 + 2 = 4, so h = 2 × 13 = <b>26</b>.</p>
<p><b>2.2.2 Why admissible</b>: it solves a relaxed problem in which crates can be pushed in any direction without the robot walking round them and without crates blocking each other. In the real problem a crate only moves when it is pushed; each push moves exactly one crate by one square and costs 2, so it lowers h by at most 2 — exactly its cost. Plain moves cost 1 and do not change h. So h can never exceed the true remaining cost (it is also consistent). Check: h(start) = 26 ≤ optimal 38.</p>
<p><b>Plan found by search</b>: cost <b>38</b> = 13 pushes × 2 + 12 moves × 1 (see the simulation for every move). The start state has 3 successors: push crate 3 down, move left, move right.</p>`,
    notes: `<ul><li>A state must hold everything that affects future moves and nothing else — no move counter, no fixed map data.</li><li>“Why admissible” answers earn marks only when they name the relaxation and show each real action lowers h by at most its cost.</li><li>Upper bound on the state space: 36 × 35 × 34 × 33 = 1,413,720 placements of the robot and three distinct crates.</li></ul>`
  });
  P.push({
    id: 'e25-q3', group: G, code: '2025 Q3', title: 'GA: assigning advert slots', topic: 'Genetic algorithms', marks: '15 marks', keywords: 'advert slots ratings price per rating fitness generate_chr crossover mutate repair penalty',
    question: `<p>Nine TV slots with ratings [55, 50, 47, 45, 40, 36, 32, 28, 24]. Advertisers A1, A2, A3 pay 6×, 4× and 3× the rating and must each get exactly three slots. Chromosome: a list of length 9; chr[i] = advertiser in slot t<sub>i+1</sub>. Example [2,1,2,3,2,3,1,1,3]: A1 has t2, t7, t8 → 6 × (50 + 32 + 28) = R660.</p><p>Write fitness(chr), generate_chr(), crossover(p1, p2) (returns two children) and mutate(chr). Infeasible schedules must be penalised or repaired.</p>`,
    sim: { engine: 'ga', kind: 'adverts', pop: 30, gens: 60, pc: 0.9, pm: 0.3, example: [2, 1, 2, 3, 2, 3, 1, 1, 3] },
    solution: `<pre>import random
ratings = [55, 50, 47, 45, 40, 36, 32, 28, 24]
price_per_rating = [6, 4, 3]
REQUIRED, PENALTY = 3, 1000

def fitness(chr):                                   # 3.1
    revenue = sum(price_per_rating[a - 1] * ratings[i] for i, a in enumerate(chr))
    violations = sum(abs(chr.count(a) - REQUIRED) for a in (1, 2, 3))
    return revenue - PENALTY * violations

def generate_chr():                                 # 3.2
    chr = [1, 2, 3] * REQUIRED      # exactly three slots each, so always feasible
    random.shuffle(chr)             # shuffles in place (returns None)
    return chr

def repair(chr):
    for i in range(len(chr)):
        if chr.count(chr[i]) > REQUIRED:            # over-booked advertiser
            chr[i] = next(b for b in (1, 2, 3) if chr.count(b) < REQUIRED)
    return chr

def crossover(p1, p2):                              # 3.3
    cut = random.randint(1, 8)
    return [repair(p1[:cut] + p2[cut:]), repair(p2[:cut] + p1[cut:])]

def mutate(chr):                                    # 3.4
    i, j = random.sample(range(9), 2)
    chr[i], chr[j] = chr[j], chr[i]   # a swap keeps every count at 3
    return chr</pre>
<p>Example fitness: A1 = 6 × (50 + 32 + 28) = R660, A2 (t1, t3, t5) = 4 × (55 + 47 + 40) = R568, A3 (t4, t6, t9) = 3 × (45 + 36 + 24) = R315 → <b>R1543</b>. The optimum gives A1 the three best slots: 6 × 152 + 4 × 121 + 3 × 84 = <b>R1648</b>, i.e. [1,1,1,2,2,2,3,3,3].</p>`,
    notes: `<ul><li>Two ways to handle the “exactly 3 each” rule: <b>penalty</b> (fitness drops by a large constant per violation) or <b>repair</b> (fix the child after crossover). Generating with a shuffled [1,2,3]*3 and mutating by swaps keeps feasibility for free.</li><li>Plain single-point crossover breaks the counts — that is why crossover is followed by repair.</li><li>Classic bugs: <code>random.shuffle</code> returns None; crossover must return a list of two children.</li></ul>`
  });
  P.push({
    id: 'e25-q5', group: G, code: '2025 Q5', title: 'TP/FP/TN/FN and learning paradigms', topic: 'Machine learning', marks: '10 marks', keywords: 'confusion matrix supervised unsupervised reinforcement fraud',
    question: `<p>5.1 A fraud model outputs 1 (fraud = positive) or −1 (legitimate = negative). Classify four outcomes as TP, FP, TN or FN. 5.2 Match six problems to S (supervised), U (unsupervised) or R (reinforcement).</p>`,
    sim: { engine: 'quiz', items: [
      { n: '5.1.1', q: 'Predicts fraudulent, and it was fraud.', options: ['TP', 'FP', 'TN', 'FN'], answer: 0, why: 'Predicted positive, actually positive.' },
      { n: '5.1.2', q: 'Predicts fraudulent, but it was legitimate.', options: ['TP', 'FP', 'TN', 'FN'], answer: 1, why: 'A false alarm: predicted positive, actually negative.' },
      { n: '5.1.3', q: 'Predicts legitimate, and it was legitimate.', options: ['TP', 'FP', 'TN', 'FN'], answer: 2, why: 'Predicted negative, actually negative.' },
      { n: '5.1.4', q: 'Predicts legitimate, but it was fraud.', options: ['TP', 'FP', 'TN', 'FN'], answer: 3, why: 'A missed case: predicted negative, actually positive.' },
      { n: '5.2.1', q: 'Detecting unusual network activity by finding patterns that differ from typical traffic.', options: ['S', 'U', 'R'], answer: 1, why: 'Anomaly detection from unlabelled data.' },
      { n: '5.2.2', q: 'Predicting house prices from 50,000 past sales with known prices.', options: ['S', 'U', 'R'], answer: 0, why: 'Labelled examples (regression).' },
      { n: '5.2.3', q: 'Pneumonia from X-rays, trained on 100,000 images diagnosed by radiologists.', options: ['S', 'U', 'R'], answer: 0, why: 'Labelled examples (classification).' },
      { n: '5.2.4', q: 'A streaming service learns what to recommend from users’ like/dislike ratings.', options: ['S', 'U', 'R'], answer: 2, why: 'It acts (recommends) and receives a reward or penalty afterwards.' },
      { n: '5.2.5', q: 'Finding natural shopping patterns in purchase histories with no predefined categories.', options: ['S', 'U', 'R'], answer: 1, why: 'Clustering without labels.' },
      { n: '5.2.6', q: 'A drone adjusts its controls depending on whether it passes gates or crashes.', options: ['S', 'U', 'R'], answer: 2, why: 'Trial and error with reward/penalty.' }] },
    solution: `<p><b>5.1</b>: 5.1.1 TP · 5.1.2 FP · 5.1.3 TN · 5.1.4 FN.</p><p><b>5.2</b>: 5.2.1 U · 5.2.2 S · 5.2.3 S · 5.2.4 R · 5.2.5 U · 5.2.6 R.</p>`,
    notes: `<ul><li>Read the first word for the prediction (Positive/Negative) and the second (True/False) for whether it was right.</li><li>Supervised = given correct outputs. Unsupervised = inputs only (clusters, anomalies). Reinforcement = reward or penalty after acting.</li></ul>`
  });
  P.push({
    id: 'e25-q6', group: G, code: '2025 Q6', title: 'Perceptron: spam classifier, two epochs', topic: 'Neural networks', marks: '10 marks', keywords: 'perceptron training table epoch bipolar',
    question: `<p>Features x1 promotional words, x2 unknown sender, x3 suspicious links, x4 spelling errors (1 = true, −1 = false). Training data: [1,1,1,1]→1, [1,1,1,−1]→1, [−1,−1,−1,−1]→−1, [−1,−1,1,−1]→−1, [1,−1,−1,1]→−1. α = 1, θ = 0, weights and bias start at 0; y = 1 if y<sub>in</sub> &gt; θ, 0 if = θ, −1 if &lt; θ.</p><p>6.1 Complete the table for two epochs. 6.2 Give y<sub>in</sub> and the output for input −1 1 −1 −1.</p>`,
    sim: { engine: 'perceptron', X: [[1, 1, 1, 1], [1, 1, 1, -1], [-1, -1, -1, -1], [-1, -1, 1, -1], [1, -1, -1, 1]], T: [1, 1, -1, -1, -1], epochs: 2, alpha: 1, theta: 0, test: [-1, 1, -1, -1], testLabel: y => y === 1 ? 'spam' : y === -1 ? 'not spam' : 'undecided' },
    solution: `<p><b>Epoch 1</b>: row 1 y<sub>in</sub> = 0 → y = 0 ≠ 1 → w = (1,1,1,1), b = 1. Rows 2–4 correct (y<sub>in</sub> = 3, −3, −1). Row 5: y<sub>in</sub> = 1 + 1 − 1 − 1 + 1 = 1 → y = 1 ≠ −1 → w = (0,2,2,0), b = 0.</p>
<p><b>Epoch 2</b>: rows 1–3 correct (y<sub>in</sub> = 4, 4, −4). Row 4 [−1,−1,1,−1]: y<sub>in</sub> = 0 − 2 + 2 + 0 = 0 → y = 0 ≠ −1 → w = (1,3,1,1), b = −1. Row 5: y<sub>in</sub> = −1 + 1 − 3 − 1 + 1 = −3 → correct.</p>
<p><b>After two epochs</b>: w = (1, 3, 1, 1), b = −1. <b>6.2</b>: y<sub>in</sub> = −1 + (−1)(1) + (1)(3) + (−1)(1) + (−1)(1) = <b>−1</b> → output <b>−1 (not spam)</b>.</p>`,
    notes: `<ul><li>y<sub>in</sub> = b + Σ x<sub>i</sub>w<sub>i</sub>. If y ≠ t: Δw<sub>i</sub> = α·t·x<sub>i</sub> and Δb = α·t. If y = t: no change.</li><li>Trap: y = 0 when y<sub>in</sub> = θ, and 0 is never equal to t = ±1, so the weights still update. That is why row 1 always updates when weights start at 0, and why row 4 updates in epoch 2.</li><li>Training stops after a whole epoch with no change. Here epoch 3 would change nothing.</li></ul>`
  });
  P.push({
    id: 'e25-q8', group: G, code: '2025 Q8', title: 'Resolution: “Liz is funny”', topic: 'Logic & resolution', marks: '15 marks', keywords: 'losers club smart funny likes clowns games resolution',
    question: `<p>1. Loser(Tony) ∧ Loser(Tom) ∧ Loser(Liz) · 2. ∀x Loser(x) → Smart(x) ∨ Funny(x) · 3. ∀x Loser(x) ∧ Smart(x) → Likes(x, Clowns) · 4. ∀x Loser(x) ∧ Funny(x) → Likes(x, Games) · 5. ∀y (Likes(Liz, y) → ¬Likes(Tony, y)) ∧ (¬Likes(Tony, y) → Likes(Liz, y)) · 6. Likes(Tony, Clowns).</p><p>8.1 Translate statement 5. 8.2 Convert every statement to clause form. 8.3 Prove Funny(Liz) by resolution.</p>`,
    sim: { engine: 'proof', clauses: [
      { id: 'C1a', t: 'Loser(Tony)' }, { id: 'C1b', t: 'Loser(Tom)' }, { id: 'C1c', t: 'Loser(Liz)' }, { id: 'C2', t: '¬Loser(x) ∨ Smart(x) ∨ Funny(x)' }, { id: 'C3', t: '¬Loser(x) ∨ ¬Smart(x) ∨ Likes(x, Clowns)' }, { id: 'C4', t: '¬Loser(x) ∨ ¬Funny(x) ∨ Likes(x, Games)' }, { id: 'C5a', t: '¬Likes(Liz, y) ∨ ¬Likes(Tony, y)' }, { id: 'C5b', t: 'Likes(Tony, y) ∨ Likes(Liz, y)' }, { id: 'C6', t: 'Likes(Tony, Clowns)' }, { id: 'G', t: '¬Funny(Liz)   (negated goal)' }],
      steps: [
        { uses: ['G', 'C2'], text: 'Resolve the negated goal with C2 using {x/Liz}: Funny(Liz) cancels.', result: { id: 'R1', t: '¬Loser(Liz) ∨ Smart(Liz)' } },
        { uses: ['R1', 'C1c'], text: 'Resolve with the fact Loser(Liz).', result: { id: 'R2', t: 'Smart(Liz)' } },
        { uses: ['R2', 'C3'], text: 'Resolve with C3 using {x/Liz}.', result: { id: 'R3', t: '¬Loser(Liz) ∨ Likes(Liz, Clowns)' } },
        { uses: ['R3', 'C1c'], text: 'Resolve with Loser(Liz) again.', result: { id: 'R4', t: 'Likes(Liz, Clowns)' } },
        { uses: ['R4', 'C5a'], text: 'Resolve with C5a using {y/Clowns}.', result: { id: 'R5', t: '¬Likes(Tony, Clowns)' } },
        { uses: ['R5', 'C6'], text: 'Resolve with C6: the two literals are complementary.', result: { id: 'R6', t: '□  (empty clause) — contradiction, so Funny(Liz) is proved' } }] },
    solution: `<p><b>8.1</b> For every thing y: if Liz likes y then Tony does not like it, and if Tony does not like y then Liz likes it. In short, Liz likes exactly the things Tony doesn’t.</p>
<p><b>8.2</b> C1a Loser(Tony) · C1b Loser(Tom) · C1c Loser(Liz) · C2 ¬Loser(x) ∨ Smart(x) ∨ Funny(x) · C3 ¬Loser(x) ∨ ¬Smart(x) ∨ Likes(x, Clowns) · C4 ¬Loser(x) ∨ ¬Funny(x) ∨ Likes(x, Games) · C5a ¬Likes(Liz, y) ∨ ¬Likes(Tony, y) · C5b Likes(Tony, y) ∨ Likes(Liz, y) · C6 Likes(Tony, Clowns).</p>
<p><b>8.3</b> Add the negated goal ¬Funny(Liz).</p><ol><li>¬Funny(Liz) + C2 {x/Liz} → ¬Loser(Liz) ∨ Smart(Liz)</li><li>+ C1c → Smart(Liz)</li><li>+ C3 {x/Liz} → ¬Loser(Liz) ∨ Likes(Liz, Clowns)</li><li>+ C1c → Likes(Liz, Clowns)</li><li>+ C5a {y/Clowns} → ¬Likes(Tony, Clowns)</li><li>+ C6 → □. Hence Funny(Liz).</li></ol><p>Idea in words: if Liz weren’t funny she’d be smart, so she’d like clowns — but Tony likes clowns, and Liz never likes what Tony likes.</p>`,
    notes: `<ul><li>A conjunction of facts becomes one clause per conjunct (C1a–c); a biconditional-like statement with two implications becomes two clauses (C5a, C5b).</li><li>Number every clause and write the substitution at every step.</li><li>C4 and C5b are not needed in the proof — that is normal.</li></ul>`
  });

  const G4 = 'Nov 2024 exam';
  P.push({
    id: 'e24-q1', group: G4, code: '2024 Q1', title: 'Eight coins: successors, state space, better heuristic', topic: 'State-space formulation', marks: '15 marks', keywords: 'eight coins centre circle heuristic dominates admissible 9!',
    question: `<p>Eight coins sit on eight circles around a ring with an empty circle in the centre. Four lines join the centre to the four diagonal circles. A coin may move into an adjacent empty circle along a line (round the ring, or along one of the four spokes). Goal: coins 1–8 clockwise with 1 at 12 o’clock. Start (clockwise from 12): 5, 8, 4, 2, 3, 6, 1, 7, centre empty.</p><p>1.1 How many states are produced from the start state? 1.2 How many states are in the state space? 1.3 Formulate a better heuristic than “coins out of place”. 1.4 Explain why it is superior.</p>`,
    sim: { engine: 'coins', start: '584236170' },
    solution: `<p><b>1.1 Four.</b> The only empty circle is the centre, and only the four diagonal circles are joined to it by a line. They hold coins 8, 2, 6 and 7, so exactly four moves (and four new states) are possible. Trap: “8” is wrong — the other four coins have no line to the centre.</p>
<p><b>1.2 9! = 362,880.</b> Nine circles hold 8 distinct coins and one gap: 9 choices for coin 1’s circle, 8 for coin 2, …, 2 for coin 8 (the gap takes the last), i.e. 9 × 8 × … × 2 = 9!. (Extra: the board graph is bipartite, so only half of these, 181,440, are reachable from any one start — a breadth-first search confirms it.)</p>
<p><b>1.3</b> h<sub>2</sub>(s) = Σ over coins of the fewest line-steps from the coin’s circle to its home circle, counting short cuts through the centre. Start state: coin 5 needs 4, coin 8 → 2, coin 4 → 1, coin 2 → 2, coin 3 → 2, coin 6 → 0, coin 1 → 2, coin 7 → 1, so <b>h<sub>2</sub> = 14</b> (versus h<sub>1</sub> = 7 coins out of place).</p>
<p><b>1.4</b> h<sub>2</sub> is <b>admissible</b>: it is the exact cost of a relaxed problem where coins may pass through each other. One real move moves one coin one step along one line, so h<sub>2</sub> drops by at most 1 per move of cost 1. It <b>dominates</b> h<sub>1</sub>: every misplaced coin is at least one step from home, so h<sub>2</sub> ≥ h<sub>1</sub> in every state. A* with a dominating admissible heuristic expands fewer nodes and still finds the optimum. Measured from the exam start (run it in the simulation): both find the 24-move optimum, but A* expands about 14,800 states with h<sub>1</sub> and fewer than 1,000 with h<sub>2</sub>.</p>
<div class="warn">Do not use plain clockwise distance round the ring: a coin one place anticlockwise of home scores 7, and a coin opposite its home on a diagonal can go through the centre in 2 moves while the ring distance says 4. Both overestimate, so that heuristic is not admissible.</div>`,
    notes: `<ul><li>Successors = number of coins that can reach the empty circle along a line: 4 when the centre is empty; 3 when a diagonal circle is empty (two ring neighbours + centre); 2 when an edge circle (12, 3, 6, 9 o’clock) is empty.</li><li>“Superior” = admissible <i>and</i> dominating — say both, and say what dominance buys you (fewer expansions).</li><li>Try the board: click coins next to the gap, watch h<sub>1</sub> and h<sub>2</sub> change, then run A* with both heuristics.</li></ul>`
  });
  const sg = ['ABCDE', 'FGHIJ', 'KLMNO', 'PQRST', 'UVWXY'], water = 'BDJKLNOQTVW';
  const sNodes = {}, sEdges = [], sCells = [], sPos = {};
  sg.forEach((row, r) => { sCells.push([]); [...row].forEach((n, c) => { const wet = water.includes(n); sPos[n] = [r, c]; sCells[r].push({ n: wet ? null : n, t: n, cls: wet ? 'wall water' : '' }); if (!wet) sNodes[n] = { h: Math.min(r + (4 - c), (4 - r) + (4 - c)) }; }); });
  sg.forEach((row, r) => [...row].forEach((n, c) => { if (water.includes(n) || c === 4) return; [[-1, 2], [0, 1], [1, 2]].forEach(([dr, cost]) => { const rr = r + dr; if (rr < 0 || rr > 4) return; const m = sg[rr][c + 1]; if (!water.includes(m)) sEdges.push([n, m, cost]); }); }));
  P.push({
    id: 'e24-q2', group: G4, code: '2024 Q2', title: 'Swamp traversal with A*', topic: 'Search', marks: '15 marks', keywords: 'swamp manhattan diagonal cost 2 frontier',
    question: `<p>5×5 swamp, entry at A (top-left), exits E (top-right) and Y (bottom-right). Water: B, D, J, K, L, N, O, Q, T, V, W. Moves go right only: horizontally (cost 1) or diagonally up/down (cost 2), onto dry land. h = Manhattan distance to the nearest exit. Alphabetical tie-breaking.</p><p>2.1 Give the frontier at each stage. 2.2 First path found and its cost. 2.3 Is Manhattan distance admissible here?</p>`,
    sim: { engine: 'graphSearch', directed: true, start: 'A', algos: ['astar', 'ucs', 'greedy'], goalSets: [{ label: 'Exits E, Y', goals: ['E', 'Y'] }], render: 'grid', nodesOnly: true, nodes: sNodes, edges: sEdges, grid: { rows: 5, cols: 5, cell: 62, cells: sCells, pos: sPos } },
    solution: `<pre>1) A(0+4=4)        [G(2+4=6)]
2) G(6)            [C(4+2=6), H(3+3=6), M(4+4=8)]
3) C(6)            [H(6), I(6+2=8) via C, M(8)]
4) H(6)            [I(4+2=6) via H, I(8) via C, M(8)]
5) I(6) via H      [E(6+0=6), I(8) via C, M(8)]
6) E(6)  goal</pre><p><b>2.2</b> Path <b>A → G → H → I → E</b>, cost 2 + 1 + 1 + 2 = <b>6</b>.</p>
<p><b>2.3 Yes.</b> Every move goes one column right. A horizontal move costs 1 and reduces the Manhattan distance by at most 1; a diagonal move costs 2 and changes the row and the column by one each, so it reduces the distance by at most 2. No move reduces h by more than its cost, so h never overestimates the remaining cost (water squares only make the real path longer). Relaxation: “ignore water and let every move count its real cost”.</p>`,
    notes: `<ul><li>Dry squares in column 1 are A only (entry); P and U have no legal moves, so they never appear.</li><li>Two different paths end in I (via C and via H) — tree-search A* keeps both on the frontier.</li><li>With ties at equal f, the alphabetically earlier node is removed first: C before H at f = 6.</li></ul>`
  });
  P.push({
    id: 'e24-q3', group: G4, code: '2024 Q3', title: 'GA: machine servicing schedule', topic: 'Genetic algorithms', marks: '20 marks', keywords: 'machine servicing periods binary chromosome p x n fitness crossover mutation constraints',
    question: `<p>n = 7 machines, p = 4 servicing periods. Widgets per hour: 20, 15, 35, 40, 15, 15, 10. Required services: 2, 3, 1, 1, 2, 1, 1. A machine being serviced produces nothing. Chromosome: binary string of length p × n, period-major (first 7 bits = period 1). Example: [1001000 0110101 1100100 0100010]. Maximise total output.</p><p>3.1 Procedure for an initial population. 3.2 Fitness function. 3.3 Fitness of the example. 3.4 Crossover that respects the constraints. 3.5 Mutation that respects the constraints.</p>`,
    sim: { engine: 'machines', cap: [20, 15, 35, 40, 15, 15, 10], req: [2, 3, 1, 1, 2, 1, 1], p: 4, example: '1001000 0110101 1100100 0100010' },
    solution: `<p><b>3.1 Initial population</b>: repeat N times — start from p·n zeros; for each machine i choose req<sub>i</sub> distinct periods at random (<code>random.sample(range(p), req[i])</code>) and set bit k·n + i to 1 for each chosen period k. Every chromosome starts feasible.</p>
<p><b>3.2 Fitness</b>: output in period k is O<sub>k</sub> = Σ<sub>i</sub> cap<sub>i</sub>·(1 − x<sub>k,i</sub>). Violations V = Σ<sub>i</sub> |Σ<sub>k</sub> x<sub>k,i</sub> − req<sub>i</sub>|. Fitness = Σ<sub>k</sub> O<sub>k</sub> − P·V with a large penalty P (e.g. 100).</p>
<p><b>3.3</b> Example: period 1 services M1, M4 → output 150 − 60 = 90; period 2 services M2, M3, M5, M7 → 150 − 75 = 75; period 3 services M1, M2, M5 → 150 − 50 = 100; period 4 services M2, M6 → 150 − 30 = 120. Service counts 2, 3, 1, 1, 2, 1, 1 match the requirements, so V = 0 and <b>fitness = 90 + 75 + 100 + 120 = 385</b>.</p>
<div class="note">Every feasible schedule has the same total, 4 × 150 − Σ cap<sub>i</sub>·req<sub>i</sub> = 600 − 215 = 385, so a GA needs a tie-breaker to prefer some schedules. A sensible one is the lowest period output (here 75): fitness = 385 − P·V + min<sub>k</sub> O<sub>k</sub>, which favours spreading the servicing so production never dips badly.</div>
<p><b>3.4 Crossover</b>: cross over <i>machines</i>, not raw bit positions. Pick a cut c in 1…n−1; child 1 takes machines 1…c (their bits in every period) from parent 1 and machines c+1…n from parent 2, child 2 the reverse. Each machine keeps one parent’s whole service pattern, so its service count is unchanged and feasibility is preserved. (Ordinary single-point crossover on the bit string mixes a machine’s periods and breaks the counts — it would then need repair.)</p>
<p><b>3.5 Mutation</b>: pick a machine i, one period a where it is serviced (bit 1) and one period b where it isn’t (bit 0), and swap the two bits. The service is moved, not added or removed, so the count stays at req<sub>i</sub>. (A plain bit flip changes the count and would be penalised.)</p>`,
    notes: `<ul><li>Index of machine i in period k: k·n + i (0-based).</li><li>Always state <i>how</i> your operator keeps the constraint — that is where the marks are.</li><li>In the simulation, click bits to edit the schedule and watch the counts and fitness react.</li></ul>`
  });
  P.push({
    id: 'e24-q5', group: G4, code: '2024 Q5', title: 'Resolution: every panther hunts rabbits', topic: 'Logic & resolution', marks: '15 marks', keywords: 'carnivorous cat nocturnal mountain herbivores skolem',
    question: `<p>1. ∀x CarnivorousCat(x) → ∃y (isAMountain(y) ∧ livesOn(x, y)) · 2. ∀x panther(x) → CarnivorousCat(x) · 3. ∀x panther(x) → Nocturnal(x) · 4. ∀x∀y isAMountain(y) ∧ CarnivorousCat(x) ∧ Nocturnal(x) ∧ livesOn(x, y) → hasHerbivores(y) · 5. ∀x∀y livesOn(x, y) ∧ hasHerbivores(y) → huntsRabbits(x).</p><p>5.1 Translate statement 4. 5.2 Clause form. 5.3 Prove ∀x panther(x) → huntsRabbits(x) by resolution.</p>`,
    sim: { engine: 'proof', clauses: [
      { id: 'C1a', t: '¬CC(x) ∨ isAMountain(f(x))' }, { id: 'C1b', t: '¬CC(x) ∨ livesOn(x, f(x))' }, { id: 'C2', t: '¬panther(x) ∨ CC(x)' }, { id: 'C3', t: '¬panther(x) ∨ Nocturnal(x)' }, { id: 'C4', t: '¬isAMountain(y) ∨ ¬CC(x) ∨ ¬Nocturnal(x) ∨ ¬livesOn(x, y) ∨ hasHerbivores(y)' }, { id: 'C5', t: '¬livesOn(x, y) ∨ ¬hasHerbivores(y) ∨ huntsRabbits(x)' }, { id: 'G1', t: 'panther(p)' }, { id: 'G2', t: '¬huntsRabbits(p)' }],
      steps: [
        { uses: ['G2', 'C5'], text: 'Negated goal ∃x panther(x) ∧ ¬huntsRabbits(x), Skolem constant p, gives G1 and G2. Resolve G2 with C5 using {x/p}.', result: { id: 'R1', t: '¬livesOn(p, y) ∨ ¬hasHerbivores(y)' } },
        { uses: ['R1', 'C4'], text: 'Resolve with C4 using {x/p}; the duplicate ¬livesOn(p, y) merges.', result: { id: 'R2', t: '¬livesOn(p, y) ∨ ¬isAMountain(y) ∨ ¬CC(p) ∨ ¬Nocturnal(p)' } },
        { uses: ['R2', 'C1b'], text: 'Resolve with C1b using {x/p, y/f(p)}.', result: { id: 'R3', t: '¬isAMountain(f(p)) ∨ ¬CC(p) ∨ ¬Nocturnal(p)' } },
        { uses: ['R3', 'C1a'], text: 'Resolve with C1a using {x/p}; ¬CC(p) merges.', result: { id: 'R4', t: '¬CC(p) ∨ ¬Nocturnal(p)' } },
        { uses: ['R4', 'C2'], text: 'Resolve with C2 using {x/p}.', result: { id: 'R5', t: '¬panther(p) ∨ ¬Nocturnal(p)' } },
        { uses: ['R5', 'C3'], text: 'Resolve with C3 using {x/p}.', result: { id: 'R6', t: '¬panther(p)' } },
        { uses: ['R6', 'G1'], text: 'Resolve with G1.', result: { id: 'R7', t: '□ — contradiction, so every panther hunts rabbits' } }] },
    solution: `<p><b>5.1</b> For every x and y: if y is a mountain and x is a nocturnal carnivorous cat that lives on y, then y has herbivores.</p>
<p><b>5.2</b> (CC = CarnivorousCat; f is a Skolem function for statement 1’s ∃y, because y depends on x)</p><p>C1a ¬CC(x) ∨ isAMountain(f(x)) · C1b ¬CC(x) ∨ livesOn(x, f(x)) · C2 ¬panther(x) ∨ CC(x) · C3 ¬panther(x) ∨ Nocturnal(x) · C4 ¬isAMountain(y) ∨ ¬CC(x) ∨ ¬Nocturnal(x) ∨ ¬livesOn(x, y) ∨ hasHerbivores(y) · C5 ¬livesOn(x, y) ∨ ¬hasHerbivores(y) ∨ huntsRabbits(x).</p>
<p><b>5.3</b> Negate: ¬∀x (panther(x) → huntsRabbits(x)) ≡ ∃x (panther(x) ∧ ¬huntsRabbits(x)); Skolemise with a fresh constant p → G1 panther(p), G2 ¬huntsRabbits(p). Then G2+C5 → R1; +C4 → R2; +C1b {y/f(p)} → R3; +C1a → R4 ¬CC(p) ∨ ¬Nocturnal(p); +C2 → R5; +C3 → R6 ¬panther(p); +G1 → □.</p>`,
    notes: `<ul><li>∃ inside a ∀ becomes a Skolem <b>function</b> of the ∀ variable (f(x)); ∃ in a negated goal with nothing outside becomes a Skolem <b>constant</b> (p).</li><li>Statement 1 gives two clauses because its right-hand side is a conjunction.</li><li>Merge duplicate literals (factoring) as soon as they appear.</li></ul>`
  });
  P.push({
    id: 'e24-q6', group: G4, code: '2024 Q6', title: 'Perceptron: second epoch and test', topic: 'Neural networks', marks: '10 marks', keywords: 'perceptron epoch 2 table',
    question: `<p>Class 1: [1 1 1 1], [−1 1 1 −1]; class −1: [−1 −1 1 1], [1 −1 −1 1]. Weights start at 0, α = 1, θ = 0. Epoch 1 ends with b = −1, w = (1, 3, 1, −1). 6.1 Complete the table for epoch 2. 6.2 Give y<sub>in</sub> and the output for [1 1 −1 −1].</p>`,
    sim: { engine: 'perceptron', X: [[1, 1, 1, 1], [-1, 1, 1, -1], [-1, -1, 1, 1], [1, -1, -1, 1]], T: [1, 1, -1, -1], epochs: 2, alpha: 1, theta: 0, test: [1, 1, -1, -1] },
    solution: `<p><b>Epoch 2</b> (start b = −1, w = (1,3,1,−1)): y<sub>in</sub> = 3, 3, −5, −5 → outputs 1, 1, −1, −1, all equal to the targets, so <b>no weights change</b> and training has converged.</p>
<p><b>6.2</b> y<sub>in</sub> = −1 + 1(1) + 1(3) + (−1)(1) + (−1)(−1) = <b>3</b> → output <b>1</b>.</p>`,
    notes: `<ul><li>Fill every column even when nothing changes: Δw = 0, Δb = 0 and the weights copied down.</li><li>Epoch 1 check: row 1 y<sub>in</sub> = 0 → update; row 2 correct; row 3 y<sub>in</sub> = 1 → update to (2,2,0,0), b = 0; row 4 y<sub>in</sub> = 0 → update to (1,3,1,−1), b = −1.</li></ul>`
  });
})(window.AIN);

/* ---- data/03-exam-2023-insect.js ---- */
(function (A) {
  const P = A.problems;
  const G = 'Nov 2023 exam';
  // maze 4x7
  const walls = new Set(['1,2', '1,3', '1,5', '2,0', '2,2', '3,0']);
  const mNodes = {}, mEdges = [], mCells = [], mPos = {};
  for (let r = 0; r < 4; r++) { mCells.push([]); for (let c = 0; c < 7; c++) { const k = r + ',' + c; const w = walls.has(k); mCells[r].push({ n: w ? null : k, t: r === 0 && c === 0 ? 'S' : r === 3 && c === 6 ? 'G' : '', cls: w ? 'wall' : '' }); if (!w) { mNodes[k] = { h: Math.max(3 - r, 6 - c), label: `(${r},${c})` }; mPos[k] = [r, c]; } } }
  for (const k in mNodes) { const [r, c] = k.split(',').map(Number); for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const q = (r + dr) + ',' + (c + dc); if (mNodes[q]) mEdges.push([k, q, 1]); } }
  P.push({
    id: 'e23-q1', group: G, code: '2023 Q1', title: 'A* through a maze with diagonal moves', topic: 'Search', marks: '15 marks', keywords: 'maze A* evaluation function chebyshev diagonal distance search tree',
    question: `<p>A 4×7 grid maze: start S at (0,0), goal G at (3,6). Black squares (1,2), (1,3), (1,5), (2,0), (2,2), (3,0). Each move goes to an adjacent white square — vertical, horizontal or diagonal.</p><p>(a) Choose a suitable evaluation function for A* and motivate it. (b) Draw the A* search tree. (c) Draw the optimal path.</p>`,
    sim: { engine: 'graphSearch', directed: true, start: '0,0', algos: ['astar', 'bfs'], goalSets: [{ label: 'Goal G (3,6)', goals: ['3,6'] }], render: 'grid', explored: true, tie: 'h', nodesOnly: true, sep: ' → ', nodes: mNodes, edges: mEdges, grid: { rows: 4, cols: 7, cell: 60, cells: mCells, pos: mPos } },
    solution: `<p><b>(a)</b> f(n) = g(n) + h(n), where g(n) = number of moves from S so far (every move costs 1) and h(n) = max(|row<sub>n</sub> − 3|, |col<sub>n</sub> − 6|), the diagonal (Chebyshev) distance to G. Motivation: one move changes the row and the column by at most 1 each, so at least max(Δrow, Δcol) moves remain — h never overestimates (admissible) and is consistent, so A* returns a shortest path. Manhattan distance would be wrong here: at S it says 3 + 6 = 9, but G is reachable in 6.</p>
<p><b>(b)</b> Search tree (graph search, ties broken by lower h, then by position). Each node shows g + h:</p><pre>S(0,0) 0+6
├─ (0,1) 1+5   expanded 2nd
│   ├─ (0,2) 2+4   expanded 3rd
│   │   ├─ (0,3) 3+3   expanded 4th
│   │   │   ├─ (0,4) 4+3
│   │   │   └─ (1,4) 4+2   expanded 5th
│   │   │       ├─ (0,4) 5+3   (0,5) 5+3   (2,3) 5+3   (2,4) 5+2
│   │   │       └─ (2,5) 5+1   expanded 6th
│   │   │           ├─ (1,6) 6+2   (2,4) 6+2   (3,4) 6+2
│   │   │           ├─ (2,6) 6+1   (3,5) 6+1
│   │   │           └─ G(3,6) 6+0   removed 7th: GOAL
│   │   └─ (1,1) 3+5
│   ├─ (1,0) 2+6
│   └─ (1,1) 2+5
├─ (1,0) 1+6
└─ (1,1) 1+5</pre><p>Every node on the optimal route has f = 6 and every other leaf has f ≥ 6, so A* goes straight down it; ties at f = 6 go to the node with the smaller h. Squares already expanded are not added again. The simulation shows the exact frontier at each step.</p>
<p><b>(c)</b> Optimal path: S(0,0) → (0,1) → (0,2) → (0,3) → (1,4) → (2,5) → G(3,6), <b>6 moves</b>. (S → (1,1) → (0,2) → … is equally short.) Column 2 is only open in rows 0 and 3, which forces the top route.</p>`,
    notes: `<ul><li>Pick the heuristic to match the moves: 4 directions → Manhattan; 8 directions with equal cost → diagonal distance max(Δr, Δc).</li><li>“Motivate” = say why it never overestimates for these moves.</li><li>With an explored set A* needs a consistent h — diagonal distance is consistent because each move changes it by at most 1.</li></ul>`
  });
  P.push({
    id: 'e23-q5', group: G, code: '2023 Q5', title: 'Prolog: list membership predicates', topic: 'Prolog', marks: '15 marks', keywords: 'prolog listContainsElement listContainsList listsContainList recursion',
    question: `<p>Without built-in predicates, write (a) listContainsElement/2 — true if the list contains the element; (b) listContainsList/2 — true if the first list contains every element of the second; (c) listsContainList/3 — true if both of the first two lists contain every element of the third. Examples: listContainsElement([1,2,3],3), listContainsList([1,2,3],[3,1]), listsContainList([1,2,3],[3,1],[3]) are all true.</p>`,
    sim: { engine: 'prolog' },
    solution: `<pre>% (a) X is the head, or X is somewhere in the tail
listContainsElement([X|_], X).
listContainsElement([_|T], X) :- listContainsElement(T, X).

% (b) every element of the second list is in the first
listContainsList(_, []).
listContainsList(L, [H|T]) :-
    listContainsElement(L, H),
    listContainsList(L, T).

% (c) reuse (b) twice
listsContainList(L1, L2, L3) :-
    listContainsList(L1, L3),
    listContainsList(L2, L3).</pre><p>Each predicate has a base case (head matches / empty list) and a recursive case on the tail, and (b) and (c) call the earlier predicates as the question allows.</p>`,
    notes: `<ul><li>Prolog is declarative: you state what is true and Prolog searches (depth-first, top clause first) for a proof.</li><li><code>[H|T]</code> splits a list into head and tail; <code>_</code> is an anonymous variable you don’t care about.</li><li>The empty list never matches <code>[X|_]</code>, so membership in [] simply fails — no extra clause needed.</li><li>The same predicate is the practice-final “membership(X, List)” question: <code>membership(X, [X|_]). membership(X, [_|T]) :- membership(X, T).</code></li></ul>`
  });
  P.push({
    id: 'e23-q9', group: G, code: '2023 Q9', title: 'GA for the travelling salesman (6 cities)', topic: 'Genetic algorithms', marks: '15 marks', keywords: 'TSP chromosome permutation order crossover swap mutation fitness tour length',
    question: `<p>A salesman must visit cities A–F exactly once and return home, minimising total distance. (a) Describe a chromosome representation with an example. (b) A suitable mutation operator, with motivation and example. (c) A suitable crossover operator, with motivation and example. (d) A fitness function and how it is used.</p>`,
    sim: { engine: 'ga', kind: 'tsp', pop: 24, gens: 40, pc: 0.9, pm: 0.3, labParents: [['A', 'C', 'E', 'B', 'F', 'D'], ['B', 'D', 'F', 'A', 'C', 'E']] },
    solution: `<p><b>(a)</b> Permutation (path) representation: the chromosome is the visiting order, each city exactly once, e.g. <code>[A, C, E, B, F, D]</code> = A → C → E → B → F → D → back to A.</p>
<p><b>(b) Swap mutation</b>: choose two positions and exchange their cities: [A, C, E, B, F, D] → swap positions 2 and 5 → [A, F, E, B, C, D]. Motivation: the result is still a permutation, so no city is lost or repeated. (Inversion — reverse a segment, ACEBFD → ACFBED — also works and is what aipython uses.)</p>
<p><b>(c) Order crossover (OX)</b>: copy a slice from parent 1, then fill the other positions with the remaining cities in parent 2’s order. P1 = A C <u>E B F</u> D, P2 = B D F A C E, slice positions 3–5 → child = _ _ E B F _ ; remaining in P2 order: D, A, C → child = <b>D A E B F C</b>. Motivation: ordinary single-point crossover would duplicate some cities and drop others; OX (or PMX) always produces a valid tour.</p>
<p><b>(d) Fitness</b>: tour length D = Σ<sub>i</sub> d(c<sub>i</sub>, c<sub>i+1</sub>) + d(c<sub>6</sub>, c<sub>1</sub>) — remember the closing leg home. Lower is better, so use fitness = 1 / D (or minimise D directly). It is used to select parents (roulette or tournament — shorter tours chosen more often), to keep the elite unchanged, and to stop when the best length stops improving.</p>`,
    notes: `<ul><li>Number of distinct tours for n cities: (n − 1)!/2 — for 6 cities that is 60.</li><li>Representation, mutation and crossover must agree: with a permutation chromosome, every operator must output a permutation.</li><li>The simulation uses a made-up map of six cities; run it and use the operator lab to see OX and swap mutation on two fixed parents.</li></ul>`
  });
  P.push({
    id: 'e23-q10', group: G, code: '2023 Q10', title: 'GA: decimal fitness, greedy selection, crossover', topic: 'Genetic algorithms', marks: '5 marks', keywords: 'average fitness binary decimal greedy selection single point crossover position 2',
    question: `<p>Population 1000111, 0001001, 1100100, 0111110; fitness = the decimal value (0100001 = 33). (a) Average fitness. (b) Greedy selection picks 2 parents; single-point crossover at position 2 (0-based), crossover rate 1. Give the two offspring in descending order of fitness.</p>`,
    sim: { engine: 'chromLab', names: ['1000111', '0001001', '1100100', '0111110'], pop: ['1000111', '0001001', '1100100', '0111110'], fitness: s => parseInt(s, 2), cross: { a: 2, b: 0, points: [2] } },
    solution: `<p><b>(a)</b> 1000111 = 71, 0001001 = 9, 1100100 = 100, 0111110 = 62. Average = (71 + 9 + 100 + 62) / 4 = 242 / 4 = <b>60.5</b>.</p>
<p><b>(b)</b> Greedy selection takes the two fittest: 1100100 (100) and 1000111 (71). Cut at position 2: 11|00100 and 10|00111.</p><p>Offspring: 11 + 00111 = <b>1100111 = 103</b>, and 10 + 00100 = <b>1000100 = 68</b>. In descending order: 1100111 (103), 1000100 (68).</p><p>(Cutting after index 2 instead gives the same children here, because both parents have 0 at index 2.)</p>`,
    notes: `<ul><li>Binary → decimal: add the place values 64, 32, 16, 8, 4, 2, 1 where the bit is 1.</li><li>“Position k, 0-based” normally means the cut lies before gene k: child 1 = P1[0:k] + P2[k:].</li><li>Greedy (truncation) selection: simply take the best individuals.</li></ul>`
  });

  const GI = 'Exam with the insect problem';
  P.push({
    id: 'ins-q21', group: GI, code: 'Q2.1', title: 'The artificial insect: state, moves, heuristic', topic: 'State-space formulation', marks: '6 marks', keywords: 'insect flooded tunnels air breath state space manhattan',
    question: `<p>An insect moves in an M×N maze. Each time step it moves to a free adjacent square or stays put (cost 1). Flooded squares (shaded) cost 1 unit of air to enter; entering a free square refills its air. It can hold its breath for at most A steps in a row. 2.1.1 What must the state contain? 2.1.2 Define the legal moves. 2.1.3 Define a heuristic.</p>`,
    sim: { engine: 'insect', air: 2, start: [4, 0], map: ['....X', '#~###', '.~...', '#~#.#', '.~...'] },
    solution: `<p><b>2.1.1</b> State = (row, column, air left): the insect’s position and how many more flooded steps it can take, a ∈ {0, …, A}. The map, walls, flooded squares and exit never change, so they are not in the state. State space size M × N × (A + 1).</p>
<p><b>2.1.2</b> From (r, c, a): move N, S, E or W into an adjacent square that is not a wall, or stay. Entering (or staying in) a flooded square is legal only if a ≥ 1 and gives a − 1; entering or staying on a free square resets the air to A. Every action costs 1.</p>
<p><b>2.1.3</b> h(r, c, a) = Manhattan distance from (r, c) to the exit X. Admissible: each action moves at most one square and costs 1, and walls and air limits can only make the real route longer.</p>
<p>In the example map: with A ≤ 1 the exit is unreachable, A = 2 takes 12 steps (it must refill between short flooded stretches), A = 3 takes 10, and A ≥ 4 takes 8 straight up the tunnel.</p>`,
    notes: `<ul><li>The classic trap: a state of just (row, col) is not enough — two visits to the same square with different air left have different futures.</li><li>Drag the A slider in the simulation to see the route change.</li></ul>`
  });
  P.push({
    id: 'ins-q22', group: GI, code: 'Q2.2', title: 'Tree search with three goals (D, F, G)', topic: 'Search', keywords: 'DFS BFS UCS greedy A* visited order path',
    question: `<p>Start A. A→B (2), A→C (1), A→D (3); B→E (2), B→F (1); C→G (1), C→H (3); D→J (1), D→K (1). Goals D, F, G. h: A 2, B 1, C 1, every other node 0. Give the order nodes are visited and the path returned by each search (ties alphabetical).</p>`,
    sim: { engine: 'graphSearch', directed: true, start: 'A', algos: ['dfs', 'bfs', 'ucs', 'greedy', 'astar'], goalSets: [{ label: 'Goals D, F, G', goals: ['D', 'F', 'G'] }], w: 600, h: 300,
      nodes: { A: { x: 300, y: 40, h: 2 }, B: { x: 130, y: 140, h: 1 }, C: { x: 300, y: 140, h: 1 }, D: { x: 470, y: 140, h: 0 }, E: { x: 70, y: 255, h: 0 }, F: { x: 180, y: 255, h: 0 }, G: { x: 250, y: 255, h: 0 }, H: { x: 350, y: 255, h: 0 }, J: { x: 420, y: 255, h: 0 }, K: { x: 530, y: 255, h: 0 } },
      edges: [['A', 'B', 2], ['A', 'C', 1], ['A', 'D', 3], ['B', 'E', 2], ['B', 'F', 1], ['C', 'G', 1], ['C', 'H', 3], ['D', 'J', 1], ['D', 'K', 1]] },
    solution: `<table><thead><tr><th>Search</th><th>Visited</th><th>Path</th></tr></thead><tbody>
<tr><td>Depth-first</td><td>A, B, E, F</td><td>A-B-F (cost 3)</td></tr>
<tr><td>Breadth-first</td><td>A, B, C, D</td><td>A-D (cost 3)</td></tr>
<tr><td>Uniform cost</td><td>A, C, B, G</td><td>A-C-G (cost 2)</td></tr>
<tr><td>Greedy best-first</td><td>A, D</td><td>A-D (cost 3)</td></tr>
<tr><td>A*</td><td>A, C, G</td><td>A-C-G (cost 2)</td></tr></tbody></table>
<p>UCS: after C (g = 1) the frontier holds B(2), G(2), D(3), H(4); B and G tie at 2 and B is earlier alphabetically, so B is expanded before G is removed. A*: f(C) = 1 + 1 = 2 beats f(B) = f(D) = 3, then f(G) = 2 + 0 = 2 is removed next. The heuristic is admissible (h(A) = 2 = true cost, h(B) = 1 ≤ 1, h(C) = 1 ≤ 1), so A* is optimal.</p>`,
    notes: `<ul><li>Goal test on removal: BFS generates F and G before it removes D, but D comes out of the queue first.</li><li>Greedy ignores the cost already paid — it jumps to D because h(D) = 0.</li></ul>`
  });
  P.push({
    id: 'ins-q31', group: GI, code: 'Q3.1', title: 'Semantic network: Harwich University', topic: 'Knowledge representation', marks: '8 marks', keywords: 'semantic network part of has dean located',
    question: `<p>Harwich University has a College of Management (with a Dean) and a College of Engineering (with a Dean). Management has an Accounting and a Marketing Department, each with a Professor. Engineering is located in Gamaliel Hall, which belongs to the university. The university also has a Buildings and Grounds section with a Director, which looks after Gamaliel Hall. Peter Smith is Dean of Engineering; Alice Jones is Dean of Management. Draw a semantic network.</p>`,
    sim: { engine: 'semnet', w: 760, h: 430, nodes: [
      { id: 'HU', label: 'Harwich University', x: 380, y: 40 }, { id: 'CM', label: 'College of Management', x: 160, y: 150 }, { id: 'CE', label: 'College of Engineering', x: 600, y: 150 }, { id: 'AJ', label: 'Alice Jones', x: 80, y: 260, kind: 'inst' }, { id: 'PS', label: 'Peter Smith', x: 700, y: 260, kind: 'inst' }, { id: 'D', label: 'Dean', x: 390, y: 390 }, { id: 'AD', label: 'Accounting Dept', x: 160, y: 330 }, { id: 'MD', label: 'Marketing Dept', x: 290, y: 260 }, { id: 'PR', label: 'Professor', x: 230, y: 410 }, { id: 'GH', label: 'Gamaliel Hall', x: 560, y: 300 }, { id: 'BG', label: 'Buildings & Grounds', x: 420, y: 160 }, { id: 'DI', label: 'Director', x: 440, y: 260 }],
      edges: [['CM', 'HU', 'part of'], ['CE', 'HU', 'part of'], ['BG', 'HU', 'part of'], ['CM', 'AJ', 'dean'], ['CE', 'PS', 'dean'], ['AJ', 'D', 'is a'], ['PS', 'D', 'is a'], ['AD', 'CM', 'part of'], ['MD', 'CM', 'part of'], ['AD', 'PR', 'has'], ['MD', 'PR', 'has'], ['CE', 'GH', 'located in'], ['GH', 'HU', 'belongs to'], ['BG', 'DI', 'has'], ['BG', 'GH', 'looks after']], legend: 'Boxes are classes/objects; rounded red boxes are individuals. Arrows are labelled relations.' },
    solution: `<p>Nodes: Harwich University, College of Management, College of Engineering, Accounting Department, Marketing Department, Professor, Dean, Alice Jones, Peter Smith, Gamaliel Hall, Buildings & Grounds, Director.</p><p>Arcs: CoM —part of→ HU; CoE —part of→ HU; B&G —part of→ HU; Accounting —part of→ CoM; Marketing —part of→ CoM; Accounting —has→ Professor; Marketing —has→ Professor; CoM —dean→ Alice Jones; CoE —dean→ Peter Smith; Alice Jones —is a→ Dean; Peter Smith —is a→ Dean; CoE —located in→ Gamaliel Hall; Gamaliel Hall —belongs to→ HU; B&G —has→ Director; B&G —looks after→ Gamaliel Hall.</p>`,
    notes: `<ul><li>Every fact in the text becomes one labelled arc — tick them off as you draw.</li><li>Use <b>is a</b> / instance-of for “X is a Y” so properties can be inherited; use other labels (part of, has, located in) for relations.</li></ul>`
  });
  P.push({
    id: 'ins-q32', group: GI, code: 'Q3.2', title: 'Who is Amy’s grandparent? Backward chaining and resolution', topic: 'Logic & resolution', marks: '19 marks', keywords: 'parent sister grandparent backward chaining answer extraction clause form',
    question: `<p>C1 parent(bob, pam) · C2 parent(pam, ann) · C3 sister(ann, amy) · C4 ∀g∀c∃p parent(g, p) ∧ parent(p, c) → grandparent(g, c) · C5 ∀s1∀s2∃p sister(s1, s2) ∧ parent(p, s1) → parent(p, s2) · C6 ∀c1∀c2 sister(c1, c2) ∨ brother(c1, c2) → sibling(c1, c2).</p><p>3.2.1 Use backward chaining to answer “Who is Amy’s grandparent?”. 3.2.2 Convert to clause form. 3.2.3 Answer the question by resolution.</p>`,
    sims: [{ engine: 'proof', title: 'Backward chaining', clauseTitle: 'Knowledge base', stepTitle: 'Goal stack', clauses: [{ id: 'C1', t: 'parent(bob, pam)' }, { id: 'C2', t: 'parent(pam, ann)' }, { id: 'C3', t: 'sister(ann, amy)' }, { id: 'C4', t: 'parent(g,p) ∧ parent(p,c) → grandparent(g,c)' }, { id: 'C5', t: 'sister(s1,s2) ∧ parent(p,s1) → parent(p,s2)' }],
      steps: [
        { goals: ['grandparent(X, amy)'], uses: ['C4'], text: 'Goal grandparent(X, amy) matches the head of C4 with {g/X, c/amy}. Replace it by the body.' },
        { goals: ['parent(X, P)', 'parent(P, amy)'], uses: ['C5'], text: 'parent(P, amy) is not a fact. It matches the head of C5 with {p/P, s2/amy}: prove sister(S1, amy) and parent(P, S1).' },
        { goals: ['parent(X, P)', 'sister(S1, amy)', 'parent(P, S1)'], uses: ['C3'], text: 'sister(S1, amy) matches fact C3 with {S1/ann}.' },
        { goals: ['parent(X, P)', 'parent(P, ann)'], uses: ['C2'], text: 'parent(P, ann) matches fact C2 with {P/pam}.' },
        { goals: ['parent(X, pam)'], uses: ['C1'], text: 'parent(X, pam) matches fact C1 with {X/bob}.' },
        { goals: [], text: '<b>X = bob</b>: Bob is Amy’s grandparent (Bob → Pam → Ann, and Amy is Ann’s sister).' }] },
    { engine: 'proof', title: 'Resolution with an answer literal', clauses: [{ id: 'C1', t: 'parent(bob, pam)' }, { id: 'C2', t: 'parent(pam, ann)' }, { id: 'C3', t: 'sister(ann, amy)' }, { id: 'C4', t: '¬parent(g,p) ∨ ¬parent(p,c) ∨ grandparent(g,c)' }, { id: 'C5', t: '¬sister(s1,s2) ∨ ¬parent(p,s1) ∨ parent(p,s2)' }, { id: 'C6a', t: '¬sister(c1,c2) ∨ sibling(c1,c2)' }, { id: 'C6b', t: '¬brother(c1,c2) ∨ sibling(c1,c2)' }, { id: 'G', t: '¬grandparent(x, amy) ∨ Ans(x)' }],
      steps: [
        { uses: ['G', 'C4'], text: 'Resolve with C4 using {g/x, c/amy}.', result: { id: 'R1', t: '¬parent(x,p) ∨ ¬parent(p,amy) ∨ Ans(x)' } },
        { uses: ['R1', 'C5'], text: 'Resolve ¬parent(p, amy) with C5 using {s2/amy}.', result: { id: 'R2', t: '¬parent(x,p) ∨ ¬sister(s1,amy) ∨ ¬parent(p,s1) ∨ Ans(x)' } },
        { uses: ['R2', 'C3'], text: 'Resolve with C3 using {s1/ann}.', result: { id: 'R3', t: '¬parent(x,p) ∨ ¬parent(p,ann) ∨ Ans(x)' } },
        { uses: ['R3', 'C2'], text: 'Resolve with C2 using {p/pam}.', result: { id: 'R4', t: '¬parent(x,pam) ∨ Ans(x)' } },
        { uses: ['R4', 'C1'], text: 'Resolve with C1 using {x/bob}. Only the answer literal is left.', result: { id: 'R5', t: 'Ans(bob)' } }] }],
    solution: `<p><b>3.2.1</b> grandparent(X, amy) ← parent(X, P), parent(P, amy). parent(P, amy) ← sister(S1, amy), parent(P, S1); sister(ann, amy) gives S1 = ann; parent(P, ann) gives P = pam; parent(X, pam) gives <b>X = bob</b>.</p>
<p><b>3.2.2</b> C1 parent(bob, pam) · C2 parent(pam, ann) · C3 sister(ann, amy) · C4 ¬parent(g,p) ∨ ¬parent(p,c) ∨ grandparent(g,c) · C5 ¬sister(s1,s2) ∨ ¬parent(p,s1) ∨ parent(p,s2) · C6a ¬sister(c1,c2) ∨ sibling(c1,c2) · C6b ¬brother(c1,c2) ∨ sibling(c1,c2).</p>
<div class="note">C4 and C5 put ∃p before the implication, but the intended meaning is “if there is some p with …”. ∃p in the antecedent of an implication becomes ∀p once the implication is removed (¬∃p … ≡ ∀p ¬…), which is why p is an ordinary variable in the clauses, not a Skolem function.</div>
<p><b>3.2.3</b> Add ¬grandparent(x, amy) ∨ Ans(x). Resolve with C4, C5 {s2/amy}, C3 {s1/ann}, C2 {p/pam}, C1 {x/bob} → <b>Ans(bob)</b>.</p>`,
    notes: `<ul><li>Backward chaining starts from the goal and works back through rule heads to facts (goal-driven); forward chaining starts from facts.</li><li>To <i>find</i> a value with resolution, add an answer literal Ans(x) to the negated goal and stop when only Ans(…) is left.</li><li>“A or B → C” becomes two clauses (C6a, C6b).</li></ul>`
  });
  const eY = k => [0, 1, 2, 3, 4].map(j => j === k ? 1 : -1);
  P.push({
    id: 'ins-q41', group: GI, code: 'Q4.1', title: 'Elephant footprints: bidirectional associative memory', topic: 'Neural networks', marks: '10 marks', keywords: 'BAM associative memory footprints hebbian weight matrix',
    question: `<p>Five elephants’ footprints are stored as 4-bit strings: 0101, 1101, 1110, 0111, 1111. Given a print the system must name the elephant, and given the elephant it must produce the print. 4.1.1 Which neural network? 4.1.2 Input and output vectors. 4.1.3 Train it.</p>`,
    sim: { engine: 'bam', names: ['E1', 'E2', 'E3', 'E4', 'E5'], xLabels: ['x1', 'x2', 'x3', 'x4'], yLabels: ['E1', 'E2', 'E3', 'E4', 'E5'], X: [[-1, 1, -1, 1], [1, 1, -1, 1], [1, 1, 1, -1], [-1, 1, 1, 1], [1, 1, 1, 1]], Y: [eY(0), eY(1), eY(2), eY(3), eY(4)] },
    solution: `<p><b>4.1.1</b> A <b>bidirectional associative memory (BAM)</b>: it is hetero-associative (print ↔ elephant are different vectors) and recalls in both directions. A Hopfield net is auto-associative (same vector in and out), so it can clean up a print but cannot name the elephant.</p>
<p><b>4.1.2</b> Convert to bipolar (0 → −1): X1 = [−1, 1, −1, 1], X2 = [1, 1, −1, 1], X3 = [1, 1, 1, −1], X4 = [−1, 1, 1, 1], X5 = [1, 1, 1, 1]. Outputs: one bipolar code per elephant, e.g. Y1 = [1, −1, −1, −1, −1], Y2 = [−1, 1, −1, −1, −1], …, Y5 = [−1, −1, −1, −1, 1].</p>
<p><b>4.1.3</b> W = Σ<sub>k</sub> X<sub>k</sub><sup>T</sup> Y<sub>k</sub> (4 × 5):</p><pre>      E1  E2  E3  E4  E5
x1  [ -3   1   1  -3   1 ]
x2  [ -3  -3  -3  -3  -3 ]
x3  [ -3  -3   1   1   1 ]
x4  [ -1  -1  -5  -1  -1 ]</pre><p>Recall elephant → print: X = sign(W·Y). Recall print → elephant: Y = sign(X·W).</p>
<div class="note">Check the recall in the simulation: elephant → print works for all five, but print → elephant only works for E1. The five prints are strongly correlated (every one has x2 = 1, which makes row x2 constant), so plain Hebbian storage cannot separate them — a known capacity limit of BAMs. In an exam, write the trained W and mention this limit.</div>`,
    notes: `<ul><li>BAM training is one shot: no epochs, just add the outer products.</li><li>Recall uses the sign function; a 0 keeps the previous value.</li><li>Capacity rule of thumb: a BAM reliably stores about min(n, m) patterns, and only if they are not too similar.</li></ul>`
  });
  P.push({
    id: 'ins-q42', group: GI, code: 'Q4.2', title: 'Knapsack with a genetic algorithm', topic: 'Genetic algorithms', marks: '20 marks', keywords: 'knapsack GA vs GP chromosome fitness selection mutation crossover rate',
    question: `<p>Given n items with weights w<sub>i</sub> and values v<sub>i</sub>, choose how many of each to pack so the total weight stays within a limit and the value is maximal. 4.2.1 Why a GA rather than genetic programming? 4.2.2 Chromosome. 4.2.3 Fitness. 4.2.4 Selection. 4.2.5 Mutation and crossover. 4.2.6 Mutation rate and crossover rate.</p>`,
    sim: { engine: 'ga', kind: 'knapsack', pop: 20, gens: 30, pc: 0.8, pm: 0.2 },
    simIntro: 'Sample instance from the knapsack lecture: A (5 kg, $12), B (3 kg, $5), C (7 kg, $10), D (2 kg, $7), capacity 12 kg, any number of each item.',
    solution: `<p><b>4.2.1</b> The answer is a fixed-length set of numbers (how many of each item), not a program. GAs evolve fixed-length strings of parameters; genetic programming evolves variable-size trees that are executed. So a GA fits.</p>
<p><b>4.2.2</b> An integer vector [k<sub>1</sub>, …, k<sub>n</sub>], k<sub>i</sub> = copies of item i (0 ≤ k<sub>i</sub> ≤ ⌊W / w<sub>i</sub>⌋). E.g. [1, 0, 1, 0] = one A and one C. (For the 0/1 version, a bit string: 1101 = take A, B, D.)</p>
<p><b>4.2.3</b> f = Σ k<sub>i</sub>v<sub>i</sub> if Σ k<sub>i</sub>w<sub>i</sub> ≤ W, otherwise 0 (or subtract a penalty proportional to the excess weight).</p>
<p><b>4.2.4</b> Roulette-wheel selection: P(i) = f<sub>i</sub> / Σf, so fitter packings are picked more often (an overweight packing with f = 0 is never picked). Tournament selection is a good alternative.</p>
<p><b>4.2.5</b> Mutation: pick a gene and add or subtract 1 (within its bounds) — or flip a bit in the 0/1 version. Crossover: single point — swap the tails of two parents after a random gene. Children that are overweight get fitness 0 or are repaired by removing items.</p>
<p><b>4.2.6</b> Crossover rate = probability that a selected pair is recombined rather than copied unchanged (high, e.g. 0.7–0.9). Mutation rate = probability that a gene (or child) is mutated (low, e.g. 0.01–0.1); it keeps diversity without destroying good solutions.</p>`,
    notes: `<ul><li>In the sample instance item D has the best value per kg ($3.50), so the optimum is six D’s = 12 kg, $42 — watch the GA find it.</li><li>The 0/1 version of the same items has optimum A + B + D = 10 kg, $24.</li></ul>`
  });
  P.push({
    id: 'ins-apx', group: GI, code: 'Appendix A', title: 'Alpha-beta on a four-level tree', topic: 'Game trees', keywords: 'alpha beta appendix 3 11 2 13 7 8 6 0 4 5 1 15',
    question: `<p>MAX root; two MIN children; each MIN has two MAX children (the last MAX has one); each MAX has one or two MIN children; leaves left to right: 3, 11 | 2, 13 | 7 | 8, 6 | 0, 4 | 5 | 1, 15. Apply minimax with alpha-beta pruning, mark the cuts and give the root value. (Node letters A–N are added for reference.)</p>`,
    sim: { engine: 'alphaBeta', root: 'A', levelLabels: ['MAX', 'MIN', 'MAX', 'MIN', ''], tree: { A: [['', 'B'], ['', 'C']], B: [['', 'D'], ['', 'E']], C: [['', 'F'], ['', 'G']], D: [['', 'H'], ['', 'I']], E: [['', 'J'], ['', 'K']], F: [['', 'L'], ['', 'M']], G: [['', 'N']], H: [['', 3], ['', 11]], I: [['', 2], ['', 13]], J: [['', 7]], K: [['', 8], ['', 6]], L: [['', 0], ['', 4]], M: [['', 5]], N: [['', 1], ['', 15]] } },
    solution: `<p>Values: A = <b>3</b>; B = 3, C = 1; D = 3, E = 7, F = 5, G = 1; H = 3, I = 2, J = 7, K = NOT VISITED, L = 0, M = 5, N = 1.</p><p>Cuts: I’s leaf 13 (2 ≤ α = 3), E → K (E = 7 ≥ β = 3), L’s leaf 4 (0 ≤ α = 3), N’s leaf 15 (1 ≤ α = 3). C = min(5, 1) = 1. MAX takes the left move for a guaranteed 3.</p>`,
    notes: `<ul><li>The last MAX node G has a single child — its value is just that child’s value.</li><li>Inside C, α = 3 comes down from the root, so every MIN node that reaches 3 or less stops at once.</li></ul>`
  });
})(window.AIN);

/* ---- data/04-exam-2018.js ---- */
(function (A) {
  const P = A.problems;
  const G = 'Nov 2018 exam';
  P.push({
    id: 'e18-q21', group: G, code: '2018 Q2.1', title: 'n-Queens: state, moves, heuristic', topic: 'State-space formulation', marks: '11 marks', keywords: 'n queens state legal moves heuristic attacking pairs DFS',
    question: `<p>Queens may be placed on or removed from an n×n board; start with an empty board; the goal is n queens with none attacking another (same row, column or diagonal). The figure shows a 6-queens configuration with queens at (row, column, from the top-left, 1-based): (1,3), (3,1), (3,6), (4,5), (5,2), (5,4).</p><p>2.1.1 What must the state contain? 2.1.2 Legal moves? 2.1.3 A heuristic. 2.1.4 Evaluate it on the configuration. 2.1.5 Which search technique, and why?</p>`,
    sim: { engine: 'queens', n: 6, start: [[0, 2], [2, 0], [2, 5], [3, 4], [4, 1], [4, 3]] },
    solution: `<p><b>2.1.1</b> Which squares hold a queen: e.g. a set of (row, column) positions (0 to n queens), or an n×n Boolean board.</p>
<p><b>2.1.2</b> Place a queen on any empty square (if fewer than n queens are on the board), or remove a queen from an occupied square. Each move costs 1.</p>
<p><b>2.1.3</b> h(s) = (n − number of queens on the board) + number of pairs of queens that attack each other. h = 0 exactly at a goal.</p>
<p><b>2.1.4</b> 6 queens are placed, so the first term is 0. Attacking pairs: (1,3)–(3,1) diagonal; (3,1)–(3,6) same row; (3,6)–(4,5) diagonal; (3,6)–(5,4) diagonal; (4,5)–(5,4) diagonal; (5,2)–(5,4) same row. <b>h = 6.</b></p>
<p><b>2.1.5</b> Depth-first search (backtracking), placing one queen per column. Every solution is at the same known depth n, so DFS reaches solutions directly with memory O(n); BFS would store an enormous frontier for no benefit, and there is no path cost to optimise. Checking constraints as each queen is placed prunes bad branches early. (With a complete-state formulation, hill climbing / min-conflicts on h is also a good answer.)</p>`,
    notes: `<ul><li>Count attacking pairs carefully: same row, same column, or |Δrow| = |Δcolumn|. Each pair once.</li><li>Click squares in the simulation to test your own boards; the red lines show every attacking pair.</li></ul>`
  });
  P.push({
    id: 'e18-q22', group: G, code: '2018 Q2.2', title: 'DFS, BFS, hill climbing and A on the S–G graph', topic: 'Search', marks: '13 marks', keywords: 'depth first breadth first hill climbing A algorithm admissible',
    question: `<p>Directed graph: S→A (3), S→B (2), A→B (1), A→D (5), B→C (2), B→D (3), C→D (3), C→G (4), D→G (1). h: S 6, A 4, B 3, C 3, D 1, G 0. Ties alphabetical. 2.2.1 Path returned by DFS, BFS, greedy hill climbing and the A algorithm. 2.2.2 Is h admissible?</p>`,
    sim: { engine: 'graphSearch', directed: true, start: 'S', algos: ['dfs', 'bfs', 'hill', 'astar', 'ucs'], goalSets: [{ label: 'Goal G', goals: ['G'] }], w: 600, h: 300,
      nodes: { S: { x: 60, y: 150, h: 6 }, A: { x: 220, y: 60, h: 4 }, B: { x: 220, y: 240, h: 3 }, D: { x: 400, y: 60, h: 1 }, C: { x: 400, y: 240, h: 3 }, G: { x: 550, y: 150, h: 0 } },
      edges: [['S', 'A', 3], ['S', 'B', 2], ['A', 'B', 1], ['A', 'D', 5], ['B', 'C', 2], ['B', 'D', 3], ['C', 'D', 3], ['C', 'G', 4], ['D', 'G', 1]] },
    solution: `<table><thead><tr><th>Strategy</th><th>Path</th><th>Cost</th></tr></thead><tbody><tr><td>Depth-first</td><td>S-A-B-C-D-G</td><td>10</td></tr><tr><td>Breadth-first</td><td>S-A-D-G</td><td>9</td></tr><tr><td>Greedy hill climbing</td><td>S-B-D-G</td><td>6</td></tr><tr><td>A algorithm</td><td>S-B-D-G</td><td>6</td></tr></tbody></table>
<p>A trace: S(0+6) → [B(2+3=5), A(3+4=7)] → B → [D(5+1=6), A(7), C(4+3=7)] → D → [G(6+0=6), …] → G. Hill climbing: from S pick the child with the lowest h (B, 3), then D (1), then G.</p>
<p><b>2.2.2 Yes.</b> True costs to G: S 6, A 5 (A→B→D→G), B 4, C 4, D 1. Every h is ≤ these: 6 ≤ 6, 4 ≤ 5, 3 ≤ 4, 3 ≤ 4, 1 ≤ 1. (It is not consistent, since h(S) = 6 > 2 + h(B) = 5, but admissible is what A* needs here.)</p>`,
    notes: `<ul><li>DFS with alphabetical order dives S → A → B → C → D → G and returns the first goal it reaches, not the cheapest.</li><li>BFS returns the path with fewest edges among those removed first: S-A-D-G (3 edges) comes out before S-B-C-G and S-B-D-G.</li><li>The “A algorithm” is A* with f = g + h.</li></ul>`
  });
  const t18 = { A: [['', 'B'], ['', 'C'], ['', 'D']], B: [['', 'E'], ['', 'F'], ['', 'G']], C: [['', 'H'], ['', 'I'], ['', 'J']], D: [['', 'K'], ['', 'L'], ['', 'M']], E: [['', 3]], F: [['', 1], ['', 4], ['', 2]], G: [6, 2, 4, 1, 2].map(v => ['', v]), H: [['', 2]], I: [2, 5, 3].map(v => ['', v]), J: [4, 1, 5, 9, 8].map(v => ['', v]), K: [['', 4]], L: [4, 2, 3].map(v => ['', v]), M: [4, 2, 1, 1, 2].map(v => ['', v]) };
  P.push({
    id: 'e18-q23', group: G, code: '2018 Q2.3', title: 'Alpha-beta on a 27-leaf tree (also Test One Q3)', topic: 'Game trees', marks: '6 marks', keywords: 'alpha beta 27 leaves 3 1 4 2 6',
    question: `<p>MAX root A; MIN nodes B, C, D; MAX nodes E–M. Leaves: E: 3 · F: 1, 4, 2 · G: 6, 2, 4, 1, 2 · H: 2 · I: 2, 5, 3 · J: 4, 1, 5, 9, 8 · K: 4 · L: 4, 2, 3 · M: 4, 2, 1, 1, 2. Apply alpha-beta, mark all cuts, and give the maximum score MAX can obtain. (Test One adds: what is alpha-beta for, and which path should MAX follow?)</p>`,
    sim: { engine: 'alphaBeta', root: 'A', levelLabels: ['MAX', 'MIN', 'MAX', ''], spacing: 34, tree: t18 },
    solution: `<p>Values: E = 3, F = 4, G = 6, <b>B = 3</b>; H = 2, <b>C = 2</b> (I and J NOT VISITED); K = 4, L = 4, M = 4, <b>D = 4</b>; <b>A = 4</b>.</p>
<p>Cuts: F’s last leaf (2) — F reached 4 ≥ β = 3; G after its first leaf 6 (2, 4, 1, 2 cut); C → I and C → J (C = 2 ≤ α = 3); L after its first leaf 4 (4 ≥ β = 4; leaves 2, 3 cut); M after its first leaf 4 (2, 1, 1, 2 cut).</p>
<p><b>MAX can guarantee 4</b>, by moving A → D (then D → K, leaf 4). Alpha-beta’s purpose: return the same move and value as minimax while skipping branches that cannot change the decision, so deeper search fits in the same time.</p>`,
    notes: `<ul><li>Prune on equality too: at L the first leaf 4 equals β = 4, which already proves MIN at D will not let L’s value exceed 4.</li><li>Only 12 of the 27 leaves are examined.</li></ul>`
  });
  P.push({
    id: 'e18-q31', group: G, code: '2018 Q3.1', title: 'Semantic network: birds, eagles and planes', topic: 'Knowledge representation', marks: '8 marks', keywords: 'semantic network is a has inheritance boeing',
    question: `<p>Falcons and eagles are birds. All birds have wings, feathers and a beak. Eagles have light feathers and long beaks. Birds fly and use aerodynamic principles. Gliding is a principle used by eagles. Planes also fly, have wings and use aerodynamic principles. A plane has an engine and a pilot. Boeing 747 is a plane. Construct a semantic network.</p>`,
    sim: { engine: 'semnet', w: 780, h: 420, nodes: [
      { id: 'BIRD', label: 'Bird', x: 230, y: 160 }, { id: 'FAL', label: 'Falcon', x: 80, y: 300 }, { id: 'EAG', label: 'Eagle', x: 260, y: 320 }, { id: 'W', label: 'Wings', x: 420, y: 60 }, { id: 'F', label: 'Feathers', x: 80, y: 60 }, { id: 'BK', label: 'Beak', x: 230, y: 40 }, { id: 'FLY', label: 'Fly', x: 420, y: 160 }, { id: 'AER', label: 'Aerodynamic principles', x: 430, y: 250 }, { id: 'GL', label: 'Gliding', x: 420, y: 370 }, { id: 'LF', label: 'light', x: 110, y: 400, kind: 'val' }, { id: 'LB', label: 'long', x: 260, y: 400, kind: 'val' }, { id: 'PL', label: 'Plane', x: 640, y: 160 }, { id: 'EN', label: 'Engine', x: 700, y: 60 }, { id: 'PI', label: 'Pilot', x: 720, y: 260 }, { id: 'BO', label: 'Boeing 747', x: 640, y: 360, kind: 'inst' }],
      edges: [['FAL', 'BIRD', 'is a'], ['EAG', 'BIRD', 'is a'], ['BIRD', 'W', 'has'], ['BIRD', 'F', 'has'], ['BIRD', 'BK', 'has'], ['BIRD', 'FLY', 'can'], ['BIRD', 'AER', 'uses'], ['EAG', 'GL', 'uses'], ['GL', 'AER', 'is a'], ['EAG', 'LF', 'feathers'], ['EAG', 'LB', 'beak'], ['PL', 'FLY', 'can'], ['PL', 'W', 'has'], ['PL', 'AER', 'uses'], ['PL', 'EN', 'has'], ['PL', 'PI', 'has'], ['BO', 'PL', 'instance of']], legend: 'Eagle and Falcon inherit wings, feathers, beak, fly and aerodynamics from Bird; Eagle overrides feather and beak details.' },
    solution: `<p>Arcs: Falcon —is a→ Bird; Eagle —is a→ Bird; Bird —has→ Wings, Feathers, Beak; Bird —can→ Fly; Bird —uses→ Aerodynamic principles; Eagle —feathers→ light; Eagle —beak→ long; Eagle —uses→ Gliding; Gliding —is a→ aerodynamic principle; Plane —can→ Fly; Plane —has→ Wings, Engine, Pilot; Plane —uses→ Aerodynamic principles; Boeing 747 —instance of→ Plane.</p><p>Inheritance: Falcon and Eagle get every Bird property without repeating it; Boeing 747 inherits wings, engine, pilot and flight from Plane.</p>`,
    notes: `<ul><li>Shared nodes (Wings, Fly, Aerodynamic principles) link both hierarchies — that is the point of a network.</li><li>Values attached to a subclass (light feathers) override or refine the general property.</li></ul>`
  });
  P.push({
    id: 'e18-q32', group: G, code: '2018 Q3.2', title: 'Backward chaining: Jack is frustrated', topic: 'Logic & resolution', marks: '7 marks', keywords: 'coyote roadrunner beep-beep smart catches frustrated backward chaining',
    question: `<p>1. Every coyote chases some roadrunner. 2. Every roadrunner who says “beep-beep” is smart. 3. No coyote catches any smart roadrunner. 4. Any coyote who chases some roadrunner but does not catch it is frustrated. 5. Jack is a coyote. 6. Speedy is a roadrunner who says “beep-beep”. Convert to predicate logic and use backward chaining to prove “Jack is frustrated”.</p>`,
    sim: { engine: 'proof', clauseTitle: 'Rules and facts', stepTitle: 'Goal stack', clauses: [
      { id: '1', t: 'Coyote(x) → Roadrunner(r) ∧ Chases(x, r)   (some r)' }, { id: '2', t: 'Roadrunner(y) ∧ Says(y, beep) → Smart(y)' }, { id: '3', t: 'Coyote(x) ∧ Roadrunner(y) ∧ Smart(y) → ¬Catches(x, y)' }, { id: '4', t: 'Coyote(x) ∧ Roadrunner(y) ∧ Chases(x, y) ∧ ¬Catches(x, y) → Frustrated(x)' }, { id: '5', t: 'Coyote(Jack)' }, { id: '6a', t: 'Roadrunner(Speedy)' }, { id: '6b', t: 'Says(Speedy, beep)' }],
      steps: [
        { goals: ['Frustrated(Jack)'], uses: ['4'], text: 'Match the goal with the head of rule 4, {x/Jack}. Replace it by the rule’s conditions.' },
        { goals: ['Coyote(Jack)', 'Roadrunner(y)', 'Chases(Jack, y)', '¬Catches(Jack, y)'], uses: ['5'], text: 'Coyote(Jack) is fact 5 ✓.' },
        { goals: ['Roadrunner(y)', 'Chases(Jack, y)', '¬Catches(Jack, y)'], uses: ['6a'], text: 'Roadrunner(y): fact 6a with {y/Speedy} ✓.' },
        { goals: ['Chases(Jack, Speedy)', '¬Catches(Jack, Speedy)'], uses: ['1', '5'], text: 'Chases(Jack, Speedy): rule 1 says the coyote Jack chases a roadrunner; take that roadrunner to be Speedy (see the note in the solution) ✓.' },
        { goals: ['¬Catches(Jack, Speedy)'], uses: ['3'], text: '¬Catches(Jack, Speedy) is the head of rule 3 with {x/Jack, y/Speedy}: prove Coyote(Jack), Roadrunner(Speedy), Smart(Speedy).' },
        { goals: ['Smart(Speedy)'], uses: ['5', '6a', '2'], text: 'Coyote(Jack) ✓ (5), Roadrunner(Speedy) ✓ (6a). Smart(Speedy) is the head of rule 2: prove Roadrunner(Speedy) ✓ and Says(Speedy, beep).' },
        { goals: [], uses: ['6b'], text: 'Says(Speedy, beep) is fact 6b ✓. Every goal is proved: <b>Jack is frustrated.</b>' }] },
    solution: `<p><b>Predicate logic</b></p><ol><li>∀x Coyote(x) → ∃y (Roadrunner(y) ∧ Chases(x, y))</li><li>∀y Roadrunner(y) ∧ Says(y, beep) → Smart(y)</li><li>∀x∀y Coyote(x) ∧ Roadrunner(y) ∧ Smart(y) → ¬Catches(x, y)</li><li>∀x Coyote(x) ∧ ∃y (Roadrunner(y) ∧ Chases(x, y) ∧ ¬Catches(x, y)) → Frustrated(x)</li><li>Coyote(Jack)</li><li>Roadrunner(Speedy) ∧ Says(Speedy, beep)</li></ol>
<p><b>Backward chain</b>: Frustrated(Jack) ← rule 4 needs Coyote(Jack) [5], Roadrunner(Speedy) [6], Chases(Jack, Speedy) [1], ¬Catches(Jack, Speedy) ← rule 3 needs Coyote(Jack) [5], Roadrunner(Speedy) [6], Smart(Speedy) ← rule 2 needs Roadrunner(Speedy) and Says(Speedy, beep) [6]. All leaves are facts, so the goal holds.</p>
<div class="note">Strictly, rule 1 only says Jack chases <i>some</i> roadrunner — in clause form, Chases(Jack, f(Jack)) for a Skolem function f — and nothing says that roadrunner is Speedy or says beep-beep. The intended exam answer binds it to Speedy as above. A fully rigorous proof needs “every roadrunner says beep-beep” (the classic version of this puzzle), after which the chain works for f(Jack) itself.</div>`,
    notes: `<ul><li>Backward chaining = goal-driven: start from the goal, find a rule whose conclusion matches, and make its conditions the new goals until only facts remain.</li><li>Write the substitution at every match — markers look for {x/Jack}, {y/Speedy}.</li></ul>`
  });
  P.push({
    id: 'e18-q33', group: G, code: '2018 Q3.3', title: 'Clause form: hounds, cats, mice and light sleepers', topic: 'Logic & resolution', marks: '5+ marks', keywords: 'clause form skolem hound howl cat mouse light sleeper john',
    question: `<p>1. ∀x Hound(x) → Howl(x) · 2. ∀x∀y Have(x, y) ∧ Cat(y) → ¬∃z (Have(x, z) ∧ Mouse(z)) · 3. ∀x LightSleeper(x) → ¬∃y (Have(x, y) ∧ Howl(y)) · 4. ∃x Have(John, x) ∧ (Cat(x) ∨ Hound(x)). 3.3.1 Convert the statements to clause form. (The follow-up classically asks you to prove: if John is a light sleeper, John has no mice.)</p>`,
    sim: { engine: 'proof', clauses: [{ id: 'C1', t: '¬Hound(x) ∨ Howl(x)' }, { id: 'C2', t: '¬Have(x,y) ∨ ¬Cat(y) ∨ ¬Have(x,z) ∨ ¬Mouse(z)' }, { id: 'C3', t: '¬LightSleeper(x) ∨ ¬Have(x,y) ∨ ¬Howl(y)' }, { id: 'C4a', t: 'Have(John, a)' }, { id: 'C4b', t: 'Cat(a) ∨ Hound(a)' }, { id: 'N1', t: 'LightSleeper(John)   (negated goal)' }, { id: 'N2', t: 'Have(John, b)   (negated goal)' }, { id: 'N3', t: 'Mouse(b)   (negated goal)' }],
      steps: [
        { uses: ['C4b', 'C1'], text: 'Resolve C4b with C1 using {x/a}.', result: { id: 'R1', t: 'Cat(a) ∨ Howl(a)' } },
        { uses: ['R1', 'C3'], text: 'Resolve with C3 using {y/a}.', result: { id: 'R2', t: 'Cat(a) ∨ ¬LightSleeper(x) ∨ ¬Have(x,a)' } },
        { uses: ['R2', 'N1'], text: 'Resolve with N1 using {x/John}.', result: { id: 'R3', t: 'Cat(a) ∨ ¬Have(John,a)' } },
        { uses: ['R3', 'C4a'], text: 'Resolve with C4a.', result: { id: 'R4', t: 'Cat(a)' } },
        { uses: ['R4', 'C2'], text: 'Resolve with C2 using {y/a}.', result: { id: 'R5', t: '¬Have(x,a) ∨ ¬Have(x,z) ∨ ¬Mouse(z)' } },
        { uses: ['R5', 'C4a'], text: 'Resolve with C4a using {x/John}.', result: { id: 'R6', t: '¬Have(John,z) ∨ ¬Mouse(z)' } },
        { uses: ['R6', 'N2'], text: 'Resolve with N2 using {z/b}.', result: { id: 'R7', t: '¬Mouse(b)' } },
        { uses: ['R7', 'N3'], text: 'Resolve with N3.', result: { id: 'R8', t: '□ — so a light-sleeping John has no mice' } }] },
    solution: `<p><b>3.3.1 Clause form</b></p><ol><li>¬Hound(x) ∨ Howl(x)</li><li>¬(A ∧ B) → ¬∃z(…) becomes ¬Have(x, y) ∨ ¬Cat(y) ∨ ¬Have(x, z) ∨ ¬Mouse(z) — the ¬∃z turns into ∀z when the negation moves inward, so z stays a variable.</li><li>¬LightSleeper(x) ∨ ¬Have(x, y) ∨ ¬Howl(y)</li><li>∃x with nothing outside → Skolem constant a: <b>4a</b> Have(John, a), <b>4b</b> Cat(a) ∨ Hound(a).</li></ol>
<p><b>Follow-up proof</b>: goal LightSleeper(John) → ¬∃z (Have(John, z) ∧ Mouse(z)). Negated: LightSleeper(John) ∧ Have(John, b) ∧ Mouse(b) (fresh constant b), three clauses. Resolution: 4b+1 → Cat(a) ∨ Howl(a); +3, +N1, +4a → Cat(a); +2, +4a → ¬Have(John, z) ∨ ¬Mouse(z); +N2 → ¬Mouse(b); +N3 → □.</p>`,
    notes: `<ul><li>¬∃z P(z) ≡ ∀z ¬P(z): a negated existential needs <b>no</b> Skolem function.</li><li>A plain ∃ at the top level (statement 4) becomes a Skolem constant; split the conjunction into two clauses.</li></ul>`
  });
  P.push({
    id: 'e18-q4', group: G, code: '2018 Q4', title: 'Fruit sorting with an associative memory', topic: 'Neural networks', marks: '15 marks', keywords: 'BAM grapefruit pear texture shape weight associative memory missing feature',
    question: `<p>Sensors measure texture (rough/smooth), shape (round/not) and weight (≤ 0.45 kg / &gt; 0.45 kg). Grapefruit: rough, round, &gt; 0.45 kg. Pear: smooth, not round, ≤ 0.45 kg. The network must give the fruit type from the features, and the features from the type. 4.1 Which associative memory? 4.2 Two input–output pairs. 4.3 Train it. 4.4 If the shape sensor fails, is a pear still identified?</p>`,
    sim: { engine: 'bam', names: ['Grapefruit', 'Pear'], xLabels: ['texture', 'shape', 'weight'], yLabels: ['grapefruit', 'pear'], X: [[1, 1, 1], [-1, -1, -1]], Y: [[1, -1], [-1, 1]], probe: [-1, 0, -1] },
    solution: `<p><b>4.1</b> A <b>bidirectional associative memory (BAM)</b>: it stores hetero-associations (features ↔ fruit) and recalls in both directions, exactly what is required. (A Hopfield network is auto-associative only.)</p>
<p><b>4.2</b> Bipolar coding: rough / round / &gt; 0.45 kg = +1, the opposite = −1. Grapefruit X<sub>1</sub> = [1, 1, 1] ↔ Y<sub>1</sub> = [1, −1]; Pear X<sub>2</sub> = [−1, −1, −1] ↔ Y<sub>2</sub> = [−1, 1].</p>
<p><b>4.3</b> W = X<sub>1</sub><sup>T</sup>Y<sub>1</sub> + X<sub>2</sub><sup>T</sup>Y<sub>2</sub> = [[1,−1],[1,−1],[1,−1]] + [[1,−1],[1,−1],[1,−1]] = <b>[[2, −2], [2, −2], [2, −2]]</b>. Check: X<sub>2</sub>W = [−6, 6] → sign [−1, 1] = pear ✓; W·Y<sub>1</sub> = [4, 4, 4] → [1, 1, 1] = grapefruit features ✓.</p>
<p><b>4.4 Yes.</b> Enter the unknown shape as 0: X = [−1, 0, −1]. XW = [−4, 4] → [−1, 1] = pear. The two working sensors still agree, and the stored patterns are far apart (they differ in all 3 features), so one missing value cannot flip the result.</p>`,
    notes: `<ul><li>Associative memories tolerate noisy or incomplete input — that is the property 4.4 tests.</li><li>Use 0 for “unknown” in bipolar coding: it contributes nothing to the weighted sum.</li></ul>`
  });
  P.push({
    id: 'e18-q5', group: G, code: '2018 Q5', title: 'GA: sharing coins equally among four nephews', topic: 'Genetic algorithms', marks: '15 marks', keywords: 'coins nephews R5 R7 R8 R10 R16 chromosome fitness',
    question: `<p>7 × R5, 5 × R7, 9 × R8, 6 × R10 and 3 × R16 coins must be shared among four nephews as equally as possible. 5.1 Chromosome. 5.2 Fitness. 5.3 Selection. 5.4 Mutation and crossover.</p>`,
    sim: { engine: 'ga', kind: 'coins', pop: 40, gens: 120, pc: 0.9, pm: 0.4 },
    solution: `<p>Total value = 7·5 + 5·7 + 9·8 + 6·10 + 3·16 = 35 + 35 + 72 + 60 + 48 = <b>R250</b>, so the ideal share is R62.50 each (not reachable with whole coins; the best is 62, 62, 63, 63).</p>
<p><b>5.1</b> List the 30 coins in a fixed order; the chromosome is a string of 30 genes, gene i ∈ {1, 2, 3, 4} = the nephew who gets coin i. Example: 1234123412… Every chromosome gives every coin to exactly one nephew, so all are valid.</p>
<p><b>5.2</b> V<sub>k</sub> = total value given to nephew k. Minimise the spread D = Σ<sub>k</sub> |V<sub>k</sub> − 62.5| (or max V − min V); as a fitness to maximise use f = 1 / (1 + D). Best possible D = 2.</p>
<p><b>5.3</b> Tournament selection (pick 3 at random, keep the best) or roulette wheel on f. Add elitism so the best allocation is never lost.</p>
<p><b>5.4</b> Mutation: pick a random coin and give it to a different random nephew. Crossover: single point — child 1 takes genes 1…c from parent 1 and c+1…30 from parent 2, child 2 the reverse. Both operators keep every chromosome valid.</p>`,
    notes: `<ul><li>Fixing the coin order in the chromosome is what makes crossover safe: position i always means the same coin.</li><li>Run the simulation — the fitness shown is D, so lower is better; the optimum D = 2 is usually found within 100 generations.</li></ul>`
  });
})(window.AIN);

/* ---- data/05-tests-mock.js ---- */
(function (A) {
  const P = A.problems;
  const G = 'Test One & quiz reviews';
  const W = 'ABLE ACHE ACID ACRE AGED AIDE ALSO AREA ARMY AWAY BABY BACK BAKE BALD BALE BALL BAND BANK BARE BARK BARN BASE BATH BEAM BEAN BEAR BEAT BEEF BEEN BEER BELL BELT BEND BEST BIKE BILL BIND BIRD BITE BLOW BLUE BOAT BODY BOIL BOLD BOLT BOND BONE BOOK BOOT BORE BORN BOSS BOTH BOWL BULK BULL BURN BUSY CAFE CAGE CAKE CALF CALL CALM CAME CAMP CARD CARE CART CASE CASH CAST CAVE CELL CHAT CHIP CITY CLAY CLUB COAL COAT CODE COIN COLD COLE COME COOK COOL COPE COPY CORD CORE CORN COST CREW CROP CURE DALE DAME DARE DARK DATA DATE DAWN DEAL DEAR DEBT DECK DEEP DEER DESK DIAL DICE DIET DIME DINE DIRT DISH DIVE DOCK DOLL DOME DONE DOOR DOSE DOVE DOWN DRAG DRAW DROP DRUM DUAL DUCK DULL DUST DUTY EACH EARN EASE EAST EASY EDGE ELSE EVEN EVER FACE FACT FADE FAIL FAIR FAKE FALL FAME FARE FARM FAST FATE FEAR FEED FEEL FEET FELL FELT FILE FILL FILM FIND FINE FIRE FIRM FISH FIVE FLAG FLAT FLOW FOAM FOIL FOLD FOLK FOND FOOD FOOL FOOT FORD FORK FORM FORT FOUL FOUR FREE FROG FROM FUEL FULL FUND GAIN GALE GAME GATE GAVE GEAR GIFT GIRL GIVE GLAD GOAL GOAT GOES GOLD GOLF GONE GOOD GRAB GRAY GREW GRIP GROW GULF HAIL HAIR HALE HALF HALL HAND HANG HARD HARM HATE HAVE HEAD HEAL HEAP HEAR HEAT HELD HELL HELP HERB HERD HERE HERO HIDE HIGH HILL HINT HIRE HOLD HOLE HOLY HOME HOOD HOOK HOPE HORN HOSE HOST HOUR HUGE HUNG HUNT HURT IDEA INCH IRON ITEM JAIL JOIN JOKE JUMP JURY JUST KEEN KEEP KEPT KICK KIND KING KISS KITE KNEE KNEW KNOW LACE LACK LADY LAID LAKE LAMB LAMP LAND LANE LAST LATE LAWN LAZY LEAD LEAF LEAN LEFT LEND LESS LIFE LIFT LIKE LIME LINE LINK LION LIST LIVE LOAD LOAN LOCK LOFT LOGO LONG LOOK LOOP LORD LOSE LOSS LOST LOUD LOVE LUCK LUNG MADE MAIL MAIN MAKE MALE MALL MANY MARK MASK MASS MATE MEAL MEAN MEAT MEET MELT MEMO MENU MERE MILD MILE MILK MILL MIND MINE MISS MODE MOLE MOOD MOON MORE MOST MOVE MUCH MUST NAME NAVY NEAR NEAT NECK NEED NEST NEWS NEXT NICE NINE NODE NONE NOON NOSE NOTE OPEN OVEN OVER PACE PACK PAGE PAID PAIL PAIN PAIR PALE PALM PARK PART PASS PAST PATH PEAK PEAR PEEL PICK PILE PINE PINK PIPE PLAN PLAY PLOT PLUG PLUS POEM POET POLE POLL POND POOL POOR PORK PORT POSE POST POUR PULL PUMP PURE PUSH RACE RAGE RAIL RAIN RANK RARE RATE READ REAL REAR RELY REST RICE RICH RIDE RING RISE RISK ROAD ROCK ROLE ROLL ROOF ROOM ROOT ROPE ROSE RULE RUSH SAFE SAGA SAGE SAID SAIL SAKE SALE SALT SAME SAND SANE SAVE SEAL SEAT SEED SEEK SEEM SEEN SELF SELL SEND SENT SHIP SHOE SHOP SHOT SHOW SHUT SICK SIDE SIGN SILK SING SINK SITE SIZE SKIN SLIP SLOW SNOW SOAP SOFT SOIL SOLD SOLE SOME SONG SOON SORT SOUL SOUP SPOT STAR STAY STEP STOP SUCH SUIT SURE SWIM TAIL TAKE TALE TALK TALL TANK TAPE TASK TEAM TEAR TELL TEND TENT TERM TEST TEXT THAN THAT THEM THEN THEY THIN THIS TIDE TIDY TIED TILE TIME TINY TIRE TOLD TOLL TONE TOOK TOOL TOUR TOWN TRAP TREE TRIP TRUE TUBE TUNE TURN TWIN TYPE UNIT UPON USED USER VAST VERY VIEW VOTE WADE WAGE WAIT WAKE WALK WALL WANT WARD WARM WARN WASH WAVE WEAK WEAR WEEK WELL WENT WERE WEST WHAT WHEN WHOM WIDE WIFE WILD WILL WIND WINE WING WIRE WISE WISH WITH WOLF WOOD WOOL WORD WORE WORK YARD YEAR ZONE'.split(' ');
  P.push({
    id: 't1-dmaze', group: G, code: 'Test One Q1', title: 'Maze with diamonds: formulate the search problem', topic: 'State-space formulation', marks: '20 marks', keywords: 'maze diamonds state space goal test actions depth breadth heuristic environment',
    question: `<p>An agent walks through an m × n maze (walls shown as thick lines) from IN (A1) to OUT (F6), and should pick up as many hidden diamonds as possible (here at E1, B2 and B6). 1.1 Define (i) the state space, (ii) the goal test, (iii) the actions. 1.2 Maximum depth and breadth of the search tree in terms of m and n. 1.3 A heuristic, and whether it is admissible. 1.4 Classify the environment.</p>`,
    sim: { engine: 'diamondMaze', diamonds: [[0, 4], [1, 1], [5, 1]], walls: ['0,0|1,0', '0,1|1,1', '1,0|1,1', '1,1|1,2', '1,2|2,2', '0,3|1,3', '0,4|1,4', '1,3|1,4', '2,3|2,4', '1,5|2,5', '2,4|2,5', '3,4|3,5', '3,4|4,4', '2,0|3,0', '3,0|3,1', '4,0|4,1', '4,3|5,3', '4,4|5,4', '4,5|5,5', '5,1|5,2'] },
    solution: `<p><b>1.1 (i) State</b>: (row, column, D) where D records which diamonds have been collected (e.g. a bit per diamond). The memo’s (x, y, z) with z = “a jewel is here” is weaker: whether a jewel is still at a square depends on whether you already took it, so the collected set must be in the state. State space: m·n·2<sup>k</sup> states for k diamonds. <b>(ii) Goal test</b>: the agent is on the exit cell (and, if all diamonds are required, D = all collected). <b>(iii) Actions</b>: move Up, Down, Left or Right into an adjacent cell not separated by a wall (8 directions if diagonals are allowed); picking up happens automatically when entering a diamond cell.</p>
<p><b>1.2</b> With cycle checking a path visits each cell at most once, so the maximum depth is m·n − 1 moves (more if revisiting is needed to collect diamonds, at most m·n·2<sup>k</sup>). Each state has at most 4 children (3 if you exclude going back), so the breadth at depth d is at most 4·3<sup>d−1</sup>. (The course memo gives depth n(m − 1) and breadth C(m + n − 2, n − 1), the number of monotone corner-to-corner paths — quote it if your lecturer expects it, but justify whichever you use.)</p>
<p><b>1.3</b> Manhattan distance |r − r<sub>exit</sub>| + |c − c<sub>exit</sub>| for 4-direction moves (diagonal distance max(Δr, Δc) if diagonals are allowed). Admissible: each move changes the row or the column by one, so you need at least that many moves; walls can only make the route longer.</p>
<p><b>1.4</b> Fully observable if the agent knows the map (as this formulation assumes; partially observable if it only sees adjacent cells), deterministic (a move always lands where intended), sequential (each move changes what is reachable next — the memo says episodic, but AIMA would call this sequential), static, discrete, known.</p>`,
    notes: `<ul><li>Run the simulation: BFS on (row, col) finds the exit quickly, but collecting all three diamonds needs the state (row, col, collected) — the same square is visited in different states.</li><li>Walk the agent with the arrow buttons and watch the state tuple change.</li></ul>`
  });
  P.push({
    id: 't1-moor', group: G, code: 'Quiz Q1 (2020)', title: 'Moor traversal: states, goal test, actions', topic: 'State-space formulation', marks: '7.5 marks', keywords: 'moor swamp traversal formulate state goal actions',
    question: `<p>An n × m matrix A of dry land / water patches and an entry row r. Find a path from (r, 0) on the left edge to any dry patch on the right edge, only over dry land, moving right to an adjacent patch (diagonally up, horizontally, diagonally down), never vertically and never off the top or bottom. Define (i) the state space, (ii) the goal test, (iii) the actions.</p>`,
    sim: { engine: 'swampLab', rows: 5, cols: 7, entry: 1, dry: ['.#.....', '...#...', '.#.#.#.', '..#..#.', '##....#'] },
    solution: `<p><b>(i) State</b>: the walker’s current position (i, j) — row and column. The matrix A never changes, so it does not belong in each state (the memo’s “the whole matrix with the person marked” works but stores far more than needed). Start state (r, 0). State space: all dry cells (i, j).</p>
<p><b>(ii) Goal test</b>: j = m − 1 (the walker is on a dry patch in the rightmost column).</p>
<p><b>(iii) Actions</b> from (i, j): to (i − 1, j + 1), (i, j + 1) or (i + 1, j + 1), each allowed only if the target is inside the matrix (0 ≤ i ± 1 &lt; n, j + 1 &lt; m) and is dry land (a<sub>i,j+1</sub> = dry).</p>`,
    notes: `<ul><li>The state holds only what changes; fixed problem data (the map) lives in the problem, not the state.</li><li>Because every move increases j by 1, every path has exactly m − 1 moves and there are no cycles.</li></ul>`
  });
  const ln = 'ABCDEFGHIJKL', kind = { B: 'tunnel', D: 'water', G: 'tunnel', J: 'water' }, cst = n => kind[n] === 'tunnel' ? 6 : kind[n] === 'water' ? 4 : 1;
  const tN = {}, tE = [], tC = [[], [], []], tP = {};
  [...ln].forEach((n, i) => { const r = Math.floor(i / 4), c = i % 4; tN[n] = { h: (2 - r) + (3 - c) }; tP[n] = [r, c]; tC[r].push({ n, t: n, cls: kind[n] || '' }); if (c < 3) tE.push([n, ln[i + 1], cst(n)]); if (r < 2) tE.push([n, ln[i + 4], cst(n)]); });
  P.push({
    id: 't1-tunnel', group: G, code: 'Test One Q3', title: 'A* through water and tunnel squares (A to L)', topic: 'Search', marks: '15 marks', keywords: 'water tunnel cost from square manhattan frontier after solution',
    question: `<p>3×4 grid A B C D / E F G H / I J K L. B and G are tunnels, D and J are water. Moves: right or down only. Cost of leaving a square: normal 1, water 4, tunnel 6 (so D → H costs 4). h = Manhattan distance to L (A = 5). Alphabetical ties. Give the path found by A*, its cost, which paths are on the frontier when the solution is found, and whether h is admissible.</p>`,
    sim: { engine: 'graphSearch', directed: true, start: 'A', algos: ['astar', 'ucs'], goalSets: [{ label: 'Goal L', goals: ['L'] }], render: 'grid', sep: '-', nodes: tN, edges: tE, grid: { rows: 3, cols: 4, cell: 70, cells: tC, pos: tP } },
    solution: `<p><b>Path A-E-F-J-K-L, cost 8</b> (1 + 1 + 1 + 4 + 1). Your answers to 1) and 2) were right.</p>
<p><b>Frontier when the solution is removed</b> (standard A*: tree search, goal tested on removal): A-E-I-J-K-L(8), A-B-C(10), A-B-F(10), A-E-F-G-H(10), A-E-F-G-K(10).</p>
<p>The key in your review accepts <b>A-E-F-J-K, A-E-F-G-K, A-E-F-G-H, A-B-F, A-B-C</b>. Four of those match the trace; for the fifth the key lists A-E-F-J-K where the standard trace has the I-branch copy A-E-I-J-K-L. With multiple-path pruning (J and K are not expanded twice) the I-branch adds nothing and the frontier is just A-B-C, A-B-F, A-E-F-G-H, A-E-F-G-K. For the quiz, tick the key’s five; A-B-F-G was never generated (B is a tunnel, so A-B-F costs 7 and is never expanded).</p>
<p><b>Admissible: yes.</b> Every move costs at least 1 and moves exactly one square closer at best, so the Manhattan distance never exceeds the true cost; water and tunnels only add cost.</p>`,
    notes: `<ul><li>Cost depends on the square you leave, not the one you enter — read that rule twice.</li><li>Paths that reach the same square with the same f appear twice in tree search (A-E-F-J and A-E-I-J here).</li></ul>`
  });
  P.push({
    id: 't1-discs', group: G, code: 'Test One Q2', title: 'Eight discs: odds and evens', topic: 'State-space formulation', marks: '20 marks', keywords: 'discs piles odd even data structure successor goal test heuristic admissible reachable states',
    question: `<p>Discs 1–8 are piled on centre circle E (1 on top, 8 at the bottom). Circles A and C are the “odd” side, B and D the “even” side. Move one top disc at a time onto another pile, never onto a smaller number and never odd onto even (or even onto odd). Goal: all odd discs on A/C and all even discs on B/D. 1. Data structure. 2. Example state. 3. Successor algorithm. 4. States reachable from the start. 5. Goal test. 6. Heuristic. 7. Is it admissible?</p>`,
    sim: { engine: 'discs' },
    solution: `<p><b>1.</b> Five stacks (lists, bottom → top), one per circle: state = (A, B, C, D, E).</p>
<p><b>2.</b> Start: A = [], B = [], C = [], D = [], E = [8, 7, 6, 5, 4, 3, 2, 1]. Another state: A = [5, 3], B = [4], C = [1], D = [2], E = [8, 7, 6].</p>
<p><b>3. Successors</b>:</p><pre>for src in piles where src is not empty:
    d = top(src)
    for dst in piles, dst != src:
        if dst is empty or (top(dst) > d and top(dst) % 2 == d % 2):
            yield copy of state with d moved from src to dst</pre>
<p><b>4.</b> 20,649 states are reachable from the start (found by breadth-first search in the simulation). The start itself has 4 successors (disc 1 to A, B, C or D).</p>
<p><b>5. Goal test</b>: E is empty, every disc on A and C is odd, and every disc on B and D is even.</p>
<p><b>6. Heuristic</b>: h = number of discs not yet on a circle of their own side (still on E, or odd on B/D, or even on A/C). Start h = 8.</p>
<p><b>7. Admissible</b>: one move relocates exactly one disc, so it can fix at most one misplaced disc and h drops by at most 1 per move of cost 1 — h never exceeds the moves still needed. (The real minimum from the start is 14 moves; h = 8 ≤ 14.)</p>`,
    notes: `<ul><li>An odd disc may still be put on an empty even circle — the rules only forbid stacking odd on even. That is why “wrong side” must count in h.</li><li>Play it in the simulation (click a pile, then a target pile), then let A* show the 14-move solution.</li></ul>`
  });
  P.push({
    id: 't1-graph11', group: G, code: 'Test One Q3 (graph)', title: 'Hill climbing and the A algorithm (S, h = 11)', topic: 'Search', marks: '9 marks', keywords: 'hill climbing A algorithm admissible undirected',
    question: `<p>Undirected graph: S–B 2, S–C 1, S–D 3, B–E 7, E–F 1, E–G 2, F–G 3, C–G 15, D–G 14. h: S 11, B 7, C 10, D 5, E 1, F 1, G 0. 3.1 Order of nodes visited by hill climbing. 3.2 Order visited by the A algorithm. 3.3 Is the heuristic admissible?</p>`,
    sim: { engine: 'graphSearch', directed: false, start: 'S', algos: ['hill', 'astar', 'greedy', 'ucs'], goalSets: [{ label: 'Goal G', goals: ['G'] }], w: 560, h: 420,
      nodes: { S: { x: 280, y: 40, h: 11 }, B: { x: 110, y: 130, h: 7 }, C: { x: 280, y: 140, h: 10 }, D: { x: 450, y: 140, h: 5 }, E: { x: 110, y: 250, h: 1 }, F: { x: 110, y: 370, h: 1 }, G: { x: 280, y: 370, h: 0 } },
      edges: [['S', 'B', 2], ['S', 'C', 1], ['S', 'D', 3], ['B', 'E', 7], ['E', 'F', 1], ['E', 'G', 2], ['F', 'G', 3], ['C', 'G', 15], ['D', 'G', 14]] },
    solution: `<p><b>3.1 Hill climbing</b>: S (h 11) → best child D (h 5) → its best child G (h 0). Order <b>S, D, G</b>; path S-D-G costs 17.</p>
<p><b>3.2 A algorithm</b>:</p><pre>S(0+11)  [D(3+5=8), B(2+7=9), C(1+10=11)]
D(8)     [B(9), C(11), S-D-G(17+0=17)]
B(9)     [E(9+1=10), C(11), G(17)]
E(10)    [C(11), F(10+1=11), S-B-E-G(11+0=11), G(17)]
C(11)    [F(11), G(11), S-C-G(16), G(17)]
F(11)    [G(11), S-B-E-F-G(13), G(16), G(17)]
G(11)    goal</pre><p>Order <b>S, D, B, E, C, F, G</b>; path <b>S-B-E-G, cost 11</b> (the optimum).</p>
<p><b>3.3 Admissible: yes.</b> True costs to G: S 11, B 9, C 12, D 14, E 2, F 3. Each h is at most that: 11 ≤ 11, 7 ≤ 9, 10 ≤ 12, 5 ≤ 14, 1 ≤ 2, 1 ≤ 3. (Not consistent: h(S) = 11 > c(S, D) + h(D) = 8 — which is why A* pops D first and then has to come back.)</p>`,
    notes: `<ul><li>Hill climbing keeps no frontier: once it commits to D it never reconsiders, and returns the expensive path.</li><li>At f = 11 three entries tie (C, F, G): alphabetical order removes C, then F, then G.</li></ul>`
  });
  P.push({
    id: 't1-ladder', group: G, code: 'Test One Q2 (words)', title: 'Word ladder: FOOL to SAGE', topic: 'State-space formulation', marks: '9 marks', keywords: 'word ladder state legal moves heuristic BFS',
    question: `<p>Transform FOOL into SAGE by changing one letter at a time; every intermediate must be a real word. 2.1 What is the state? 2.2 Legal moves. 2.3 A heuristic. 2.4 Which search technique, and why?</p>`,
    sim: { engine: 'wordLadder', words: W },
    simIntro: 'This page carries a small list of about 600 common four-letter words, so some real ladders may be missing.',
    solution: `<p><b>2.1</b> The current word (a string of 4 letters). The goal word and the dictionary are fixed problem data.</p>
<p><b>2.2</b> Replace one letter at one position by a different letter so that the result is a valid dictionary word (and not already on the path). Each move costs 1.</p>
<p><b>2.3</b> h(w) = number of positions where w differs from the goal. h(FOOL) = 4 (F≠S, O≠A, O≠G, L≠E). Admissible: one move changes one letter, so it can fix at most one position.</p>
<p><b>2.4</b> Every move costs the same, so <b>breadth-first search</b> finds the ladder with the fewest steps (optimal and complete). A* with the letter-difference heuristic finds the same ladder while expanding fewer words. DFS is a poor choice: not optimal and can wander far. A classic answer: FOOL → POOL → POLL → POLE → PALE → SALE → SAGE (6 steps).</p>`,
    notes: `<ul><li>The successor function needs the dictionary: generate all 4 × 25 one-letter changes and keep only real words.</li><li>Try other pairs in the simulation, e.g. COLD → WARM.</li></ul>`
  });
  const tn = { Start: [275, 50], A: [275, 165], W: [175, 165], B: [500, 165], C: [500, 90], R2: [400, 90], R3: [590, 90], D: [500, 280], E: [650, 280], R5: [650, 440], F: [275, 330], G: [385, 330], R4: [385, 255], H: [385, 425], I: [535, 425], T1: [535, 360], J: [535, 610], T5: [415, 610], P: [35, 50], R1: [140, 50], Q: [35, 410], M: [175, 410], N: [245, 410], T2: [245, 475], L: [175, 560], T3: [95, 560], K: [315, 560], R6: [315, 490], R7: [315, 650], T4: [35, 650] };
  const tnodes = {}; for (const k in tn) tnodes[k] = { x: tn[k][0], y: tn[k][1], kind: k[0] === 'T' && k.length === 2 ? 'diamond' : k[0] === 'R' && k.length === 2 ? '' : 'box' };
  const tedges = [['Start', 'A', 4], ['W', 'A', 6], ['A', 'B', 14], ['A', 'F', 8], ['F', 'G', 8], ['G', 'R4', 4], ['G', 'H', 6], ['H', 'I', 8], ['I', 'T1', 2], ['I', 'J', 10], ['J', 'T5', 10], ['B', 'C', 3], ['C', 'R2', 6], ['C', 'R3', 4], ['B', 'D', 6], ['D', 'E', 8], ['E', 'R5', 10], ['W', 'M', 12], ['P', 'R1', 6], ['P', 'Q', 18], ['Q', 'M', 7], ['Q', 'T4', 16], ['M', 'N', undefined], ['N', 'T2', 4], ['M', 'L', 8], ['L', 'T3', 1], ['L', 'K', 10], ['K', 'R6', 4], ['K', 'R7', 6]];
  const cost = (a, b) => { const e = tedges.find(x => (x[0] === a && x[1] === b) || (x[0] === b && x[1] === a)); return e && e[2] !== undefined ? e[2] : 0; };
  const order = { Start: ['A'], A: ['Start', 'B', 'F', 'W'], B: ['C', 'D', 'A'], C: ['R3', 'B', 'R2'], D: ['B', 'E'], E: ['R5', 'D'], F: ['A', 'G'], G: ['R4', 'H', 'F'], H: ['G', 'I'], I: ['T1', 'J', 'H'], J: ['I', 'T5'], W: ['A', 'M'], M: ['W', 'N', 'L', 'Q'], N: ['T2', 'M'], L: ['M', 'K', 'T3'], K: ['R6', 'R7', 'L'], Q: ['P', 'M', 'T4'], P: ['R1', 'Q'] };
  P.push({
    id: 't1-treasure', group: G, code: 'Test One Q1 (tomb)', title: 'Treasure map: breadth-first search with OPEN', topic: 'Search', marks: '5 marks', keywords: 'treasure tomb BFS OPEN north east south west rooms',
    question: `<p>Corridors join intersections (letters), normal rooms R1–R7 and treasure rooms T1–T5. From Start, use breadth-first search to reach any treasure room. Show the OPEN list at each step and list the rooms found before the treasure room. At each intersection explore North, East, South, West in that order.</p>`,
    sim: { engine: 'graphSearch', directed: false, order: 'given', adj: Object.fromEntries(Object.entries(order).map(([k, v]) => [k, v.map(n => [n, cost(k, n)])])), start: 'Start', algos: ['bfs', 'dfs'], goalSets: [{ label: 'Any treasure T1–T5', goals: ['T1', 'T2', 'T3', 'T4', 'T5'] }], nodesOnly: true, w: 700, h: 690, r: 17, showH: false, stepCosts: false, nodes: tnodes, edges: tedges },
    solution: `<pre>OPEN (paths written by their last node; goal tested when removed)
1  [Start]
2  [A]
3  [B, F, W]
4  [F, W, C, D]
5  [W, C, D, G]
6  [C, D, G, M]
7  [D, G, M, R3, R2]
8  [G, M, R3, R2, E]
9  [M, R3, R2, E, R4, H]
10 [R3, R2, E, R4, H, N, L, Q]
11 [R2, E, R4, H, N, L, Q]          R3 is a room, not treasure
12 [E, R4, H, N, L, Q]              R2 room
13 [R4, H, N, L, Q, R5]
14 [H, N, L, Q, R5]                 R4 room
15 [N, L, Q, R5, I]
16 [L, Q, R5, I, T2]
17 [Q, R5, I, T2, K, T3]
18 [R5, I, T2, K, T3, P, T4]
19 [I, T2, K, T3, P, T4]            R5 room
20 [T2, K, T3, P, T4, T1, J]
21 T2 removed: treasure found</pre><p>Path: <b>Start, A, W, M, N, T2</b> (length 4 + 6 + 12 + M–N + 4). Rooms found before the treasure room: <b>R3, R2, R4, R5</b>.</p>`,
    notes: `<ul><li>BFS keeps OPEN as a queue: new paths join the back, in N-E-S-W order; the oldest path leaves first.</li><li>Never go back along the corridor you came in by (that would revisit the parent).</li><li>BFS finds the treasure with the fewest corridors (5), not the shortest length — T1 is closer in metres but deeper in the tree.</li></ul>`
  });
  P.push({
    id: 't1-akgraph', group: G, code: 'Test One Q1 (A–K)', title: 'DFS, best-first, hill climbing and A (goals K and I)', topic: 'Search', marks: '15 marks', keywords: 'A B C D E F G H I J K h=80 h=35 costs 10 admissible optimal',
    question: `<p>Tree: A (h 3) → B (5), C (80), D (35); B → E (5), F (20), G (10); E → J (0); G → K (0, goal); D → H (30), I (0, goal). Every connection costs 10. Ties alphabetical. 1.1 Order of nodes visited by DFS, best-first, hill climbing and the A algorithm. 1.2 Which finds the optimal path? 1.3 Is h admissible?</p>`,
    sim: { engine: 'graphSearch', directed: true, start: 'A', algos: ['dfs', 'greedy', 'hill', 'astar', 'bfs'], goalSets: [{ label: 'Goals K, I', goals: ['K', 'I'] }], w: 640, h: 330,
      nodes: { A: { x: 330, y: 40, h: 3 }, B: { x: 160, y: 140, h: 5 }, C: { x: 330, y: 140, h: 80 }, D: { x: 500, y: 140, h: 35 }, E: { x: 70, y: 240, h: 5 }, F: { x: 160, y: 240, h: 20 }, G: { x: 250, y: 240, h: 10 }, H: { x: 450, y: 240, h: 30 }, I: { x: 560, y: 240, h: 0 }, J: { x: 70, y: 310, h: 0 }, K: { x: 250, y: 310, h: 0 } },
      edges: [['A', 'B', 10], ['A', 'C', 10], ['A', 'D', 10], ['B', 'E', 10], ['B', 'F', 10], ['B', 'G', 10], ['E', 'J', 10], ['G', 'K', 10], ['D', 'H', 10], ['D', 'I', 10]] },
    solution: `<table><thead><tr><th>Strategy</th><th>Visited</th><th>Path (cost)</th></tr></thead><tbody>
<tr><td>Depth-first</td><td>A, B, E, J, F, G, K</td><td>A-B-G-K (30)</td></tr>
<tr><td>Best-first (greedy on h)</td><td>A, B, E, J, G, K</td><td>A-B-G-K (30)</td></tr>
<tr><td>Hill climbing</td><td>A — stuck (every child has h &gt; 3)</td><td>none</td></tr>
<tr><td>A algorithm</td><td>A, B, E, G, J, K</td><td>A-B-G-K (30)</td></tr></tbody></table>
<p>Hill climbing that only moves to a <i>better</i> neighbour stops at A, a local minimum. If your lecturer’s version always moves to the best child, it goes A → B → E → J and dies at the dead end J — either way it fails.</p>
<p><b>1.2</b> The optimal path is <b>A-D-I, cost 20</b>. None of the four finds it (breadth-first would). A* misses it because h is not admissible.</p>
<p><b>1.3 No.</b> h(D) = 35 but D is only 10 away from goal I, so h overestimates at D. That keeps D (f = 45) behind B’s subtree until K is found at cost 30. (h(C) = 80 is harmless: C is a dead end with true cost ∞.)</p>`,
    notes: `<ul><li>A* is optimal only with an admissible h — this question is built to show the failure.</li><li>Check admissibility node by node against the true cost to the <i>nearest</i> goal.</li></ul>`
  });
  P.push({
    id: 't1-jugs', group: G, code: 'Test One Q2 (jugs)', title: 'Water jugs: 1 litre with the least water drawn', topic: 'State-space formulation', marks: '10 marks', keywords: 'water jugs 3 litre 5 litre state goal actions heuristic uniform cost',
    question: `<p>A 3-litre and a 5-litre jug start empty. Get exactly 1 litre in one jug with the other empty, drawing as little water from the source as possible. Actions: fill a jug from the source, empty a jug, pour one jug into the other until it is empty or the other is full. Define 2.1 the state space, 2.2 the goal test, 2.3 the actions, 2.4 a heuristic.</p>`,
    sim: { engine: 'jugs', caps: [3, 5] },
    solution: `<p><b>2.1</b> State (x, y): litres in the 3 L jug (0–3) and in the 5 L jug (0–5) — 4 × 6 = 24 states. Start (0, 0).</p>
<p><b>2.2</b> Goal: (1, 0) or (0, 1).</p>
<p><b>2.3</b> Fill3: (x, y) → (3, y), cost 3 − x. Fill5: → (x, 5), cost 5 − y. Empty3: → (0, y), cost 0. Empty5: → (x, 0), cost 0. Pour3→5: t = min(x, 5 − y), → (x − t, y + t), cost 0. Pour5→3: t = min(y, 3 − x), → (x + t, y − t), cost 0. Path cost = total water drawn.</p>
<p><b>2.4</b> h(x, y) = 0 if x + y ≥ 1, otherwise 1 (you must draw at least one litre before you can hold one). Admissible but weak; since most actions cost 0, uniform-cost search is a fine choice here. Optimal plan: fill 3 → pour into 5 → fill 3 → pour into 5 (leaves 1 in the 3 L jug) → empty 5 = <b>6 litres</b> drawn.</p>`,
    notes: `<ul><li>Cost is “water drawn”, not number of moves — so emptying and pouring are free and UCS (not BFS) gives the optimum.</li><li>Arithmetic check: 2 × 3 − 5 = 1 needs 6 L; 2 × 5 − 3 × 3 = 1 needs 10 L.</li></ul>`
  });
  P.push({
    id: 't1-clyde', group: G, code: 'Test One Q4–5', title: 'Semantic network (Clyde) and a conceptual graph (Mary and Tom)', topic: 'Knowledge representation', marks: '7 marks', keywords: 'semantic network cylinder elephant trunk Clyde conceptual graph Mary marry sailor Tom',
    question: `<p>Q4: A physical object such as a cylinder has a length and colour. An animal has a set of legs, each of which is a cylinder. An elephant has a trunk, which is a cylinder and has a length of 1.4 m. Clyde is an elephant. His trunk is pink. Construct a semantic network. Q5: Draw a conceptual graph for “Mary wants to marry the sailor, Tom.”</p>`,
    sims: [{ engine: 'semnet', title: 'Q4 semantic network', w: 760, h: 400, nodes: [
      { id: 'PO', label: 'Physical object', x: 130, y: 50 }, { id: 'LEN', label: 'Length', x: 40, y: 150, kind: 'val' }, { id: 'COL', label: 'Colour', x: 230, y: 150, kind: 'val' }, { id: 'CYL', label: 'Cylinder', x: 380, y: 50 }, { id: 'AN', label: 'Animal', x: 640, y: 50 }, { id: 'LEG', label: 'Leg', x: 540, y: 150 }, { id: 'EL', label: 'Elephant', x: 640, y: 230 }, { id: 'TR', label: 'Trunk', x: 380, y: 230 }, { id: '14', label: '1.4 m', x: 240, y: 300, kind: 'val' }, { id: 'CL', label: 'Clyde', x: 640, y: 360, kind: 'inst' }, { id: 'CT', label: 'Clyde’s trunk', x: 420, y: 360, kind: 'inst' }, { id: 'PK', label: 'pink', x: 240, y: 380, kind: 'val' }],
      edges: [['PO', 'LEN', 'has'], ['PO', 'COL', 'has'], ['CYL', 'PO', 'is a'], ['AN', 'LEG', 'has set of'], ['LEG', 'CYL', 'is a'], ['EL', 'AN', 'is a'], ['EL', 'TR', 'has'], ['TR', 'CYL', 'is a'], ['TR', '14', 'length'], ['CL', 'EL', 'instance of'], ['CL', 'CT', 'has'], ['CT', 'TR', 'instance of'], ['CT', 'PK', 'colour']] },
    { engine: 'semnet', title: 'Q5 conceptual graph', w: 700, h: 230, nodes: [
      { id: 'M1', label: 'PERSON: Mary', x: 90, y: 60 }, { id: 'AG1', label: 'AGNT', x: 230, y: 60, kind: 'rel' }, { id: 'WANT', label: 'WANT', x: 360, y: 60 }, { id: 'OBJ', label: 'OBJ', x: 490, y: 60, kind: 'rel' }, { id: 'SIT', label: 'SITUATION', x: 610, y: 60 }, { id: 'M2', label: 'PERSON: Mary', x: 110, y: 180 }, { id: 'AG2', label: 'AGNT', x: 250, y: 180, kind: 'rel' }, { id: 'MAR', label: 'MARRY', x: 380, y: 180 }, { id: 'PT', label: 'PTNT', x: 490, y: 180, kind: 'rel' }, { id: 'TOM', label: 'SAILOR: Tom', x: 615, y: 180 }],
      edges: [['WANT', 'AG1', ''], ['AG1', 'M1', ''], ['WANT', 'OBJ', ''], ['OBJ', 'SIT', ''], ['SIT', 'MAR', 'describes'], ['MAR', 'AG2', ''], ['AG2', 'M2', ''], ['MAR', 'PT', ''], ['PT', 'TOM', '']], legend: 'Boxes are concepts, ovals are conceptual relations. The two Mary nodes are the same individual (a co-reference line in the usual notation).' }],
    solution: `<p><b>Q4</b>: Cylinder —is a→ Physical object; Physical object —has→ Length, Colour; Animal —has set of→ Leg; Leg —is a→ Cylinder; Elephant —is a→ Animal; Elephant —has→ Trunk; Trunk —is a→ Cylinder; Trunk —length→ 1.4 m; Clyde —instance of→ Elephant; Clyde —has→ Clyde’s trunk —instance of→ Trunk; Clyde’s trunk —colour→ pink. Clyde’s trunk inherits length 1.4 m from Trunk and length/colour slots from Physical object.</p>
<p><b>Q5</b>: [PERSON: Mary] ← (AGNT) ← [WANT] → (OBJ) → [SITUATION: [PERSON: Mary*] ← (AGNT) ← [MARRY] → (PTNT) → [SAILOR: Tom]]. The wanted thing is a whole situation, so it is a nested graph; Mary in both places is the same individual.</p>`,
    notes: `<ul><li>Semantic net: nodes are concepts/objects, labelled arcs are relations; is-a and instance-of give inheritance.</li><li>Conceptual graph: concept boxes [TYPE: referent] alternate with relation ovals (AGNT = agent, OBJ = object, PTNT = patient).</li></ul>`
  });
  // ---------- mock GA questions ----------
  const GM = 'Mock tests (GA & puzzles)';
  P.push({
    id: 'm-8queens', group: GM, code: 'Mock Q3', title: 'GA for the 8-queens problem', topic: 'Genetic algorithms', marks: '13 marks', keywords: '8 queens chromosome digit string fitness non-attacking pairs crossover mutation selection',
    question: `<p>Design a GA for 8-queens (board in the question: queens at column/row 1/5, 2/1, 3/8, 4/4, 5/2, 6/7, 7/3, 8/6). 1. Chromosome structure. 2. Example. 3. Fitness. 4. Crossover pseudocode c = crossover(a, b). 5. Mutation pseudocode. 6. Selection mechanism and why.</p>`,
    sim: { engine: 'ga', kind: 'queens8', pop: 60, gens: 150, pc: 0.9, pm: 0.3, example: [5, 1, 8, 4, 2, 7, 3, 6], labParents: [[3, 2, 7, 5, 2, 4, 1, 1], [2, 4, 7, 4, 8, 5, 5, 2]] },
    solution: `<p><b>1.</b> A string of 8 digits; digit i (1–8) is the row of the queen in column i. One queen per column is built in, so only row and diagonal clashes remain.</p>
<p><b>2.</b> The board in the question: <code>51842736</code>. It is a solution: no two queens attack (fitness 28).</p>
<p><b>3.</b> Fitness = number of non-attacking pairs = 28 − (number of attacking pairs), where a pair (i, j) attacks if row<sub>i</sub> = row<sub>j</sub> or |row<sub>i</sub> − row<sub>j</sub>| = |i − j|. Maximum 28 = C(8, 2). Example from the lecture figure: 24748552 → 24, 32752411 → 23, 24415124 → 20, 32543213 → 11.</p>
<p><b>4.</b></p><pre>def crossover(a, b):
    c = random.randint(1, 7)          # cut between columns c and c+1
    return a[:c] + b[c:]</pre><p>(e.g. 327|52411 × 247|48552 → 32748552). Any child is still a valid 8-digit board.</p>
<p><b>5.</b></p><pre>def mutate(a):
    i = random.randint(0, 7)          # pick a column
    a[i] = random.randint(1, 8)       # move its queen to a random row
    return a</pre>
<p><b>6.</b> Fitness-proportionate (roulette) selection, as in the lecture: P(i) = f<sub>i</sub> / Σf, e.g. 24/78 = 31%, 23/78 = 29%, 20/78 = 26%, 11/78 = 14%. Fitter boards breed more often but weak ones still get a chance, which keeps diversity. Tournament selection is a good alternative when fitness values are close.</p>`,
    notes: `<ul><li>Use the operator lab with the lecture parents 32752411 and 24748552 to reproduce crossover children like 32748552 and 24752411.</li><li>A permutation encoding (each row used once) would remove row clashes too, but then crossover must be permutation-safe (PMX/OX).</li></ul>`
  });
  P.push({
    id: 'm-latin', group: GM, code: 'Test 2 Q', title: 'GA for a 4×4 Latin square with given cells', topic: 'Genetic algorithms', marks: '28 marks', keywords: 'latin square GA fixed cells negative conflicts row swap',
    question: `<p>Fill a 4×4 grid with symbols 0–3 so each symbol appears once in every row and column. Given cells: (row 1, col 1) = 0, (2, 3) = 1, (3, 2) = 3, (4, 4) = 2. Design the GA: chromosome, example, fitness, crossover and mutation pseudocode, selection.</p>`,
    sim: { engine: 'ga', kind: 'latin', pop: 30, gens: 60, pc: 0.8, pm: 0.4 },
    solution: `<p><b>1. Chromosome</b> (memo style): 16 integers, row by row; values 1–4 stand for symbols 0–3; given cells are stored as negatives so operators can recognise and skip them. Example: −1,2,3,4 | 4,3,−2,1 | 3,−4,1,2 | 2,1,4,−3.</p>
<p><b>Better design</b>: make every row a permutation that already contains its given cell. Then rows can never clash, and only column duplicates remain.</p>
<p><b>3. Fitness</b> = number of conflicts = Σ over rows (4 − distinct symbols) + Σ over columns (4 − distinct symbols). Lower is better; 0 = solved.</p>
<p><b>4. Crossover</b> (row-wise):</p><pre>def crossover(a, b):
    r = random.randint(1, 3)            # cut between rows r and r+1
    return a[:4*r] + b[4*r:]            # whole rows copied, fixed cells equal in both parents</pre>
<p><b>5. Mutation</b>:</p><pre>def mutate(a):
    row = random.randint(0, 3)
    free = [c for c in range(4) if a[4*row + c] > 0]   # skip given (negative) cells
    i, j = random.sample(free, 2)
    a[4*row+i], a[4*row+j] = a[4*row+j], a[4*row+i]      # swap keeps the row a permutation
    return a</pre>
<p><b>6. Selection</b>: tournament (pick k = 3 at random, keep the one with fewest conflicts). It works directly with “lower is better” fitness and is not distorted by a fitness of 0; keep the best 1–2 grids unchanged (elitism).</p>
<p>The solution in the question: 0 1 2 3 / 3 2 1 0 / 2 3 0 1 / 1 0 3 2.</p>`,
    notes: `<ul><li>Never let an operator change a given cell — storing them as negatives (or in a separate mask) is the standard trick.</li><li>Roulette needs “higher is better” and positive values; with conflicts use 1/(1 + conflicts) or tournament.</li></ul>`
  });
  P.push({
    id: 'm-fx', group: GM, code: 'Part B Q1', title: 'Binary GA maximising x³ − 60x² + 900x + 100', topic: 'Genetic algorithms', marks: '15 marks', keywords: 'binary chromosome f(x) crossover point 1 C1 C2 optimal x=10 probability zero',
    question: `<p>Maximise f(x) = x³ − 60x² + 900x + 100 for x in 0…31 (optimum x = 10), 5-bit binary. P1 11100, P2 01111, P3 10111, P4 00100. (i) Give x and f(x). (ii) Cross P3 and P2 at point 1 (0 is the far left) → C1, C2. Follow-ups: P4 × P2 at point 2 → C3, C4; x and f for C1–C4; if the initial population were x = {17, 21, 4, 28}, what is the probability of finding the optimum with one-point crossover?</p>`,
    sim: { engine: 'chromLab', names: ['P1', 'P2', 'P3', 'P4'], pop: ['11100', '01111', '10111', '00100'], fitness: s => { const x = parseInt(s, 2); return x ** 3 - 60 * x ** 2 + 900 * x + 100; }, decode: s => parseInt(s, 2), showDecoded: true, cross: { a: 2, b: 1, points: [1] }, plot: { title: 'f(x) over 0…31 with the population marked', max: 31, f: x => x ** 3 - 60 * x ** 2 + 900 * x + 100 } },
    solution: `<p><b>(i)</b></p><table><thead><tr><th></th><th>Binary</th><th>x</th><th>f(x)</th></tr></thead><tbody><tr><td>P1</td><td>11100</td><td>28</td><td>212</td></tr><tr><td>P2</td><td>01111</td><td>15</td><td>3475</td></tr><tr><td>P3</td><td>10111</td><td>23</td><td>1227</td></tr><tr><td>P4</td><td>00100</td><td>4</td><td>2804</td></tr></tbody></table>
<p><b>(ii)</b> Point 1 = after the first bit: P3 = 1|0111, P2 = 0|1111 → <b>C1 = 11111</b> (x = 31, f = 131), <b>C2 = 00111</b> (x = 7, f = 3803).</p>
<p>P4 × P2 at point 2: 00|100 and 01|111 → <b>C3 = 00111</b> (7, 3803), <b>C4 = 01100</b> (12, 3988).</p>
<p><b>Probability with {17, 21, 4, 28}</b> = 10001, 10101, 00100, 11100: the optimum 10 = 01010 needs a 1 in the 2’s place, and no individual has one. Crossover only rearranges existing bits, so it can never create that 1: the probability is <b>zero</b> (only mutation could help).</p>
<p>Check of the optimum: f′(x) = 3x² − 120x + 900 = 3(x − 10)(x − 30), maximum at x = 10, f(10) = 4100.</p>`,
    notes: `<ul><li>Crossover point k counts gene boundaries from the left: point 1 = after the first bit.</li><li>Crossover explores combinations of existing alleles; mutation is the only operator that brings in new ones.</li></ul>`
  });
  P.push({
    id: 'm-blocks', group: GM, code: 'Test Q (blocks)', title: 'Blocks match game: data structure and state', topic: 'State-space formulation', marks: '6+ marks', keywords: 'blocks shape colour block colour match all same all different data structure',
    question: `<p>Three blocks, each with a shape type (circle, square, triangle), a shape colour and a block colour. The row matches if, for every property, the three values are all the same or all different. Start state: blue triangle on black, yellow triangle on white, yellow circle on white. 1) An efficient data structure. 2) An example initial state.</p>`,
    sim: { engine: 'blocks', start: [{ shape: 'triangle', colour: 'blue', block: 'black' }, { shape: 'triangle', colour: 'yellow', block: 'white' }, { shape: 'circle', colour: 'yellow', block: 'white' }] },
    solution: `<p><b>1)</b> Three parallel lists of characters, one per property; index 0, 1, 2 is block 1, 2, 3: shapeTypes, shapeColours, blockColours. Each entry is the first letter of the option (watch the clash between <b>B</b>lue and <b>B</b>lack — use e.g. U for blue or K for black). Equivalent: a list of three (shape, colour, block) tuples.</p>
<p><b>2)</b> shapeTypes = ['T', 'T', 'C'], shapeColours = ['U', 'Y', 'Y'], blockColours = ['K', 'W', 'W'].</p>
<p><b>Match test</b>: for each list, len(set(list)) must be 1 or 3. Here shape gives 2 (T, T, C) → <b>not a match</b>.</p>`,
    notes: `<ul><li>Each block has 3 × 3 × 3 = 27 possibilities, so an ordered row has 27³ = 19,683 states.</li><li>Deal random rows in the simulation and test yourself before checking.</li></ul>`
  });
  P.push({
    id: 'm-lights', group: GM, code: 'Test Q (lights)', title: 'Lights puzzle on a 5×5 grid', topic: 'State-space formulation', marks: '—', keywords: 'lights out select lit cell toggles neighbours heuristic admissible',
    question: `<p>A 5×5 grid of lights; some start on. You may only select a cell whose light is on; selecting it toggles that cell and its orthogonal neighbours. The puzzle is solved when all lights are off. (Typical questions: state, actions, goal test, successors, heuristic and admissibility.)</p>`,
    sim: { engine: 'lights', start: ['11100', '01110', '01101', '11000', '11100'] },
    solution: `<p><b>State</b>: a 5×5 Boolean grid (or a 25-bit number) — 2<sup>25</sup> = 33,554,432 states.</p><p><b>Actions</b>: select any lit cell (r, c): toggle (r, c) and each of (r ± 1, c), (r, c ± 1) inside the grid. Cost 1. Number of successors = number of lit cells (14 at the start).</p><p><b>Goal test</b>: all 25 lights off.</p>
<p><b>Heuristic</b>: h = ⌈(lights on) / 5⌉. Admissible: one move toggles at most 5 cells, so it can switch off at most 5 lights — at least ⌈on/5⌉ moves remain. Start: 14 on → h = 3.</p>
<p>The exam start is solved in <b>5 moves</b> (A* in the simulation), e.g. select (5,1), (3,3), (4,3), (3,4), (1,2) in row/column order 1-based.</p>`,
    notes: `<ul><li>A move can also switch lights <i>on</i> (an off neighbour toggles on), which is why the heuristic counts only what one move could possibly fix.</li><li>The order of presses matters here, because you may only press lit cells.</li></ul>`
  });
})(window.AIN);

/* ---- data/06-older-papers.js ---- */
(function (A) {
  const P = A.problems;
  const G13 = '2013 supplementary (memo)';
  const tree = {}; for (let n = 1; n <= 7; n++) tree[n] = [String(2 * n), String(2 * n + 1)];
  const tnodes = {}; for (let n = 1; n <= 15; n++) { const d = Math.floor(Math.log2(n)), i = n - 2 ** d, w = 640 / 2 ** d; tnodes[n] = { x: w * i + w / 2, y: 36 + d * 80 }; }
  const tedges = []; for (let n = 1; n <= 7; n++) tedges.push([String(n), String(2 * n), 1], [String(n), String(2 * n + 1), 1]);
  P.push({
    id: 's13-q3', group: G13, code: '2013 Q3', title: 'States 1–15: DFS, BFS and depth-limited search', topic: 'Search', marks: '20 marks', keywords: 'state space 2n 2n+1 goal 11 depth limited true false best first',
    question: `<p>3.1 Define state space and search tree. 3.2 Start state 1; the successors of n are 2n and 2n + 1. (a) Draw states 1–15. (b) Goal 11: list the order nodes are visited by DFS, BFS and depth-limited search (limit 3). 3.3 True or false, with a reason: (a) UCS is a special case of BFS; (b) BFS, DFS and UCS are special cases of best-first search; (c) A* is a special case of UCS; (d) uncertainty reasoning methods include expert systems and modus ponens.</p>`,
    sims: [{ engine: 'graphSearch', directed: true, start: '1', algos: ['dfs', 'bfs', 'dls'], limit: 3, goalSets: [{ label: 'Goal 11', goals: ['11'] }], nodesOnly: true, costLabels: false, showH: false, stepCosts: false, w: 660, h: 330, r: 16, nodes: tnodes, edges: tedges, algoNames: { dls: 'Depth-limited (3)' } },
    { engine: 'quiz', title: '3.3 True or false', items: [
      { n: 'a', q: 'Uniform-cost search is a special case of breadth-first search.', options: ['True', 'False'], answer: 1, why: 'It is the other way round: BFS is UCS when every step costs the same.' },
      { n: 'b', q: 'BFS, DFS and UCS are special cases of best-first search.', options: ['True', 'False'], answer: 0, why: 'Best-first with f = depth (BFS), f = −depth (DFS), f = g (UCS).' },
      { n: 'c', q: 'A* is a special case of uniform-cost search.', options: ['True', 'False'], answer: 1, why: 'The other way round: UCS is A* with h = 0.' },
      { n: 'd', q: 'Methods for uncertainty reasoning include expert systems and modus ponens.', options: ['True', 'False'], answer: 1, why: 'Uncertainty calls for probabilistic reasoning or fuzzy logic; modus ponens is a sound rule for certain knowledge.' }] }],
    solution: `<p><b>3.1</b> State space: a graph whose nodes are all states and whose arcs are actions taking one state to another. Search tree: a tree rooted at the start state whose children of each node are the states reachable by one action (the same state can appear many times).</p>
<p><b>3.2 (b)</b> DFS (left child first): <b>1, 2, 4, 8, 9, 5, 10, 11</b>. BFS: <b>1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11</b>. Depth-limited, limit 3: <b>1, 2, 4, 8, 9, 5, 10, 11</b> — the same as DFS here because 11 is at depth 3, inside the limit. (The memo’s DFS line “8 9 4 10 11” leaves out the nodes above; the full order is as given here.)</p>
<p><b>3.3</b> (a) False (b) True (c) False (d) False — reasons in the quiz.</p>`,
    notes: `<ul><li>Node n has children 2n and 2n + 1, so depth(n) = ⌊log₂ n⌋; 11 = 1011 in binary is reached by 1 → 2 → 5 → 11.</li><li>Depth-limited search is DFS that refuses to expand nodes at the limit; with limit 2 it would fail here.</li></ul>`
  });
  // card game tree
  const cards = [5, 8, 7, 3], ct = {};
  const score = (p1, p2) => { const a = p1[0] + p1[1], b = p2[0] + p2[1]; const ea = a % 2 === 0, eb = b % 2 === 0; if (ea && (!eb || a > b)) return a; if (eb && (!ea || b > a)) return -b; return 0; };
  (function build(id, left, picks) { if (picks.length === 4) return; ct[id] = left.map(c => { const nl = left.filter(x => x !== c), np = [...picks, c]; const cid = id + '-' + c; if (np.length === 4) return [String(c), score([np[0], np[2]], [np[1], np[3]])]; build(cid, nl, np); return [String(c), cid]; }); })('r', cards, []);
  P.push({
    id: 's13-q4', group: G13, code: '2013 Q4', title: 'Minimax on a four-card game', topic: 'Game trees', marks: '20 marks', keywords: 'adversarial search minimax card game 5 8 7 3 even sum',
    question: `<p>4.1 Explain adversarial search. 4.2 Cards 5, 8, 7 and 3 lie face up. Player 1 picks one, player 2 picks one, player 1 picks another, player 2 takes the last. Each player adds their two cards; the player with the highest even total wins that amount from the opponent. (a) Put the score (for player 1) at the end of every path. (b) Apply minimax to find the final score.</p>`,
    sim: { engine: 'alphaBeta', root: 'r', hideNames: true, prune: false, spacing: 26, levelGap: 74, levelLabels: ['P1', 'P2', 'P1', 'P2', 'score'], tree: ct },
    simIntro: 'Edge labels are the card taken. Leaves show the score for player 1: + if player 1 wins that amount, − if player 2 wins it, 0 if neither total is even.',
    solution: `<p><b>4.1</b> Search against an opponent whose moves we do not control: the agent must plan a reply to every possible opponent move (a strategy, not a single path), assume the opponent plays its best, and usually stop at a depth limit and estimate positions, because the full game tree is too large.</p>
<p><b>4.2 (a) Leaf scores</b> depend only on which pair player 1 ends with: {5,8} −10, {5,7} +12, {5,3} +8, {8,7} −8, {8,3} −12, {7,3} +10.</p>
<p><b>(b)</b> Player 2 (MIN) answers each first card with the reply that is worst for player 1: after 5 → 8 (P2 takes 7), after 8 → −10, after 7 → 10, after 3 → 8. Player 1 (MAX) takes the best: <b>first card 7</b>, value <b>+10</b>. Player 1 then ends with 7 and 3 (total 10, even) against 5 and 8 (13, odd), so <b>player 2’s final score is −10</b> (it pays player 1 R10).</p>`,
    notes: `<ul><li>Turn order fixes the MAX/MIN levels: P1, P2, P1, then P2’s forced last card.</li><li>The scoring rule is the only judgement call — state it clearly before you back up values. Here: highest even total wins its own total; if neither total is even, nobody pays.</li></ul>`
  });
  P.push({
    id: 's13-q5', group: G13, code: '2013 Q5', title: 'Truth tables, Germans, CNF and the cat Tuna', topic: 'Logic & resolution', marks: '20 marks', keywords: 'truth table associativity distributivity germans speak CNF jack curiosity tuna',
    question: `<p>5.1 Show by truth table: (a) ((α ∧ β) ∧ γ) ≡ (α ∧ (β ∧ γ)); (b) (α ∧ (β ∨ γ)) ≡ ((α ∧ β) ∨ (α ∧ γ)). 5.2 “All Germans speak the same languages” with Speaks(x, l). 5.3 Translate C1 ∃X dog(X) ∧ owns(jack, X); C2 ∀X [∃Y dog(Y) ∧ owns(X, Y)] → animal_lover(X); C3 ∀X∀Y animal(X) ∧ animal_lover(Y) → ¬killedby(X, Y); C4 killedby(tuna, jack) ∨ killedby(tuna, curiosity); C5 cat(tuna); C6 ∀X cat(X) → animal(X). 5.4 CNF of (a) P ∨ (¬P ∧ Q ∧ R) and (b) (P → Q) → R.</p>`,
    sims: [{ engine: 'truthTable', title: 'Truth tables', tables: [
      { title: '(a) associativity of ∧', vars: ['α', 'β', 'γ'], cols: [{ label: 'α∧β', f: v => v['α'] && v['β'] }, { label: '(α∧β)∧γ', f: v => v['α'] && v['β'] && v['γ'] }, { label: 'β∧γ', f: v => v['β'] && v['γ'] }, { label: 'α∧(β∧γ)', f: v => v['α'] && (v['β'] && v['γ']) }], equal: [1, 3] },
      { title: '(b) distributivity of ∧ over ∨', vars: ['α', 'β', 'γ'], cols: [{ label: 'β∨γ', f: v => v['β'] || v['γ'] }, { label: 'α∧(β∨γ)', f: v => v['α'] && (v['β'] || v['γ']) }, { label: 'α∧β', f: v => v['α'] && v['β'] }, { label: 'α∧γ', f: v => v['α'] && v['γ'] }, { label: '(α∧β)∨(α∧γ)', f: v => (v['α'] && v['β']) || (v['α'] && v['γ']) }], equal: [1, 4] }] },
    { engine: 'proof', title: 'Extra: prove Curiosity killed Tuna (the classic follow-up)', clauses: [{ id: 'C1a', t: 'dog(d)' }, { id: 'C1b', t: 'owns(jack, d)' }, { id: 'C2', t: '¬dog(Y) ∨ ¬owns(X, Y) ∨ animal_lover(X)' }, { id: 'C3', t: '¬animal(X) ∨ ¬animal_lover(Y) ∨ ¬killedby(X, Y)' }, { id: 'C4', t: 'killedby(tuna, jack) ∨ killedby(tuna, curiosity)' }, { id: 'C5', t: 'cat(tuna)' }, { id: 'C6', t: '¬cat(X) ∨ animal(X)' }, { id: 'G', t: '¬killedby(tuna, curiosity)   (negated goal)' }],
      steps: [
        { uses: ['G', 'C4'], text: 'Resolve the negated goal with C4.', result: { id: 'R1', t: 'killedby(tuna, jack)' } },
        { uses: ['R1', 'C3'], text: 'Resolve with C3 using {X/tuna, Y/jack}.', result: { id: 'R2', t: '¬animal(tuna) ∨ ¬animal_lover(jack)' } },
        { uses: ['C5', 'C6'], text: 'Resolve C5 with C6 using {X/tuna}.', result: { id: 'R3', t: 'animal(tuna)' } },
        { uses: ['R2', 'R3'], text: 'Resolve R2 with R3.', result: { id: 'R4', t: '¬animal_lover(jack)' } },
        { uses: ['R4', 'C2'], text: 'Resolve with C2 using {X/jack}.', result: { id: 'R5', t: '¬dog(Y) ∨ ¬owns(jack, Y)' } },
        { uses: ['R5', 'C1b'], text: 'Resolve with C1b using {Y/d}.', result: { id: 'R6', t: '¬dog(d)' } },
        { uses: ['R6', 'C1a'], text: 'Resolve with C1a.', result: { id: 'R7', t: '□ — Curiosity killed Tuna' } }] }],
    solution: `<p><b>5.1</b> Both pairs of columns agree in all 8 rows (see the tables), so the equivalences hold.</p>
<p><b>5.2</b> ∀x ∀y ∀l German(x) ∧ German(y) ∧ Speaks(x, l) → Speaks(y, l): any language one German speaks, every German speaks.</p>
<p><b>5.3</b> C1 Jack owns a dog. C2 Anyone who owns a dog is an animal lover. C3 No animal lover kills an animal. C4 Tuna was killed by Jack or by Curiosity. C5 Tuna is a cat. C6 Cats are animals.</p>
<p><b>5.4</b> (a) P ∨ (¬P ∧ Q ∧ R) ≡ (P ∨ ¬P) ∧ (P ∨ Q) ∧ (P ∨ R) ≡ <b>(P ∨ Q) ∧ (P ∨ R)</b>. (b) (P → Q) → R ≡ ¬(¬P ∨ Q) ∨ R ≡ (P ∧ ¬Q) ∨ R ≡ <b>(P ∨ R) ∧ (¬Q ∨ R)</b>.</p>`,
    notes: `<ul><li>Truth-table proofs: list all 2<sup>n</sup> rows and show the two target columns are identical.</li><li>CNF recipe: remove →, push ¬ inward (De Morgan), distribute ∨ over ∧, drop tautologies like P ∨ ¬P.</li></ul>`
  });
  P.push({
    id: 's13-q6', group: G13, code: '2013 Q6', title: 'Resolution: Married(Mary) and “John likes snakes”', topic: 'Logic & resolution', marks: '20 marks', keywords: 'married spouse joint tax filers john likes food snakes prolog',
    question: `<p>6.1 KB: (i) ∀x Married(x) → ∃y Spouse(x, y); (ii) ∀x∃y Spouse(x, y) → Married(x); (iii) ∀x∀y Spouse(x, y) → Spouse(y, x); (iv) ∀x∀y JointTaxFilers(x, y) → Spouse(x, y); (v) JointTaxFilers(John, Mary); (vi) ¬∃y Spouse(Sue, y). (a) Clause form. (b) Prove Married(Mary).</p><p>6.2 John likes all kinds of food. Apples and oysters are food. Anything anyone eats and still lives is food. Tom eats snakes and still lives. Sue eats everything Tom eats. (a) Predicate calculus. (b) Resolution: does John like snakes? (c) Prolog.</p>`,
    sims: [{ engine: 'proof', title: '6.1 Married(Mary)', clauses: [{ id: '1', t: '¬Married(x) ∨ Spouse(x, S1(x))' }, { id: '2', t: '¬Spouse(x, y) ∨ Married(x)' }, { id: '3', t: '¬Spouse(x, y) ∨ Spouse(y, x)' }, { id: '4', t: '¬JointTaxFilers(x, y) ∨ Spouse(x, y)' }, { id: '5', t: 'JointTaxFilers(John, Mary)' }, { id: '6', t: '¬Spouse(Sue, y)' }, { id: '7', t: '¬Married(Mary)   (negated goal)' }],
      steps: [{ uses: ['7', '2'], text: '2 and 7 with {x/Mary}.', result: { id: '8', t: '¬Spouse(Mary, y)' } }, { uses: ['8', '3'], text: '3 and 8: Spouse(y, x) unifies with Spouse(Mary, y′) by {y/Mary, x/y′}.', result: { id: '9', t: '¬Spouse(y, Mary)' } }, { uses: ['9', '4'], text: '4 and 9 with {x/y, y/Mary}.', result: { id: '10', t: '¬JointTaxFilers(y, Mary)' } }, { uses: ['10', '5'], text: '5 and 10 with {y/John}.', result: { id: '11', t: '□ — Mary is married' } }] },
    { engine: 'proof', title: '6.2 John likes snakes', clauses: [{ id: 'a', t: '¬food(F) ∨ likes(john, F)' }, { id: 'b', t: 'food(apples)' }, { id: 'c', t: 'food(oysters)' }, { id: 'd', t: '¬eats(P, X) ∨ ¬alive(P) ∨ food(X)' }, { id: 'e', t: 'eats(tom, snakes)' }, { id: 'f', t: 'alive(tom)' }, { id: 'g', t: '¬eats(tom, Y) ∨ eats(sue, Y)' }, { id: 'h', t: '¬likes(john, snakes)   (negated goal)' }],
      steps: [{ uses: ['h', 'a'], text: 'h and a with {F/snakes}.', result: { id: 'R1', t: '¬food(snakes)' } }, { uses: ['R1', 'd'], text: 'With d using {X/snakes}.', result: { id: 'R2', t: '¬eats(P, snakes) ∨ ¬alive(P)' } }, { uses: ['R2', 'f'], text: 'With f using {P/tom}.', result: { id: 'R3', t: '¬eats(tom, snakes)' } }, { uses: ['R3', 'e'], text: 'With e.', result: { id: 'R4', t: '□ — John likes snakes' } }] }],
    solution: `<p><b>6.1 (a)</b> 1. ¬Married(x) ∨ Spouse(x, S1(x)) · 2. ¬Spouse(x, y) ∨ Married(x) · 3. ¬Spouse(x, y) ∨ Spouse(y, x) · 4. ¬JointTaxFilers(x, y) ∨ Spouse(x, y) · 5. JointTaxFilers(John, Mary) · 6. ¬Spouse(Sue, y).</p><p><b>(b)</b> 7. ¬Married(Mary) · 8. ¬Spouse(Mary, y) [2, 7] · 9. ¬Spouse(y, Mary) [3, 8] · 10. ¬JointTaxFilers(y, Mary) [4, 9] · 11. □ [5, 10].</p>
<p><b>6.2 (a)</b> ∀F food(F) → likes(john, F) · food(apples) · food(oysters) · ∀P∀F eats(P, F) ∧ alive(P) → food(F) · eats(tom, snakes) · alive(tom) · ∀F eats(tom, F) → eats(sue, F).</p><p><b>(b)</b> ¬likes(john, snakes) → ¬food(snakes) → ¬eats(P, snakes) ∨ ¬alive(P) → ¬eats(tom, snakes) → □. So yes, John likes snakes.</p>
<p><b>(c)</b></p><pre>likes(john, X) :- food(X).
food(apples).
food(oysters).
food(F) :- eats(P, F), alive(P).
eats(tom, snakes).
alive(tom).
eats(sue, F) :- eats(tom, F).

?- likes(john, snakes).   % true</pre>`,
    notes: `<ul><li>(ii) has ∃y in front of an implication whose condition uses y: ∀x [∃y Spouse(x,y)] → Married(x) becomes ∀x∀y ¬Spouse(x,y) ∨ Married(x) — no Skolem function needed.</li><li>(vi) ¬∃y Spouse(Sue, y) is ∀y ¬Spouse(Sue, y): a plain negative clause.</li><li>Clause 6 and the Sue rule are not used — extra knowledge is normal.</li></ul>`
  });
  P.push({
    id: 's13-theory', group: G13, code: '2013 Q1, 2, 7, 8', title: 'Theory: AI goals, agents, PEAS, neural networks, expert systems', topic: 'Agents & foundations', keywords: 'agent function autonomy reflex utility PEAS performance measure neurocomputing expert system inference engine',
    question: `<p>Short-answer theory from the 2013 paper, with the memo’s answers. Try each one before you reveal it.</p>`,
    sim: { engine: 'quiz', items: [
      { n: '1.3', q: 'Distinguish the scientific and engineering goals of AI.', a: 'Scientific: understand intelligence in mechanistic terms — the computations needed for intelligent behaviour, within limited perception, memory and computation. Engineering: make computers more useful and intelligent — autonomy (tasks without human operators), flexibility with a varying environment, ease of use (understand users from little instruction), learning from experience.' },
      { n: '1.4', q: 'Four disciplines AI grew from, and one idea each.', a: 'Philosophy (logic, reasoning, mind as a physical system, rationality) · Mathematics (formal representation and proof, computation, (un)decidability, tractability, probability) · Economics (utility, decision theory) · Neuroscience (the physical substrate of mental activity) · Psychology (perception, motor control, experimental methods) · Computer engineering (fast computers) · Control theory (maximising an objective over time) · Linguistics (knowledge representation, grammar).' },
      { n: '2.1', q: 'Define agent function, autonomy, reflex agent, utility-based agent.', a: 'Agent function: an abstract mathematical mapping from percept sequences to actions. Autonomy: behaviour determined by the agent’s own experience. Reflex agent: acts on the current percept only (“if light then run to a dark place”). Utility-based agent: chooses actions to maximise a utility function that maps states to real numbers, trading off conflicting goals (time vs energy).' },
      { n: '2.2', q: 'PEAS for an automated taxi driver.', a: 'Performance: safe, fast, legal, comfortable trip, maximise profit. Environment: roads, other traffic, pedestrians, customers. Actuators: steering, accelerator, brake, signal, horn. Sensors: cameras, sonar, speedometer, GPS, odometer, engine sensors, keyboard.' },
      { n: '2.2c', q: 'PEAS for a mathematical theorem-proving assistant.', a: 'P: proves theorems correctly in few steps/little time. E: the internet, libraries of theorems. A: display. S: keyboard.' },
      { n: '2.3', q: 'Performance measure vs utility function?', a: 'A performance measure is the external criterion for judging the agent’s behaviour (designed around what you want achieved in the environment). A utility function is the agent’s internal map from states to a real number (its “degree of happiness”), used to choose between options, especially under uncertainty.' },
      { n: '7.1a', q: 'Six principles of neurocomputing.', a: 'Connectionism; training; distributed memory; learning and adaptation; non-linear functionality; robustness of associativity.' },
      { n: '7.1b', q: 'Steps in designing a neural network model.', a: 'Variable selection → data collection → preprocessing → training/testing/validation split → network design (hidden layers, hidden neurons, output neurons, transfer functions) → evaluation criteria → training (iterations, learning rate, momentum) → implementation.' },
      { n: '7.1c–d', q: 'Three activation functions; the learning methods.', a: 'Linear, logistic (sigmoid), threshold (step), hyperbolic tangent. Learning: supervised (inputs with desired outputs), unsupervised (inputs only, finds internal features), reinforcement (reward/penalty from a critic).' },
      { n: '7.3', q: 'Single-point crossover of 1000110100 and 1110100110; can offspring equal parents?', a: 'Pick a random cut and swap tails: 10001|10100 and 11101|00110 → 1000100110 and 1110110100. Yes — if the cut is at the very start or end, or the tails are identical, the children equal the parents.' },
      { n: '8.2', q: 'Expert systems: team, structure, inference engine, FC vs BC, disadvantages.', a: 'Team: domain expert, knowledge engineer, programmer, project manager, end user. Structure: knowledge base (rules), database (facts), inference engine, explanation facility, user interface. Inference engine: reasons by linking rules in the knowledge base with facts in the database. FC is data-driven, BC is goal-driven. Disadvantages: opaque relations between rules, ineffective search strategy, inability to learn.' }] },
    solution: `<p>All answers are in the cards above (memo answers, lightly tidied). Typical marks: one mark per correct point, so list several short, specific points.</p>`,
    notes: `<ul><li>PEAS answers should be specific to the agent; four short items per letter are plenty.</li><li>“Reflex” = current percept only; “model-based” adds internal state; “goal-based” plans; “utility-based” optimises.</li></ul>`
  });

  const G15 = '2015 main exam (memo)';
  const hsG = { S: { x: 60, y: 260 }, A: { x: 190, y: 90 }, B: { x: 230, y: 250 }, C: { x: 340, y: 120 }, D: { x: 380, y: 250 }, G: { x: 520, y: 60 } };
  P.push({
    id: 's15-q2', group: G15, code: '2015 Q2', title: 'Search: true/false, 8-puzzle heuristics, three heuristics on one graph', topic: 'Search', marks: '22 marks', keywords: 'h0 h1 h2 admissible greedy 8 puzzle misplaced manhattan minimax',
    question: `<p>(a) True/false on search properties. (b) 8-puzzle start 7 2 4 / 5 _ 6 / 8 3 1, goal _ 1 2 / 3 4 5 / 6 7 8: give two heuristics and their values. (c) Graph S→A 5, S→B 2, A→G 5, B→C 2, B→D 1, C→G 2, D→G 5 with h<sub>0</sub> (all 0), h<sub>1</sub> (S 5, A 3, B 4, C 2, D 5) and h<sub>2</sub> (S 6, A 5, B 2, C 5, D 3): which are admissible, which path does A* return with each, and which path does greedy best-first return with h<sub>1</sub>? (d) Goal and procedure of minimax.</p>`,
    sims: [{ engine: 'graphSearch', title: '(c) one graph, three heuristics', directed: true, start: 'S', algos: ['astar', 'greedy', 'ucs'], goalSets: [{ label: 'Goal G', goals: ['G'] }], hsets: [{ label: 'h0', h: { S: 0, A: 0, B: 0, C: 0, D: 0, G: 0 } }, { label: 'h1', h: { S: 5, A: 3, B: 4, C: 2, D: 5, G: 0 } }, { label: 'h2', h: { S: 6, A: 5, B: 2, C: 5, D: 3, G: 0 } }], w: 580, h: 310, nodes: hsG, edges: [['S', 'A', 5], ['S', 'B', 2], ['A', 'G', 5], ['B', 'C', 2], ['B', 'D', 1], ['C', 'G', 2], ['D', 'G', 5]] },
    { engine: 'eightPuzzle', title: '(b) 8-puzzle heuristics', start: [7, 2, 4, 5, 0, 6, 8, 3, 1], goal: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
    { engine: 'quiz', title: '(a) True or false', items: [
      { n: 'i', q: 'DFS finds an optimal path with respect to path cost.', options: ['True', 'False'], answer: 1, why: 'DFS returns the first goal it reaches, whatever the cost.' },
      { n: 'ii', q: 'BFS finds an optimal path with respect to the number of steps.', options: ['True', 'False'], answer: 0, why: 'It expands level by level, so the first goal is the shallowest.' },
      { n: 'iii', q: 'UCS is a special case of BFS.', options: ['True', 'False'], answer: 1, why: 'BFS is the special case of UCS with equal step costs.' },
      { n: 'iv', q: 'BFS, DFS and UCS are special cases of best-first search.', options: ['True', 'False'], answer: 0, why: 'Choose f = depth, −depth or g.' },
      { n: 'v', q: 'A* is a special case of UCS.', options: ['True', 'False'], answer: 1, why: 'UCS is A* with h = 0.' },
      { n: 'vi', q: 'DFS finds an optimal path with respect to the number of steps.', options: ['True', 'False'], answer: 1, why: 'It can dive down a long branch first.' }] }],
    solution: `<p><b>(a)</b> i F · ii T · iii F · iv T · v F · vi F.</p>
<p><b>(b)</b> h<sub>1</sub> = misplaced tiles = <b>8</b>; h<sub>2</sub> = total Manhattan distance = 3+1+2+2+2+3+3+2 = <b>18</b>.</p>
<p><b>(c)</b> True costs to G: S 6 (S-B-C-G), A 5, B 4, C 2, D 5. h<sub>0</sub> and h<sub>1</sub> never exceed these → admissible. h<sub>2</sub>(C) = 5 &gt; 2 → <b>not admissible</b>.</p><p>A*: h<sub>0</sub> (this is UCS) → <b>S-B-C-G</b>, cost 6. h<sub>1</sub> → <b>S-B-C-G</b>, cost 6. h<sub>2</sub> → <b>S-B-D-G</b>, cost 8 (the overestimate at C hides the cheaper route). Greedy with h<sub>1</sub> → <b>S-A-G</b> (h(A) = 3 &lt; h(B) = 4), cost 10.</p>
<div class="note">The memo lists S → B → D → G for h<sub>0</sub>. With these edge costs, h<sub>0</sub> makes A* identical to uniform-cost search, which returns the cheapest path S-B-C-G (6), not S-B-D-G (8). Run the simulation with h0 to see the trace; an admissible heuristic can never return a more expensive path than the optimum.</div>
<p><b>(d)</b> Goal: choose the move for MAX that maximises its guaranteed payoff, whatever MIN does. Procedure: build the tree to a fixed depth from the current position (MAX at the root), evaluate the leaves, back values up (MAX takes the maximum of its children, MIN the minimum) until the root has a value, then play the move to the child whose value equals the root’s.</p>`,
    notes: `<ul><li>“You should not have to run A* in some cases”: with an admissible h, A* returns the optimal path, so h<sub>0</sub> and h<sub>1</sub> must both give the cheapest path.</li><li>An inadmissible h may still give the optimum by luck — here it doesn’t.</li></ul>`
  });
  P.push({
    id: 's15-q3', group: G15, code: '2015 Q3', title: 'FOPC, the Alpine Club, family Prolog and frames', topic: 'Logic & resolution', marks: '37 marks', keywords: 'alpine club skier climber rain snow resolution answer extraction family prolog semantic net frame elephant',
    question: `<p>(a) Translate five sentences into FOPC. (b) Prove P ⇔ Q ≡ (P ∨ Q ⇒ P ∧ Q) without a truth table. (c) Tony, Mike and John belong to the Alpine Club; every member is a skier or a mountain climber or both; no climber likes rain; all skiers like snow; Mike dislikes whatever Tony likes and likes whatever Tony dislikes; Tony likes rain and snow. Formalise, then use resolution: is there a member who is a climber but not a skier? (d) Family tree to Prolog. (e) Axioms for Brother, Daughter, Aunt, GreatGrandchild, SisterInLaw. (f) Read a semantic net; give the frame version.</p>`,
    sims: [{ engine: 'proof', title: '(c) Alpine Club with answer extraction', clauses: [{ id: '1a', t: 'member(Tony)' }, { id: '1b', t: 'member(Mike)' }, { id: '1c', t: 'member(John)' }, { id: '2', t: '¬member(x) ∨ skier(x) ∨ climber(x)' }, { id: '3', t: '¬climber(x) ∨ ¬likes(x, rain)' }, { id: '4', t: '¬skier(x) ∨ likes(x, snow)' }, { id: '5', t: '¬likes(Tony, x) ∨ ¬likes(Mike, x)' }, { id: '6', t: 'likes(Tony, x) ∨ likes(Mike, x)' }, { id: '7a', t: 'likes(Tony, rain)' }, { id: '7b', t: 'likes(Tony, snow)' }, { id: 'G', t: '¬member(p) ∨ ¬climber(p) ∨ skier(p) ∨ Ans(p)' }],
      steps: [
        { uses: ['G', '2'], text: 'Negated query (with answer literal) + clause 2 using {x/p}: climber(p) cancels; skier(p) merges.', result: { id: 'R1', t: '¬member(p) ∨ skier(p) ∨ Ans(p)' } },
        { uses: ['R1', '1b'], text: 'Resolve with member(Mike), {p/Mike}.', result: { id: 'R2', t: 'skier(Mike) ∨ Ans(Mike)' } },
        { uses: ['R2', '4'], text: 'With clause 4, {x/Mike}.', result: { id: 'R3', t: 'likes(Mike, snow) ∨ Ans(Mike)' } },
        { uses: ['R3', '5'], text: 'With clause 5, {x/snow}.', result: { id: 'R4', t: '¬likes(Tony, snow) ∨ Ans(Mike)' } },
        { uses: ['R4', '7b'], text: 'With likes(Tony, snow). Only the answer literal remains.', result: { id: 'R5', t: 'Ans(Mike)' } }] },
    { engine: 'semnet', title: '(f) the semantic net', w: 620, h: 360, nodes: [{ id: 'AN', label: 'animal', x: 300, y: 40 }, { id: 'RE', label: 'reptile', x: 140, y: 130 }, { id: 'MA', label: 'mammal', x: 300, y: 130 }, { id: 'HE', label: 'head', x: 500, y: 130, kind: 'val' }, { id: 'EL', label: 'elephant', x: 300, y: 230 }, { id: 'LA', label: 'large', x: 120, y: 230, kind: 'val' }, { id: 'GR', label: 'grey', x: 490, y: 230, kind: 'val' }, { id: 'CL', label: 'Clyde', x: 200, y: 320, kind: 'inst' }, { id: 'NE', label: 'Nellie', x: 400, y: 320, kind: 'inst' }, { id: 'AP', label: 'apples', x: 560, y: 320, kind: 'val' }],
      edges: [['RE', 'AN', 'isa'], ['MA', 'AN', 'isa'], ['MA', 'HE', 'has_part'], ['EL', 'MA', 'isa'], ['EL', 'LA', 'size'], ['EL', 'GR', 'colour'], ['CL', 'EL', 'instance_of'], ['NE', 'EL', 'instance_of'], ['NE', 'AP', 'likes']] }],
    solution: `<p><b>(a)</b> ∀x livesIn(x, Madison) ⇒ likes(x, Pizza) · ∀x∀y dog(x) ∧ brother(y, x) ∧ loves(x, y) ⇒ happy(x) · ∀x∀y task(x) ∧ requiresHumanIntelligence(x) ∧ computer(y) ∧ canPerform(y, x) ⇒ intelligent(y) · ∃x agent(x) ∧ ∀y∀z (person(y) ∧ policy(z) ∧ sells(x, y, z) ⇒ ¬insured(y)) · ∀x bornIn(x, UK) ∧ ∀y (parent(y, x) ⇒ citizen(y, UK) ∨ resident(y, UK)) ⇒ citizen(x, UK).</p>
<p><b>(b)</b> P ⇔ Q ≡ (¬P ∨ Q) ∧ (¬Q ∨ P) ≡ (¬P ∧ ¬Q) ∨ (¬P ∧ P) ∨ (Q ∧ ¬Q) ∨ (Q ∧ P) ≡ (¬P ∧ ¬Q) ∨ (P ∧ Q) ≡ ¬(P ∨ Q) ∨ (P ∧ Q) ≡ (P ∨ Q) ⇒ (P ∧ Q).</p>
<p><b>(c)</b> Facts: member(Tony), member(Mike), member(John); ∀x member(x) ⇒ skier(x) ∨ climber(x); ∀x climber(x) ⇒ ¬likes(x, rain); ∀x skier(x) ⇒ likes(x, snow); ∀x likes(Tony, x) ⇒ ¬likes(Mike, x); ∀x ¬likes(Tony, x) ⇒ likes(Mike, x); likes(Tony, rain) ∧ likes(Tony, snow). Query ∃x member(x) ∧ climber(x) ∧ ¬skier(x). Resolution with an answer literal gives <b>Ans(Mike)</b>: Mike can’t be a skier (he would like snow, which Tony likes), so as a member he must be a climber who is not a skier.</p>
<p><b>(d)</b></p><pre>parent(pam, bob).  parent(tom, bob).  parent(tom, liz).
parent(bob, ann).  parent(bob, pat).  parent(pat, jim).
male(tom).  male(bob).  male(jim).
female(pam).  female(liz).  female(ann).  female(pat).</pre>
<p><b>(e)</b> Brother(a, b) ⇐ Sibling(a, b) ∧ male(a) · Daughter(a, b) ⇐ parent(b, a) ∧ female(a) · Aunt(a, b) ⇐ parent(x, b) ∧ Sibling(x, a) ∧ female(a) · GreatGrandchild(a, b) ⇐ parent(b, x) ∧ Grandchild(a, x) · SisterInLaw(a, b) ⇐ married(b, x) ∧ Sibling(a, x) ∧ female(a); with Sibling(a, b) ⇐ parent(x, a) ∧ parent(x, b) ∧ a ≠ b and Grandchild(a, b) ⇐ parent(b, x) ∧ parent(x, a).</p>
<p><b>(f)</b> Mammals and reptiles are animals; mammals have heads; elephants are mammals, large and grey; Clyde and Nellie are elephants; Nellie likes apples. Frames: <code>Mammal: subclass Animal; has-part head</code> · <code>Elephant: subclass Mammal; colour grey; size large</code> · <code>Nellie: instance Elephant; likes apples</code> · <code>Clyde: instance Elephant</code>.</p>`,
    notes: `<ul><li>The memo reaches the same answer by resolving to the empty set with Mike substituted; an answer literal makes the “which member?” explicit.</li><li>Clause 6 (likes(Tony, x) ∨ likes(Mike, x)) comes from “Mike likes whatever Tony dislikes”.</li></ul>`
  });
  P.push({
    id: 's15-q4', group: G15, code: '2015 Q4', title: 'Perceptron learning AND (step with threshold)', topic: 'Neural networks', marks: '17 marks', keywords: 'perceptron AND threshold 0.2 learning rate 0.1 delta rule epoch backpropagation expert system architecture',
    question: `<p>(a) Explain how a backpropagation network works (with a diagram). (b) A perceptron learns AND with binary inputs. Initial w1 = 0.3, w2 = −0.1, threshold θ = 0.2, learning rate α = 0.1. Y = step(Σ x<sub>i</sub>w<sub>i</sub> − θ); e = Y<sub>d</sub> − Y; Δw<sub>i</sub> = α·x<sub>i</sub>·e. Complete epoch 1. (c) General architecture of an expert system.</p>`,
    sim: { engine: 'perceptron', rule: 'negnevitsky', X: [[0, 0], [0, 1], [1, 0], [1, 1]], T: [0, 0, 0, 1], w0: [0.3, -0.1], alpha: 0.1, theta: 0.2, epochs: 2 },
    solution: `<p><b>(b) Epoch 1</b></p><table class="num"><thead><tr><th>x1</th><th>x2</th><th>Y<sub>d</sub></th><th>w1</th><th>w2</th><th>Y</th><th>e</th><th>new w1</th><th>new w2</th></tr></thead><tbody><tr><td>0</td><td>0</td><td>0</td><td>0.3</td><td>−0.1</td><td>0</td><td>0</td><td>0.3</td><td>−0.1</td></tr><tr><td>0</td><td>1</td><td>0</td><td>0.3</td><td>−0.1</td><td>0</td><td>0</td><td>0.3</td><td>−0.1</td></tr><tr><td>1</td><td>0</td><td>0</td><td>0.3</td><td>−0.1</td><td>1</td><td>−1</td><td>0.2</td><td>−0.1</td></tr><tr><td>1</td><td>1</td><td>1</td><td>0.2</td><td>−0.1</td><td>0</td><td>1</td><td>0.3</td><td>0.0</td></tr></tbody></table>
<p>Row 3: 0.3 − 0.2 = 0.1 ≥ 0 → Y = 1, e = −1 → w1 = 0.3 − 0.1 = 0.2. Row 4: 0.2 − 0.1 − 0.2 = −0.1 &lt; 0 → Y = 0, e = 1 → w1 = 0.3, w2 = 0.0. Epoch 2 starts from (0.3, 0.0), matching the memo table.</p>
<p><b>(a)</b> Inputs propagate forward through weighted connections to hidden and output layers; the output is compared with the target; the error is propagated backwards and every weight is adjusted (gradient descent) to reduce it. Repeat over the training set for many epochs.</p>
<p><b>(c)</b> Knowledge base (rules) + database (facts) + inference engine + explanation facilities + user interface; the developer and the user interact through interfaces, the knowledge engineer builds the knowledge base with the domain expert.</p>`,
    notes: `<ul><li>This is the Negnevitsky form: binary inputs, step output 0/1, no separate bias but a threshold θ, and e = Y<sub>d</sub> − Y.</li><li>Compare with the course’s bipolar form (y ∈ {−1, 0, 1}, Δw = α·t·x) used in the 2024/2025 papers — know both.</li></ul>`
  });
  P.push({
    id: 's15-q5', group: G15, code: '2015 Q5', title: 'GA with digit genes: f = (a+b) − (c+d) + (e+f) − (g+h)', topic: 'Genetic algorithms', marks: '15 marks', keywords: 'digit chromosome fitness one point two point crossover optimum 36',
    question: `<p>(a) Main features of GAs. (b) Chromosomes abcdefgh with digits 0–9, fitness (a + b) − (c + d) + (e + f) − (g + h). Population x1 = 65413532, x2 = 87126601, x3 = 23921285, x4 = 41852094. (i) Fitness and ranking. (ii) One-point crossover of the best two at the middle. (iii) Two-point crossover of the 2nd and 3rd best at points b and f. (iv) Fitness of the new population. (v) The optimal chromosome and its fitness.</p>`,
    sim: { engine: 'chromLab', names: ['x1', 'x2', 'x3', 'x4'], pop: ['65413532', '87126601', '23921285', '41852094'], fitness: s => { const d = [...s].map(Number); return (d[0] + d[1]) - (d[2] + d[3]) + (d[4] + d[5]) - (d[6] + d[7]); }, cross: { a: 1, b: 0, points: [4] } },
    simIntro: 'Set the cut points to 4 for (ii), then choose x1 and x3 with points 2,6 for (iii).',
    solution: `<p><b>(a)</b> Encoding, fitness evaluation, selection, crossover, mutation.</p>
<p><b>(i)</b> f(x1) = 11 − 5 + 8 − 5 = 9; f(x2) = 15 − 3 + 12 − 1 = 23; f(x3) = 5 − 11 + 3 − 13 = −16; f(x4) = 5 − 13 + 2 − 13 = −19. Order: <b>x2, x1, x3, x4</b>.</p>
<p><b>(ii)</b> x2 × x1 at the middle: O1 = 8712|3532 = <b>87123532</b>, O2 = 6541|6601 = <b>65416601</b>.</p>
<p><b>(iii)</b> x1 × x3, cuts after b and after f: O3 = 65|9212|32 = <b>65921232</b>, O4 = 23|4135|85 = <b>23413585</b>.</p>
<p><b>(iv)</b> f(O1) = 15 − 3 + 8 − 5 = 15; f(O2) = 11 − 5 + 12 − 1 = 17; f(O3) = 11 − 11 + 3 − 5 = −2; f(O4) = 5 − 5 + 8 − 13 = −5. Average rose from (9 + 23 − 16 − 19)/4 = −0.75 to (15 + 17 − 2 − 5)/4 = 6.25: the population improved (though the best fell from 23 to 17).</p>
<p><b>(v)</b> Maximise the plus pairs and zero the minus pairs: <b>99009900</b>, fitness 18 + 18 = <b>36</b>.</p>`,
    notes: `<ul><li>“Points b and f” means cut after gene b and after gene f: the middle segment cdef is swapped.</li><li>Compare the average, not just the best, when asked whether the population improved.</li></ul>`
  });
  P.push({
    id: 's15-theory', group: G15, code: '2015 Q1', title: 'Theory: intelligent agents and multi-agent systems', topic: 'Agents & foundations', keywords: 'intelligent agent simple reflex model based multi agent application',
    question: `<p>(a) Discuss one specific AI application. (b) Define “intelligent agent”; contrast a simple reflex agent with a model-based agent. (c) Define a multi-agent system and give an example.</p>`,
    sim: { engine: 'quiz', items: [
      { n: 'a', q: 'One specific AI application.', a: 'Any specific example discussed with what needs intelligence: e.g. self-driving cars (perception from cameras/LiDAR, planning, decision making under uncertainty), space exploration rovers, medical image diagnosis, fraud detection.' },
      { n: 'b', q: 'Intelligent agent; simple reflex vs model-based.', a: 'An intelligent agent is an autonomous entity that perceives its environment and acts on it to achieve goals. A simple reflex agent acts on a rule matching the current percept only; a model-based reflex agent keeps an internal model of the world’s state (updated from percept history) and then chooses its action from rules in the same way.' },
      { n: 'c', q: 'Multi-agent system.', a: 'A system of several intelligent agents whose behaviour is coordinated and cooperative (or competitive) — e.g. robot soccer teams, traffic-light controllers negotiating flow, trading agents.' }] },
    solution: `<p>See the cards. Use concrete, specific examples — markers want the application and what makes it intelligent.</p>`,
    notes: `<ul><li>Agent types in order of sophistication: simple reflex → model-based reflex → goal-based → utility-based → learning agent.</li></ul>`
  });

  const GF = 'Practice final (Studocu)';
  P.push({
    id: 'pf-long', group: GF, code: 'Q1, 2, 4, 5', title: 'Rationality, Monkey and Bananas, chaining, knowledge acquisition', topic: 'Agents & foundations', keywords: 'rationality monkey bananas state space forward backward chaining knowledge acquisition paradox expert systems',
    question: `<p>Q1 Define rationality for an agent, contrast with human intelligence, and explain how observability and determinism affect it. Q2 Formulate the Monkey and Bananas problem as state-space search (initial state, goal test, successor function, cost). Q4 Compare forward and backward chaining; give a case where backward chaining is more efficient. Q5 Knowledge acquisition, the knowledge-engineering paradox, and two advantages and disadvantages of expert systems.</p>`,
    sims: [{ engine: 'proof', title: 'Q2 Monkey and Bananas: a plan through the state space', clauseTitle: 'Formulation', stepTitle: 'Plan', clauses: [{ id: 'S', t: 'state = (monkey position, box position, monkeyOnBox, hasBananas)' }, { id: 'S0', t: 'start = (Door, Window, false, false)' }, { id: 'GT', t: 'goal test: hasBananas = true' }, { id: 'A1', t: 'Walk(x→y): monkey on floor' }, { id: 'A2', t: 'Push(box, x→y): monkey and box both at x, monkey on floor' }, { id: 'A3', t: 'ClimbUp: monkey at box, on floor' }, { id: 'A4', t: 'Grasp: monkey on box, box under bananas (Middle)' }],
      steps: [{ goals: ['(Door, Window, F, F)'], uses: ['S0'], text: 'Start: monkey at the door, box at the window, bananas hanging in the middle.' }, { goals: ['(Window, Window, F, F)'], uses: ['A1'], text: 'Walk(Door → Window), cost 1.' }, { goals: ['(Middle, Middle, F, F)'], uses: ['A2'], text: 'Push(box, Window → Middle), cost 1.' }, { goals: ['(Middle, Middle, T, F)'], uses: ['A3'], text: 'ClimbUp, cost 1.' }, { goals: ['(Middle, Middle, T, T)'], uses: ['A4', 'GT'], text: 'Grasp, cost 1 — goal test passes. Total cost 4 (each action costs 1).' }] }],
    solution: `<p><b>Q1</b> A rational agent chooses, for each percept sequence, the action expected to maximise its performance measure given what it knows. It is about doing the right thing, not about thinking like a human: humans are not always rational, and rationality ≠ omniscience (it maximises expected, not actual, outcome). In a fully observable, deterministic environment the agent can plan exactly; partial observability forces it to keep internal state and reason about what it cannot see, and stochastic outcomes force it to maximise expected utility — it can act rationally and still fail.</p>
<p><b>Q2</b> State (monkeyPos, boxPos, onBox, hasBananas) with positions {Door, Window, Middle}. Initial (Door, Window, false, false). Goal: hasBananas = true. Successors: Walk(x, y) if on the floor; Push(box, x, y) if monkey and box are both at x and the monkey is on the floor; ClimbUp if at the box on the floor; Grasp if on the box and the box is under the bananas. Cost 1 per action. Optimal plan: Walk, Push, ClimbUp, Grasp (cost 4).</p>
<p><b>Q4</b> Forward chaining is data-driven: start from known facts, fire every rule whose conditions hold, add conclusions, repeat until the goal appears or nothing changes. Backward chaining is goal-driven: start from the query, find rules that conclude it, and recursively prove their conditions. Backward chaining is more efficient when there are many facts and rules but one specific question, e.g. a medical system asked “does the patient have flu?” — it only explores rules relevant to flu, while forward chaining would derive every consequence of all symptoms.</p>
<p><b>Q5</b> Knowledge acquisition: the knowledge engineer extracts, structures and encodes a domain expert’s knowledge (interviews, case studies, observation, prototyping) into rules. The knowledge-engineering paradox: the more expert someone is, the more their knowledge is compiled and intuitive, so the harder it is for them to explain it. Advantages: consistent, always available, cheap to copy, can explain their reasoning. Disadvantages: brittle outside their narrow domain, cannot learn by themselves, costly to build and maintain, no common sense.</p>`,
    notes: `<ul><li>Formulation questions always want the same parts: state, initial state, actions/successor, goal test, path cost.</li><li>Rationality depends on four things: performance measure, prior knowledge, available actions, percept sequence.</li></ul>`
  });
  P.push({
    id: 'pf-q3', group: GF, code: 'Q3', title: 'GA: count of ones, roulette-wheel selection', topic: 'Genetic algorithms', marks: '5 marks', keywords: 'roulette wheel proportional selection number of ones fitness probability crossover point 3',
    question: `<p>8-bit strings, fitness = number of ones. Population (n = 4): A 11011000, B 01101110, C 00011101, D 00110100. Crossover rate 0.7 (at point 3), mutation rate 0.001. Calculate each fitness, describe roulette-wheel selection and give each chromosome’s selection probability.</p>`,
    sim: { engine: 'chromLab', names: ['A', 'B', 'C', 'D'], pop: ['11011000', '01101110', '00011101', '00110100'], fitness: s => [...s].filter(c => c === '1').length, roulette: true, cross: { a: 1, b: 0, points: [3] } },
    solution: `<p>Fitness: A = 4, B = 5, C = 4, D = 3; total 16.</p><p>Roulette wheel: give each chromosome a slice of the wheel proportional to its fitness, P(i) = f<sub>i</sub> / Σf; spin (draw r in [0, 16)) and walk the running total until it exceeds r; repeat once per parent. Fitter chromosomes are chosen more often but everyone can be chosen.</p>
<p>P(A) = 4/16 = <b>0.25</b>, P(B) = 5/16 = <b>0.3125</b>, P(C) = 4/16 = <b>0.25</b>, P(D) = 3/16 = <b>0.1875</b>. Running totals 4, 9, 13, 16.</p>
<p>Example crossover at point 3 (B × A): 011|01110 and 110|11000 → 01111000 and 11001110 (fitness 4 and 5). With p<sub>m</sub> = 0.001 per bit, a mutation is expected only about once every 1000 bits.</p>`,
    notes: `<ul><li>Roulette needs non-negative fitness; a chromosome with fitness 0 can never be chosen.</li></ul>`
  });
  P.push({
    id: 'pf-mcq', group: GF, code: 'Q6–15', title: 'Multiple choice (10 questions)', topic: 'Agents & foundations', keywords: 'stratification admissible mutation static declarative visited sigmoid beta cut agent function uniform cost',
    question: `<p>Ten 2-mark multiple-choice questions covering data splits, heuristics, GAs, environments, Prolog, search, activation functions, alpha-beta, agents and optimal search.</p>`,
    sim: { engine: 'quiz', items: [
      { n: 6, q: 'Which technique keeps the class ratios of the original dataset in both training and validation sets?', options: ['Cloning', 'Stratification', 'Normalization', 'Pruning'], answer: 1, why: 'Stratified splitting samples each class in proportion.' },
      { n: 7, q: 'Primary characteristic of an admissible heuristic in A*?', options: ['It always overestimates the cost to the goal', 'It never overestimates the cost to the goal', 'It uses Manhattan distance only', 'It requires a weighted directed graph'], answer: 1, why: 'h(n) ≤ h*(n) for every n.' },
      { n: 8, q: 'In a GA, which operator mainly explores new parts of the search space and keeps diversity?', options: ['Crossover', 'Proportional selection', 'Mutation', 'Parsimony pressure'], answer: 2, why: 'Only mutation introduces new allele values.' },
      { n: 9, q: 'A static environment is one where…', options: ['it changes while the agent deliberates', 'it does not change while the agent deliberates', 'it is fully observable', 'the next state is fixed by state and action'], answer: 1, why: 'Option D describes deterministic, C fully observable.' },
      { n: 10, q: 'In Prolog, “declarative” means…', options: ['the program states exactly how to compute step by step', 'the program describes facts and logic rather than control flow', 'the program uses loops', 'the program needs a GUI'], answer: 1, why: 'You state what is true; Prolog’s search decides how.' },
      { n: 11, q: 'Why keep a list of visited nodes in BFS/DFS?', options: ['to follow weighted paths', 'to avoid infinite loops by not revisiting states', 'to store heuristic values', 'to compute the branching factor'], answer: 1, why: 'On graphs with cycles, revisiting states can loop forever.' },
      { n: 12, q: 'Which activation function is 1 / (1 + e<sup>−x</sup>)?', options: ['Tanh', 'Step', 'Sigmoid', 'ReLU'], answer: 2, why: 'The logistic sigmoid, range (0, 1).' },
      { n: 13, q: 'In alpha-beta, a beta-cut occurs when…', options: ['the node’s value exceeds its ancestor’s alpha', 'a MIN node finds a value ≤ alpha', 'a MAX node finds a value ≥ beta', 'the search reaches a leaf'], answer: 2, why: 'A MAX node reaching v ≥ β is cut (β-cut); a MIN node reaching v ≤ α is an α-cut.' },
      { n: 14, q: 'What is an agent function?', options: ['the code that implements the agent', 'an abstract mapping from percept sequences to actions', 'the sensors', 'the actuators'], answer: 1, why: 'The code is the agent program.' },
      { n: 15, q: 'Which search is guaranteed to find the shortest path with non-negative edge weights?', options: ['Depth-first', 'Uniform-cost', 'Greedy best-first', 'Hill climbing'], answer: 1, why: 'UCS expands in order of path cost.' }] },
    solution: `<p>Answers: 6 B · 7 B · 8 C · 9 B · 10 B · 11 B · 12 C · 13 C · 14 B · 15 B.</p>`,
    notes: `<ul><li>Name the cut by the bound that triggers it: β-cut at MAX nodes (v ≥ β), α-cut at MIN nodes (v ≤ α).</li></ul>`
  });
  P.push({
    id: 'pf-short', group: GF, code: 'Q16–20', title: 'Short answers: FOL, membership/2, a perceptron sum, semantic nets, GP bloat', topic: 'Agents & foundations', keywords: 'predicate logic UKZN loves AI membership prolog perceptron weighted sum semantic network inheritance bloat genetic programming',
    question: `<p>Q16 FOL for “Every student at UKZN loves Artificial Intelligence” with S(x), U(x), L(x, y). Q17 membership(X, List) without member/2. Q18 Perceptron with X = (0.5, 1.0, 2.0), W = (0.2, −0.5, 0.8), b = −0.1, step f(net) = 1 if net ≥ 0 else 0: give net and the output. Q19 Semantic networks and inheritance. Q20 Bloat in genetic programming.</p>`,
    sim: { engine: 'quiz', items: [
      { n: 16, q: 'Every student at UKZN loves AI.', a: '∀x (S(x) ∧ U(x)) → L(x, AI). The main connective under ∀ is →; writing ∧ would claim everyone is a UKZN student.' },
      { n: 17, q: 'membership(X, List)', a: '<pre>membership(X, [X|_]).\nmembership(X, [_|T]) :- membership(X, T).</pre>' },
      { n: 18, q: 'Perceptron weighted sum and output.', a: 'net = (0.5)(0.2) + (1.0)(−0.5) + (2.0)(0.8) + (−0.1) = 0.1 − 0.5 + 1.6 − 0.1 = <b>1.1</b>. 1.1 ≥ 0, so the output is <b>1</b>.' },
      { n: 19, q: 'Semantic networks and inheritance.', a: 'A graph whose nodes are concepts or objects and whose labelled arcs are relations. “is-a” (subclass) and “instance-of” arcs form a hierarchy: a node inherits every property of the nodes above it unless it overrides one (e.g. Clyde inherits “grey” from Elephant and “has head” from Mammal).' },
      { n: 20, q: 'Bloat in genetic programming.', a: 'Program trees grow larger over generations without improving fitness, largely through redundant “introns” (code with no effect). It is a curse because big trees are slow to evaluate, use memory, slow down search and generalise worse. Controls: depth/size limits, parsimony pressure (penalise size in fitness).' }] },
    solution: `<p>Q16 ∀x (S(x) ∧ U(x)) → L(x, AI) · Q17 see the cards · Q18 net = 1.1, output 1 · Q19 inheritance through is-a/instance-of arcs · Q20 uncontrolled growth of program size without fitness gain.</p>`,
    notes: `<ul><li>Q18 trap: include the bias, and use ≥ 0 exactly as the question defines the step.</li></ul>`
  });
})(window.AIN);

/* ---- app.js ---- */
/* AI Notes app shell: sidebar, problem page, personal notes (API or browser storage) */
(function (A) {
  const store = {
    api: null, token: null, tokenUrl: null, offline: false,
    local: {
      get(id) { try { return localStorage.getItem('ainotes:' + id) || ''; } catch (e) { return ''; } },
      set(id, t) { try { localStorage.setItem('ainotes:' + id, t); return true; } catch (e) { return false; } }
    },
    isJson: r => (r.headers.get('content-type') || '').includes('application/json'),
    async ensureToken() {
      if (this.token || !this.tokenUrl) return;
      try { const r = await fetch(this.tokenUrl, { credentials: 'same-origin' }); if (r.ok && !r.redirected && this.isJson(r)) this.token = (await r.json()).token; } catch (e) { }
    },
    async load(id) {
      if (this.api && !this.offline) {
        try {
          const r = await fetch(`${this.api}/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
          if (r.ok && !r.redirected && this.isJson(r)) { const j = await r.json(); return j.content || ''; }
          this.offline = true; // not signed in (redirected to login) or API missing
        } catch (e) { this.offline = true; }
      }
      return this.local.get(id);
    },
    // returns where it was saved: 'account' or 'browser'
    async save(id, text) {
      if (this.api && !this.offline) {
        await this.ensureToken();
        const headers = { 'Content-Type': 'application/json' }; if (this.token) headers['RequestVerificationToken'] = this.token;
        try {
          const r = await fetch(`${this.api}/${encodeURIComponent(id)}`, { method: 'PUT', credentials: 'same-origin', headers, body: JSON.stringify({ content: text }), redirect: 'manual' });
          if (r.ok && this.isJson(r)) return 'account';
        } catch (e) { }
        this.offline = true;
      }
      if (!this.local.set(id, text)) throw new Error('storage unavailable');
      return 'browser';
    }
  };
  A.mount = function (root, opts = {}) {
    store.api = opts.notesApi || null; store.token = opts.antiforgeryToken || null; store.tokenUrl = opts.tokenUrl || null; store.offline = false;
    const probs = A.problems;
    const groups = [...new Set(probs.map(p => p.group))];
    const topics = [...new Set(probs.map(p => p.topic))].sort();
    root.innerHTML = '';
    root.classList.add('ain');
    const side = A.h('nav', { class: 'ain-side', 'aria-label': 'Problems' });
    const main = A.h('main', { class: 'ain-main', id: 'ain-main' });
    const search = A.h('input', { class: 'inp side-search', id: 'ain-search', type: 'search', placeholder: 'Search problems…', 'aria-label': 'Search problems' });
    const topicSel = A.h('select', { class: 'sel', id: 'ain-topic', 'aria-label': 'Filter by topic' }, A.h('option', { value: '' }, 'All topics'), ...topics.map(t => A.h('option', { value: t }, t)));
    const list = A.h('div', { class: 'side-list' });
    const mobileSel = A.h('select', { class: 'sel mobile-pick', id: 'ain-pick', 'aria-label': 'Choose a problem' });
    side.append(A.h('div', { class: 'side-head' }, A.h('div', { class: 'side-title' }, opts.title || 'AI exam notes'), A.h('div', { class: 'side-sub' }, `${probs.length} worked problems with simulations`), search, topicSel), list);
    root.append(mobileSel, side, main);
    groups.forEach(g => { const og = A.h('optgroup', { label: g }); probs.filter(p => p.group === g).forEach(p => og.append(A.h('option', { value: p.id }, `${p.code} · ${p.title}`))); mobileSel.append(og); });
    mobileSel.onchange = () => go(mobileSel.value);
    function renderList() {
      const q = search.value.trim().toLowerCase(), t = topicSel.value;
      list.innerHTML = '';
      for (const g of groups) {
        const items = probs.filter(p => p.group === g && (!t || p.topic === t) && (!q || (p.title + ' ' + p.code + ' ' + p.topic + ' ' + (p.keywords || '')).toLowerCase().includes(q)));
        if (!items.length) continue;
        list.append(A.h('div', { class: 'side-group' }, g));
        items.forEach(p => list.append(A.h('a', { href: '#' + p.id, class: 'side-item' + (p.id === cur ? ' on' : ''), 'data-id': p.id }, A.h('span', { class: 'si-code' }, p.code), A.h('span', { class: 'si-title' }, p.title))));
      }
      if (!list.children.length) list.append(A.h('p', { class: 'muted' }, 'No problems match.'));
    }
    search.oninput = renderList; topicSel.onchange = renderList;
    let cur = null;
    function go(id) { if (location.hash !== '#' + id) location.hash = id; else show(id); }
    async function show(id) {
      const p = probs.find(x => x.id === id) || probs[0];
      cur = p.id; mobileSel.value = p.id; renderList();
      const idx = probs.indexOf(p);
      main.innerHTML = '';
      const head = A.h('header', { class: 'p-head' },
        A.h('div', { class: 'p-tags' }, A.h('span', { class: 'tag src' }, p.group), A.h('span', { class: 'tag' }, p.code), A.h('span', { class: 'tag topic' }, p.topic), p.marks ? A.h('span', { class: 'tag' }, p.marks) : null),
        A.h('h1', null, p.title));
      const jump = A.h('div', { class: 'jump scroll' }, ...[['q', 'Question'], ['sim', 'Simulation'], ['sol', 'Solution'], ['notes', 'Study notes'], ['mine', 'My notes']].map(([k, t]) => A.h('a', { href: '#' + p.id, onclick: e => { e.preventDefault(); main.querySelector('#s-' + k)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, t)));
      main.append(head, jump);
      const sec = (k, title, body) => { const s = A.h('section', { class: 'card s-' + k, id: 's-' + k }, A.h('h2', null, title)); if (typeof body === 'string') s.append(A.h('div', { class: 'prose', html: body })); else if (body) s.append(body); main.append(s); return s; };
      sec('q', 'Question', p.question);
      const simS = sec('sim', 'Simulation', null);
      const simHost = A.h('div', { class: 'sim' }); simS.append(simHost);
      if (p.simIntro) simS.insertBefore(A.h('p', { class: 'sim-intro', html: p.simIntro }), simHost);
      try { (p.sims || [p.sim]).filter(Boolean).forEach((sm, k) => { const h = A.h('div', { class: 'simpart' }); if (sm.title) h.append(A.h('h3', null, sm.title)); simHost.append(h); A.engines[sm.engine](h, { id: p.id + '-' + k, ...sm }); }); }
      catch (e) { simHost.append(A.h('p', { class: 'bad' }, 'This simulation failed to load: ' + e.message)); console.error(e); }
      sec('sol', 'Solution', p.solution);
      sec('notes', 'Study notes', p.notes);
      const ta = A.h('textarea', { class: 'mynotes', id: 'mynotes-' + p.id, rows: 7, placeholder: 'Write your own notes for this problem. They save automatically.' });
      const status = A.h('span', { class: 'muted save-status', 'aria-live': 'polite' }, store.api ? 'Saved to your account' : 'Saved in this browser');
      const mine = sec('mine', 'My notes', null);
      mine.append(A.h('label', { for: ta.id, class: 'sr' }, 'My notes'), ta, status);
      ta.value = await store.load(p.id);
      if (store.api && store.offline) status.textContent = 'Sign in to save notes to your account — for now they save in this browser.';
      let t = null; ta.oninput = () => { status.textContent = 'Saving…'; clearTimeout(t); t = setTimeout(async () => { try { const where = await store.save(p.id, ta.value); const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); status.textContent = where === 'account' ? `Saved to your account ${time}` : (store.api ? `Not signed in: saved in this browser only ${time}` : `Saved in this browser ${time}`); } catch (e) { status.textContent = 'Could not save — check your connection.'; } }, 700); };
      const nav = A.h('div', { class: 'pnav' });
      if (idx > 0) nav.append(A.h('a', { href: '#' + probs[idx - 1].id, class: 'btn' }, '← ' + probs[idx - 1].title));
      if (idx < probs.length - 1) nav.append(A.h('a', { href: '#' + probs[idx + 1].id, class: 'btn primary' }, probs[idx + 1].title + ' →'));
      main.append(nav);
      main.scrollTop = 0; if (opts.scrollToTop !== false) window.scrollTo({ top: 0 });
    }
    window.addEventListener('hashchange', () => show(location.hash.slice(1)));
    show(location.hash.slice(1) || opts.start || probs[0].id);
  };
})(window.AIN);
