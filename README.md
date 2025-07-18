# 🗂️💬 Chat with Tabs

A browser extension for any **Chromium-based browser** (Chrome, Edge, Brave, etc.) that lets you **chat with your open browser tabs**. Select a couple of pages, hit **Use as context** and watch them appear inside ChatGPT (or Gemini) as handy Markdown attachments. Perfect for asking things like:

- "Summarise these docs"
- "Compare these products"
- "Explain this blog post like I'm 5"

<a href="https://buymeacoffee.com/riiiiiiiiiina" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-blue.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

---

## 🎥 Demo

[![Watch the demo on YouTube](https://img.youtube.com/vi/1DdaKrrQFNI/0.jpg)](https://www.youtube.com/watch?v=1DdaKrrQFNI)

---

## ✨ Features

- 🔍 Lists every open tab in the current window (excluding the active one – because the AI chat is probably there!) complete with favicon, title & URL.
- 😴 Detects sleeping/discarded tabs, reloads them automatically, and marks them with a tiny 💤 so you know they might take a moment to wake up.
- ✔️ Multi-select in two ways: either tick check-boxes in the popup or simply highlight several tabs in the browser and hit the extension icon – no popup required.
- 📹 **YouTube super-powers:** captures the video title, description and the full transcript for instant AI summaries.
- 🚀 Converts each selected page to **clean GitHub-flavoured Markdown** via [Turndown](https://github.com/mixmark-io/turndown).
- 📎 Pastes the Markdown straight into ChatGPT or Gemini as **file attachments** – goodbye copy-paste.
- 🔀 Automatically opens (or focuses) your preferred LLM (ChatGPT or Gemini). Pick your favourite in the options page.
- 🛡️ 100 % local – nothing is sent anywhere except to the AI tab you choose.

---

## 🛠️ Installation

1. Clone or download this repo.
2. Open your Chromium-based browser (e.g., Chrome, Edge, Brave) and head to its extensions page (`chrome://extensions`, `edge://extensions`, etc.).
3. Toggle **Developer mode** (top-right).
4. Click **Load unpacked** and select the project folder (`chat-with-tabs`).
5. A cute 🗂️ icon should pop up in your toolbar – you’re ready to roll!

---

## 🚶‍♀️ Quick walk-through

1. Open the pages you want to discuss (and, if you like, highlight them in the tab strip).
2. Click the 🗂️ **Chat with Tabs** icon.
   - If you’re already on ChatGPT/Gemini you’ll see the popup – tick the pages you want and press **Use as context**.
   - If you’re on any other page the extension will grab all highlighted tabs right away (no popup!).
3. The extension opens (or focuses) your preferred LLM and drops the pages in as Markdown files. Ask away! 🎉

---

## 👩‍💻 Development

```bash
# Install type definitions
npm install
```

The extension is pure vanilla JS (+ a touch of [Tailwind](https://tailwindcss.com/) & [daisyUI](https://daisyui.com/)), so there’s **no build step**. Just reload your unpacked extension after making changes.

Main files:

| File                              | Purpose                                 |
| --------------------------------- | --------------------------------------- |
| `popup.html` / `popup.js`         | Tab picker UI                           |
| `content.js`                      | Scrapes & converts webpages to Markdown |
| `background.js`                   | Coordinates messages / script injection |
| `content-add-files-to-chatgpt.js` | Pastes Markdown into ChatGPT/Gemini     |

---

## 🤝 Contributing

Got ideas? Found a bug? PRs and issues are very welcome – let’s make browsing + AI even more fun together! ✨

---

## ⚠️ Disclaimer

This project is **not** affiliated with OpenAI, Google, or any other company. Use at your own risk and respect each website’s terms of service.

---

## 📜 License

[MIT](LICENSE) – do whatever, but please drop a star ⭐ if this helped you!
