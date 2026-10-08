import { useState } from "react";
type Problem = {
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  file: string;
  fullPath?: string;
  startLine: number;
  startColumn: number;
  source?: string;
};

type Props = {
  problems: Problem[];
  onGoTo: (file: string, line: number, col: number, fullPath?: string) => void;
  onAutoFix?: (p: Problem) => void;
};

const severityIcon = {
  error: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7.5" fill="#f48771" />
      <text x="8" y="12" textAnchor="middle" fontSize="10" fill="#000" fontWeight="bold">!</text>
    </svg>
  ),
  warning: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 1L15 14H1L8 1Z" fill="#cca700" />
      <text x="8" y="12" textAnchor="middle" fontSize="9" fill="#000" fontWeight="bold">!</text>
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7.5" fill="#75beff" />
      <text x="8" y="12" textAnchor="middle" fontSize="10" fill="#000" fontWeight="bold">i</text>
    </svg>
  ),
  hint: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7.5" fill="#eee8aa" />
      <text x="8" y="12" textAnchor="middle" fontSize="10" fill="#000">*</text>
    </svg>
  ),
};

export type { Problem };

export default function ProblemsPanel({ problems, onGoTo, onAutoFix }: Props) {
  const errors = problems.filter(p => p.severity === 'error');
  const warnings = problems.filter(p => p.severity === 'warning');
  const infos = problems.filter(p => p.severity === 'info' || p.severity === 'hint');

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#1e1e1e" }}>
      {/* Header counts */}
      <div className="flex items-center gap-4 px-3 h-8 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)", background: "#252526" }}>
        <div className="flex items-center gap-1 text-[11px] text-[#cccccc]">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7.5" fill="#f48771" /><text x="8" y="12" textAnchor="middle" fontSize="10" fill="#000" fontWeight="bold">!</text></svg>
          <span>{errors.length} errors</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-[#cccccc]">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1L15 14H1L8 1Z" fill="#cca700" /><text x="8" y="12" textAnchor="middle" fontSize="9" fill="#000" fontWeight="bold">!</text></svg>
          <span>{warnings.length} warnings</span>
        </div>
        {infos.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-[#cccccc]">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7.5" fill="#75beff" /><text x="8" y="12" textAnchor="middle" fontSize="10" fill="#000" fontWeight="bold">i</text></svg>
            <span>{infos.length} info</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {problems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3c3c3c" strokeWidth="1.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span className="text-[12px] text-[#6b6b80]">No problems detected</span>
          </div>
        ) : (
          problems.map((p, i) => (
            <div
              key={i}
              className="flex items-start gap-2 px-3 py-1.5 hover:bg-[#2a2d2e] border-b group relative"
              style={{ borderColor: "rgba(255,255,255,0.04)" }}
            >
              <div className="shrink-0 mt-0.5 cursor-pointer" onClick={() => onGoTo(p.file, p.startLine, p.startColumn, p.fullPath)}>
                {severityIcon[p.severity]}
              </div>
              <div className="flex flex-col flex-1 min-w-0 cursor-pointer" onClick={() => onGoTo(p.file, p.startLine, p.startColumn, p.fullPath)}>
                <span className="text-[12px] text-[#cccccc] leading-relaxed pr-24">{p.message}</span>
                <span className="text-[11px] text-[#6b6b80]">
                  {p.file} Ln {p.startLine}, Col {p.startColumn}
                  {p.source && <span className="ml-2 text-[#6b6b80]">({p.source})</span>}
                </span>
              </div>
              {onAutoFix && (p.severity === 'error' || p.severity === 'warning') && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAutoFix(p); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all duration-200"
                  style={{ background: "rgba(212,175,55,0.15)", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.3)" }}
                  title="Auto-Fix with AI"
                >
                  ⚡ Fix
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

