import { useState, useEffect } from "react";

type SymbolItem = {
  name: string;
  kind: number;
  startLine: number;
  children?: SymbolItem[];
};

function kindIcon(kind: number) {
  // Monaco SymbolKind values
  const icons: Record<number, { icon: string; color: string }> = {
    5: { icon: "C", color: "#4EC9B0" },   // Class
    11: { icon: "f", color: "#DCDCAA" },  // Function
    12: { icon: "v", color: "#9CDCFE" },  // Variable
    13: { icon: "v", color: "#9CDCFE" },  // Constant
    6: { icon: "m", color: "#DCDCAA" },   // Method
    7: { icon: "p", color: "#9CDCFE" },   // Property
    8: { icon: "f", color: "#CE9178" },   // Field
    9: { icon: "c", color: "#4EC9B0" },   // Constructor
    10: { icon: "e", color: "#4EC9B0" },  // Enum
    14: { icon: "s", color: "#4EC9B0" },  // String
    15: { icon: "n", color: "#B5CEA8" },  // Number
    16: { icon: "b", color: "#569CD6" },  // Boolean
    22: { icon: "S", color: "#CE9178" },  // Struct
    23: { icon: "E", color: "#4EC9B0" },  // Event
    25: { icon: "T", color: "#4EC9B0" },  // TypeParameter
  };
  return icons[kind] || { icon: "o", color: "#cccccc" };
}

function SymbolRow({ item, depth, onGoto }: { item: SymbolItem; depth: number; onGoto: (line: number) => void }) {
  const [open, setOpen] = useState(true);
  const { icon, color } = kindIcon(item.kind);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1 py-[2px] px-2 cursor-pointer hover:bg-[#2a2d2e] group"
        style={{ paddingLeft: depth * 14 + 8 }}
        onClick={() => { if (hasChildren) setOpen(o => !o); else onGoto(item.startLine); }}
      >
        {hasChildren ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 text-[#cccccc]">
            {open
              ? <polyline points="2,3 5,7 8,3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              : <polyline points="3,2 7,5 3,8" stroke="currentColor" strokeWidth="1.5" fill="none"/>}
          </svg>
        ) : <span style={{ width: 10, display: "inline-block" }} />}
        <span className="text-[11px] font-bold px-0.5 rounded" style={{ color, fontFamily: "monospace", fontSize: 10 }}>{icon}</span>
        <span
          className="text-[12px] truncate flex-1 text-[#cccccc] group-hover:text-white"
          onClick={e => { e.stopPropagation(); onGoto(item.startLine); }}
        >
          {item.name}
        </span>
      </div>
      {hasChildren && open && item.children!.map((child, i) => (
        <SymbolRow key={i} item={child} depth={depth + 1} onGoto={onGoto} />
      ))}
    </div>
  );
}

type Props = {
  code: string;
  language: string;
  onGoToLine: (line: number) => void;
};

export default function OutlinePanel({ code, language, onGoToLine }: Props) {
  const [symbols, setSymbols] = useState<SymbolItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);

    const worker = async () => {
      try {
        const text = code;
        const lines = text.split('\n');
        const found: SymbolItem[] = [];
        const fnRegex = /^\s*(export\s+)?(default\s+)?(async\s+)?function\s+(\w+)/;
        const classRegex = /^\s*(export\s+)?(default\s+)?class\s+(\w+)/;
        const constFnRegex = /^\s*(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(/;
        const arrowRegex = /^\s*(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(.*\)\s*=>/;
        const tsInterfaceRegex = /^\s*(export\s+)?interface\s+(\w+)/;
        const tsTypeRegex = /^\s*(export\s+)?type\s+(\w+)\s*=/;
        const tsEnumRegex = /^\s*(export\s+)?enum\s+(\w+)/;

        lines.forEach((line, i) => {
          let m;
          if ((m = line.match(classRegex))) {
            found.push({ name: m[3] || m[2] || 'Class', kind: 5, startLine: i + 1 });
          } else if ((m = line.match(fnRegex))) {
            found.push({ name: m[4], kind: 11, startLine: i + 1 });
          } else if ((m = line.match(tsInterfaceRegex))) {
            found.push({ name: m[2], kind: 22, startLine: i + 1 });
          } else if ((m = line.match(tsEnumRegex))) {
            found.push({ name: m[2], kind: 10, startLine: i + 1 });
          } else if ((m = line.match(tsTypeRegex))) {
            found.push({ name: m[2], kind: 25, startLine: i + 1 });
          } else if ((m = line.match(arrowRegex)) || (m = line.match(constFnRegex))) {
            found.push({ name: m[2], kind: 11, startLine: i + 1 });
          }
        });
        setSymbols(found);
      } catch (e) {
        setSymbols([]);
      } finally {
        setLoading(false);
      }
    };

    const t = setTimeout(worker, 300);
    return () => clearTimeout(t);
  }, [code, language]);

  const gotoLine = (line: number) => {
    onGoToLine(line);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b text-[10px] uppercase tracking-widest text-[#6b6b80]" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        Outline
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {loading ? (
          <div className="text-[11px] text-[#6b6b80] px-3 py-4">Parsing...</div>
        ) : symbols.length === 0 ? (
          <div className="text-[11px] text-[#6b6b80] px-3 py-4">No symbols found</div>
        ) : (
          symbols.map((s, i) => <SymbolRow key={i} item={s} depth={0} onGoto={gotoLine} />)
        )}
      </div>
    </div>
  );
}

