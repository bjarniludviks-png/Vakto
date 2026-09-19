"use client";

// Laun & spjall — the third employee screen: team chat, company news and my
// pay/rights/profile, as three tabs. Chat and news are the same components as
// /spjall and /frettaveita (push links still open those routes).

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { useLang } from "@/components/app/lang";
import { StaffCardModal, type StaffCardData } from "@/components/app/staff-card";
import type { StaffCard } from "@/lib/mycard.server";
import type { MyArea } from "../mitt-svaedi/my.server";
import { resolvePerms } from "@/lib/permissions";
import ChatScreen from "../spjall/chat-screen";
import FeedScreen from "../frettaveita/feed-screen";
import type { Conversation } from "../spjall/actions";
import { PayCard, MyHours, RightsCard, ProfileCard, NoEmployeeCard } from "../mitt-svaedi/parts";

type Tab = "spjall" | "frettir" | "laun";
const TABS: [Tab, string][] = [["spjall", "tab:spjall"], ["frettir", "Fréttir"], ["laun", "Laun & réttindi"]];

export default function MittScreen({ card, my, chatInitial }: { card: StaffCard; my: MyArea; chatInitial?: { ok: boolean; items: Conversation[]; meId: string } }) {
  const { t } = useLang();
  const router = useRouter();
  const sp = useSearchParams();
  const initialTab = (sp.get("tab") as Tab | null) ?? "spjall";
  const [tab, setTab] = useState<Tab>(TABS.some(([k]) => k === initialTab) ? initialTab : "spjall");
  const [photo, setPhoto] = useState<string | null>(card.photoUrl ?? null);
  const [showCard, setShowCard] = useState(false);
  const perms = card.perms ?? resolvePerms();
  const cardData: StaffCardData = { name: card.name, role: card.role, department: card.department, company: card.company, photoUrl: photo ?? card.photoUrl, idCode: card.idCode, initials: card.initials, color: card.color, employeeKt: card.employeeKt, companyKt: card.companyKt };

  // Keep the tab in the URL so back/forward and reload land on the same tab.
  useEffect(() => {
    const cur = sp.get("tab") ?? "spjall";
    if (cur !== tab) router.replace(`/mitt?tab=${tab}`, { scroll: false });
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleTabs = TABS.filter(([k]) => k !== "spjall" || perms.chat);

  return (
    <>
      {tab !== "spjall" && <PageHeader title={t("Laun & spjall")} subtitle={t("Spjall, fréttir, laun og réttindi")} />}
      <div className="settabs" style={tab === "spjall" ? { marginTop: 0 } : undefined}>
        {visibleTabs.map(([k, label]) => (
          <button key={k} className={`etab2${tab === k ? " on" : ""}`} style={{ minHeight: 44 }} onClick={() => setTab(k)}>{t(label)}</button>
        ))}
      </div>

      {tab === "spjall" && perms.chat && <ChatScreen initial={chatInitial} embedded />}
      {tab === "frettir" && <FeedScreen />}
      {tab === "laun" && (
        !my.live ? <NoEmployeeCard /> : (
          <div className="emp-pane on">
            {perms.pay && <PayCard my={my} />}
            {perms.shifts && <MyHours canRequest={perms.requests} />}
            <RightsCard my={my} />
            {perms.card && (
              <div className="mini" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div><div className="mh" style={{ marginBottom: 2 }}>{t("Starfsmannaskírteini")}</div><span className="muted" style={{ fontSize: 12.5 }}>{t("QR-kóði fyrir stimpilklukkuna og Wallet")}</span></div>
                <button className="btn sm" style={{ minHeight: 44 }} onClick={() => setShowCard(true)}>{t("Opna skírteini")}</button>
              </div>
            )}
            <ProfileCard photo={photo} setPhoto={setPhoto} my={my} initials={card.initials} />
          </div>
        )
      )}

      {showCard && <StaffCardModal card={cardData} onClose={() => setShowCard(false)} />}
    </>
  );
}
