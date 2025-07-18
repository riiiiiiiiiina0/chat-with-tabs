// @ts-check

// Automatically set DaisyUI theme based on system preference
(function autoTheme() {
  const applyTheme = () => {
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;
    document.documentElement.setAttribute(
      'data-theme',
      prefersDark ? 'dark' : 'light',
    );
  };
  applyTheme();
  // Update theme if the system preference changes
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', applyTheme);
})();

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
      .filter((tab) => tab.url && tab.url.startsWith('http') && !tab.active)
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

    // Extract the numeric tab IDs from the checked checkboxes
    const tabIds = checked
      .map((cb) => parseInt(cb.dataset.tabId || '', 10))
      .filter((id) => !Number.isNaN(id));

    // Nothing selected – simply close the popup
    if (tabIds.length === 0) {
      window.close();
      return;
    }

    // Ask the background service-worker to collect the context and process it
    chrome.runtime.sendMessage({ type: 'collect-context', tabIds });

    // Close the popup – the background script will take it from here
    window.close();
  });
});
