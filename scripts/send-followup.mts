// Sendir persónulega póstinn (src/lib/signup-followup.ts) handvirkt.
//   npx tsx scripts/send-followup.mts --preview=bjarni@bgl.is        → öll þrjú afbrigðin á eitt netfang
//   npx tsx scripts/send-followup.mts --to=a@b.is --name=Jón --company="X ehf" --stage=no_staff
// Les RESEND_API_KEY úr .env.local. Merkir EKKI companies.followup_sent_at — gerðu það sjálf/ur ef við á.
import fs from "node:fs";
import { followupEmail, FOLLOWUP_FROM, FOLLOWUP_REPLY_TO, type FollowupStage } from "../src/lib/signup-followup";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const flags = (s: FollowupStage) => ({ hasStaff: s !== "no_staff", hasSchedule: s === "going" });

async function send(to: string, subject: string, text: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FOLLOWUP_FROM, to: [to], reply_to: FOLLOWUP_REPLY_TO, subject, text, html }),
  });
  console.log(to, r.status, await r.text());
}

const preview = arg("preview");
if (preview) {
  for (const s of ["no_staff", "no_schedule", "going"] as FollowupStage[]) {
    const m = followupEmail({ firstName: "Haukur", company: "Faktura ehf", ...flags(s) });
    await send(preview, `[PRUFA ${s}] ${m.subject}`, m.text, m.html);
  }
} else {
  const to = arg("to"), stage = (arg("stage") ?? "no_staff") as FollowupStage;
  if (!to) throw new Error("--to vantar");
  const m = followupEmail({ firstName: arg("name") ?? "", company: arg("company") ?? "", ...flags(stage) });
  await send(to, m.subject, m.text, m.html);
}
