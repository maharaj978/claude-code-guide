/* ==========================================================================
   Claude Code Mastery — app.js
   Handles: theme, level toggle, scrollspy, copy buttons,
            Cmd+K palette, session-feel demo, disambiguation quiz
   ========================================================================== */

'use strict';

// ── Utils ─────────────────────────────────────────────────────────────────

function $(sel, ctx) { return (ctx || document).querySelector(sel); }
function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

function store(key, val) {
  try { localStorage.setItem(key, val); } catch (_) {}
}
function recall(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; }
}

// ── Theme ─────────────────────────────────────────────────────────────────

function initTheme() {
  const saved = recall('cc-theme', 'dark');
  applyTheme(saved);

  const btn = $('#theme-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    store('cc-theme', next);
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = $('#theme-btn');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
}

// ── Level toggle (Beginner / Both / Advanced) ─────────────────────────────

const LEVELS = ['beginner', 'both', 'advanced'];

function initLevelToggle() {
  const saved = recall('cc-level', 'both');
  applyLevel(saved);

  $$('.level-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      const lvl = btn.dataset.level;
      applyLevel(lvl);
      store('cc-level', lvl);
    });
  });

  // "Show advanced / Show beginner" disclosure buttons inside stubs
  document.addEventListener('click', e => {
    if (e.target.closest('.level-stub .disclosure')) {
      const section = e.target.closest('section');
      if (section) section.classList.toggle('expanded');
    }
  });
}

function applyLevel(level) {
  document.documentElement.dataset.level = level;

  $$('.level-toggle button').forEach(btn => {
    btn.setAttribute('aria-pressed', btn.dataset.level === level ? 'true' : 'false');
  });

  updateSidebarForLevel(level);

  // Let scrollspy re-register after display states change
  document.documentElement.dispatchEvent(new CustomEvent('dataset-level-changed'));
}

function updateSidebarForLevel(level) {
  $$('.sidebar-nav a[data-level]').forEach(a => {
    const tag = a.querySelector('.nav-tag');
    if (!tag) return;
    const aLevel = a.dataset.level;
    if (level === 'advanced' && aLevel === 'beginner') {
      tag.textContent = 'beg';
      tag.classList.add('beg');
    } else {
      tag.textContent = '';
    }
  });
}

// ── Scrollspy ─────────────────────────────────────────────────────────────

function initScrollspy() {
  const links = $$('.sidebar-nav a[href^="#"]');
  if (!links.length) return;

  const ids = links.map(a => a.getAttribute('href').slice(1));
  const targets = ids.map(id => document.getElementById(id)).filter(Boolean);

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { rootMargin: '-20% 0% -70% 0%', threshold: 0 });

  function observe() {
    // Disconnect first to avoid duplicate observations on re-call
    observer.disconnect();
    targets.forEach(t => observer.observe(t));
  }

  observe();

  // Re-observe when level changes (collapsed sections change scroll geometry)
  document.documentElement.addEventListener('dataset-level-changed', () => {
    // Small delay to let CSS transitions settle
    setTimeout(observe, 50);
  });
  // Also re-observe when individual sections are expanded via disclosure
  const mo = new MutationObserver(() => setTimeout(observe, 50));
  $$('section[data-level]').forEach(s => mo.observe(s, { attributes: true, attributeFilter: ['class'] }));
}

// ── Copy buttons ──────────────────────────────────────────────────────────

function initCopyButtons() {
  // Event-delegated: works for all <pre> including ones added later
  document.addEventListener('click', e => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;
    const pre = btn.closest('pre');
    const code = pre ? pre.querySelector('code') : null;
    const text = code ? code.innerText : (pre ? pre.innerText : '');
    // Strip "Copied!" button text from content
    copyText(text.replace(/Copied!/g, '').trim(), btn);
  });
}

function copyText(text, btn) {
  const succeed = () => {
    if (!btn) return;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 1500);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(succeed).catch(() => fallbackCopy(text, btn, succeed));
  } else {
    fallbackCopy(text, btn, succeed);
  }
}

function fallbackCopy(text, btn, cb) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    cb();
  } catch (_) {}
  document.body.removeChild(ta);
}

// Inject copy buttons into all <pre> blocks
function injectCopyButtons() {
  $$('pre').forEach(pre => {
    if (pre.querySelector('.copy-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy to clipboard');
    pre.appendChild(btn);
  });
}

// ── Palette (Cmd+K) ───────────────────────────────────────────────────────

let paletteItems = [];
let filteredItems = [];
let paletteSelectedIdx = 0;
let paletteShowAll = false;

function buildPaletteIndex() {
  paletteItems = [];

  // Sections
  $$('section[id]').forEach(s => {
    const h2 = s.querySelector('h2');
    if (!h2) return;
    paletteItems.push({
      kind: 'section',
      title: h2.textContent.replace(/[#↑]/g, '').trim(),
      href: '#' + s.id,
      level: s.dataset.level || 'both',
    });
  });

  // Slash commands from table rows with data-cmd
  $$('tr[data-cmd]').forEach(tr => {
    const cmd = tr.dataset.cmd;
    const desc = tr.querySelector('.cmd-desc')?.textContent || tr.cells[1]?.textContent || '';
    paletteItems.push({
      kind: 'slash cmd',
      title: cmd,
      href: tr.closest('section') ? '#' + tr.closest('section').id : '',
      desc: desc.trim(),
      level: tr.dataset.level || 'both',
    });
  });

  // Keyboard shortcuts from table rows with data-shortcut
  $$('tr[data-shortcut]').forEach(tr => {
    const sh = tr.dataset.shortcut;
    const desc = tr.cells[1]?.textContent || '';
    paletteItems.push({
      kind: 'shortcut',
      title: sh,
      href: '#shortcuts',
      desc: desc.trim(),
      level: 'both',
    });
  });

  // CLI flags from table rows with data-flag
  $$('tr[data-flag]').forEach(tr => {
    const flag = tr.dataset.flag;
    const desc = tr.cells[1]?.textContent || '';
    paletteItems.push({
      kind: 'cli flag',
      title: flag,
      href: '#reference',
      desc: desc.trim(),
      level: tr.dataset.level || 'both',
    });
  });
}

function fuzzyScore(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return q.length * 2;
  let score = 0, qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) { score++; qi++; }
  }
  return qi === q.length ? score : 0;
}

function openPalette() {
  const overlay = $('#palette-overlay');
  if (!overlay) return;
  overlay.setAttribute('aria-hidden', 'false');
  $('#palette-input')?.focus();
  paletteShowAll = false;
  renderPalette('');
}

function closePalette() {
  const overlay = $('#palette-overlay');
  if (!overlay) return;
  overlay.setAttribute('aria-hidden', 'true');
  if ($('#palette-input')) $('#palette-input').value = '';
}

function renderPalette(query) {
  const currentLevel = document.documentElement.dataset.level || 'both';

  // Score all items; keep those matching the query (or all if query is empty)
  const scored = paletteItems
    .map(item => ({
      item,
      score: fuzzyScore(query, item.title + ' ' + (item.desc || '')),
    }))
    .filter(({ score }) => query.length === 0 || score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  // In beginner mode, hide beginner-irrelevant items unless paletteShowAll
  // Advanced items are shown dimmed with a tag rather than hidden outright.
  // In advanced mode, beginner-only items are hidden.
  filteredItems = scored
    .filter(({ item }) => {
      if (paletteShowAll || currentLevel === 'both') return true;
      if (currentLevel === 'advanced' && item.level === 'beginner') return false;
      return true; // beginner mode: keep everything (advanced dimmed below)
    })
    .map(({ item }) => item)
    .slice(0, 40);

  const ul = $('#palette-results');
  const emptyEl = $('#palette-empty');
  if (!ul) return;

  if (filteredItems.length === 0) {
    ul.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  ul.innerHTML = filteredItems.map((item, i) => {
    const isAdvancedInBegMode = currentLevel === 'beginner' && item.level === 'advanced' && !paletteShowAll;
    const tag = isAdvancedInBegMode ? `<span class="palette-result-tag">advanced</span>` : '';
    const grayed = isAdvancedInBegMode ? ' style="opacity:0.5"' : '';
    const titleCls = (item.kind === 'slash cmd' || item.kind === 'cli flag') ? 'mono' : '';
    return `<li role="option" tabindex="-1" aria-selected="${i === 0 ? 'true' : 'false'}" data-idx="${i}"${grayed}>
      <span class="palette-result-kind">${item.kind}</span>
      <span class="palette-result-title"><span class="${titleCls}">${item.title}</span></span>
      ${tag}
    </li>`;
  }).join('');

  paletteSelectedIdx = 0;
  updatePaletteSelection();
}

function updatePaletteSelection() {
  const items = $$('#palette-results li');
  items.forEach((li, i) => {
    li.classList.toggle('selected', i === paletteSelectedIdx);
    li.setAttribute('aria-selected', i === paletteSelectedIdx ? 'true' : 'false');
  });
  items[paletteSelectedIdx]?.scrollIntoView({ block: 'nearest' });
}

function activatePaletteItem(idx) {
  const item = filteredItems[idx];
  if (!item || !item.href) return;
  closePalette();
  const target = document.querySelector(item.href);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // If section is collapsed, expand it
    const section = target.closest('section') || (target.tagName === 'SECTION' ? target : null);
    if (section) section.classList.add('expanded');
  }
}

function initPalette() {
  // Open on Cmd+K or Ctrl+K
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const overlay = $('#palette-overlay');
      const isOpen = overlay?.getAttribute('aria-hidden') === 'false';
      isOpen ? closePalette() : openPalette();
    }
    if (e.key === 'Escape') closePalette();
  });

  // Close on overlay click
  $('#palette-overlay')?.addEventListener('click', e => {
    if (e.target === $('#palette-overlay')) closePalette();
  });

  // Input
  $('#palette-input')?.addEventListener('input', e => {
    renderPalette(e.target.value.trim());
    paletteSelectedIdx = 0;
    updatePaletteSelection();
  });

  // Keyboard nav inside palette
  $('#palette-input')?.addEventListener('keydown', e => {
    const items = $$('#palette-results li');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      paletteSelectedIdx = Math.min(paletteSelectedIdx + 1, items.length - 1);
      updatePaletteSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      paletteSelectedIdx = Math.max(paletteSelectedIdx - 1, 0);
      updatePaletteSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activatePaletteItem(paletteSelectedIdx);
    }
  });

  // Click on result
  document.addEventListener('click', e => {
    const li = e.target.closest('#palette-results li');
    if (!li) return;
    const idx = parseInt(li.dataset.idx, 10);
    if (!isNaN(idx)) activatePaletteItem(idx);
  });

  // Show all button
  $('#palette-show-all')?.addEventListener('click', () => {
    paletteShowAll = true;
    renderPalette($('#palette-input')?.value.trim() || '');
  });
}

// ── Session-feel demo ──────────────────────────────────────────────────────

const DEMO_SCRIPTS = {
  '/help': {
    label: '# press /help',
    lines: [
      { t: 100,  cls: 'demo-prompt', text: '> /help' },
      { t: 300,  cls: '',            text: '' },
      { t: 350,  cls: 'demo-faint',  text: 'Claude Code — available commands:' },
      { t: 400,  cls: '',            text: '' },
      { t: 450,  cls: '',            text: '  /clear         Clear conversation history' },
      { t: 490,  cls: '',            text: '  /compact       Summarise context to reduce tokens' },
      { t: 530,  cls: '',            text: '  /model         Switch the active model' },
      { t: 570,  cls: '',            text: '  /memory        View/edit CLAUDE.md memory files' },
      { t: 610,  cls: '',            text: '  /resume        Resume a prior session' },
      { t: 650,  cls: '',            text: '  /cost          Show token cost for this session' },
      { t: 690,  cls: '',            text: '  /agents        Manage background sessions' },
      { t: 730,  cls: '',            text: '  /mcp           Configure MCP servers' },
      { t: 770,  cls: '',            text: '  /doctor        Check Claude Code health' },
      { t: 810,  cls: 'demo-faint',  text: '' },
      { t: 840,  cls: 'demo-faint',  text: '  Type /help <command> for details.' },
    ]
  },
  'shift+tab': {
    label: '# Shift+Tab cycles modes',
    lines: [
      { t: 100,  cls: 'demo-faint', text: '  [mode: default — Claude asks before each tool]' },
      { t: 500,  cls: 'demo-faint', text: '  ↓ Shift+Tab' },
      { t: 900,  cls: 'demo-mode',  text: '  [mode: auto-accept edits — file edits run without asking]' },
      { t: 1400, cls: 'demo-faint', text: '  ↓ Shift+Tab' },
      { t: 1800, cls: 'demo-mode',  text: '  [mode: plan — Claude shows plan first, waits for approval]' },
      { t: 2300, cls: 'demo-faint', text: '  ↓ Shift+Tab' },
      { t: 2700, cls: 'demo-mode',  text: '  [mode: default]' },
    ]
  },
  '!ls': {
    label: '# ! prefix runs bash',
    lines: [
      { t: 100,  cls: 'demo-prompt', text: '> !ls -la src/' },
      { t: 300,  cls: 'demo-bash',   text: 'total 48' },
      { t: 320,  cls: 'demo-bash',   text: 'drwxr-xr-x  8  user  staff   256 Jun  4 10:22 .' },
      { t: 340,  cls: 'demo-bash',   text: '-rw-r--r--  1  user  staff  3241 Jun  4 10:20 app.ts' },
      { t: 360,  cls: 'demo-bash',   text: '-rw-r--r--  1  user  staff  1102 Jun  3 18:44 index.ts' },
      { t: 380,  cls: 'demo-bash',   text: 'drwxr-xr-x  3  user  staff    96 Jun  2 09:01 utils' },
      { t: 400,  cls: 'demo-faint',  text: '' },
      { t: 430,  cls: 'demo-faint',  text: '(bash output appears inline; Claude can see it too)' },
    ]
  },
  '#note': {
    label: '# # adds a session note',
    lines: [
      { t: 100,  cls: 'demo-prompt', text: '> # The auth module uses JWT, not sessions' },
      { t: 350,  cls: 'demo-mem',    text: '  ✓ Note added to session memory' },
      { t: 500,  cls: 'demo-faint',  text: '' },
      { t: 530,  cls: 'demo-faint',  text: '  Claude will use this for the rest of the session.' },
      { t: 560,  cls: 'demo-faint',  text: '  For permanent memory, add to .claude/CLAUDE.md instead.' },
    ]
  },
  '@file': {
    label: '# @file references a file',
    lines: [
      { t: 100,  cls: 'demo-prompt', text: '> @src/auth.ts Find the JWT expiry bug' },
      { t: 200,  cls: 'demo-faint',  text: '  ↳ src/auth.ts added to context (3.2 KB)' },
      { t: 380,  cls: 'demo-faint',  text: '' },
      { t: 400,  cls: 'demo-faint',  text: '  Tip: cheaper than pasting — the file is read once,' },
      { t: 430,  cls: 'demo-faint',  text: '  not repeated in every turn.' },
    ]
  },
  'esc-esc': {
    label: '# Esc Esc edits last prompt',
    lines: [
      { t: 100,  cls: 'demo-prompt', text: '> Refactor the login function to use asyncs' },
      { t: 400,  cls: 'demo-faint',  text: '  ↑ oops, typo' },
      { t: 800,  cls: 'demo-faint',  text: '  [Esc Esc] ← opens previous prompt for editing' },
      { t: 1100, cls: 'demo-prompt', text: '> Refactor the login function to use async/await  ✏' },
      { t: 1300, cls: 'demo-faint',  text: '  (edit, then Enter to re-submit)' },
    ]
  },
};

function runDemoScript(key) {
  const screen = $('#demo-screen');
  if (!screen) return;
  const script = DEMO_SCRIPTS[key];
  if (!script) return;

  screen.innerHTML = '';
  let maxT = 0;
  script.lines.forEach(({ t, cls, text }) => {
    maxT = Math.max(maxT, t);
    setTimeout(() => {
      const line = document.createElement('div');
      if (cls) line.className = cls;
      line.textContent = text;
      screen.appendChild(line);
      screen.scrollTop = screen.scrollHeight;
    }, t);
  });
}

function initDemo() {
  $$('.demo-btn[data-script]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.demo-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      runDemoScript(btn.dataset.script);
    });
  });
  // Run /help by default
  setTimeout(() => runDemoScript('/help'), 400);
}

// ── Quiz ───────────────────────────────────────────────────────────────────

const QUIZ_SCENARIOS = [
  {
    q: "I want Claude to remember my coding standards across every session.",
    answer: "CLAUDE.md",
    detail: "Add your standards to <code>.claude/CLAUDE.md</code> in your project (or <code>~/.claude/CLAUDE.md</code> for all projects). Claude loads it automatically at session start.",
    href: "#memory"
  },
  {
    q: "I want to add a one-off note just for this session.",
    answer: "# prefix",
    detail: "Type <code># your note</code> at the start of a prompt. Claude adds it to session memory — it's forgotten when you close or /clear.",
    href: "#memory"
  },
  {
    q: "I want a reusable workflow I can invoke with /foo-review.",
    answer: "Skill (SKILL.md)",
    detail: "Create <code>~/.claude/skills/foo-review.md</code> with a SKILL.md frontmatter header. Then type <code>/foo-review</code> in any session.",
    href: "#skills"
  },
  {
    q: "I want Claude to investigate a codebase without polluting my main conversation context.",
    answer: "Explore subagent",
    detail: "Ask Claude to 'Use the Explore agent to investigate X.' The subagent runs read-only in isolation and reports back without touching your main context window.",
    href: "#subagents"
  },
  {
    q: "I want Claude to talk to my internal Jira, Slack, or custom API.",
    answer: "MCP server",
    detail: "Run <code>claude mcp add my-server -- npx my-mcp-package</code>. Claude can then call tools exposed by that server in any session.",
    href: "#mcp"
  },
  {
    q: "I want every Bash command Claude runs to be logged to a file.",
    answer: "Hook (PostToolUse)",
    detail: "Add a <code>PostToolUse</code> hook in <code>settings.json</code> with matcher <code>Bash</code> and a command that appends to your log file.",
    href: "#hooks"
  },
  {
    q: "I want to work on two features simultaneously without them stepping on each other.",
    answer: "Git worktrees + multi-tab",
    detail: "Use <code>git worktree add ../feat-b feat-b-branch</code> and open a second terminal there with its own <code>claude</code> session. Each session has isolated files.",
    href: "#parallel"
  },
  {
    q: "I want to script a one-shot code analysis task from CI.",
    answer: "claude -p (headless)",
    detail: "Run <code>claude -p \"Analyze this for security issues\" --output-format json > report.json</code>. No interactive session needed.",
    href: "#workflows"
  },
];

let quizIdx = 0;

function renderQuiz() {
  const container = $('#quiz-container');
  if (!container) return;
  const s = QUIZ_SCENARIOS[quizIdx];

  container.innerHTML = `
    <div class="quiz-q">${s.q}</div>
    <ul class="quiz-options" role="listbox">
      ${shuffleQuizOptions(s).map(opt => `
        <li><button class="quiz-option" data-correct="${opt.correct}" role="option">${opt.text}</button></li>
      `).join('')}
    </ul>
    <div class="quiz-answer" id="quiz-answer" hidden></div>
    <div style="margin-top:0.75rem;display:flex;gap:0.5rem;font-size:0.82rem;color:var(--text-faint)">
      <span>Scenario ${quizIdx + 1} of ${QUIZ_SCENARIOS.length}</span>
      <button id="quiz-next" style="margin-left:auto;background:transparent;border:1px solid var(--border);color:var(--text-soft);font:inherit;font-size:0.78rem;padding:2px 10px;border-radius:999px;cursor:pointer">Next →</button>
    </div>
  `;

  $$('.quiz-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const answer = $('#quiz-answer');
      if (!answer) return;
      answer.hidden = false;
      answer.innerHTML = `<span class="answer-tool">${s.answer}</span> — ${s.detail} <a href="${s.href}">→ See section</a>`;
      $$('.quiz-option').forEach(b => b.disabled = true);
    });
  });

  $('#quiz-next')?.addEventListener('click', () => {
    quizIdx = (quizIdx + 1) % QUIZ_SCENARIOS.length;
    renderQuiz();
  });
}

function shuffleQuizOptions(scenario) {
  // Generate 3 wrong answers from other scenarios, shuffle with correct
  const others = QUIZ_SCENARIOS
    .filter((_, i) => i !== quizIdx)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(s => ({ text: s.answer, correct: false }));
  const all = [...others, { text: scenario.answer, correct: true }];
  return all.sort(() => Math.random() - 0.5);
}

function initQuiz() {
  if (!$('#quiz-container')) return;
  renderQuiz();
}

// ── Sidebar mobile toggle ─────────────────────────────────────────────────

function initMobileMenu() {
  const menuBtn = $('#menu-btn');
  const app = $('.app');
  if (!menuBtn || !app) return;

  menuBtn.addEventListener('click', () => {
    const isOpen = app.dataset.sidebar === 'open';
    app.dataset.sidebar = isOpen ? '' : 'open';
    menuBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (app.dataset.sidebar === 'open' &&
        !e.target.closest('.sidebar') &&
        !e.target.closest('#menu-btn')) {
      app.dataset.sidebar = '';
    }
  });
}

// ── Power Tips scroll-reveal ──────────────────────────────────────────────

function initTipCards() {
  const cards = $$('.tip-card');
  if (!cards.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  cards.forEach(card => observer.observe(card));
}

// ── Boot ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLevelToggle();
  injectCopyButtons();
  initCopyButtons();
  initScrollspy();
  initMobileMenu();

  // Build palette index after DOM is ready, then init
  buildPaletteIndex();
  initPalette();

  initDemo();
  initQuiz();
  initTipCards();
});
