import { useState } from "react";

type SettingItem = {
  id: string;
  label: string;
  description: string;
  type: 'boolean' | 'number' | 'select' | 'string' | 'button';
  value?: any; buttonLabel?: string; onClick?: () => void;
  options?: { label: string; value: any }[];
  min?: number;
  max?: number;
  onChange?: (v: any) => void;
};

type SettingGroup = {
  title: string;
  icon: string;
  items: SettingItem[];
};

function SettingRow({ item }: { item: SettingItem }) {
  return (
    <div className="flex items-center justify-between py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <div className="flex flex-col flex-1 pr-6">
        <span className="text-[13px] text-[#cccccc] font-medium">{item.label}</span>
        <span className="text-[12px] text-[#6b6b80] mt-1 leading-relaxed">{item.description}</span>
      </div>
      <div className="shrink-0 flex items-center">
        {item.type === 'boolean' && (
          <button
            onClick={() => item.onChange(!item.value)}
            className="w-10 h-5 rounded-full relative transition-colors duration-200 shrink-0"
            style={{ background: item.value ? "#007acc" : "#3c3c3c" }}
          >
            <div className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-200" style={{ left: item.value ? "calc(100% - 18px)" : 2 }} />
          </button>
        )}
        {item.type === 'number' && (
          <input
            type="number"
            value={item.value}
            min={item.min}
            max={item.max}
            onChange={e => {
              const val = e.target.value;
              if (val === '') return;
              item.onChange(Number(val));
            }}
            onBlur={e => {
              let val = Number(e.target.value);
              if (isNaN(val) || (item.min !== undefined && val < item.min)) val = item.min || 0;
              if (item.max !== undefined && val > item.max) val = item.max;
              item.onChange(val);
            }}
            className="w-20 rounded px-2 py-1 text-[12px] outline-none text-center"
            style={{ background: "#3c3c3c", border: "1px solid rgba(255,255,255,0.1)", color: "#cccccc" }}
          />
        )}
        {item.type === 'select' && (
          <select
            value={item.value}
            onChange={e => item.onChange(e.target.value)}
            className="rounded px-2 py-1 text-[12px] outline-none"
            style={{ background: "#3c3c3c", border: "1px solid rgba(255,255,255,0.1)", color: "#cccccc" }}
          >
            {item.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
        {item.type === 'string' && (
          <input
            type="text"
            value={item.value}
            onChange={e => item.onChange?.(e.target.value)}
            className="w-40 rounded px-2 py-1 text-[12px] outline-none"
            style={{ background: "#3c3c3c", border: "1px solid rgba(255,255,255,0.1)", color: "#cccccc" }}
          />
        )}
        {item.type === 'button' && (
          <button
            onClick={item.onClick}
            className="rounded px-3 py-1 text-[12px] transition-colors hover:bg-white/10"
            style={{ background: "#3c3c3c", border: "1px solid rgba(255,255,255,0.1)", color: "#cccccc" }}
          >
            {item.buttonLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export type EditorSettings = {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: 'on' | 'off' | 'wordWrapColumn';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';
  stickyScroll: boolean;
  bracketPairColorization: boolean;
  renderWhitespace: 'none' | 'boundary' | 'all';
  cursorBlinking: 'blink' | 'smooth' | 'phase' | 'solid';
  formatOnSave: boolean;
  autoSave: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  settings: EditorSettings;
  onChange: (key: keyof EditorSettings, value: any) => void;
  onLogout: () => void;
};

export default function SettingsPanel({ open, onClose, settings, onChange, onLogout }: Props) {
  const [activeGroup, setActiveGroup] = useState("Text Editor");
  const [search, setSearch] = useState("");

  if (!open) return null;

  const groups: SettingGroup[] = [
    {
      title: "Text Editor",
      icon: "T",
      items: [
        { id: "fontSize", label: "Font Size", description: "Controls the font size in pixels.", type: "number", value: settings.fontSize, min: 8, max: 32, onChange: v => onChange('fontSize', v) },
        { id: "fontFamily", label: "Font Family", description: "Controls the font family. e.g. 'JetBrains Mono, monospace'", type: "string", value: settings.fontFamily, onChange: v => onChange('fontFamily', v) },
        { id: "tabSize", label: "Tab Size", description: "The number of spaces a tab is equal to.", type: "number", value: settings.tabSize, min: 1, max: 8, onChange: v => onChange('tabSize', v) },
        { id: "wordWrap", label: "Word Wrap", description: "Controls how lines should wrap.", type: "select", value: settings.wordWrap, options: [{label: 'Off', value: 'off'}, {label: 'On', value: 'on'}, {label: 'Word Wrap Column', value: 'wordWrapColumn'}], onChange: v => onChange('wordWrap', v) },
        { id: "lineNumbers", label: "Line Numbers", description: "Controls the display of line numbers.", type: "select", value: settings.lineNumbers, options: [{label: 'On', value: 'on'}, {label: 'Off', value: 'off'}, {label: 'Relative', value: 'relative'}], onChange: v => onChange('lineNumbers', v) },
        { id: "cursorBlinking", label: "Cursor Blinking", description: "Control the cursor animation style.", type: "select", value: settings.cursorBlinking, options: [{label: 'Blink', value: 'blink'}, {label: 'Smooth', value: 'smooth'}, {label: 'Phase', value: 'phase'}, {label: 'Solid', value: 'solid'}], onChange: v => onChange('cursorBlinking', v) },
        { id: "bracketPairColorization", label: "Bracket Pair Colorization", description: "Enables bracket pair colorization.", type: "boolean", value: settings.bracketPairColorization, onChange: v => onChange('bracketPairColorization', v) },
        { id: "renderWhitespace", label: "Render Whitespace", description: "Controls how whitespace characters are rendered.", type: "select", value: settings.renderWhitespace, options: [{label: 'None', value: 'none'}, {label: 'Boundary', value: 'boundary'}, {label: 'Selection', value: 'selection'}, {label: 'Trailing', value: 'trailing'}, {label: 'All', value: 'all'}], onChange: v => onChange('renderWhitespace', v) },
      ]
    },
    {
      title: "UI & View",
      icon: "U",
      items: [
        { id: "minimap", label: "Minimap", description: "Controls whether the minimap is shown.", type: "boolean", value: settings.minimap, onChange: v => onChange('minimap', v) },
        { id: "stickyScroll", label: "Sticky Scroll", description: "Shows the current scope at the top of the editor.", type: "boolean", value: settings.stickyScroll, onChange: v => onChange('stickyScroll', v) },
      ]
    },
    {
      title: "Files",
      icon: "F",
      items: [
        { id: "formatOnSave", label: "Format On Save", description: "Format a file on save.", type: "boolean", value: settings.formatOnSave, onChange: v => onChange('formatOnSave', v) },
        { id: "autoSave", label: "Auto Save", description: "Controls auto save of editors that have unsaved changes.", type: "boolean", value: settings.autoSave, onChange: v => onChange('autoSave', v) },
      ]
    },
    {
      title: "Account",
      icon: "A",
      items: [
        { id: "account_status", label: "Google Account", description: "Manage your authentication session.", type: "button", buttonLabel: "Log Out", onClick: onLogout }
      ]
    }
  ];

  const allItems = groups.flatMap(g => g.items);
  const filteredItems = search.trim() 
    ? allItems.filter(i => i.label.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()))
    : null;

  const displayGroup = groups.find(g => g.title === activeGroup);
  const displayItems = filteredItems || displayGroup?.items || [];

  return (
    <div className="fixed inset-0 z-[9998] flex" style={{ background: "rgba(0,0,0,0.5)", fontFamily: "Outfit, sans-serif" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex flex-1 overflow-hidden w-full" style={{ margin: "auto", maxWidth: 900, height: "80vh", background: "#1e1e1e", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }}>
        {/* Left sidebar — groups */}
        <div className="flex flex-col w-56 border-r shrink-0 overflow-y-auto" style={{ background: "#252526", borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="px-5 py-4 text-[13px] text-[#cccccc] font-semibold border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>Settings</div>
          <div className="p-2 flex flex-col gap-1">
            {groups.map(g => (
              <button key={g.title} onClick={() => { setActiveGroup(g.title); setSearch(""); }}
                className="text-left px-3 py-2 text-[13px] transition-colors rounded"
                style={{ color: activeGroup === g.title ? "#ffffff" : "#9a9a9a", background: activeGroup === g.title ? "#007acc" : "transparent" }}>
                {g.title}
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top search + close */}
          <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b6b80" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input
              type="text"
              placeholder="Search settings"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[12px] text-[#cccccc] placeholder:text-[#6b6b80]"
            />
            <button onClick={onClose} className="p-1 rounded hover:bg-[#3c3c3c] text-[#6b6b80] hover:text-[#cccccc]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          
          {/* Settings list */}
          <div className="flex-1 overflow-y-auto px-6" style={{ scrollbarWidth: "thin" }}>
            {displayItems.map(item => <SettingRow key={item.id} item={item} />)}
          </div>
        </div>
      </div>
    </div>
  );
}


