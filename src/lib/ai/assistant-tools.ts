import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getDashboardPeriod } from "@/app/(app)/maelabord/actions";
import { getWhoIsOn } from "@/app/(app)/timaskraning/attendance.server";
import { fetchAttendance, setClockOut, getTimesheetIssues, adjustPunch, askForCorrection } from "@/app/(app)/timaskraning/actions";
import { getShiftsInRange, saveShift, deleteShift, updateLeaveRequest, approveShiftSwap, getWeekBudget, getWeekShifts, deleteWeekShifts, publishSchedule, createOpenShifts } from "@/app/(app)/vaktaplan/actions";
import { listContracts, resendContract } from "@/app/(app)/starfsfolk/actions";
import { getEmployees } from "@/lib/employees.server";
import { getPlanningHistory, historyForPrompt, historyRange } from "@/lib/ai/planning-history.server";
import { getCompanyId } from "@/lib/labor";
import { createClient } from "@/lib/supabase/server";
import { getPendingRequests } from "@/app/(app)/vaktaplan/requests.server";
import { comparePeriods, laborTrend, payrollRuns } from "./assistant-insights";
import { getPlanRequestsForMe, guardLeaveShifts } from "./plan-requests.server";
import { listAlerts, createAlert, setAlertActive, deleteAlert, sendReportNow } from "@/app/(app)/stillingar/alert-actions";
import { normalizeAlert, describeAlert, REPORTS, SCHEDULABLE_REPORTS, REPORT_TITLE, RANGES } from "@/lib/alerts";
import { getSickRate } from "@/lib/sickrate.server";
import { byDept, pctOf, SICK_DEFINITION } from "@/lib/sickrate";
import { getUpcomingLeavers } from "@/lib/terminations.server";
import { REASON_LABEL } from "@/lib/termination";
import { getPlanningRules } from "@/lib/planning-rules.server";
import { addPlanningRule, deletePlanningRule } from "@/app/(app)/vaktaplan/actions";
import { MAX_RULE_LEN } from "@/lib/planning-rules";

// VAKTO AI — verkfæri. LESverkfæri keyra strax (sömu aðgerðir og skjáirnir nota, sama aðgangsstýring).
// SKRIFverkfæri keyra ALDREI í líkaninu sjálfu: þau verða „tillaga" sem notandinn staðfestir með hnappi,
// og /api/assistant/execute framkvæmir hana eftir að hafa athugað innskráningu og hlutverk aftur.

const DATE = { type: "string", description: "YYYY-MM-DD" } as const;
const TIME = { type: "string", description: "HH:MM (24 klst.)" } as const;
const PERIOD = { type: "string", enum: ["week", "month", "payroll"], description: "week = mán–sun, month = almanaksmánuður, payroll = launatímabil fyrirtækisins" };
const CHANNEL = { type: "string", enum: ["email", "push", "both"], description: "Tölvupóstur (sjálfgefið), push-tilkynning eða bæði" };

export const READ_TOOLS: Anthropic.Tool[] = [
  {
    name: "labor_summary",
    description: "Laun sem % af veltu, velta, launakostnaður, unnir og áætlaðir tímar, frávik og kostnaður þess, yfirvinna og álag, og tölur per starfsmann, fyrir tímabil.",
    input_schema: { type: "object", properties: { from: DATE, to: DATE }, required: ["from", "to"] },
  },
  {
    name: "planning_history",
    description: "Saga vaktaplans: hvar var unnið meira eða minna en planað var — meðaltal per vikudag (planað/unnið klst. og velta), fjöldi á vakt eftir klukkustund per vikudag (planað/unnið), deildir, verstu dagarnir (og hverjir fóru yfir) og starfsfólk sem vinnur oftast umfram plan. Stimplanir yfir 14 klst. (gleymd útstimplun) eru ekki taldar. Notaðu ÁÐUR en þú setur upp viku eða mánuð, og þegar spurt er hvar/hvenær farið er yfir tíma. Sjálfgefið síðustu 8 heilu vikur; from/to fyrir annað tímabil (t.d. sama mánuð í fyrra).",
    input_schema: { type: "object", properties: { from: DATE, to: DATE, weeks: { type: "number", description: "Fjöldi heilla vikna aftur í tímann (4–26), sjálfgefið 8" } } },
  },
  {
    name: "staff_pay",
    description: "Launakjör starfsfólks: starfsheiti, deild, tímakaup eða mánaðarlaun, starfshlutfall, stéttarfélag, ráðningardagur og starfsaldur í árum (að meðtöldum fyrri starfsaldri). Notaðu þegar spurt er um laun tiltekins starfsmanns eða hvort laun séu í samræmi við kjarasamning. name síar á nafn (valfrjálst).",
    input_schema: { type: "object", properties: { name: { type: "string", description: "Nafn eða hluti nafns (valfrjálst)" } } },
  },
  {
    name: "who_is_on_now",
    description: "Hverjir eru stimplaðir inn núna (og síðan hvenær), og hverjir á plani dagsins hafa ekki mætt.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "staff_hours",
    description: "Áætlaðir og unnir tímar per starfsmann á tímabili, frávik og kostnaður.",
    input_schema: { type: "object", properties: { from: DATE, to: DATE }, required: ["from", "to"] },
  },
  {
    name: "shifts",
    description: "Vaktir á tímabili (nafn, deild, dagsetning, tímar, vaktategund). Notaðu til að skoða vaktaplan áður en þú leggur til breytingar.",
    input_schema: { type: "object", properties: { from: DATE, to: DATE }, required: ["from", "to"] },
  },
  {
    name: "pending_requests",
    description: "Opnar beiðnir starfsfólks: frí-beiðnir, vaktaskipti og óframboð, með auðkennum (id) sem þarf til að afgreiða þær.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "week_planning_context",
    description: "Allt sem þarf til að setja upp vaktaplan fyrir heila viku: starfsfólk (deild, starfshlutfall, tímakaup/föst laun), núverandi vaktir vikunnar, hverjir eru ekki tiltækir hvaða daga (óframboð), samþykkt frí (aldrei vakt þá daga), frí-beiðnir í bið, framboð/óskir starfsfólks og vaktaskipti í bið, vaktategundir með tímum, mönnunarþörf per dag og launaáætlun (veltuspá, launamarkmið, kostnaður per klst). Kallaðu á þetta ÁÐUR en þú notar plan_week.",
    input_schema: { type: "object", properties: { monday: { type: "string", description: "Mánudagur vikunnar, YYYY-MM-DD" } }, required: ["monday"] },
  },
  {
    name: "month_planning_context",
    description: "Sama og week_planning_context en fyrir heilan almanaksmánuð (month = YYYY-MM): starfsfólk, núverandi vaktir mánaðarins, óframboð, samþykkt frí, beiðnir, vaktategundir, mönnunarþörf, planreglur og launaáætlun per viku. Kallaðu á þetta ÁÐUR en þú notar plan_month.",
    input_schema: { type: "object", properties: { month: { type: "string", description: "YYYY-MM" } }, required: ["month"] },
  },
  {
    name: "timesheet_issues",
    description: "Frávik í tímaskráningu sem þarf að laga á tímabilinu: gleymd útstimplun (opin > 14 klst), of löng stimplun (> 14 klst) og liðnar vaktir án stimplunar, með punchId, áætlaðri vakt og tillögu (fix: close = loka á áætluðum lokum vaktar, ask = biðja starfsmann um réttan tíma). Notaðu fyrir „farðu yfir frávik“, „hver gleymdi að stimpla sig út?“.",
    input_schema: { type: "object", properties: { from: DATE, to: DATE }, required: ["from", "to"] },
  },
  {
    name: "planning_rules",
    description: "Vistaðar planreglur fyrirtækisins (fastar reglur fyrir vaktaplan, t.d. „Bach bara morgunvaktir“) með id, texta og hvort þær eru virkar. Virkar reglur fylgja líka week_planning_context (companyRules). Notaðu til að svara „hvaða reglur eru vistaðar?“ og áður en reglu er eytt.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "compare_periods",
    description: "Ber saman tvö tímabil: velta, launakostnaður, laun % af veltu, unnir og áætlaðir tímar, yfirvinna, álag, kostnaður per klst, fjöldi starfsmanna, með breytingu í kr og %. Líka per deild og per starfsmann (tímar og kostnaður á báðum tímabilum). compare: 'fyrra' (jafnlangt tímabil á undan), 'manudur' (sama tímabil í fyrri mánuði), 'ar' (sama tímabil í fyrra), 'sersnid' (þá compareFrom/compareTo). Notaðu fyrir „hvernig var október miðað við september“, „sama vika í fyrra“, „hver jók tímana mest“.",
    input_schema: {
      type: "object",
      properties: { from: DATE, to: DATE, compare: { type: "string", enum: ["fyrra", "manudur", "ar", "sersnid"] }, compareFrom: DATE, compareTo: DATE },
      required: ["from", "to"],
    },
  },
  {
    name: "labor_trend",
    description: "Þróun yfir tíma: velta, launakostnaður, laun %, tímar, yfirvinna og fjöldi starfsmanna per mánuð, viku eða dag á bilinu from–to (mest 24 bil). Notaðu fyrir „hvernig hefur launakostnaður þróast í ár“, „hvaða mánuður var dýrastur“, „laun % síðustu 8 vikur“.",
    input_schema: {
      type: "object",
      properties: { from: DATE, to: DATE, by: { type: "string", enum: ["month", "week", "day"] } },
      required: ["from", "to", "by"],
    },
  },
  {
    name: "payroll_runs",
    description: "Launakeyrslur sem hafa verið keyrðar (raunveruleg laun, ekki áætlun): tímabil, fjöldi, tímar, heildarlaun (brúttó), útborgað, staðgreiðsla, lífeyrir, orlof, tryggingagjald og heildarkostnaður launagreiðanda. Með employee fást línur þess starfsmanns í hverri keyrslu. Notaðu fyrir „hvað borguðum við í laun í september“, „hver var launakostnaður Önnu í ár“.",
    input_schema: {
      type: "object",
      properties: { from: DATE, to: DATE, employee: { type: "string", description: "Nafn starfsmanns (valfrjálst)" } },
      required: ["from", "to"],
    },
  },
  {
    name: "sick_rate",
    description: "Veikindahlutfall = veikindatímar ÷ áætlaðir vinnutímar (samþykktar veikindabeiðnir; tímar birtra vakta á veikindadögum, annars 8 klst. × starfshlutfall á virkum degi). Skilar hlutfalli, veikindatímum, áætluðum tímum, veikindadögum og tilvikum per tímabil (þróun), og skiptingu per deild og per starfsmann (aðeins þeir sem voru veikir). by: 'period' (launatímabil), 'month', 'quarter', 'year'; count = fjöldi tímabila aftur í tímann (sjálfgefið 12/12/8/4). Notaðu fyrir „hvert er veikindahlutfallið“, „hvaða deild er með mest veikindi“, „hver hefur oftast verið veikur“.",
    input_schema: {
      type: "object",
      properties: { by: { type: "string", enum: ["period", "month", "quarter", "year"] }, count: { type: "number", description: "Fjöldi tímabila (1–24)" } },
      required: ["by"],
    },
  },
  {
    name: "employee_contracts",
    description: "Samningar starfsmanns (leit eftir nafni): netfang á skrá og samningar með stöðu (draft = drög, sent = bíður undirritunar starfsmanns, signed = undirritaður, void = ógildur) og dagsetningum. Ef fleiri en einn starfsmaður passar við nafnið koma allir — spurðu þá hvern er átt við. Kallaðu á þetta ÁÐUR en þú notar resend_contract.",
    input_schema: { type: "object", properties: { employee: { type: "string", description: "Nafn starfsmanns (fullt nafn eða fornafn)" } }, required: ["employee"] },
  },
  {
    name: "employment_endings",
    description: "Starfsfólk sem hættir á næstunni eða hætti nýlega (starfslok skráð í VAKTO): nafn, ástæðuflokkur, tilkynningardagur, síðasti starfsdagur, hvort viðkomandi er laus undan vinnuskyldu, hvort lokauppgjör launa og orlofs er afgreitt og hvenær lesaðgangur að appinu lokast. Aðeins lestur — starfslok eru skráð í Starfsfólk → prófíll → „Ljúka ráðningu“.",
    input_schema: { type: "object", properties: { days: { type: "number", description: "Hversu marga daga fram í tímann (sjálfgefið 90, mest 365). Síðustu 30 dagar fylgja alltaf." } } },
  },
  {
    name: "list_alerts",
    description: "Vaktarar og sjálfvirkar skýrslur fyrirtækisins (id, lýsing, virkur eða ekki, rás, hvort VAKTO AI bjó hann til, hvenær hann fór síðast). Kallaðu á þetta áður en þú notar toggle_alert eða delete_alert.",
    input_schema: { type: "object", properties: {} },
  },
];

export const WRITE_TOOLS: Anthropic.Tool[] = [
  {
    name: "set_shift",
    description: "LEGGJA TIL að setja eða breyta vakt starfsmanns á dagsetningu. Framkvæmist ekki fyrr en notandinn staðfestir.",
    input_schema: {
      type: "object",
      properties: { employee: { type: "string", description: "Fornafn starfsmanns eins og það birtist í kerfinu" }, date: DATE, start: TIME, end: TIME, shiftType: { type: "string", description: "Heiti vaktategundar, t.d. Dagvakt (valfrjálst)" } },
      required: ["employee", "date", "start", "end"],
    },
  },
  {
    name: "remove_shift",
    description: "LEGGJA TIL að eyða vakt starfsmanns á dagsetningu. Framkvæmist ekki fyrr en notandinn staðfestir.",
    input_schema: { type: "object", properties: { employee: { type: "string" }, date: DATE }, required: ["employee", "date"] },
  },
  {
    name: "decide_leave",
    description: "LEGGJA TIL að samþykkja eða hafna frí-beiðni (id úr pending_requests).",
    input_schema: { type: "object", properties: { id: { type: "string" }, approve: { type: "boolean" }, label: { type: "string", description: "Stutt lýsing, t.d. „Frí-beiðni Mínu 12.–14. okt.“" } }, required: ["id", "approve", "label"] },
  },
  {
    name: "approve_swap",
    description: "LEGGJA TIL að samþykkja vaktaskipti (id úr pending_requests).",
    input_schema: { type: "object", properties: { id: { type: "string" }, label: { type: "string" } }, required: ["id", "label"] },
  },
  {
    name: "clock_out",
    description: "LEGGJA TIL að stimpla starfsmann út (t.d. ef hann gleymdi því) á tilteknum tíma í dag.",
    input_schema: { type: "object", properties: { employee: { type: "string" }, time: TIME }, required: ["employee", "time"] },
  },
  {
    name: "plan_week",
    description: "LEGGJA TIL heilt vaktaplan fyrir eina viku (mánudag–sunnudag) í einni tillögu. KEMUR Í STAÐ allra vakta vikunnar: taktu því með ALLAR vaktir sem eiga að vera, líka þær sem breytast ekki. Þegar notandinn staðfestir er planið birt og starfsfólk fær tilkynningu. Notaðu þetta fyrir beiðnir eins og „settu upp næstu viku“, „allir vinni 35 tíma og fái einn frídag“, „vaktaplan fyrir eldhúsið, allir tvo frídaga, alltaf þrír á vakt“ (þá department). Fyrir stakar breytingar notaðu set_shift.",
    input_schema: {
      type: "object",
      properties: {
        monday: { type: "string", description: "Mánudagur vikunnar, YYYY-MM-DD" },
        department: { type: "string", description: "Valfrjálst: ef aðeins ein deild er skipulögð (t.d. „Eldhús“). Þá koma shifts aðeins fyrir starfsfólk þeirrar deildar og vaktir annarra deilda vikunnar haldast óbreyttar." },
        label: { type: "string", description: "Ein setning sem lýsir planinu, t.d. „Allir 35–38 klst., einn frídagur hver, helgar mannaðar 4“" },
        shiftCount: { type: "integer", description: "Fjöldi vakta í shifts. Skrifaðu hann Á UNDAN shifts (notað til að sýna framvindu)." },
        shifts: {
          type: "array",
          description: "Ein vakt per streng á forminu \"Fornafn|YYYY-MM-DD|HH:MM|HH:MM\" (byrjun|endir), valfrjálst fimmta svið er heiti vaktategundar. Dæmi: \"Anna|2026-10-19|09:00|17:00|Dagvakt\".",
          items: { type: "string" },
        },
        notes: { type: "string", description: "Svarið til notandans, skrifað Á EFTIR shifts: 3–6 punktar („- …“) um planið — tímar per mann, frídagar, mönnun, áætlaður kostnaður og laun % ef veltuspá er til, og hvað gekk ekki upp og hvers vegna. Ekki telja upp hverja vakt." },
      },
      required: ["monday", "label", "shifts", "notes"],
    },
    // Vaktirnar streymast jafnóðum (framvinda í spjallinu); inntakið er sannreynt í parseWeekPlan áður en nokkuð er gert.
    eager_input_streaming: true,
  },
  {
    name: "plan_month",
    description: "LEGGJA TIL heilt vaktaplan fyrir einn almanaksmánuð (1. til síðasta dags) í einni tillögu. KEMUR Í STAÐ allra vakta starfsfólks í mánuðinum (lausar vaktir haldast): taktu því með ALLAR vaktir sem eiga að vera. Notaðu fyrir „settu upp nóvember“, „plan fyrir allan næsta mánuð“. Sömu reglur og plan_week; yfirvinna er 40 klst á viku (mán–sun). Fyrir eina viku notaðu plan_week.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", description: "YYYY-MM" },
        department: { type: "string", description: "Valfrjálst: aðeins ein deild skipulögð — vaktir annarra deilda haldast óbreyttar." },
        label: { type: "string", description: "Ein setning sem lýsir planinu" },
        shiftCount: { type: "integer", description: "Fjöldi vakta í shifts. Skrifaðu hann Á UNDAN shifts." },
        shifts: { type: "array", description: "Ein vakt per streng: \"Fornafn|YYYY-MM-DD|HH:MM|HH:MM\" (valfrjálst |vaktategund).", items: { type: "string" } },
        notes: { type: "string", description: "Svarið til notandans, Á EFTIR shifts: 3–6 punktar — tímar per mann (á viku og í mánuðinum), frídagar, mönnun, áætlaður kostnaður, hvað gekk ekki upp. Ekki telja upp hverja vakt." },
      },
      required: ["month", "label", "shifts", "notes"],
    },
    eager_input_streaming: true,
  },
  {
    name: "close_punch",
    description: "LEGGJA TIL að setja útstimplun á stimplun sem gleymdist að loka eða er of löng (punchId úr timesheet_issues). Venjulega á áætluðum lokum vaktar (fix.out / fix.outDate).",
    input_schema: { type: "object", properties: { punchId: { type: "string" }, out: TIME, outDate: DATE, label: { type: "string", description: "Lýsing fyrir notandann, t.d. „Fannar 12.10.: út kl. 16:00 (áætluð lok)“" } }, required: ["punchId", "out", "outDate"] },
  },
  {
    name: "ask_correction",
    description: "LEGGJA TIL að biðja starfsmann um réttan tíma (vakt án stimplunar eða stimplun sem kerfið getur ekki lagað sjálft): skilaboð í beinu spjalli + tilkynning sem opnar leiðréttingarformið. Skrifaðu stutt, vingjarnleg skilaboð á íslensku með deginum og því sem vantar.",
    input_schema: { type: "object", properties: { employee: { type: "string", description: "Fullt nafn" }, date: DATE, message: { type: "string" } }, required: ["employee", "date", "message"] },
  },
  {
    name: "save_planning_rule",
    description: `LEGGJA TIL að vista fasta planreglu fyrirtækisins sem gildir í öllum framtíðarplönum (AI-vaktaplan í spjallinu og í Vaktaplani). Notaðu þegar notandinn biður þig að muna eitthvað um vaktaplan („mundu að Bach er bara á morgnana“, „alltaf 3 í eldhúsi um helgar“, „Anna vinnur aldrei sunnudaga“). Ein regla per kall, stutt og skýr setning með nafni/deild og tíma, mest ${MAX_RULE_LEN} stafir. EKKI fyrir einstakar vikur („Anna í fríi næsta föstudag“) — það er bara fyrir planið núna.`,
    input_schema: { type: "object", properties: { text: { type: "string", description: "Reglan, t.d. „Bach Đuc Luu vinnur aðeins morgunvaktir (05:00–12:00)“" } }, required: ["text"] },
  },
  {
    name: "remove_planning_rule",
    description: "LEGGJA TIL að eyða vistaðri planreglu. Kallaðu fyrst á planning_rules til að fá id.",
    input_schema: { type: "object", properties: { id: { type: "string" }, label: { type: "string", description: "Texti reglunnar (birtur notandanum)" } }, required: ["id"] },
  },
  {
    name: "create_open_shifts",
    description: "LEGGJA TIL lausar (opnar) vaktir sem starfsfólk getur sótt um í appinu — t.d. „opnaðu vaktir alla daga næstu viku milli 17 og 23“. Sami tími alla valda daga; count = fjöldi lausra vakta per dag. Dagar: from–to, valfrjálst takmarkað við weekdays (1 = mánudagur … 7 = sunnudagur). Mest 31 dagur. Starfsfólk fær eina tilkynningu þegar staðfest er.",
    input_schema: {
      type: "object",
      properties: {
        from: DATE, to: DATE,
        weekdays: { type: "array", items: { type: "integer", minimum: 1, maximum: 7 }, description: "Valfrjálst: aðeins þessir vikudagar (1 = mán … 7 = sun)" },
        start: TIME, end: TIME,
        count: { type: "integer", minimum: 1, maximum: 10, description: "Lausar vaktir per dag (sjálfgefið 1)" },
        shiftType: { type: "string", description: "Heiti vaktategundar (valfrjálst)" },
        department: { type: "string", description: "Deild (valfrjálst) — birtist í athugasemd vaktarinnar" },
        note: { type: "string", description: "Stutt athugasemd til starfsfólks (valfrjálst)" },
      },
      required: ["from", "to", "start", "end"],
    },
  },
  {
    name: "resend_contract",
    description: "LEGGJA TIL að senda undirritunarbeiðni ráðningarsamnings aftur á netfang starfsmanns á skrá. Notar nýjasta óundirritaða samninginn: ef hann er sendur er boðið endursent; ef hann er drög er hann undirritaður fyrir hönd fyrirtækisins og sendur (eins og „Undirrita & senda“). Ekki nota ef samningurinn er þegar undirritaður — segðu frá því. Notaðu employee_contracts fyrst og fullt nafn hér.",
    input_schema: {
      type: "object",
      properties: { employee: { type: "string", description: "FULLT nafn starfsmanns eins og employee_contracts skilaði því" }, label: { type: "string", description: "Stutt lýsing, t.d. „Ráðningarsamningur Péturs Karlssonar → petur@dæmi.is“" } },
      required: ["employee", "label"],
    },
  },
  {
    name: "create_alert",
    description: "LEGGJA TIL nýjan vaktara sem lætur notandann vita sjálfkrafa (metinn daglega kl. 8, hver viðvörun einu sinni per starfsmann per tímabil). hours_threshold: starfsmaður fer yfir hours klst. á tímabili („láttu mig vita ef einhver fer yfir 180 tíma í mánuðinum“ → hours 180, period month); warnPct = snemmviðvörun (sjálfgefið 90, 0 = engin); includePlanned = líka þegar vaktir sem eru eftir á tímabilinu munu fara yfir. overtime_threshold: starfsmaður fer yfir hours yfirvinnutíma á tímabili. labor_pct_above: laun % af veltu fer yfir pct (period week eða month).",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["hours_threshold", "overtime_threshold", "labor_pct_above"] },
        hours: { type: "number", description: "Klst. (hours_threshold, overtime_threshold)" },
        pct: { type: "number", description: "Laun % af veltu (labor_pct_above)" },
        period: PERIOD,
        warnPct: { type: "number", description: "Snemmviðvörun í % af mörkunum (hours_threshold), t.d. 90; 0 = engin" },
        includePlanned: { type: "boolean", description: "hours_threshold: telja með vaktir sem eru eftir á tímabilinu" },
        channel: CHANNEL,
      },
      required: ["kind"],
    },
  },
  {
    name: "schedule_report",
    description: "LEGGJA TIL skýrslu úr Skýrslusafninu sem er send sjálfkrafa í tölvupósti (tafla + Excel) á tímaáætlun, alltaf kl. 8 að morgni. „Sendu mér yfirvinnuskýrslu alla mánudaga kl. 8“ → report overtime, freq weekly, weekday 1. Skýrslur: hours (launatímar), overtime (yfirvinna & álög), attendance (mæting & frávik), cost (launakostnaður), costDept (kostnaður per deild), absence (fjarvistir & veikindi). range: tímabil skýrslunnar (sjálfgefið: daily → yesterday, weekly → last_week, monthly → last_month).",
    input_schema: {
      type: "object",
      properties: {
        report: { type: "string", enum: SCHEDULABLE_REPORTS },
        freq: { type: "string", enum: ["daily", "weekly", "monthly"] },
        weekday: { type: "integer", minimum: 1, maximum: 7, description: "weekly: 1 = mánudagur … 7 = sunnudagur" },
        day: { type: "integer", minimum: 1, maximum: 28, description: "monthly: dagur mánaðar" },
        range: { type: "string", enum: RANGES },
        channel: CHANNEL,
      },
      required: ["report", "freq"],
    },
  },
  {
    name: "toggle_alert",
    description: "LEGGJA TIL að kveikja eða slökkva á vaktara eða sjálfvirkri skýrslu (id úr list_alerts).",
    input_schema: { type: "object", properties: { id: { type: "string" }, active: { type: "boolean" }, label: { type: "string", description: "Lýsing vaktarans úr list_alerts" } }, required: ["id", "active", "label"] },
  },
  {
    name: "delete_alert",
    description: "LEGGJA TIL að eyða vaktara eða sjálfvirkri skýrslu (id úr list_alerts).",
    input_schema: { type: "object", properties: { id: { type: "string" }, label: { type: "string", description: "Lýsing vaktarans úr list_alerts" } }, required: ["id", "label"] },
  },
  {
    name: "send_report_now",
    description: "LEGGJA TIL að senda skýrslu úr Skýrslusafninu strax í tölvupósti á netfang notandans sem biður um hana (tafla + Excel). „Sendu mér mætingarskýrslu síðasta mánaðar“ → report attendance, from/to = fyrsti og síðasti dagur síðasta mánaðar. Skýrslur eins og í schedule_report, auk timebank (orlof & tímabanki).",
    input_schema: { type: "object", properties: { report: { type: "string", enum: REPORTS }, from: DATE, to: DATE }, required: ["report", "from", "to"] },
  },
];

export const WRITE_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));

type In = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const okDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(str(v));
const okTime = (v: unknown) => /^\d{1,2}:\d{2}$/.test(str(v));

/** Dagarnir sjö frá mánudegi (YYYY-MM-DD). */
function weekDates(mon: string): string[] {
  const [y, m, d] = mon.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => { const dt = new Date(y, m - 1, d + i); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`; });
}
type PlanShift = { employee: string; date: string; start: string; end: string; shiftType: string };
/** Dagar almanaksmánaðar (month = YYYY-MM), eða null. */
function monthDates(month: unknown): string[] | null {
  const m = /^(\d{4})-(\d{2})$/.exec(str(month));
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const n = new Date(y, mo, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${m[1]}-${m[2]}-${String(i + 1).padStart(2, "0")}`);
}
/** Mánudagar allra vikna sem snerta dagana. */
function mondaysOf(dates: string[]): string[] {
  const out = new Set<string>();
  for (const d of dates) { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); out.add(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`); }
  return [...out];
}
/** plan_week eða plan_month: dagarnir sem tillagan nær yfir. */
function planDates(name: string, input: In): { ok: true; dates: string[] } | { ok: false; error: string } {
  if (name === "plan_month") {
    const d = monthDates(input.month);
    return d ? { ok: true, dates: d } : { ok: false, error: "month verður að vera YYYY-MM" };
  }
  if (!okDate(input.monday)) return { ok: false, error: "monday verður að vera YYYY-MM-DD" };
  const mon = str(input.monday);
  if (new Date(`${mon}T12:00:00`).getDay() !== 1) return { ok: false, error: `${mon} er ekki mánudagur` };
  return { ok: true, dates: weekDates(mon) };
}
/** Sannreynir vikuplan (eða mánaðarplan): vaktir innan tímabilsins, ein vakt per starfsmann per dag. */
function parseWeekPlan(input: In, name = "plan_week"): { ok: true; dates: string[]; shifts: PlanShift[] } | { ok: false; error: string } {
  const pd = planDates(name, input);
  if (!pd.ok) return pd;
  const dates = pd.dates;
  if (!Array.isArray(input.shifts) || !input.shifts.length) return { ok: false, error: "Engar vaktir í planinu" };
  if (input.shifts.length > (name === "plan_month" ? 1500 : 400)) return { ok: false, error: "Of margar vaktir í einu plani" };
  const out: PlanShift[] = []; const seen = new Set<string>();
  for (const item of input.shifts as unknown[]) {
    // Strengur „Nafn|dags|byrjun|endir|tegund“ (þjappað form) eða hlutur með sömu sviðum.
    const parts = typeof item === "string" ? item.split("|").map((x) => x.trim()) : null;
    const raw: In = parts ? { employee: parts[0], date: parts[1], start: parts[2], end: parts[3], shiftType: parts[4] ?? "" } : ((item ?? {}) as In);
    const who = str(raw.employee), date = str(raw.date);
    if (!who || !okDate(date) || !okTime(raw.start) || !okTime(raw.end)) return { ok: false, error: "Hver vakt þarf að vera \"Nafn|YYYY-MM-DD|HH:MM|HH:MM\"" };
    if (!dates.includes(date)) return { ok: false, error: `Vakt ${date} er utan tímabilsins ${dates[0]}–${dates[dates.length - 1]}` };
    const k = `${who.toLowerCase()}|${date}`;
    if (seen.has(k)) return { ok: false, error: `${who} er með tvær vaktir ${date} — aðeins ein vakt per dag` };
    seen.add(k);
    out.push({ employee: who, date, start: str(raw.start).padStart(5, "0"), end: str(raw.end).padStart(5, "0"), shiftType: str(raw.shiftType) });
  }
  return { ok: true, dates, shifts: out };
}
const shortDate = (iso: string) => `${Number(iso.slice(8))}.${Number(iso.slice(5, 7))}.`;

/** Starfsfólk sem passar við nafn: nákvæmt fullt nafn vinnur, annars öll nöfn þar sem hvert orð byrjar eins. */
function matchStaff<T extends { fullName: string }>(list: T[], name: string): T[] {
  const q = name.toLowerCase().trim();
  const exact = list.filter((e) => e.fullName.toLowerCase() === q);
  if (exact.length) return exact;
  const words = q.split(/\s+/).filter(Boolean);
  return list.filter((e) => { const parts = e.fullName.toLowerCase().split(/\s+/); return words.every((w) => parts.some((p) => p.startsWith(w))); });
}

/** Dagsetningar lausra vakta: from–to (mest 31 dagur), valfrjálst aðeins ákveðnir vikudagar (1 = mán … 7 = sun). */
function openShiftDates(input: In): { ok: true; dates: string[] } | { ok: false; error: string } {
  if (!okDate(input.from) || !okDate(input.to)) return { ok: false, error: "from/to verða að vera YYYY-MM-DD" };
  if (!okTime(input.start) || !okTime(input.end)) return { ok: false, error: "Vantar tíma (HH:MM)" };
  const from = str(input.from), to = str(input.to);
  if (to < from) return { ok: false, error: "to er á undan from" };
  const wd = Array.isArray(input.weekdays) ? (input.weekdays as unknown[]).map(Number).filter((n) => n >= 1 && n <= 7) : [];
  const [y, m, d] = from.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < 400; i++) {
    const dt = new Date(y, m - 1, d + i);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    if (iso > to) break;
    if (!wd.length || wd.includes(dt.getDay() === 0 ? 7 : dt.getDay())) out.push(iso);
  }
  if (!out.length) return { ok: false, error: "Engir dagar passa við bilið og vikudagana" };
  if (out.length > 31) return { ok: false, error: "Mest 31 dagur í einu" };
  return { ok: true, dates: out };
}
const openCount = (input: In) => Math.min(Math.max(Math.round(Number(input.count) || 1), 1), 10);
const openNote = (input: In) => [str(input.department), str(input.note)].filter(Boolean).join(" · ").slice(0, 200);

/** Inntak create_alert / schedule_report → regla (sama sannprófun og Stillingar). */
function alertInput(name: string, input: In) {
  return name === "schedule_report"
    ? normalizeAlert({ kind: "report", params: { report: input.report, range: input.range }, schedule: { freq: input.freq, weekday: input.weekday, day: input.day }, channel: input.channel })
    : normalizeAlert({ kind: input.kind, params: { hours: input.hours, pct: input.pct, period: input.period, warnPct: input.warnPct, includePlanned: input.includePlanned }, channel: input.channel });
}

/** Keyrir lesverkfæri og skilar JSON-streng fyrir líkanið. */
/** Saga síðustu 8 heilu vikna (fyrir dagsetninguna eða í dag ef hún er í framtíðinni) sem stuttur texti
 * — fylgir vikusamhengi og mánaðarsamhengi svo AI-ið planar nær raunverulegri þörf. */
async function historyText(supabase: Awaited<ReturnType<typeof createClient>>, start: string): Promise<string> {
  try {
    const company = await getCompanyId(supabase);
    if (!company) return "";
    const today = new Date().toISOString().slice(0, 10);
    const r = historyRange(start < today ? start : today, 8);
    const h = await getPlanningHistory(supabase, company, r.from, r.to);
    return "error" in h ? "" : historyForPrompt(h);
  } catch (e) {
    console.error("[assistant] history", e instanceof Error ? e.message : e);
    return "";
  }
}

export async function runReadTool(name: string, input: In): Promise<string> {
  try {
    if (name === "labor_summary" || name === "staff_hours" || name === "shifts") {
      if (!okDate(input.from) || !okDate(input.to)) return JSON.stringify({ error: "from/to verða að vera YYYY-MM-DD" });
      const from = str(input.from), to = str(input.to);
      if (name === "labor_summary") {
        const d = await getDashboardPeriod(from, to);
        const { series: _s, ...rest } = d; void _s;
        return JSON.stringify(rest);
      }
      if (name === "staff_hours") return JSON.stringify((await fetchAttendance(from, to)).rows.map(({ c, av, ...r }) => { void c; void av; return r; }));
      const res = await getShiftsInRange(from, to);
      return JSON.stringify(res.rows.slice(0, 400));
    }
    if (name === "week_planning_context") {
      if (!okDate(input.monday)) return JSON.stringify({ error: "monday verður að vera YYYY-MM-DD" });
      const mon = str(input.monday), dates = weekDates(mon);
      if (new Date(`${mon}T12:00:00`).getDay() !== 1) return JSON.stringify({ error: `${mon} er ekki mánudagur` });
      const supabase = await createClient();
      const rulesP = getPlanningRules(supabase);
      const [{ employees }, shifts, wk, budget, types, leave, co, reqs] = await Promise.all([
        getEmployees(), getShiftsInRange(dates[0], dates[6]), getWeekShifts(mon), getWeekBudget(mon),
        supabase.from("shift_types").select("name, start_time, end_time, premium_pct"),
        supabase.from("leave_requests").select("from_date, to_date, type, employees(full_name)").eq("status", "approved").lte("from_date", dates[6]).gte("to_date", dates[0]),
        supabase.from("companies").select("staffing_targets").limit(1).maybeSingle(),
        getPlanRequestsForMe(supabase, dates).catch(() => null),
      ]);
      const first = (n: string) => n.split(/\s+/)[0];
      const staff = employees.filter((e) => e.status !== "inactive" && (e as { role?: string }).role !== "contractor");
      // Fornöfn verða að vera einkvæm — annars getur plan_week ekki vitað hver er hver.
      const seen = new Map<string, number>(); for (const e of staff) seen.set(first(e.fullName), (seen.get(first(e.fullName)) ?? 0) + 1);
      const unavail: Record<string, string[]> = {};
      for (const [k, days] of Object.entries((wk as { unavail?: Record<string, number[]> }).unavail ?? {})) if (!/^[0-9a-f-]{36}$/.test(k)) unavail[k] = days.map((d) => dates[d]).filter(Boolean);
      // Þjappað form (pípu-strengir, tómum sviðum sleppt): helmingi færri tákn en hlutir — styttir lestur líkansins.
      const approvedLeave = ((leave.data ?? []) as unknown as { from_date: string; to_date: string; type: string; employees: { full_name?: string } | { full_name?: string }[] | null }[]).map((l) => `${first((Array.isArray(l.employees) ? l.employees[0] : l.employees)?.full_name ?? "")}|${l.from_date}|${l.to_date}|${l.type}`);
      const pendingLeave = (reqs?.pendingLeave ?? []).map((l) => `${l.name}|${l.days.map((d) => dates[d]).join(",")}|${l.type}`);
      const preferredDays = (reqs?.preferred ?? []).map((p) => `${p.name}|${p.days.map((d) => dates[d]).join(",")}`);
      const out: Record<string, unknown> = {
        format: "staff: nafn|deild|laun|starfshlutfall. currentShifts: nafn|dags|byrjun|endir|tegund. approvedLeave: nafn|frá|til|tegund (ALDREI vakt þá daga). pendingLeave/preferredDays: nafn|dagar(|tegund).",
        week: dates,
        staff: staff.map((e) => [first(e.fullName), e.department || "-", e.payType === "monthly" ? "föst laun" : "tímakaup", `${e.employmentRatio}%`].join("|") + (seen.get(first(e.fullName))! > 1 ? `|SAMA FORNAFN — notaðu fullt nafn: ${e.fullName}` : "")),
        departments: [...new Set(staff.map((e) => e.department).filter(Boolean))],
        currentShifts: shifts.rows.filter((r) => r.name !== "?").map((r) => [r.first, r.date, r.start, r.end, r.type ?? ""].join("|")),
        shiftTypes: (types.data ?? []).map((t) => `${t.name} ${String(t.start_time ?? "").slice(0, 5)}–${String(t.end_time ?? "").slice(0, 5)}${t.premium_pct ? ` +${t.premium_pct}%` : ""}`),
      };
      if (Object.keys(unavail).length) out.unavailable = unavail;
      if (approvedLeave.length) out.approvedLeave = approvedLeave;
      // Mjúkar óskir: forðast frí í bið og óframboð, virða framboð/vaktaskipti ef hægt er; nefna í svarinu hvað var virt.
      if (pendingLeave.length) out.pendingLeave = pendingLeave;
      if (preferredDays.length) out.preferredDays = preferredDays;
      if (reqs?.pendingSwaps?.length) out.pendingSwaps = reqs.pendingSwaps;
      const targets = (co.data?.staffing_targets as number[] | null) ?? null;
      if (targets) out.staffingTargetsMonToSun = targets;
      // Vistaðar planreglur (0101): gilda eins og skilyrði notandans nema hann taki annað fram.
      const companyRules = (await rulesP).filter((r) => r.active).map((r) => r.text);
      if (companyRules.length) out.companyRules = companyRules;
      if (budget) out.budget = { revenueForecast: budget.revenue, revenueSource: budget.revenueSource, laborTargetPct: budget.target, fixedSalaryCostKr: budget.fixed, avgCostPerHourKr: Math.round(budget.avgRate) };
      if (!input.noHistory) { const h = await historyText(supabase, mon); if (h) out.history = h; }
      return JSON.stringify(out);
    }
    if (name === "compare_periods" || name === "labor_trend" || name === "payroll_runs") {
      if (!okDate(input.from) || !okDate(input.to)) return JSON.stringify({ error: "from/to verða að vera YYYY-MM-DD" });
      const from = str(input.from), to = str(input.to);
      if (name === "compare_periods") {
        const mode = (["fyrra", "manudur", "ar", "sersnid"] as const).find((m) => m === input.compare) ?? "fyrra";
        return JSON.stringify(await comparePeriods(from, to, mode, { from: str(input.compareFrom), to: str(input.compareTo) }));
      }
      if (name === "labor_trend") return JSON.stringify(await laborTrend(from, to, input.by === "week" ? "week" : input.by === "day" ? "day" : "month"));
      return JSON.stringify(await payrollRuns(from, to, str(input.employee) || undefined));
    }
    if (name === "who_is_on_now") {
      const w = await getWhoIsOn();
      return JSON.stringify({
        onShift: w.rows.map((r) => ({ name: r.name, dept: r.dept, since: r.in, unscheduled: !!r.unscheduled })),
        notArrived: w.missing.map((m) => ({ name: m.name, dept: m.dept, plannedStart: m.start, late: m.late, minutes: m.mins })),
      });
    }
    if (name === "employee_contracts") {
      const q = str(input.employee);
      if (!q) return JSON.stringify({ error: "Vantar nafn" });
      const { employees } = await getEmployees();
      const hits = matchStaff(employees.filter((e) => e.status !== "inactive"), q).slice(0, 5);
      if (!hits.length) return JSON.stringify({ error: `Enginn starfsmaður fannst sem heitir „${q}“` });
      const out = await Promise.all(hits.map(async (e) => ({
        fullName: e.fullName, dept: e.department, email: e.email ?? null,
        contracts: (await listContracts(e.id)).contracts.map((c) => ({ title: c.title, status: c.status, created: c.created, signedAt: c.signed_at, via: c.signed_via })),
      })));
      return JSON.stringify(out.length > 1 ? { ambiguous: true, matches: out } : out[0]);
    }
    if (name === "employment_endings") {
      const n = Number(input.days);
      const rows = await getUpcomingLeavers(Number.isFinite(n) && n > 0 ? Math.round(n) : 90);
      return JSON.stringify(rows.map((r) => ({ ...r, reason: REASON_LABEL[r.reason] })));
    }
    if (name === "list_alerts") {
      const a = await listAlerts();
      if (a.missing) return JSON.stringify({ error: "Vaktarar eru ekki komnir í gagnagrunninn enn" });
      if (!a.ok) return JSON.stringify({ error: a.error ?? "Tókst ekki að sækja vaktarana" });
      return JSON.stringify(a.rules.map((r) => ({ id: r.id, description: r.description || describeAlert(r, "is"), active: r.active, channel: r.channel, byVaktoAi: r.createdVia === "ai", lastFiredAt: r.lastFiredAt })));
    }
    if (name === "sick_rate") {
      const by = (["period", "month", "quarter", "year"] as const).find((g) => g === input.by) ?? "month";
      const n = Number(input.count);
      const d = await getSickRate(by, Number.isFinite(n) && n > 0 ? Math.min(24, Math.round(n)) : undefined);
      if (!d.live) return JSON.stringify({ error: "Engin gögn (eða ekki aðgangur)" });
      return JSON.stringify({
        definition: SICK_DEFINITION,
        periods: d.buckets.map((b) => ({
          label: b.label, from: b.from, to: b.to, ratePct: b.rate, sickHours: b.sick, plannedHours: b.planned, sickDays: b.sickDays, occurrences: b.occurrences,
          byDepartment: byDept(b.rows).map((x) => ({ dept: x.dept, ratePct: x.rate, sickDays: x.sickDays, occurrences: x.occurrences, people: x.people })),
          sickEmployees: b.rows.filter((r) => r.sick > 0).map((r) => ({ name: r.name, dept: r.dept, sickDays: r.sickDays, occurrences: r.occurrences, sickHours: r.sick, ratePct: pctOf(r.sick, r.planned) })),
        })),
      });
    }
    if (name === "month_planning_context") {
      const dates = monthDates(input.month);
      if (!dates) return JSON.stringify({ error: "month verður að vera YYYY-MM" });
      // Vikusamhengi fyrir hverja viku sem snertir mánuðinn, sameinað og síað á daga mánaðarins.
      const weeks = await Promise.all(mondaysOf(dates).map(async (monday) => ({ monday, ctx: JSON.parse(await runReadTool("week_planning_context", { monday, noHistory: true })) as Record<string, unknown> })));
      const bad = weeks.find((w) => w.ctx.error);
      if (bad) return JSON.stringify({ error: bad.ctx.error });
      const inMonth = (s: string) => dates.includes(s.split("|")[1] ?? "");
      const uniq = (xs: string[]) => [...new Set(xs)];
      const arr = (k: string) => weeks.flatMap((w) => (Array.isArray(w.ctx[k]) ? (w.ctx[k] as string[]) : []));
      const first = weeks[0].ctx;
      const unavailable: Record<string, string[]> = {};
      for (const w of weeks) for (const [n, ds] of Object.entries((w.ctx.unavailable ?? {}) as Record<string, string[]>)) unavailable[n] = uniq([...(unavailable[n] ?? []), ...ds.filter((d) => dates.includes(d))]);
      const out: Record<string, unknown> = {
        format: first.format, month: str(input.month), days: dates,
        weeksMonToSun: weeks.map((w) => w.monday),
        staff: first.staff, departments: first.departments, shiftTypes: first.shiftTypes,
        currentShifts: uniq(arr("currentShifts")).filter(inMonth),
      };
      if (Object.values(unavailable).some((x) => x.length)) out.unavailable = Object.fromEntries(Object.entries(unavailable).filter(([, x]) => x.length));
      for (const k of ["approvedLeave", "pendingLeave", "preferredDays"]) { const v = uniq(arr(k)); if (v.length) out[k] = v; }
      if (first.companyRules) out.companyRules = first.companyRules;
      if (first.staffingTargetsMonToSun) out.staffingTargetsMonToSun = first.staffingTargetsMonToSun;
      const budgets = weeks.filter((w) => w.ctx.budget).map((w) => ({ monday: w.monday, ...(w.ctx.budget as object) }));
      if (budgets.length) out.budgetByWeek = budgets;
      const h = await historyText(await createClient(), dates[0]);
      if (h) out.history = h;
      return JSON.stringify(out);
    }
    if (name === "timesheet_issues") {
      if (!okDate(input.from) || !okDate(input.to)) return JSON.stringify({ error: "from/to verða að vera YYYY-MM-DD" });
      const r = await getTimesheetIssues(str(input.from), str(input.to));
      if (!r.ok) return JSON.stringify({ error: r.error ?? "Tókst ekki að sækja frávik" });
      return JSON.stringify(r.issues.slice(0, 150).map((i) => ({ kind: i.kind, employee: i.name, dept: i.dept, date: i.date, punchId: i.punchId, in: i.in, out: i.out, hours: i.hours, planned: i.sched ? `${i.sched.start}–${i.sched.end}` : null, fix: i.fix, hasAccount: i.hasAccount })));
    }
    if (name === "planning_history") {
      const supabase = await createClient();
      const company = await getCompanyId(supabase);
      if (!company) return JSON.stringify({ error: "Fyrirtæki fannst ekki" });
      const today = new Date().toISOString().slice(0, 10);
      const weeks = Math.min(26, Math.max(4, Math.round(Number(input.weeks) || 8)));
      const r = okDate(input.from) && okDate(input.to) ? { from: str(input.from), to: str(input.to) } : historyRange(today, weeks);
      return JSON.stringify(await getPlanningHistory(supabase, company, r.from, r.to));
    }
    if (name === "staff_pay") {
      const { employees } = await getEmployees();
      const q = str(input.name).trim().toLowerCase();
      const now = Date.now();
      const rows = employees
        .filter((e) => e.status !== "inactive" && (!q || e.fullName.toLowerCase().includes(q)))
        .map((e) => {
          const months = (e.hireDate ? (now - new Date(`${e.hireDate}T12:00:00`).getTime()) / (30.44 * 864e5) : 0) + (e.priorServiceMonths ?? 0);
          return {
            name: e.fullName, title: e.title ?? e.position, department: e.department,
            pay: e.payType === "hourly" ? `${e.rate} kr./klst.` : `${e.rate} kr./mán.`, employmentRatio: `${e.employmentRatio} %`,
            union: e.union, hireDate: e.hireDate ?? null, tenureYears: e.hireDate || e.priorServiceMonths ? Math.round((months / 12) * 10) / 10 : null,
          };
        });
      return JSON.stringify(rows.slice(0, 200));
    }
    if (name === "planning_rules") {
      const rules = await getPlanningRules();
      return JSON.stringify(rules.length ? rules.map((r) => ({ id: r.id, text: r.text, active: r.active })) : { rules: [], note: "Engar planreglur vistaðar" });
    }
    if (name === "pending_requests") {
      const r = await getPendingRequests();
      return JSON.stringify(r.items.filter((i) => i.id).map((i) => ({ id: i.id, kind: i.kind, title: i.title, detail: i.detail, hints: i.hints?.map((h) => h.text) })));
    }
    return JSON.stringify({ error: "Óþekkt verkfæri" });
  } catch (e) {
    console.error("[assistant tool]", name, e);
    return JSON.stringify({ error: "Tókst ekki að sækja gögnin" });
  }
}

/** Ein staðfestingartillaga sem UI sýnir með „Staðfesta"-hnappi. */
export type PendingAction = { tool: string; input: In; summary: string };

/** Sannreynir inntak skrifverkfæris og býr til lýsingu fyrir notandann (ekkert framkvæmt). */
export function describeWrite(name: string, input: In, lang: string): { ok: true; summary: string } | { ok: false; error: string } {
  const en = lang === "en";
  const who = str(input.employee);
  switch (name) {
    case "plan_month":
    case "plan_week": {
      const p = parseWeekPlan(input, name);
      if (!p.ok) return p;
      const last = p.dates[p.dates.length - 1];
      const people = new Set(p.shifts.map((x) => x.employee.toLowerCase())).size;
      const hours = p.shifts.reduce((a, x) => { let h = (Number(x.end.slice(0, 2)) * 60 + Number(x.end.slice(3))) - (Number(x.start.slice(0, 2)) * 60 + Number(x.start.slice(3))); if (h <= 0) h += 1440; return a + h / 60; }, 0);
      const lbl = [str(input.department) && (en ? `Department: ${str(input.department)} (other departments unchanged).` : `Deild: ${str(input.department)} (aðrar deildir óbreyttar).`), str(input.label)].filter(Boolean).join(" ");
      const month = name === "plan_month";
      return { ok: true, summary: en
        ? `Publish ${month ? "month" : "week"} plan ${shortDate(p.dates[0])}–${shortDate(last)}: ${p.shifts.length} shifts for ${people} people, ${Math.round(hours)} hrs. Replaces all staff shifts that ${month ? "month" : "week"} (open shifts stay) and notifies staff.${lbl ? ` ${lbl}` : ""}`
        : `Birta vaktaplan ${shortDate(p.dates[0])}–${shortDate(last)}: ${p.shifts.length} vaktir hjá ${people} starfsmönnum, ${Math.round(hours)} klst. Kemur í stað allra vakta ${month ? "mánaðarins" : "vikunnar"} (lausar vaktir haldast) og starfsfólk fær tilkynningu.${lbl ? ` ${lbl}` : ""}` };
    }
    case "set_shift":
      if (!who || !okDate(input.date) || !okTime(input.start) || !okTime(input.end)) return { ok: false, error: "Vantar starfsmann, dagsetningu eða tíma (HH:MM)" };
      return { ok: true, summary: en ? `Set ${who}'s shift on ${input.date}: ${input.start}–${input.end}${str(input.shiftType) ? ` (${input.shiftType})` : ""}` : `Setja vakt hjá ${who} ${input.date}: ${input.start}–${input.end}${str(input.shiftType) ? ` (${input.shiftType})` : ""}` };
    case "remove_shift":
      if (!who || !okDate(input.date)) return { ok: false, error: "Vantar starfsmann eða dagsetningu" };
      return { ok: true, summary: en ? `Remove ${who}'s shift on ${input.date}` : `Eyða vakt hjá ${who} ${input.date}` };
    case "decide_leave":
      if (!str(input.id) || typeof input.approve !== "boolean") return { ok: false, error: "Vantar id eða ákvörðun" };
      return { ok: true, summary: `${input.approve ? (en ? "Approve" : "Samþykkja") : (en ? "Reject" : "Hafna")}: ${str(input.label) || str(input.id)}` };
    case "approve_swap":
      if (!str(input.id)) return { ok: false, error: "Vantar id" };
      return { ok: true, summary: `${en ? "Approve shift swap" : "Samþykkja vaktaskipti"}: ${str(input.label) || str(input.id)}` };
    case "clock_out":
      if (!who || !okTime(input.time)) return { ok: false, error: "Vantar starfsmann eða tíma" };
      return { ok: true, summary: en ? `Clock out ${who} at ${input.time}` : `Stimpla ${who} út kl. ${input.time}` };
    case "create_open_shifts": {
      const p = openShiftDates(input);
      if (!p.ok) return p;
      const n = openCount(input), note = openNote(input), total = n * p.dates.length;
      const span = p.dates.length === 1 ? shortDate(p.dates[0]) : `${shortDate(p.dates[0])}–${shortDate(p.dates[p.dates.length - 1])} (${p.dates.length} ${en ? "days" : "dagar"})`;
      return { ok: true, summary: en
        ? `Create ${total} open shift${total > 1 ? "s" : ""} ${span}, ${input.start}–${input.end}${n > 1 ? `, ${n} per day` : ""}${str(input.shiftType) ? ` (${input.shiftType})` : ""}${note ? ` · ${note}` : ""}. Staff are notified and can apply in the app.`
        : `Stofna ${total} ${total > 1 ? "lausar vaktir" : "lausa vakt"} ${span}, kl. ${input.start}–${input.end}${n > 1 ? `, ${n} á dag` : ""}${str(input.shiftType) ? ` (${input.shiftType})` : ""}${note ? ` · ${note}` : ""}. Starfsfólk fær tilkynningu og getur sótt um í appinu.` };
    }
    case "create_alert":
    case "schedule_report": {
      const n = alertInput(name, input);
      if (!n.ok) return n;
      const ch = n.rule.channel === "push" ? (en ? "push notification" : "push-tilkynning") : n.rule.channel === "both" ? (en ? "email and push" : "tölvupóstur og push") : (en ? "email" : "tölvupóstur");
      return { ok: true, summary: `${name === "schedule_report" ? (en ? "Schedule report" : "Sjálfvirk skýrsla") : (en ? "New alert" : "Nýr vaktari")}: ${describeAlert(n.rule, en ? "en" : "is")} · ${ch}` };
    }
    case "toggle_alert":
      if (!str(input.id) || typeof input.active !== "boolean") return { ok: false, error: "Vantar id eða stöðu" };
      return { ok: true, summary: `${input.active ? (en ? "Turn on alert" : "Kveikja á vaktara") : (en ? "Turn off alert" : "Slökkva á vaktara")}: ${str(input.label) || str(input.id)}` };
    case "delete_alert":
      if (!str(input.id)) return { ok: false, error: "Vantar id" };
      return { ok: true, summary: `${en ? "Delete alert" : "Eyða vaktara"}: ${str(input.label) || str(input.id)}` };
    case "send_report_now": {
      const rep = REPORTS.find((r) => r === input.report);
      if (!rep || !okDate(input.from) || !okDate(input.to) || str(input.to) < str(input.from)) return { ok: false, error: "Vantar skýrslu eða tímabil (YYYY-MM-DD)" };
      return { ok: true, summary: en
        ? `Email me the report "${REPORT_TITLE.en[rep]}" for ${shortDate(str(input.from))}–${shortDate(str(input.to))} (table + Excel)`
        : `Senda mér skýrsluna „${REPORT_TITLE.is[rep]}“ fyrir ${shortDate(str(input.from))}–${shortDate(str(input.to))} í tölvupósti (tafla + Excel)` };
    }
    case "close_punch":
      if (!str(input.punchId) || !okTime(input.out) || !okDate(input.outDate)) return { ok: false, error: "Vantar punchId, tíma eða dagsetningu" };
      return { ok: true, summary: str(input.label) || (en ? `Set clock-out ${input.outDate} ${input.out}` : `Setja útstimplun ${input.outDate} kl. ${input.out}`) };
    case "ask_correction":
      if (!who || !okDate(input.date) || !str(input.message).trim()) return { ok: false, error: "Vantar starfsmann, dagsetningu eða skilaboð" };
      return { ok: true, summary: en ? `Ask ${who} for the correct time on ${input.date}: "${str(input.message).slice(0, 160)}"` : `Biðja ${who} um réttan tíma ${input.date}: „${str(input.message).slice(0, 160)}“` };
    case "save_planning_rule": {
      const t = str(input.text).trim();
      if (t.length < 3) return { ok: false, error: "Vantar texta reglunnar" };
      return { ok: true, summary: en ? `Save planning rule: "${t.slice(0, MAX_RULE_LEN)}" — applies to every future AI schedule` : `Vista planreglu: „${t.slice(0, MAX_RULE_LEN)}“ — gildir í öllum AI-vaktaplönum héðan í frá` };
    }
    case "remove_planning_rule":
      if (!str(input.id)) return { ok: false, error: "Vantar id" };
      return { ok: true, summary: `${en ? "Delete planning rule" : "Eyða planreglu"}: ${str(input.label) || str(input.id)}` };
    case "resend_contract":
      if (!who) return { ok: false, error: "Vantar starfsmann" };
      return { ok: true, summary: `${en ? "Resend contract for signature" : "Senda samning aftur til undirritunar"}: ${str(input.label) || who}` };
  }
  return { ok: false, error: "Óþekkt aðgerð" };
}

/** Framkvæmir staðfesta aðgerð (kallað úr /api/assistant/execute eftir hlutverkaathugun). */
export async function executeWrite(name: string, input: In): Promise<{ ok: boolean; error?: string }> {
  switch (name) {
    case "plan_month":
    case "plan_week": {
      const p = parseWeekPlan(input, name);
      if (!p.ok) return p;
      // Öll nöfn verða að finnast ÁÐUR en nokkru er eytt (publishSchedule sleppir óþekktum nöfnum hljóðlaust).
      const { employees } = await getEmployees();
      const names = employees.map((e) => e.fullName.toLowerCase());
      const unknown = [...new Set(p.shifts.map((x) => x.employee))].filter((n) => !names.some((f) => f.startsWith(n.toLowerCase())));
      if (unknown.length) return { ok: false, error: `Starfsmaður fannst ekki: ${unknown.join(", ")}` };
      // Varnagli óháður líkaninu: ekkert er birt ef vakt lendir á samþykktu fríi.
      const reqs = await getPlanRequestsForMe(await createClient(), p.dates).catch(() => null);
      if (reqs) {
        const { dropped } = guardLeaveShifts(p.shifts, reqs, (x) => p.dates.indexOf(x.date));
        if (dropped.length) return { ok: false, error: `Vakt á samþykktu fríi: ${dropped.map((x) => `${x.employee} ${x.date}`).join(", ")} — taktu hana út og reyndu aftur.` };
      }
      // Ein deild: vaktir annarra deilda vikunnar haldast (bætt aftan við planið áður en vikan er hreinsuð).
      const dept = str(input.department).toLowerCase();
      if (dept) {
        const inPlan = new Set(p.shifts.map((x) => `${x.employee.toLowerCase()}|${x.date}`));
        const cur = await getShiftsInRange(p.dates[0], p.dates[p.dates.length - 1]);
        if (!cur.ok) return { ok: false, error: "Tókst ekki að lesa núverandi vaktir vikunnar" };
        for (const r of cur.rows) {
          if (r.name === "?" || r.dept.toLowerCase() === dept) continue;
          if (inPlan.has(`${r.first.toLowerCase()}|${r.date}`) || inPlan.has(`${r.name.toLowerCase()}|${r.date}`)) continue;
          p.shifts.push({ employee: r.name, date: r.date, start: r.start, end: r.end, shiftType: r.type ?? "" });
        }
      }
      const cleared = await deleteWeekShifts(p.dates);
      if (!cleared.ok) return { ok: false, error: "Tókst ekki að hreinsa vikuna" };
      const res = await publishSchedule(p.shifts.map((x) => ({ employeeName: x.employee, date: x.date, startTime: x.start, endTime: x.end, shiftTypeName: x.shiftType || "Dagvakt" })));
      return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Tókst ekki að birta planið" };
    }
    case "set_shift": {
      const date = str(input.date);
      const reqs = okDate(date) ? await getPlanRequestsForMe(await createClient(), [date]).catch(() => null) : null;
      if (reqs && guardLeaveShifts([{ employee: str(input.employee) }], reqs, () => 0).dropped.length)
        return { ok: false, error: `${str(input.employee)} er í samþykktu fríi ${date}.` };
      return saveShift({ employeeName: str(input.employee), date, startTime: str(input.start), endTime: str(input.end), shiftTypeName: str(input.shiftType) });
    }
    case "remove_shift":
      return deleteShift({ employeeName: str(input.employee), dateISO: str(input.date) });
    case "decide_leave":
      return updateLeaveRequest(str(input.id), input.approve === true);
    case "approve_swap":
      return approveShiftSwap(str(input.id));
    case "clock_out":
      return setClockOut({ employeeName: str(input.employee), time: str(input.time) });
    case "create_open_shifts": {
      const p = openShiftDates(input);
      if (!p.ok) return p;
      return createOpenShifts({ dates: p.dates, start: str(input.start).padStart(5, "0"), end: str(input.end).padStart(5, "0"), shiftTypeName: str(input.shiftType) || undefined, note: openNote(input) || undefined, count: openCount(input) });
    }
    case "create_alert":
    case "schedule_report": {
      const n = alertInput(name, input);
      if (!n.ok) return n;
      return createAlert(n.rule, "ai");
    }
    case "toggle_alert":
      return setAlertActive(str(input.id), input.active === true);
    case "delete_alert":
      return deleteAlert(str(input.id));
    case "send_report_now":
      return sendReportNow({ report: str(input.report), from: str(input.from), to: str(input.to) });
    case "close_punch": {
      // Innstimplunin er lesin úr grunninum (aldrei úr líkaninu) svo aðeins útstimplunin breytist.
      const { data: p } = await (await createClient()).from("punches").select("clock_in").eq("id", str(input.punchId)).maybeSingle();
      if (!p?.clock_in) return { ok: false, error: "Stimplunin fannst ekki" };
      const ci = new Date(p.clock_in as string);
      const inHM = `${String(ci.getHours()).padStart(2, "0")}:${String(ci.getMinutes()).padStart(2, "0")}`;
      return adjustPunch(str(input.punchId), inHM, str(input.out).padStart(5, "0"), { inDate: (p.clock_in as string).slice(0, 10), outDate: str(input.outDate) });
    }
    case "ask_correction": {
      const { employees } = await getEmployees();
      const hits = matchStaff(employees, str(input.employee));
      if (!hits.length) return { ok: false, error: `Starfsmaður fannst ekki: ${str(input.employee)}` };
      if (hits.length > 1) return { ok: false, error: `Fleiri en einn passar: ${hits.map((e) => e.fullName).join(", ")}` };
      return askForCorrection({ employeeId: hits[0].id, date: str(input.date), message: str(input.message) });
    }
    case "save_planning_rule":
      return addPlanningRule(str(input.text), "ai");
    case "remove_planning_rule":
      return deletePlanningRule(str(input.id));
    case "resend_contract": {
      const { employees } = await getEmployees();
      const hits = matchStaff(employees.filter((e) => e.status !== "inactive"), str(input.employee));
      if (!hits.length) return { ok: false, error: `Starfsmaður fannst ekki: ${str(input.employee)}` };
      if (hits.length > 1) return { ok: false, error: `Fleiri en einn passar: ${hits.map((e) => e.fullName).join(", ")} — tilgreindu fullt nafn.` };
      return resendContract(hits[0].id);
    }
  }
  return { ok: false, error: "Óþekkt aðgerð" };
}
