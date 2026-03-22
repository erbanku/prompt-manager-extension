// Get DOM elements
const darkModeToggle = document.getElementById("darkModeToggle");
const openSidebarBtn = document.getElementById("openSidebarBtn");
const openFullPageBtn = document.getElementById("openFullPageBtn");
const toggleAddBtn = document.getElementById("toggleAddBtn");
const toggleAllBtn = document.getElementById("toggleAllBtn");
const addPromptSection = document.getElementById("addPromptSection");
const titleInput = document.getElementById("titleInput");
const promptInput = document.getElementById("promptInput");
const addPromptBtn = document.getElementById("addPromptBtn");
const cancelBtn = document.getElementById("cancelBtn");
const promptsList = document.getElementById("promptsList");

// Edit mode state
let editingPromptId = null;

const PROMPTS_STORAGE_KEY = "prompts";
const PROMPTS_STORAGE_AREA_KEY = "promptsStorageArea";

function isQuotaExceededError(error) {
    const message = error && typeof error.message === "string" ? error.message : "";
    return /quota|MAX_ITEMS|MAX_WRITE_OPERATIONS/i.test(message);
}

// Utility: Load prompts (check both sync and local)
async function loadPromptsChunked() {
    const [syncResult, localResult] = await Promise.all([
        chrome.storage.sync.get([PROMPTS_STORAGE_KEY, PROMPTS_STORAGE_AREA_KEY]),
        chrome.storage.local.get([PROMPTS_STORAGE_KEY, PROMPTS_STORAGE_AREA_KEY]),
    ]);

    if (
        localResult[PROMPTS_STORAGE_AREA_KEY] === "local" &&
        Array.isArray(localResult[PROMPTS_STORAGE_KEY])
    ) {
        return localResult[PROMPTS_STORAGE_KEY];
    }

    if (
        syncResult[PROMPTS_STORAGE_AREA_KEY] === "sync" &&
        Array.isArray(syncResult[PROMPTS_STORAGE_KEY])
    ) {
        return syncResult[PROMPTS_STORAGE_KEY];
    }

    if (Array.isArray(syncResult[PROMPTS_STORAGE_KEY])) {
        return syncResult[PROMPTS_STORAGE_KEY];
    }

    if (Array.isArray(localResult[PROMPTS_STORAGE_KEY])) {
        return localResult[PROMPTS_STORAGE_KEY];
    }

    return [];
}

// Utility: Save prompts (try sync first, fallback to local for large data)
async function savePromptsChunked(prompts) {
    try {
        await chrome.storage.sync.set({
            [PROMPTS_STORAGE_KEY]: prompts,
            [PROMPTS_STORAGE_AREA_KEY]: "sync",
        });
        await chrome.storage.local.remove([
            PROMPTS_STORAGE_KEY,
            PROMPTS_STORAGE_AREA_KEY,
        ]);
    } catch (error) {
        if (!isQuotaExceededError(error)) {
            throw error;
        }

        console.log("Prompts too large for sync storage, using local storage");
        await chrome.storage.local.set({
            [PROMPTS_STORAGE_KEY]: prompts,
            [PROMPTS_STORAGE_AREA_KEY]: "local",
        });
        await chrome.storage.sync.remove([
            PROMPTS_STORAGE_KEY,
            PROMPTS_STORAGE_AREA_KEY,
        ]);
    }
}

// Load prompts and dark mode when popup opens
document.addEventListener("DOMContentLoaded", async () => {
    await loadDarkMode();
    await loadPrompts();
});

// Load dark mode setting
async function loadDarkMode() {
    try {
        const result = await chrome.storage.sync.get(["darkMode"]);
        if (result.darkMode) {
            document.body.classList.add("dark-mode");
            updateDarkModeIcon(true);
        }
    } catch (error) {
        console.error("Error loading dark mode:", error);
    }
}

// Dark mode toggle
darkModeToggle.addEventListener("click", async () => {
    const isDarkMode = document.body.classList.toggle("dark-mode");
    updateDarkModeIcon(isDarkMode);

    try {
        await chrome.storage.sync.set({ darkMode: isDarkMode });
    } catch (error) {
        console.error("Error saving dark mode:", error);
    }
});

// Update dark mode icon
function updateDarkModeIcon(isDarkMode) {
    const sunIcon = darkModeToggle.querySelector(".icon-sun");
    const moonIcon = darkModeToggle.querySelector(".icon-moon");

    if (isDarkMode) {
        sunIcon.style.display = "none";
        moonIcon.style.display = "block";
    } else {
        sunIcon.style.display = "block";
        moonIcon.style.display = "none";
    }
}

// Open in sidebar
openSidebarBtn.addEventListener("click", async () => {
    try {
        // Get current window
        const currentWindow = await chrome.windows.getCurrent();
        // Open side panel for current window
        await chrome.sidePanel.open({ windowId: currentWindow.id });
        // Close the popup
        self.close();
    } catch (error) {
        console.error("Error opening sidebar:", error);
        // Fallback: try to open without window ID
        try {
            await chrome.sidePanel.open({});
            self.close();
        } catch (fallbackError) {
            console.error("Fallback failed:", fallbackError);
        }
    }
});

// Open full page view
openFullPageBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "fullpage.html" });
});

// Toggle add section
toggleAddBtn.addEventListener("click", () => {
    const isHidden = addPromptSection.style.display === "none";
    addPromptSection.style.display = isHidden ? "block" : "none";
    if (isHidden) {
        titleInput.focus();
    }
});

// Cancel button
cancelBtn.addEventListener("click", () => {
    addPromptSection.style.display = "none";
    titleInput.value = "";
    promptInput.value = "";
    editingPromptId = null;
    addPromptBtn.textContent = "Save";
});

// Add prompt button click handler
addPromptBtn.addEventListener("click", addPrompt);

// Allow Enter key with Ctrl/Cmd to add prompt
promptInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        addPrompt();
    }
});

// Toggle all prompts collapse/expand
toggleAllBtn.addEventListener("click", () => {
    const allTextElements = document.querySelectorAll(".prompt-text");
    const allChevrons = document.querySelectorAll(".chevron-icon");
    const isCurrentlyCollapsed = toggleAllBtn.classList.contains("collapsed");

    if (isCurrentlyCollapsed) {
        // Expand all
        allTextElements.forEach(el => el.classList.remove("collapsed"));
        allChevrons.forEach(chevron => chevron.classList.add("rotated"));
        toggleAllBtn.classList.remove("collapsed");
    } else {
        // Collapse all
        allTextElements.forEach(el => el.classList.add("collapsed"));
        allChevrons.forEach(chevron => chevron.classList.remove("rotated"));
        toggleAllBtn.classList.add("collapsed");
    }
});

// Load prompts from Chrome storage
async function loadPrompts() {
    try {
        const prompts = await loadPromptsChunked();
        renderPrompts(prompts);
    } catch (error) {
        console.error("Error loading prompts:", error);
    }
}

// Add or update a prompt
async function addPrompt() {
    const title = titleInput.value.trim();
    const text = promptInput.value.trim();

    // Validate title is required
    if (!title) {
        titleInput.style.borderColor = "#dc2626";
        titleInput.focus();
        setTimeout(() => {
            titleInput.style.borderColor = "";
        }, 2000);
        return;
    }

    // Validate text is required
    if (!text) {
        promptInput.style.borderColor = "#dc2626";
        promptInput.focus();
        setTimeout(() => {
            promptInput.style.borderColor = "";
        }, 2000);
        return;
    }

    try {
        let prompts = await loadPromptsChunked();

        if (editingPromptId) {
            // Update existing prompt
            prompts = prompts.map(p =>
                p.id === editingPromptId
                    ? { ...p, title, text, updatedAt: new Date().toISOString() }
                    : p
            );
            editingPromptId = null;
            addPromptBtn.textContent = "Save";
        } else {
            // Add new prompt
            const newPrompt = {
                id: Date.now(),
                title: title,
                text: text,
                createdAt: new Date().toISOString(),
            };
            prompts.unshift(newPrompt);
        }

        await savePromptsChunked(prompts);

        titleInput.value = "";
        promptInput.value = "";
        addPromptSection.style.display = "none";
        renderPrompts(prompts);
    } catch (error) {
        console.error("Error saving prompt:", error);
    }
}

// Edit a prompt
function editPrompt(id, prompts) {
    const prompt = prompts.find((p) => p.id === id);
    if (!prompt) return;

    editingPromptId = id;
    titleInput.value = prompt.title;
    promptInput.value = prompt.text;
    addPromptBtn.textContent = "Update";
    addPromptSection.style.display = "block";
    titleInput.focus();
}

// Delete a prompt
async function deletePrompt(id) {
    let prompts = await loadPromptsChunked();
    const prompt = prompts.find((p) => p.id === id);
    if (!prompt) return;
    
    const confirmed = confirm(`Delete "${prompt.title}"?\n\nThis action cannot be undone.`);
    if (!confirmed) return;
    
    try {
        const filteredPrompts = prompts.filter((p) => p.id !== id);
        await savePromptsChunked(filteredPrompts);

        renderPrompts(filteredPrompts);
    } catch (error) {
        console.error("Error deleting prompt:", error);
    }
}

// Copy prompt to clipboard
async function copyPrompt(text, promptElement) {
    try {
        await navigator.clipboard.writeText(text);

        // Show copied indicator (green circle with checkmark)
        const indicator = promptElement.querySelector(
            ".copied-indicator"
        );
        indicator.classList.add("show");

        setTimeout(() => {
            indicator.classList.remove("show");
        }, 1500);
    } catch (error) {
        console.error("Error copying prompt:", error);
    }
}

// Render prompts to the UI
function renderPrompts(prompts) {
    if (prompts.length === 0) {
        promptsList.innerHTML =
            '<p class="empty-state">No prompts saved yet. Click "+ New" to add one!</p>';
        toggleAllBtn.style.display = "none";
        return;
    }

    toggleAllBtn.style.display = "flex";

    promptsList.innerHTML = prompts
        .map((prompt) => {
            // All prompts are expanded by default (show 5 lines)
            const textClass = "";
            const chevronClass = "rotated";

            return `
    <div class="prompt-item" data-id="${prompt.id}">
      <div class="prompt-header">
        <button class="btn-expand" data-id="${prompt.id}">
          <svg class="chevron-icon ${chevronClass}" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="prompt-title" data-id="${prompt.id}">${escapeHtml(
                prompt.title
            )}</div>
        <div class="copied-indicator">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" fill="#10b981"/>
            <path d="M6 10L9 13L14 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <button class="btn-delete" data-id="${prompt.id}">
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
            <path d="M2 3H10M4.5 1.5H7.5M4.5 5.5V9M7.5 5.5V9M3.5 3V10C3.5 10.2761 3.72386 10.5 4 10.5H8C8.27614 10.5 8.5 10.2761 8.5 10V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="prompt-text ${textClass}">${escapeHtml(prompt.text)}</div>
    </div>
  `;
        })
        .join("");

    // Add event listeners to prompt items (click anywhere to copy)
    document.querySelectorAll(".prompt-item").forEach((item) => {
        const id = parseInt(item.dataset.id);
        const prompt = prompts.find((p) => p.id === id);

        item.addEventListener("click", (e) => {
            // Don't copy if clicking on expand or delete buttons
            if (
                e.target.closest(".btn-expand") ||
                e.target.closest(".btn-delete")
            ) {
                return;
            }

            if (prompt) {
                const textEl = item.querySelector(".prompt-text");
                const chevron = item.querySelector(".chevron-icon");
                const wasCollapsed = textEl.classList.contains("collapsed");

                // Only collapse others if this prompt was collapsed
                if (wasCollapsed) {
                    // Collapse all other prompts
                    document.querySelectorAll(".prompt-item").forEach((otherItem) => {
                        if (otherItem !== item) {
                            const otherTextEl = otherItem.querySelector(".prompt-text");
                            const otherChevron = otherItem.querySelector(".chevron-icon");
                            otherTextEl.classList.add("collapsed");
                            otherChevron.classList.remove("rotated");
                        }
                    });

                    // Expand the current prompt
                    textEl.classList.remove("collapsed");
                    chevron.classList.add("rotated");
                }

                copyPrompt(prompt.text, item);
            }
        });

        // Add double-click event listener to edit
        item.addEventListener("dblclick", (e) => {
            // Don't edit if clicking on expand or delete buttons
            if (
                e.target.closest(".btn-expand") ||
                e.target.closest(".btn-delete")
            ) {
                return;
            }

            if (prompt) {
                editPrompt(id, prompts);
            }
        });
    });

    // Add event listeners to expand buttons
    document.querySelectorAll(".btn-expand").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const button = e.currentTarget;
            const item = button.closest(".prompt-item");
            const textEl = item.querySelector(".prompt-text");
            const chevron = button.querySelector(".chevron-icon");

            textEl.classList.toggle("collapsed");
            chevron.classList.toggle("rotated");
        });
    });

    // Add event listeners to delete buttons
    document.querySelectorAll(".btn-delete").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const button = e.currentTarget;
            const id = parseInt(button.dataset.id);
            deletePrompt(id);
        });
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
