-- Nýskráð fyrirtæki komast ekki inn fyrr en kort er skráð hjá Straumi.
-- Sett true við nýskráningu, false þegar Tokenization-webhook skilar korti (eða admin setur greiðslustöðu handvirkt).
alter table companies add column if not exists card_required boolean not null default false;
