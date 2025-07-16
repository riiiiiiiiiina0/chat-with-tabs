(async () => {
  const turndown = await import(chrome.runtime.getURL('turndown.js'));
  const turndownService = new turndown.default();
  const markdown = turndownService.turndown(document.body.innerHTML);

  chrome.runtime.sendMessage({
    title: document.title,
    url: window.location.href,
    markdown: markdown
  });
})();
