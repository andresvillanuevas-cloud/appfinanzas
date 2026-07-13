-- Gastos recurrentes a tarjeta de crédito (seguros, suscripciones).
-- Extiende `scheduled` (no tabla paralela):
--   target_type: 'cuenta' = programado clásico (toca dinero real al confirmar)
--                'tarjeta' = gasto recurrente a TC (al aprobar genera una cuotaTC
--                            1/1 en el mes: sube "por facturar", consume presupuesto,
--                            NO toca caja)
--   card_id / category_id / merchant: solo aplican cuando target_type='tarjeta'
--   (categoría obligatoria en ese caso — se valida en la UI).
alter table scheduled
  add column if not exists target_type text not null default 'cuenta',
  add column if not exists card_id uuid references accounts(id) on delete cascade,
  add column if not exists category_id uuid references categories(id) on delete set null,
  add column if not exists merchant text;
