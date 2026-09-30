import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestSignCode, signWithCode, metaFrom, taktikalEmployeeLink } from "@/lib/esign.server";

// Rafræn undirritun úr appinu (0058). Appið talar beint við Supabase, en undirritun
// fer um þjóninn: kóði á netfang, staðfesting, undirritunarskrá og PDF til beggja.
// Auth: Supabase access token starfsmannsins (Bearer).
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ ok: false, error: "Ekki innskráð(ur)" }, { status: 401 });
  let body: { action?: string; id?: string; code?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ógild beiðni" }, { status: 400 }); }
  const { action, id } = body;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "Ógild beiðni" }, { status: 400 });

  const { data: auth } = await createAdminClient().auth.getUser(token);
  if (!auth.user) return NextResponse.json({ ok: false, error: "Ekki innskráð(ur)" }, { status: 401 });
  const caller = { userId: auth.user.id, email: auth.user.email ?? null };

  if (action === "code") return NextResponse.json(await requestSignCode(caller, id));
  if (action === "taktikal") return NextResponse.json(await taktikalEmployeeLink({ userId: caller.userId }, id));
  if (action === "sign") return NextResponse.json(await signWithCode(caller, id, String(body.code ?? ""), metaFrom(req.headers)));
  return NextResponse.json({ ok: false, error: "Ógild aðgerð" }, { status: 400 });
}
