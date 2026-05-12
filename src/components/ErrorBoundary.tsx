import React, { Component, ErrorInfo } from "react";

interface Props { children: React.ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          position:       "fixed",
          inset:          0,
          background:     "#0a0a0a",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          gap:            16,
          color:          "#e4e6eb",
          fontFamily:     "'Segoe UI', system-ui, sans-serif",
          padding:        32,
          textAlign:      "center",
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Something went wrong</h2>
        <p style={{ fontSize: 13, color: "#888", margin: 0, maxWidth: 360 }}>
          {this.state.error?.message ?? "An unexpected error occurred in the renderer."}
        </p>
        <button
          onClick={() => this.setState({ hasError: false })}
          style={{
            marginTop:    8,
            padding:      "8px 20px",
            background:   "linear-gradient(135deg,#0099ff,#a033ff)",
            border:       "none",
            borderRadius: 8,
            color:        "#fff",
            fontWeight:   600,
            cursor:       "pointer",
            fontSize:     13,
          }}
        >
          Try again
        </button>
        <button
          onClick={() => window.electron.app.relaunch()}
          style={{
            padding:      "6px 16px",
            background:   "transparent",
            border:       "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            color:        "#888",
            cursor:       "pointer",
            fontSize:     12,
          }}
        >
          Restart app
        </button>
      </div>
    );
  }
}
