async function getPageContent() {
  // Clone the document so we can mutate it freely
  const clone = /** @type {Document} */ (document.cloneNode(true));

  // Remove things that are useless in Markdown
  clone
    .querySelectorAll(
      `script, style, noscript, iframe, svg, canvas, header, footer, nav, aside, [hidden], [aria-hidden="true"]`,
    )
    .forEach((el) => el.remove());

  /**
   * TurndownService is a constructor for creating a new Turndown service instance.
   * @class
   * @see {@link https://github.com/mixmark-io/turndown}
   * @see {@link https://unpkg.com/turndown@7.2.0/dist/turndown.js}
   * @ts-ignore
   */
  // @ts-ignore
  const turndownService = new TurndownService({
    headingStyle: 'atx', // # H1
    codeBlockStyle: 'fenced', // ```js
    bulletListMarker: '-', // - list item
    emDelimiter: '*', // *italic*
    strongDelimiter: '**', // **bold**
    hr: '---', // horizontal rule
    br: '\n', // line-break handling
    linkStyle: 'inlined', // [text](url) instead of ref links
    linkReferenceStyle: 'full',
  });

  // @ts-ignore
  turndownService.use(turndownPluginGfm.gfm);

  // Add a rule to drop empty paragraphs, tracking pixels, etc.
  turndownService.addRule('dropEmpty', {
    filter: (node) =>
      node.nodeName === 'P' &&
      !node.textContent.trim() &&
      !node.querySelector('img'),
    replacement: () => '',
  });

  const markdown = turndownService.turndown(clone.body.innerHTML);

  return markdown;
}

(async () => {
  const markdown = await getPageContent();

  chrome.runtime.sendMessage({
    title: document.title,
    url: window.location.href,
    markdown,
  });
})();
