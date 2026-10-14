// Íslensk kennitala: 10 tölustafir, vartala (9. stafur) reiknuð með vægjum 3,2,7,6,5,4,3,2.
// Lögaðilar hafa 40 bætt við daginn (41–71). Notað í nýskráningu (kennitala fyrirtækis).

export function normalizeKennitala(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

export function isValidKennitala(input: string): boolean {
  const kt = normalizeKennitala(input);
  if (kt.length !== 10) return false;
  const d = kt.split("").map(Number);
  const w = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = w.reduce((a, x, i) => a + x * d[i], 0);
  const r = 11 - (sum % 11);
  const check = r === 11 ? 0 : r;
  if (check === 10 || check !== d[8]) return false;
  const day = Number(kt.slice(0, 2)) % 40, month = Number(kt.slice(2, 4));
  return day >= 1 && day <= 31 && month >= 1 && month <= 12 && (d[9] === 9 || d[9] === 0 || d[9] === 8);
}

/** Birtingarform: 000000-0000. */
export function formatKennitala(input: string): string {
  const kt = normalizeKennitala(input);
  return kt.length === 10 ? `${kt.slice(0, 6)}-${kt.slice(6)}` : input;
}
