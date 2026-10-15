// Persónulegur póstur frá Bjarna daginn eftir nýskráningu. Hrein föll (engin gögn sótt) svo
// sama texta má forskoða og senda handvirkt (scripts/send-followup.ts). Keyrsla: signup-followup.server.ts.

export type FollowupStage = "no_staff" | "no_schedule" | "going";
export type FollowupInput = { firstName: string; company: string; hasStaff: boolean; hasSchedule: boolean };

export const FOLLOWUP_FROM = "Bjarni Lúðvíksson <bjarni@vakto.is>";
export const FOLLOWUP_REPLY_TO = "bjarni@vakto.is";

export function followupStage(o: Pick<FollowupInput, "hasStaff" | "hasSchedule">): FollowupStage {
  if (!o.hasStaff) return "no_staff";
  if (!o.hasSchedule) return "no_schedule";
  return "going";
}

const SIG = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1d1d1f">
  <tr>
    <td style="padding:0 14px 0 0;vertical-align:middle">
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>
        <td style="vertical-align:bottom;padding:0 2px 0 0"><div style="width:6px;height:10px;background:#f59331;border-radius:2px;font-size:0;line-height:0">&nbsp;</div></td>
        <td style="vertical-align:bottom;padding:0 2px 0 0"><div style="width:6px;height:16px;background:#e9700f;border-radius:2px;font-size:0;line-height:0">&nbsp;</div></td>
        <td style="vertical-align:bottom;padding:0 7px 0 0"><div style="width:6px;height:22px;background:#cf5f0c;border-radius:2px;font-size:0;line-height:0">&nbsp;</div></td>
        <td style="vertical-align:bottom;padding:0;font-size:16px;line-height:16px;font-weight:700;letter-spacing:2px;color:#1d1d1f">VAKTO</td>
      </tr></table>
    </td>
    <td style="padding:0 0 0 14px;border-left:2px solid #f2e6da;vertical-align:middle">
      <div style="font-size:15px;font-weight:700;line-height:20px;color:#1d1d1f">Bjarni Lúðvíksson</div>
      <div style="font-size:13px;line-height:18px;color:#6e6e73">Stofnandi</div>
      <div style="font-size:13px;line-height:20px;padding-top:6px;color:#1d1d1f">
        <a href="tel:+3548411448" style="color:#1d1d1f;text-decoration:none">+354 841 1448</a>
        &nbsp;·&nbsp; <a href="mailto:bjarni@vakto.is" style="color:#1d1d1f;text-decoration:none">bjarni@vakto.is</a>
        &nbsp;·&nbsp; <a href="https://www.vakto.is" style="color:#e9700f;text-decoration:none;font-weight:600">vakto.is</a>
      </div>
      <div style="font-size:12px;line-height:17px;color:#86868b;padding-top:4px">Vaktaplan, stimpilklukka og laun á einum stað.</div>
    </td>
  </tr>
</table>`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function followupEmail(o: FollowupInput): { subject: string; text: string; html: string } {
  const name = o.firstName.trim() || "";
  const stage = followupStage(o);
  const middle = {
    no_staff: "Ég sé að starfsfólkið er ekki komið inn enn. Það er fyrsta skrefið, og ef þú vilt get ég sett það inn fyrir þig. Sendu mér bara lista, úr Excel, Payday eða bara nöfn og netföng, og ég klára það.",
    no_schedule: "Starfsfólkið er komið inn, flott! Næsta skref er fyrsta vaktaplanið. Það tekur nokkrar mínútur, og þegar það er birt sér starfsfólkið vaktirnar sínar í VAKTO-appinu.",
    going: "Ég sé að þið eruð komin vel af stað með vaktaplanið, frábært. Er eitthvað sem vantar eða mætti virka betur? Ég les öll svör sjálfur.",
  }[stage];
  const paras = [
    `Hæ${name ? ` ${name}` : ""} 😊`,
    `Takk fyrir að skrá ${o.company} í VAKTO. Ég heiti Bjarni og bjó kerfið til, og mig langaði bara að heyra hvernig gengur.`,
    middle,
    "Ef eitthvað er óljóst, svaraðu bara þessum pósti eða hringdu í mig í 841 1448. Ég hjálpa ykkur gjarnan að koma ykkur af stað.",
  ];
  const subject = name ? `Hvernig gengur með VAKTO, ${name}?` : "Hvernig gengur með VAKTO?";
  const text = `${paras.join("\n\n")}\n\nKveðja,\nBjarni\n\nBjarni Lúðvíksson · Stofnandi VAKTO\n+354 841 1448 · bjarni@vakto.is · vakto.is`;
  const p = (s: string) => `<p style="margin:0 0 14px">${esc(s)}</p>`;
  const html = `<div style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1d1d1f;max-width:600px">
${paras.map(p).join("\n")}
<p style="margin:0 0 18px">Kveðja,<br>Bjarni</p>
${SIG}
</div>`;
  return { subject, text, html };
}
