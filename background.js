import 'https://unpkg.com/turndown/dist/turndown.js';

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.markdown) {
    console.log("Page Title:", request.title);
    console.log("Page URL:", request.url);
    console.log("Markdown Content:", request.markdown);
  }
});
