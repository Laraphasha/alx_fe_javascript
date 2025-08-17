// script.js

// Quotes data
let quotes = [
    { text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
    { text: "Don't watch the clock; do what it does. Keep going.", category: "Persistence" },
    { text: "Success is not in what you have, but who you are.", category: "Inspiration" }
];

// Function to show a random quote
function showRandomQuote() {
    const quoteContainer = document.getElementById("quote-container");

    if (quotes.length === 0) {
        quoteContainer.textContent = "No quotes available. Please add one!";
        return;
    }

    const randomIndex = Math.floor(Math.random() * quotes.length);
    const randomQuote = quotes[randomIndex];

    // Clear previous quote
    quoteContainer.innerHTML = "";

    // Create elements for quote text and category
    const quoteTextEl = document.createElement("p");
    quoteTextEl.textContent = `"${randomQuote.text}"`;
    quoteTextEl.classList.add("quote-text");

    const quoteCategoryEl = document.createElement("span");
    quoteCategoryEl.textContent = `— ${randomQuote.category}`;
    quoteCategoryEl.classList.add("quote-category");

    // Append to container
    quoteContainer.appendChild(quoteTextEl);
    quoteContainer.appendChild(quoteCategoryEl);
}

// Function to create a form for adding quotes
function createAddQuoteForm() {
    const formContainer = document.getElementById("form-container");

    // Create form
    const form = document.createElement("form");

    // Quote text input
    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.placeholder = "Enter quote text";
    textInput.required = true;

    // Category input
    const categoryInput = document.createElement("input");
    categoryInput.type = "text";
    categoryInput.placeholder = "Enter category";
    categoryInput.required = true;

    // Submit button
    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.textContent = "Add Quote";

    // Append inputs and button
    form.appendChild(textInput);
    form.appendChild(categoryInput);
    form.appendChild(submitBtn);

    // Handle form submission
    form.addEventListener("submit", function (e) {
        e.preventDefault();

        const newQuote = {
            text: textInput.value.trim(),
            category: categoryInput.value.trim()
        };

        if (newQuote.text && newQuote.category) {
            quotes.push(newQuote);
            alert("Quote added successfully!");
            textInput.value = "";
            categoryInput.value = "";
        } else {
            alert("Please fill in all fields.");
        }
    });

    // Append form to container
    formContainer.appendChild(form);
}

// Event listener for random quote button
document.getElementById("random-btn").addEventListener("click", showRandomQuote);

// Initialize form on page load
document.addEventListener("DOMContentLoaded", createAddQuoteForm);
