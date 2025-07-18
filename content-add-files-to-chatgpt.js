(() => {
  // Ask the background script for the tabs that were selected in the popup
  chrome.runtime.sendMessage({ type: 'get-selected-tabs-data' }, (response) => {
    const tabs = Array.isArray(response?.tabs) ? response.tabs : [];
    if (tabs.length === 0) {
      console.warn(
        '[content-add-files-to-chatgpt] No selected tab data received.',
      );
      return;
    }

    // Locate ChatGPT's prompt text area
    const editor = document.querySelector('[contenteditable="true"]');
    if (!editor) {
      console.warn(
        '[content-add-files-to-chatgpt] ChatGPT prompt textarea not found.',
      );
      return;
    }

    tabs.forEach((tab, idx) => {
      const { title, url, markdown } = tab;

      if (!markdown) {
        console.warn(
          `[content-add-files-to-chatgpt] No markdown content found for tab ${
            idx + 1
          }.`,
          tab,
        );
        return;
      }

      const fileContent = [
        `Please treat this as the content of page titled "${
          title || `Tab ${idx + 1}`
        }" (URL: ${url})`,
        `---`,
        markdown || '<no content>',
      ].join('\n\n');

      // Create a synthetic File so ChatGPT treats it as an attachment
      const fileName = `${(title || `tab-${idx + 1}`).replace(
        /[^a-z0-9\-_]+/gi,
        '_',
      )}.md`;
      const file = new File([fileContent], fileName, {
        type: 'text/markdown',
        lastModified: Date.now(),
      });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });

      editor.dispatchEvent(pasteEvent);
    });
  });
})();
