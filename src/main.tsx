
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  
  import { loader } from "@monaco-editor/react";
  import * as monaco from "monaco-editor";
  loader.config({ monaco });

  import React, { Component, ReactNode } from "react";

  class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: { children: ReactNode }) {
      super(props);
      this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }
    render() {
      if (this.state.hasError) {
        return (
          <div style={{ padding: 20, color: '#ff5f56', background: '#090a0d', height: '100vh', fontFamily: 'monospace' }}>
            <h2>Something went wrong.</h2>
            <pre>{this.state.error?.toString()}</pre>
            <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', background: '#252526', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginTop: 16 }}>Reload</button>
          </div>
        );
      }
      return this.props.children;
    }
  }

  createRoot(document.getElementById("root")!).render(<ErrorBoundary><App /></ErrorBoundary>);
  
window.addEventListener('error', e => { if (e.message === 'ResizeObserver loop completed with undelivered notifications.' || e.message === 'ResizeObserver loop limit exceeded') { e.stopImmediatePropagation(); } });


