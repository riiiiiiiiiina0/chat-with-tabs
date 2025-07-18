// Save button in the new UI (first primary button)
const saveButton = /** @type {HTMLButtonElement|null} */ (
  document.querySelector('#save-btn')
);

// Helper: briefly replace the button text to indicate success
function showStatus(text) {
  if (!saveButton) return;
  const originalText = saveButton.textContent;
  saveButton.textContent = text;
  saveButton.disabled = true;
  setTimeout(() => {
    saveButton.textContent = originalText;
    saveButton.disabled = false;
  }, 1500);
}

// Restore previously chosen value (defaults to "chatgpt")
chrome.storage.sync.get('defaultLLM', (res) => {
  const value =
    typeof res?.defaultLLM === 'string' ? res.defaultLLM : 'chatgpt';
  const input = document.querySelector(
    `input[name="llm-option"][value="${value}"]`,
  );
  if (input) /** @type {HTMLInputElement} */ (input).checked = true;
});

// Save on button click
if (saveButton) {
  saveButton.addEventListener('click', () => {
    const selected = /** @type {HTMLInputElement|null} */ (
      document.querySelector('input[name="llm-option"]:checked')
    );
    const value = selected?.value || 'chatgpt';
    console.log('value', value);
    chrome.storage.sync.set({ defaultLLM: value }, () => showStatus('Saved!'));
  });
}
