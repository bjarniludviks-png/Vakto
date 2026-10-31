// VAKTO AI — aðstoðarmaður stjórnenda og vaktstjóra (sami bakendi og á vefnum).
// Svarar spurningum með tölum úr kerfinu og undirbýr breytingar sem notandinn staðfestir.
// Fyrsta skipti: samþykki fyrir því að gögn fari til Anthropic (App Store 5.1.2(i)).
import React, { useEffect, useRef, useState } from "react";
import { View, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Keyboard, Platform, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChevronLeft, History, SquarePen, Send, Sparkles, Trash2, Check, X } from "lucide-react-native";
import { tr, trf } from "../src/lib/i18n";
import { Txt, Muted, Btn, Sheet, useToast } from "../src/components/ui";
import { AiAvatar } from "../src/components/ai-avatar";
import { isManager } from "../src/lib/api/ops";
import { colors, font, useTheme } from "../src/theme";
import { ask, execute, askEmployee, executeEmployee, listConversations, getConversation, deleteConversation, saveActionState, type AiMsg, type AiAction, type AiConversation } from "../src/lib/api/assistant";

const CONSENT_KEY = "@vakto-ai-consent";
// Starfsfólk (ekki stjórnendur) fær sína eigin VAKTO AI: eigin vaktir/tímar og hver getur tekið vakt.
const STAFF_CHIPS = ["Hvenær er ég á vakt næstu viku?", "Hvað hef ég unnið marga tíma í þessum mánuði?", "Hver getur tekið næstu vaktina mína?"];
const CHIPS = ["Hver er á vakt núna?", "Hvernig er laun % af veltu þessa vikuna?", "Berðu saman launakostnað og tíma í þessum mánuði og síðasta", "Hvaða beiðnir bíða afgreiðslu?"];
const STAGE: Record<string, string> = {
  think: "Hugsa…", read: "Sæki gögn…", week_planning_context: "Les vaktaplan, starfsfólk og beiðnir…", shifts: "Les vaktaplanið…",
  pending_requests: "Les beiðnir…", who_is_on_now: "Athuga hver er á vakt…", labor: "Reikna laun og tíma…", write: "Undirbý tillögu…", summary: "Skrifa samantekt…",
};
type Live = { stage: string; tool?: string; text: string; plan: number; actions: AiAction[] };

export default function VaktoAi() {
  useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const scroll = useRef<ScrollView>(null);
  const [consent, setConsent] = useState<boolean | null>(null);
  // null = óljóst enn; false = starfsmannahamur (/api/app/employee-ai)
  const [manager, setManager] = useState<boolean | null>(null);
  useEffect(() => { isManager().then(setManager).catch(() => setManager(false)); }, []);
  const staff = manager === false;
  const [msgs, setMsgs] = useState<AiMsg[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const [history, setHistory] = useState<AiConversation[] | null>(null);
  const [kbOpen, setKbOpen] = useState(false);

  useEffect(() => { AsyncStorage.getItem(CONSENT_KEY).then((v) => setConsent(v === "1")).catch(() => setConsent(false)); }, []);
  useEffect(() => {
    const subs = [
      Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKbOpen(true)),
      Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKbOpen(false)),
    ];
    return () => subs.forEach((x) => x.remove());
  }, []);

  async function send(q: string) {
    const content = q.trim();
    if (!content || busy) return;
    const next: AiMsg[] = [...msgs, { role: "user", content }];
    if (staff) {
      setMsgs(next); setText(""); setBusy(true); setLive({ stage: "think", text: "", plan: 0, actions: [] });
      const r = await askEmployee(next);
      setBusy(false); setLive(null);
      setMsgs([...next, r.ok ? { role: "assistant", content: r.reply ?? "", actions: (r.actions ?? []).map((a) => ({ ...a, state: "pending" as const })) } : { role: "assistant", content: r.error ?? tr("VAKTO AI gat ekki svarað núna. Reyndu aftur.") }]);
      return;
    }
    setMsgs(next); setText(""); setBusy(true);
    let lv: Live = { stage: "think", text: "", plan: 0, actions: [] };
    setLive(lv);
    const done = await ask(next, convId, (ev) => {
      if (ev.t === "stage") lv = { ...lv, stage: ev.stage, tool: ev.tool };
      else if (ev.t === "turn") lv = { ...lv, text: "" };
      else if (ev.t === "text") lv = { ...lv, text: lv.text + ev.d };
      else if (ev.t === "plan") lv = { ...lv, stage: "plan", plan: lv.plan + ev.add.length };
      else if (ev.t === "action") lv = { ...lv, actions: [...lv.actions, { ...ev.action, state: "pending" }] };
      else return;
      setLive(lv);
    });
    setBusy(false); setLive(null);
    if (!done.ok) { setMsgs([...next, { role: "assistant", content: done.error ?? tr("VAKTO AI gat ekki svarað núna. Reyndu aftur."), upgrade: !!done.limit?.canUpgrade }]); return; }
    if (done.conversationId) setConvId(done.conversationId);
    setMsgs([...next, { id: done.messageId, role: "assistant", content: done.reply ?? "", actions: (done.actions ?? []).map((a) => ({ ...a, state: "pending" })) }]);
  }

  function patch(mi: number, ai: number, p: Partial<AiAction>) {
    setMsgs((m) => m.map((x, i) => (i !== mi ? x : { ...x, actions: x.actions?.map((a, j) => (j === ai ? { ...a, ...p } : a)) })));
  }
  async function confirm(mi: number, ai: number) {
    const a = msgs[mi]?.actions?.[ai];
    if (!a || a.state !== "pending") return;
    patch(mi, ai, { state: "busy" });
    const r = staff ? await executeEmployee(a) : await execute(a);
    patch(mi, ai, r.ok ? { state: "done" } : { state: "error", error: r.error ?? tr("Tókst ekki") });
    if (staff) return; // starfsmannasamtöl eru ekki vistuð
    const id = msgs[mi]?.id;
    if (id) saveActionState(id, ai, r.ok ? "done" : "error").catch(() => {});
  }
  function cancel(mi: number, ai: number) {
    patch(mi, ai, { state: "cancelled" });
    const id = msgs[mi]?.id;
    if (id) saveActionState(id, ai, "cancelled").catch(() => {});
  }

  async function openHistory() { setHistory([]); setHistory(await listConversations()); }
  async function openConv(id: string) {
    setHistory(null);
    const m = await getConversation(id);
    if (!m.length) { toast(tr("Tókst ekki að opna samtalið")); return; }
    setMsgs(m); setConvId(id);
  }
  async function delConv(id: string) {
    setHistory((h) => h?.filter((c) => c.id !== id) ?? null);
    if (id === convId) { setMsgs([]); setConvId(null); }
    await deleteConversation(id);
  }

  const liveLabel = live ? (live.stage === "plan" ? trf("Set upp vaktir… {n}", live.plan) : tr(STAGE[live.tool ?? ""] ?? STAGE[live.stage] ?? STAGE.think)) : "";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.panel }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingTop: insets.top + 4, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.line2, backgroundColor: colors.panel }}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={tr("Til baka")} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}><ChevronLeft color={colors.brand} size={28} /></Pressable>
        <AiAvatar />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight="bold" size={15}>VAKTO AI</Txt>
          <Muted size={12}>{busy ? liveLabel : staff ? tr("Aðstoðarmaðurinn þinn") : tr("Aðstoðarmaður stjórnenda")}</Muted>
        </View>
        {staff ? null : <Pressable onPress={openHistory} hitSlop={8} accessibilityLabel={tr("Fyrri samtöl")} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}><History color={colors.brand} size={22} /></Pressable>}
        <Pressable onPress={() => { setMsgs([]); setConvId(null); }} disabled={busy} hitSlop={8} accessibilityLabel={tr("Nýtt samtal")} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}><SquarePen color={colors.brand} size={22} /></Pressable>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 14, gap: 12, flexGrow: 1 }}
        keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        {msgs.length === 0 ? (
          <View style={{ gap: 12 }}>
            <View style={{ backgroundColor: colors.panel, borderRadius: 16, borderWidth: 1, borderColor: colors.line2, padding: 14 }}>
              <Txt size={15}>{staff ? tr("Hæ! Ég get sagt þér hvenær þú ert á vakt, hvað þú hefur unnið og fundið hver getur tekið vakt fyrir þig.") : tr("Hæ! Ég get svarað spurningum um laun, tíma og vaktir og undirbúið breytingar sem þú staðfestir.")}</Txt>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(staff ? STAFF_CHIPS : CHIPS).map((c) => (
                <Pressable key={c} onPress={() => consent && send(tr(c))} style={({ pressed }) => ({ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}>
                  <Txt size={13} color={colors.ink2}>{tr(c)}</Txt>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        {msgs.map((m, i) => (
          <View key={i} style={{ gap: 8, alignItems: m.role === "user" ? "flex-end" : "stretch" }}>
            {m.content ? (
              m.role === "user"
                ? <View style={{ backgroundColor: colors.brand, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, maxWidth: "85%" }}><Txt size={15} color="#fff">{m.content}</Txt></View>
                : <View style={{ backgroundColor: colors.panel, borderRadius: 16, borderWidth: 1, borderColor: colors.line2, padding: 14 }}><Rich text={m.content} /></View>
            ) : null}
            {m.upgrade ? <Muted size={12.5}>{tr("Opnaðu Stillingar → Áskrift á vakto.is til að auka heimildina.")}</Muted> : null}
            {(m.actions ?? []).map((a, j) => <ActionCard key={j} a={a} onConfirm={() => confirm(i, j)} onCancel={() => cancel(i, j)} />)}
          </View>
        ))}
        {live ? (
          <View style={{ gap: 8 }}>
            {live.text ? <View style={{ backgroundColor: colors.panel, borderRadius: 16, borderWidth: 1, borderColor: colors.line2, padding: 14 }}><Rich text={live.text} /></View> : null}
            {live.actions.map((a, j) => <ActionCard key={j} a={a} />)}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Sparkles color={colors.brand} size={14} />
              <Muted size={13}>{liveLabel}</Muted>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingTop: 6, paddingBottom: kbOpen ? 8 : Math.max(8, insets.bottom), backgroundColor: colors.panel, borderTopWidth: 1, borderTopColor: colors.line2 }}>
        <TextInput
          value={text} onChangeText={setText} editable={!!consent} multiline
          placeholder={tr("Spyrðu VAKTO AI…")} placeholderTextColor={colors.ink3}
          style={{ flex: 1, maxHeight: 120, backgroundColor: colors.panel2, borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 16, fontFamily: font.regular, color: colors.ink }}
        />
        <Pressable onPress={() => send(text)} disabled={busy || !text.trim()} accessibilityLabel={tr("Senda")}
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: text.trim() && !busy ? colors.brand : colors.panel2, alignItems: "center", justifyContent: "center" }}>
          <Send color={text.trim() && !busy ? "#fff" : colors.ink3} size={19} />
        </Pressable>
      </View>

      <Sheet open={history !== null} onClose={() => setHistory(null)} title={tr("Fyrri samtöl")}>
        {history && history.length === 0 ? <Muted>{tr("Engin vistuð samtöl enn.")}</Muted> : null}
        {(history ?? []).map((c) => (
          <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line2 }}>
            <Pressable onPress={() => openConv(c.id)} style={{ flex: 1, minWidth: 0 }}>
              <Txt weight="semibold" numberOfLines={1}>{c.title}</Txt>
              <Muted size={12}>{(() => { const d = new Date(c.updated_at); return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`; })()}</Muted>
            </Pressable>
            <Pressable onPress={() => delConv(c.id)} hitSlop={8} accessibilityLabel={tr("Eyða")}><Trash2 color={colors.ink3} size={18} /></Pressable>
          </View>
        ))}
      </Sheet>

      <Sheet open={consent === false} onClose={() => router.back()} title="VAKTO AI">
        <View style={{ gap: 12 }}>
          <Txt size={15}>{tr("VAKTO AI notar gervigreind frá Anthropic (Claude) til að svara spurningum þínum.")}</Txt>
          <Muted>{tr("Þegar þú spyrð eru spurningin og gögn úr VAKTO sem þarf til að svara (t.d. vaktir, tímar, laun og nöfn starfsfólks) send til Anthropic. Anthropic notar þau ekki til að þjálfa líkön. Breytingar eru aldrei gerðar nema þú staðfestir þær.")}</Muted>
          <Pressable onPress={() => Linking.openURL("https://www.vakto.is/personuvernd")}><Txt weight="semibold" color={colors.brandDeep}>{tr("Persónuverndarstefna")}</Txt></Pressable>
          <Btn title={tr("Ég samþykki")} onPress={() => { AsyncStorage.setItem(CONSENT_KEY, "1").catch(() => {}); setConsent(true); }} />
          <Btn title={tr("Hætta við")} variant="ghost" onPress={() => router.back()} />
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

/** Tillaga: lýsing + Staðfesta/Hætta við (eða staða eftir að ákveðið var). */
function ActionCard({ a, onConfirm, onCancel }: { a: AiAction; onConfirm?: () => void; onCancel?: () => void }) {
  const shifts = a.tool === "plan_week" && Array.isArray(a.input?.shifts) ? (a.input.shifts as unknown[]).length : 0;
  const tone = a.state === "done" ? colors.good : a.state === "error" ? colors.bad : colors.brand;
  return (
    <View style={{ backgroundColor: colors.panel, borderRadius: 14, borderWidth: 1, borderColor: colors.line2, borderLeftWidth: 3, borderLeftColor: tone, padding: 12, gap: 10 }}>
      <Txt size={14} weight="semibold">{a.summary}</Txt>
      {shifts ? <Muted size={12.5}>{trf("{n} vaktir í tillögunni — skoðaðu planið í heild á vakto.is", shifts)}</Muted> : null}
      {a.state === "error" && a.error ? <Txt size={12.5} color={colors.bad}>{a.error}</Txt> : null}
      {a.state === "pending" && onConfirm ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Btn title={tr("Staðfesta")} size="sm" onPress={onConfirm} icon={<Check color="#fff" size={16} />} /></View>
          <View style={{ flex: 1 }}><Btn title={tr("Hætta við")} size="sm" variant="ghost" onPress={onCancel} icon={<X color={colors.ink} size={16} />} /></View>
        </View>
      ) : null}
      {a.state === "busy" ? <Muted size={12.5}>{tr("Framkvæmi…")}</Muted> : null}
      {a.state === "done" ? <Txt size={12.5} weight="semibold" color={colors.good}>{tr("Staðfest")}</Txt> : null}
      {a.state === "cancelled" ? <Muted size={12.5}>{tr("Hætt við")}</Muted> : null}
    </View>
  );
}

/** Einfalt markdown: **feitletrun**, punktalistar („- “) og fyrirsagnir („#“). */
function Rich({ text }: { text: string }) {
  return (
    <View style={{ gap: 4 }}>
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return <View key={i} style={{ height: 4 }} />;
        const bullet = /^[-*•]\s+/.test(t);
        const head = /^#{1,4}\s+/.test(t);
        const body = t.replace(/^[-*•]\s+/, "").replace(/^#{1,4}\s+/, "");
        const parts = body.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        const inner = parts.map((p, k) => (p.startsWith("**") && p.endsWith("**") ? <Txt key={k} weight="bold" size={15}>{p.slice(2, -2)}</Txt> : p));
        return bullet ? (
          <View key={i} style={{ flexDirection: "row", gap: 8, paddingLeft: 2 }}>
            <Txt size={15} color={colors.ink3}>•</Txt>
            <Txt size={15} style={{ flex: 1 }}>{inner}</Txt>
          </View>
        ) : <Txt key={i} size={15} weight={head ? "bold" : "regular"}>{inner}</Txt>;
      })}
    </View>
  );
}
