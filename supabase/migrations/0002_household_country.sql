-- Add country + currency to households (region-based pricing & budget).
-- country is ISO 3166-1 alpha-2 (e.g. 'PK'); currency is ISO 4217 (e.g. 'PKR').

alter table public.households add column if not exists country  text;
alter table public.households add column if not exists currency text;
