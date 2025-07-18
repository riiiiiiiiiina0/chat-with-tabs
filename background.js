// Updated background script that supports dynamic popup behaviour and direct scraping+share flow

// === Constants ===
const supportedApps = ['chatgpt.com', 'gemini.google.com'];

// === User preference – default LLM ===
let defaultLLM = 'chatgpt.com';

// Fetch saved preference from storage on startup
chrome.storage.sync.get('defaultLLM', (res) => {
  if (res?.defaultLLM && supportedApps.includes(res.defaultLLM)) {
    defaultLLM = res.defaultLLM;
  }
});

// React to preference changes while the service-worker is alive
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.defaultLLM) {
    const newVal = changes.defaultLLM.newValue;
    if (supportedApps.includes(newVal)) defaultLLM = newVal;
  }
});

// Mapping of host → canonical URL for opening a new tab
const llmInfo = {
  'chatgpt.com': { url: 'https://chatgpt.com' },
  'gemini.google.com': { url: 'https://gemini.google.com/app' },
};

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
  // Re-evaluate the popup whenever the URL changes *or* the page reloads (status changes).
  // Relying only on changeInfo.url misses pure reloads where the URL stays the same,
  // which left the default popup in place and prevented the action click handler
  // from firing. Also handle the initial "loading" event so that the service-worker
  // can correct the popup right after it wakes up.
  if (
    changeInfo.url !== undefined ||
    changeInfo.status === 'loading' ||
    changeInfo.status === 'complete'
  ) {
    updatePopupForTab(tab);
  }
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

async function focusAndInjectLLM(tabId) {
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

    // Refresh the currently selected defaultLLM preference (may have changed since startup)
    try {
      const { defaultLLM: storedLLM } = await chrome.storage.sync.get(
        'defaultLLM',
      );
      if (storedLLM && supportedApps.includes(storedLLM)) {
        defaultLLM = storedLLM;
      }
    } catch (_) {
      /* ignore retrieval errors and fall back to cached defaultLLM */
    }

    // Find or create a tab for the user's default LLM
    const existing = await chrome.tabs.query({ url: `*://${defaultLLM}/*` });
    if (existing.length) {
      await focusAndInjectLLM(existing[0].id);
    } else {
      const targetUrl = llmInfo[defaultLLM]?.url || 'https://chatgpt.com';
      chrome.tabs.create({ url: targetUrl }, async (newTab) => {
        if (newTab?.id) await focusAndInjectLLM(newTab.id);
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
