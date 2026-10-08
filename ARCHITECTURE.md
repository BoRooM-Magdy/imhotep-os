# 🇪🇬 Imhotep-OS: The Sovereign Native AI Agent Studio
**Project Overview & Master Architecture Document**

## 1. What is Imhotep-OS? (The Core Concept)
**Imhotep-OS** is a **Standalone, Cross-Platform Desktop Application (Windows, macOS, Linux)**. It is NOT a web application, and it is NOT a VS Code extension. 
It is a "Sovereign AI Agent Operating System" built to completely replace traditional IDEs (like Cursor or Windsurf) and browser-based AI chats. It is installed on the user's machine (via `.exe`, `.dmg`, `.deb`) and operates as a local, fully autonomous AI software engineering team.

## 2. Tech Stack (The Engine)
* **Desktop Shell & Backend:** `Rust` + `Tauri v2` (Chosen over Electron for extreme performance, low RAM usage, and native OS integration). *(Note: Currently prototyping in Electron, but architecture must be decoupled for Tauri migration).*
* **Frontend UI:** `React 18` + `Vite` + `Tailwind CSS v4`.
* **Editor Core:** `Monaco Editor` (The core of VS Code).
* **Local Backend API:** `Python / FastAPI` (acting as the local Gateway & AI orchestrator).
* **Local Database:** `SQLite` (for Time-Travel Scrubbing, local checkpoints, and robust state management).

## 3. Why is it different? (The "Ferrari" Features)
Unlike standard AI coding assistants that rely on copy-pasting or cloud lock-in, Imhotep-OS has:

1. **Full OS & Local Machine Access:** It doesn't mock data. It directly reads the user's hard drive, creates folders, runs `npm` or `cargo` commands in a real integrated terminal, and tests the code locally.
2. **Medjay Swarm Intelligence (Autonomous Agents):** It doesn't just answer questions. It dispatches multiple background sub-agents in parallel (e.g., one agent writes backend, another tests the frontend, and a QA agent checks for UI bugs).
3. **The "Solve Autonomously" Dagger (Surgical Edits):** The user can visually point at any part of the UI or code, write a comment, and click "Solve". The AI independently finds the file, generates the exact localized `Diff` (Unified Diff or AST Edit), and applies the surgical fix without overwriting the entire file. Full files are NEVER regenerated.
4. **Universal Run Studio (Live Preview):** A built-in panel containing an interactive device mockup (e.g., iPhone 16 Pro frame). The AI builds the code and runs the local dev server, and the result appears instantly inside the desktop app. No need to open external browsers.
5. **Zero-Trust Security & OS Keychain:** Since the AI has full OS access, API keys (Claude/Gemini) are never stored in plain text. They are encrypted using the native OS Keychain (Windows Credential Manager / Apple Keychain). It also features a VS Code-style "Restricted Mode" that blocks autonomous code execution in untrusted folders.

## 4. The 5-Column Studio Interface
The frontend is a masterfully crafted, highly dense 5-column grid layout designed for hardcore engineers:
1. **Activity Bar:** Global navigation (Files, Search, Settings).
2. **File Explorer:** Real-time sync with the local OS filesystem.
3. **Monaco Code Editor + Integrated Terminal:** For manual code review and shell access.
4. **Universal Run Studio (Live Mockup):** Visual output of the running application.
5. **Imhotep AI Chat & Swarm Copilot:** The command center where the user talks to the agent and approves its actions.

## 5. Local & Sovereign AI Mentality
It allows users to plug in their own API keys (Anthropic, Google) or connect to **Local Hardware Models** (Ollama / Qwen / DeepSeek) ensuring 100% privacy and zero data leakage. 

## 6. Architectural Strictness (The 3-Layer Rule)
All logic must be strictly decoupled:
* **Frontend:** Dumb UI components, Monaco state, and Tailwind styling. NO file system or OS calls allowed directly in React.
* **Backend Shell (Rust/Tauri or Electron):** OS-level IPC calls, Window management, Terminal PTY handling, and SQLite checkpointing.
* **Python Gateway:** AI routing, AST Slicing, Token Cost Calculation, and the Zero Trust Vault middleware.

## 7. The "Wow Factor" (UX & Immersive Features)
1. **Hardware-Aware Local Model Hub:** An internal marketplace for downloading LLMs (like LM Studio). The system benchmarks the user's RAM and GPU (VRAM) to exclusively recommend models that run smoothly on their specific machine.
2. **The Pharaonic Voice Engine:** Two-way voice communication where the AI speaks with the commanding, majestic voice of an ancient Egyptian god.
3. **1-Click Magic Solve in Run Studio:** When a runtime error occurs in the embedded Web/Mobile preview, a single `[✨ Solve]` button appears. Clicking it dispatches the AI to analyze the stack trace, locate the fault, and surgically patch it without manual copy-pasting.
4. **Project-Bound Chat History:** AI conversations are not a global mess. Every project directory maintains its own persistent, contextual chat history stored locally, so context is never lost when switching workspaces.

---
**Goal for the AI reading this:**
Understand that you are assisting in building a Native Desktop IDE and Autonomous Agent Orchestrator. All solutions provided must adhere to native desktop constraints, real filesystem persistence, strict decoupling, and surgical diff-based code updates. Do NOT output full files for small changes.
