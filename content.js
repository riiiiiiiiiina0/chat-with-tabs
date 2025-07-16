(async () => {
  /**
   * TurndownService is a constructor for creating a new Turndown service instance.
   * @class
   * @see {@link https://github.com/mixmark-io/turndown}
   * @see {@link https://unpkg.com/turndown@7.2.0/dist/turndown.js}
   * @ts-ignore
   */
  // @ts-ignore
  const turndownService = new TurndownService();
  const markdown = turndownService.turndown(document.body.innerHTML);

  chrome.runtime.sendMessage({
    title: document.title,
    url: window.location.href,
    markdown,
  });
})();
