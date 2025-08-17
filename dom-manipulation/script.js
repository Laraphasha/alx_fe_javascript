// script.js

// Load quotes from localStorage if available
let quotes = JSON.parse(localStorage.getItem("quotes")) || [
    { text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
    { text: "Don't watch the clock; do what it does. Keep going.", category: "Persistence" },
    { text: "Success is not in what you have, but who you are.", category: "Inspiration" }
];

// Function to save quotes to localStorage
function saveQuotes() {
    localStorage.setItem("quotes", JSON.stringify(quotes));
}

// Function to populate categories dynamically
function populateCategories() {
    const categoryFilter = document.getElementById("categoryFilter");

    // Clear existing options (except "All Categories")
    categoryFilter.innerHTML = `<option value="all">All Categories</option>`;

    // Extract unique categories
    const categories = [...new Set(quotes.map(q => q.category))];

    // Add each category as an option
    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });

    // Restore last selected category from localStorage
    const savedCategory = localStorage.getItem("selectedCategory");
    if (savedCategory) {
        categoryFilter.value = savedCategory;
        filterQuotes(); // Show filtered quotes immediately
    }
}

// Function to filter quotes based on selected category
function filterQuotes() {
    const selectedCategory = document.getElementById("categoryFilter").value;
    const quoteContainer = document.getElementById("quote-container");

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

// Function to show a random quote (ignores filter)
function showRandomQuote() {
    const quoteContainer = document.getElementById("quote-container");

    if (quotes.length === 0) {
        quoteContainer.textContent = "No quotes available. Please add one!";
        return;
    }

    const randomIndex = Math.floor(Math.random() * quotes.length);
    const randomQuote = quotes[randomIndex];

    quoteContainer.innerHTML = `
        <p class="quote-text">"${randomQuote.text}"</p>
        <span class="quote-category">— ${randomQuote.category}</span>
    `;
}

// Function to create a form for adding quotes
function createAddQuoteForm() {
    const formContainer = document.getElementById("form-container");

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

    form.appendChild(textInput);
    form.appendChild(categoryInput);
    form.appendChild(submitBtn);

    form.addEventListener("submit", function (e) {
        e.preventDefault();

        const newQuote = {
            text: textInput.value.trim(),
            category: categoryInput.value.trim()
        };

        if (newQuote.text && newQuote.category) {
            quotes.push(newQuote);
            saveQuotes();
            populateCategories(); // Update dropdown with new category if needed
            alert("Quote added successfully!");
            textInput.value = "";
            categoryInput.value = "";
        } else {
            alert("Please fill in all fields.");
        }
    });

    formContainer.appendChild(form);
}

// Event listener for random quote button
document.getElementById("random-btn").addEventListener("click", showRandomQuote);

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    createAddQuoteForm();
    populateCategories();
    filterQuotes(); // Load quotes with saved filter
});
