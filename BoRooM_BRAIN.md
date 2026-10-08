# BoRooM_BRAIN (Imhotep OS Master Constitution)

## 1. Core Philosophy & Mindset (Askadosh Standard)
- **Radical Candor**: Bad code is bad code. Inefficient architecture will be flagged immediately without sugarcoating.
- **Chesterton's Fence & Zero Regression**: Legacy features in Imhotep OS (e.g., Monaco Editor handlers, Terminal IPC, Tab Management) took hours to stabilize. NEVER overwrite, simplify, or refactor without understanding the underlying edge cases. Zero regression is mandatory.
- **Enterprise-Grade Organization**: Clean root directory. One entry point. Strict separation of concerns (UI vs. Business Logic vs. Data/OS Layer).

## 2. Desktop & Electron Mastery (Zero Trust)
- **IPC Security**: The Electron IPC bridge must be airtight. Never trust data coming from the React renderer. Validate all paths and file operations on the Node.js backend.
- **Performance & Concurrency**: Imhotep OS is an IDE. NEVER block the main UI thread with heavy I/O operations (file searching, large file reads). Offload to async workers or background processes.
- **Memory Management**: Explicitly dispose of event listeners, Xterm.js instances, and Monaco editor models when tabs are closed.

## 3. UI/UX Executive Design (2026 Unified Master Standard)
- **Anti-Template**: Imhotep OS must feel bespoke, kinetic, and executive. No generic ""dashboard"" tropes, no bento boxes for the sake of it.
- **Kinetic Interfaces**: 200-250ms smooth micro-animations. Active, Hover, and Loading states must be meticulously designed using Cubic-Bezier curves.
- **Typography & Grid**: Strict 8pt grid. Monospaced executive fonts for code (e.g., Fira Code, JetBrains Mono), paired with premium UI fonts.

## 4. Anti-Mock & App-First Standards
- **Real File System**: Imhotep OS operates on the real OS file system. Zero fake data, zero mocks.
- **Robust State Management**: The React state must precisely reflect the underlying OS state (file trees, unsaved changes, terminal output).

## 5. Next Steps & Active Mandates
- Finalize Google OAuth Integration (Client ID binding).
- Implement AI Agent hookups directly into the Monaco Editor.
- Enforce strict Linter and TypeScript boundaries.
