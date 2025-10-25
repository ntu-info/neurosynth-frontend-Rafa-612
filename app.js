// app.js — AJAX + Panels A/B/C/D + Related Terms (chips layout)
// ---------------------------------------------------------------
const API_BASE = 'https://mil.psy.ntu.edu.tw:5000';

/** GET helper */
async function apiGet(path) {
  const url = `${API_BASE}${path}`;
  let resp;
  try {
    resp = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json, text/plain; q=0.9,*/*;q=0.8' },
    });
  } catch (e) {
    throw new Error(`Network error: ${e}`);
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status} ${resp.statusText}\nURL: ${url}\nBody: ${body}`);
  }
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('application/json')) return await resp.json();
  return await resp.text();
}

/** Utils */
function encodeQuery(q) { return encodeURIComponent((q || '').trim()); }
function debounce(fn, delay = 300) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

/* =========================
 * Panel A: Terms (list & filter)
 * ========================= */
let TERMS_ALL = [];
let TERMS_VIEW = [];
let TERMS_RENDERED = 0;
const TERMS_PAGE = 200;

function aGetDom() {
  return {
    input: document.querySelector('#a-search'),
    list: document.querySelector('#a-list'),
    bQuery: document.querySelector('#b-query'),
    runBtn: document.querySelector('#a-run'),
  };
}
function aClearList(listEl) { listEl.innerHTML = ''; TERMS_RENDERED = 0; }
function aRenderChunk(listEl) {
  if (!Array.isArray(TERMS_VIEW)) { console.error('[aRenderChunk] TERMS_VIEW not array', TERMS_VIEW); return; }
  const next = TERMS_VIEW.slice(TERMS_RENDERED, TERMS_RENDERED + TERMS_PAGE);
  if (next.length === 0) return;
  const frag = document.createDocumentFragment();
  for (const term of next) {
    const row = document.createElement('div');
    row.className = 'py-2 px-2 hover:bg-gray-50 cursor-pointer';
    row.textContent = String(term);
    row.dataset.term = String(term);
    frag.appendChild(row);
  }
  listEl.appendChild(frag);
  TERMS_RENDERED += next.length;
}
function aResetAndRender(listEl, terms) {
  TERMS_VIEW = Array.isArray(terms) ? terms : [];
  aClearList(listEl);
  if (TERMS_VIEW.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'py-3 px-2 text-gray-500';
    empty.textContent = 'No matching terms';
    listEl.appendChild(empty);
    return;
  }
  aRenderChunk(listEl);
}
function aAttachInfiniteScroll(listEl) {
  listEl.addEventListener('scroll', () => {
    const nearBottom = listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 64;
    if (nearBottom) aRenderChunk(listEl);
  });
}
function aAttachFilter(inputEl, listEl, runBtn) {
  const doFilter = () => {
    const kw = (inputEl.value || '').trim().toLowerCase();
    if (!kw) { aResetAndRender(listEl, TERMS_ALL); return; }
    const filtered = TERMS_ALL.filter(t => String(t).toLowerCase().startsWith(kw)); // prefix-only
    aResetAndRender(listEl, filtered);
  };
  const debounced = debounce(doFilter, 200);
  inputEl.addEventListener('input', debounced);
  inputEl.addEventListener('keyup', (e) => { if (e.key === 'Enter') doFilter(); else debounced(); });

  if (runBtn) {
    runBtn.addEventListener('click', async () => {
      try {
        runBtn.disabled = true;
        runBtn.textContent = 'Refreshing…';
        const data = await apiGet('/terms');
        TERMS_ALL = Array.isArray(data) ? data : (Array.isArray(data?.terms) ? data.terms : []);
        doFilter();
      } catch (err) {
        console.error('[Panel A] Refresh terms failed:', err);
        doFilter();
      } finally {
        runBtn.textContent = 'Run';
        runBtn.disabled = false;
      }
    });
  }
}

/** 點 A 區 term → 接到 Query，立刻觸發 C 搜尋與 Related Terms 更新 */
function aAttachClickToFillB(listEl, bInputEl, cListEl, bRunBtn) {
  listEl.addEventListener('click', (e) => {
    const row = e.target.closest('[data-term]');
    if (!row || !bInputEl) return;
    const term = row.dataset.term;
    if (!term) return;

    const current = bInputEl.value || '';
    const needsSpace = current.length > 0 && !/\s$/.test(current);
    bInputEl.value = current + (needsSpace ? ' ' : '') + term;

    bInputEl.focus();
    const end = bInputEl.value.length;
    bInputEl.setSelectionRange(end, end);

    if (cListEl) runQueryAndRender(bInputEl.value, cListEl, bRunBtn);
    relUpdate(bInputEl.value);
  });
}

/* =========================
 * Panel C: Studies (render & states)
 * ========================= */
function cGetDom() {
  return {
    list: document.querySelector('#c-list'),
    runBtn: document.querySelector('#b-run'),
    header: document.querySelector('#panel-c h2'),
  };
}
function cEnsureCountBadge(headerEl) {
  if (!headerEl) return null;
  let badge = headerEl.querySelector('#c-count');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'c-count';
    badge.className = 'ml-2 inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 align-middle';
    badge.style.display = 'none';
    headerEl.appendChild(badge);
  }
  return badge;
}
function cUpdateCount(count) {
  const { header } = cGetDom();
  const badge = cEnsureCountBadge(header);
  if (!badge) return;
  if (count === null || count === undefined) {
    badge.style.display = 'none';
  } else {
    const n = Number(count) || 0;
    badge.textContent = `${n} result${n === 1 ? '' : 's'}`;
    badge.style.display = '';
  }
}
function cRenderLoading(listEl) {
  cUpdateCount(null);
  listEl.innerHTML = '<div class="py-3 px-2 text-gray-500">Searching…</div>';
}
function cRenderError(listEl, msg) {
  cUpdateCount(null);
  listEl.innerHTML = `<div class="py-3 px-2 text-red-600">${msg}</div>`;
}
function cRenderEmpty(listEl) {
  cUpdateCount(0);
  listEl.innerHTML = '<div class="py-3 px-2 text-gray-500">No studies found.</div>';
}
function cRenderPrompt(listEl) {
  cUpdateCount(null);
  listEl.innerHTML = '<div class="py-3 px-2 text-gray-500">Type a query above to search studies.</div>';
}
function normalizeStudy(item) {
  const title = item.title || item.Title || item.paper_title || 'Untitled';
  const journal = item.journal || item.Journal || item.source || '';
  const year = item.year || item.Year || item.pub_year || '';
  let authors = item.authors || item.Authors || item.author || [];
  if (Array.isArray(authors)) authors = authors.join(', ');
  const id = item.id || item.pmid || item.doi || title;
  return { id, title, journal, year, authors };
}
function coerceStudiesArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  if (data && Array.isArray(data.studies)) return data.studies;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.results)) return parsed.results;
      if (parsed && Array.isArray(parsed.studies)) return parsed.studies;
    } catch (_) {}
  }
  return [];
}

/* =========================
 * Panel REL: Related Terms (chips)
 * ========================= */
function relGetDom() {
  return {
    list: document.querySelector('#rel-list'),
    countBadge: document.querySelector('#rel-count'),
    queryInput: document.querySelector('#b-query'),
  };
}

// 依據 { related: [ { term, co_count, jaccard }, ... ] }
function relCoerceItems(data) {
  try {
    const obj = (typeof data === 'string') ? JSON.parse(data) : data;
    let arr = [];
    if (obj && Array.isArray(obj.related)) {
      arr = obj.related.map(r => ({ term: String(r.term || ''), count: Number(r.co_count || 0), jaccard: Number(r.jaccard || 0) }))
                       .filter(x => x.term);
    } else if (Array.isArray(obj)) {
      arr = obj.map(r => ({ term: String(r.term || ''), count: Number(r.co_count || r.count || 0), jaccard: Number(r.jaccard || 0) }))
               .filter(x => x.term);
    } else if (obj && typeof obj === 'object') {
      const inner = Array.isArray(obj.results) ? obj.results
                  : Array.isArray(obj.terms) ? obj.terms
                  : [];
      arr = inner.map(r => ({ term: String(r.term || ''), count: Number(r.co_count || r.count || 0), jaccard: Number(r.jaccard || 0) }))
                 .filter(x => x.term);
    }
    return arr;
  } catch { return []; }
}

function relRenderLoading(listEl, countBadge) {
  if (countBadge) countBadge.style.display = 'none';
  listEl.innerHTML = '<div class="py-1 px-1 text-gray-500">Loading related terms…</div>';
}
function relRenderError(listEl, msg, countBadge) {
  if (countBadge) countBadge.style.display = 'none';
  listEl.innerHTML = `<div class="py-1 px-1 text-red-600">${msg}</div>`;
}
function relRenderEmpty(listEl, countBadge) {
  if (countBadge) countBadge.style.display = 'none';
  listEl.innerHTML = '<div class="py-1 px-1 text-gray-500">No related terms.</div>';
}

function relRender(listEl, items, countBadge) {
  if (!Array.isArray(items) || items.length === 0) return relRenderEmpty(listEl, countBadge);

  // 依 co_count desc 排序，取前 100
  const top = [...items].sort((a,b) => (b.count||0) - (a.count||0)).slice(0, 100);

  if (countBadge) {
    countBadge.textContent = `${top.length} term${top.length===1?'':'s'}`;
    countBadge.style.display = '';
  }

  // chips 容器：flex-wrap；gap 緊湊
  const wrap = document.createElement('div');
  wrap.className = 'flex flex-wrap gap-1 p-1';

  for (const it of top) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.dataset.term = it.term;
    chip.title = `co-occurrence: ${it.count}${Number.isFinite(it.jaccard) ? ` · jaccard: ${it.jaccard.toFixed(3)}` : ''}`;
    chip.className = 'inline-flex items-center whitespace-nowrap rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs hover:bg-gray-50 cursor-pointer';

    // 『term + count』黏在一起：apple 329
    const label = document.createElement('span');
    label.className = 'truncate';
    label.textContent = `${it.term} ${it.count}`;
    chip.appendChild(label);

    wrap.appendChild(chip);
  }

  listEl.innerHTML = '';
  listEl.appendChild(wrap);
}

const relUpdate = debounce(async (query) => {
  const { list, countBadge } = relGetDom();
  const q = (query || '').trim();
  if (!list) return;
  if (!q) {
    if (countBadge) countBadge.style.display = 'none';
    list.innerHTML = '<div class="py-1 px-1 text-gray-500">Type a query above to see related terms.</div>';
    return;
  }
  try {
    relRenderLoading(list, countBadge);
    const data = await apiGet(`/terms/${encodeQuery(q)}`);
    const items = relCoerceItems(data);
    relRender(list, items, countBadge);
  } catch (err) {
    console.error('[Related Terms] fetch failed:', err);
    relRenderError(list, 'Failed to load related terms.', countBadge);
  }
}, 400);

// 點 chip → 追加到 Query，並觸發搜尋與自身更新
function relAttachClickToAppend(listEl, bInputEl, cListEl, bRunBtn) {
  listEl.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-term]');
    if (!chip || !bInputEl) return;
    const term = chip.dataset.term;
    if (!term) return;

    const current = bInputEl.value || '';
    const needsSpace = current.length > 0 && !/\s$/.test(current);
    bInputEl.value = current + (needsSpace ? ' ' : '') + term;

    bInputEl.focus();
    const end = bInputEl.value.length;
    bInputEl.setSelectionRange(end, end);

    if (cListEl) runQueryAndRender(bInputEl.value, cListEl, bRunBtn);
    relUpdate(bInputEl.value);
  });
}

/* =========================
 * Panel D: Saved (memory + localStorage)
 * ========================= */
const SAVED_KEY = 'neurosynth_saved_studies_v1';
let SAVED = [];

function dGetDom() {
  return {
    list: document.querySelector('#d-list'),
    exportBtn: document.querySelector('#d-export'),
    clearBtn: document.querySelector('#d-clear'),
  };
}
function loadSaved() {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    SAVED = Array.isArray(arr) ? arr : [];
  } catch { SAVED = []; }
}
function persistSaved() {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(SAVED)); } catch {}
}
function dRenderList() {
  const { list } = dGetDom();
  if (!list) return;
  if (!Array.isArray(SAVED) || SAVED.length === 0) {
    list.innerHTML = '<div class="py-3">Nothing saved yet.</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const s of SAVED) {
    const row = document.createElement('div');
    row.className = 'py-3 px-2';
    row.dataset.id = s.id;

    const title = document.createElement('div');
    title.className = 'font-medium leading-snug';
    title.textContent = s.title || 'Untitled';
    row.appendChild(title);

    const authorsLine = document.createElement('div');
    authorsLine.className = 'text-xs text-gray-700 mt-1';
    authorsLine.innerHTML = `<span class="text-gray-500">Authors:</span> ${s.authors || '—'}`;
    row.appendChild(authorsLine);

    const journalLine = document.createElement('div');
    journalLine.className = 'text-xs text-gray-700 mt-0.5';
    journalLine.innerHTML = `<span class="text-gray-500">Journal:</span> ${s.journal || '—'}`;
    row.appendChild(journalLine);

    const yearLine = document.createElement('div');
    yearLine.className = 'text-xs text-gray-700 mt-0.5';
    yearLine.innerHTML = `<span class="text-gray-500">Year:</span> ${s.year || '—'}`;
    row.appendChild(yearLine);

    const actions = document.createElement('div');
    actions.className = 'mt-2';
    const delBtn = document.createElement('button');
    delBtn.className = 'text-xs px-2 py-1 border rounded text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-300';
    delBtn.textContent = 'Delete';
    delBtn.dataset.action = 'delete';
    delBtn.dataset.id = s.id;
    actions.appendChild(delBtn);
    row.appendChild(actions);

    frag.appendChild(row);
  }
  list.innerHTML = '';
  list.appendChild(frag);
}
function saveStudy(sNorm) {
  if (!sNorm || !sNorm.id) return;
  if (SAVED.find(x => x.id === sNorm.id)) return;
  SAVED.unshift(sNorm);
  persistSaved();
  dRenderList();
}
function deleteStudyById(id) {
  const before = SAVED.length;
  SAVED = SAVED.filter(s => String(s.id) !== String(id));
  if (SAVED.length !== before) {
    persistSaved();
    dRenderList();
  }
}
function attachDSavedHandlers() {
  const { list, exportBtn, clearBtn } = dGetDom();
  if (list) {
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action="delete"]');
      if (!btn) return;
      deleteStudyById(btn.dataset.id);
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (!confirm('Clear all saved studies?')) return;
      SAVED = [];
      persistSaved();
      dRenderList();
    });
  }
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (!Array.isArray(SAVED) || SAVED.length === 0) {
        alert('No saved studies to export.');
        return;
      }
      const nameRaw = prompt('File name (without extension):', 'saved_studies');
      if (nameRaw === null) return;
      const trimmed = nameRaw.trim();
      if (!trimmed) return;
      const safeBase = trimmed.replace(/[\\\/:*?"<>|]/g, '_');
      const fileName = `${safeBase}.txt`;

      const lines = SAVED.map(s => [
        `Title: ${s.title || ''}`,
        `Authors: ${s.authors || ''}`,
        `Journal: ${s.journal || ''}`,
        `Year: ${s.year || ''}`,
        `ID: ${s.id || ''}`,
        ''.padEnd(40, '-')
      ].join('\n')).join('\n');

      const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }
}

/* ----- C 面板：加上 Save 行為 ----- */
function cRenderStudies(listEl, studies) {
  if (!Array.isArray(studies) || studies.length === 0) { cRenderEmpty(listEl); return; }

  const frag = document.createDocumentFragment();
  for (const s0 of studies) {
    const s = normalizeStudy(s0);

    const row = document.createElement('div');
    row.className = 'py-3 border-b border-gray-100';

    const titleEl = document.createElement('div');
    titleEl.className = 'font-medium leading-snug';
    titleEl.textContent = s.title || 'Untitled';
    row.appendChild(titleEl);

    const authorsEl = document.createElement('div');
    authorsEl.className = 'text-xs text-gray-700 mt-1';
    authorsEl.innerHTML = `<span class="text-gray-500">Authors:</span> ${s.authors || '—'}`;
    row.appendChild(authorsEl);

    const journalEl = document.createElement('div');
    journalEl.className = 'text-xs text-gray-700 mt-0.5';
    journalEl.innerHTML = `<span class="text-gray-500">Journal:</span> ${s.journal || '—'}`;
    row.appendChild(journalEl);

    const yearEl = document.createElement('div');
    yearEl.className = 'text-xs text-gray-700 mt-0.5';
    yearEl.innerHTML = `<span class="text-gray-500">Year:</span> ${s.year || '—'}`;
    row.appendChild(yearEl);

    const actions = document.createElement('div');
    actions.className = 'mt-2';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'text-xs px-2 py-1 border rounded hover:bg-gray-50';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => saveStudy(s));
    actions.appendChild(saveBtn);
    row.appendChild(actions);

    frag.appendChild(row);
  }
  listEl.innerHTML = '';
  listEl.appendChild(frag);
}

async function runQueryAndRender(q, listEl, runBtn) {
  const trimmed = (q || '').trim();
  if (!trimmed) { cRenderPrompt(listEl); return; }
  try {
    if (runBtn) runBtn.disabled = true;
    cRenderLoading(listEl);
    const path = `/query/${encodeQuery(trimmed)}/studies`;
    const data = await apiGet(path);
    const arr = coerceStudiesArray(data);
    const total = (data && typeof data.count === 'number') ? data.count : arr.length;
    cUpdateCount(total);
    cRenderStudies(listEl, arr);
  } catch (err) {
    console.error('[Panel C] query failed:', err);
    cRenderError(listEl, 'Something went wrong. Please try again.');
  } finally {
    if (runBtn) runBtn.disabled = false;
  }
}

function attachBQuerySearch(bInputEl, listEl, runBtn) {
  const debouncedRun = debounce(() => runQueryAndRender(bInputEl.value, listEl, runBtn), 400);
  bInputEl.addEventListener('input', () => {
    debouncedRun();
    relUpdate(bInputEl.value); // 同步更新 Related Terms
  });
  bInputEl.addEventListener('keyup', (e) => { if (e.key === 'Enter') runQueryAndRender(bInputEl.value, listEl, runBtn); });
  if (runBtn) runBtn.addEventListener('click', () => runQueryAndRender(bInputEl.value, listEl, runBtn));
}

/* =========================
 * Boot
 * ========================= */
window.addEventListener('DOMContentLoaded', async () => {
  const { input, list, bQuery, runBtn: aRun } = aGetDom();
  const { list: cList, runBtn: bRun, header } = cGetDom();
  const { list: relList } = relGetDom();
  if (!input || !list) return;

  cEnsureCountBadge(header);

  loadSaved();
  dRenderList();
  attachDSavedHandlers();

  try {
    const data = await apiGet('/terms');
    TERMS_ALL = Array.isArray(data) ? data : (Array.isArray(data?.terms) ? data.terms : []);
  } catch (err) {
    console.error('[Panel A] Failed to load terms:', err);
    list.innerHTML = '<div class="py-3 px-2 text-red-600">Failed to load terms. Check console.</div>';
  }

  aResetAndRender(list, TERMS_ALL);
  aAttachInfiniteScroll(list);
  aAttachFilter(input, list, aRun);
  aAttachClickToFillB(list, bQuery, cList, bRun);

  if (cList) cRenderPrompt(cList);
  if (bQuery && cList) attachBQuerySearch(bQuery, cList, bRun);

  if (relList && bQuery) relAttachClickToAppend(relList, bQuery, cList, bRun);
});
