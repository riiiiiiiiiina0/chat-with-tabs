// @ts-check

document.addEventListener('DOMContentLoaded', () => {
  const listEl = /** @type {HTMLUListElement|null} */ (
    document.getElementById('tabs-list')
  );
  const useBtn = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('use-context-btn')
  );

  if (!listEl || !useBtn) {
    console.error('Popup elements not found');
    return;
  }

  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    tabs
      .filter((tab) => tab.url && tab.url.startsWith('http'))
      .forEach((tab) => {
        const li = document.createElement('li');

        // A tab is considered "sleeping" if it is discarded or frozen
        const isSleeping = tab.discarded || tab.frozen;

        li.innerHTML = `
        <label class="flex flex-row gap-2 cursor-pointer items-center bg-base-200 hover:bg-base-300 transition-colors p-2 rounded-md ${
          isSleeping ? 'opacity-50' : ''
        }">
          <!-- checkbox -->
          <input type="checkbox" class="checkbox checkbox-sm" data-tab-id="${
            tab.id
          }">

          <!-- favicon + optional sleeping indicator -->
          <div class="relative w-5 h-5 min-w-5">
            <img src="${tab.favIconUrl}" class="size-5 rounded-sm" />
            ${
              isSleeping
                ? '<span class="absolute -top-2 -right-2 text-[8px] text-gray-500 animate-bounce select-none">💤</span>'
                : ''
            }
          </div>

          <!-- title & url -->
          <div class="flex flex-col min-w-0">
            <span class="font-bold line-clamp-1">${
              tab.title || '(No title)'
            }</span>
            <span class="text-xs text-gray-500 truncate">${tab.url || ''}</span>
        </div>
        </label>
      `;
        listEl.appendChild(li);
      });
  });

  useBtn.addEventListener('click', () => {
    const checked = /** @type {HTMLInputElement[]} */ ([
      ...document.querySelectorAll('#tabs-list input[type="checkbox"]:checked'),
    ]);

    const selectedTabs = checked.map((cb) => {
      const tabId = parseInt(cb.dataset.tabId || '', 10);
      return { tabId };
    });

    if (selectedTabs.length === 0) {
      window.close();
      return;
    }

    // Show a loading spinner if the process takes longer than 1 second
    const loadingOverlay = /** @type {HTMLDivElement|null} */ (
      document.getElementById('loading-overlay')
    );
    const showLoadingTimer = setTimeout(() => {
      loadingOverlay?.classList.remove('hidden');
    }, 1000);

    // Collect markdown from each selected tab
    const collected = [];
    const expectedCount = selectedTabs.length;

    /**
     * Listener for messages coming from the injected content script.
     * It collects the markdown for each tab and when all results are in,
     * forwards them to the background service worker.
     * @param {any} request
     * @param {chrome.runtime.MessageSender} sender
     */
    function onContentMessage(request, sender) {
      if (!request || !request.markdown || !sender.tab || !sender.tab.id) {
        return;
      }

      collected.push({
        tabId: sender.tab.id,
        title: request.title || '',
        url: request.url || '',
        markdown: request.markdown,
      });

      if (collected.length === expectedCount) {
        clearTimeout(showLoadingTimer);
        loadingOverlay?.classList.add('hidden');

        // All tabs responded – forward context to background script
        clearTimeout(timeoutId);
        chrome.runtime.sendMessage(
          { type: 'use-context', tabs: collected },
          () => {
            // Clean up listener and close the popup
            chrome.runtime.onMessage.removeListener(onContentMessage);
            window.close();
          },
        );
      }
    }

    // Set up the temporary listener
    chrome.runtime.onMessage.addListener(onContentMessage);

    // Setup a timeout in case some tabs fail to respond
    const timeoutId = setTimeout(() => {
      if (collected.length < expectedCount) {
        clearTimeout(showLoadingTimer);
        loadingOverlay?.classList.add('hidden');

        window.alert(
          `Only received content from ${collected.length} / ${expectedCount} tab(s). Please try again.`,
        );
        chrome.runtime.onMessage.removeListener(onContentMessage);
        window.close();
      }
    }, 5000);

    /**
     * Waits until the given tab finishes loading ("complete" status)
     * and then resolves. If the tab is already complete, resolves immediately.
     * @param {number} tabId
     * @returns {Promise<void>}
     */
    function waitForTabLoad(tabId) {
      return new Promise((resolve) => {
        // Check current status first so we don't always attach a listener
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            console.error(
              `Failed to get tab ${tabId}:`,
              chrome.runtime.lastError,
            );
            return resolve();
          }

          // If the tab has already finished loading, or status is undefined, resolve immediately
          if (!tab || tab.status === 'complete') {
            return resolve();
          }

          // Otherwise wait for the onUpdated event signalling completion
          function listener(updatedTabId, changeInfo) {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          }
          chrome.tabs.onUpdated.addListener(listener);
        });
      });
    }

    /**
     * Reloads a discarded tab (if necessary) and injects the scraping scripts.
     * @param {number} tabId
     */
    function prepareAndInject(tabId) {
      if (!tabId) return;

      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.error(
            `Failed to get tab ${tabId}:`,
            chrome.runtime.lastError,
          );
          return;
        }

        const proceed = () => {
          chrome.scripting.executeScript(
            {
              target: { tabId },
              files: [
                'libs/turndown.7.2.0.js',
                'libs/turndown-plugin-gfm.1.0.2.js',
                'content.js',
              ],
            },
            () => {
              if (chrome.runtime.lastError) {
                console.error(
                  `Failed to inject scripts into tab ${tabId}:`,
                  chrome.runtime.lastError,
                );
              }
            },
          );
        };

        // If the tab is discarded, reload it first
        if (tab && (tab.discarded || tab.frozen)) {
          chrome.tabs.reload(tabId, () => {
            waitForTabLoad(tabId).then(proceed);
          });
        } else {
          // Ensure the tab has finished loading before injecting
          waitForTabLoad(tabId).then(proceed);
        }
      });
    }

    // Prepare and inject scripts for each selected tab
    selectedTabs.forEach(({ tabId }) => prepareAndInject(tabId));
  });
});
