// Listen for keyboard shortcut command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-fullpage') {
    try {
      // Open the full page view in a new tab
      await chrome.tabs.create({
        url: chrome.runtime.getURL('fullpage.html')
      });
    } catch (error) {
      console.error('Error opening full page:', error);
    }
  }
});

// Note: Alt+P (_execute_action) is handled automatically by Chrome
// Sidebar can be opened via the extension icon button or right-click menu
