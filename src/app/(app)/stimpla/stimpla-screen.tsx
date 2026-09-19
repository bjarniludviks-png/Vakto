"use client";

// Stimpla — the employee's home screen. One job: clock in / out. Below the
// clock: today's tasks, the next shift, a contract waiting for signature and
// the company handbooks. Requests and pay live on /vaktir and /mitt.

import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { useLang } from "@/components/app/lang";
import { StaffCardModal, type StaffCardData } from "@/components/app/staff-card";
import type { StaffCard } from "@/lib/mycard.server";
import type { MyArea } from "../mitt-svaedi/my.server";
import { resolvePerms } from "@/lib/permissions";
import PushToggle from "@/components/app/push-toggle";
import { PhotoAvatar, PunchCard, NextShiftCard, TasksCard, ContractSignCard, CompanyDocsCard, NoEmployeeCard } from "../mitt-svaedi/parts";

export default function StimplaScreen({ card, my }: { card: StaffCard; my: MyArea }) {
  const { t } = useLang();
  const [photo, setPhoto] = useState<string | null>(card.photoUrl ?? null);
  const [showCard, setShowCard] = useState(false);
  const perms = card.perms ?? resolvePerms();
  const cardData: StaffCardData = { name: card.name, role: card.role, department: card.department, company: card.company, photoUrl: photo ?? card.photoUrl, idCode: card.idCode, initials: card.initials, color: card.color, employeeKt: card.employeeKt, companyKt: card.companyKt };

  return (
    <>
      <PageHeader title={t("Stimpla")} subtitle={t("Stimplaðu þig inn og út — verkefni dagsins og næsta vakt")} />

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="cb" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <PhotoAvatar photo={photo} setPhoto={setPhoto} big={false} initials={card.initials} />
          <div style={{ flex: 1, minWidth: 0 }}><div className="emp-nm">{card.name}</div><div className="emp-meta">{t(card.role)} · {card.company}</div></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <PushToggle />
            {perms.card && <button className="btn ghost sm" style={{ minHeight: 40 }} onClick={() => setShowCard(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 5 }}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M14 9h4M14 13h4M5 16h7" /></svg>{t("Skírteini")}
            </button>}
          </div>
        </div>
      </div>

      {!my.live ? <NoEmployeeCard /> : (
        <div className="emp-pane on">
          {perms.clock && <PunchCard openSince={my.openSince} />}
          <TasksCard initial={my.tasks} />
          <NextShiftCard my={my} />
          <ContractSignCard />
          <CompanyDocsCard />
        </div>
      )}

      {showCard && <StaffCardModal card={cardData} onClose={() => setShowCard(false)} />}
    </>
  );
}
