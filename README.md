<div align="center">
  <img src="https://via.placeholder.com/150/094771/FFFFFF?text=Imhotep+OS" alt="Imhotep OS Logo" width="120" height="120" />
  <h1>𓂀 Imhotep OS</h1>
  <p><b>The Ultimate AI Operating System & Developer Environment</b></p>

  <p>
    <img src="https://img.shields.io/badge/Electron-43.1.1-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
    <img src="https://img.shields.io/badge/React-18.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/AI_Agent-Powered-FF3366?style=for-the-badge" alt="AI Agent" />
  </p>
</div>

---

## ⚡ Overview

**Imhotep OS** is not just another code editor—it is an **Autonomous Operating System Agent** built specifically for developers. Designed to compete with VS Code and Cursor, Imhotep OS bridges the gap between a traditional IDE and a fully autonomous AI agent. 

It doesn't just autocomplete your code; it can **take control of your computer**, interact with desktop applications (like Photoshop, Premiere, or browsers), directly edit your Abstract Syntax Trees (AST), and search your entire local vector workspace in milliseconds.

---

## 🔥 Monumental Features

### 🤖 1. The OS Agent (Computer Use)
Turn on **Agent Mode** and Imhotep becomes a digital human. 
- **Vision Grid System:** Imhotep captures a screenshot of your machine, injects a highly precise red/green coordinate grid over the image, and feeds it to Vision Models (like Gemini 1.5 Pro or Claude 3.5 Sonnet).
- **Zero-Dependency Mouse/Keyboard:** Using natively injected C# and PowerShell, Imhotep takes complete control of the mouse and keyboard to interact with *any* Windows application with pinpoint accuracy.

### 🧠 2. Direct AST Code Editing
Traditional AI editors simulate typing or force you to copy-paste. Imhotep OS uses direct AST (`read_file`, `write_file`, `replace_in_file`) tools. The AI edits your codebase directly in the background at lightning speed.

### 🔎 3. Project-Wide Memory & RAG
Working on a massive 1000-file project? The Agent uses native `search_files` tools to index and find exact keyword matches across your entire directory structure, injecting only the relevant context into its prompt to avoid token bloat.

### 🌐 4. Unrestricted AI Connectivity
- **Native Google Gemini:** Direct API integration means you can use Gemini 1.5 Pro/Flash for free, without paying gateway fees.
- **OpenRouter Gateway:** Instantly connect to GPT-4o, Claude 3.5 Sonnet, or Llama 3 via OpenRouter.
- **Local AI Auto-Boot:** Click "Scan Local Models" and Imhotep will automatically find and silently boot `Ollama` and `LM Studio` servers in the background.

### 💻 5. Enterprise-Grade Editor
Powered by **Monaco Editor** (the core of VS Code), featuring:
- Live File Tree & Workspace Explorer
- Integrated Command Palette (`Ctrl+P` / `Cmd+P`)
- Outline & Symbol Parsing Panel
- Problems & Linting Panel
- Fully customized kinetic UI/UX

---

## 🛠️ Architecture

Imhotep OS relies on a secure **Electron Inter-Process Communication (IPC)** bridge:
- **Renderer (`App.tsx`):** Handles the Agentic Loop, UI state, Monaco instances, and LLM payloads.
- **Main (`main.cjs`):** Bypasses Node.js limitations by executing pure Windows API calls via PowerShell for instant mouse/keyboard events, ensuring zero `node-gyp` native build errors.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Windows OS (for OS Agent mouse/keyboard features)
- An API Key (Google AI Studio or OpenRouter) or Local Ollama

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/imhotep-os.git
   cd imhotep-os
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run in Development Mode:**
   ```bash
   npm run dev
   ```

4. **Build the Production Executable:**
   ```bash
   npm run dist
   ```
   *The installer will be generated in the `release/` folder.*

---

## 🎮 How to use the OS Agent

1. Launch Imhotep OS.
2. Select a Vision-capable model (e.g., **Gemini 1.5 Pro**).
3. Toggle the **🤖 OS Agent: ON** button above the chat input.
4. Type a command: *"Open Notepad and write a python script"* or *"Click on the Google Chrome icon on my desktop"*.
5. Sit back and watch Imhotep take over your screen.

---

## 🛡️ Security & Privacy
Imhotep OS stores your API keys strictly in **local storage**. The OS Agent actions are executed locally on your machine. Always monitor the Agent while it controls your mouse/keyboard.

---

<div align="center">
  <b>Built with passion and radical architecture by BoRooM & Imhotep AI</b><br>
  <i>"Writing code is good. Having the code write itself is Imhotep."</i>
</div>