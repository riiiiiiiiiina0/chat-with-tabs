(async () => {
  // Build the File object directly from the markdown string.
  // Creating the File this way (instead of first wrapping the text in a Blob)
  // ensures that the original filename metadata (`file.md`) is retained when
  // the clipboard data is read by downstream consumers like ChatGPT.
  const markdownSource = `# Hello World`;
  const file = new File([markdownSource], 'file.md', {
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

  const editor = document.querySelector('#prompt-textarea');
  if (editor) editor.dispatchEvent(pasteEvent);
})();
