-- 0092 — Business Central: bókhaldslyklar fyrirtækisins fyrir launabókun (færslubók í BC).
-- {"laun":"5010","launatengd":"5110","ogreidd":"7500","stadgreidsla":"7510","lifeyrir":"7520","felog":"7530","trygg":"7540","orlof":"7550","batch":"VAKTO"}
alter table public.companies add column if not exists bc_payaccounts jsonb;
