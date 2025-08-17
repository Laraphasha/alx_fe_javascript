// =========================
// Dynamic Quote Generator
// =========================

// Local quotes array
let quotes = JSON.parse(localStorage.getItem("quotes")) || [
  { text: "The only limit to our realization of tomorrow is our doubts of today.", category: "Motivation" },
  { text: "In the middle of every difficulty lies opportunity.", category: "Inspiration" },
  { text: "Life is what happens when you're busy making other plans.", category: "Life" }
];

// ========== DOM ELEMENTS ==========
const quoteContainer = document.getElementById("quoteDisplay");
const categoryFilter = document.getElementById("categoryFilter");

// ========== UTILS ==========
function saveQuotes() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

function getLocalQuotes() {
  return JSON.parse(localStorage.getItem("quotes")) || [];
}

function mapServerToQuote(post) {
  return {
    text: post.body,
    category: post.title || "Server"
  };
}

// ========== DISPLAY FUNCTIONS ==========
function showRandomQuote() {
  if (quotes.length === 0) {
    quoteContainer.textContent = "No quotes available.";
    return;
  }
  const randomIndex = Math.floor(Math.random() * quotes.length);
  const q = quotes[randomIndex];
  quoteContainer.textContent = `"${q.text}" — ${q.category}`;
}

function createAddQuoteForm() {
  const formContainer = document.getElementById("addQuoteForm");
  formContainer.innerHTML = `
    <input id="newQuoteText" type="text" placeholder="Enter a new quote" />
    <input id="newQuoteCategory" type="text" placeholder="Enter quote category" />
    <button type="button" id="addQuoteBtn">Add Quote</button>
  `;

  document.getElementById("addQuoteBtn").addEventListener("click", addQuote);
}

async function addQuote() {
  const textInput = document.getElementById("newQuoteText");
  const categoryInput = document.getElementById("newQuoteCategory");
  const newQuote = { text: textInput.value.trim(), category: categoryInput.value.trim() };

  if (!newQuote.text || !newQuote.category) return;

  // Save locally
  quotes.push(newQuote);
  saveQuotes();
  populateCategories();
  filterQuotes();
  textInput.value = "";
  categoryInput.value = "";

  // POST to server
  await postQuoteToServer(newQuote);
}

// ========== SERVER POST ==========
async function postQuoteToServer(quote) {
  try {
    const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8"
      },
      body: JSON.stringify({
        title: quote.category,
        body: quote.text,
        userId: 1
      })
    });

    if (!response.ok) throw new Error(`Failed to post: ${response.status}`);
    const data = await response.json();
    console.log("Quote posted to server:", data);
    return data;
  } catch (err) {
    console.error(err);
    return null;
  }
}

// ========== CATEGORY FILTERING ==========
function populateCategories() {
  const uniqueCategories = ["all", ...new Set(quotes.map(q => q.category))];
  categoryFilter.innerHTML = uniqueCategories
    .map(cat => `<option value="${cat}">${cat}</option>`)
    .join("");

  // Restore last selected category if exists
  const savedCategory = localStorage.getItem("selectedCategory");
  if (savedCategory && uniqueCategories.includes(savedCategory)) {
    categoryFilter.value = savedCategory;
    filterQuotes();
  }
}

function filterQuotes() {
  const selectedCategory = categoryFilter.value;

  // Save selected category in localStorage
  localStorage.setItem("selectedCategory", selectedCategory);

  // Clear container
  quoteContainer.innerHTML = "";

  // Filter quotes
  const filteredQuotes = selectedCategory === "all"
    ? quotes
    : quotes.filter(q => q.category === selectedCategory);

  if (filteredQuotes.length === 0) {
    quoteContainer.textContent = "No quotes available for this category.";
    return;
  }

  // Display filtered quotes
  filteredQuotes.forEach(q => {
    const quoteEl = document.createElement("p");
    quoteEl.textContent = `"${q.text}" — ${q.category}`;
    quoteEl.classList.add("quote-item");
    quoteContainer.appendChild(quoteEl);
  });
}

// ========== SERVER FETCH ==========
async function fetchQuotesFromServer(limit = 10) {
  const res = await fetch(`https://jsonplaceholder.typicode.com/posts?_limit=${limit}`);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const posts = await res.json();
  return posts.map(mapServerToQuote);
}

// ========== SYNC ==========
async function syncQuotes() {  // renamed
  try {
    const serverQuotes = await fetchQuotesFromServer(10);
    const localQuotes = getLocalQuotes();

    // Server data takes precedence, merge unique local quotes
    const mergedQuotes = [
      ...serverQuotes,
      ...localQuotes.filter(lq => !serverQuotes.some(sq => sq.text === lq.text))
    ];

    quotes = mergedQuotes;
    saveQuotes();
    populateCategories();
    filterQuotes();
    alert("Quotes synced with server.");
  } catch (err) {
    console.error("Error syncing with server:", err);
  }
}

// ========== INIT ==========
document.addEventListener("DOMContentLoaded", () => {
  createAddQuoteForm();
  populateCategories();
  filterQuotes();
  syncQuotes();
  setInterval(syncWithServer, 30000); // auto-sync every 30s
});
