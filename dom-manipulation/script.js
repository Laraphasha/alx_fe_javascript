// =====================
// Config & Constants
// =====================
const API_BASE = "https://jsonplaceholder.typicode.com";
const QUOTES_ENDPOINT = `${API_BASE}/posts`;
const SYNC_INTERVAL_MS = 15000; // periodic sync

const LS_QUOTES = "quotes";
const LS_SELECTED_CATEGORY = "selectedCategory";
const LS_SYNC_SHADOW = "syncShadow";      // { [id]: { contentHash, updatedAt } }
const LS_CONFLICTS = "conflicts";         // array of conflict records

// =====================
// Utilities
// =====================
const nowISO = () => new Date().toISOString();
const hashContent = (q) => JSON.stringify({ text: q.text, category: q.category });

const uid = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Map JSONPlaceholder post <-> Quote
const mapServerToQuote = (post) => ({
  id: String(post.id),
  text: String(post.body || "").trim(),
  category: String(post.title || "Server").trim() || "Server",
  updatedAt: nowISO(),
  source: "server",
});

const mapQuoteToServerPayload = (q) => ({
  title: q.category,
  body: q.text,
  userId: 1,
});

// =====================
// Local Storage facade
// =====================
const load = (k, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; }
  catch { return fallback; }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// Quotes
let quotes = load(LS_QUOTES, [
  { id: "1", text: "The best way to get started is to quit talking and begin doing.", category: "Motivation", updatedAt: nowISO(), source: "local" },
  { id: "2", text: "Don't watch the clock; do what it does. Keep going.", category: "Persistence", updatedAt: nowISO(), source: "local" },
  { id: "3", text: "Success is not in what you have, but who you are.", category: "Inspiration", updatedAt: nowISO(), source: "local" },
]);
let syncShadow = load(LS_SYNC_SHADOW, {});     // id -> { contentHash, updatedAt }
let conflicts = load(LS_CONFLICTS, []);        // array of { id, local, server, resolved }

// =====================
// DOM helpers
// =====================
const $ = (id) => document.getElementById(id);
const quoteDisplayEl = () => $("quoteDisplay");
const statusEl = () => $("syncStatus");
const conflictsPanelEl = () => $("conflictsPanel");
const conflictListEl = () => $("conflictList");
const categoryFilterEl = () => $("categoryFilter");

// =====================
// UI: Status & Conflicts
// =====================
function setSyncStatus(message, type = "info") {
  const el = statusEl();
  if (!el) return;
  el.textContent = message;
  el.className = ""; // reset
  el.classList.add(`sync-${type}`); // style via CSS if desired
}

function renderConflicts() {
  const list = conflictListEl();
  const panel = conflictsPanelEl();
  if (!list || !panel) return;

  // Only unresolved conflicts visible
  const unresolved = conflicts.filter(c => !c.resolved);
  list.innerHTML = "";

  if (unresolved.length === 0) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  unresolved.forEach(conf => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>Quote ID:</strong> ${conf.id}<br>
        <strong>Server:</strong> "${conf.server.text}" — ${conf.server.category}<br>
        <strong>Local:</strong> "${conf.local.text}" — ${conf.local.category}
      </div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
        <button data-action="keep-server" data-id="${conf.id}">Keep Server (default)</button>
        <button data-action="keep-local" data-id="${conf.id}">Keep Local</button>
        <button data-action="dismiss" data-id="${conf.id}">Dismiss</button>
      </div>
    `;
    list.appendChild(li);
  });
}

// Delegated click handling for conflict buttons
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id");
  if (!id) return;

  if (action === "keep-server") {
    resolveConflictKeepServer(id);
  } else if (action === "keep-local") {
    await resolveConflictKeepLocal(id);
  } else if (action === "dismiss") {
    markConflictResolved(id);
  }
});

// =====================
// Core UI (existing features)
// =====================
function saveQuotes() { save(LS_QUOTES, quotes); }

// Populate categories dynamically
function populateCategories() {
  const sel = categoryFilterEl();
  if (!sel) return;

  sel.innerHTML = `<option value="all">All Categories</option>`;
  const cats = [...new Set(quotes.map(q => q.category))].sort((a,b)=>a.localeCompare(b));
  cats.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });

  const savedCategory = localStorage.getItem(LS_SELECTED_CATEGORY);
  if (savedCategory && (savedCategory === "all" || cats.includes(savedCategory))) {
    sel.value = savedCategory;
  }
}

// Filter quotes
function filterQuotes() {
  const selectedCategory = categoryFilterEl()?.value || "all";
  localStorage.setItem(LS_SELECTED_CATEGORY, selectedCategory);

  const container = quoteDisplayEl();
  if (!container) return;

  container.innerHTML = "";
  const rows = selectedCategory === "all"
    ? quotes
    : quotes.filter(q => q.category === selectedCategory);

  if (!rows.length) {
    container.textContent = "No quotes available for this category.";
    return;
  }

  rows.forEach(q => {
    const p = document.createElement("p");
    p.classList.add("quote-item");
    p.textContent = `"${q.text}" — ${q.category}`;
    container.appendChild(p);
  });
}

// Random quote (ignores filter)
function showRandomQuote() {
  const container = quoteDisplayEl();
  if (!container) return;

  if (quotes.length === 0) {
    container.textContent = "No quotes available. Please add one!";
    return;
  }
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  container.innerHTML = `
    <p class="quote-text">"${q.text}"</p>
    <span class="quote-category">— ${q.category}</span>
  `;
}

// Add-quote form
function createAddQuoteForm() {
  const formContainer = $("form-container");
  if (!formContainer) return;

  const form = document.createElement("form");

  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.placeholder = "Enter quote text";
  textInput.required = true;

  const categoryInput = document.createElement("input");
  categoryInput.type = "text";
  categoryInput.placeholder = "Enter category";
  categoryInput.required = true;

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.textContent = "Add Quote";

  form.append(textInput, categoryInput, submitBtn);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newQuote = {
      id: uid(), // temp id until server assigns one
      text: textInput.value.trim(),
      category: categoryInput.value.trim(),
      updatedAt: nowISO(),
      source: "local",
      pendingCreate: true, // will be POSTed on next sync
    };
    if (!newQuote.text || !newQuote.category) return;

    quotes.push(newQuote);
    saveQuotes();
    populateCategories();
    filterQuotes();
    textInput.value = "";
    categoryInput.value = "";
    setSyncStatus("Quote added locally. Will sync to server.", "info");

    // Optional: immediately try to sync creates
    await pushPendingCreates();
    await syncNow(); // quick reconcile after create
  });

  formContainer.appendChild(form);
}

// =====================
// Sync: Server calls
// =====================
async function fetchQuotesFromServer(limit = 10) {
  const res = await fetch(`${QUOTES_ENDPOINT}?_limit=${limit}`);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const posts = await res.json();
  return posts.map(mapServerToQuote);
}

async function createOnServer(localQuote) {
  const res = await fetch(QUOTES_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(mapQuoteToServerPayload(localQuote)),
  });
  // JSONPlaceholder returns an id but doesn't persist; good enough for simulation
  if (!res.ok) throw new Error(`Create failed: ${res.status}`);
  return res.json(); // { id, ... }
}

async function updateOnServer(quote) {
  // PATCH simulation — JSONPlaceholder will respond but not persist
  const res = await fetch(`${QUOTES_ENDPOINT}/${quote.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(mapQuoteToServerPayload(quote)),
  });
  if (!res.ok) throw new Error(`Update failed: ${res.status}`);
  return res.json();
}

// =====================
// Sync: Pending creates
// =====================
async function pushPendingCreates() {
  const pending = quotes.filter(q => q.pendingCreate);
  if (!pending.length) return;

  for (const q of pending) {
    try {
      const created = await createOnServer(q);
      const newId = String(created.id || q.id);
      // Replace temp id with server id
      q.id = newId;
      delete q.pendingCreate;

      // Update shadow to server hash
      syncShadow[newId] = { contentHash: hashContent(q), updatedAt: nowISO() };
      save(LS_SYNC_SHADOW, syncShadow);
      saveQuotes();
      setSyncStatus("Created on server.", "success");
    } catch (err) {
      setSyncStatus(`Failed to create on server: ${err.message}`, "error");
    }
  }
}

// =====================
// Sync: Reconciliation
// =====================
function indexById(arr) {
  const m = new Map();
  arr.forEach(x => m.set(String(x.id), x));
  return m;
}

function markConflictResolved(id) {
  conflicts = conflicts.map(c => c.id === id ? { ...c, resolved: true } : c);
  save(LS_CONFLICTS, conflicts);
  renderConflicts();
}

async function resolveConflictKeepLocal(id) {
  const c = conflicts.find(x => x.id === id && !x.resolved);
  if (!c) return;

  // Apply local version into quotes
  const i = quotes.findIndex(q => String(q.id) === String(id));
  if (i >= 0) {
    quotes[i] = { ...quotes[i], ...c.local, updatedAt: nowISO(), source: "local" };
    saveQuotes();
    populateCategories();
    filterQuotes();
  }

  try {
    await updateOnServer(c.local);
  } catch {
    // ignore; JSONPlaceholder won't persist
  }

  // Update shadow to match local we kept
  syncShadow[id] = { contentHash: hashContent(c.local), updatedAt: nowISO() };
  save(LS_SYNC_SHADOW, syncShadow);

  markConflictResolved(id);
  setSyncStatus("Conflict resolved: kept local.", "success");
}

function resolveConflictKeepServer(id) {
  const c = conflicts.find(x => x.id === id && !x.resolved);
  if (!c) return;

  // quotes already has server copy applied during reconcile
  // Just mark resolved and set shadow to server
  syncShadow[id] = { contentHash: hashContent(c.server), updatedAt: nowISO() };
  save(LS_SYNC_SHADOW, syncShadow);

  markConflictResolved(id);
  setSyncStatus("Conflict resolved: kept server.", "success");
}

function addConflict(id, localQ, serverQ) {
  // Avoid duplicating unresolved conflicts for same id
  const existing = conflicts.find(c => c.id === id && !c.resolved);
  if (existing) return;

  conflicts.push({
    id,
    local: { text: localQ.text, category: localQ.category },
    server: { text: serverQ.text, category: serverQ.category },
    resolved: false,
    createdAt: nowISO(),
  });
  save(LS_CONFLICTS, conflicts);
  renderConflicts();
}

function reconcileWithServer(serverQuotes) {
  const serverById = indexById(serverQuotes);
  const localById = indexById(quotes);

  // Update / add from server
  serverById.forEach((serverQ, id) => {
    const localQ = localById.get(id);
    const serverHash = hashContent(serverQ);
    const shadowHash = syncShadow[id]?.contentHash ?? null;

    if (!localQ) {
      // new from server -> add
      quotes.push(serverQ);
      syncShadow[id] = { contentHash: serverHash, updatedAt: nowISO() };
      return;
    }

    const localHash = hashContent(localQ);

    if (localHash === serverHash) {
      // in sync
      syncShadow[id] = { contentHash: serverHash, updatedAt: nowISO() };
      return;
    }

    // Discrepancy
    if (shadowHash && localHash !== shadowHash && serverHash !== shadowHash) {
      // Both changed since last sync -> true conflict
      // Apply server (server-wins) but record conflict for manual override
      const idx = quotes.findIndex(q => String(q.id) === id);
      if (idx >= 0) quotes[idx] = { ...serverQ };
      addConflict(id, localQ, serverQ);
      syncShadow[id] = { contentHash: serverHash, updatedAt: nowISO() };
      return;
    }

    // If local changed but server equals shadow -> server-wins policy
    // Overwrite local with server and record an override-able conflict
    const idx = quotes.findIndex(q => String(q.id) === id);
    if (idx >= 0) quotes[idx] = { ...serverQ };
    addConflict(id, localQ, serverQ); // user can keep local if desired
    syncShadow[id] = { contentHash: serverHash, updatedAt: nowISO() };
  });

  // Local items that server doesn't know:
  // - keep them (e.g., pending creates or purely local data)
  // - shadow stays as-is or will be written when created/updated on server
}

// =====================
// Sync cycle
// =====================
async function syncNow() {
  setSyncStatus("Syncing…", "info");
  try {
    await pushPendingCreates();
    const serverQuotes = await fetchServerQuotes(10);
    reconcileWithServer(serverQuotes);

    save(LS_SYNC_SHADOW, syncShadow);
    saveQuotes();
    populateCategories();
    filterQuotes();
    renderConflicts();
    setSyncStatus(`Synced at ${new Date().toLocaleTimeString()}`, "success");
  } catch (err) {
    setSyncStatus(`Sync failed: ${err.message}`, "error");
  }
}

// Optional: test helper to force a conflict on one local item
async function simulateConflict() {
  if (!quotes.length) return;
  const q = quotes[0];
  // Change local without changing shadow -> will appear as "local changed"
  const old = { ...q };
  q.text = q.text + " (edited locally)";
  q.updatedAt = nowISO();
  saveQuotes();
  setSyncStatus("Simulated a local edit. Run sync to trigger conflict handling.", "info");
  await syncNow();
}

// =====================
// Wire up & init
// =====================
document.addEventListener("DOMContentLoaded", () => {
  // Existing UI
  createAddQuoteForm();
  populateCategories();
  filterQuotes();

  // Buttons
  const syncBtn = $("syncNowBtn");
  if (syncBtn) syncBtn.addEventListener("click", syncNow);

  const simBtn = $("simulateConflictBtn");
  if (simBtn) simBtn.addEventListener("click", simulateConflict);

  // Random button (if present)
  const randomBtn = $("random-btn");
  if (randomBtn) randomBtn.addEventListener("click", showRandomQuote);

  // Start periodic sync
  setInterval(syncNow, SYNC_INTERVAL_MS);

  // Initial render
  renderConflicts();
  setSyncStatus("Ready. Automatic sync enabled.", "info");
});
