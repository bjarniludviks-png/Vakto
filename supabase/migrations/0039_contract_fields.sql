-- Pension fund per employee + company-wide custom contract terms.
alter table employees add column if not exists pension_fund text;
alter table companies add column if not exists contract_terms text;
