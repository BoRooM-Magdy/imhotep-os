import React, { useState, useEffect } from "react";

export type AIModel = {
  id: string; name: string; provider: string; color: string;
  tier: "flagship" | "balanced" | "fast" | "specialized" | "standard";
  tags: string[]; context: string; desc: string;
  strengths: string[]; usedFor: string; badge?: string;
  type: "local" | "cloud" | "both";
  size?: string;
  params?: string;
  ramRequired?: number;
  vramRequired?: number;
  diskRequired?: number;
};

type Props = {
  favIds: Set<string>;
  onToggleFav: (id: string) => void;
  localModels: AIModel[];
  openRouterKey: string;
  setOpenRouterKey: (k: string) => void;
  googleKey?: string;
  setGoogleKey?: (k: string) => void;
  globalActiveModel: AIModel | null;
  onSelectModel: (m: AIModel) => void;
  staticModels: AIModel[];
};

export default function ModelsHub({ favIds, onToggleFav, localModels, openRouterKey, setOpenRouterKey, googleKey, setGoogleKey, globalActiveModel, onSelectModel, staticModels }: Props) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "local" | "cloud" | "both">("all");
  const [filterProviders, setFilterProviders] = useState<Set<string>>(new Set());
  const [sysSpecs, setSysSpecs] = useState<any>(null);
  
  const [viewingModel, setViewingModel] = useState<AIModel | null>(null);
    const [isScanning, setIsScanning] = useState(false);

    const handleScan = async () => {
      setIsScanning(true);
      if ((window as any).electronAPI?.startLocalServers) {
         try {
           await (window as any).electronAPI.startLocalServers();
           // Wait 2 seconds for servers to boot up before scanning
           await new Promise(r => setTimeout(r, 2000));
         } catch(e) {}
      }
      (window as any).imhotepScanLocal?.();
      setTimeout(() => setIsScanning(false), 1200);
    };

  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.getSystemSpecs) {
      electronAPI.getSystemSpecs().then((s: any) => setSysSpecs(s));
    }
  }, []);

  const combinedModels = [...localModels, ...staticModels];
  const providers = Array.from(new Set(combinedModels.map(m => m.provider))).sort();

  const toggleProvider = (p: string) => {
    const next = new Set(filterProviders);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setFilterProviders(next);
  };

  const filtered = combinedModels.filter(m => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.provider.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== "all" && m.type !== filterType) return false;
    if (filterProviders.size > 0 && !filterProviders.has(m.provider)) return false;
    return true;
  });

  const sysRAMGB = sysSpecs?.totalRAM ? sysSpecs.totalRAM / (1024 ** 3) : 0;
  const freeDiskGB = sysSpecs?.freeDisk ? sysSpecs.freeDisk / (1024 ** 3) : 0;
  
  let gpuName = "Unknown GPU";
  if (sysSpecs?.gpuInfo?.gpuDevice?.length > 0) {
    const dev = sysSpecs.gpuInfo.gpuDevice[0];
    gpuName = dev.vendorId === 4318 ? `NVIDIA GPU` : `GPU Device`; 
  }

  const isCompatible = (m: AIModel) => {
    if (m.type === "cloud") return true;
    if (!sysRAMGB) return true;
    return sysRAMGB >= (m.ramRequired || 0);
  };

  const checkIsDownloaded = (m: AIModel) => {
    if (m.type === 'cloud') return false;
    return localModels.some(lm => lm.id === m.id || lm.name === m.name);
  };

  const checkHasApiKey = (m: AIModel) => {
    if (m.provider === 'Google') return !!(googleKey && googleKey.trim().length > 0);
    return openRouterKey.trim().length > 0;
  };

  const compatibleCount = combinedModels.filter(isCompatible).length;

  return (
    <div className="flex h-full w-full bg-[#0d0e12] text-[#e2e2e2]" style={{ fontFamily: "Outfit, system-ui, sans-serif" }}>
      {/* Sidebar Filters */}
      <aside className="w-[240px] border-r flex flex-col h-full bg-[#090a0d] shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="px-6 py-6 flex items-center justify-between">
          <h2 className="text-white font-bold text-[15px]">Refine models</h2>
          <button onClick={() => { setFilterType("all"); setFilterProviders(new Set()); setSearch(""); }} className="text-[#D4AF37] text-[11px] font-bold hover:underline">Reset</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-8" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
          
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-[#6b6b80] font-bold mb-4">Type</h3>
            <div className="space-y-3">
              <label onClick={() => setFilterType("all")} className="flex items-center gap-3 text-[13px] cursor-pointer hover:text-white" style={{ color: filterType === "all" ? "#D4AF37" : "#8b8b99" }}><div className={`w-3 h-3 rounded-full border ${filterType === "all" ? 'bg-[#D4AF37] border-[#D4AF37]' : 'border-[#6b6b80]'}`}></div>All</label>
              <label onClick={() => setFilterType("local")} className="flex items-center gap-3 text-[13px] cursor-pointer hover:text-white" style={{ color: filterType === "local" ? "#D4AF37" : "#8b8b99" }}><div className={`w-3 h-3 rounded-full border ${filterType === "local" ? 'bg-[#D4AF37] border-[#D4AF37]' : 'border-[#6b6b80]'}`}></div>Local</label>
              <label onClick={() => setFilterType("cloud")} className="flex items-center gap-3 text-[13px] cursor-pointer hover:text-white" style={{ color: filterType === "cloud" ? "#D4AF37" : "#8b8b99" }}><div className={`w-3 h-3 rounded-full border ${filterType === "cloud" ? 'bg-[#D4AF37] border-[#D4AF37]' : 'border-[#6b6b80]'}`}></div>Cloud</label>
              
            </div>
          </div>

          <div className="pt-6 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <h3 className="text-[10px] uppercase tracking-wider text-[#6b6b80] font-bold mb-4">Provider</h3>
            <div className="space-y-3">
              {providers.map(p => (
                <label key={p} onClick={() => setFilterProviders(prev => { const next = new Set(prev); if (next.has(p)) next.delete(p); else next.add(p); return next; })} className="flex items-center gap-3 text-[13px] hover:text-white cursor-pointer" style={{ color: filterProviders.has(p) ? "#D4AF37" : "#8b8b99" }}><div className={`w-3 h-3 rounded-full border ${filterProviders.has(p) ? 'bg-[#D4AF37] border-[#D4AF37]' : 'border-[#6b6b80]'}`}></div>{p}</label>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Grid / Details */}
      <main className="flex-1 flex flex-col h-full bg-[#0d0e12] overflow-x-hidden overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
        {viewingModel ? (
          <div className="p-10 max-w-5xl mx-auto w-full">
            <div className="mb-6 flex items-center gap-2 text-[12px]">
              <button onClick={() => setViewingModel(null)} className="text-[#8b8b99] hover:text-white">All models</button>
              <span className="text-[#404040]">/</span>
              <span className="text-[#e2e2e2] font-medium">{viewingModel.name}</span>
            </div>
            
            <div className="flex items-start justify-between mb-8">
               <div className="flex items-center gap-5">
                 <div className="w-16 h-16 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center text-[#D4AF37] font-bold uppercase text-xl shrink-0 shadow-lg">
                   {viewingModel.name.substring(0,2)}
                 </div>
                 <div>
                   <h1 className="text-3xl font-bold text-white mb-2">{viewingModel.name}</h1>
                   <div className="flex items-center gap-3 text-[12px] text-[#8b8b99]">
                     <span>by <span className="text-white">{viewingModel.provider}</span></span>
                     <span className="bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded font-bold">{viewingModel.type === 'local' ? 'Local Only' : (viewingModel.type === 'cloud' ? 'Cloud Only' : 'Local + Cloud')}</span>
                     <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white">{viewingModel.tags[0] || 'AI'}</span>
                     <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white">{viewingModel.tier}</span>
                   </div>
                 </div>
               </div>
               <div className="text-right">
                 <div className="text-[#D4AF37] font-bold text-lg">★ 4.8</div>
                 <div className="text-[11px] text-[#8b8b99]">128 reviews</div>
               </div>
            </div>

            <div className="flex border-b border-white/10 mb-8">
              <button className="px-4 py-3 text-[13px] text-[#D4AF37] font-bold border-b-2 border-[#D4AF37]">Overview</button>
              <button className="px-4 py-3 text-[13px] text-[#8b8b99] hover:text-white">Requirements</button>
              <button className="px-4 py-3 text-[13px] text-[#8b8b99] hover:text-white">Versions</button>
              <button className="px-4 py-3 text-[13px] text-[#8b8b99] hover:text-white">Reviews</button>
            </div>

            <div className="mb-10">
              <h2 className="text-lg font-bold text-white mb-3">A powerful partner for your workflow.</h2>
              <p className="text-[14px] text-[#8b8b99] leading-relaxed mb-6 max-w-3xl">
                {viewingModel.desc || `${viewingModel.name} is an advanced AI model optimized for high performance. Run it locally to keep your data completely private and offline, or connect to the cloud API for maximum speed without using your hardware.`}
              </p>
              
              <div className="grid grid-cols-3 gap-4 mb-10">
                <div className="bg-[#121319] border border-white/5 p-5 rounded-lg">
                   <h3 className="text-white font-bold text-[13px] mb-1">Generate & refactor</h3>
                   <p className="text-[12px] text-[#8b8b99]">Turn ideas into clean, usable code.</p>
                </div>
                <div className="bg-[#121319] border border-white/5 p-5 rounded-lg">
                   <h3 className="text-white font-bold text-[13px] mb-1">Debug & explain</h3>
                   <p className="text-[12px] text-[#8b8b99]">Find errors and understand fixes.</p>
                </div>
                <div className="bg-[#121319] border border-white/5 p-5 rounded-lg">
                   <h3 className="text-white font-bold text-[13px] mb-1">Write tests</h3>
                   <p className="text-[12px] text-[#8b8b99]">Cover edge cases with useful tests.</p>
                </div>
              </div>
              
              {viewingModel.type !== 'cloud' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-bold text-[15px]">Choose a local version</h3>
                    <span className="text-[10px] text-[#8b8b99] uppercase tracking-wider">GGUF / {viewingModel.params}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-10">
                    <div className="border border-[#D4AF37] bg-[#D4AF37]/5 rounded-lg p-4 cursor-pointer relative">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border-[3px] border-[#D4AF37]"></div>
                          <span className="text-white font-bold text-[14px]">Q4</span>
                        </div>
                        <span className="text-white font-mono text-[12px]">{viewingModel.size || "4.7 GB"}</span>
                      </div>
                      <div className="text-[10px] text-[#8b8b99] font-mono mb-3">8 GB RAM / 6 GB VRAM / 6 GB DISK</div>
                      <div className="text-[11px] text-[#27c93f] font-medium">Runs great · Recommended</div>
                    </div>
                    
                    <div className="border border-white/10 bg-[#121319] hover:border-white/30 rounded-lg p-4 cursor-pointer transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border border-[#6b6b80]"></div>
                          <span className="text-white font-bold text-[14px]">Q8</span>
                        </div>
                        <span className="text-white font-mono text-[12px]">{(parseFloat(viewingModel.size || "4") * 1.8).toFixed(1)} GB</span>
                      </div>
                      <div className="text-[10px] text-[#8b8b99] font-mono mb-3">16 GB RAM / 10 GB VRAM / 10 GB DISK</div>
                      <div className="text-[11px] text-[#f48771] font-medium">Runs slowly · CPU offload</div>
                    </div>
                    
                    <div className="border border-white/10 bg-[#121319] hover:border-white/30 rounded-lg p-4 cursor-pointer transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border border-[#6b6b80]"></div>
                          <span className="text-white font-bold text-[14px]">FP16</span>
                        </div>
                        <span className="text-white font-mono text-[12px]">{(parseFloat(viewingModel.size || "4") * 3.1).toFixed(1)} GB</span>
                      </div>
                      <div className="text-[10px] text-[#8b8b99] font-mono mb-3">32 GB RAM / 16 GB VRAM / 18 GB DISK</div>
                      <div className="text-[11px] text-[#f48771] font-medium">Runs slowly · CPU offload</div>
                    </div>
                  </div>
                  
                  {/* Requirements vs Device */}
                  <div className="border border-white/10 bg-[#121319] rounded-lg overflow-hidden mb-10">
                     <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
                        <h3 className="text-white font-bold text-[14px]">Requirements vs. My Device</h3>
                        <span className="text-[#D4AF37] text-[10px] uppercase font-bold border border-[#D4AF37]/30 px-2 py-1 rounded">Q4 SELECTED</span>
                     </div>
                     <table className="w-full text-left border-collapse">
                        <thead>
                          <tr>
                            <th className="p-4 text-[10px] text-[#6b6b80] uppercase tracking-wider font-medium w-1/4">Resource</th>
                            <th className="p-4 text-[10px] text-[#6b6b80] uppercase tracking-wider font-medium w-1/4">Model Requires</th>
                            <th className="p-4 text-[10px] text-[#6b6b80] uppercase tracking-wider font-medium w-1/4">Your Device</th>
                            <th className="p-4 text-[10px] text-[#6b6b80] uppercase tracking-wider font-medium w-1/4">Check</th>
                          </tr>
                        </thead>
                        <tbody className="text-[12px]">
                          <tr className="border-t border-white/5">
                            <td className="p-4 text-white font-bold">RAM</td>
                            <td className="p-4 text-[#8b8b99] font-mono">{viewingModel.ramRequired || 8} GB minimum</td>
                            <td className="p-4 text-white font-mono">{sysRAMGB.toFixed(0)} GB</td>
                            <td className="p-4 text-[#27c93f] font-mono">{Math.max(0, sysRAMGB - (viewingModel.ramRequired || 8)).toFixed(0)} GB headroom</td>
                          </tr>
                          <tr className="border-t border-white/5">
                            <td className="p-4 text-white font-bold">VRAM</td>
                            <td className="p-4 text-[#8b8b99] font-mono">{viewingModel.vramRequired || 6} GB minimum</td>
                            <td className="p-4 text-white font-mono">8 GB</td>
                            <td className="p-4 text-[#27c93f] font-mono">2 GB headroom</td>
                          </tr>
                          <tr className="border-t border-white/5">
                            <td className="p-4 text-white font-bold">Storage</td>
                            <td className="p-4 text-[#8b8b99] font-mono">{viewingModel.diskRequired || 6} GB free</td>
                            <td className="p-4 text-white font-mono">{freeDiskGB.toFixed(0)} GB free</td>
                            <td className="p-4 text-[#27c93f] font-mono">{Math.max(0, freeDiskGB - (viewingModel.diskRequired || 6)).toFixed(0)} GB headroom</td>
                          </tr>
                        </tbody>
                     </table>
                     <div className="bg-[#12281a] p-4 text-[#27c93f] text-[13px] border-t border-[#1b3d27]">
                        <strong>Your device can run this model</strong>
                        <div className="text-[11px] mt-1 text-[#27c93f]/80">Q4 fits in your GPU memory. Higher-precision versions use slower CPU offload.</div>
                     </div>
                  </div>
                </>
              )}
              
              <div className="flex gap-8 border-t border-white/10 pt-8 mt-10">
                {viewingModel.type !== 'cloud' && (
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white font-bold text-[14px]">Run on your machine</h4>
                      <span className="text-[10px] text-[#8b8b99] font-mono">Q4 · {viewingModel.size || "4.7 GB"}</span>
                    </div>
                    {checkIsDownloaded(viewingModel) ? (
                      <button 
                        onClick={() => {
                          onSelectModel(viewingModel);
                        }}
                        className="w-full bg-[#D4AF37] text-black font-bold py-3 rounded hover:bg-[#ebd57d] transition-colors"
                      >
                        Set as Active Local Model
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          if ((window as any).__imhotep_openTerminal) (window as any).__imhotep_openTerminal();
                          setTimeout(() => (window as any).electronAPI?.writeTerminal(`ollama run ${viewingModel.id.replace('ollama/', '')}\r\n`), 500);
                        }}
                        className="w-full bg-[#D4AF37] text-black font-bold py-3 rounded hover:bg-[#ebd57d] transition-colors"
                      >
                        Download Q4
                      </button>
                    )}
                    <div className="text-[10px] text-[#6b6b80] mt-3">Private & offline · No API key required</div>
                  </div>
                )}
                
                {(viewingModel.type === 'cloud' || viewingModel.type === 'both') && (
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white font-bold text-[14px]">Connect through the cloud</h4>
                      <span className="text-[10px] text-[#8b8b99] font-mono uppercase tracking-wider">MANAGED API</span>
                    </div>
                    
                    {!checkHasApiKey(viewingModel) && (
                      <div className="mb-3">
                        <input 
                          type="password" 
                          value={openRouterKey}
                          onChange={e => setOpenRouterKey(e.target.value)}
                          placeholder="Paste your OpenRouter API Key here (sk-or-v1-...)"
                          className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-[13px] text-white outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    )}

                    {checkHasApiKey(viewingModel) ? (
                      <button 
                        onClick={() => {
                          onSelectModel(viewingModel);
                        }}
                        className="w-full bg-[#D4AF37] text-black font-bold py-3 rounded hover:bg-[#ebd57d] transition-colors"
                      >
                        Set as Active Cloud Model
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            (window as any).electronAPI?.openExternal('https://openrouter.ai/keys');
                          }}
                          className="flex-1 border border-white/20 bg-white/5 hover:bg-white/10 text-[#D4AF37] font-bold py-3 rounded transition-colors text-[13px]"
                        >
                          Get API Key
                        </button>
                      </div>
                    )}
                    <div className="text-[10px] text-[#6b6b80] mt-3">{viewingModel.provider} · Provider billing applies</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 max-w-7xl mx-auto w-full">
            {/* Top Search & Banner */}
            <div className="flex items-center justify-between mb-8">
               <div className="relative flex-1 max-w-xl">
                 <input 
                   type="text" 
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   placeholder="Search models (Llama, Qwen, Claude...)" 
                   className="w-full bg-transparent border border-white/10 rounded-md py-2 px-4 text-[13px] text-white placeholder:text-[#6b6b80] outline-none focus:border-[#D4AF37] transition-colors" 
                 />
                 <div className="absolute right-3 top-2 flex items-center gap-1 opacity-50">
                   <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white border border-white/10">⌘ K</span>
                 </div>
               </div>
               <button className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded text-[12px] font-medium transition-colors ml-4">
                 Filters
               </button>
            </div>

            <div className="mb-8">
              <div className="text-[10px] text-[#D4AF37] tracking-wider uppercase font-bold mb-2">DISCOVER / BUILD / RUN</div>
              <h1 className="text-3xl font-bold text-white mb-2">Find your next model.</h1>
              <p className="text-[#8b8b99] text-[13px] mb-6">Local privacy. Cloud power. One place to choose.</p>
              
              <div className="bg-[#12281a] border border-[#1b3d27] rounded-lg px-4 py-3 flex items-center justify-between text-[13px]">
                <span className="text-[#4ade80]">Built for your setup. {compatibleCount} models can run locally on this device.</span>
              </div>
            </div>

            {/* Grid Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <h2 className="text-white font-bold text-lg">All models</h2>
                <span className="bg-white/10 text-[#8b8b99] text-[11px] px-2 py-0.5 rounded font-bold">{filtered.length}</span>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                  <div className="text-lg font-bold text-white mb-2">No models in this combination.</div>
                  <div className="text-[#8b8b99] text-[13px] text-center max-w-sm mb-6">Try removing the filters, broadening your search, or exploring a local model.</div>
                  <div className="flex gap-4">
                    <button onClick={() => { setFilterType("all"); setFilterProviders(new Set()); setSearch(""); }} className="bg-[#252526] hover:bg-[#3c3c3c] text-white font-bold px-6 py-2 rounded text-[13px] transition-colors border border-white/10">Clear filters</button>
                    {filterType === 'local' && (
                      <button onClick={handleScan} disabled={isScanning} className="flex items-center gap-2 bg-[#D4AF37] hover:bg-[#ebd57d] text-black font-bold px-6 py-2 rounded text-[13px] transition-colors disabled:opacity-70 disabled:cursor-wait">
                        <svg className={isScanning ? "animate-spin" : ""} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                        {isScanning ? 'Scanning...' : 'Scan Local Models (Ollama/LM Studio)'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-5 pb-20">
                {filtered.map(m => {
                  const compat = isCompatible(m);
                  const isActive = globalActiveModel?.id === m.id;
                  const isDownloaded = checkIsDownloaded(m);
                  const hasApiKey = checkHasApiKey(m);
                  
                  return (
                    <div 
                      key={m.id} 
                      onClick={() => setViewingModel(m)}
                      className="bg-[#121319] border rounded-xl p-5 flex flex-col transition-all duration-200 cursor-pointer hover:-translate-y-0.5 group relative" 
                      style={{ borderColor: isActive ? "#D4AF37" : "rgba(255,255,255,0.08)", boxShadow: isActive ? "0 0 0 1px #D4AF37" : "none" }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center text-[#D4AF37] font-bold uppercase text-xs shrink-0 group-hover:border-[#D4AF37]/50 transition-colors">
                             {m.name.substring(0,2)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-white font-bold flex items-center gap-2 truncate text-[15px]">
                              {m.name} 
                              {favIds.has(m.id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="#D4AF37" stroke="#D4AF37" className="shrink-0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>}
                            </h3>
                            <div className="text-xs text-[#8b8b99] truncate">{m.provider}</div>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); onToggleFav(m.id); }} className="text-[#6b6b80] hover:text-[#D4AF37] shrink-0 ml-2 z-10 p-1">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill={favIds.has(m.id) ? "#D4AF37" : "none"} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        </button>
                      </div>
                      
                      <p className="text-[13px] text-[#8b8b99] mb-4 line-clamp-2 leading-relaxed">{m.desc || "A powerful AI model."}</p>
                      
                      <div className="flex gap-2 mb-5 flex-wrap">
                        <span className="text-[10px] uppercase font-bold text-[#D4AF37] border border-[#D4AF37] bg-transparent px-2 py-0.5 rounded shrink-0">{m.type === "local" ? "LOCAL" : (m.type === "cloud" ? "CLOUD" : "CLOUD + LOCAL")}</span>
                        {m.tags.slice(0, 2).map(t => (
                          <span key={t} className="text-[10px] text-[#8b8b99] border border-white/10 bg-transparent px-2 py-0.5 rounded shrink-0">{t}</span>
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-3 mb-3">
                        <div>
                          <div className="text-[9px] text-[#6b6b80] uppercase mb-1">SIZE</div>
                          <div className="text-[12px] text-white font-mono font-bold">{m.size || "N/A"}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-[#6b6b80] uppercase mb-1">PARAMS</div>
                          <div className="text-[12px] text-white font-mono font-bold">{m.params || "N/A"}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-[#6b6b80] uppercase mb-1">RAM</div>
                          <div className="text-[12px] text-white font-mono font-bold">{m.ramRequired ? m.ramRequired + " GB" : "N/A"}</div>
                        </div>
                      </div>
                      
                      <div className="text-[11px] mb-4 flex flex-col gap-1 font-medium text-[#8b8b99]">
                        <div className="flex items-center gap-1.5" style={{ color: m.type !== 'cloud' ? (isDownloaded ? '#27c93f' : '#8b8b99') : '#8b8b99' }}>
                           <div className={`w-1.5 h-1.5 rounded-full ${m.type !== 'cloud' && isDownloaded ? 'bg-[#27c93f]' : 'bg-[#6b6b80]'}`}></div>
                           {m.type === 'cloud' ? 'Cloud hosted model' : (isDownloaded ? 'Downloaded locally \u00b7 Ready' : 'Local capable \u00b7 Not downloaded')}
                        </div>
                        
                        <div className="flex items-center gap-1.5" style={{ color: m.type !== 'local' ? (hasApiKey ? '#27c93f' : '#8b8b99') : '#8b8b99' }}>
                           <div className={`w-1.5 h-1.5 rounded-full ${m.type !== 'local' && hasApiKey ? 'bg-[#27c93f]' : 'bg-[#6b6b80]'}`}></div>
                           {m.type === 'local' ? 'No API key needed' : (hasApiKey ? 'API Key configured \u00b7 Ready' : 'API Key required \u00b7 Not set')}
                        </div>
                      </div>
                      
                      <div className="mt-auto pt-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onSelectModel(m); }}
                          className={`w-full font-bold py-2 rounded text-[13px] transition-colors border ${isActive ? 'bg-[#D4AF37] border-[#D4AF37] text-black hover:bg-[#ebd57d]' : 'bg-transparent border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10'}`}
                        >
                          {isActive ? 'Active Model' : 'Use this Model'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Right Sidebar: Device Info */}
      <aside className="w-[280px] border-l flex flex-col h-full bg-[#121319] shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="px-6 py-8 overflow-y-auto custom-scrollbar h-full">
          <h2 className="text-white font-bold text-base mb-8">My Device</h2>
          
          <div className="space-y-7">
            <div>
              <div>
                  <div className="text-[9px] text-[#6b6b80] uppercase tracking-wider mb-1.5 font-bold">LOCAL MODELS</div>
                </div>
                <button onClick={handleScan} disabled={isScanning} className="w-full flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#ebd57d] text-black px-4 py-3 rounded text-[13px] font-bold uppercase transition-colors shadow-lg disabled:opacity-70 disabled:cursor-wait mb-6">
                  <svg className={isScanning ? "animate-spin" : ""} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                  {isScanning ? 'Scanning...' : 'Scan Local Models'}
                </button>
                <div className="h-px bg-white/10 mb-6"></div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[9px] text-[#6b6b80] uppercase tracking-wider mb-1.5 font-bold">SYSTEM SPECS</div>
                    <div className="text-[11px] text-[#8b8b99] font-mono">Real-time monitor</div>
                  </div>
                </div>
            </div>

            <div className="h-px bg-white/10"></div>

            <div>
              <div className="text-[9px] text-[#6b6b80] uppercase tracking-wider mb-1.5 font-bold">CPU</div>
              <div className="text-[13px] text-white font-medium mb-1 leading-tight break-words pr-2">{sysSpecs?.cpus?.[0]?.model || "Scanning..."}</div>
              <div className="text-[11px] text-[#8b8b99]">{sysSpecs?.cpus?.length || 0} logical cores</div>
            </div>

            <div>
              <div className="text-[9px] text-[#6b6b80] uppercase tracking-wider mb-1.5 font-bold">RAM</div>
              <div className="text-[13px] text-white font-medium mb-1">{sysRAMGB.toFixed(1)} GB</div>
              <div className="text-[11px] text-[#8b8b99]">System memory</div>
            </div>

            <div>
              <div className="text-[9px] text-[#6b6b80] uppercase tracking-wider mb-1.5 font-bold">GPU</div>
              <div className="text-[13px] text-white font-medium mb-1">{gpuName}</div>
              <div className="text-[11px] text-[#8b8b99]">VRAM info unavailable</div>
            </div>

            <div>
              <div className="text-[9px] text-[#6b6b80] uppercase tracking-wider mb-1.5 font-bold">FREE DISK</div>
              <div className="text-[13px] text-white font-medium mb-1">{freeDiskGB.toFixed(1)} GB</div>
              <div className="text-[11px] text-[#8b8b99]">Available space on SSD</div>
            </div>

            <div className="h-px bg-white/10"></div>

            <div>
              <div className="text-[12px] text-white mb-3">Models compatible with your device:</div>
              <div className="flex items-center justify-between text-[13px] font-bold text-[#27c93f] mb-3">
                {compatibleCount} of {combinedModels.length}
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-[#27c93f]" style={{ width: `${(compatibleCount / Math.max(1, combinedModels.length)) * 100}%` }}></div>
              </div>
              <a href="#" onClick={e => { e.preventDefault(); setFilterType('local'); }} className="text-[11px] text-[#D4AF37] hover:underline">Show compatible models →</a>
            </div>

            <div className="mt-8">
              <div className="text-[9px] text-[#6b6b80] uppercase tracking-wider mb-2 font-bold">OPENROUTER API KEY</div>
              <input 
                type="password" 
                value={openRouterKey}
                onChange={e => setOpenRouterKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-[12px] text-white outline-none focus:border-[#D4AF37] mb-2"
              />
              <a href="#" onClick={(e) => { e.preventDefault(); (window as any).electronAPI?.openExternal('https://openrouter.ai/keys'); }} className="text-[11px] text-[#D4AF37] hover:underline">Get API Key</a>
            </div>

          </div>
        </div>
      </aside>
    </div>
  );
}
