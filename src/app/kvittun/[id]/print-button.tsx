"use client";

export function PrintButton() {
  return <button type="button" className="kv-btn" onClick={() => window.print()}>Prenta eða vista sem PDF</button>;
}
