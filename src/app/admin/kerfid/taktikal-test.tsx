"use client";

import { useState, useTransition } from "react";
import { testTaktikal } from "./actions";

type Result = Awaited<ReturnType<typeof testTaktikal>>;

export function TaktikalTest() {
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" className="btn sm" disabled={pending} onClick={() => start(async () => setRes(await testTaktikal()))}>
        {pending ? "Prófa…" : "Prófa tengingu"}
      </button>
      {res && (
        <p style={{ marginTop: 8, color: res.ok ? "var(--good)" : "var(--bad)" }}>
          {res.ok ? "Lyklarnir virka" : res.error}
          {"status" in res && res.status !== null && ` · ${res.status}`}
          {"ms" in res && res.ms > 0 && ` · ${res.ms} ms`}
          {"flows" in res && res.flows !== null && ` · ${res.flows} flæði`}
          {"flowKeyFound" in res && res.flowKeyFound === false && " · TAKTIKAL_FLOW_KEY fannst ekki meðal flæðanna"}
          {"base" in res && <span className="muted"> · {res.base.replace("https://", "")}</span>}
        </p>
      )}
    </div>
  );
}
