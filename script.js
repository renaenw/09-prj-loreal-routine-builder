// --- DOM Elements ---
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const clearSelectionsBtn = document.getElementById("clearSelections");

// --- Track selected products ---
const selectedProducts = new Map();

// --- Maintain chat history for follow-up questions ---
const conversationHistory = [
  {
    role: "system",
    content:
      "You are a professional beauty advisor for L'Oréal. You only respond to questions related to skincare, haircare, makeup, fragrance, and product routines. Do not answer questions outside these topics. Be concise, friendly, and helpful. Keep your responses straight to the point and relevant to the user's query.",
  },
];

// --- Show placeholder initially ---
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

// --- Load product data ---
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

// --- Load saved selections from localStorage ---
function loadSavedSelections() {
  const saved = localStorage.getItem("selectedProducts");
  if (saved) {
    const entries = JSON.parse(saved);
    entries.forEach(([name, product]) => {
      selectedProducts.set(name, product);
    });
    updateSelectedProductsUI();
    updateProductGridHighlighting();
  }
}

// --- Save selected products to localStorage ---
function saveSelections() {
  localStorage.setItem(
    "selectedProducts",
    JSON.stringify(Array.from(selectedProducts.entries()))
  );
}

// --- Create selected item element ---
function createSelectedItem(product) {
  const item = document.createElement("div");
  item.classList.add("product-card");
  item.dataset.name = product.name;

  item.innerHTML = `
    <img src="${product.image}" alt="${product.name}">
    <div class="product-info">
      <h3>${product.name}</h3>
      <p>${product.brand}</p>
    </div>
    <button class="remove-btn" title="Remove">&times;</button>
  `;

  item.querySelector(".remove-btn").addEventListener("click", () => {
    selectedProducts.delete(product.name);
    updateSelectedProductsUI();
    updateProductGridHighlighting();
  });

  return item;
}

// --- Update Selected Products Section ---
function updateSelectedProductsUI() {
  selectedProductsList.innerHTML = "";
  selectedProducts.forEach((product) => {
    selectedProductsList.appendChild(createSelectedItem(product));
  });
  saveSelections();
}

// --- Highlight selected cards in grid ---
function updateProductGridHighlighting() {
  document.querySelectorAll(".product-card").forEach((card) => {
    const name = card.getAttribute("data-name");
    if (selectedProducts.has(name)) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }
  });
}

// --- Display product cards ---
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
        <div class="product-card" 
             data-name="${product.name}" 
             data-brand="${product.brand}" 
             data-image="${product.image}">
          <img src="${product.image}" alt="${product.name}">
          <div class="product-info">
            <h3>${product.name}</h3>
            <p>${product.brand}</p>
            <button class="learn-more-btn" data-name="${product.name}">Learn More</button>
          </div>
        </div>
      `
    )
    .join("");

  document.querySelectorAll(".product-card").forEach((card) => {
    const name = card.getAttribute("data-name");
    const brand = card.getAttribute("data-brand");
    const image = card.getAttribute("data-image");
    const product = products.find((p) => p.name === name);

    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("learn-more-btn")) return;

      if (selectedProducts.has(name)) {
        selectedProducts.delete(name);
      } else {
        selectedProducts.set(name, {
          name,
          brand,
          image,
          category: product.category,
          description: product.description,
        });
      }

      updateSelectedProductsUI();
      updateProductGridHighlighting();
    });
  });

  document.querySelectorAll(".learn-more-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const name = btn.getAttribute("data-name");
      const product = products.find((p) => p.name === name);
      openModal(product);
    });
  });

  updateProductGridHighlighting();
}

// --- Filter products by category ---
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );
  displayProducts(filteredProducts);
});

// --- OpenAI via Cloudflare Worker ---
async function getChatResponse(messages) {
  const response = await fetch(
    "https://young-snow-985a.renaenweiss.workers.dev",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: messages,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get response from OpenAI");
  }

  return await response.json();
}

// --- Chat Input (Follow-up questions included) ---
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userInput = document.getElementById("userInput").value.trim();
  if (!userInput) return;

  chatWindow.innerHTML += `<p><strong>You:</strong> ${userInput}</p>`;
  chatWindow.innerHTML += `<p><em>Thinking...</em></p>`;
  chatWindow.scrollTop = chatWindow.scrollHeight;

  conversationHistory.push({
    role: "user",
    content: userInput,
  });

  try {
    const result = await getChatResponse(conversationHistory);
    const reply = result.choices[0].message.content;
    chatWindow.innerHTML += `<p><strong>Advisor:</strong> ${reply}</p>`;
    conversationHistory.push({
      role: "assistant",
      content: reply,
    });
  } catch (error) {
    chatWindow.innerHTML += `<p><strong>Error:</strong> Could not get a response. Please try again later.</p>`;
    console.error(error);
  }

  chatWindow.scrollTop = chatWindow.scrollHeight;
  chatForm.reset();
});

// --- Generate Routine with selected product data ---
generateRoutineBtn.addEventListener("click", async () => {
  const selectedArray = [...selectedProducts.values()];

  if (selectedArray.length === 0) {
    chatWindow.innerHTML += `<p><strong>Notice:</strong> Please select at least one product to generate a routine.</p>`;
    return;
  }

  chatWindow.innerHTML += `<p><strong>You:</strong> Generate a routine for my selected products.</p>`;
  chatWindow.innerHTML += `<p><em>Creating your custom routine...</em></p>`;
  chatWindow.scrollTop = chatWindow.scrollHeight;

  const productSummaries = selectedArray
    .map(
      (p, i) =>
        `Product ${i + 1}:\n- Name: ${p.name}\n- Brand: ${p.brand}\n- Category: ${p.category || 'N/A'}\n- Description: ${p.description || 'No description'}`
    )
    .join("\n\n");

  conversationHistory.push({
    role: "user",
    content: `ONLY use the products listed below. Do not suggest anything else. Please generate a step-by-step routine using only these:\n\n${productSummaries}`,
  });

  try {
    const result = await getChatResponse(conversationHistory);
    const reply = result.choices[0].message.content;
    conversationHistory.push({
      role: "assistant",
      content: reply,
    });

    chatWindow.innerHTML += `<p><strong>Advisor:</strong><br>${reply.replace(/\n/g, "<br>")}</p>`;
  } catch (error) {
    chatWindow.innerHTML += `<p><strong>Error:</strong> Could not generate a routine. Please try again.</p>`;
    console.error(error);
  }

  chatWindow.scrollTop = chatWindow.scrollHeight;
});

// --- Clear all selections ---
clearSelectionsBtn.addEventListener("click", () => {
  selectedProducts.clear();
  localStorage.removeItem("selectedProducts");
  updateSelectedProductsUI();
  updateProductGridHighlighting();
});

// --- Modal for Product Details ---
const modal = document.getElementById("productModal");
const modalClose = document.getElementById("modalClose");
const modalTitle = document.getElementById("modalTitle");
const modalBrand = document.getElementById("modalBrand");
const modalImage = document.getElementById("modalImage");
const modalDescription = document.getElementById("modalDescription");

function openModal(product) {
  modalTitle.textContent = product.name;
  modalBrand.textContent = product.brand;
  modalImage.src = product.image;
  modalImage.alt = product.name;
  modalDescription.textContent = product.description;
  modal.style.display = "block";
}

modalClose.onclick = () => (modal.style.display = "none");
window.onclick = (e) => {
  if (e.target === modal) modal.style.display = "none";
};

// --- Initial load ---
loadSavedSelections();

chatWindow.innerHTML = `<p><strong>Advisor:</strong> Hi there! 👋 I'm your L’Oréal routine advisor. Select a few products above, or ask me a question like “What’s a good routine for dry skin?”</p>`;

