-- MiCuadra — esquema inicial (Fase 0)
-- Corresponde 1:1 al modelo de datos descrito en CLAUDE.md.

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('efectivo','banco','ahorro','tarjeta','credito','inversion')),
  color text,
  initial bigint not null default 0,
  line bigint not null default 0,          -- banco: línea de crédito
  cupo bigint not null default 0,          -- tarjeta: cupo total
  cierre int,                              -- tarjeta: día de cierre
  venc int,                                -- tarjeta: día de vencimiento
  cuota_value bigint,                      -- crédito
  cuotas_restantes int,                    -- crédito
  pago_dia int,                            -- crédito
  venc_month text,                         -- crédito
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('gasto','ingreso')),
  prioridad text check (prioridad in ('obligaciones','necesidades','gustos')),
  icon text,
  color text
);

create table movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('gasto','ingreso','transferencia','cuotaTC','pagoTarjeta','pagoCredito','pagoLinea')),
  amount bigint not null,
  month text not null,                     -- 'YYYY-MM'
  status text not null default 'confirmado' check (status in ('pendiente','confirmado','cuadrado')),
  merchant text,
  note text,
  account_id uuid references accounts(id) on delete cascade,
  from_id uuid references accounts(id) on delete cascade,
  to_id uuid references accounts(id) on delete cascade,
  card_id uuid references accounts(id) on delete cascade,
  credit_id uuid references accounts(id) on delete cascade,
  bank_id uuid references accounts(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  cuota_index int,
  cuotas_total int,
  purchase_group uuid,
  ts timestamptz not null default now()
);

create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  category_id uuid not null references categories(id) on delete cascade,
  amount bigint not null default 0,
  unique (user_id, month, category_id)
);

create table scheduled (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null,
  amount bigint not null,
  account_id uuid references accounts(id) on delete cascade,
  day int
);

-- ---------- RLS: todas las tablas, sin excepciones ----------

alter table accounts enable row level security;
alter table categories enable row level security;
alter table movements enable row level security;
alter table budgets enable row level security;
alter table scheduled enable row level security;

create policy "accounts: solo dueño" on accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "categories: solo dueño" on categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "movements: solo dueño" on movements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "budgets: solo dueño" on budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "scheduled: solo dueño" on scheduled
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
