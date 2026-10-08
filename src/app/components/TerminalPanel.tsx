import React, { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export default function TerminalPanel({ onClose, folderPath }: { onClose: () => void, folderPath?: string | null }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) {
      terminalRef.current.innerHTML = "<div style='color:red; padding:10px;'>Terminal requires native Electron environment.</div>";
      return;
    }

    const term = new Terminal({
      theme: {
        background: "#090a0d",
        foreground: "#c8c8d4",
        cursor: "#D4AF37",
        cursorAccent: "#090a0d",
        selectionBackground: "rgba(212,175,55,0.3)"
      },
      fontFamily: "'JetBrains Mono', Consolas, monospace",
      fontSize: 13,
      cursorBlink: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(terminalRef.current);
    fit.fit();

    termInstance.current = term;
    fitAddon.current = fit;

    // Send keystrokes from UI to PTY
    term.onData((data) => {
      electronAPI.writeTerminal(data);
    });

    // Receive output from PTY to UI
    const unlistenTerminal = electronAPI.onTerminalData((data: string) => {
      term.write(data);
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddon.current && termInstance.current) {
        fitAddon.current.fit();
        electronAPI.resizeTerminal(termInstance.current.cols, termInstance.current.rows);
      }
    };
    
    window.addEventListener("resize", handleResize);

    // Start PTY in backend
    electronAPI.startTerminal(folderPath);

    // Initial resize sync
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (typeof unlistenTerminal === 'function') unlistenTerminal();
      term.dispose();
    };
  }, []);

  // Update working directory if folder changes
  useEffect(() => {
    if (folderPath && termInstance.current) {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI && electronAPI.writeTerminal) {
        electronAPI.writeTerminal(`cd "${folderPath}"\r\n`);
      }
    }
  }, [folderPath]);

  return (
    <div className="flex flex-col w-full h-[250px] shrink-0 border-t z-10" style={{ background: "#090a0d", borderColor: "rgba(212,175,55,0.15)" }}>
      {/* Terminal Tab Header */}
      <div className="flex items-center justify-between px-4 h-8 border-b" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
        <div className="flex items-center gap-4 h-full">
          <div className="flex items-center gap-2 h-full border-b-[2px] cursor-pointer" style={{ borderColor: "#D4AF37", color: "#c8c8d4" }}>
            <span className="text-[11px] font-bold tracking-wider uppercase">Terminal</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-[#6b6b80] hover:text-[#c8c8d4] p-1 rounded transition-colors">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Terminal View */}
      <div className="flex-1 w-full overflow-hidden p-2" ref={terminalRef}></div>
    </div>
  );
}
