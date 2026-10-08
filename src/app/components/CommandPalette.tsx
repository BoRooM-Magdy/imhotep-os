import { useState, useEffect, useRef, useCallback } from "react";

export type Command = {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  icon?: string;
  action: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  commands: Command[];
  recentFiles?: { name: string; path: string; onOpen: () => void }[];
  workspaceFiles?: { name: string; path: string; onOpen: () => void }[];
};

export default function CommandPalette({ open, onClose, commands, recentFiles = [], workspaceFiles = [] }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isFileMode = query.startsWith(">") === false && (workspaceFiles.length > 0 || recentFiles.length > 0);

  const filtered = query.startsWith(">") 
    ? commands.filter(c => {
        if (!c) return false;
        const q = query.slice(1).toLowerCase().trim();
        return !q || c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
      })
    : commands.filter(c => {
        if (!c) return false;
        const q = query.toLowerCase().trim();
        return !q || c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
      });

  const itemsRaw: { label: string; category: string; shortcut?: string; action: () => void }[] = 
    isFileMode 
      ? (query.trim() === '' ? recentFiles : workspaceFiles)
          .filter(f => !query.trim() || f.name.toLowerCase().includes(query.toLowerCase().trim()))
          .map(f => ({ label: f.name, category: f.path, action: () => { f.onOpen(); onClose(); } }))
      : filtered.map(c => ({ label: c.label, category: c.category, shortcut: c.shortcut, action: () => { c.action(); onClose(); } }));

  const items = [...itemsRaw].sort((a, b) => a.category.localeCompare(b.category));

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => setSelected(0), [query]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items.find((_, i) => i === selected)?.action();
    } else if (e.key === "Escape") {
      onClose();
    }
  }, [items, selected, onClose]);

  useEffect(() => {
    if (listRef.current) {
      const els = listRef.current.querySelectorAll('.command-item');
      const el = els[selected] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  if (!open) return null;

  const categoryGroups: Record<string, typeof items> = {};
  for (const item of items) {
    if (!categoryGroups[item.category]) categoryGroups[item.category] = [];
    categoryGroups[item.category].push(item);
  }

  let globalIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full flex flex-col overflow-hidden rounded-sm shadow-2xl"
        style={{ maxWidth: 620, background: "#252526", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "60vh" }}
      >
        {/* Search Input */}
        <div className="flex items-center px-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)", height: 42 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9a9a9a" strokeWidth="2" className="shrink-0 mr-2">
            <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isFileMode ? "Go to File..." : "Type '>' for commands..."}
            className="flex-1 bg-transparent outline-none text-[13px] text-[#cccccc] placeholder:text-[#6b6b80]"
            style={{ fontFamily: "Outfit, sans-serif" }}
          />
          <span className="text-[11px] text-[#6b6b80] ml-2 shrink-0">ESC to close</span>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: "calc(60vh - 42px)", scrollbarWidth: "thin" }}>
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-[#6b6b80]">No results found</div>
          ) : (
            Object.entries(categoryGroups).map(([cat, catItems]) => (
              <div key={cat}>
                {Object.keys(categoryGroups).length > 1 && (
                  <div className="px-4 py-1.5 text-[10px] uppercase tracking-widest text-[#6b6b80] border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    {cat}
                  </div>
                )}
                {catItems.map((item) => {
                  const idx = globalIdx++;
                  const isSel = idx === selected;
                  return (
                    <div
                      key={item.label + idx}
                      className="command-item flex items-center justify-between px-4 py-2 cursor-pointer"
                      style={{ background: isSel ? "#094771" : "transparent" }}
                      onMouseEnter={() => setSelected(idx)}
                      onClick={() => item.action()}
                    >
                      <div className="flex flex-col">
                        <span className="text-[13px] text-[#cccccc]">{item.label}</span>
                        {isFileMode && (
                          <span className="text-[11px] text-[#6b6b80] truncate" style={{ maxWidth: 400 }}>{item.category}</span>
                        )}
                      </div>
                      {item.shortcut && (
                        <kbd className="text-[10px] px-1.5 py-0.5 rounded text-[#cccccc]" style={{ background: "rgba(255,255,255,0.08)", fontFamily: "monospace" }}>
                          {item.shortcut}
                        </kbd>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


