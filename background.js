// Updated background script that supports dynamic popup behaviour and direct scraping+share flow

// === Constants ===
const supportedApps = ['chatgpt.com', 'gemini.google.com'];

// === Per-tab popup handling ===
/**
 * Sets the extension action popup depending on whether the given tab is a supported app.
 * If the tab is ChatGPT/Gemini the usual popup is shown, otherwise we clear the popup so
 * that `chrome.action.onClicked` fires.
 * @param {chrome.tabs.Tab} tab
 */
function updatePopupForTab(tab) {
  if (!tab || typeof tab.id !== 'number' || !tab.url) return;
  let popup = '';
  try {
    const host = new URL(tab.url).host;
    if (supportedApps.includes(host)) popup = 'popup.html';
  } catch {
    // ignore non-standard URLs (chrome:// etc.)
  }
  chrome.action.setPopup({ tabId: tab.id, popup }).catch(() => {});
}

// Initialise popup for all existing tabs when the service-worker starts
chrome.tabs.query({}, (tabs) => tabs.forEach(updatePopupForTab));

// Keep popup assignment up-to-date
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url !== undefined) updatePopupForTab(tab);
});
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, updatePopupForTab);
});

// === Shared state (re-used by content-add-files-to-chatgpt.js) ===
let selectedTabsData = [];

// === Helpers ===
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) return resolve(undefined);
      if (tab.status === 'complete') return resolve(undefined);
      function listener(updatedTabId, changeInfo) {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve(undefined);
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

function prepareAndInject(tabId) {
  return new Promise((resolve) => {
    const doInject = () => {
      chrome.scripting.executeScript(
        {
          target: { tabId },
          files: [
            'libs/turndown.7.2.0.js',
            'libs/turndown-plugin-gfm.1.0.2.js',
            'content.js',
          ],
        },
        () => resolve(undefined),
      );
    };

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) return resolve(undefined);
      if (tab.discarded || tab.frozen) {
        chrome.tabs.reload(tabId, () => waitForTabLoad(tabId).then(doInject));
      } else {
        waitForTabLoad(tabId).then(doInject);
      }
    });
  });
}

function collectMarkdownFromTabs(tabs) {
  return new Promise((resolve) => {
    const expected = tabs.length;
    const collected = [];

    function onContentMessage(request, sender) {
      if (!request?.markdown || !sender.tab?.id) return;
      collected.push({
        tabId: sender.tab.id,
        title: request.title || '',
        url: request.url || '',
        markdown: request.markdown,
      });
      if (collected.length >= expected) {
        chrome.runtime.onMessage.removeListener(onContentMessage);
        resolve(collected);
      }
    }
    chrome.runtime.onMessage.addListener(onContentMessage);

    // Fallback timeout
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(onContentMessage);
      resolve(collected);
    }, 5000);

    // Start extraction
    tabs.forEach((t) => t.id && prepareAndInject(t.id));
  });
}

async function focusAndInjectChatGPT(tabId) {
  await chrome.tabs.update(tabId, { active: true });
  await waitForTabLoad(tabId);
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['content-add-files-to-chatgpt.js'],
  });
}

// === Action button click handler (only fires when popup is cleared) ===
chrome.action.onClicked.addListener(async (activeTab) => {
  try {
    // Determine whether multiple tabs are highlighted
    const highlighted = await chrome.tabs.query({
      currentWindow: true,
      highlighted: true,
    });
    const tabsToProcess = highlighted.length > 1 ? highlighted : [activeTab];

    const collected = await collectMarkdownFromTabs(tabsToProcess);

    if (collected.length === 0) return;
    selectedTabsData = collected;

    // Find or create a ChatGPT tab
    const existing = await chrome.tabs.query({ url: '*://chatgpt.com/*' });
    if (existing.length) {
      await focusAndInjectChatGPT(existing[0].id);
    } else {
      chrome.tabs.create({ url: 'https://chatgpt.com' }, async (newTab) => {
        if (newTab?.id) await focusAndInjectChatGPT(newTab.id);
      });
    }
  } catch (err) {
    console.error('[background] action.onClicked error:', err);
  }
});

// === Legacy message handling (popup flow) ===
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
    return; // no response needed
  }

  // 2. Content script asks for the stored selected tabs data
  if (request.type === 'get-selected-tabs-data') {
    sendResponse({ tabs: selectedTabsData });
    return;
  }
});
