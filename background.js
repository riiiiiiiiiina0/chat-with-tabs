const supportedApps = ['chatgpt.com', 'gemini.google.com'];

// Disable the action button by default and only enable it on supported apps
chrome.runtime.onInstalled.addListener(() => {
  // Disable action on all pages until our rule conditions are met
  chrome.action.disable();

  // Clear any existing rules and add a new one for chatgpt.com
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: supportedApps.map(
          (app) =>
            new chrome.declarativeContent.PageStateMatcher({
              pageUrl: { hostEquals: app },
            }),
        ),
        actions: [new chrome.declarativeContent.ShowAction()],
      },
    ]);
  });
});

let selectedTabsData = [];

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 1. Popup (or other scripts) asks to use the selected tabs as context
  if (request.type === 'use-context' && Array.isArray(request.tabs)) {
    selectedTabsData = request.tabs;

    // If the currently active tab is ChatGPT, inject the content script that will paste the data
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;

      const activeTab = tabs[0];

      const url = activeTab.url ? new URL(activeTab.url) : undefined;
      const isSupportedApp = url && supportedApps.includes(url.host);

      if (typeof activeTab.id === 'number' && isSupportedApp) {
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content-add-files-to-chatgpt.js'],
        });
      }
    });
    // No need to send a response here
    return;
  }

  // 2. Content script asks for the stored selected tabs data
  if (request.type === 'get-selected-tabs-data') {
    sendResponse({ tabs: selectedTabsData });
    return;
  }
});
