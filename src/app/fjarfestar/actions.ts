"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, passwordOk, token } from "./gate";

export async function unlock(fd: FormData) {
  const pw = String(fd.get("pw") ?? "");
  await new Promise((r) => setTimeout(r, 400)); // hægir á ágiskunum
  if (!passwordOk(pw)) redirect("/fjarfestar?villa=1");
  (await cookies()).set(COOKIE, token(), { httpOnly: true, secure: true, sameSite: "lax", path: "/fjarfestar", maxAge: 30 * 864e2 });
  redirect("/fjarfestar");
}
