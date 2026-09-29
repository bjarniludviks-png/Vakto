"use client";

// Ráðningarsamningur á skjá — sama uppsetning og PDF-ið (lib/contract-pdf.ts):
// appelsínugulir kaflatitlar, reitir með tvítyngdu heiti (IS feitletrað · EN skáletrað)
// og gildi undir, tveir reitir í röð þegar báðir eru stuttir. Auðir skyldureitir eru merktir.

import { parseContract, splitLang, pairFields } from "@/lib/contract-pdf";

/** Index → true when that field stands alone on its row (same pairing as the PDF). */
const aloneMap = (rows: [string, string][]) => { const m = new Set<number>(); let i = 0; for (const g of pairFields(rows)) { if (g.length === 1) m.add(i); i += g.length; } return m; };

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  const [lIs, lEn] = splitLang(label);
  const blank = /^_{6,}$/.test(value.trim());
  const [vIs, vEn] = splitLang(blank ? "" : value || "—");
  return (
    <div style={{
      gridColumn: full ? "1 / -1" : undefined, padding: "7px 10px", borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
      background: blank ? "#fdf4e7" : undefined, minWidth: 0,
    }}>
      <div style={{ fontSize: 10.5, lineHeight: 1.35, color: "var(--ink2)" }}>
        <b style={{ fontWeight: 650 }}>{lIs}</b>{lEn && <span style={{ fontStyle: "italic", color: "var(--ink3)" }}> · {lEn}</span>}
      </div>
      <div style={{ fontSize: 13, marginTop: 3, color: "var(--ink)", overflowWrap: "anywhere" }}>
        {blank ? <span style={{ color: "var(--warn)", fontSize: 12 }}>Vantar / Missing</span> : vIs}
        {vEn && <div style={{ fontStyle: "italic", fontSize: 12, color: "var(--ink3)" }}>{vEn}</div>}
      </div>
    </div>
  );
}

export function ContractView({ content }: { content: string }) {
  const { title, sections } = parseContract(content);
  const [tIs, tEn] = splitLang(title);
  return (
    <div>
      <div style={{ borderBottom: "2px solid var(--brand)", paddingBottom: 8, marginBottom: 14 }}>
        <div style={{ fontSize: 19, fontWeight: 700 }}>{tIs}</div>
        {tEn && <div style={{ fontSize: 12.5, fontStyle: "italic", color: "var(--ink3)" }}>{tEn}</div>}
      </div>
      {sections.filter((s) => s.rows.length || s.paras.length).map((sec, i) => {
        const [sIs, sEn] = splitLang(sec.title);
        return (
          <section key={i} style={{ marginBottom: 12 }}>
            {sec.title && (
              <div style={{ background: "var(--brand)", color: "#fff", padding: "4px 10px", fontSize: 12, fontWeight: 650, borderRadius: "6px 6px 0 0" }}>
                {sIs}{sEn && <span style={{ fontStyle: "italic", fontWeight: 500, opacity: 0.85 }}> / {sEn}</span>}
              </div>
            )}
            <div className="cview-grid" style={{ borderLeft: "1px solid var(--line)", borderTop: sec.title ? undefined : "1px solid var(--line)" }}>
              {(() => { const alone = aloneMap(sec.rows); return sec.rows.map(([k, v], j) => <Field key={j} label={k} value={v} full={alone.has(j)} />); })()}
              {sec.paras.map((p, j) => {
                const [pIs, pEn] = splitLang(p);
                return (
                  <div key={`p${j}`} style={{ gridColumn: "1 / -1", padding: "8px 10px", fontSize: 12, lineHeight: 1.5, borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
                    {pIs}
                    {pEn && <div style={{ fontStyle: "italic", color: "var(--ink3)", marginTop: 3 }}>{pEn}</div>}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Samningur aftur í geymslusnið (markdown) — sama snið og contractMarkdown skrifar. */
function serialize(title: string, sections: { title: string; rows: [string, string][]; paras: string[] }[]): string {
  let out = `# ${title}\n`;
  for (const s of sections) {
    out += `\n## ${s.title}\n`;
    for (const [k, v] of s.rows) out += `**${k}:** ${v}\n\n`;
    for (const p of s.paras) out += `${p}\n\n`;
  }
  return out + "\n_Undirritun / Signatures:_\n\nVinnuveitandi: ______________________　Dags: ________\n\nStarfsmaður: ______________________　Dags: ________\n";
}

/** Drög: sama útlit og ContractView en hver reitur er innsláttarreitur. */
export function ContractEditor({ content, onChange }: { content: string; onChange: (md: string) => void }) {
  const { title, sections } = parseContract(content);
  const [tIs, tEn] = splitLang(title);
  const set = (si: number, ri: number, v: string) => {
    const next = sections.map((s, i) => i !== si ? s : { ...s, rows: s.rows.map((r, j) => (j === ri ? [r[0], v] as [string, string] : r)) });
    onChange(serialize(title, next));
  };
  const setPara = (si: number, pi: number, v: string) => {
    const next = sections.map((s, i) => i !== si ? s : { ...s, paras: s.paras.map((p, j) => (j === pi ? v.replace(/\n+/g, " ") : p)) });
    onChange(serialize(title, next));
  };
  const input: React.CSSProperties = { width: "100%", border: "1px solid var(--line)", borderRadius: 7, padding: "5px 8px", font: "inherit", fontSize: 13, marginTop: 4, background: "#fff" };
  return (
    <div>
      <div style={{ borderBottom: "2px solid var(--brand)", paddingBottom: 8, marginBottom: 14 }}>
        <div style={{ fontSize: 19, fontWeight: 700 }}>{tIs}</div>
        {tEn && <div style={{ fontSize: 12.5, fontStyle: "italic", color: "var(--ink3)" }}>{tEn}</div>}
      </div>
      {sections.map((sec, si) => {
        if (!sec.rows.length && !sec.paras.length) return null;
        const [sIs, sEn] = splitLang(sec.title);
        return (
          <section key={si} style={{ marginBottom: 12 }}>
            {sec.title && (
              <div style={{ background: "var(--brand)", color: "#fff", padding: "4px 10px", fontSize: 12, fontWeight: 650, borderRadius: "6px 6px 0 0" }}>
                {sIs}{sEn && <span style={{ fontStyle: "italic", fontWeight: 500, opacity: 0.85 }}> / {sEn}</span>}
              </div>
            )}
            <div className="cview-grid" style={{ borderLeft: "1px solid var(--line)" }}>
              {sec.rows.map(([k, v], ri) => {
                const alone = aloneMap(sec.rows).has(ri);
                const [lIs, lEn] = splitLang(k);
                const blank = /^_{6,}$/.test(v.trim()) || !v.trim();
                return (
                  <label key={ri} style={{ gridColumn: alone ? "1 / -1" : undefined, padding: "7px 10px", borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: blank ? "#fdf4e7" : undefined, minWidth: 0, display: "block" }}>
                    <div style={{ fontSize: 10.5, lineHeight: 1.35, color: "var(--ink2)" }}>
                      <b style={{ fontWeight: 650 }}>{lIs}</b>{lEn && <span style={{ fontStyle: "italic", color: "var(--ink3)" }}> · {lEn}</span>}
                    </div>
                    <input style={input} value={/^_{6,}$/.test(v.trim()) ? "" : v} placeholder={blank ? "Vantar — fylltu út / Missing" : ""}
                      onChange={(e) => set(si, ri, e.target.value.trim() ? e.target.value : "____________")} />
                  </label>
                );
              })}
              {sec.paras.map((p, pi) => (
                <div key={`p${pi}`} style={{ gridColumn: "1 / -1", padding: "8px 10px", borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
                  <textarea className="lf-ta" rows={3} style={{ ...input, fontSize: 12.5, lineHeight: 1.5 }} value={p} onChange={(e) => setPara(si, pi, e.target.value)} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
