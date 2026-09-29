// Ráðningarsamningur — sýnir nýjasta sendan/undirritaðan samning.
import React, { useCallback, useEffect, useState } from "react";
import { useTheme } from "../src/theme";
import { View, TextInput, Pressable } from "react-native";
import { Check } from "lucide-react-native";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Pill, Btn, useToast } from "../src/components/ui";
import { inputStyle } from "../src/components/request-sheets";
import { colors } from "../src/theme";
import { useMe } from "../src/lib/me-context";
import { getMyContract, requestContractCode, signContract, type Contract } from "../src/lib/api/docs";
import { tr } from "../src/lib/i18n";
import { parseContract, splitLang } from "../src/lib/contract";


export default function Samningur() {
  useTheme();
  const { me } = useMe();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function sendCode() {
    if (!contract) return;
    setBusy(true);
    const r = await requestContractCode(contract.id);
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Tókst ekki að senda kóða"); return; }
    setSentTo(r.sentTo ?? "");
    setCode("");
  }
  async function sign() {
    if (!contract) return;
    setBusy(true);
    const r = await signContract(contract.id, code);
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Tókst ekki að undirrita"); return; }
    toast("Samningurinn er undirritaður — afrit er sent á netfangið þitt.");
    setSentTo(null);
    load();
  }

  const load = useCallback(async () => {
    if (!me) return;
    setContract(await getMyContract(me));
    setLoaded(true);
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen title="Ráðningarsamningur" back>
      {loaded && !contract ? (
        <Card>
          <Muted>Enginn samningur hefur verið sendur á þig ennþá.</Muted>
        </Card>
      ) : null}
      {contract ? (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Txt weight="semibold" size={16}>
              {contract.title}
            </Txt>
            <Pill
              label={contract.status === "signed" ? "Undirritaður" : "Bíður undirritunar"}
              tone={contract.status === "signed" ? "good" : "warn"}
            />
          </View>
          {contract.signedAt ? <Muted size={12}>Undirritað {contract.signedAt.slice(0, 10)}</Muted> : null}
          <ContractBody content={contract.content} />
          {contract.status !== "signed" && sentTo == null ? (
            <View style={{ gap: 12, paddingTop: 4 }}>
              <Pressable onPress={() => setAgreed((a) => !a)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: agreed ? colors.brand : colors.line, backgroundColor: agreed ? colors.brand : "transparent", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                  {agreed ? <Check color="#fff" size={15} strokeWidth={3} /> : null}
                </View>
                <Txt size={13} style={{ flex: 1, lineHeight: 19 }}>{tr("Ég hef lesið samninginn og samþykki hann. Ég staðfesti með kóða sem sendur er á netfangið mitt.")}</Txt>
              </Pressable>
              <Btn title="Senda mér kóða" disabled={!agreed || busy} loading={busy} onPress={sendCode} />
            </View>
          ) : null}
          {contract.status !== "signed" && sentTo != null ? (
            <View style={{ gap: 12, paddingTop: 4 }}>
              <Txt size={13}>{tr("Kóði var sendur á")} {sentTo}. {tr("Hann gildir í 10 mínútur.")}</Txt>
              <TextInput
                style={[inputStyle(), { fontSize: 26, letterSpacing: 8, textAlign: "center" }]}
                value={code} onChangeText={(v) => setCode(v.replace(/[^\d]/g, "").slice(0, 6))}
                keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" autoFocus
                placeholder="000000" placeholderTextColor={colors.ink3} maxLength={6}
              />
              <Btn title="Undirrita samninginn" disabled={code.length !== 6 || busy} loading={busy} onPress={sign} />
              <Btn title="Senda nýjan kóða" variant="ghost" disabled={busy} onPress={sendCode} />
              <Muted size={11.5}>{tr("Við undirritun er skráður tími, IP-tala, tæki og fingrafar samningsins. Báðir aðilar fá undirritað eintak sem PDF.")}</Muted>
            </View>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}

/** Samningurinn í sömu uppsetningu og PDF-ið: kaflar, tvítyngd heiti, gildi undir. */
function ContractBody({ content }: { content: string }) {
  const { sections } = parseContract(content);
  return (
    <View style={{ gap: 12 }}>
      {sections.filter((s) => s.rows.length || s.paras.length).map((sec, i) => {
        const [sIs, sEn] = splitLang(sec.title);
        return (
          <View key={i} style={{ borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: colors.line }}>
            {sec.title ? (
              <View style={{ backgroundColor: colors.brand, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Txt weight="bold" size={12.5} color="#fff">{sIs}</Txt>
                {sEn ? <Txt size={11} color="#ffe2c8" style={{ fontStyle: "italic" }}>{sEn}</Txt> : null}
              </View>
            ) : null}
            {sec.rows.map(([k, v], j) => {
              const [lIs, lEn] = splitLang(k);
              const blank = /^_{6,}$/.test(v.trim());
              const [vIs, vEn] = splitLang(blank ? "" : v || "—");
              return (
                <View key={j} style={{ paddingHorizontal: 10, paddingVertical: 7, borderTopWidth: j || sec.title ? 1 : 0, borderColor: colors.line, backgroundColor: blank ? "#fdf4e7" : "transparent" }}>
                  <Txt size={10.5} color={colors.ink2} weight="semibold">{lIs}{lEn ? <Txt size={10.5} color={colors.ink3} style={{ fontStyle: "italic" }}>{` · ${lEn}`}</Txt> : null}</Txt>
                  <Txt size={13.5} style={{ marginTop: 2 }}>{blank ? "—" : vIs}</Txt>
                  {vEn ? <Txt size={12} color={colors.ink3} style={{ fontStyle: "italic" }}>{vEn}</Txt> : null}
                </View>
              );
            })}
            {sec.paras.map((p, j) => {
              const [pIs, pEn] = splitLang(p);
              return (
                <View key={`p${j}`} style={{ paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.line }}>
                  <Txt size={12} style={{ lineHeight: 17 }}>{pIs}</Txt>
                  {pEn ? <Txt size={11.5} color={colors.ink3} style={{ fontStyle: "italic", lineHeight: 16, marginTop: 3 }}>{pEn}</Txt> : null}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
