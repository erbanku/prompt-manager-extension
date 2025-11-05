// Get DOM elements
const searchInput = document.getElementById("searchInput");
const previewToggle = document.getElementById("previewToggle");
const previewLinesSelect = document.getElementById("previewLinesSelect");
const collapseAllBtn = document.getElementById("collapseAllBtn");
const darkModeToggle = document.getElementById("darkModeToggle");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFileInput = document.getElementById("importFileInput");
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const cancelSettingsBtn = document.getElementById("cancelSettingsBtn");
const addPromptModal = document.getElementById("addPromptModal");
const closeAddPromptBtn = document.getElementById("closeAddPromptBtn");
const toggleAddBtn = document.getElementById("toggleAddBtn");
const titleInput = document.getElementById("titleInput");
const promptInput = document.getElementById("promptInput");
const addPromptBtn = document.getElementById("addPromptBtn");
const cancelBtn = document.getElementById("cancelBtn");
const promptsList = document.getElementById("promptsList");
const promptCount = document.getElementById("promptCount");
const notificationContainer = document.getElementById("notificationContainer");

// Notification system
function showNotification(message, type = "info", title = "", duration = 5000) {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;

    // Icon based on type
    const icons = {
        success:
            '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M16.667 5L7.5 14.167 3.333 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        error: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 6v4m0 4h.01M18 10c0 4.418-3.582 8-8 8s-8-3.582-8-8 3.582-8 8-8 8 3.582 8 8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        warning:
            '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 7v4m0 4h.01M8.228 2.857l-7.143 13.5A2 2 0 0 0 2.857 19h14.286a2 2 0 0 0 1.772-2.893l-7.143-13.5a2 2 0 0 0-3.544 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        info: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/><path d="M10 10v4m0-6h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    };

    notification.innerHTML = `
    <div class="notification-icon">${icons[type] || icons.info}</div>
    <div class="notification-content">
      ${
          title
              ? `<div class="notification-title">${escapeHtml(title)}</div>`
              : ""
      }
      <div class="notification-message">${escapeHtml(message)}</div>
    </div>
    <button class="notification-close">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  `;

    notificationContainer.appendChild(notification);

    // Close button
    const closeBtn = notification.querySelector(".notification-close");
    closeBtn.addEventListener("click", () => {
        notification.classList.add("hiding");
        setTimeout(() => notification.remove(), 300);
    });

    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.add("hiding");
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }
}

// State
let allPrompts = [];
let showPreview = true;
let previewLines = 10;

// Load prompts and settings when page opens
document.addEventListener("DOMContentLoaded", async () => {
    await loadSettings();
    await loadPrompts();
});

// Load dark mode and preview settings
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get([
            "darkMode",
            "showPreview",
            "previewLines",
        ]);

        // Apply dark mode
        if (result.darkMode) {
            document.body.classList.add("dark-mode");
            updateDarkModeIcon(true);
        }

        // Apply preview setting
        showPreview = result.showPreview !== false; // default true
        previewToggle.checked = showPreview;

        // Apply preview lines setting
        previewLines = result.previewLines || 10; // default 10
        previewLinesSelect.value = previewLines;
        updatePreviewLinesCSS();
    } catch (error) {
        console.error("Error loading settings:", error);
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

// Preview toggle
previewToggle.addEventListener("change", async (e) => {
    showPreview = e.target.checked;

    try {
        await chrome.storage.sync.set({ showPreview });
        renderPrompts(allPrompts);
    } catch (error) {
        console.error("Error saving preview setting:", error);
    }
});

// Preview lines selector
previewLinesSelect.addEventListener("change", async (e) => {
    previewLines = parseInt(e.target.value);

    try {
        await chrome.storage.sync.set({ previewLines });
        updatePreviewLinesCSS();
        renderPrompts(allPrompts);
    } catch (error) {
        console.error("Error saving preview lines setting:", error);
    }
});

// Collapse all prompts - toggle between collapsed and expanded
let allCollapsed = false;
collapseAllBtn.addEventListener("click", () => {
    document.querySelectorAll(".prompt-card").forEach((card) => {
        const textEl = card.querySelector(".prompt-text");
        const chevron = card.querySelector(".chevron-icon");

        if (textEl && chevron) {
            if (allCollapsed) {
                // Expand all - remove collapsed-preview
                textEl.classList.remove("collapsed-preview", "collapsed", "no-preview");
                chevron.classList.add("rotated");
            } else {
                // Collapse all - add collapsed-preview to show 3 lines
                textEl.classList.remove("collapsed", "no-preview");
                textEl.classList.add("collapsed-preview");
                chevron.classList.remove("rotated");
            }
        }
    });

    // Toggle state
    allCollapsed = !allCollapsed;

    // Update button text and icon
    const collapseIcon = collapseAllBtn.querySelector(".icon-collapse");
    const expandIcon = collapseAllBtn.querySelector(".icon-expand");

    if (allCollapsed) {
        collapseIcon.style.display = "none";
        expandIcon.style.display = "block";
        collapseAllBtn.querySelector("span").textContent = "Expand All";
    } else {
        collapseIcon.style.display = "block";
        expandIcon.style.display = "none";
        collapseAllBtn.querySelector("span").textContent = "Collapse All";
    }
});

// Update CSS for preview lines
function updatePreviewLinesCSS() {
    // Calculate max-height: font-size (13px) * line-height (1.6) * number of lines
    // For "All" option (999), use a very large value to show all content
    const maxHeight =
        previewLines >= 999 ? "9999px" : 13 * 1.6 * previewLines + "px";

    // Find or create style element
    let styleEl = document.getElementById("preview-lines-style");
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "preview-lines-style";
        document.head.appendChild(styleEl);
    }

    styleEl.textContent = `.prompt-text { max-height: ${maxHeight} !important; }`;
}

// Export to JSON
exportBtn.addEventListener("click", async () => {
    try {
        const timestamp = new Date().toISOString().split("T")[0];

        // Create complete backup data (prompts + settings) - same as remote backups
        const backupData = await createBackupData();
        const backupStr = JSON.stringify(backupData, null, 2);
        const backupBlob = new Blob([backupStr], {
            type: "application/json",
        });
        const backupUrl = URL.createObjectURL(backupBlob);
        const backupLink = document.createElement("a");
        backupLink.download = `backup-${timestamp}.json`;
        backupLink.href = backupUrl;
        backupLink.click();
        URL.revokeObjectURL(backupUrl);

        showNotification(
            "Backup exported successfully!",
            "success",
            "Export Complete"
        );
    } catch (error) {
        console.error("Error exporting:", error);
        showNotification(
            "Failed to export backup. Please try again.",
            "error",
            "Export Failed"
        );
    }
});

// Import from JSON
importBtn.addEventListener("click", () => {
    importFileInput.click();
});

importFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const importedData = JSON.parse(text);

        let importedPrompts;
        let importedSettings = null;

        // Check if it's the new format (object with version, prompts, settings)
        if (importedData && typeof importedData === "object" && !Array.isArray(importedData) && importedData.prompts) {
            // New format: complete backup
            importedPrompts = importedData.prompts;
            importedSettings = importedData.settings;
        } else if (Array.isArray(importedData)) {
            // Old format: just an array of prompts
            importedPrompts = importedData;
        } else {
            showNotification(
                "Invalid file format. Expected backup file or array of prompts.",
                "error",
                "Import Failed"
            );
            return;
        }

        // Validate the imported prompts
        if (!Array.isArray(importedPrompts)) {
            showNotification(
                "Invalid file format. Prompts data should be an array.",
                "error",
                "Import Failed"
            );
            return;
        }

        // Validate each prompt has required fields
        const isValid = importedPrompts.every((p) => p.id && p.title && p.text);
        if (!isValid) {
            showNotification(
                "Invalid prompt data. Each prompt must have id, title, and text fields.",
                "error",
                "Import Failed"
            );
            return;
        }

        // Ask user if they want to merge or replace
        let confirmMessage = `Import ${importedPrompts.length} prompts`;
        if (importedSettings) {
            confirmMessage += " and settings";
        }
        confirmMessage += "?\n\n";
        confirmMessage += `Click OK to REPLACE all existing prompts.\n`;
        confirmMessage += `Click Cancel to MERGE with existing prompts.`;

        const shouldReplace = confirm(confirmMessage);

        if (shouldReplace) {
            allPrompts = importedPrompts;
        } else {
            // Merge: add imported prompts that don't exist (by id)
            const existingIds = new Set(allPrompts.map((p) => p.id));
            const newPrompts = importedPrompts.filter(
                (p) => !existingIds.has(p.id)
            );
            allPrompts = [...allPrompts, ...newPrompts];
        }

        // Save prompts
        await chrome.storage.sync.set({ prompts: allPrompts });

        // Import settings if available
        if (importedSettings) {
            await chrome.storage.sync.set({
                s3Config: importedSettings.s3Config,
                webdavConfig: importedSettings.webdavConfig,
                darkMode: importedSettings.darkMode,
                showPreview: importedSettings.showPreview,
                previewLines: importedSettings.previewLines
            });
        }

        // Refresh UI
        searchInput.value = ""; // Clear search
        renderPrompts(allPrompts);
        updatePromptCount(allPrompts.length);

        // Reload settings if imported
        if (importedSettings) {
            await loadSettings();
        }

        const successMessage = importedSettings
            ? `Successfully imported ${importedPrompts.length} prompts and settings!`
            : `Successfully imported ${importedPrompts.length} prompts!`;

        showNotification(
            successMessage,
            "success",
            "Import Complete"
        );

        // Suggest page reload if settings were imported
        if (importedSettings) {
            setTimeout(() => {
                if (confirm("Settings were imported. Reload the page to apply all changes?")) {
                    window.location.reload();
                }
            }, 1000);
        }
    } catch (error) {
        console.error("Error importing:", error);
        showNotification(
            "Failed to import backup. Please check the file format.",
            "error",
            "Import Failed"
        );
    }

    // Reset file input
    e.target.value = "";
});

// Settings modal
settingsBtn.addEventListener("click", async () => {
    await loadSyncSettings();
    settingsModal.style.display = "flex";
});

closeSettingsBtn.addEventListener("click", () => {
    settingsModal.style.display = "none";
});

cancelSettingsBtn.addEventListener("click", () => {
    settingsModal.style.display = "none";
});

// Close modal on backdrop click
settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) {
        settingsModal.style.display = "none";
    }
});

// Tab switching
document.querySelectorAll(".sync-tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
        const targetTab = e.target.dataset.tab;

        // Update active tab
        document
            .querySelectorAll(".sync-tab")
            .forEach((t) => t.classList.remove("active"));
        e.target.classList.add("active");

        // Show corresponding content
        document.getElementById("s3Tab").style.display =
            targetTab === "s3" ? "block" : "none";
        document.getElementById("webdavTab").style.display =
            targetTab === "webdav" ? "block" : "none";
    });
});

// Load sync settings
async function loadSyncSettings() {
    try {
        const result = await chrome.storage.sync.get([
            "s3Config",
            "webdavConfig",
        ]);

        // Load S3 settings
        if (result.s3Config) {
            document.getElementById("s3Enabled").checked =
                result.s3Config.enabled || false;
            document.getElementById("s3Endpoint").value =
                result.s3Config.endpoint || "";
            document.getElementById("s3Bucket").value =
                result.s3Config.bucket || "";
            document.getElementById("s3Region").value =
                result.s3Config.region || "";
            document.getElementById("s3AccessKey").value =
                result.s3Config.accessKey || "";
            document.getElementById("s3SecretKey").value =
                result.s3Config.secretKey || "";
            document.getElementById("s3FilePath").value =
                result.s3Config.filePath || "prompts";
        }

        // Load WebDAV settings
        if (result.webdavConfig) {
            document.getElementById("webdavEnabled").checked =
                result.webdavConfig.enabled || false;
            document.getElementById("webdavUrl").value =
                result.webdavConfig.url || "";
            document.getElementById("webdavUsername").value =
                result.webdavConfig.username || "";
            document.getElementById("webdavPassword").value =
                result.webdavConfig.password || "";
            document.getElementById("webdavFilePath").value =
                result.webdavConfig.filePath || "prompts";
        }
    } catch (error) {
        console.error("Error loading sync settings:", error);
    }
}

// Helper function to ensure URL has https:// prefix
function ensureHttpsPrefix(url) {
    if (!url) return "";
    url = url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return "https://" + url;
    }
    return url;
}

// Helper function to format detailed error messages
async function formatErrorMessage(error, response = null) {
    let message = "";

    if (response) {
        // HTTP response error
        message = `HTTP ${response.status}: ${response.statusText}`;

        // Try to get response body for more details
        try {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const json = await response.json();
                if (json.message) message += `\n${json.message}`;
                else if (json.error) message += `\n${json.error}`;
            } else if (contentType && contentType.includes("text/xml")) {
                const text = await response.text();
                // Try to extract error message from XML
                const errorMatch = text.match(/<Message>(.*?)<\/Message>/);
                if (errorMatch) message += `\n${errorMatch[1]}`;
            }
        } catch (e) {
            // Couldn't parse response body, that's okay
        }

        // Add helpful hints based on status code
        if (response.status === 403) {
            message += "\nCheck credentials and permissions";
        } else if (response.status === 404) {
            message += "\nResource not found - check bucket/path";
        } else if (response.status === 0 || response.type === "opaque") {
            message += "\nCORS error - check server CORS configuration";
        }
    } else if (error) {
        // Network or other error - show actual error
        message = error.message || error.toString();

        // Add error name if available
        if (error.name && error.name !== "Error") {
            message = `${error.name}: ${message}`;
        }
    }

    return message;
}

// Save sync settings
saveSettingsBtn.addEventListener("click", async () => {
    try {
        // Get endpoint and URL values, auto-prepend https:// if needed
        let s3Endpoint = document.getElementById("s3Endpoint").value.trim();
        let webdavUrl = document.getElementById("webdavUrl").value.trim();

        // Auto-prepend https:// for endpoints
        if (s3Endpoint) {
            s3Endpoint = ensureHttpsPrefix(s3Endpoint);
            // Remove protocol for S3 endpoint (we'll add it back when building URLs)
            s3Endpoint = s3Endpoint.replace(/^https?:\/\//, "");
        }
        if (webdavUrl) {
            webdavUrl = ensureHttpsPrefix(webdavUrl);
        }

        const s3Config = {
            enabled: document.getElementById("s3Enabled").checked,
            endpoint: s3Endpoint,
            bucket: document.getElementById("s3Bucket").value.trim(),
            region: document.getElementById("s3Region").value.trim(),
            accessKey: document.getElementById("s3AccessKey").value.trim(),
            secretKey: document.getElementById("s3SecretKey").value.trim(),
            filePath:
                document.getElementById("s3FilePath").value.trim() ||
                "prompts",
        };

        const webdavConfig = {
            enabled: document.getElementById("webdavEnabled").checked,
            url: webdavUrl,
            username: document.getElementById("webdavUsername").value.trim(),
            password: document.getElementById("webdavPassword").value.trim(),
            filePath:
                document.getElementById("webdavFilePath").value.trim() ||
                "prompts",
        };

        await chrome.storage.sync.set({ s3Config, webdavConfig });
        showNotification("Settings saved successfully", "success", "Settings", 3000);
        // Don't close modal - let user close it manually
    } catch (error) {
        console.error("Error saving sync settings:", error);
        showNotification("Failed to save settings", "error", "Settings");
    }
});

// Search functionality
searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();

    if (searchTerm === "") {
        renderPrompts(allPrompts);
    } else {
        const filtered = allPrompts.filter(
            (prompt) =>
                prompt.title.toLowerCase().includes(searchTerm) ||
                prompt.text.toLowerCase().includes(searchTerm)
        );
        renderPrompts(filtered);
    }
});

// Toggle add modal
toggleAddBtn.addEventListener("click", () => {
    addPromptModal.style.display = "flex";
    titleInput.focus();
});

// Close add prompt modal
closeAddPromptBtn.addEventListener("click", () => {
    addPromptModal.style.display = "none";
    titleInput.value = "";
    promptInput.value = "";
});

// Cancel button
cancelBtn.addEventListener("click", () => {
    addPromptModal.style.display = "none";
    titleInput.value = "";
    promptInput.value = "";
});

// Close modal on backdrop click
addPromptModal.addEventListener("click", (e) => {
    if (e.target === addPromptModal) {
        addPromptModal.style.display = "none";
        titleInput.value = "";
        promptInput.value = "";
    }
});

// Add prompt button click handler
addPromptBtn.addEventListener("click", addPrompt);

// Allow Enter key with Ctrl/Cmd to add prompt
promptInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        addPrompt();
    }
});

// Global keyboard shortcuts
document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + N: Open new prompt modal
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        addPromptModal.style.display = "flex";
        titleInput.focus();
    }

    // Ctrl/Cmd + K: Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
    }

    // Escape: Close modals
    if (e.key === "Escape") {
        if (addPromptModal.style.display === "flex") {
            addPromptModal.style.display = "none";
            titleInput.value = "";
            promptInput.value = "";
        } else if (settingsModal.style.display === "flex") {
            settingsModal.style.display = "none";
        }
    }
});

// Load prompts from Chrome storage
async function loadPrompts() {
    try {
        const result = await chrome.storage.sync.get(["prompts"]);
        allPrompts = result.prompts || [];
        renderPrompts(allPrompts);
        updatePromptCount(allPrompts.length);
    } catch (error) {
        console.error("Error loading prompts:", error);
    }
}

// Add a new prompt
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
        const newPrompt = {
            id: Date.now(),
            title: title,
            text: text,
            createdAt: new Date().toISOString(),
        };

        allPrompts.unshift(newPrompt);
        await chrome.storage.sync.set({ prompts: allPrompts });

        titleInput.value = "";
        promptInput.value = "";
        addPromptModal.style.display = "none";
        searchInput.value = ""; // Clear search
        renderPrompts(allPrompts);
        updatePromptCount(allPrompts.length);
    } catch (error) {
        console.error("Error adding prompt:", error);
    }
}

// Delete a prompt
async function deletePrompt(id) {
    try {
        allPrompts = allPrompts.filter((p) => p.id !== id);
        await chrome.storage.sync.set({ prompts: allPrompts });

        // Re-apply search if active
        const searchTerm = searchInput.value.toLowerCase().trim();
        if (searchTerm) {
            const filtered = allPrompts.filter(
                (prompt) =>
                    prompt.title.toLowerCase().includes(searchTerm) ||
                    prompt.text.toLowerCase().includes(searchTerm)
            );
            renderPrompts(filtered);
        } else {
            renderPrompts(allPrompts);
        }

        updatePromptCount(allPrompts.length);
    } catch (error) {
        console.error("Error deleting prompt:", error);
    }
}

// Copy prompt to clipboard
async function copyPrompt(text, cardElement) {
    try {
        await navigator.clipboard.writeText(text);

        // Show copied indicator (green circle with checkmark)
        const indicator = cardElement.querySelector(".copied-indicator");
        indicator.classList.add("show");

        setTimeout(() => {
            indicator.classList.remove("show");
        }, 1500);
    } catch (error) {
        console.error("Error copying prompt:", error);
    }
}

// Update prompt count
function updatePromptCount(count) {
    promptCount.textContent = `${count} prompt${count !== 1 ? "s" : ""}`;
}

// Render prompts to the UI
function renderPrompts(prompts) {
    if (prompts.length === 0) {
        promptsList.innerHTML =
            '<p class="empty-state">No prompts saved yet. Click "New Prompt" to add one!</p>';
        return;
    }

    const textClass = showPreview ? "" : "no-preview";
    const chevronClass = showPreview ? "rotated" : "";

    promptsList.innerHTML = prompts
        .map((prompt) => {
            const date = formatDate(prompt.createdAt);
            return `
    <div class="prompt-card" data-id="${prompt.id}">
      <span class="prompt-date">${date}</span>
      <div class="prompt-header">
        <button class="btn-expand" data-id="${prompt.id}">
          <svg class="chevron-icon ${chevronClass}" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="prompt-title" data-id="${prompt.id}">${escapeHtml(
                prompt.title
            )}</div>
        <div class="prompt-actions">
          <div class="copied-indicator">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="9" fill="#10b981"/>
              <path d="M6 10L9 13L14 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <button class="btn-show-all" data-id="${prompt.id}" title="Show full content">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 3C5 3 2.5 5.5 1 8C2.5 10.5 5 13 8 13C11 13 13.5 10.5 15 8C13.5 5.5 11 3 8 3Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/>
            </svg>
          </button>
          <button class="btn-edit" data-id="${prompt.id}" title="Edit prompt">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M10 3L13 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="btn-delete" data-id="${prompt.id}" title="Delete prompt">
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
              <path d="M2 3H10M4.5 1.5H7.5M4.5 5.5V9M7.5 5.5V9M3.5 3V10C3.5 10.2761 3.72386 10.5 4 10.5H8C8.27614 10.5 8.5 10.2761 8.5 10V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="prompt-text ${textClass}">${escapeHtml(prompt.text)}</div>
    </div>
  `;
        })
        .join("");

    // Add event listeners to prompt cards (click anywhere to copy)
    document.querySelectorAll(".prompt-card").forEach((card) => {
        const id = parseInt(card.dataset.id);
        const prompt = prompts.find((p) => p.id === id);

        card.addEventListener("click", (e) => {
            // Don't copy if clicking on action buttons
            if (
                e.target.closest(".btn-expand") ||
                e.target.closest(".btn-delete") ||
                e.target.closest(".btn-edit") ||
                e.target.closest(".btn-show-all")
            ) {
                return;
            }

            if (prompt) {
                const textEl = card.querySelector(".prompt-text");
                const chevron = card.querySelector(".chevron-icon");
                const wasCollapsed = textEl.classList.contains("collapsed") ||
                                    textEl.classList.contains("no-preview");

                // Only collapse others if this prompt was collapsed
                if (wasCollapsed) {
                    // Collapse all other prompts
                    document.querySelectorAll(".prompt-card").forEach((otherCard) => {
                        if (otherCard !== card) {
                            const otherTextEl = otherCard.querySelector(".prompt-text");
                            const otherChevron = otherCard.querySelector(".chevron-icon");
                            otherTextEl.classList.add("collapsed");
                            otherChevron.classList.remove("rotated");
                        }
                    });

                    // Expand the current prompt
                    textEl.classList.remove("collapsed", "no-preview");
                    chevron.classList.add("rotated");
                }

                copyPrompt(prompt.text, card);
            }
        });
    });

    // Add event listeners to expand buttons
    document.querySelectorAll(".btn-expand").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const button = e.currentTarget;
            const item = button.closest(".prompt-card");
            const textEl = item.querySelector(".prompt-text");
            const chevron = button.querySelector(".chevron-icon");

            // Toggle between hidden and shown
            if (
                textEl.classList.contains("no-preview") ||
                textEl.classList.contains("collapsed")
            ) {
                textEl.classList.remove("no-preview", "collapsed");
                chevron.classList.add("rotated");
            } else {
                textEl.classList.add("collapsed");
                chevron.classList.remove("rotated");
            }
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

    // Add event listeners to edit buttons
    document.querySelectorAll(".btn-edit").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const button = e.currentTarget;
            const id = parseInt(button.dataset.id);
            openEditModal(id);
        });
    });

    // Add event listeners to show all buttons
    document.querySelectorAll(".btn-show-all").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const button = e.currentTarget;
            const id = parseInt(button.dataset.id);
            showFullContentModal(id);
        });
    });
}

// Show full content modal
function showFullContentModal(id) {
    const prompt = allPrompts.find((p) => p.id === id);
    if (!prompt) return;

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style.display = "flex";

    const isDarkMode = document.body.classList.contains("dark-mode");
    const bgColor = isDarkMode ? "#0d1117" : "#ffffff";
    const textColor = isDarkMode ? "#c9d1d9" : "#1f2937";
    const borderColor = isDarkMode ? "#30363d" : "#e5e7eb";

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; width: 90%;">
            <div class="modal-header">
                <h2>${escapeHtml(prompt.title)}</h2>
                <button class="btn-close" id="closeShowAllBtn">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div style="
                    padding: 16px;
                    background: ${bgColor};
                    border: 1px solid ${borderColor};
                    border-radius: 8px;
                    color: ${textColor};
                    font-family: monospace;
                    font-size: 15px;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    max-height: 60vh;
                    overflow-y: auto;
                    line-height: 1.6;
                ">${escapeHtml(prompt.text)}</div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="editFullContentBtn">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="margin-right: 4px;">
                        <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M10 3L13 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Edit
                </button>
                <button class="btn btn-primary" id="copyFullContentBtn">Copy to Clipboard</button>
                <button class="btn btn-secondary" id="closeShowAllFooterBtn">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close button handlers
    modal.querySelector("#closeShowAllBtn").addEventListener("click", () => {
        modal.remove();
    });

    modal.querySelector("#closeShowAllFooterBtn").addEventListener("click", () => {
        modal.remove();
    });

    // Edit button handler
    modal.querySelector("#editFullContentBtn").addEventListener("click", () => {
        modal.remove();
        openEditModal(id);
    });

    // Copy button handler
    modal.querySelector("#copyFullContentBtn").addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(prompt.text);
            showNotification("Copied to clipboard!", "success", "", 2000);
        } catch (error) {
            console.error("Error copying:", error);
            showNotification("Failed to copy", "error", "", 2000);
        }
    });

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Close on Escape key
    const escapeHandler = (e) => {
        if (e.key === "Escape") {
            modal.remove();
            document.removeEventListener("keydown", escapeHandler);
        }
    };
    document.addEventListener("keydown", escapeHandler);
}

// Open edit modal
function openEditModal(id) {
    const prompt = allPrompts.find((p) => p.id === id);
    if (!prompt) return;

    // Get existing edit modal or create new one
    let editModal = document.getElementById("editPromptModal");
    if (!editModal) {
        editModal = document.createElement("div");
        editModal.id = "editPromptModal";
        editModal.className = "modal";
        editModal.innerHTML = `
            <div class="modal-content modal-add-prompt">
                <div class="modal-header">
                    <h2>Edit Prompt</h2>
                    <button id="closeEditPromptBtn" class="btn-close">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Title</label>
                        <input
                            type="text"
                            id="editTitleInput"
                            placeholder="Prompt title (required)"
                            class="form-input"
                            required
                        />
                    </div>
                    <div class="form-group">
                        <label>Prompt Content</label>
                        <textarea
                            id="editPromptInput"
                            placeholder="Enter your prompt here..."
                            rows="8"
                            class="form-input"
                            style="min-height: 150px; resize: vertical;"
                        ></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancelEditBtn" class="btn btn-secondary">Cancel</button>
                    <button id="saveEditBtn" class="btn btn-primary">Save Changes</button>
                </div>
            </div>
        `;
        document.body.appendChild(editModal);
    }

    // Populate with current values
    const editTitleInput = document.getElementById("editTitleInput");
    const editPromptInput = document.getElementById("editPromptInput");
    editTitleInput.value = prompt.title;
    editPromptInput.value = prompt.text;

    // Show modal
    editModal.style.display = "flex";
    editTitleInput.focus();

    // Close handlers
    const closeEditModal = () => {
        editModal.style.display = "none";
    };

    document.getElementById("closeEditPromptBtn").onclick = closeEditModal;
    document.getElementById("cancelEditBtn").onclick = closeEditModal;

    // Save handler
    document.getElementById("saveEditBtn").onclick = async () => {
        const title = editTitleInput.value.trim();
        const text = editPromptInput.value.trim();

        if (!title) {
            editTitleInput.style.borderColor = "#dc2626";
            editTitleInput.focus();
            setTimeout(() => {
                editTitleInput.style.borderColor = "";
            }, 2000);
            return;
        }

        if (!text) {
            editPromptInput.style.borderColor = "#dc2626";
            editPromptInput.focus();
            setTimeout(() => {
                editPromptInput.style.borderColor = "";
            }, 2000);
            return;
        }

        try {
            // Update the prompt
            const promptIndex = allPrompts.findIndex((p) => p.id === id);
            if (promptIndex !== -1) {
                allPrompts[promptIndex].title = title;
                allPrompts[promptIndex].text = text;
                await chrome.storage.sync.set({ prompts: allPrompts });

                // Re-render prompts
                const searchTerm = searchInput.value.toLowerCase().trim();
                if (searchTerm) {
                    const filtered = allPrompts.filter(
                        (p) =>
                            p.title.toLowerCase().includes(searchTerm) ||
                            p.text.toLowerCase().includes(searchTerm)
                    );
                    renderPrompts(filtered);
                } else {
                    renderPrompts(allPrompts);
                }

                showNotification("Prompt updated successfully!", "success", "", 2000);
                closeEditModal();
            }
        } catch (error) {
            console.error("Error updating prompt:", error);
            showNotification("Failed to update prompt", "error", "", 3000);
        }
    };

    // Close on backdrop click
    editModal.onclick = (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    };

    // Close on Escape key
    const escapeHandler = (e) => {
        if (e.key === "Escape") {
            closeEditModal();
            document.removeEventListener("keydown", escapeHandler);
        }
    };
    document.addEventListener("keydown", escapeHandler);
}

// AWS Signature Version 4 helper functions
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key, message) {
    const keyBuffer =
        typeof key === "string" ? new TextEncoder().encode(key) : key;
    const msgBuffer = new TextEncoder().encode(message);
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgBuffer);
    return new Uint8Array(signature);
}

async function getSignatureKey(key, dateStamp, regionName, serviceName) {
    const kDate = await hmacSha256("AWS4" + key, dateStamp);
    const kRegion = await hmacSha256(kDate, regionName);
    const kService = await hmacSha256(kRegion, serviceName);
    const kSigning = await hmacSha256(kService, "aws4_request");
    return kSigning;
}

async function signS3Request(method, url, config, payload = "") {
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    const path = urlObj.pathname;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substr(0, 8);

    const payloadHash = await sha256(payload);

    // Create canonical request
    const canonicalUri = path;
    const canonicalQueryString = "";
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    // Create string to sign
    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
    const canonicalRequestHash = await sha256(canonicalRequest);
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

    // Calculate signature
    const signingKey = await getSignatureKey(
        config.secretKey,
        dateStamp,
        config.region,
        "s3"
    );
    const signatureArray = await hmacSha256(signingKey, stringToSign);
    const signature = Array.from(signatureArray)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    // Create authorization header
    const authorizationHeader = `${algorithm} Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
        Authorization: authorizationHeader,
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        Host: host,
    };
}

// Helper function to generate timestamped filename
function getTimestampedFilename(baseName = "backup") {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${baseName}-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.json`;
}

// Parse timestamp from filename
function parseTimestampFromFilename(filename) {
    const match = filename.match(/backup-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.json/);
    if (match) {
        const [_, year, month, day, hours, minutes, seconds] = match;
        const date = new Date(year, month - 1, day, hours, minutes, seconds);
        return date.getTime(); // Return timestamp number instead of Date object
    }
    return null;
}

// Format date for display
function formatBackupDate(timestamp) {
    if (!timestamp) return "Unknown";

    let date;

    // Handle different input types
    if (typeof timestamp === 'number') {
        date = new Date(timestamp);
    } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        return "Unknown";
    }

    // Check if date is valid
    if (isNaN(date.getTime())) return "Unknown";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

// Create complete backup object with prompts and settings
async function createBackupData() {
    const result = await chrome.storage.sync.get([
        "prompts",
        "s3Config",
        "webdavConfig",
        "darkMode",
        "showPreview",
        "previewLines"
    ]);

    return {
        version: "1.0",
        timestamp: new Date().toISOString(),
        prompts: result.prompts || [],
        settings: {
            s3Config: result.s3Config || null,
            webdavConfig: result.webdavConfig || null,
            darkMode: result.darkMode || false,
            showPreview: result.showPreview !== false,
            previewLines: result.previewLines || 10
        }
    };
}

// Restore from backup data
async function restoreBackupData(backupData) {
    if (!backupData.prompts || !backupData.settings) {
        throw new Error("Invalid backup format");
    }

    // Restore prompts
    allPrompts = backupData.prompts;

    // Restore settings
    const settings = backupData.settings;
    await chrome.storage.sync.set({
        prompts: allPrompts,
        s3Config: settings.s3Config,
        webdavConfig: settings.webdavConfig,
        darkMode: settings.darkMode,
        showPreview: settings.showPreview,
        previewLines: settings.previewLines
    });

    // Refresh UI
    renderPrompts(allPrompts);
    updatePromptCount(allPrompts.length);
    await loadSettings();
}

// List S3 backups (try server first, fallback to local)
async function listS3Backups(config) {
    const endpoint = config.endpoint || `s3.${config.region}.amazonaws.com`;
    const baseDir = config.filePath ? config.filePath.replace(/\/[^\/]*$/, '') : "prompts";
    const listUrl = `https://${endpoint}/${config.bucket}/?list-type=2&prefix=${encodeURIComponent(baseDir + '/')}`;

    let serverBackups = [];

    // Try to list from server
    try {
        const headers = await signS3Request("GET", listUrl, config, "");
        const response = await fetch(listUrl, {
            method: "GET",
            headers: headers,
        });

        if (response.ok) {
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");

            const contents = xmlDoc.getElementsByTagName("Contents");

            for (let item of contents) {
                const keyEl = item.getElementsByTagName("Key")[0];
                if (!keyEl) continue;

                const key = keyEl.textContent;
                const filename = key.split('/').pop();

                // Only include backup files with timestamp pattern
                if (filename.match(/^backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/)) {
                    const lastModifiedEl = item.getElementsByTagName("LastModified")[0];
                    const sizeEl = item.getElementsByTagName("Size")[0];

                    serverBackups.push({
                        filename: filename,
                        key: key,
                        endpoint: endpoint,
                        bucket: config.bucket,
                        lastModified: lastModifiedEl ? lastModifiedEl.textContent : null,
                        size: sizeEl ? parseInt(sizeEl.textContent) : 0,
                        timestamp: parseTimestampFromFilename(filename),
                        source: 'server'
                    });
                }
            }
        }
    } catch (error) {
        console.warn('Cannot list from S3 server, falling back to local metadata:', error);
    }

    // If server listing returns empty, fall back to local metadata
    if (serverBackups.length === 0) {
        console.warn('Server returned 0 backups, falling back to local metadata');
        const result = await chrome.storage.local.get(['s3Backups']);
        const localBackups = (result.s3Backups || []).filter(backup =>
            backup.endpoint === endpoint &&
            backup.bucket === config.bucket
        );

        if (localBackups.length === 0) {
            throw new Error('No backups found.\n\nPlease create a backup first, or check your S3 configuration.\n\n(Note: If you have s3:ListBucket permission, the extension will show all backups from the server. Without it, you can only see backups created from this device.)');
        }

        // Sort by timestamp, newest first
        localBackups.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        return localBackups;
    }

    // Sort by timestamp, newest first
    serverBackups.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return serverBackups;
}

// Restore from S3 backup
async function restoreFromS3(config, backupKey) {
    const endpoint = config.endpoint || `s3.${config.region}.amazonaws.com`;
    const fileUrl = `https://${endpoint}/${config.bucket}/${backupKey}`;

    const headers = await signS3Request("GET", fileUrl, config, "");
    const response = await fetch(fileUrl, {
        method: "GET",
        headers: headers,
    });

    if (!response.ok) {
        const errorMsg = await formatErrorMessage(null, response);
        throw new Error(`Failed to download backup:\n${errorMsg}`);
    }

    const text = await response.text();
    const backupData = JSON.parse(text);
    await restoreBackupData(backupData);
}

// List WebDAV backups (try server first, fallback to local)
async function listWebDAVBackups(config) {
    const baseDir = config.filePath ? config.filePath.replace(/\/[^\/]*$/, '') : "prompts";
    const dirUrl = config.url.endsWith("/")
        ? config.url + baseDir
        : config.url + "/" + baseDir;
    const auth = "Basic " + btoa(config.username + ":" + config.password);

    let serverBackups = [];

    // Try to list from server
    try {
        const response = await fetch(dirUrl, {
            method: "PROPFIND",
            headers: {
                Authorization: auth,
                Depth: "1",
                "Content-Type": "application/xml",
            },
            body: '<?xml version="1.0"?><propfind xmlns="DAV:"><prop><getlastmodified/><getcontentlength/></prop></propfind>'
        });

        if (response.ok || response.status === 207) {
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");

            const responses = xmlDoc.getElementsByTagName("d:response") || xmlDoc.getElementsByTagName("response");

            for (let item of responses) {
                const hrefEl = item.getElementsByTagName("d:href")[0] || item.getElementsByTagName("href")[0];
                if (!hrefEl) continue;

                const href = hrefEl.textContent;
                const filename = href.split('/').pop();

                // Only include backup files with timestamp pattern
                if (filename.match(/^backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/)) {
                    const lastModifiedEl = item.getElementsByTagName("d:getlastmodified")[0] || item.getElementsByTagName("getlastmodified")[0];
                    const sizeEl = item.getElementsByTagName("d:getcontentlength")[0] || item.getElementsByTagName("getcontentlength")[0];

                    serverBackups.push({
                        filename: filename,
                        href: href,
                        url: config.url,
                        lastModified: lastModifiedEl ? lastModifiedEl.textContent : null,
                        size: sizeEl ? parseInt(sizeEl.textContent) : 0,
                        timestamp: parseTimestampFromFilename(filename),
                        source: 'server'
                    });
                }
            }
        }
    } catch (error) {
        console.warn('Cannot list from WebDAV server, falling back to local metadata:', error);
    }

    // If server listing returns empty, fall back to local metadata
    if (serverBackups.length === 0) {
        console.warn('Server returned 0 backups, falling back to local metadata');
        const result = await chrome.storage.local.get(['webdavBackups']);
        const localBackups = (result.webdavBackups || []).filter(backup =>
            backup.url === config.url
        );

        if (localBackups.length === 0) {
            throw new Error('No backups found.\n\nPlease create a backup first, or check your WebDAV configuration.');
        }

        // Sort by timestamp, newest first
        localBackups.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        return localBackups;
    }

    // Sort by timestamp, newest first
    serverBackups.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return serverBackups;
}

// Restore from WebDAV backup
async function restoreFromWebDAV(config, href) {
    // href might be full URL, absolute path, or relative path
    let fileUrl;

    if (href.startsWith('http://') || href.startsWith('https://')) {
        // Full URL from server listing
        fileUrl = href;
    } else if (href.startsWith('/')) {
        // Absolute path from server - construct full URL
        const urlObj = new URL(config.url);
        fileUrl = `${urlObj.protocol}//${urlObj.host}${href}`;
    } else {
        // Relative path from local metadata
        fileUrl = config.url.endsWith("/")
            ? config.url + href
            : config.url + "/" + href;
    }

    const auth = "Basic " + btoa(config.username + ":" + config.password);

    const response = await fetch(fileUrl, {
        method: "GET",
        headers: {
            Authorization: auth,
        },
    });

    if (!response.ok) {
        const errorMsg = await formatErrorMessage(null, response);
        throw new Error(`Failed to download backup:\n${errorMsg}`);
    }

    const text = await response.text();
    const backupData = JSON.parse(text);
    await restoreBackupData(backupData);
}

// Show backup list modal
async function showBackupListModal(service) {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style.display = "flex";

    const content = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${service === 's3' ? 'S3' : 'WebDAV'} Backups</h2>
                <button class="btn-close" id="modalCloseBtn">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div id="backupListContent">
                    <p style="text-align: center; color: #6b7280;">Loading backups...</p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="modalCloseBtnFooter">Close</button>
            </div>
        </div>
    `;

    modal.innerHTML = content;
    document.body.appendChild(modal);

    // Add close button event listeners
    modal.querySelector('#modalCloseBtn').addEventListener('click', () => {
        modal.remove();
    });

    modal.querySelector('#modalCloseBtnFooter').addEventListener('click', () => {
        modal.remove();
    });

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Load backups
    try {
        const result = await chrome.storage.sync.get([service === 's3' ? 's3Config' : 'webdavConfig']);
        const config = result[service === 's3' ? 's3Config' : 'webdavConfig'];

        if (!config || !config.enabled) {
            document.getElementById("backupListContent").innerHTML =
                '<p style="text-align: center; color: #ef4444;">Please configure and enable ' +
                (service === 's3' ? 'S3' : 'WebDAV') + ' first.</p>';
            return;
        }

        let backups;
        if (service === 's3') {
            backups = await listS3Backups(config);
        } else {
            backups = await listWebDAVBackups(config);
        }

        if (backups.length === 0) {
            document.getElementById("backupListContent").innerHTML =
                '<p style="text-align: center; color: #6b7280;">No backups found.</p>';
            return;
        }

        const isDarkMode = document.body.classList.contains('dark-mode');
        const backupBg = isDarkMode ? '#161b22' : '#f9fafb';
        const textColor = isDarkMode ? '#c9d1d9' : '#1f2937';
        const subTextColor = isDarkMode ? '#8b949e' : '#6b7280';

        // Get hostname
        const hostname = await getDeviceHostname();

        const backupListHTML = backups.map((backup, index) => {
            const dateStr = formatBackupDate(backup.timestamp);
            const sizeKB = (backup.size / 1024).toFixed(2);

            // Use hostname if date is Unknown
            const displayInfo = dateStr === "Unknown" ? hostname : dateStr;
            const identifier = service === 's3' ? backup.key : backup.href;

            return `
                <div class="backup-item" style="padding: 12px; border: none; border-radius: 8px; background: ${backupBg}; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 2px rgba(0, 0, 0, ${isDarkMode ? '0.1' : '0.04'});">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; color: ${textColor};">
                            ${escapeHtml(backup.filename)}
                        </div>
                        <div style="font-size: 12px; color: ${subTextColor}; margin-top: 4px;">
                            ${displayInfo} • ${sizeKB} KB
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; margin-left: 12px; flex-shrink: 0;">
                        <button class="btn btn-secondary" style="padding: 6px 12px;" data-action="download" data-service="${service}" data-id="${escapeHtml(identifier)}" title="Download backup">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="display: inline-block; vertical-align: middle;">
                                <path d="M8 2V10M8 10L5 7M8 10L11 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M2 12V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                        </button>
                        <button class="btn btn-secondary" style="padding: 6px 12px;" data-action="delete" data-service="${service}" data-id="${escapeHtml(identifier)}" data-filename="${escapeHtml(backup.filename)}" title="Delete backup">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="display: inline-block; vertical-align: middle;">
                                <path d="M3 4H13M5 4V3C5 2.44772 5.44772 2 6 2H10C10.5523 2 11 2.44772 11 3V4M6 7V11M10 7V11M4 4L5 13C5 13.5523 5.44772 14 6 14H10C10.5523 14 11 13.5523 11 13L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="btn btn-primary" style="padding: 6px 12px;" data-action="restore" data-service="${service}" data-id="${escapeHtml(identifier)}" title="Restore backup">
                            Restore
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById("backupListContent").innerHTML = backupListHTML;

        // Add event listeners for all action buttons
        document.querySelectorAll('.backup-item button').forEach(button => {
            button.addEventListener('click', async (e) => {
                const action = button.dataset.action;
                const service = button.dataset.service;
                const identifier = button.dataset.id;
                const filename = button.dataset.filename;

                if (action === 'restore') {
                    await handleRestoreBackup(service, identifier, button);
                } else if (action === 'download') {
                    await handleDownloadBackup(service, identifier, button);
                } else if (action === 'delete') {
                    await handleDeleteBackup(service, identifier, filename, button);
                }
            });
        });
    } catch (error) {
        console.error("Error loading backups:", error);
        const errorMsg = error.message || "Unknown error occurred";
        document.getElementById("backupListContent").innerHTML =
            `<p style="text-align: center; color: #ef4444; white-space: pre-line; padding: 12px;">Failed to load backups:\n\n${escapeHtml(errorMsg)}</p>`;
    }
}

// Handle restore backup
async function handleRestoreBackup(service, identifier, button) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Restoring...";

    try {
        const result = await chrome.storage.sync.get([service === 's3' ? 's3Config' : 'webdavConfig']);
        const config = result[service === 's3' ? 's3Config' : 'webdavConfig'];

        if (service === 's3') {
            await restoreFromS3(config, identifier);
        } else {
            await restoreFromWebDAV(config, identifier);
        }

        showNotification(
            "Backup restored successfully! Page will reload.",
            "success",
            "Restore Complete"
        );

        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (error) {
        console.error("Error restoring backup:", error);
        const errorMsg = error.message || "Unknown error occurred";
        showNotification(
            errorMsg,
            "error",
            "Restore Failed",
            6000
        );
        button.disabled = false;
        button.textContent = originalText;
    }
}

// Handle download backup
async function handleDownloadBackup(service, identifier, button) {
    const originalHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span style="font-size: 10px;">...</span>';

    try {
        const result = await chrome.storage.sync.get([service === 's3' ? 's3Config' : 'webdavConfig']);
        const config = result[service === 's3' ? 's3Config' : 'webdavConfig'];

        let backupData;
        if (service === 's3') {
            const endpoint = config.endpoint || `s3.${config.region}.amazonaws.com`;
            const fileUrl = `https://${endpoint}/${config.bucket}/${identifier}`;
            const headers = await signS3Request("GET", fileUrl, config, "");
            const response = await fetch(fileUrl, { method: "GET", headers });

            if (!response.ok) {
                throw new Error('Failed to download backup from S3');
            }
            backupData = await response.text();
        } else {
            // WebDAV
            let fileUrl;
            if (identifier.startsWith('http://') || identifier.startsWith('https://')) {
                fileUrl = identifier;
            } else if (identifier.startsWith('/')) {
                // Absolute path from server
                const urlObj = new URL(config.url);
                fileUrl = `${urlObj.protocol}//${urlObj.host}${identifier}`;
            } else {
                // Relative path
                fileUrl = config.url.endsWith("/")
                    ? config.url + identifier
                    : config.url + "/" + identifier;
            }
            const auth = "Basic " + btoa(config.username + ":" + config.password);
            const response = await fetch(fileUrl, {
                method: "GET",
                headers: { Authorization: auth }
            });

            if (!response.ok) {
                throw new Error('Failed to download backup from WebDAV');
            }
            backupData = await response.text();
        }

        // Trigger download
        const blob = new Blob([backupData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = identifier.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification(
            "Backup downloaded successfully!",
            "success",
            "Download Complete",
            3000
        );
    } catch (error) {
        console.error("Error downloading backup:", error);
        showNotification(
            error.message || "Failed to download backup",
            "error",
            "Download Failed",
            6000
        );
    } finally {
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}

// Handle delete backup
async function handleDeleteBackup(service, identifier, filename, button) {
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete this backup?\n\n${filename}\n\nThis action cannot be undone.`)) {
        return;
    }

    const originalHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span style="font-size: 10px;">...</span>';

    try {
        const result = await chrome.storage.sync.get([service === 's3' ? 's3Config' : 'webdavConfig']);
        const config = result[service === 's3' ? 's3Config' : 'webdavConfig'];

        if (service === 's3') {
            const endpoint = config.endpoint || `s3.${config.region}.amazonaws.com`;
            const fileUrl = `https://${endpoint}/${config.bucket}/${identifier}`;
            const headers = await signS3Request("DELETE", fileUrl, config, "");
            const response = await fetch(fileUrl, { method: "DELETE", headers });

            if (!response.ok && response.status !== 204) {
                throw new Error('Failed to delete backup from S3');
            }
        } else {
            // WebDAV
            let fileUrl;
            if (identifier.startsWith('http://') || identifier.startsWith('https://')) {
                fileUrl = identifier;
            } else if (identifier.startsWith('/')) {
                // Absolute path from server
                const urlObj = new URL(config.url);
                fileUrl = `${urlObj.protocol}//${urlObj.host}${identifier}`;
            } else {
                // Relative path
                fileUrl = config.url.endsWith("/")
                    ? config.url + identifier
                    : config.url + "/" + identifier;
            }
            const auth = "Basic " + btoa(config.username + ":" + config.password);
            const response = await fetch(fileUrl, {
                method: "DELETE",
                headers: { Authorization: auth }
            });

            if (!response.ok && response.status !== 204) {
                throw new Error('Failed to delete backup from WebDAV');
            }
        }

        showNotification(
            "Backup deleted successfully!",
            "success",
            "Delete Complete",
            3000
        );

        // Remove the backup item from the list
        button.closest('.backup-item').remove();

        // Check if list is empty now
        const backupItems = document.querySelectorAll('.backup-item');
        if (backupItems.length === 0) {
            document.getElementById("backupListContent").innerHTML =
                '<p style="text-align: center; color: #6b7280;">No backups found.</p>';
        }
    } catch (error) {
        console.error("Error deleting backup:", error);
        showNotification(
            error.message || "Failed to delete backup",
            "error",
            "Delete Failed",
            6000
        );
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}

// S3 Sync functionality
document.getElementById("s3TestBtn").addEventListener("click", async () => {
    const config = {
        endpoint: document.getElementById("s3Endpoint").value.trim(),
        bucket: document.getElementById("s3Bucket").value.trim(),
        region: document.getElementById("s3Region").value.trim(),
        accessKey: document.getElementById("s3AccessKey").value.trim(),
        secretKey: document.getElementById("s3SecretKey").value.trim(),
        filePath:
            document.getElementById("s3FilePath").value.trim() ||
            "prompts",
    };

    if (
        !config.bucket ||
        !config.region ||
        !config.accessKey ||
        !config.secretKey
    ) {
        showNotification("Fill in all required fields", "warning", "");
        return;
    }

    try {
        // Build S3 URL
        const endpoint = config.endpoint || `s3.${config.region}.amazonaws.com`;
        const url = `https://${endpoint}/${config.bucket}/`;

        // Test with a HEAD request to check bucket access
        const headers = await signS3Request("HEAD", url, config, "");

        const response = await fetch(url, {
            method: "HEAD",
            headers: headers,
        });

        if (response.ok || response.status === 200 || response.status === 404) {
            showNotification(`Connected to ${config.bucket}`, "success", "S3 Connection", 3000);
        } else {
            const errorMsg = await formatErrorMessage(null, response);
            showNotification(
                errorMsg,
                "error",
                "S3 Connection Failed",
                6000
            );
        }
    } catch (error) {
        console.error("S3 test error:", error);
        const errorMsg = await formatErrorMessage(error);
        showNotification(errorMsg, "error", "S3 Connection Failed", 6000);
    }
});

// S3 Backup - Create timestamped backup
document.getElementById("s3SyncBtn").addEventListener("click", async () => {
    const result = await chrome.storage.sync.get(["s3Config"]);
    const config = result.s3Config;

    if (!config || !config.enabled) {
        showNotification(
            "Please enable and configure S3 sync in settings first.",
            "warning",
            "S3 Backup"
        );
        return;
    }

    if (
        !config.bucket ||
        !config.region ||
        !config.accessKey ||
        !config.secretKey
    ) {
        showNotification(
            "S3 configuration is incomplete. Please check settings.",
            "warning",
            "S3 Backup"
        );
        return;
    }

    try {
        const serviceType = config.endpoint
            ? "S3-compatible service"
            : "AWS S3";
        const endpoint = config.endpoint || `s3.${config.region}.amazonaws.com`;

        // Create timestamped filename
        const baseDir = config.filePath ? config.filePath.replace(/\/[^\/]*$/, '') : "prompts";
        const filename = getTimestampedFilename("backup");
        const filePath = `${baseDir}/${filename}`;
        const fileUrl = `https://${endpoint}/${config.bucket}/${filePath}`;

        showNotification(
            `Creating backup on ${serviceType}...`,
            "info",
            "S3 Backup",
            2000
        );

        // Create complete backup data (prompts + settings)
        const backupData = await createBackupData();
        const dataStr = JSON.stringify(backupData, null, 2);

        // Upload backup
        const putHeaders = await signS3Request("PUT", fileUrl, config, dataStr);
        putHeaders["Content-Type"] = "application/json";

        const uploadResponse = await fetch(fileUrl, {
            method: "PUT",
            headers: putHeaders,
            body: dataStr,
        });

        if (uploadResponse.ok || uploadResponse.status === 200) {
            // Store backup metadata locally (for reference, but restore lists from server)
            const result = await chrome.storage.local.get(['s3Backups']);
            const s3Backups = result.s3Backups || [];
            const hostname = await getDeviceHostname();

            const backupMetadata = {
                filename: filename,
                key: filePath,
                endpoint: endpoint,
                bucket: config.bucket,
                timestamp: parseTimestampFromFilename(filename),
                createdAt: new Date().toISOString(),
                size: dataStr.length,
                deviceHostname: hostname
            };

            s3Backups.unshift(backupMetadata);

            // Keep only last 50 backups
            if (s3Backups.length > 50) {
                s3Backups.length = 50;
            }

            await chrome.storage.local.set({ s3Backups });

            showNotification(
                `Backup created successfully!\nFile: ${filename}`,
                "success",
                "S3 Backup",
                4000
            );
        } else {
            const errorMsg = await formatErrorMessage(null, uploadResponse);
            showNotification(
                errorMsg,
                "error",
                "S3 Backup Failed",
                6000
            );
        }
    } catch (error) {
        console.error("S3 backup error:", error);
        const errorMsg = await formatErrorMessage(error);
        showNotification(
            errorMsg,
            "error",
            "S3 Backup Failed",
            6000
        );
    }
});

// S3 Restore button
document.getElementById("s3RestoreBtn").addEventListener("click", async () => {
    await showBackupListModal('s3');
});

// WebDAV Restore button
document.getElementById("webdavRestoreBtn").addEventListener("click", async () => {
    await showBackupListModal('webdav');
});

// WebDAV Sync functionality
document.getElementById("webdavTestBtn").addEventListener("click", async () => {
    const config = {
        url: ensureHttpsPrefix(document.getElementById("webdavUrl").value.trim()),
        username: document.getElementById("webdavUsername").value.trim(),
        password: document.getElementById("webdavPassword").value.trim(),
        filePath:
            document.getElementById("webdavFilePath").value.trim() ||
            "prompts",
    };

    if (!config.url || !config.username || !config.password) {
        showNotification(
            "Please fill in all WebDAV configuration fields.",
            "warning",
            "WebDAV Test"
        );
        return;
    }

    try {
        // Extract directory path (remove filename if present)
        const baseDir = config.filePath.replace(/\/[^\/]*\.json$/, '').replace(/\/$/, '');
        const auth = "Basic " + btoa(config.username + ":" + config.password);

        showNotification(
            "Testing WebDAV connection...",
            "info",
            "WebDAV Test",
            2000
        );

        // Step 1: Try to create the directory if it doesn't exist
        const dirUrl = config.url.endsWith("/")
            ? config.url + baseDir
            : config.url + "/" + baseDir;

        try {
            await fetch(dirUrl, {
                method: "MKCOL",
                headers: { Authorization: auth }
            });
            // Ignore response - directory might already exist (405 Method Not Allowed is ok)
        } catch (e) {
            // Ignore directory creation errors
        }

        // Step 2: Try to create a test file in the directory
        const testFileName = "test-connection.json";
        const filePath = `${baseDir}/${testFileName}`;
        const fileUrl = config.url.endsWith("/")
            ? config.url + filePath
            : config.url + "/" + filePath;

        const testData = JSON.stringify({
            test: true,
            timestamp: new Date().toISOString(),
            message: "This is a test connection file from Prompt Manager"
        }, null, 2);

        const response = await fetch(fileUrl, {
            method: "PUT",
            headers: {
                Authorization: auth,
                "Content-Type": "application/json",
            },
            body: testData,
        });

        if (response.ok || response.status === 201 || response.status === 204) {
            // Step 3: Try to delete the test file
            await fetch(fileUrl, {
                method: "DELETE",
                headers: { Authorization: auth }
            }).catch(() => {}); // Ignore delete errors

            showNotification(
                `WebDAV connection successful!\nBackup directory is writable.\n\nDirectory: ${baseDir}`,
                "success",
                "WebDAV Test",
                4000
            );
        } else {
            const errorMsg = await formatErrorMessage(null, response);
            const responseText = await response.text().catch(() => "");
            console.error("WebDAV PUT failed:", response.status, responseText);

            showNotification(
                `Failed to write test file:\n${errorMsg}\n\nTrying to write to:\n${fileUrl}\n\nPlease check:\n- Directory path should be just the folder name (e.g., "prompts")\n- You have write permissions to this directory\n- Your WebDAV server allows file creation`,
                "error",
                "WebDAV Test Failed",
                10000
            );
        }
    } catch (error) {
        console.error("WebDAV test error:", error);
        const errorMsg = await formatErrorMessage(error);
        showNotification(
            `Connection failed:\n${errorMsg}\n\nPlease check:\n- Server URL is correct (e.g., https://wani.teracloud.jp/dav/)\n- Username and password are correct\n- Network connection is working`,
            "error",
            "WebDAV Test Failed",
            10000
        );
    }
});

// WebDAV Backup - Create timestamped backup
document.getElementById("webdavSyncBtn").addEventListener("click", async () => {
    const result = await chrome.storage.sync.get(["webdavConfig"]);
    const config = result.webdavConfig;

    if (!config || !config.enabled) {
        showNotification(
            "Please enable and configure WebDAV sync in settings first.",
            "warning",
            "WebDAV Backup"
        );
        return;
    }

    if (!config.url || !config.username || !config.password) {
        showNotification(
            "WebDAV configuration is incomplete. Please check settings.",
            "warning",
            "WebDAV Backup"
        );
        return;
    }

    try {
        // Extract directory path (remove filename if present)
        const baseDir = config.filePath ? config.filePath.replace(/\/[^\/]*\.json$/, '').replace(/\/$/, '') : "prompts";
        const filename = getTimestampedFilename("backup");
        const filePath = `${baseDir}/${filename}`;
        const fileUrl = config.url.endsWith("/")
            ? config.url + filePath
            : config.url + "/" + filePath;
        const auth = "Basic " + btoa(config.username + ":" + config.password);

        showNotification(
            "Creating backup on WebDAV...",
            "info",
            "WebDAV Backup",
            2000
        );

        // Step 1: Try to create the directory if it doesn't exist
        const dirUrl = config.url.endsWith("/")
            ? config.url + baseDir
            : config.url + "/" + baseDir;

        try {
            await fetch(dirUrl, {
                method: "MKCOL",
                headers: { Authorization: auth }
            });
            // Ignore response - directory might already exist (405 Method Not Allowed is ok)
        } catch (e) {
            // Ignore directory creation errors
        }

        // Step 2: Create complete backup data (prompts + settings)
        const backupData = await createBackupData();
        const dataStr = JSON.stringify(backupData, null, 2);

        // Step 3: Upload backup
        const uploadResponse = await fetch(fileUrl, {
            method: "PUT",
            headers: {
                Authorization: auth,
                "Content-Type": "application/json",
            },
            body: dataStr,
        });

        if (
            uploadResponse.ok ||
            uploadResponse.status === 201 ||
            uploadResponse.status === 204
        ) {
            // Store backup metadata locally (for reference, but restore lists from server)
            const result = await chrome.storage.local.get(['webdavBackups']);
            const webdavBackups = result.webdavBackups || [];
            const hostname = await getDeviceHostname();

            const backupMetadata = {
                filename: filename,
                href: filePath,
                url: config.url,
                timestamp: parseTimestampFromFilename(filename),
                createdAt: new Date().toISOString(),
                size: dataStr.length,
                deviceHostname: hostname
            };

            webdavBackups.unshift(backupMetadata);

            // Keep only last 50 backups
            if (webdavBackups.length > 50) {
                webdavBackups.length = 50;
            }

            await chrome.storage.local.set({ webdavBackups });

            showNotification(
                `Backup created successfully!\nFile: ${filename}`,
                "success",
                "WebDAV Backup",
                4000
            );
        } else {
            const errorMsg = await formatErrorMessage(null, uploadResponse);
            const responseText = await uploadResponse.text().catch(() => "");
            console.error("WebDAV backup PUT failed:", uploadResponse.status, responseText);

            showNotification(
                `${errorMsg}\n\nTrying to write to:\n${fileUrl}\n\nPlease check:\n- Directory path should be just the folder name (e.g., "prompts")\n- You have write permissions\n- Your WebDAV server allows file creation`,
                "error",
                "WebDAV Backup Failed",
                10000
            );
        }
    } catch (error) {
        console.error("WebDAV backup error:", error);
        const errorMsg = await formatErrorMessage(error);
        showNotification(
            `${errorMsg}\n\nPlease check:\n- Server URL is correct\n- Username and password are correct\n- Network connection is working`,
            "error",
            "WebDAV Backup Failed",
            8000
        );
    }
});

// Format date to YYYY/MM/DD
function formatDate(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}/${month}/${day}`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Get device hostname
async function getDeviceHostname() {
    try {
        // Try to get stored hostname
        const result = await chrome.storage.local.get(['deviceHostname']);
        if (result.deviceHostname) {
            return result.deviceHostname;
        }

        // Generate a hostname based on browser info
        const userAgent = navigator.userAgent;
        let hostname = 'Unknown Device';

        if (userAgent.includes('Windows')) {
            hostname = 'Windows PC';
        } else if (userAgent.includes('Mac')) {
            hostname = 'Mac';
        } else if (userAgent.includes('Linux')) {
            hostname = 'Linux PC';
        } else if (userAgent.includes('Android')) {
            hostname = 'Android Device';
        } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
            hostname = 'iOS Device';
        }

        // Store it for future use
        await chrome.storage.local.set({ deviceHostname: hostname });
        return hostname;
    } catch (error) {
        console.error('Error getting hostname:', error);
        return 'Unknown Device';
    }
}
