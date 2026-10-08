import React, { useState, useEffect, useRef } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  url: string;
};

export default function SimulatorPanel({ open, onClose, url }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const webviewRef = useRef<any>(null);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const isDragging = useRef(false);

  useEffect(() => {
    // Initial position
    if (panelRef.current) {
      panelRef.current.style.left = `${window.innerWidth - 420}px`;
      panelRef.current.style.top = `100px`;
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    
    // get current pos from style
    const style = window.getComputedStyle(panelRef.current!);
    const posX = parseInt(style.left || '0', 10);
    const posY = parseInt(style.top || '0', 10);

    dragStart.current = { x: e.clientX, y: e.clientY, posX, posY };
    
    // Disable pointer events on webview so it doesn't steal mouse moves
    if (webviewRef.current) {
      webviewRef.current.style.pointerEvents = 'none';
    }

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      if (panelRef.current) {
        panelRef.current.style.left = `${dragStart.current.posX + (ev.clientX - dragStart.current.x)}px`;
        panelRef.current.style.top = `${Math.max(0, dragStart.current.posY + (ev.clientY - dragStart.current.y))}px`;
      }
    };
    
    const handleMouseUp = () => {
      isDragging.current = false;
      if (webviewRef.current) {
        webviewRef.current.style.pointerEvents = 'auto';
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-[9999] flex flex-col overflow-hidden"
      style={{
        width: 330,
        height: 720,
        background: 'transparent',
        boxShadow: '0 30px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
        borderRadius: 42,
        fontFamily: 'Outfit, sans-serif'
      }}
    >
      {/* Title bar */}
      <div 
        onMouseDown={handleMouseDown}
        className="h-[38px] bg-[#1a1c24] flex items-center px-4 cursor-move shrink-0 border-b relative"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <div className="flex gap-2 z-10">
          <button onClick={onClose} className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff4444] transition-colors" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[12px] font-semibold text-[#888899]">iPhone 16 Pro · iOS 18.5</span>
        </div>
      </div>

      {/* iPhone Body */}
      <div className="flex-1 bg-black relative border-[14px] border-[#090a0c]" style={{ borderRadius: '0 0 42px 42px' }}>
        
        {/* Webview */}
        <div className="w-full h-full rounded-[28px] overflow-hidden relative">
          <webview 
            ref={webviewRef}
            id="run-webview" 
            src={url} 
            useragent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36" 
            style={{ width: "402px", height: "874px", border: "none", transform: "scale(0.7512)", transformOrigin: "top left" }} 
          />
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[130px] h-[4px] mix-blend-difference rounded-full z-50 pointer-events-none" style={{ background: "rgba(255,255,255,0.4)" }} />
      </div>
    </div>
  );
}
