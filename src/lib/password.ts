// Lykilorðareglur (NIST 800-63B): lengd skiptir máli, samsetningarkröfur ekki.
// Notað bæði í vafra (styrkmælir) og á þjóni (validatePassword í password.server.ts).

export const PASSWORD_MIN = 12;

// Algeng lykilorð og mynstur sem uppfylla lengdina en eru samt ónýt.
const COMMON = [
  "123456789012", "1234567890123", "password1234", "passwordpassword", "qwertyuiopas", "qwertyuiop123",
  "lykilordlykilord", "lykilord1234", "lykilorð1234", "vaktovaktovakto", "iloveyou1234", "abcdefghijkl",
  "aaaaaaaaaaaa", "111111111111", "000000000000", "welcome12345", "letmein12345", "admin1234567",
];

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;   // 0 = tómt/ónothæft … 4 = mjög sterkt
  label: string;
  ok: boolean;                 // uppfyllir lágmark (lengd + ekki algengt)
  reason?: string;             // hvers vegna ekki ok
};

const seq = "abcdefghijklmnopqrstuvwxyz0123456789";
function hasLongSequence(pw: string): boolean {
  const s = pw.toLowerCase();
  for (let i = 0; i + 4 <= s.length; i++) {
    const part = s.slice(i, i + 4);
    if (seq.includes(part) || seq.includes([...part].reverse().join(""))) return true;
  }
  return false;
}
function hasRepeat(pw: string): boolean { return /(.)\1{3,}/.test(pw); }

export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "", ok: false, reason: "Lykilorð vantar" };
  const lower = pw.toLowerCase().replace(/\s+/g, "");
  if (pw.length < PASSWORD_MIN) return { score: pw.length >= 8 ? 1 : 0, label: "Of stutt", ok: false, reason: `Lykilorðið þarf a.m.k. ${PASSWORD_MIN} stafi — setning með bilum er fín.` };
  if (COMMON.some((c) => lower.includes(c))) return { score: 1, label: "Of algengt", ok: false, reason: "Þetta lykilorð er of algengt — veldu annað." };
  if (hasRepeat(pw) || hasLongSequence(pw)) return { score: 1, label: "Of fyrirsjáanlegt", ok: false, reason: "Endurtekningar og runur (1234, abcd) gera lykilorðið fyrirsjáanlegt." };

  // Gróft entropy-mat: lengd × fjölbreytni stafa.
  const classes = [/[a-záðéíóúýþæö]/, /[A-ZÁÐÉÍÓÚÝÞÆÖ]/, /\d/, /[^\p{L}\p{N}]/u].filter((r) => r.test(pw)).length;
  const words = pw.trim().split(/\s+/).length;
  const bits = pw.length * (classes >= 3 ? 5.2 : classes === 2 ? 4.3 : 3.5) + (words >= 3 ? 8 : 0);
  const score: 2 | 3 | 4 = bits >= 80 ? 4 : bits >= 62 ? 3 : 2;
  return { score, label: score === 4 ? "Mjög sterkt" : score === 3 ? "Sterkt" : "Í lagi", ok: true };
}
