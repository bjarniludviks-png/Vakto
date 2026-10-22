// VAKTO AI úr appinu: sami bakendi og á vefnum, en innskráning með Bearer-lykli
// (sjá lib/supabase/server.ts). /api/app/** er opið í proxy; leiðirnar sannreyna sjálfar.
export { POST } from "../../assistant/route";
export const maxDuration = 180;
