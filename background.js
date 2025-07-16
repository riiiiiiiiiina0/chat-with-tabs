chrome.action.onClicked.addListener((tab) => {
  console.log('background script', tab);
  if (tab.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [
        'libs/turndown.7.2.0.js',
        'libs/turndown-plugin-gfm.1.0.2.js',
        'content.js',
      ],
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.markdown) {
    console.log('Page Title:', request.title);
    console.log('Page URL:', request.url);
    console.log('Markdown Content:', request.markdown);
  }
});
