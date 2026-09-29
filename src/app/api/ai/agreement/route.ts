import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readAgreement } from "@/lib/ai/agreement";

// POST multipart: file (PDF eða .txt), hint (hlutverk/starfsaldur). Aðeins eigandi/
// vaktstjóri. Route handler (ekki server action) því kjarasamningar eru oft stærri
// en 1 MB takmark server actions. Skilar tillögu — vistar ekkert.
export const maxDuration = 300;

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Ekki innskráð(ur)" }, { status: 401 });
  const { data: u } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (u?.role !== "owner" && u?.role !== "manager") return NextResponse.json({ ok: false, error: "Aðeins stjórnendur" }, { status: 403 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ ok: false, error: "Ógild beiðni" }, { status: 400 }); }
  const file = form.get("file");
  const hint = String(form.get("hint") ?? "").slice(0, 500);
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ ok: false, error: "Veldu skjal" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "Skjalið er stærra en 25 MB" }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const isPdf = file.type === "application/pdf" || buf.subarray(0, 5).toString() === "%PDF-";
  const isText = !isPdf && (file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name));
  if (!isPdf && !isText) return NextResponse.json({ ok: false, error: "Aðeins PDF eða textaskrá" }, { status: 415 });

  const res = await readAgreement(isPdf ? { pdfBase64: buf.toString("base64"), hint } : { text: buf.toString("utf8"), hint });
  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
