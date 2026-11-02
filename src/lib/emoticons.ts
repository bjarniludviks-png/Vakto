// Broskallar → emoji þegar skilaboð eru send („:)“ → 🙂). Aðeins stakir broskallar
// (bil/upphaf/endir báðum megin) svo slóðir eins og https://… eða tímar 10:30 haldist óbreyttir.
// ATH: sama skrá er í src/lib/emoticons.ts og mobile/src/lib/emoticons.ts — halda í takt.
const MAP: Record<string, string> = {
  ":)": "🙂", ":-)": "🙂", "(:": "🙂", ":D": "😀", ":-D": "😀", "xD": "😆", "XD": "😆",
  ";)": "😉", ";-)": "😉", ":(": "🙁", ":-(": "🙁", ":'(": "😢", ":P": "😛", ":p": "😛", ":-P": "😛",
  ":O": "😮", ":o": "😮", ":*": "😘", "<3": "❤️", "</3": "💔", ":|": "😐", "B)": "😎", "8)": "😎", "^^": "😊",
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RE = new RegExp(`(^|\\s)(${Object.keys(MAP).sort((a, b) => b.length - a.length).map(esc).join("|")})(?=$|\\s|[.,!?])`, "g");

export function emojify(text: string): string {
  return text.replace(RE, (_, pre: string, tok: string) => pre + (MAP[tok] ?? tok));
}
