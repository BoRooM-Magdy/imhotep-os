import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import TerminalPanel from "./components/TerminalPanel";
import CommandPalette, { type Command } from "./components/CommandPalette";
import OutlinePanel from "./components/OutlinePanel";
import SimulatorPanel from './components/SimulatorPanel';
import ProblemsPanel, { type Problem } from "./components/ProblemsPanel";
import ModelsHub from "./components/ModelsHub";
import SettingsPanel, { type EditorSettings } from "./components/SettingsPanel";

// Self-contained class merging helper for clean transitions
const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");

// ─── SVG Logo ────────────────────────────────────────────────────────────────

const svgPaths = {
  p2d685f00: "M193.627 248.75H85.373L92.4453 236.5H186.555L193.627 248.75ZM183.668 231.5H95.332L103.415 217.5H175.585L183.668 231.5ZM172.698 212.5H106.302L114.096 199H164.904L172.698 212.5ZM162.017 194H116.983L123.334 183H155.666L162.017 194ZM152.779 178H126.221L139.5 155L152.779 178Z",
  p33ac4680: "M122.5 289.807C123.983 289.934 125.484 290 127 290H131.5V300H127C125.487 300 123.986 299.944 122.5 299.838V289.807ZM145.5 300H136.5V290H145.5V300ZM159.5 299.662C157.364 299.885 155.195 300 153 300H150.5V290H153C155.201 290 157.371 289.862 159.5 289.597V299.662ZM108.5 286.611C111.386 287.71 114.394 288.559 117.5 289.133V299.275C114.419 298.802 111.414 298.102 108.5 297.192V286.611ZM173.5 296.529C170.593 297.547 167.587 298.355 164.5 298.934V288.722C167.615 288.018 170.624 287.037 173.5 285.802V296.529ZM153.802 0.00488281C187.674 0.434151 215 28.026 215 62V238C215 263.152 200.023 284.806 178.5 294.53V283.328C194.318 274.41 205 257.453 205 238V62C205 33.2812 181.719 10 153 10H127C98.2812 10 75 33.2812 75 62V238C75 258.262 86.5891 275.816 103.5 284.398V295.391C80.911 286.131 65 263.924 65 238V62C65 28.026 92.3261 0.434149 126.198 0.00488281L127 0H153L153.802 0.00488281Z",
  p940cf40: "M103.5 300H5C2.23858 300 0 297.761 0 295C0 292.239 2.23858 290 5 290H103.5V300ZM131.5 300H122.5V290H131.5V300ZM145.5 300H136.5V290H145.5V300ZM159.5 300H150.5V290H159.5V300ZM173.5 300H164.5V290H173.5V300ZM275 290C277.761 290 280 292.239 280 295C280 297.761 277.761 300 275 300H178.5V290H275ZM117.5 300H108.5V290H117.5V300Z",
};

function CartoucheLogo({ size = 32 }: { size?: number }) {


  return (
    <svg width={size} height={Math.round(size * 300 / 280)} viewBox="0 0 280 300" fill="none">
      <path d={svgPaths.p33ac4680} fill="#D4AF37" />
      <circle cx="139.5" cy="84.5" fill="#D4AF37" r="48.5" />
      <path d={svgPaths.p2d685f00} fill="#D4AF37" />
      <path d={svgPaths.p940cf40} fill="#D4AF37" />
    </svg>
  );
}

// ─── AI Model catalog ─────────────────────────────────────────────────────────

type AIModel = {
  id: string; name: string; provider: string; color: string;
  tier: "flagship" | "balanced" | "fast" | "specialized";
  tags: string[]; context: string; desc: string;
  strengths: string[]; usedFor: string; badge?: string;
};

const STATIC_MODELS: AIModel[] = [
    {
      id: "google/gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "Google", color: "#4285F4", tier: "flagship", tags: ["cloud", "reasoning", "coding", "vision"], context: "2M", type: "cloud",
      desc: "Google's flagship model with a massive 2M token context window. Excellent for reasoning and analyzing large codebases.", strengths: ["Context Window", "Multimodal", "Code"], usedFor: "Large codebases", size: "N/A", params: "N/A"
    },
    {
      id: "google/gemini-1.5-flash", name: "Gemini 1.5 Flash (Fast/Free)", provider: "Google", color: "#4285F4", tier: "fast", tags: ["cloud", "fast", "vision"], context: "1M", type: "cloud",
      desc: "Google's extremely fast model. Great for quick, everyday tasks. Free for most use cases via OpenRouter or Native API.", strengths: ["Speed", "Cost"], usedFor: "Everyday coding", size: "N/A", params: "N/A"
    },
    {
      id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", color: "#d97757", tier: "flagship", tags: ["cloud", "reasoning", "coding"], context: "200K", type: "cloud",
      desc: "Anthropic's flagship model, offering absolute state-of-the-art coding and UI generation capabilities.", strengths: ["Coding", "Reasoning", "UI Generation"], usedFor: "Complex web dev", size: "N/A", params: "N/A"
    },
    {
      id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI", color: "#10a37f", tier: "flagship", tags: ["cloud", "smart", "multimodal"], context: "128K", type: "cloud",
      desc: "OpenAI's latest omni model. Fast, extremely capable, and highly reliable for general coding.", strengths: ["Reliability", "Speed", "Logic"], usedFor: "Backend logic", size: "N/A", params: "N/A"
    },
    {
      id: "deepseek/deepseek-coder", name: "DeepSeek Coder V2", provider: "DeepSeek", color: "#1d4ed8", tier: "specialized", tags: ["cloud", "coding"], context: "128K", type: "cloud",
      desc: "An incredible open-weights model fine-tuned specifically for coding. Often beats proprietary models in algorithms.", strengths: ["Algorithms", "Python", "C++"], usedFor: "Heavy programming", size: "N/A", params: "N/A"
    },
    {
      id: "meta-llama/llama-3.1-70b-instruct", name: "Llama 3.1 70B", provider: "Meta", color: "#0668E1", tier: "balanced", tags: ["cloud", "balanced"], context: "128K", type: "cloud",
      desc: "Meta's massive open-weights model. Offers GPT-4 level intelligence at a fraction of the cost.", strengths: ["General text", "Cost-effective"], usedFor: "General chat", size: "N/A", params: "N/A"
    },
    {
      id: "meta-llama/llama-3.1-8b-instruct:free", name: "Llama 3.1 8B (Free)", provider: "Meta", color: "#0668E1", tier: "fast", tags: ["cloud", "free", "fast"], context: "128K", type: "cloud",
      desc: "A completely free, lightning-fast 8B model via OpenRouter. Perfect for simple tasks without spending money.", strengths: ["Free", "Speed"], usedFor: "Simple tasks", size: "N/A", params: "N/A"
    },
    {
      id: "qwen/qwen-2.5-coder-32b-instruct", name: "Qwen 2.5 Coder 32B", provider: "Qwen", color: "#4B0082", tier: "specialized", tags: ["cloud", "coding"], context: "32K", type: "cloud",
      desc: "Alibaba's specialized coding model. Exceptionally good at understanding complex code structures.", strengths: ["Code Repair", "Autocompletion"], usedFor: "Coding", size: "N/A", params: "N/A"
    }
  ];

const TAG_FILTERS = ["all", "flagship", "fast", "reasoning", "code", "creative", "vision", "data", "open-source", "local"] as const;
type TagFilter = typeof TAG_FILTERS[number];

const DEFAULT_FAVORITES = new Set(["imhotep-auto-orchestrator"]);
const MODELS_TAB = "⚡ Models Hub";

// ─── File tree ────────────────────────────────────────────────────────────────

type FileNode = { name: string; type: "file"; lang: string; path?: string } | { name: string; type: "dir"; children: FileNode[]; path?: string; open?: boolean };

// ─── Icons ────────────────────────────────────────────────────────────────────

function FileIcon({ lang }: { lang: string }) {
  const map: Record<string, [string, string]> = {
    ts: ["TS", "#3178c6"], py: ["PY", "#f7cc42"], rs: ["RS", "#f74c00"],
    js: ["JS", "#f0db4f"], json: ["{}", "#D4AF37"], yaml: ["YM", "#cc3e44"], md: ["MD", "#c8c8d4"],
  };
  const [label, bg] = map[lang] ?? ["?", "#6b6b80"];
  return (
    <span className="inline-flex items-center justify-center text-[9px] font-bold rounded-sm w-[18px] h-[13px] shrink-0"
      style={{ background: bg, color: "#0d0e12" }}>{label}</span>
  );
}
function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
      <path d="M1 4.5C1 3.67 1.67 3 2.5 3H6l1.5 1.5H12.5C13.33 4.5 14 5.17 14 6v5.5c0 .83-.67 1.5-1.5 1.5h-10C1.67 13 1 12.33 1 11.5V4.5z" fill="#D4AF37" opacity={open ? 0.8 : 0.4} />
    </svg>
  );
}
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`}>
      <path d="M3 2l4 3-4 3" stroke="#6b6b80" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WorkspacesIcon({ active }: { active: boolean }) {
  const c = active ? "#D4AF37" : "#6b6b80";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 10h20" stroke={c} strokeWidth="1.4"/>
      <path d="M6 14h4" stroke={c} strokeWidth="1.4"/>
      {active && <circle cx="12" cy="3" r="1" fill="#D4AF37" />}
    </svg>
  );
}
function ExplorerIcon({ active }: { active: boolean }) {
  const c = active ? "#D4AF37" : "#6b6b80";
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="10" height="13" rx="1" stroke={c} strokeWidth="1.5" /><path d="M8 7h6M8 10h6M8 13h4" stroke={c} strokeWidth="1.2" strokeLinecap="round" /><path d="M10 16h10v5H10z" stroke={c} strokeWidth="1.2" /></svg>;
}
function SearchIcon({ active }: { active: boolean }) {
  const c = active ? "#D4AF37" : "#6b6b80";
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6" stroke={c} strokeWidth="1.5" /><path d="M15.5 15.5L20 20" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function SourceControlIcon({ active }: { active: boolean }) {
  const c = active ? "#D4AF37" : "#6b6b80";
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="6" cy="6" r="2.5" stroke={c} strokeWidth="1.4" /><circle cx="18" cy="6" r="2.5" stroke={c} strokeWidth="1.4" /><circle cx="12" cy="18" r="2.5" stroke={c} strokeWidth="1.4" /><path d="M6 8.5v3c0 2 2 3 4 3h4c2 0 4-1 4-3V8.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" /></svg>;
}
function ExtensionsIcon({ active }: { active: boolean }) {
  const c = active ? "#D4AF37" : "#6b6b80";
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="1" stroke={c} strokeWidth="1.4" /><rect x="13" y="3" width="8" height="8" rx="1" stroke={c} strokeWidth="1.4" /><rect x="3" y="13" width="8" height="8" rx="1" stroke={c} strokeWidth="1.4" /><path d="M13 17h8M17 13v8" stroke={active ? "#D4AF37" : "#6b6b80"} strokeWidth="1.4" strokeLinecap="round" /></svg>;
}
function ChatIcon({ active }: { active: boolean }) {
  const c = active ? "#D4AF37" : "#6b6b80";
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 4h16a1 1 0 011 1v10a1 1 0 01-1 1H8l-4 4V5a1 1 0 011-1z" stroke={c} strokeWidth="1.4" strokeLinejoin="round" /><circle cx="9" cy="9.5" r="1" fill={active ? "#D4AF37" : "#6b6b80"} /><circle cx="12" cy="9.5" r="1" fill={c} /><circle cx="15" cy="9.5" r="1" fill={c} /></svg>;
}
function ModelsIcon({ active }: { active: boolean }) {
  const c = active ? "#D4AF37" : "#6b6b80";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="5" r="2.5" stroke={c} strokeWidth="1.4" />
      <circle cx="5" cy="17" r="2.5" stroke={c} strokeWidth="1.4" />
      <circle cx="19" cy="17" r="2.5" stroke={c} strokeWidth="1.4" />
      <path d="M12 7.5v4M12 11.5L5 14.5M12 11.5L19 14.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
      {active && <circle cx="12" cy="5" r="1" fill="#D4AF37" />}
    </svg>
  );
}

// ─── Tier/tag badge ───────────────────────────────────────────────────────────

const TAG_COLOR: Record<string, string> = {
  code: "#00b4d8", reasoning: "#e67e22", creative: "#e91e8c",
  vision: "#8e44ad", data: "#16a085", fast: "#27ae60",
  "open-source": "#7f8c8d", "long-context": "#2980b9", balanced: "#95a5a6", flagship: "#D4AF37", local: "#D4AF37"
};

function Tag({ label }: { label: string }) {
  const color = TAG_COLOR[label] ?? "#6b6b80";
  return (
    <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-semibold uppercase tracking-wide"
      style={{ background: color + "22", color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  );
}

// ─── Models Hub ──────────────────────────────────────────────────────────────// ─── AGENT SIDEBAR (Projects & History) ───
function AgentSidebar({ openedFolder, sessions, activeSessionId, setSessions, setActiveSessionId, showPrompt, showConfirm, onNewChat }: any) {
  const recentProjects = (window as any).__imhotep_recent_projects || [];
  
  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] text-[#cccccc] overflow-hidden">
      {/* Header / Logo */}
      <div className="flex items-center gap-3 px-5 h-14 shrink-0 border-b" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
         <span className="text-[13px] font-bold tracking-[0.2em] text-[#D4AF37]">IMHOTEP OS</span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(212,175,55,0.1) transparent" }}>
          <div className="px-4 pt-4 pb-6">
              <button onClick={() => {
                  const newId = Date.now().toString();
                  setSessions((s: any) => [{ id: newId, title: "New Conversation", messages: [] }, ...s]);
                  setActiveSessionId(newId);
              }} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-[rgba(212,175,55,0.3)] hover:bg-[#D4AF37]/10 transition-colors text-[#D4AF37] text-[13px] font-semibold">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  New Conversation
              </button>
          </div>

          {/* AI Projects / Folders */}
          <div className="px-5 py-2 text-[10px] uppercase tracking-widest text-[#6b6b80] font-bold">Projects (Workspaces)</div>
          <div className="flex flex-col px-3 mb-6">
              {recentProjects.filter((p: any) => p && p.name).map((p: any) => (
                  <button key={p.path} onClick={() => {
                      const electronAPI = (window as any).electronAPI;
                      if (electronAPI?.openFolder) electronAPI.openFolder(p.path);
                  }}
                      className={cn("flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors text-[12px]", openedFolder === p.path ? "bg-[rgba(212,175,55,0.15)] text-[#D4AF37]" : "text-[#858585] hover:text-[#cccccc] hover:bg-white/5")}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                      <span className="truncate">{p.name}</span>
                  </button>
              ))}
          </div>

          {/* Chat History */}
          <div className="px-5 py-2 text-[10px] uppercase tracking-widest text-[#6b6b80] font-bold">Conversation History</div>
          <div className="flex flex-col px-3 mb-4 gap-0.5">
              {sessions.map((s: any) => (
                  <div key={s.id} onClick={() => setActiveSessionId(s.id)}
                      className={cn("group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-[12px] transition-colors", s.id === activeSessionId ? "bg-[rgba(212,175,55,0.08)] text-[#D4AF37] font-medium" : "text-[#cccccc] hover:bg-white/5")}>
                      <div className="flex items-center gap-2 truncate flex-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 opacity-70"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                          <span className="truncate">{s.title}</span>
                      </div>
                      <div className="hidden group-hover:flex items-center gap-1.5 pl-2 shrink-0">
                          <button onClick={async (e) => {
                              e.stopPropagation();
                              if (showPrompt) {
                                  const newTitle = await showPrompt('Rename conversation:', s.title);
                                  if (newTitle) setSessions((prev: any) => prev.map((x: any) => x.id === s.id ? { ...x, title: newTitle } : x));
                              }
                          }} className="text-[#6b6b80] hover:text-white" title="Rename"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></button>
                          <button onClick={async (e) => {
                              e.stopPropagation();
                              if (showConfirm) {
                                  const ok = await showConfirm('Delete this conversation?');
                                  if (ok) {
                                      setSessions((prev: any) => {
                                          const next = prev.filter((x: any) => x.id !== s.id);
                                          if (activeSessionId === s.id && next.length > 0) setActiveSessionId(next[0].id);
                                          else if (next.length === 0) setActiveSessionId("");
                                          return next;
                                      });
                                  }
                              }
                          }} className="text-[#6b6b80] hover:text-[#ff4444]" title="Delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                      </div>
                  </div>
              ))}
              {sessions.length === 0 && <div className="px-3 py-2 text-[11px] text-[#6b6b80]">No history</div>}
          </div>
      </div>
    </div>
  );
}

// ─── MAIN CHAT PANEL (Just the chat UI) ───
function ChatPanel({ favIds, onOpenModels, localModels, localGatewayMsg, openedFolder, showConfirm, showPrompt, sessions, setSessions, activeSessionId, onClose, selectedModel, onSelectModel }: any) {
  const combinedModels = [...localModels, ...STATIC_MODELS];
  const favModels = combinedModels.filter(m => favIds.has(m.id));
  const [pickerOpen, setPickerOpen] = useState(false);
    
    useEffect(() => {
      if (!selectedModel && combinedModels.length > 0) {
        const favs = combinedModels.filter(m => favIds.has(m.id));
        onSelectModel(favs[0] ?? combinedModels[0]);
      }
    }, [combinedModels, selectedModel, favIds]);
  
  const safeSessions = sessions.length > 0 ? sessions : [{ id: 'default', title: 'New Conversation', messages: [] }];
  const activeSession = safeSessions.find((s: any) => s.id === activeSessionId) || safeSessions[0];
  const messages = activeSession.messages;

  const setMessages = (updater: any) => {
    setSessions((prev: any) => prev.map((s: any) => {
      if (s.id !== activeSessionId) return s;
      const newMsgs = typeof updater === 'function' ? updater(s.messages) : updater;
      
      let autoTitle = s.title;
      if (s.title === 'New Conversation' && newMsgs.length > 0 && newMsgs[0].role === 'user') {
        autoTitle = newMsgs[0].text.split('\n')[0].substring(0, 30) + "...";
      }
      return { ...s, messages: newMsgs, title: autoTitle };
    }));
  };

  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const send = async () => {
    if (!input.trim() || thinking) return;
    const userText = input;
    setInput("");
    setMessages((m: any) => [...m, { role: "user", text: userText }]);
    setThinking(true);
    
    try {
      const activeModel = selectedModel;
              const res = await askAI(userText, activeModel, "You are a senior software architect and pair programmer.");
        if (res) {
          setMessages((m: any) => [...m, { role: "ai", text: res, modelId: activeModel.id }]);
        } else {
          setMessages((m: any) => [...m, { role: "ai", text: "Error: No response received.", modelId: activeModel.id }]);
        }
    } catch (e: any) {
      setMessages((m: any) => [...m, { role: "ai", text: `Error: ${e.message}`, modelId: selectedModel?.id || "unknown" }]);
    }
    setThinking(false);
  };

  const displayModels = [
    ...favModels,
    ...combinedModels.filter(m => !favIds.has(m.id))
  ];

  return (
    <div className="flex flex-col h-full bg-[#0d0e12] text-[#cccccc] font-sans w-full relative">
      {/* HEADER */}
      <div className="flex items-center justify-between px-5 h-12 shrink-0 border-b" style={{ borderColor: "rgba(212,175,55,0.1)", background: "rgba(212,175,55,0.02)" }}>
        <div className="flex items-center gap-2">
           <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
           <span className="text-[12px] font-bold tracking-widest text-[#D4AF37]">AI CHAT</span>
        </div>
      </div>

      {/* HEADER */}
        <div className="flex items-center justify-between px-5 h-12 shrink-0 border-b" style={{ borderColor: "rgba(212,175,55,0.1)", background: "rgba(212,175,55,0.02)" }}>
          <div className="flex items-center gap-2">
             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
             <span className="text-[12px] font-bold tracking-widest text-[#D4AF37]">AI CHAT</span>
          </div>
          <button onClick={onClose} className="text-[#6b6b80] hover:text-[#cccccc] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(212,175,55,0.1) transparent" }}
        onClick={() => setPickerOpen(false)}>
        
        {localGatewayMsg && (
          <div className="px-3 py-2 rounded text-[11px] border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37]">
            {localGatewayMsg}
          </div>
        )}

        {(!messages || messages.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center text-[#6b6b80]">
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1" opacity="0.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
             <p className="text-[13px]">How can I help you today?</p>
          </div>
        )}

        {(messages || []).map((msg: any, i: number) => {
          const mdl = combinedModels.find(m => m.id === msg.modelId);
          return (
            <div key={i} className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start w-full"}`}>
              {msg.role === "ai" && (
                <div className="flex items-center gap-2 px-1">
                  <div className="w-5 h-5 flex items-center justify-center rounded bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                  </div>
                  {mdl && <span className="text-[11px] font-semibold text-[#6b6b80] uppercase tracking-widest">{mdl.name}</span>}
                </div>
              )}
              <div className="text-[13px] leading-[1.6] break-words select-text"
                style={msg.role === "user" ? {
                  maxWidth: "85%", background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)",
                  color: "#e8e8f0", borderRadius: "10px", padding: "10px 14px"
                } : {
                  width: "100%", background: "transparent",
                  color: "#cccccc", padding: "4px 8px 4px 30px"
                }}>
                {msg.text}
              </div>
            </div>
          );
        })}
        {thinking && (
          <div className="flex flex-col gap-2 items-start w-full">
            <div className="flex items-center gap-2 px-1">
              <div className="w-5 h-5 flex items-center justify-center rounded bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              </div>
            </div>
            <div className="px-8 py-1 text-[12px] text-[#D4AF37]">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* INPUT AREA */}
      <div className="px-5 pb-5 shrink-0 bg-[#0d0e12]">
        <div className="flex flex-col bg-[#1a1c24] rounded-[8px] focus-within:border-[#D4AF37] transition-colors relative shadow-inner" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <textarea
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Ask anything..."
            className="w-full bg-transparent text-[13px] text-[#cccccc] px-4 pt-3 pb-2 outline-none resize-none placeholder:text-[#6b6b80]"
            style={{ overflowY: "auto", minHeight: "56px", scrollbarWidth: "none" }}
          />
          
          <div className="flex items-center justify-between px-3 pb-2 pt-1">
            {/* Model Picker in Toolbar */}
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-white/5 transition-colors text-[#9a9a9a] hover:text-[#D4AF37]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span className="text-[11px] font-medium">{selectedModel?.name || "Select Model"}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 15 12 9 18 15"></polyline>
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#6b6b80]">
                ~{Math.round((messages||[]).map((m: any) => m.text).join("").length / 4)} tkns
              </span>
              <button
                onClick={send}
                disabled={!input.trim() || thinking}
                className="p-1.5 rounded bg-[#D4AF37] text-black disabled:opacity-20 disabled:bg-[#3c3c3c] disabled:text-[#6b6b80] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
          </div>

          {pickerOpen && (
            <div className="absolute left-0 bottom-[calc(100%+8px)] z-50 rounded-lg overflow-hidden w-[280px]"
              style={{ background: "#1a1c24", border: "1px solid rgba(212,175,55,0.2)", boxShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
              <div className="overflow-y-auto py-1" style={{ maxHeight: 260 }}>
                {displayModels.map(m => (
                  <button key={m.id}
                    className={cn("w-full flex items-start gap-2.5 px-3 py-2 transition-colors text-left", selectedModel?.id === m.id ? "bg-[#D4AF37]/10" : "hover:bg-white/5")}
                    onClick={() => { onSelectModel(m); setPickerOpen(false); }}
                  >
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-medium text-[#c8c8d4]">{m.name}</span>
                      </div>
                      <div className="text-[11px] truncate text-[#6b6b80] mt-0.5">{m.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── File tree node ──────────────────────────────────────────────────────────

const FileTreeNode = React.memo(({ node, depth, activeFile, onFileClick, openDirs, onToggleDir, onContextMenu, gitStatus }: {
  node: FileNode; depth: number; activeFile: string;
  onFileClick: (n: string, p: string) => void; openDirs: Set<string>; onToggleDir: (n: string) => void;
  onContextMenu: (e: React.MouseEvent, n: FileNode) => void;
  gitStatus?: { isRepo: boolean; files: { file: string; status: string }[] };
}) => {
  const indent = depth * 12;
  
  let gitColor = "text-[#c8c8d4]";
  let gitBadge = null;
  
  if (gitStatus && gitStatus.isRepo && node.path) {
    // node.path is absolute, gitStatus files are relative. 
    // This is a naive inclusion check; in a real app, we'd make them relative to openedFolder.
    const normalizedNodePath = node.path.replace(/\\/g, '/');
    const statusObj = gitStatus.files.find(f => normalizedNodePath.endsWith(f.file));
    if (statusObj) {
      if (statusObj.status.includes('M')) { gitColor = "text-yellow-400"; gitBadge = <span className="text-[9px] text-yellow-400 font-bold ml-auto pr-1">M</span>; }
      else if (statusObj.status.includes('??') || statusObj.status.includes('A')) { gitColor = "text-green-400"; gitBadge = <span className="text-[9px] text-green-400 font-bold ml-auto pr-1">U</span>; }
    }
  }

  if (node.type === "file") {
    const isActive = activeFile === node.name;
    return (
      <div className={cn("flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer rounded-sm transition-all duration-200 hover:bg-white/5", isActive ? "bg-[#D4AF37]/10" : "", gitColor)}
        style={{ paddingLeft: indent + 20 }}
        onClick={() => onFileClick(node.name, node.path || "")}
        onContextMenu={(e) => onContextMenu(e, node)}>
        <FileIcon lang={node.lang} />
        <span className="text-[12px] truncate" >{node.name}</span>
        {gitBadge}
      </div>
    );
  }
  const isOpen = openDirs.has(node.name);
  return (
    <div>
      <div className="flex items-center gap-1 py-[3px] pr-2 cursor-pointer rounded-sm transition-all duration-200 hover:bg-white/5 text-[#c8c8d4] ml-1"
        style={{ paddingLeft: indent + 4 }}
        onClick={() => onToggleDir(node.name)}
        onContextMenu={(e) => onContextMenu(e, node)}>
        <ChevronIcon open={isOpen} />
        <FolderIcon open={isOpen} />
        <span className="text-[12px] ml-1" >{node.name}</span>
      </div>
      {isOpen && node.children.map(child => (
        <FileTreeNode key={child.name} node={child} depth={depth + 1}
          activeFile={activeFile} onFileClick={onFileClick} openDirs={openDirs} onToggleDir={onToggleDir} onContextMenu={onContextMenu} gitStatus={gitStatus} />
      ))}
    </div>
  );
});

// ─── Main App ─────────────────────────────────────────────────────────────────

const MENU_ITEMS = ["File", "Edit", "Selection", "View", "Go", "Run", "Terminal", "Help"];
type Panel = "explorer" | "search" | "git" | "chat" | "workspaces" | "models";


const IMHOTEP_KERNEL_CONSTITUTION = `# The Agent Kernel v3.2 (BoRooM / Askadosh Unified Master Constitution)

> **Kernel Axiom (Identity):** You are **كركر (BoRooM)**, the user's Pair Programmer, Senior Software Architect, and Zero-Trust Defensive Security Shield.
> **Startup Check:** Output: [Kernel: v3.2 | Active] before answering.

## 1. The Universal Engineering Rules
1. **Constructive Radical Candor & EXTREME BREVITY:** Max 2-3 lines of text per response unless writing code. Start directly with technical substance. No sycophancy.
2. **Proactive Diagnostic Leadership:** Surface technical debt and security risks.
3. **Stack-Appropriate Architecture:** Enforce separation of concerns (YAGNI).
4. **Zero-Trust Defensive Security:** Assume breach. Apply OWASP Top 10.
5. **Loop Engineering:** syntax -> lint -> test -> self-correct.
6. **Sacred Legacy Preservation (Chesterton's Fence):** Never overwrite working legacy logic without understanding it.
7. **Codewords:** الاسكدوش / الريفاكتور are speed shortcuts for direct execution.
8. **Anti-Slop & Quality Enforcement:** Actively reject lazy AI code patterns (e.g., any types, @ts-ignore). All code must pass strict validation.
9. **Surgical Code Editing:** Never rewrite entire files just to change a few lines. Use precise block replacements.
10. **Tools Mastery:** Actively use your available tools (File Reading, Writing, Commands) to execute changes directly in the workspace. Never simulate actions.
`;

// ─── AI Helper ──────────────────────────────────────────────────────────────────
async function askAI(prompt: string, model: any, systemPrompt: string = IMHOTEP_KERNEL_CONSTITUTION) {
  if (!model) throw new Error("No model selected.");
  
  if (model.provider.includes("Ollama")) {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model.id,
        system: systemPrompt,
        prompt: prompt,
        stream: false,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.response;
    } else {
      throw new Error(`Ollama Error: ${res.status}`);
    }
  } else if (model.provider.includes("LM Studio")) {
    const res = await fetch("http://localhost:1234/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model.id,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        stream: false,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices[0].message.content;
    } else {
      throw new Error(`LM Studio Error: ${res.status}`);
    }
  } else {
    // Default to OpenRouter
    const orKey = localStorage.getItem('imhotep_or_key');
    if (orKey && orKey.trim().length > 0) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${orKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "Imhotep OS"
        },
        body: JSON.stringify({
          model: model.id || "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ]
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices[0].message.content;
      } else {
        const err = await res.text();
        throw new Error(`OpenRouter Error ${res.status}: ${err}`);
      }
    } else {
      throw new Error("No OpenRouter API key found. Please enter it in the Model Details page.");
    }
  }
}

declare global { interface Window { imhotep: any; monaco: any; } }


import { EditorSettings } from "./components/SettingsPanel";

const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
  tabSize: 2,
  wordWrap: "off",
  minimap: true,
  lineNumbers: "on",
  stickyScroll: true,
  bracketPairColorization: true,
  renderWhitespace: "none",
  cursorBlinking: "blink",
  formatOnSave: true,
  autoSave: false
};

export default function App() {

  // Check if running natively inside Electron
  const isNativeDesktop = typeof window !== "undefined" && "electronAPI" in window;

  // Login flow states
  const [recentProjects, setRecentProjects] = useState<{name: string, path: string, lastOpened: number}[]>(() => { try { return JSON.parse(localStorage.getItem('imhotep_recent_projects') || '[]'); } catch { return []; } });

  (window as any).__imhotep_recent_projects = recentProjects;

    const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('imhotep_google_auth') === 'true');
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      setIsLoggingIn(true);
      try {
        const user = await electronAPI.googleLogin();
        if (user) {
          localStorage.setItem('imhotep_google_auth', 'true');
          setIsLoggedIn(true);
          showAppModal(`Welcome, ${user.name}! Authenticated successfully via ${user.email}.`, "info");
        }
      } catch (e: any) {
        showAppModal("Google Sign-In failed: " + e.message, "error");
      } finally {
        setIsLoggingIn(false);
      }
    }
  };

  // Custom premium modal notification state
  const [modalNotification, setModalNotification] = useState<{ message: string; type: "info" | "error" } | null>(null);

  // Workspace / Filesystem states
  const [openedFolder, setOpenedFolder] = useState<string | null>(null);

    const [sessions, setSessions] = useState<any[]>([{ id: 'default', title: 'New Conversation', messages: [] }]);
    const [activeSessionId, setActiveSessionId] = useState('default');
    const [showChatPanel, setShowChatPanel] = useState(false);
    const isLoadingHistory = useRef(false);
    
    useEffect(() => {
      if (!openedFolder || isLoadingHistory.current) return;
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.saveChatHistory) {
        electronAPI.saveChatHistory(openedFolder, { sessions, activeSessionId }).catch(console.error);
      }
    }, [sessions, activeSessionId, openedFolder]);
  const [asyncDialog, setAsyncDialog] = useState<any>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
    const [isTreeLoading, setIsTreeLoading] = useState(false);
  type TabState = { name: string, path: string, content: string, originalContent: string, isModified: boolean };
  const [tabsState, setTabsState] = useState<Record<string, TabState>>({});
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("");

  const activeTabState = tabsState[activeTab];
  const activeFilePath = activeTabState?.path || null;
  const activeFileName = activeTabState?.name || null;
  const fileContent = activeTabState?.content ?? null;
  const isModified = activeTabState?.isModified || false;

  const updateActiveTabContent = (val: string) => {
    setTabsState(prev => {
      if (!activeTab || !prev[activeTab]) return prev;
      return {
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          content: val,
          isModified: val !== prev[activeTab].originalContent
        }
      };
    });
  };

  const editorChangeTimeout = useRef<any>(null);
  const handleEditorChange = useCallback((val: string) => {
    const currentTab = activeTab;
    if (editorChangeTimeout.current) clearTimeout(editorChangeTimeout.current);
    editorChangeTimeout.current = setTimeout(() => {
      setTabsState(prev => {
        if (!currentTab || !prev[currentTab]) return prev;
        return {
          ...prev,
          [currentTab]: {
            ...prev[currentTab],
            content: val,
            isModified: val !== prev[currentTab].originalContent
          }
        };
      });
    }, 200);
  }, [activeTab]);

  // Search Engine states
  const [searchQuery, setSearchQuery] = useState("");
  const [osAgentMode, setOsAgentMode] = useState(false);
  const [replaceQuery, setReplaceQuery] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    fileName: string; filePath: string; lineNumber: number; lineContent: string;
  }[]>([]);

  // Git Source Control states
  const [gitStatus, setGitStatus] = useState<{ isRepo: boolean; files: { file: string; status: string }[]; branch: string }>({ isRepo: false, files: [], branch: '' });
  const [commitMessage, setCommitMessage] = useState("");
  const [currentBranch, setCurrentBranch] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [gitLog, setGitLog] = useState<{ hash: string; subject: string; author: string; time: string }[]>([]);
  const [gitLoading, setGitLoading] = useState<string | null>(null); // 'push'|'pull'|'fetch'|null
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [gitTab, setGitTab] = useState<'changes'|'log'>('changes');
  const [diffMode, setDiffMode] = useState(false); // Diff editor mode

  // Extensions / Utilities configuration states
  // Local AI Model dynamically loaded
  const [localModels, setLocalModels] = useState<AIModel[]>([]);
  const [localGatewayMsg, setLocalGatewayMsg] = useState<string | null>(null);

  
  const [activePanel, setActivePanel] = useState<Panel>("explorer");

  const [sidebarOpen, setSidebarOpen] = useState(true);
    
    useEffect(() => {
      if (openedFolder) {
        const electronAPI = (window as any).electronAPI;
        if (electronAPI?.loadChatHistory) {
          isLoadingHistory.current = true;
          electronAPI.loadChatHistory(openedFolder).then((data: any) => {
            if (data && data.sessions) {
              setSessions(data.sessions);
              if (data.activeSessionId) setActiveSessionId(data.activeSessionId);
            } else {
              setSessions([{ id: 'default', title: 'New Conversation', messages: [] }]);
              setActiveSessionId('default');
            }
          }).catch(console.error).finally(() => { isLoadingHistory.current = false; });
        }
      }
    }, [openedFolder]);

  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [favIds, setFavIds] = useState<Set<string>>(DEFAULT_FAVORITES);
  const combinedModelsApp = [...localModels, ...STATIC_MODELS];
  const defaultModelApp = combinedModelsApp.find(m => favIds.has(m.id)) ?? combinedModelsApp[0];
  const [globalActiveModel, setGlobalActiveModel] = useState<AIModel | null>(null);
  const selectedModel = globalActiveModel || defaultModelApp;


  // Sidebar Resize State
  const [sidebarBaseWidth, setSidebarBaseWidth] = useState(240);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);

  // Terminal State
  const [terminalOpen, setTerminalOpen] = useState(false);
  // AI Plugin Forge State
  const [plugins, setPlugins] = useState<any[]>([]);
  const [pluginPrompt, setPluginPrompt] = useState("");
  const [pluginCommands, setPluginCommands] = useState<Command[]>([]);
  const [isGeneratingPlugin, setIsGeneratingPlugin] = useState(false);
  const [showRunStudio, setShowRunStudio] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [deviceMode, setDeviceMode] = useState<'iphone' | 'ipad' | 'desktop'>('iphone');
  const [runUrl, setRunUrl] = useState("http://127.0.0.1:8441");
  const [simulatorUrl, setSimulatorUrl] = useState("http://127.0.0.1:8441");
  const [urlInput, setUrlInput] = useState("http://127.0.0.1:8441");

  const latestSaveFile = useRef<any>(null);
  const latestNewFile = useRef<any>(null);
  const latestCloseActiveTab = useRef<any>(null);
  const latestSaveAsFile = useRef<any>(null);


  const [openRouterKey, setOpenRouterKey] = useState<string>(() => localStorage.getItem('imhotep_or_key') || "");
  const handleSetOpenRouterKey = (k: string) => {
    setOpenRouterKey(k);
    localStorage.setItem('imhotep_or_key', k);
  };

  const [googleKey, setGoogleKey] = useState<string>(() => localStorage.getItem('imhotep_google_api_key') || "");
  const handleSetGoogleKey = (k: string) => {
    setGoogleKey(k);
    localStorage.setItem('imhotep_google_api_key', k);
  };

  // ─── VS CODE PARITY STATES ────────────────────────────────────────────────────
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [zenMode, setZenMode] = useState(false);
  const [splitMode, setSplitMode] = useState<null | 'vertical'>(null);
  const [secondaryActiveTab, setSecondaryActiveTab] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [inlinePromptOpen, setInlinePromptOpen] = useState(false);
  const [inlinePromptText, setInlinePromptText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => {
    const saved = localStorage.getItem('imhotep_editor_settings');
    return saved ? { ...DEFAULT_EDITOR_SETTINGS, ...JSON.parse(saved) } : DEFAULT_EDITOR_SETTINGS;
  });
  const [problems, setProblems] = useState<Problem[]>([]);
  const [notifications, setNotifications] = useState<{ id: string; message: string; type: 'info' | 'success' | 'error' | 'warning'; ts: number }[]>([]);
  const [recentFiles, setRecentFiles] = useState<{ name: string; path: string }[]>(() => {
    const saved = localStorage.getItem('imhotep_recent_files');
    return saved ? JSON.parse(saved) : [];
  });
  const [pinnedTabs, setPinnedTabs] = useState<Set<string>>(new Set());
  const [activeBottomPanel, setActiveBottomPanel] = useState<'terminal' | 'problems' | 'output' | 'outline'>('terminal');

  // Persist editor settings
  useEffect(() => {
    localStorage.setItem('imhotep_editor_settings', JSON.stringify(editorSettings));
  }, [editorSettings]);

  const updateEditorSetting = useCallback(<K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
    setEditorSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // Toast notification helper
  const showToast = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type, ts: Date.now() }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);

  // Monaco editor triggers via editorRef
  const triggerEditorAction = useCallback((actionId: string) => {
    editorRef.current?.trigger('keyboard', actionId, {});
    editorRef.current?.focus();
  }, []);


  
    const handleSimulator = useCallback(async () => {
    let port = 8441;
    if (!showSimulator) {
      if (openedFolder) {
        port = await (window as any).electronAPI?.serveFolder?.(openedFolder) || 8441;
      }
    }
    const newUrl = `http://127.0.0.1:${port}?autorun=true&simulator=true&t=${Date.now()}`;
    setSimulatorUrl(newUrl);
    setShowSimulator(true);
  }, [showSimulator, openedFolder]);

  useEffect(() => {
    const cleanup = (window as any).electronAPI?.onTriggerSimulator?.(() => {
      handleSimulator();
    });
    return cleanup;
  }, [handleSimulator]);


  const handleRunProject = async () => {
    // Save all files first
    await handleSaveAll();

    let port = 8441;
    if (!showRunStudio) {
      if (openedFolder) {
        port = await (window as any).electronAPI?.serveFolder?.(openedFolder) || 8441;
      } else if (activeTab && tabsState[activeTab]?.path) {
        const activePath = tabsState[activeTab].path;
        const dirPath = activePath.includes('\\') ? activePath.substring(0, activePath.lastIndexOf('\\')) : activePath.substring(0, activePath.lastIndexOf('/'));
        port = await (window as any).electronAPI?.serveFolder?.(dirPath) || 8441;
      }
    } else {
      // If already shown, we still need the current port if we are restarting it,
      // but let's just re-issue serveFolder to get the port
      if (openedFolder) {
        port = await (window as any).electronAPI?.serveFolder?.(openedFolder) || 8441;
      } else if (activeTab && tabsState[activeTab]?.path) {
        const activePath = tabsState[activeTab].path;
        const dirPath = activePath.includes('\\') ? activePath.substring(0, activePath.lastIndexOf('\\')) : activePath.substring(0, activePath.lastIndexOf('/'));
        port = await (window as any).electronAPI?.serveFolder?.(dirPath) || 8441;
      }
    }
    const newUrl = `http://127.0.0.1:${port}?t=${Date.now()}`;
    setRunUrl(newUrl);
    setUrlInput(`http://127.0.0.1:${port}`);
    setShowRunStudio(true);
  };

  const handleCloseTab = async (tabToClose: string) => {
    if (!tabToClose) return;
    if (tabsState[tabToClose]?.isModified) {
      const ok = await showConfirm(`You have unsaved changes in ${tabToClose}. Close anyway?`);
      if (!ok) {
        return;
      }
    }
    setTabsState(prev => {
      const next = { ...prev };
      delete next[tabToClose];
      return next;
    });
    setOpenTabs(prev => {
      const filtered = prev.filter(t => t !== tabToClose);
      if (activeTab === tabToClose) {
        const idx = prev.indexOf(tabToClose);
        const nextIdx = idx === prev.length - 1 ? idx - 1 : idx + 1;
        setActiveTab(filtered.length > 0 ? prev[nextIdx] || filtered[filtered.length - 1] : "");
      }
      return filtered;
    });
  };

  const handleGlobalKeyDownRef = useRef<((e: KeyboardEvent) => void) | null>(null);
  handleGlobalKeyDownRef.current = (e: KeyboardEvent) => {

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;
      const k = e.key.toLowerCase();

      // ── ESCAPE (no modifiers) ─────────────────────────────────
      if (e.key === 'Escape') { setCommandPaletteOpen(false); setSettingsOpen(false); setShowBranchMenu(false); return; }

      // ── FUNCTION KEYS ─────────────────────────────────────────
      if (e.key === 'F11') { e.preventDefault(); setZenMode(z => !z); return; }
      if (e.key === 'F5') { e.preventDefault(); handleRunProject(); return; }

      // ── Ctrl+Shift+Alt combos (most specific first) ───────────
      if (ctrl && alt && (k === 'i' || e.code === 'KeyI')) {
        e.preventDefault();
        setActivePanel(prev => {
          if (prev === "chat" && sidebarOpen) { setSidebarOpen(false); return prev; }
          setSidebarOpen(true); return "chat";
        });
        return;
      }

      // ── Ctrl+Shift combos ─────────────────────────────────────
      if (ctrl && shift && (k === 'p' || e.code === 'KeyP')) { e.preventDefault(); setCommandPaletteOpen(true); return; }
      if (ctrl && shift && (k === 's' || e.code === 'KeyS')) { e.preventDefault(); handleSaveAsFile(); return; }
      if (ctrl && shift && k === 'e') { e.preventDefault(); setActivePanel('explorer'); setSidebarOpen(true); return; }
      if (ctrl && shift && (k === 'f' || e.code === 'KeyF')) { e.preventDefault(); setActivePanel('search'); setSidebarOpen(true); return; }
      if (ctrl && shift && (k === 'g' || e.code === 'KeyG')) { e.preventDefault(); setActivePanel('git'); setSidebarOpen(true); return; }

      // ── Shift+Alt combos ──────────────────────────────────────
      if (shift && alt && (k === 'f' || e.code === 'KeyF')) { e.preventDefault(); triggerEditorAction('editor.action.formatDocument'); return; }

      // ── Ctrl-only combos (explicitly exclude shift/alt) ───────
      if (ctrl && !shift && !alt && (k === 'p' || e.code === 'KeyP')) { e.preventDefault(); setCommandPaletteOpen(true); return; }
      if (ctrl && !shift && !alt && (k === 'i' || e.code === 'KeyI')) { e.preventDefault(); setInlinePromptOpen(o => !o); return; }
      if (ctrl && !shift && !alt && (k === 'w' || e.code === 'KeyW')) { e.preventDefault(); handleCloseTab(activeTab); return; }
      if (ctrl && !shift && !alt && (k === 'b' || e.code === 'KeyB')) { e.preventDefault(); setSidebarOpen(prev => !prev); return; }
      if (ctrl && !shift && !alt && (k === 'o' || e.code === 'KeyO')) { e.preventDefault(); handleOpenFolder(); return; }
      if (ctrl && !shift && !alt && (k === 'n' || e.code === 'KeyN')) { e.preventDefault(); handleNewFile(); return; }
      if (ctrl && !shift && !alt && (k === 's' || e.code === 'KeyS')) {
        e.preventDefault();
        if (editorSettings.formatOnSave) triggerEditorAction('editor.action.formatDocument');
        handleSaveFile();
        return;
      }
      if (ctrl && !shift && !alt && (k === 'h' || e.code === 'KeyH')) { e.preventDefault(); triggerEditorAction('editor.action.startFindReplaceAction'); return; }
      if (ctrl && !shift && !alt && (k === 'f' || e.code === 'KeyF')) { e.preventDefault(); triggerEditorAction('actions.find'); return; }
      if (ctrl && !shift && !alt && (k === 'g' || e.code === 'KeyG')) { e.preventDefault(); triggerEditorAction('editor.action.gotoLine'); return; }
      if (ctrl && e.key === '/') { e.preventDefault(); triggerEditorAction('editor.action.commentLine'); return; }
      if (ctrl && e.key === '\\') { e.preventDefault(); setSplitMode(s => s ? null : 'vertical'); return; }
      if (ctrl && (e.key === '`' || e.code === 'Backquote')) { e.preventDefault(); setTerminalOpen(prev => !prev); return; }
      if (ctrl && !shift && !alt && (k === 'j' || e.code === 'KeyJ')) { e.preventDefault(); setTerminalOpen(prev => !prev); return; }
      if (ctrl && e.key === ',') { e.preventDefault(); setSettingsOpen(true); return; }

      // ── Ctrl+Tab / Ctrl+Shift+Tab ─────────────────────────────
      if (ctrl && k === 'tab') {
        e.preventDefault();
        if (openTabs.length > 1) {
          const idx = openTabs.indexOf(activeTab);
          if (shift) {
            setActiveTab(openTabs[(idx - 1 + openTabs.length) % openTabs.length]);
          } else {
            setActiveTab(openTabs[(idx + 1) % openTabs.length]);
          }
        }
        return;
      }
    };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleGlobalKeyDownRef.current?.(e);
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  useEffect(() => {
    if (!isDraggingSidebar) return;
    const handleMouseMove = (e: MouseEvent) => {
      // Activity Bar width is ~48px
      const newWidth = Math.max(160, Math.min(e.clientX - 48, 800));
      setSidebarBaseWidth(newWidth);
    };
    const handleMouseUp = () => setIsDraggingSidebar(false);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingSidebar]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: FileNode } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null);
    window.addEventListener("click", closeContextMenu);
    return () => window.removeEventListener("click", closeContextMenu);
  }, []);

  const refreshWorkspace = async (folderPath: string) => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && folderPath) {
      const tree = await electronAPI.readDir(folderPath);
      setFileTree(tree);
      refreshGitStatus(folderPath);
    }
  };

  const handleFileAction = async (action: string, node: FileNode) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !openedFolder) return;

    try {
      if (action === 'delete') {
        const ok = await showConfirm(`Are you sure you want to delete ${node.name}?`);
        if (ok) {
          await electronAPI.deletePath(node.path);
          if (tabsState[node.path || node.name]) closeTab(node.path || node.name, { stopPropagation: () => {} } as any);
          refreshWorkspace(openedFolder);
        }
      } else if (action === 'rename') {
        const newName = await showPrompt(`Rename ${node.name} to:`, node.name);
        if (newName && newName !== node.name) {
          const lastSlashIndex = Math.max(node.path.lastIndexOf('\\'), node.path.lastIndexOf('/'));
          const safeNewPath = node.path.substring(0, lastSlashIndex + 1) + newName;
          await electronAPI.renamePath(node.path, safeNewPath);
          refreshWorkspace(openedFolder);
        }
      } else if (action === 'create-file') {
        const name = await showPrompt('New File Name:');
        if (name) {
          const lastSlash = Math.max(node.path.lastIndexOf('\\'), node.path.lastIndexOf('/'));
            const targetDir = node.type === 'dir' ? node.path : node.path.substring(0, lastSlash);
            await electronAPI.createFile(targetDir + '/' + name);
          refreshWorkspace(openedFolder);
        }
      } else if (action === 'create-dir') {
        const name = await showPrompt('New Folder Name:');
        if (name) {
          const lastSlash = Math.max(node.path.lastIndexOf('\\'), node.path.lastIndexOf('/'));
            const targetDir = node.type === 'dir' ? node.path : node.path.substring(0, lastSlash);
            await electronAPI.createDir(targetDir + '/' + name);
          refreshWorkspace(openedFolder);
        }
      }
    } catch (e: any) {
      showAppModal(e.message, "error");
    }
  };

  // Show custom desktop modal box instead of web alert
  const showAppModal = (message: string, type: "info" | "error" = "info") => {
    setModalNotification({ message, type });
  };

  const showConfirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setAsyncDialog({
        type: 'confirm',
        message,
        onConfirm: () => { setAsyncDialog(null); resolve(true); },
        onCancel: () => { setAsyncDialog(null); resolve(false); }
      });
    });
  };

  const showPrompt = (message: string, defaultValue?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setAsyncDialog({
        type: 'prompt',
        message,
        defaultValue: defaultValue || '',
        onConfirm: (val: string) => { setAsyncDialog(null); resolve(val); },
        onCancel: () => { setAsyncDialog(null); resolve(null); }
      });
    });
  };

  const openRouterCache = useRef<AIModel[]>([]);
  // Poll Local AI Gateway
  useEffect(() => {
    if (!isNativeDesktop) return;
    const fetchLocalModels = async () => {
      let modelsFound: AIModel[] = [{
        id: "imhotep-auto-orchestrator",
        name: "✨ Auto (Imhotep Orchestrator)",
        provider: "Internal System",
        color: "#ff3366",
        tier: "orchestrator",
        tags: ["auto", "smart", "agentic"],
        context: "Infinite",
        desc: "Automatically routes your request to the best specialized model (Vision, Code, Fast, etc.).",
        strengths: ["Task Routing", "Cost Optimization", "Multi-modal AI"],
        usedFor: "Let Imhotep OS decide the best model",
        badge: "AUTO", type: "cloud" as const
      }];

      // 1. Try Ollama
      try {
        const res = await fetch("http://localhost:11434/api/tags");
        if (res.ok) {
          const data = await res.json();
          const oModels = data.models.map((m: any) => {
            const sizeGB = m.size ? (m.size / (1024**3)).toFixed(1) + " GB" : "N/A";
            const params = m.details?.parameter_size || "Unknown";
            const ramReq = m.size ? Math.ceil(m.size / (1024**3)) + 1 : 4; // roughly size + 1GB overhead
            return {
              id: m.name,
              name: m.name,
              provider: "Ollama (Local)",
              color: "#D4AF37",
              tier: "specialized",
              tags: ["local", "code"],
              context: "Variable",
              desc: `Local Ollama model: ${m.name}. Architecture: ${m.details?.family || 'unknown'}`,
              strengths: ["100% Offline", "Runs on local GPU/CPU", "Private"],
              usedFor: "Offline development & assistance",
              badge: "LOCAL",
              type: "local",
              size: sizeGB,
              params: params,
              ramRequired: ramReq
            };
          });
          modelsFound = [...modelsFound, ...oModels];
        }
      } catch (e) {
        // offline
      }

      // 2. Try LM Studio
      try {
        const res = await fetch("http://localhost:1234/v1/models");
        if (res.ok) {
          const data = await res.json();
          const lmModels = data.data.map((m: any) => ({
            id: m.id,
            name: m.id.split('/').pop() || m.id,
            provider: "LM Studio (Local)",
            color: "#e67e22",
            tier: "flagship",
            tags: ["local", "balanced"],
            context: "Variable",
            desc: `Local LM Studio model: ${m.id}`,
            strengths: ["100% Offline", "Local GPU accelerated", "Private"],
            usedFor: "Offline coding & reasoning",
            badge: "LOCAL",
          }));
          modelsFound = [...modelsFound, ...lmModels];
        }
      } catch (e) {
        // offline
      }

      // 3. Try OpenRouter Unified Gateway (always fetch, no key required for model list)
      if (openRouterCache.current.length > 0) {
        modelsFound = [...modelsFound, ...openRouterCache.current];
      } else {
        try {
          const res = await fetch("https://openrouter.ai/api/v1/models");
          if (res.ok) {
            const data = await res.json();
            const orModels = data.data.map((m: any) => {
              const name = m.name || m.id;
              const isVision = name.toLowerCase().includes("vision");
              const isFree = m.pricing?.prompt === "0";
              return {
                id: m.id,
                name: name,
                provider: "OpenRouter (Gateway)",
                color: isFree ? "#27c93f" : "#9b59b6",
                tier: isFree ? "standard" : "flagship",
                tags: ["cloud", isVision ? "vision" : "balanced"],
                context: m.context_length ? `${Math.round(m.context_length/1000)}k` : "Variable",
                desc: m.description || `Cloud model fetched from OpenRouter: ${m.id}`,
                strengths: ["Cloud Scale", isVision ? "Vision Enabled" : "Reasoning", isFree ? "Free" : "Premium"],
                usedFor: "General programming and assistance",
                badge: "CLOUD",
                type: "cloud",
              };
            });
            // Just take the top 150 to avoid freezing the UI
            openRouterCache.current = orModels.slice(0, 150);
            modelsFound = [...modelsFound, ...openRouterCache.current];
          }
        } catch (e) {
          // offline or error
        }
      }

      if (modelsFound.length > 0) {
        setLocalModels(modelsFound);
        setLocalGatewayMsg(null);
      } else {
        setLocalGatewayMsg("Offline Gateway Mode (Ollama Port 11434 / LM Studio Port 1234 are offline). Running mock chat.");
      }
    };

    fetchLocalModels();
      (window as any).imhotepScanLocal = fetchLocalModels;
      const interval = setInterval(fetchLocalModels, 10000);
    return () => clearInterval(interval);
  }, [isNativeDesktop]);

  
  // Plugin System Init
  useEffect(() => {
    if (isNativeDesktop && (window as any).electronAPI?.pluginLoadAll) {
      (window as any).electronAPI.pluginLoadAll().then(plugs => {
        setPlugins(plugs);
        let dynamicCommands: Command[] = [];
        
        (window as any).imhotep = {
          commands: {
            registerCommand: (id: string, name: string, callback: () => void) => {
              dynamicCommands.push({
                id,
                label: name,
                category: "Imhotep Extensions",
                action: callback
              });
            }
          },
          editor: {
            getActiveText: () => {
              // Hacky way to get current text if editorRef is not strictly bound here
              const el = document.querySelector('.monaco-editor');
              if (el) return (window as any).monaco?.editor?.getModels()[0]?.getValue() || "";
              return "";
            },
            replaceText: (text: string) => {
              const model = (window as any).monaco?.editor?.getModels()[0];
              if (model) {
                model.setValue(text);
              }
            }
          },
          window: {
            showToast
          },
          ai: {
            ask: askAI
          }
        };

        // Execute plugins
        for (const p of plugs) {
          try {
            const sandboxKeys = ['imhotep', 'window', 'document', 'localStorage', 'sessionStorage', 'fetch', 'electronAPI'];
            const sandboxValues = [(window as any).imhotep, undefined, undefined, undefined, undefined, undefined, undefined];
            const run = new Function(...sandboxKeys, `"use strict";\n${p.code}`);
            run(...sandboxValues);
          } catch (e) {
            console.error("Plugin error:", p.name, e);
          }
        }
        
        setPluginCommands(dynamicCommands);
      });
    }
  }, [isNativeDesktop]);

  // Authenticate user
  const handleLogin = () => {
    if (!loginUser.trim() || !loginPass.trim()) {
      setLoginError("Please enter both username and password.");
      return;
    }
    localStorage.setItem('imhotep_google_auth', 'true');
    setIsLoggedIn(true);
    setLoginError("");
  };

  // ─── BACKGROUND TS WATCHER (PROJECT-WIDE PROBLEMS) ──────────────────────────
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !electronAPI.startTsWatcher) return;
    
    if (openedFolder) {
      electronAPI.startTsWatcher(openedFolder);
      const cleanup = electronAPI.onTsProblems((newProblems: Problem[]) => {
        setProblems(prev => {
          const local = prev.filter(p => !p.fullPath);
          return [...local, ...newProblems];
        });
      });
      return () => {
        electronAPI.stopTsWatcher();
        cleanup();
      };
    } else {
      electronAPI.stopTsWatcher();
    }
  }, [openedFolder]);

  // ─── LIVE FILE WATCHER (CHOKIDAR) ───────────────────────────────────────────────
  useEffect(() => {
    if (!openedFolder) return;

    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !electronAPI.watchFolder || !electronAPI.onFileSystemChange) return;

    // Tell backend to start watching this folder
    electronAPI.watchFolder(openedFolder);

    let debounceTimer: ReturnType<typeof setTimeout>;

    const handleFsChange = () => {
      // Debounce tree reload to avoid thrashing on mass changes (e.g. npm install)
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const tree = await electronAPI.readDir(openedFolder);
          setFileTree(tree);
          refreshGitStatus(openedFolder);
        } catch (e) {
          console.error("Failed to reload tree on fs-change", e);
        }
      }, 300);
    };

    const cleanup = electronAPI.onFileSystemChange(handleFsChange);

    return () => {
      clearTimeout(debounceTimer);
      if (cleanup) cleanup();
    };
  }, [openedFolder]);

  // Open directory via Electron Dialog
  const handleNewFile = () => {
    const fileName = `Untitled-${Math.floor(Math.random() * 1000)}.txt`;
    setTabsState(prev => ({ ...prev, [fileName]: { content: '', isModified: false, originalContent: '' } }));
    setOpenTabs(prev => [...prev, fileName]);
    setActiveTab(fileName);
  };

  const handleOpenFileMenu = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.selectFile) {
      const filePath = await electronAPI.selectFile();
      if (filePath) {
        const fileContent = await electronAPI.readFile(filePath);
        const fileName = filePath.split(/[\\/]/).pop() || 'Unknown';
        const tabKey = filePath;
        setTabsState(prev => ({ ...prev, [tabKey]: { name: fileName, content: fileContent, isModified: false, path: filePath, originalContent: fileContent } }));
        if (!openTabs.includes(tabKey)) setOpenTabs(prev => [...prev, tabKey]);
        setActiveTab(tabKey);
      }
    }
  };

  const handleOpenFolder = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      const folderPath = await electronAPI.selectFolder();
      if (folderPath) {
        handleOpenSpecificFolder(folderPath);
      }
    }
  };

  const handleOpenSpecificFolder = async (folderPath: string) => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
        setOpenedFolder(folderPath);
        setIsTreeLoading(true);
        const tree = await electronAPI.readDir(folderPath);
        setFileTree(tree);
        setIsTreeLoading(false);
        const folderName = folderPath.split(/[\\/]/).pop() || "workspace";
        setOpenDirs(new Set([folderName]));
        refreshGitStatus(folderPath);
    }
  };

  // Open a file and read its contents from disk
  const handleOpenFile = async (name: string, pathStr: string, line?: number) => {
    const tabKey = pathStr || name;
    if (!openTabs.includes(tabKey)) {
      setOpenTabs(prev => [...prev, tabKey]);
    }
    setActiveTab(tabKey);

    setTimeout(() => {
      if (line && editorRef.current) {
        editorRef.current.revealLineInCenter(line);
        editorRef.current.setPosition({ lineNumber: line, column: 1 });
        editorRef.current.focus();
      }
    }, 150);

    if (tabsState[tabKey]) return; // Already in memory

    const electronAPI = (window as any).electronAPI;
    if (electronAPI && pathStr) {
      try {
        const content = await electronAPI.readFile(pathStr);
        setTabsState(prev => ({
          ...prev,
          [tabKey]: { name, path: pathStr, content, originalContent: content, isModified: false }
        }));
      } catch (err) {
        console.error("Failed to read file", err);
        showToast("Error reading file", "error");
      }
    }
  };

  // Save file content back to disk
  
  const handleSaveAsFile = async () => {
    if (fileContent === null || !activeTab) return;
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.saveFileDialog) {
      const savePath = await electronAPI.saveFileDialog();
      if (savePath) {
        await electronAPI.writeFile(savePath, fileContent);
        const tabKey = savePath;
        
        // Remove the Untitled tab if we are saving it
        if (activeTab.startsWith("Untitled-")) {
          setTabsState(prev => {
            const newState = { ...prev };
            delete newState[activeTab];
            return newState;
          });
          setOpenTabs(prev => prev.filter(t => t !== activeTab));
        }
        
        setTabsState(prev => ({
          ...prev,
          [tabKey]: { content: fileContent, isModified: false, path: savePath, originalContent: fileContent }
        }));
        setOpenTabs(prev => prev.includes(tabKey) ? prev : [...prev, tabKey]);
        setActiveTab(tabKey);
        refreshGitStatus(openedFolder);
        showToast("File saved successfully!", "success");
      }
    }
  };

  useEffect(() => {
    latestSaveFile.current = handleSaveFile;
    latestNewFile.current = handleNewFile;
    latestCloseActiveTab.current = () => handleCloseTab(activeTab);
    latestSaveAsFile.current = handleSaveAsFile;
  });

  const handleSaveAll = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;
    let savedCount = 0;
    let skippedUntitled = 0;
    for (const tab of openTabs) {
      const state = tabsState[tab];
      if (state && state.isModified) {
        if (tab.startsWith("Untitled-") && !state.path) {
          skippedUntitled++;
          continue;
        }
        const filePath = state.path || (openedFolder ? `${openedFolder}/${tab}` : null);
        if (filePath) {
          await electronAPI.writeFile(filePath, state.content || '');
          setTabsState(prev => ({
            ...prev,
            [tab]: { ...prev[tab], originalContent: state.content, isModified: false }
          }));
          savedCount++;
        }
      }
    }
    if (savedCount > 0 || skippedUntitled > 0) {
      refreshGitStatus(openedFolder);
      const skipMsg = skippedUntitled > 0 ? ` (${skippedUntitled} untitled file(s) skipped. Use Save As.)` : "";
      showAppModal(`Saved ${savedCount} file(s) successfully!${skipMsg}`, "info");
    }
  };

  // Auto-Save background loop
  useEffect(() => {
    if (!editorSettings.autoSave) return;
    const interval = setInterval(() => {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI) return;
      openTabs.forEach(async (tab) => {
        const state = tabsState[tab];
        if (state && state.isModified && !tab.startsWith("Untitled-") && state.path) {
          try {
            await electronAPI.writeFile(state.path, state.content || '');
            setTabsState(prev => ({
              ...prev,
              [tab]: { ...prev[tab], originalContent: state.content, isModified: false }
            }));
          } catch (e) {
            console.error("Auto-save failed for", tab, e);
          }
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [editorSettings.autoSave, openTabs, tabsState]);

  const handleSaveFile = async () => {
    if (!activeTab || fileContent === null) return;
    if (activeTab.startsWith("Untitled-") || !activeFilePath) {
      return handleSaveAsFile();
    }
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      try {
        await electronAPI.writeFile(activeFilePath, fileContent);
        setTabsState(prev => ({
          ...prev,
          [activeTab]: { ...prev[activeTab], originalContent: fileContent, isModified: false }
        }));
        refreshGitStatus(openedFolder);
        showAppModal("File saved successfully!", "info");
      } catch (e: any) {
        showAppModal("Failed to save file: " + e.message, "error");
      }
    }
  };

  // Keyboard shortcuts listener (Cleaned up, logic moved to unified handleGlobalKeyDown)

  // Search Engine function
  const executeSearch = async () => {
    if (!openedFolder || !searchQuery.trim()) return;
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      const results = await electronAPI.searchFiles(openedFolder, searchQuery);
      setSearchResults(results);
    }
  };

  const executeReplaceAll = async () => {
    if (!openedFolder || !searchQuery.trim()) return;
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && searchResults.length > 0) {
      const uniqueFiles = Array.from(new Set(searchResults.map(r => r.filePath)));
      const replacements = uniqueFiles.map(path => ({ path, search: searchQuery, replace: replaceQuery }));
      const count = await electronAPI.replaceInFiles(replacements);
      showToast(`Replaced in ${count} file(s)`, "success");
      
      // Close tabs that were modified so they can be reloaded cleanly, or just let them reload
      // A quick hack is to re-execute search to verify replacements
      setTimeout(executeSearch, 500);
    }
  };

  // Git status operations
  const refreshGitStatus = async (folder = openedFolder) => {
    if (!folder) return;
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      const status = await electronAPI.getGitStatus(folder);
      setGitStatus(status);
      if (status.branch) setCurrentBranch(status.branch);
    }
  };

  const refreshGitLog = async (folder = openedFolder) => {
    if (!folder) return;
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      const log = await electronAPI.gitLog(folder, 30);
      setGitLog(log);
    }
  };

  const refreshBranches = async (folder = openedFolder) => {
    if (!folder) return;
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      const { branches: bs, current } = await electronAPI.gitBranches(folder);
      setBranches(bs);
      if (current) setCurrentBranch(current);
    }
  };

  const handleGitInit = async () => {
    if (!openedFolder) return;
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      try {
        await electronAPI.gitInit(openedFolder);
        refreshGitStatus();
        showToast("Initialized Git Repository successfully!", "success");
      } catch (e: any) {
        showToast("Failed to initialize git: " + e.message, "error");
      }
    }
  };

  const handleGitCommit = async () => {
    if (!openedFolder || !commitMessage.trim() || gitStatus.files.length === 0) return;
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      try {
        await electronAPI.gitCommit(openedFolder, commitMessage);
        setCommitMessage("");
        refreshGitStatus();
        refreshGitLog();
        showToast(`Committed: ${commitMessage}`, "success");
      } catch (e: any) {
        showToast("Failed to commit: " + e.message, "error");
      }
    }
  };

  const handleGitPush = async () => {
    if (!openedFolder) return;
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;
    setGitLoading('push');
    try {
      await electronAPI.gitPush(openedFolder);
      showToast("Pushed to remote successfully!", "success");
    } catch (e: any) {
      showToast("Push failed: " + e.message, "error");
    } finally {
      setGitLoading(null);
    }
  };

  const handleGitPull = async () => {
    if (!openedFolder) return;
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;
    setGitLoading('pull');
    try {
      await electronAPI.gitPull(openedFolder);
      refreshGitStatus();
      showToast("Pulled from remote successfully!", "success");
    } catch (e: any) {
      showToast("Pull failed: " + e.message, "error");
    } finally {
      setGitLoading(null);
    }
  };

  const handleGitFetch = async () => {
    if (!openedFolder) return;
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;
    setGitLoading('fetch');
    try {
      await electronAPI.gitFetch(openedFolder);
      showToast("Fetched all remotes!", "success");
    } catch (e: any) {
      showToast("Fetch failed: " + e.message, "error");
    } finally {
      setGitLoading(null);
    }
  };

  const handleCheckout = async (branchName: string) => {
    if (!openedFolder) return;
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;
    try {
      await electronAPI.gitCheckout(openedFolder, branchName);
      setCurrentBranch(branchName);
      setShowBranchMenu(false);
      refreshGitStatus();
      showToast(`Switched to branch '${branchName}'`, "info");
    } catch (e: any) {
      showToast("Checkout failed: " + e.message, "error");
    }
  };

  const handleCreateBranch = async () => {
    if (!openedFolder || !newBranchName.trim()) return;
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;
    try {
      await electronAPI.gitCreateBranch(openedFolder, newBranchName.trim());
      setCurrentBranch(newBranchName.trim());
      setNewBranchName("");
      setShowBranchMenu(false);
      refreshBranches();
      showToast(`Created and switched to branch '${newBranchName.trim()}'`, "success");
    } catch (e: any) {
      showToast("Create branch failed: " + e.message, "error");
    }
  };

  // Recent files helper
  const addToRecentFiles = (name: string, path: string) => {
    setRecentFiles(prev => {
      const filtered = prev.filter(f => f.path !== path);
      const next = [{ name, path }, ...filtered].slice(0, 10);
      localStorage.setItem('imhotep_recent_files', JSON.stringify(next));
      return next;
    });
  };

  // Reveal in Explorer / Open in Terminal
  const handleRevealInExplorer = (filePath: string) => {
    (window as any).electronAPI?.revealInExplorer(filePath);
  };

  const handleOpenInTerminal = (folderPath: string) => {
    const targetPath = folderPath || openedFolder;
    if (targetPath) (window as any).electronAPI?.openInTerminal(targetPath);
  };

  useEffect(() => {
      if (openedFolder) {
        setRecentProjects(prev => {
          const filtered = prev.filter(p => p.path !== openedFolder);
          const name = openedFolder.split(/[\\/]/).pop() || openedFolder;
          const updated = [{ name, path: openedFolder, lastOpened: Date.now() }, ...filtered].slice(0, 10);
          localStorage.setItem('imhotep_recent_projects', JSON.stringify(updated));
          return updated;
        });
        refreshGitStatus();
        refreshGitLog();
      refreshBranches();
      const interval = setInterval(() => refreshGitStatus(), 5000);
      return () => clearInterval(interval);
    }
  }, [openedFolder]);



  function toggleFav(id: string) {
    setFavIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectTab(tabName: string) {
    setActiveTab(tabName);
    if (tabName === MODELS_TAB) return;
    const tabKey = tabName;
    if (tabsState[tabKey]) return; // Already loaded

    const findNodeByPath = (nodes: FileNode[], fName: string): FileNode | null => {
      for (const node of nodes) {
        if (node.type === "file" && node.name === fName) return node;
        if (node.type === "dir") {
          const found = findNodeByPath(node.children, fName);
          if (found) return found;
        }
      }
      return null;
    };

    const node = findNodeByPath(fileTree, tabName);
    if (node && node.path) {
      handleOpenFile(node.name, node.path);
    }
  }

  async function closeTab(name: string, e: React.MouseEvent) {
    e.stopPropagation();
    
    if (tabsState[name]?.isModified) {
      const ok = await showConfirm(`You have unsaved changes in ${name}. Close anyway?`);
      if (!ok) {
        return;
      }
    }

    const next = openTabs.filter(t => t !== name);
    setOpenTabs(next);
    
    setTabsState(prev => {
      const nextState = { ...prev };
      delete nextState[name];
      return nextState;
    });

    if (activeTab === name) {
      const nextActive = next[next.length - 1] ?? "";
      if (nextActive) selectTab(nextActive);
      else setActiveTab("");
    }
  }

  function toggleDir(name: string) {
    setOpenDirs(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  function openModelsHub() {
    if (!openTabs.includes(MODELS_TAB)) setOpenTabs(t => [...t, MODELS_TAB]);
    setActiveTab(MODELS_TAB);
    setActivePanel('models');
  }

  const extLang = (name: string): string => {
    const ext = (name.split(".").pop() || "").toLowerCase();
    const map: Record<string, string> = {
      ts: "typescript", tsx: "typescriptreact", js: "javascript", jsx: "javascript",
      py: "python", rb: "ruby", rs: "rust", go: "go", java: "java", kt: "kotlin",
      dart: "dart", swift: "swift", c: "c", cpp: "cpp", h: "cpp", cs: "csharp",
      html: "html", htm: "html", css: "css", scss: "scss", less: "less",
      json: "json", jsonc: "json", yaml: "yaml", yml: "yaml", toml: "ini",
      xml: "xml", svg: "xml", md: "markdown", mdx: "markdown",
      sql: "sql", sh: "shell", bash: "shell", zsh: "shell", ps1: "powershell",
      bat: "bat", cmd: "bat", dockerfile: "dockerfile",
      graphql: "graphql", gql: "graphql", lua: "lua", r: "r",
      php: "php", vue: "html", svelte: "html",
      gradle: "groovy", groovy: "groovy", scala: "scala",
      tf: "hcl", hcl: "hcl", ini: "ini", conf: "ini", env: "ini",
      makefile: "makefile", cmake: "cmake",
    };
    // Special case: file names without extension
    const baseName = name.split(/[\\/]/).pop()?.toLowerCase() || "";
    if (baseName === "dockerfile") return "dockerfile";
    if (baseName === "makefile") return "makefile";
    if (baseName === ".gitignore" || baseName === ".env") return "ini";
    return map[ext] || ext;
  };
  const sidebarWidth = (sidebarOpen && activePanel !== 'models') ? sidebarBaseWidth : 0;

  const activityItems: [Panel, (p: { active: boolean }) => JSX.Element][] = [
    ["explorer", ExplorerIcon], ["search", SearchIcon], ["git", SourceControlIcon],
    ["workspaces", WorkspacesIcon], ["models", ModelsIcon],
  ];

  // ─── STRICT NATIVE ENFORCEMENT ───
  if (!isNativeDesktop) {
    return (
      <div className="relative size-full overflow-hidden flex flex-col items-center justify-center p-6 text-center"
        style={{ background: "#0d0e12" }}>
        
        <div style={{
          position: "absolute", width: 500, height: 500, borderRadius: "50%",
          background: "transparent",
          left: "50%", top: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none"
        }} />

        <div className="relative z-10 w-full max-w-[420px] p-8 rounded-2xl border flex flex-col items-center gap-6"
          style={{ background: "#0f1016", borderColor: "rgba(212,175,55,0.15)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          
          <CartoucheLogo size={80} />
          
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold tracking-widest text-[#D4AF37]" >IMHOTEP OS</h1>
            <p className="text-[10px] uppercase tracking-wider text-[#00E699]" style={{ letterSpacing: "0.15em" }}>NATIVE HARDWARE REQUIRED</p>
          </div>

          <p className="text-[12px] text-[#9999b0] leading-relaxed">
            The desktop kernel is not loaded. Imhotep OS must be run inside its standalone desktop environment to enable local workspace file editing, code search, Git, and local AI copilot operations.
          </p>
        </div>
      </div>
    );
  }

  // ─── LOGIN PANEL VIEW ───
  if (!isLoggedIn) {
    return (
      <div className="relative size-full overflow-hidden flex flex-col items-center justify-center"
        style={{ background: "#0d0e12" }}>

        <div style={{
          position: "absolute", width: 580, height: 580, borderRadius: "50%",
          background: "transparent",
          left: "50%", top: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none"
        }} />

        <div style={{
          position: "absolute", inset: 0,
          background: "transparent",
          pointerEvents: "none"
        }} />

        <div className="relative z-10 w-full max-w-[380px] p-8 rounded-2xl border"
          style={{ background: "#0f1016", borderColor: "rgba(212,175,55,0.15)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>

          <div className="flex flex-col items-center gap-3 mb-10">
              <CartoucheLogo size={80} />
              <h1 className="text-xl font-bold tracking-widest text-[#D4AF37] uppercase">Imhotep OS</h1>
              <p className="text-[11px] text-[#6b6b80] tracking-wide">Sovereign AI Engineering Studio</p>
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full py-3 rounded text-[13px] font-semibold tracking-wide flex items-center justify-center gap-3 transition-all duration-200 animate-fade-in"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "#e8e8f0",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.borderColor = "rgba(212, 175, 55, 0.4)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {isLoggingIn ? "Authenticating..." : "Continue with Google"}
              </button>

            <div className="flex items-center gap-3 my-1 select-none">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-[10px] text-[#4a4a60] uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-[#6b6b80]" >Username / Email</label>
              <input
                type="text"
                value={loginUser}
                onChange={e => setLoginUser(e.target.value)}
                placeholder="pharaoh@imhotep-os.local"
                className="w-full rounded px-3 py-2 text-[12px] outline-none"
                style={{ background: "#0d0e12", border: "1px solid rgba(212,175,55,0.2)", color: "#c8c8d4" }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-[#6b6b80]" >Password</label>
              <input
                type="password"
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded px-3 py-2 text-[12px] outline-none"
                style={{ background: "#0d0e12", border: "1px solid rgba(212,175,55,0.2)", color: "#c8c8d4" }}
                onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
              />
            </div>

            {loginError && (
              <p className="text-[11px] text-red-500 mt-1" >{loginError}</p>
            )}

            <button
              onClick={handleLogin}
              className="w-full py-2.5 mt-2 rounded text-[12px] font-bold tracking-widest transition-all duration-200 uppercase"
              style={{ background: "rgba(212,175,55,0.15)", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.3)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,175,55,0.25)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(212,175,55,0.15)"; }}
            >
              Authenticate
            </button>
          </div>
        </div>

        <div className="absolute bottom-6 text-[9px]" style={{ color: "#4a4a60", letterSpacing: "0.20em" }}>
          v1.0.0 — SECURE HARDWARE COGNITION
        </div>
      </div>
    );
  }

  // Render dropdown menus for Top Menu Bar
  const renderDropdown = (item: string) => {
    type MenuOption = { label?: string; shortcut?: string; action?: () => void; type?: "separator"; hasSub?: boolean; subItems?: MenuOption[] };
    let options: MenuOption[] = [];

    if (item === "File") {
      options = [
        { label: "New Text File", shortcut: "Ctrl+N", action: () => { handleNewFile(); setActiveMenu(null); } },
        { label: "New File...", shortcut: "Ctrl+Alt+Windows+N", action: () => { handleNewFile(); setActiveMenu(null); } },
        { label: "New Window", shortcut: "Ctrl+Shift+N", action: () => { (window as any).electronAPI?.newWindow?.(); setActiveMenu(null); } },
        { type: "separator" },
        { label: "Open File...", shortcut: "Ctrl+O", action: () => { handleOpenFileMenu(); setActiveMenu(null); } },
        { label: "Open Folder...", shortcut: "Ctrl+K Ctrl+O", action: () => { handleOpenFolder(); setActiveMenu(null); } },
        { label: "Open Workspace...", action: () => { handleOpenFolder(); setActiveMenu(null); } },
        { label: "Open Recent", hasSub: true, action: () => { setCommandPaletteOpen(true); setActiveMenu(null); }, subItems: recentFiles.length > 0 ? recentFiles.slice(0, 5).filter(f => f && f.name).map(f => ({ label: f.name, action: () => { handleOpenFile(f.name, f.path); setActiveMenu(null); } })) : [{ label: "No Recent Files", action: () => {} }] },
        { type: "separator" },
        { label: "Save", shortcut: "Ctrl+S", action: () => { handleSaveFile(); setActiveMenu(null); } },
        { label: "Save As...", shortcut: "Ctrl+Shift+S", action: () => { handleSaveAsFile(); setActiveMenu(null); } },
        { label: "Save All", shortcut: "Ctrl+K S", action: () => { handleSaveAll(); setActiveMenu(null); } },
        { type: "separator" },
        { label: "Close Folder", action: () => {
            setOpenedFolder(null); setFileTree([]); setOpenTabs([]); setActiveTab(""); setTabsState({}); setActiveMenu(null);
        }},
        { label: "Close Window", shortcut: "Alt+F4", action: () => { window.close(); } },
        { type: "separator" },
        { label: "Exit", action: () => { window.close(); } }
      ];
    } else if (item === "Edit") {
      options = [
        { label: "Undo", shortcut: "Ctrl+Z", action: () => { editorRef.current?.trigger("menu", "undo", null); setActiveMenu(null); } },
        { label: "Redo", shortcut: "Ctrl+Y", action: () => { editorRef.current?.trigger("menu", "redo", null); setActiveMenu(null); } },
        { type: "separator" },
        { label: "Cut", shortcut: "Ctrl+X", action: () => { editorRef.current?.trigger("menu", "editor.action.clipboardCutAction", null); setActiveMenu(null); } },
        { label: "Copy", shortcut: "Ctrl+C", action: () => { editorRef.current?.trigger("menu", "editor.action.clipboardCopyAction", null); setActiveMenu(null); } },
        { label: "Paste", shortcut: "Ctrl+V", action: () => { editorRef.current?.trigger("menu", "editor.action.clipboardPasteAction", null); setActiveMenu(null); } },
        { type: "separator" },
        { label: "Find", shortcut: "Ctrl+F", action: () => { editorRef.current?.trigger("menu", "actions.find", null); setActiveMenu(null); } },
        { label: "Replace", shortcut: "Ctrl+H", action: () => { editorRef.current?.trigger("menu", "editor.action.startFindReplaceAction", null); setActiveMenu(null); } },
        { type: "separator" },
        { label: "Find in Files", shortcut: "Ctrl+Shift+F", action: () => { setActivePanel('search'); setSidebarOpen(true); setActiveMenu(null); } }
      ];
    } else if (item === "Selection") {
      options = [
        { label: "Select All", shortcut: "Ctrl+A", action: () => { editorRef.current?.setSelection(editorRef.current.getModel()!.getFullModelRange()); setActiveMenu(null); } },
        { label: "Expand Selection", shortcut: "Shift+Alt+RightArrow", action: () => { editorRef.current?.trigger("menu", "editor.action.smartSelect.expand", null); setActiveMenu(null); } },
        { label: "Shrink Selection", shortcut: "Shift+Alt+LeftArrow", action: () => { editorRef.current?.trigger("menu", "editor.action.smartSelect.shrink", null); setActiveMenu(null); } },
        { type: "separator" },
        { label: "Copy Line Up", shortcut: "Shift+Alt+UpArrow", action: () => { editorRef.current?.trigger("menu", "editor.action.copyLinesUpAction", null); setActiveMenu(null); } },
        { label: "Copy Line Down", shortcut: "Shift+Alt+DownArrow", action: () => { editorRef.current?.trigger("menu", "editor.action.copyLinesDownAction", null); setActiveMenu(null); } },
        { type: "separator" },
        { label: "Add Cursor Above", shortcut: "Ctrl+Alt+UpArrow", action: () => { editorRef.current?.trigger("menu", "editor.action.insertCursorAbove", null); setActiveMenu(null); } },
        { label: "Add Cursor Below", shortcut: "Ctrl+Alt+DownArrow", action: () => { editorRef.current?.trigger("menu", "editor.action.insertCursorBelow", null); setActiveMenu(null); } }
      ];
    } else if (item === "View") {
      options = [
        { label: "Command Palette...", shortcut: "Ctrl+Shift+P", action: () => { setCommandPaletteOpen(true); setActiveMenu(null); } },
        { type: "separator" },
        { label: "Explorer", shortcut: "Ctrl+Shift+E", action: () => { setActivePanel('explorer'); setSidebarOpen(true); setActiveMenu(null); } },
        { label: "Search", shortcut: "Ctrl+Shift+F", action: () => { setActivePanel('search'); setSidebarOpen(true); setActiveMenu(null); } },
        { label: "Terminal", shortcut: "Ctrl+`", action: () => { setTerminalOpen(true); setActiveMenu(null); } }
      ];
    } else if (item === "Go") {
      options = [
        { label: "Go to Definition", shortcut: "F12", action: () => { editorRef.current?.trigger("menu", "editor.action.revealDefinition", null); setActiveMenu(null); } },
        { label: "Go to Symbol in Editor...", shortcut: "Ctrl+Shift+O", action: () => { editorRef.current?.trigger("menu", "editor.action.quickOutline", null); setActiveMenu(null); } },
        { label: "Go to Line/Column...", shortcut: "Ctrl+G", action: () => { editorRef.current?.trigger("menu", "editor.action.gotoLine", null); setActiveMenu(null); } },
      ];
    } else if (item === "Run") {
      options = [
        { label: "Start Debugging", shortcut: "F5", action: () => { handleRunProject(); setActiveMenu(null); } },
        { label: "Run Without Debugging", shortcut: "Ctrl+F5", action: () => { handleRunProject(); setActiveMenu(null); } }
      ];
    } else if (item === "Terminal") {
      options = [
        { label: "New Terminal", shortcut: "Ctrl+Shift+`", action: () => { setTerminalOpen(true); setActiveMenu(null); } }
      ];
    } else if (item === "Help") {
      options = [
        { label: "Toggle Developer Tools", shortcut: "Ctrl+Shift+I", action: () => { (window as any).electronAPI?.toggleDevTools?.(); setActiveMenu(null); } },
        { type: "separator" },
        { label: "About Imhotep OS", action: () => { setShowAboutDialog(true); setActiveMenu(null); } }
      ];
    }

    if (options.length === 0) return null;

    return (
      <div className="absolute left-0 top-full mt-0 w-64 rounded shadow-lg border z-50 flex flex-col py-1"
        style={{ background: "#181a1f", borderColor: "rgba(212,175,55,0.15)" }}>
        {options.map((opt, idx) => {
          if (opt.type === "separator") {
            return <div key={idx} className="my-1 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }} />;
          }
          return (
            <div key={idx}
              className="flex items-center justify-between px-6 py-1 text-[12px] text-[#c8c8d4] hover:text-white hover:bg-[#007fd4] text-left w-full transition-colors duration-75 relative group cursor-pointer"
              onClick={opt.action}>
              <span>{opt.label}</span>
              <div className="flex items-center gap-3">
                {opt.shortcut && <span className="text-[11px] text-[#8a8a9e] group-hover:text-[#a0cfff] font-sans">{opt.shortcut}</span>}
                {opt.hasSub && <span className="text-[10px] text-[#8a8a9e] group-hover:text-white">▶</span>}
              </div>
              {opt.hasSub && opt.subItems && (
                <div className="absolute left-full top-0 hidden group-hover:flex flex-col w-64 rounded shadow-lg border py-1 z-50" style={{ background: "#181a1f", borderColor: "rgba(212,175,55,0.15)" }}>
                  {opt.subItems.map((sub: any, sIdx: number) => (
                    <div key={sIdx}
                      className="px-6 py-1 text-[12px] text-[#c8c8d4] hover:text-white hover:bg-[#007fd4] transition-colors duration-75 truncate"
                      onClick={(e) => { e.stopPropagation(); sub.action(); }}>
                      {sub.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── MAIN SOVEREIGN IDE WORKSPACE VIEW ───
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden relative"
      style={{ background: "#0d0e12", color: "#c8c8d4" }}>

      {/* About Dialog */}
      {showAboutDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-[9999]" onClick={() => setShowAboutDialog(false)}>
          <div className="bg-[#181a1f] p-8 rounded-md shadow-2xl border flex flex-col items-center" 
            style={{ borderColor: "rgba(212,175,55,0.3)", width: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4">
              <svg width="80" height="85" viewBox="0 0 280 300" fill="none">
                <path fill="#D4AF37" d="M122.5 289.807C123.983 289.934 125.484 290 127 290H131.5V300H127C125.487 300 123.986 299.944 122.5 299.838V289.807ZM145.5 300H136.5V290H145.5V300ZM159.5 299.662C157.364 299.885 155.195 300 153 300H150.5V290H153C155.201 290 157.371 289.862 159.5 289.597V299.662ZM108.5 286.611C111.386 287.71 114.394 288.559 117.5 289.133V299.275C114.419 298.802 111.414 298.102 108.5 297.192V286.611ZM173.5 296.529C170.593 297.547 167.587 298.355 164.5 298.934V288.722C167.615 288.018 170.624 287.037 173.5 285.802V296.529ZM153.802 0.00488281C187.674 0.434151 215 28.026 215 62V238C215 263.152 200.023 284.806 178.5 294.53V283.328C194.318 274.41 205 257.453 205 238V62C205 33.2812 181.719 10 153 10H127C98.2812 10 75 33.2812 75 62V238C75 258.262 86.5891 275.816 103.5 284.398V295.391C80.911 286.131 65 263.924 65 238V62C65 28.026 92.3261 0.434149 126.198 0.00488281L127 0H153L153.802 0.00488281Z"/>
                <circle cx="139.5" cy="84.5" r="48.5" fill="#D4AF37"/>
                <path fill="#D4AF37" d="M193.627 248.75H85.373L92.4453 236.5H186.555L193.627 248.75ZM183.668 231.5H95.332L103.415 217.5H175.585L183.668 231.5ZM172.698 212.5H106.302L114.096 199H164.904L172.698 212.5ZM162.017 194H116.983L123.334 183H155.666L162.017 194ZM152.779 178H126.221L139.5 155L152.779 178Z"/>
                <path fill="#D4AF37" d="M103.5 300H5C2.23858 300 0 297.761 0 295C0 292.239 2.23858 290 5 290H103.5V300ZM131.5 300H122.5V290H131.5V300ZM145.5 300H136.5V290H145.5V300ZM159.5 300H150.5V290H159.5V300ZM173.5 300H164.5V290H173.5V300ZM275 290C277.761 290 280 292.239 280 295C280 297.761 277.761 300 275 300H178.5V290H275ZM117.5 300H108.5V290H117.5V300Z"/>
              </svg>
            </div>
            <h2 className="text-[#D4AF37] text-[20px] font-bold tracking-widest uppercase mb-1">Imhotep OS</h2>
            <p className="text-[#8a8a9e] text-[12px] mb-6">AI Engineering Studio - v1.0.2</p>
            <div className="w-full border-t border-[#ffffff10] pt-4 mb-6">
              <div className="flex justify-between text-[11px] mb-2">
                <span className="text-[#6b6b80]">Engine</span>
                <span className="text-[#c8c8d4]">Vite + React + Electron</span>
              </div>
              <div className="flex justify-between text-[11px] mb-2">
                <span className="text-[#6b6b80]">Editor Core</span>
                <span className="text-[#c8c8d4]">Monaco Editor</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#6b6b80]">AI Subsystem</span>
                <span className="text-[#c8c8d4]">OpenRouter Gateway</span>
              </div>
            </div>
            <button onClick={() => setShowAboutDialog(false)} className="px-6 py-2 rounded bg-[#D4AF37] text-black font-bold text-[12px] hover:bg-[#b89329] transition-colors w-full">
              OK
            </button>
          </div>
        </div>
      )}

      {/* Premium custom alert/info modal window overlay */}
      {asyncDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-[9999]">
          <div className="bg-[#181a1f] p-6 rounded-md shadow-2xl border border-[#d4af37]/30 min-w-[300px] flex flex-col">
            <h2 className="text-[#D4AF37] text-[16px] mb-4 font-bold tracking-widest">{asyncDialog.type === 'confirm' ? 'Confirm Action' : 'Input Required'}</h2>
            <p className="text-[#c8c8d4] text-[12px] mb-4">{asyncDialog.message}</p>
            {asyncDialog.type === 'prompt' && (
              <input 
                id="asyncDialogInput"
                type="text" 
                autoFocus
                defaultValue={asyncDialog.defaultValue} 
                className="mb-4 bg-[#0d0e12] text-[#c8c8d4] border border-[#d4af37]/20 p-2 text-[12px] rounded outline-none focus:border-[#d4af37]/60"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') asyncDialog.onConfirm(e.currentTarget.value);
                  if (e.key === 'Escape') asyncDialog.onCancel();
                }}
              />
            )}
            <div className="flex justify-end gap-3 mt-2">
              <button onClick={asyncDialog.onCancel} className="px-4 py-1.5 rounded text-[11px] bg-white/5 hover:bg-white/10 text-white transition-colors">Cancel</button>
              <button onClick={() => asyncDialog.onConfirm(asyncDialog.type === 'prompt' ? (document.getElementById('asyncDialogInput') as HTMLInputElement)?.value : undefined)} className="px-4 py-1.5 rounded text-[11px] bg-[#d4af37]/20 hover:bg-[#d4af37]/30 text-[#d4af37] border border-[#d4af37]/30 transition-colors">
                {asyncDialog.type === 'confirm' ? 'Confirm' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalNotification && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="w-full max-w-[340px] p-6 rounded-lg border flex flex-col items-center gap-4 shadow-2xl"
            style={{ background: "#0f1016", borderColor: "rgba(212,175,55,0.2)" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: modalNotification.type === "error" ? "rgba(239,68,68,0.1)" : "rgba(212,175,55,0.1)" }}>
              {modalNotification.type === "error" ? (
                <span className="text-red-500 font-bold text-lg">✕</span>
              ) : (
                <span className="text-[#D4AF37] font-bold text-lg">✓</span>
              )}
            </div>
            <p className="text-[12px] text-center leading-relaxed text-[#c8c8d4]" >
              {modalNotification.message}
            </p>
            <button
              onClick={() => setModalNotification(null)}
              className="px-6 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all duration-150"
              style={{ background: "rgba(212,175,55,0.15)", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.3)" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.25)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(212,175,55,0.15)"}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Click-away overlay to close dropdowns */}
      {activeMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
      )}

      {/* Top Menu Bar / Custom Draggable Titlebar */}
      <div className="flex items-center h-8 shrink-0 border-b select-none" style={{ background: "#090a0d", borderColor: "rgba(212,175,55,0.15)", "WebkitAppRegion": "drag" }}>
        <div className="flex items-center gap-2 px-3 h-full border-r" style={{ borderColor: "rgba(212,175,55,0.15)", minWidth: 220, "WebkitAppRegion": "no-drag" }}>
          <div className="w-5 h-5 shrink-0"><CartoucheLogo size={20} /></div>
          <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: "#D4AF37", letterSpacing: "0.18em" }}>Imhotep OS</span>
        </div>
        <div className="flex items-center h-full relative" style={{ "WebkitAppRegion": "no-drag" }}>
          <button 
            className="flex items-center justify-center px-3 h-full hover:bg-[#27c93f]/10 text-[#27c93f] transition-colors border-r"
            style={{ borderColor: "rgba(212,175,55,0.15)" }}
            onClick={handleRunProject}
            title="Run Project (Live Preview)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="ml-1 text-[11px] font-bold tracking-wider">RUN</span>
          </button>
            
          {MENU_ITEMS.map(item => (
            <div key={item} className="relative h-full flex items-center">
              <button className={cn("px-3 h-full text-[12px] transition-all duration-200 hover:bg-white/5", activeMenu === item ? "text-[#D4AF37] bg-[#D4AF37]/10" : "text-[#9999b0]")}
                onClick={() => setActiveMenu(activeMenu === item ? null : item)}>
                {item}
              </button>
              {activeMenu === item && renderDropdown(item)}
            </div>
          ))}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[11px] truncate px-4" style={{ color: "#4a4a60" }}>
            {openedFolder ? `${openedFolder} — imhotep-os` : "Welcome to imhotep-os"}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3" style={{ "WebkitAppRegion": "no-drag" }}>
          <button onClick={() => (window as any).electronAPI?.closeWindow()} className="w-3 h-3 rounded-full bg-[#ff5f56] opacity-80 hover:opacity-100 transition-opacity" title="Close" style={{ WebkitAppRegion: "no-drag" }} />
          <button onClick={() => (window as any).electronAPI?.minimizeWindow()} className="w-3 h-3 rounded-full bg-[#ffbd2e] opacity-80 hover:opacity-100 transition-opacity" title="Minimize" style={{ WebkitAppRegion: "no-drag" }} />
          <button onClick={() => (window as any).electronAPI?.maximizeWindow()} className="w-3 h-3 rounded-full bg-[#27c93f] opacity-80 hover:opacity-100 transition-opacity" title="Maximize" style={{ WebkitAppRegion: "no-drag" }} />
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">

        {/* Activity bar */}
        <div className="flex flex-col items-center py-2 gap-1 shrink-0 border-r"
          style={{ width: 48, background: "#090a0d", borderColor: "rgba(212,175,55,0.15)" }}>
          {activityItems.map(([id, Icon]) => (
              <button key={id}
                className="w-10 h-10 flex items-center justify-center rounded-sm transition-all duration-200 relative hover:bg-white/5"
                style={{ background: activePanel === id ? "rgba(212,175,55,0.1)" : "transparent" }}
                onClick={() => {
                  if (id === "models") {
                    if (activePanel === "models") {
                      setActivePanel("explorer");
                      if (activeTab === MODELS_TAB) {
                        const otherTab = openTabs.find(t => t !== MODELS_TAB);
                        if (otherTab) setActiveTab(otherTab);
                      }
                    } else {
                      openModelsHub();
                    }
                    return;
                  }
                  if (activePanel === id) { setSidebarOpen(o => !o); } else { setActivePanel(id); setSidebarOpen(true); }
                }}
                title={id.charAt(0).toUpperCase() + id.slice(1)}>
                {activePanel === id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 rounded-r" style={{ background: "#D4AF37" }} />}
                <Icon active={activePanel === id} />
              </button>
            ))}
          <div className="flex-1" />
          <button onClick={() => setSettingsOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-sm hover:bg-white/5 transition-all duration-200" title="Account Settings">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b6b80" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </button>
          <button onClick={() => setSettingsOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-sm hover:bg-white/5 transition-all duration-200" title="Settings">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="2.5" stroke="#6b6b80" strokeWidth="1.4" />
              <path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M4.22 17.78l1.42-1.42M16.36 5.64l1.42-1.42" stroke="#6b6b80" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Sidebar */}
        <div className={`flex flex-col shrink-0 border-r overflow-hidden relative ${isDraggingSidebar ? '' : 'transition-all duration-200 ease-in-out'}`}
          style={{ width: sidebarWidth, background: "#0f1016", borderColor: sidebarOpen ? "rgba(212,175,55,0.12)" : "transparent", opacity: sidebarOpen ? 1 : 0 }}>
          
          {/* Drag Handle */}
          {sidebarOpen && (
            <div
              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 hover:bg-[#D4AF37]"
              style={{ background: isDraggingSidebar ? "rgba(212,175,55,0.8)" : "transparent" }}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDraggingSidebar(true);
              }}
            />
          )}
          <div className="flex items-center justify-between px-3 h-8 shrink-0 border-b" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
            <span className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ color: "#6b6b80" }}>
              {{ explorer: "Explorer", search: "Search", git: "Source Control", chat: "AI Chat", workspaces: "Workspaces", models: "Models" }[activePanel]}
            </span>
          </div>

          {/* EXPLORER PANEL */}
          {activePanel === "explorer" && (
            <div className="flex-1 overflow-y-auto py-1 px-2 flex flex-col justify-start gap-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(212,175,55,0.15) transparent" }}>
              {openedFolder ? (
                  isTreeLoading ? (
                    <div className="flex flex-col items-center justify-center p-4 gap-2 text-[#6b6b80] mt-10">
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke="#D4AF37"></path></svg>
                      <span className="text-[10px]">Loading workspace...</span>
                    </div>
                  ) : fileTree.length === 0 ? (
                    <div className="text-center py-4 text-[10px] text-[#4a4a60]">Workspace is empty</div>
                  ) : 
                  fileTree.map(node => (
                  <FileTreeNode key={node.name} node={node} depth={0}
                    activeFile={activeFileName || ""} onFileClick={handleOpenFile} openDirs={openDirs} onToggleDir={toggleDir} onContextMenu={handleContextMenu} gitStatus={gitStatus} />
                ))
              ) : (
                <div className="text-center py-12 flex flex-col items-center gap-4">
                  <p className="text-[11px] text-[#4a4a60]">No workspace folder open</p>
                  <button
                    onClick={handleOpenFolder}
                    className="px-4 py-2 rounded text-[10px] font-bold tracking-wider transition-all duration-200 uppercase"
                    style={{ background: "rgba(212,175,55,0.15)", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.3)" }}
                  >
                    Open Folder
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SEARCH PANEL */}
          {activePanel === "search" && (
            <div className="p-3 flex flex-col gap-3 h-full overflow-hidden">
              <div className="flex flex-col gap-2">
                <div className="flex gap-1 items-center">
                  <button onClick={() => setShowReplace(!showReplace)} className="p-1 rounded hover:bg-white/5 text-[#6b6b80]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showReplace ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") executeSearch(); }}
                    placeholder="Search in files…"
                    className="flex-1 rounded px-2 py-1 text-[12px] outline-none"
                    style={{ background: "#1a1c24", border: "1px solid rgba(212,175,55,0.2)", color: "#c8c8d4" }}
                  />
                </div>
                {showReplace && (
                  <div className="flex gap-1 items-center pl-6">
                    <input
                      value={replaceQuery}
                      onChange={e => setReplaceQuery(e.target.value)}
                      placeholder="Replace with…"
                      className="flex-1 rounded px-2 py-1 text-[12px] outline-none"
                      style={{ background: "#1a1c24", border: "1px solid rgba(212,175,55,0.2)", color: "#c8c8d4" }}
                    />
                    <button
                      onClick={executeReplaceAll}
                      className="px-2 py-1 rounded text-[11px] font-bold"
                      style={{ background: "rgba(212,175,55,0.12)", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.2)" }}
                      title="Replace All"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="1 4 1 10 7 10"></polyline>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1" style={{ scrollbarWidth: "thin" }}>
                {searchResults.length > 0 ? (
                  searchResults.map((res, i) => (
                    <div
                      key={i}
                      onClick={() => handleOpenFile(res.fileName, res.filePath, res.lineNumber)}
                      className="p-2 rounded cursor-pointer transition-all duration-200 hover:bg-white/5 border border-white/5 text-left"
                      style={{ background: "#0f1016" }}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#D4AF37]">
                        <span className="truncate">{res.fileName}</span>
                        <span className="text-[10px] text-[#6b6b80]">Ln {res.lineNumber}</span>
                      </div>
                      <p className="text-[10px] mt-1 text-[#9999b0] truncate font-mono bg-black/20 p-1 rounded">
                        {res.lineContent}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-center mt-6 text-[#4a4a60]">
                    {openedFolder ? "Type query and press Enter to search" : "Open a folder to start searching"}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* GIT / SOURCE CONTROL PANEL */}
          {activePanel === "git" && (
            <div className="p-3 flex flex-col gap-3 h-full overflow-hidden">
              {!openedFolder ? (
                <p className="text-[11px] text-center text-[#4a4a60] mt-6">Open a folder to see git status</p>
              ) : !gitStatus.isRepo ? (
                <div className="text-center py-6 flex flex-col items-center gap-3">
                  <p className="text-[11px] text-[#6b6b80]">This folder is not a Git repository.</p>
                  <button
                    onClick={handleGitInit}
                    className="px-4 py-2 rounded text-[10px] font-bold tracking-wider transition-all duration-200 uppercase"
                    style={{ background: "rgba(212,175,55,0.15)", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.3)" }}
                  >
                    Initialize Git Repository
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#e8e8f0]">Source Control</span>
                    <div className="flex items-center gap-1">
                      <button onClick={handleGitFetch} disabled={gitLoading !== null} className="p-1 hover:bg-white/5 rounded text-[#c8c8d4]" title="Fetch">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                      </button>
                      <button onClick={handleGitPull} disabled={gitLoading !== null} className="p-1 hover:bg-white/5 rounded text-[#c8c8d4]" title="Pull">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                      </button>
                      <button onClick={handleGitPush} disabled={gitLoading !== null} className="p-1 hover:bg-white/5 rounded text-[#c8c8d4]" title="Push">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex bg-[#0d0e12] rounded p-1 gap-1 shrink-0 border" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <button className={`flex-1 py-1 text-[10px] uppercase rounded transition-colors ${gitTab === 'changes' ? 'bg-[#252526] text-[#D4AF37]' : 'text-[#6b6b80] hover:text-[#c8c8d4]'}`} onClick={() => setGitTab('changes')}>Changes ({gitStatus.files.length})</button>
                    <button className={`flex-1 py-1 text-[10px] uppercase rounded transition-colors ${gitTab === 'log' ? 'bg-[#252526] text-[#D4AF37]' : 'text-[#6b6b80] hover:text-[#c8c8d4]'}`} onClick={() => setGitTab('log')}>History</button>
                  </div>

                  {gitTab === 'changes' && (
                    <>
                      <div className="flex-1 overflow-y-auto flex flex-col gap-1" style={{ scrollbarWidth: "thin" }}>
                        {gitStatus.files.length > 0 ? (
                          gitStatus.files.map((f, i) => (
                            <div key={i} className="flex items-center justify-between p-1.5 rounded hover:bg-white/5 text-[11px] cursor-pointer" onClick={() => {
                              if (f.status === 'M') {
                                handleOpenFile(f.file.split('/').pop() || '', openedFolder + '/' + f.file).then(() => setDiffMode(true));
                              } else if (f.status === 'D') {
                                showToast("Cannot open deleted file", "info");
                              } else {
                                handleOpenFile(f.file.split('/').pop() || '', openedFolder + '/' + f.file);
                              }
                            }}>
                              <span className="truncate flex-1 pr-2 text-[#c8c8d4]" title={f.file}>{f.file.split('/').pop()}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                style={{
                                  background: f.status === "M" ? "rgba(212,175,55,0.1)" : f.status === "D" ? "rgba(244,135,113,0.1)" : "rgba(0,230,153,0.1)",
                                  color: f.status === "M" ? "#D4AF37" : f.status === "D" ? "#f48771" : "#00e699"
                                }}>
                                {f.status}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] text-[#4a4a60] py-4 text-center">No modifications detected</p>
                        )}
                      </div>

                      <div className="border-t pt-3 flex flex-col gap-2 shrink-0" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
                        <textarea
                          value={commitMessage}
                          onChange={e => setCommitMessage(e.target.value)}
                          placeholder="Message (Cmd+Enter to commit)"
                          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGitCommit(); }}
                          rows={2}
                          className="w-full rounded p-1.5 text-[11px] outline-none resize-none"
                          style={{ background: "#1a1c24", border: "1px solid rgba(212,175,55,0.15)", color: "#c8c8d4" }}
                        />
                        <button
                          onClick={handleGitCommit}
                          disabled={gitStatus.files.length === 0 || !commitMessage.trim()}
                          className="w-full py-1.5 rounded text-[11px] font-bold uppercase transition-all duration-200 disabled:opacity-50"
                          style={{ background: "rgba(212,175,55,0.15)", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.3)" }}
                        >
                          Commit
                        </button>
                      </div>
                    </>
                  )}

                  {gitTab === 'log' && (
                    <div className="flex-1 overflow-y-auto flex flex-col gap-1" style={{ scrollbarWidth: "thin" }}>
                      {gitLog.map((log, i) => (
                        <div key={log.hash} className="p-2 rounded hover:bg-white/5 border-l-2 flex flex-col gap-1" style={{ borderColor: i === 0 ? "#D4AF37" : "transparent" }}>
                          <span className="text-[11px] text-[#e8e8f0] line-clamp-2 leading-tight">{log.subject}</span>
                          <div className="flex items-center justify-between text-[9px] text-[#6b6b80]">
                            <span>{log.author}</span>
                            <span>{log.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

          {/* EXTENSIONS PANEL */}
          

          {activePanel === "workspaces" && <AgentSidebar openedFolder={openedFolder} sessions={sessions} activeSessionId={activeSessionId} setSessions={setSessions} setActiveSessionId={(id) => { setActiveSessionId(id); setShowChatPanel(true); }} showPrompt={showPrompt} showConfirm={showConfirm} onNewChat={() => { setActiveSessionId('default'); setShowChatPanel(true); }} />}
          
        </div>




        {/* Sliding Chat Panel */}
        <div className="h-full flex-shrink-0 z-10 transition-all duration-300 ease-in-out overflow-hidden" 
             style={{ width: showChatPanel ? 450 : 0, opacity: showChatPanel ? 1 : 0, borderRight: showChatPanel ? "1px solid rgba(212,175,55,0.1)" : "none", background: "#0d0e12" }}>
           <div className="w-[450px] h-full flex flex-col relative">
              <ChatPanel favIds={favIds} onOpenModels={openModelsHub} localModels={localModels} localGatewayMsg={localGatewayMsg} openedFolder={openedFolder} showConfirm={showConfirm} showPrompt={showPrompt} sessions={sessions} setSessions={setSessions} activeSessionId={activeSessionId} onClose={() => setShowChatPanel(false)} selectedModel={selectedModel} onSelectModel={setGlobalActiveModel} />
           </div>
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex items-end shrink-0 border-b overflow-x-auto no-scrollbar" style={{ background: "#0d0e12", borderColor: "rgba(212,175,55,0.12)", height: 35 }}>
            {openTabs.map(tab => {
              const isActive = tab === activeTab;
              const isModels = tab === MODELS_TAB;
              const isPinned = pinnedTabs.has(tab);
              const displayTabName = tabsState[tab]?.name || tab;
              return (
                <div key={tab}
                  className="flex items-center gap-2 px-3 h-full cursor-pointer relative transition-all duration-200 border-r group shrink-0"
                  style={{ background: isActive ? "#0d0e12" : "#0d0e12", borderColor: "rgba(212,175,55,0.1)", minWidth: isPinned ? 40 : 100, maxWidth: isPinned ? 60 : 180 }}
                  onClick={() => selectTab(tab)}
                  onDoubleClick={() => setPinnedTabs(prev => { const n = new Set(prev); n.add(tab); return n; })}
                >
                  {isActive && <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "#D4AF37" }} />}
                  {isModels
                    ? <span className="text-[12px]" style={{ color: "#D4AF37" }}>⚡</span>
                    : <FileIcon lang={extLang(tab)} />}
                  
                  {!isPinned && (
                    <span className="text-[12px] truncate flex-1" style={{ color: isActive ? "#e8e8f0" : "#6b6b80", fontStyle: isActive && !isPinned ? "normal" : "italic" }}>
                      {displayTabName}
                      {tabsState[tab]?.isModified && <span className="ml-1 text-[10px]" style={{ color: "#D4AF37" }}>●</span>}
                    </span>
                  )}
                  
                  <button className={`w-4 h-4 flex items-center justify-center rounded-sm transition-all duration-200 text-[#6b6b80] hover:text-[#e8e8f0] ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    onClick={e => {
                      e.stopPropagation();
                      if (e.altKey) {
                        // Alt+Click = Toggle Pin
                        setPinnedTabs(prev => {
                          const next = new Set(prev);
                          if (next.has(tab)) next.delete(tab); else next.add(tab);
                          return next;
                        });
                      } else {
                        closeTab(tab, e);
                      }
                    }}
                    title="Close (Alt+Click to Pin)"
                  >
                    {isPinned ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg> : "✕"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Breadcrumb */}
          {activeTab !== MODELS_TAB && activeTab !== "" && (
            <div className="flex items-center px-4 h-7 shrink-0 border-b gap-1.5" style={{ background: "#0d0e12", borderColor: "rgba(212,175,55,0.08)" }}>
              {(activeFilePath || `imhotep-os/src/${activeTab}`).split(/[\\/]/).map((seg, i, arr) => (
                <span key={seg} className="flex items-center gap-1.5">
                  <span className="text-[11px]" style={{ color: i === arr.length - 1 ? "#c8c8d4" : "#4a4a60" }}>{seg}</span>
                  {i < arr.length - 1 && <span style={{ color: "#4a4a60" }}>›</span>}
                </span>
              ))}
            </div>
          )}

          {/* Editor content */}
          <div className="flex-1 overflow-auto bg-[#161820]" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(212,175,55,0.12) transparent" }}>
            {activeTab === MODELS_TAB ? (
              <ModelsHub favIds={favIds} onToggleFav={toggleFav} localModels={localModels} staticModels={STATIC_MODELS} openRouterKey={openRouterKey} setOpenRouterKey={handleSetOpenRouterKey} googleKey={googleKey} setGoogleKey={handleSetGoogleKey} globalActiveModel={selectedModel} onSelectModel={(m) => { setGlobalActiveModel(m); showToast("Active model updated to " + m.name, "success"); }} />
            ) : fileContent !== null ? (
              <div className="flex h-full min-h-full relative" style={{ flexDirection: splitMode === 'vertical' ? 'row' : 'column' }}>
                {inlinePromptOpen && (
                  <div 
                    className="absolute top-4 left-1/2 -translate-x-1/2 w-[600px] z-[50] rounded shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-4"
                    style={{ background: "#252526", border: "1px solid rgba(255,255,255,0.15)" }}
                  >
                    <div className="flex items-center px-3 py-2 border-b gap-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                      <input
                        autoFocus
                        value={inlinePromptText}
                        onChange={e => setInlinePromptText(e.target.value)}
                        onKeyDown={async e => {
                          if (e.key === 'Escape') {
                            setInlinePromptOpen(false);
                            setInlinePromptText("");
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            if (!inlinePromptText.trim()) return;
                            showToast("AI is generating edits...", "info");
                            const prompt = `Task: ${inlinePromptText}\n\nCurrent code:\n${fileContent}\n\nOutput ONLY the fully modified raw code. No markdown, no explanations.`;
                            let res = null; try { res = await askAI(prompt, selectedModel, "You are an expert AI pair programmer. Output ONLY raw code replacing the entire file."); } catch (e: any) { showToast(e.message, "error"); }
                            if (res) {
                              updateActiveTabContent(res.replace(/```[a-z]*\n?/g, '').replace(/```/g, ''));
                              if (editorRef.current) {
                                editorRef.current.setValue(res.replace(/```[a-z]*\n?/g, '').replace(/```/g, ''));
                              }
                              setInlinePromptOpen(false);
                              setInlinePromptText("");
                              showToast("Edits applied", "success");
                            } else {
                              showToast("Failed to generate edits", "error");
                            }
                          }
                        }}
                        placeholder="Ask AI to edit this file... (Press Enter to submit, Esc to cancel)"
                        className="flex-1 bg-transparent outline-none text-[13px] text-white placeholder:text-[#6b6b80]"
                        style={{ fontFamily: "Outfit, sans-serif" }}
                      />
                    </div>
                  </div>
                )}
                {/* Primary Editor */}
                <div className="flex-1 h-full bg-[#1e1e1e]" style={splitMode ? { flex: '0 0 50%', borderRight: '1px solid rgba(255,255,255,0.08)' } : {}}>
                  {diffMode ? (
                    <DiffEditor
                      height="100%"
                      theme="vs-dark"
                      language={extLang(activeTab) || "javascript"}
                      original={tabsState[activeTab]?.originalContent || ""}
                      modified={fileContent}
                      options={{
                        fontFamily: editorSettings.fontFamily,
                        fontSize: editorSettings.fontSize,
                        readOnly: false,
                        renderSideBySide: true,
                      }}
                    />
                  ) : (
                    <Editor
  key={activeTab}
  height="100%"
  theme="vs-dark"
  language={extLang(activeTab) || "javascript"}
  defaultValue={activeTabState?.content || ""}
  onChange={(val) => handleEditorChange(val || "")}
  onMount={(editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { latestSaveFile.current?.(); });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, () => { latestNewFile.current?.(); });
                  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => { latestCloseActiveTab.current?.(); });
                  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => { latestSaveAsFile.current?.(); });
                  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => { setSidebarOpen(prev => !prev); });
                  editor.addCommand(monaco.KeyCode.F5, () => { handleRunProject(); });
                  editorRef.current = editor;
                        // Activate TypeScript/JavaScript IntelliSense
                        monaco.languages.typescript?.typescriptDefaults?.setCompilerOptions({
                          target: monaco.languages.typescript?.ScriptTarget?.Latest || 99,
                          allowNonTsExtensions: true,
                          moduleResolution: monaco.languages.typescript?.ModuleResolutionKind?.NodeJs || 2,
                          module: monaco.languages.typescript?.ModuleKind?.CommonJS || 1,
                          noEmit: true,
                          esModuleInterop: true,
                          jsx: monaco.languages.typescript?.JsxEmit?.React || 2,
                          reactNamespace: 'React',
                          allowJs: true,
                          checkJs: false,
                          strict: false,
                        });
                        monaco.languages.typescript?.typescriptDefaults?.setDiagnosticsOptions({
                          noSemanticValidation: false,
                          noSyntaxValidation: false,
                        });
                        monaco.languages.typescript?.javascriptDefaults?.setDiagnosticsOptions({
                          noSemanticValidation: true,
                          noSyntaxValidation: false,
                        });
                        // Monaco markers → Problems panel
                        monaco.editor.onDidChangeMarkers(() => {
                          const allMarkers = monaco.editor.getModelMarkers({});
                          const mapped: Problem[] = allMarkers.map(m => ({
                            severity: m.severity === monaco.MarkerSeverity.Error ? 'error'
                              : m.severity === monaco.MarkerSeverity.Warning ? 'warning'
                              : m.severity === monaco.MarkerSeverity.Info ? 'info' : 'hint',
                            message: m.message,
                            file: m.resource.path.split('/').pop() || '',
                            startLine: m.startLineNumber,
                            startColumn: m.startColumn,
                            source: m.source,
                          }));
                          setProblems(mapped);
                        });

                                                  // -- CODE INTELLIGENCE (Hover & Go to Definition) --
                          if (!(window as any).__codeIntellRegistered) {
                            (window as any).__codeIntellRegistered = true;
                            
                            // Basic Hover Provider for common symbols
                            monaco.languages.registerHoverProvider('*', {
                              provideHover: (model, position) => {
                                const word = model.getWordAtPosition(position);
                                if (!word) return null;
                                const content = model.getValue();
                                const wordStr = word.word;
                                
                                // Very basic heuristics for hover info
                                if (content.includes(`class ${wordStr}`)) {
                                  return { contents: [{ value: `**Class ${wordStr}**\n\nFound definition in current file.` }] };
                                }
                                if (content.includes(`function ${wordStr}`) || content.match(new RegExp(`const ${wordStr}\\s*=\\s*\\(`))) {
                                  return { contents: [{ value: `**Function ${wordStr}()**\n\nFound definition in current file.` }] };
                                }
                                
                                return null;
                              }
                            });

                            // Basic Definition Provider
                            monaco.languages.registerDefinitionProvider('*', {
                              provideDefinition: (model, position) => {
                                const word = model.getWordAtPosition(position);
                                if (!word) return null;
                                const wordStr = word.word;
                                
                                // Regex to find simple definitions in current file
                                const regex = new RegExp(`(?:class|function|const|let|var)\\s+${wordStr}\\b|${wordStr}\\s*=\\s*\\(`, "g");
                                const matches = [...model.getValue().matchAll(regex)];
                                
                                if (matches.length > 0) {
                                  const match = matches[0]; // Take first match
                                  const index = match.index || 0;
                                  const pos = model.getPositionAt(index);
                                  return {
                                    uri: model.uri,
                                    range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column + wordStr.length)
                                  };
                                }
                                return null;
                              }
                            });
                          }
                          
                          // AI Ghost Text (Inline Completions)
                        monaco.languages.registerInlineCompletionsProvider('*', {
                          provideInlineCompletions: async (model, position, context, token) => {
                            await new Promise(r => setTimeout(r, 600)); // Debounce
                            if (token.isCancellationRequested) return { items: [] };

                            const textUntilPosition = model.getValueInRange({
                              startLineNumber: Math.max(1, position.lineNumber - 50),
                              startColumn: 1,
                              endLineNumber: position.lineNumber,
                              endColumn: position.column
                            });

                            const textAfterPosition = model.getValueInRange({
                              startLineNumber: position.lineNumber,
                              startColumn: position.column,
                              endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 50),
                              endColumn: model.getLineMaxColumn(Math.min(model.getLineCount(), position.lineNumber + 50))
                            });

                            if (!textUntilPosition.trim()) return { items: [] };

                            const prompt = `Complete this code:\n\n<before_cursor>\n${textUntilPosition}\n</before_cursor>\n\n<after_cursor>\n${textAfterPosition}\n</after_cursor>\n\nOutput ONLY the exact missing code to insert at the cursor. No explanation, no markdown.`;
                            let aiRes = null; try { aiRes = await askAI(prompt, selectedModel, "You are a ghost text code completion AI. Output ONLY the exact missing code to insert at the cursor. No explanation, no markdown."); } catch (e) { console.error(e); }

                            if (token.isCancellationRequested || !aiRes) return { items: [] };

                            return {
                              items: [{
                                insertText: aiRes.trimEnd()
                              }]
                            };
                          },
                          freeInlineCompletions: () => {}
                        });

                        // AI Context Menu Action: Refactor
                        editor.addAction({
                          id: 'ai-refactor',
                          label: '✨ Refactor with AI',
                          contextMenuGroupId: 'navigation',
                          contextMenuOrder: 1.5,
                          run: async function(ed) {
                            const sel = ed.getSelection();
                            if (!sel || sel.isEmpty()) return;
                            const text = ed.getModel()?.getValueInRange(sel);
                            if (!text) return;
                            
                            showToast("AI is refactoring...", "info");
                            const prompt = `Refactor the following code to make it cleaner, more efficient, and better structured:\n\n${text}\n\nOutput ONLY the refactored code without markdown blocks or explanation.`;
                            let res = null; try { res = await askAI(prompt, selectedModel, "You are a senior software architect. Output ONLY raw code to replace the selection."); } catch (e: any) { showToast(e.message, "error"); }
                            if (res) {
                              ed.executeEdits("ai-refactor", [{ range: sel, text: res.replace(/```[a-z]*\n?/g, '').replace(/```/g, ''), forceMoveMarkers: true }]);
                              showToast("Refactored successfully", "success");
                            } else {
                              showToast("Refactoring failed or no AI key set", "error");
                            }
                          }
                        });
                        
                        // AI Context Menu Action: Document
                        editor.addAction({
                          id: 'ai-document',
                          label: '📝 Document with AI',
                          contextMenuGroupId: 'navigation',
                          contextMenuOrder: 1.6,
                          run: async function(ed) {
                            const sel = ed.getSelection();
                            if (!sel || sel.isEmpty()) return;
                            const text = ed.getModel()?.getValueInRange(sel);
                            if (!text) return;
                            
                            showToast("AI is documenting...", "info");
                            const prompt = `Add comprehensive JSDoc/docstrings to this code:\n\n${text}\n\nOutput ONLY the documented code without markdown blocks or explanation.`;
                            let res = null; try { res = await askAI(prompt, selectedModel, "You are a senior documentation engineer. Output ONLY raw code to replace the selection."); } catch (e: any) { showToast(e.message, "error"); }
                            if (res) {
                              ed.executeEdits("ai-document", [{ range: sel, text: res.replace(/```[a-z]*\n?/g, '').replace(/```/g, ''), forceMoveMarkers: true }]);
                              showToast("Documented successfully", "success");
                            } else {
                              showToast("Documentation failed or no AI key set", "error");
                            }
                          }
                        });
                      }}
                      options={{
                        fontFamily: editorSettings.fontFamily,
                        fontSize: editorSettings.fontSize,
                        tabSize: editorSettings.tabSize,
                        minimap: { enabled: editorSettings.minimap, renderCharacters: false },
                        lineNumbers: editorSettings.lineNumbers,
                        wordWrap: editorSettings.wordWrap,
                        stickyScroll: { enabled: editorSettings.stickyScroll },
                        bracketPairColorization: { enabled: editorSettings.bracketPairColorization },
                        cursorBlinking: editorSettings.cursorBlinking,
                        renderWhitespace: editorSettings.renderWhitespace,
                        lineHeight: 24,
                        padding: { top: 16, bottom: 16 },
                        scrollBeyondLastLine: false,
                        smoothScrolling: true,
                        cursorSmoothCaretAnimation: "on",
                        renderLineHighlight: "all",
                        suggestOnTriggerCharacters: true,
                        quickSuggestions: { other: true, comments: false, strings: false },
                        parameterHints: { enabled: true },
                        suggest: { showMethods: true, showFunctions: true, showConstructors: true, showFields: true, showVariables: true, showClasses: true, showInterfaces: true, showModules: true, showProperties: true, showKeywords: true, showSnippets: true },
                        formatOnType: false,
                        formatOnPaste: false,
                        foldingStrategy: 'indentation',
                        guides: { bracketPairs: true, indentation: true },
                      }}
                      loading={<div className="flex h-full items-center justify-center text-[#6b6b80] text-sm font-[Outfit]">Loading IDE Engine...</div>}
                    />
                  )}
                </div>
                {/* Secondary Editor (Split Mode) */}
                {splitMode === 'vertical' && (
                  <div className="flex-1 h-full bg-[#1e1e1e]">
                    <Editor
                      height="100%"
                      theme="vs-dark"
                      language={extLang(secondaryActiveTab || activeTab) || "javascript"}
                      value={tabsState[secondaryActiveTab]?.content || tabsState[activeTab]?.content || ""}
                      onChange={(val) => {
                        const tabToUpdate = secondaryActiveTab || activeTab;
                        setTabsState(prev => {
                          if (!tabToUpdate || !prev[tabToUpdate]) return prev;
                          return {
                            ...prev,
                            [tabToUpdate]: {
                              ...prev[tabToUpdate],
                              content: val || "",
                              isModified: val !== prev[tabToUpdate].originalContent
                            }
                          };
                        });
                      }}
                      options={{
                        fontFamily: editorSettings.fontFamily,
                        fontSize: editorSettings.fontSize,
                        minimap: { enabled: false },
                        lineNumbers: editorSettings.lineNumbers,
                        wordWrap: editorSettings.wordWrap,
                        readOnly: false,
                        lineHeight: 24,
                        padding: { top: 16, bottom: 16 },
                        scrollBeyondLastLine: false,
                        smoothScrolling: true,
                      }}
                      loading={<div className="flex h-full items-center justify-center text-[#6b6b80] text-sm">Loading...</div>}
                    />
                  </div>
                )}
              </div>

            ) : (
              // Welcome / Blank Workspace state
              <div className="flex flex-col items-center justify-center h-full gap-6">
                <CartoucheLogo size={80} />
                <div className="text-center">
                  <h1 className="text-3xl font-semibold tracking-widest mb-2" style={{ color: "#D4AF37" }}>Imhotep OS</h1>
                  <p className="text-sm text-[#6b6b80] mb-6">Sovereign local-first engineering studio</p>
                </div>
                
                {!openedFolder && (
                <div className="flex gap-10 mt-4 max-w-[800px] w-full px-8">
                    <div className="flex-1">
                        <h2 className="text-xs uppercase tracking-widest text-[#D4AF37] mb-4">Start</h2>
                        <div className="flex flex-col gap-2 mb-8">
                        <button onClick={handleOpenFolder} className="text-left text-[13px] text-[#c8c8d4] hover:text-white py-1 transition-colors">
                            Open Folder...
                        </button>
                        <button onClick={() => {}} className="text-left text-[13px] text-[#c8c8d4] hover:text-white py-1 transition-colors">
                            Clone Repository...
                        </button>
                        </div>
                        
                        <h2 className="text-xs uppercase tracking-widest text-[#D4AF37] mb-4">Recent Projects</h2>
                        <div className="flex flex-col max-h-[250px] overflow-y-auto pr-2" style={{ scrollbarWidth: "thin" }}>
                        {recentProjects.length === 0 && <div className="text-xs text-[#4a4a60]">No recent projects</div>}
                        {recentProjects.filter(p => p && p.name).map(p => (
                            <div key={p.path} className="flex flex-col py-1.5 cursor-pointer group" onClick={() => handleOpenSpecificFolder(p.path)}>
                                <span className="text-[13px] text-[#c8c8d4] group-hover:text-[#007fd4] transition-colors">{p.name}</span>
                                <span className="text-[10px] text-[#4a4a60] truncate">{p.path}</span>
                            </div>
                        ))}
                        </div>
                    </div>
                    
                    <div className="flex-1 border-l pl-10" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
                        <h2 className="text-xs uppercase tracking-widest text-[#D4AF37] mb-4">Shortcuts</h2>
                        <div className="flex flex-col gap-2">
                        {[
                            ["Open Folder", "Ctrl+O"],
                            ["Save File", "Ctrl+S"],
                            ["Toggle Terminal", "Ctrl+`"],
                            ["AI Chat", "Ctrl+Alt+I"]
                        ].map(([label, shortcut]) => (
                            <div key={label} className="flex items-center justify-between py-1"
                            onClick={label === "Open Folder" ? handleOpenFolder : label === "Toggle Terminal" ? () => setTerminalOpen(prev => !prev) : label === "AI Chat" ? () => setShowChatPanel(true) : undefined}>
                            <span className="text-[12px] text-[#9999b0]">{label}</span>
                            <kbd className="text-[10px] px-2 py-0.5 rounded" style={{ background: "#1a1c24", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.2)", fontFamily: "JetBrains Mono, monospace" }}>{shortcut}</kbd>
                            </div>
                        ))}
                        </div>
                    </div>
                </div>
                )}

                {openedFolder && (
                    <p className="text-xs text-[#4a4a60] mt-10">Select a file from the explorer to start editing</p>
                )}
              </div>
            )}
          </div>
          
          {/* Bottom Panel (Terminal, Problems, Outline) */}
          {terminalOpen && (
            <div className="h-[280px] shrink-0 border-t flex flex-col bg-[#1e1e1e]" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              {/* Bottom Panel Tabs */}
              <div className="flex items-center px-4 h-9 border-b shrink-0 gap-6 text-[11px] uppercase tracking-wider" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <button
                  className={`h-full border-b-2 flex items-center transition-colors ${activeBottomPanel === 'terminal' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-[#6b6b80] hover:text-[#c8c8d4]'}`}
                  onClick={() => setActiveBottomPanel('terminal')}
                >
                  Terminal
                </button>
                <button
                  className={`h-full border-b-2 flex items-center transition-colors ${activeBottomPanel === 'problems' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-[#6b6b80] hover:text-[#c8c8d4]'}`}
                  onClick={() => setActiveBottomPanel('problems')}
                >
                  Problems <span className="ml-1.5 px-1.5 py-0.5 bg-white/5 rounded-full text-[9px]">{problems.length}</span>
                </button>
                <button
                  className={`h-full border-b-2 flex items-center transition-colors ${activeBottomPanel === 'outline' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-[#6b6b80] hover:text-[#c8c8d4]'}`}
                  onClick={() => setActiveBottomPanel('outline')}
                >
                  Outline
                </button>
                <div className="flex-1" />
                <button onClick={() => setTerminalOpen(false)} className="text-[#6b6b80] hover:text-white">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              {/* Bottom Panel Content */}
              <div className="flex-1 overflow-hidden relative">
                {activeBottomPanel === 'terminal' && <TerminalPanel folderPath={openedFolder} onClose={() => setTerminalOpen(false)} />}
                {activeBottomPanel === 'problems' && (
                  <ProblemsPanel
                    problems={problems}
                    onGoTo={(file, line, col, fullPath) => {
                      const tabKey = Object.keys(tabsState).find(k => tabsState[k].path === fullPath || tabsState[k].name === file);
                      if (tabKey) {
                        selectTab(tabKey);
                      } else if (fullPath) {
                        handleOpenFile(file, fullPath, line);
                        return; // handleOpenFile will handle the scroll if we pass line
                      } else {
                        showToast(`Must open ${file} first`, "warning");
                      }
                      setTimeout(() => {
                        editorRef.current?.revealLineInCenter(line);
                        editorRef.current?.setPosition({ lineNumber: line, column: col });
                        editorRef.current?.focus();
                      }, 100);
                    }}
                    onAutoFix={async (p) => {
                      const targetTabKey = Object.keys(tabsState).find(k => tabsState[k].path === p.file || tabsState[k].name === p.file);
                      if (!targetTabKey) {
                        showToast(`Must open ${p.file} first to auto-fix`, "warning");
                        return;
                      }
                      if (activeTab !== targetTabKey) {
                        selectTab(targetTabKey);
                      }
                      showToast(`AI is fixing: ${p.message}...`, "info");
                      // We need current content of the file directly from tabsState, because activeTab is async
                      const currentContent = tabsState[targetTabKey].content;
                      const prompt = `Fix this error in the code:\n\nError: ${p.message} at line ${p.startLine}\n\nCode:\n${currentContent}\n\nOutput ONLY the full fixed code without markdown blocks or explanation.`;
                      let res = null; try { res = await askAI(prompt, selectedModel, "You are an expert bug fixer. Output only raw code."); } catch (e: any) { showToast(e.message, "error"); }
                      if (res) {
                        const fixedCode = res.replace(/```[a-z]*\n?/g, '').replace(/```/g, '');
                        updateActiveTabContent(fixedCode);
                        if (editorRef.current) {
                           editorRef.current.setValue(fixedCode);
                        }
                        showToast("Auto-fix applied!", "success");
                      } else {
                        showToast("Auto-fix failed or no AI key set", "error");
                      }
                    }}
                  />
                )}
                {activeBottomPanel === 'outline' && (
                  <OutlinePanel
                    code={fileContent || ""}
                    language={extLang(activeFileName || "") || ""}
                    onGoToLine={(line) => {
                      editorRef.current?.revealLineInCenter(line);
                      editorRef.current?.setPosition({ lineNumber: line, column: 1 });
                      editorRef.current?.focus();
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>

                {/* Run Studio Panel (Legacy Right Sidebar) */}
        {showRunStudio && (
          <div className="flex flex-col border-l shrink-0 bg-[#090a0c]" style={{ width: 420, borderColor: "rgba(212,175,55,0.15)" }}>
            <div className="flex items-center justify-between px-4 h-9 shrink-0 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <span className="text-[11px] font-bold tracking-widest text-[#D4AF37] uppercase">Run Studio</span>
              <button onClick={() => setShowRunStudio(false)} className="text-[#6b6b80] hover:text-[#c8c8d4]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="flex-1 relative bg-white">
              <webview id="run-webview-legacy" src={runUrl} style={{ width: "100%", height: "100%", border: "none" }} />
            </div>
          </div>
        )}

        {/* Run Studio Panel (Floating Simulator) */}
        <SimulatorPanel open={showSimulator} onClose={() => setShowSimulator(false)} url={simulatorUrl} />
      </div>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div
          className="absolute z-[9999] bg-[#1a1c24] border rounded-md shadow-2xl py-1 flex flex-col min-w-[190px]"
          style={{ left: contextMenu.x, top: contextMenu.y, borderColor: "rgba(212,175,55,0.2)" }}
        >
          <button className="text-[11px] text-[#c8c8d4] hover:bg-[#D4AF37]/20 hover:text-[#D4AF37] px-4 py-1.5 text-left transition-colors"
            onClick={() => handleFileAction('create-file', contextMenu.node)}>New File...</button>
          <button className="text-[11px] text-[#c8c8d4] hover:bg-[#D4AF37]/20 hover:text-[#D4AF37] px-4 py-1.5 text-left transition-colors"
            onClick={() => handleFileAction('create-dir', contextMenu.node)}>New Folder...</button>
          <div className="h-[1px] bg-white/5 my-1" />
          <button className="text-[11px] text-[#c8c8d4] hover:bg-white/5 px-4 py-1.5 text-left transition-colors"
            onClick={() => { navigator.clipboard.writeText(contextMenu.node.path); setContextMenu(null); }}>Copy Path</button>
          <button className="text-[11px] text-[#c8c8d4] hover:bg-white/5 px-4 py-1.5 text-left transition-colors"
            onClick={() => { handleRevealInExplorer(contextMenu.node.path); setContextMenu(null); }}>Reveal in File Explorer</button>
          <button className="text-[11px] text-[#c8c8d4] hover:bg-white/5 px-4 py-1.5 text-left transition-colors"
            onClick={() => { handleOpenInTerminal(contextMenu.node.type === 'dir' ? contextMenu.node.path : contextMenu.node.path.substring(0, Math.max(contextMenu.node.path.lastIndexOf('\\'), contextMenu.node.path.lastIndexOf('/')))); setContextMenu(null); }}>Open in Integrated Terminal</button>
          <div className="h-[1px] bg-white/5 my-1" />
          <button className="text-[11px] text-[#c8c8d4] hover:bg-[#D4AF37]/20 hover:text-[#D4AF37] px-4 py-1.5 text-left transition-colors"
            onClick={() => handleFileAction('rename', contextMenu.node)}>Rename...</button>
          <div className="h-[1px] bg-white/5 my-1" />
          <button className="text-[11px] text-[#ff4444] hover:bg-[#ff4444]/20 px-4 py-1.5 text-left transition-colors"
            onClick={() => handleFileAction('delete', contextMenu.node)}>Delete</button>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 h-6 shrink-0 text-[11px]"
        style={{ background: "#090a0d", borderTop: "1px solid rgba(212,175,55,0.15)", color: "#6b6b80", fontFamily: "Outfit, sans-serif" }}>
        <div className="flex items-center gap-3">
          {/* Branch Selector */}
          {gitStatus.isRepo && (
            <div className="relative">
              <button
                className="flex items-center gap-1 cursor-pointer hover:text-[#c8c8d4] transition-colors px-1.5 py-0.5 rounded hover:bg-white/5"
                onClick={() => { setShowBranchMenu(b => !b); refreshBranches(); }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <circle cx="3" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="9" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M3 4.5V6a3 3 0 003 3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span>{currentBranch || 'main'}</span>
              </button>
              {showBranchMenu && (
                <div className="absolute bottom-6 left-0 bg-[#252526] border rounded shadow-xl z-[9999] py-1 min-w-[200px]" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <div className="px-2 pb-1 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <input
                      className="w-full bg-[#3c3c3c] text-[11px] text-[#cccccc] px-2 py-1 rounded outline-none"
                      placeholder="Create or search branch..."
                      value={newBranchName}
                      onChange={e => setNewBranchName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateBranch(); }}
                    />
                  </div>
                  {branches.filter(b => !newBranchName || b.includes(newBranchName)).map(b => (
                    <button key={b}
                      className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#094771] transition-colors flex items-center gap-2"
                      style={{ color: b === currentBranch ? '#D4AF37' : '#cccccc' }}
                      onClick={() => handleCheckout(b)}
                    >
                      {b === currentBranch && <span style={{ fontSize: 8 }}>✓</span>}
                      {b}
                    </button>
                  ))}
                  {newBranchName && (
                    <button
                      className="w-full text-left px-3 py-1.5 text-[11px] text-[#D4AF37] hover:bg-[#D4AF37]/10 border-t"
                      style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                      onClick={handleCreateBranch}
                    >
                      + Create branch '{newBranchName}'
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {isModified && <span style={{ color: "#D4AF37" }}>● Unsaved</span>}
          {problems.filter(p => p.severity === 'error').length > 0 && (
            <button
              className="flex items-center gap-1 text-[#f48771] hover:text-white transition-colors"
              onClick={() => { setActiveBottomPanel('problems'); setTerminalOpen(true); }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7.5" fill="#f48771" /><text x="8" y="12" textAnchor="middle" fontSize="10" fill="#000" fontWeight="bold">!</text></svg>
              {problems.filter(p => p.severity === 'error').length} errors
            </button>
          )}
          {problems.filter(p => p.severity === 'warning').length > 0 && (
            <span className="flex items-center gap-1" style={{ color: '#cca700' }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 1L15 14H1L8 1Z" fill="#cca700" /></svg>
              {problems.filter(p => p.severity === 'warning').length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span style={{ color: "#D4AF37" }}>⚡ {favIds.size + localModels.length} models</span>
          {activeFileName && <span>{extLang(activeFileName)?.toUpperCase() || 'TEXT'}</span>}
          <span>UTF-8</span>
          <button
            className="flex items-center gap-1 hover:text-[#c8c8d4] transition-colors"
            title="Toggle Zen Mode (F11)"
            onClick={() => setZenMode(z => !z)}
          >
            {zenMode ? 'Exit Zen' : 'Zen'}
          </button>
          <button
            className="flex items-center gap-1 hover:text-[#c8c8d4] transition-colors"
            title="Toggle Split Editor (Ctrl+\\)"
            onClick={() => setSplitMode(s => s ? null : 'vertical')}
          >
            Split
          </button>
          <span className="px-2 py-0.5 rounded-sm cursor-pointer" onClick={openModelsHub}
            style={{ background: "rgba(212,175,55,0.15)", color: "#D4AF37" }}>
            Imhotep OS
          </span>
        </div>
      </div>

      {/* ─── OVERLAYS ─────────────────────────────────────────────────────── */}

      {/* Command Palette */}


      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        recentFiles={recentFiles.filter(f => f && f.name).map(f => ({ name: f.name, path: f.path, onOpen: () => handleOpenFile(f.name, f.path) }))}
        commands={[
          { id: 'file.open', label: 'Open Folder...', category: 'File', shortcut: 'Ctrl+O', action: handleOpenFolder },
          { id: 'file.save', label: 'Save File', category: 'File', shortcut: 'Ctrl+S', action: handleSaveFile },
          { id: 'editor.find', label: 'Find', category: 'Editor', shortcut: 'Ctrl+F', action: () => triggerEditorAction('actions.find') },
          { id: 'editor.replace', label: 'Find & Replace', category: 'Editor', shortcut: 'Ctrl+H', action: () => triggerEditorAction('editor.action.startFindReplaceAction') },
          { id: 'editor.format', label: 'Format Document', category: 'Editor', shortcut: 'Shift+Alt+F', action: () => triggerEditorAction('editor.action.formatDocument') },
          { id: 'editor.comment', label: 'Toggle Line Comment', category: 'Editor', shortcut: 'Ctrl+/', action: () => triggerEditorAction('editor.action.commentLine') },
          { id: 'editor.goto', label: 'Go to Line...', category: 'Editor', shortcut: 'Ctrl+G', action: () => triggerEditorAction('editor.action.gotoLine') },
          { id: 'editor.fold', label: 'Fold All', category: 'Editor', action: () => triggerEditorAction('editor.foldAll') },
          { id: 'editor.unfold', label: 'Unfold All', category: 'Editor', action: () => triggerEditorAction('editor.unfoldAll') },
          { id: 'view.terminal', label: 'Toggle Terminal', category: 'View', shortcut: 'Ctrl+`', action: () => setTerminalOpen(p => !p) },
          { id: 'view.sidebar', label: 'Toggle Sidebar', category: 'View', action: () => setSidebarOpen(p => !p) },
          { id: 'view.zen', label: 'Toggle Zen Mode', category: 'View', shortcut: 'F11', action: () => setZenMode(z => !z) },
          { id: 'view.split', label: 'Split Editor', category: 'View', shortcut: 'Ctrl+\\', action: () => setSplitMode(s => s ? null : 'vertical') },
          { id: 'view.diff', label: 'Toggle Diff Editor', category: 'View', action: () => setDiffMode(d => !d) },
          { id: 'panel.explorer', label: 'Show Explorer', category: 'View', shortcut: 'Ctrl+Shift+E', action: () => { setActivePanel('explorer'); setSidebarOpen(true); } },
          { id: 'panel.search', label: 'Show Search', category: 'View', shortcut: 'Ctrl+Shift+F', action: () => { setActivePanel('search'); setSidebarOpen(true); } },
          { id: 'panel.git', label: 'Show Source Control', category: 'View', shortcut: 'Ctrl+Shift+G', action: () => { setActivePanel('git'); setSidebarOpen(true); } },
          { id: 'panel.ai', label: 'Show AI Chat', category: 'View', shortcut: 'Ctrl+Alt+I', action: () => setShowChatPanel(true) },
          { id: 'git.commit', label: 'Git: Commit All', category: 'Git', action: handleGitCommit },
          { id: 'git.push', label: 'Git: Push', category: 'Git', action: handleGitPush },
          { id: 'git.pull', label: 'Git: Pull', category: 'Git', action: handleGitPull },
          { id: 'git.fetch', label: 'Git: Fetch', category: 'Git', action: handleGitFetch },
          { id: 'settings.open', label: 'Open Settings', category: 'Preferences', shortcut: 'Ctrl+,', action: () => setSettingsOpen(true) },
          { id: 'ai.models', label: 'Open Models Hub', category: 'AI', action: openModelsHub },
          { id: 'system.logout', label: 'Log Out', category: 'System', action: () => { localStorage.removeItem('imhotep_google_auth'); setIsLoggedIn(false); } },
        ]}
      />

      {/* Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={editorSettings}
        onChange={updateEditorSetting}
        onLogout={() => { localStorage.removeItem('imhotep_google_auth'); setIsLoggedIn(false); setSettingsOpen(false); }}
      />

      {/* Toast Notifications */}
      <div className="fixed bottom-8 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
        {notifications.map(n => (
          <div
            key={n.id}
            className="flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl pointer-events-auto text-[12px]"
            style={{
              background: n.type === 'error' ? '#2d1a1a' : n.type === 'success' ? '#1a2d1a' : n.type === 'warning' ? '#2d2a1a' : '#1a1c24',
              border: `1px solid ${n.type === 'error' ? 'rgba(244,135,113,0.3)' : n.type === 'success' ? 'rgba(0,230,153,0.3)' : n.type === 'warning' ? 'rgba(204,167,0,0.3)' : 'rgba(255,255,255,0.1)'}`,
              color: n.type === 'error' ? '#f48771' : n.type === 'success' ? '#00e699' : n.type === 'warning' ? '#cca700' : '#cccccc',
              animation: 'slideInRight 0.2s ease-out',
            }}
          >
            <span>{n.message}</span>
          </div>
        ))}
      </div>

      {/* Zen Mode Overlay (hide everything except editor) */}
      {zenMode && (
        <div
          className="fixed inset-0 z-[9990] bg-[#1e1e1e] flex items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget) setZenMode(false); }}
        >
          <div className="w-full h-full">
            {fileContent !== null ? (
              <Editor
                key={activeTab}
                height="100%"
                theme="vs-dark"
                language={extLang(activeTab) || "javascript"}
                defaultValue={activeTabState?.content || ""}
                onChange={(val) => handleEditorChange(val || "")}
                onMount={(editor) => { editorRef.current = editor; }}
                options={{
                  fontFamily: editorSettings.fontFamily,
                  fontSize: editorSettings.fontSize + 1,
                  minimap: { enabled: false },
                  lineNumbers: editorSettings.lineNumbers,
                  wordWrap: editorSettings.wordWrap,
                  lineHeight: 26,
                  padding: { top: 48, bottom: 48 },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: editorSettings.cursorBlinking,
                  renderLineHighlight: 'all',
                  guides: { indentation: true },
                }}
              />
            ) : <div className="flex items-center justify-center h-full text-[#6b6b80]">No file open. Press Escape to exit Zen Mode.</div>}
          </div>
          <button
            className="absolute top-4 right-4 text-[11px] text-[#6b6b80] hover:text-white px-3 py-1.5 rounded transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={() => setZenMode(false)}
          >Exit Zen (F11)</button>
        </div>
      )}




    </div>
  );
}





















