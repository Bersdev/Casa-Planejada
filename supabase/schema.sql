-- Casa Planejada: esquema completo (tabelas, regras de acesso e funções)

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  daily_limit numeric(12,2) not null default 500,
  housing_ref_pct numeric(5,2) not null default 30,
  notify_days int not null default 3,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#2563eb',
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table invites (
  code text primary key,
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days'
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  emoji text not null default '📦',
  sort int not null default 0
);

create table incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid not null references auth.users(id),
  name text not null,
  amount numeric(12,2) not null,
  day int not null default 5,
  kind text not null default 'recurring' check (kind in ('recurring','oneoff')),
  start_month text not null,
  end_month text,
  contrib_mode text not null default 'full' check (contrib_mode in ('full','fixed','percent')),
  contrib_value numeric(12,2) not null default 0,
  link_id uuid,
  created_at timestamptz not null default now()
);

create table income_months (
  income_id uuid not null references incomes(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  month text not null,
  amount numeric(12,2),
  contrib_mode text check (contrib_mode in ('full','fixed','percent')),
  contrib_value numeric(12,2),
  primary key (income_id, month)
);

create table reserves (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  goal numeric(12,2),
  emoji text not null default '🐷',
  created_at timestamptz not null default now()
);

create table bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null,
  due_day int not null default 5,
  kind text not null default 'recurring' check (kind in ('recurring','oneoff')),
  start_month text not null,
  end_month text,
  payer_id uuid references auth.users(id),
  scope text not null default 'house' check (scope in ('house','personal')),
  owner_id uuid references auth.users(id),
  is_housing boolean not null default false,
  category_id uuid references categories(id) on delete set null,
  split_mode text not null default 'prop' check (split_mode in ('prop','equal','custom')),
  split jsonb not null default '{}',
  reserve_id uuid references reserves(id) on delete set null,
  link_id uuid,
  created_at timestamptz not null default now()
);

create table bill_months (
  bill_id uuid not null references bills(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  month text not null,
  amount numeric(12,2),
  due_day int,
  paid boolean not null default false,
  paid_at timestamptz,
  skipped boolean not null default false,
  primary key (bill_id, month)
);

create table cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  name text not null,
  bank text not null default '',
  color text not null default '#1f2937',
  closing_day int not null default 28,
  due_day int not null default 5,
  credit_limit numeric(12,2) not null default 0,
  default_scope text not null default 'personal' check (default_scope in ('house','personal')),
  created_at timestamptz not null default now()
);

create table card_invoices (
  card_id uuid not null references cards(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  month text not null,
  paid boolean not null default false,
  paid_at timestamptz,
  primary key (card_id, month)
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  date date not null default current_date,
  amount numeric(12,2) not null default 0,
  merchant text not null default '',
  category_id uuid references categories(id) on delete set null,
  method text not null default 'pix' check (method in ('pix','card','cash','debit')),
  card_id uuid references cards(id) on delete set null,
  installments int not null default 1 check (installments between 1 and 48),
  scope text not null default 'house' check (scope in ('house','personal')),
  owner_id uuid references auth.users(id),
  created_by uuid references auth.users(id),
  status text not null default 'confirmed' check (status in ('pending','confirmed')),
  receipt_path text,
  note text,
  link_id uuid,
  created_at timestamptz not null default now()
);

create table works (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  total_cost numeric(12,2),
  created_at timestamptz not null default now()
);

create table work_installments (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references works(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  due_date date not null,
  amount numeric(12,2) not null,
  description text not null default '',
  paid boolean not null default false,
  paid_at timestamptz,
  payer_id uuid references auth.users(id)
);

create table reserve_moves (
  id uuid primary key default gen_random_uuid(),
  reserve_id uuid not null references reserves(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  date date not null default current_date,
  amount numeric(12,2) not null,
  note text not null default '',
  bill_id uuid references bills(id) on delete set null,
  month text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table app_secrets (key text primary key, value text not null);

create index on expenses (household_id, date);
create index on bill_months (household_id, month);
create index on members (user_id);

-- Regras de acesso: só membros da casa enxergam e alteram os dados dela
create function is_member(h uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where household_id = h and user_id = auth.uid())
$$;

alter table households enable row level security;
alter table members enable row level security;
alter table push_subscriptions enable row level security;
alter table app_secrets enable row level security;

create policy households_select on households for select to authenticated using (is_member(id));
create policy households_update on households for update to authenticated using (is_member(id)) with check (is_member(id));
create policy members_select on members for select to authenticated using (is_member(household_id));
create policy members_update on members for update to authenticated using (is_member(household_id)) with check (is_member(household_id));
create policy push_own on push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['invites','categories','incomes','income_months','reserves','bills','bill_months',
    'cards','card_invoices','expenses','works','work_installments','reserve_moves'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to authenticated using (is_member(household_id)) with check (is_member(household_id))', t || '_member', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on app_secrets from authenticated;

-- Funções chamadas pelo app
create function create_household(p_name text, p_member_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into households (name, created_by) values (p_name, auth.uid()) returning id into h;
  insert into members (household_id, user_id, name, color, role) values (h, auth.uid(), p_member_name, '#2563eb', 'owner');
  insert into categories (household_id, name, emoji, sort) values
    (h,'Mercado','🛒',1),(h,'Padaria','🥖',2),(h,'Farmácia','💊',3),(h,'Restaurante','🍽️',4),
    (h,'Transporte','🚗',5),(h,'Casa','🏠',6),(h,'Saúde','🩺',7),(h,'Lazer','🎉',8),(h,'Outros','📦',9);
  return h;
end $$;

create function create_invite(p_household uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_member(p_household) then raise exception 'forbidden'; end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into invites (code, household_id, created_by) values (c, p_household, auth.uid());
  return c;
end $$;

create function join_household(p_code text, p_member_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid; n int; palette text[] := array['#f43f5e','#10b981','#f59e0b','#8b5cf6','#06b6d4'];
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select household_id into h from invites where code = upper(trim(p_code)) and expires_at > now();
  if h is null then raise exception 'convite inválido ou vencido'; end if;
  select count(*) into n from members where household_id = h;
  insert into members (household_id, user_id, name, color)
    values (h, auth.uid(), p_member_name, palette[1 + ((n - 1) % 5)])
    on conflict do nothing;
  return h;
end $$;

-- Usada pelo servidor (avisos diários e backup), protegida por segredo
create function cron_dump(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb := '{}'; t text; rows jsonb;
begin
  -- app_secrets guarda só o hash (sha256) do CRON_SECRET, na chave 'cron_hash'
  if not exists (select 1 from app_secrets where key = 'cron_hash' and value = encode(sha256(convert_to(p_secret, 'UTF8')), 'hex')) then
    raise exception 'forbidden';
  end if;
  foreach t in array array['households','members','categories','incomes','income_months','reserves','bills','bill_months',
    'cards','card_invoices','expenses','works','work_installments','reserve_moves','push_subscriptions'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from %I x', t) into rows;
    r := r || jsonb_build_object(t, rows);
  end loop;
  return r;
end $$;

revoke execute on function create_household(text, text), create_invite(uuid), join_household(text, text), is_member(uuid) from public, anon;
grant execute on function create_household(text, text), create_invite(uuid), join_household(text, text), is_member(uuid) to authenticated;
grant execute on function cron_dump(text) to anon, authenticated;

-- Fotos das notas: pasta por casa, só membros acessam
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict do nothing;
create policy receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.is_member(((storage.foldername(name))[1])::uuid));

-- Referências entre tabelas só valem dentro da mesma casa (chaves compostas com household_id)
alter table bills add constraint bills_id_house_key unique (id, household_id);
alter table incomes add constraint incomes_id_house_key unique (id, household_id);
alter table cards add constraint cards_id_house_key unique (id, household_id);
alter table works add constraint works_id_house_key unique (id, household_id);
alter table reserves add constraint reserves_id_house_key unique (id, household_id);
alter table categories add constraint categories_id_house_key unique (id, household_id);

alter table bill_months drop constraint bill_months_bill_id_fkey,
  add constraint bill_months_bill_fk foreign key (bill_id, household_id) references bills (id, household_id) on delete cascade;
alter table income_months drop constraint income_months_income_id_fkey,
  add constraint income_months_income_fk foreign key (income_id, household_id) references incomes (id, household_id) on delete cascade;
alter table card_invoices drop constraint card_invoices_card_id_fkey,
  add constraint card_invoices_card_fk foreign key (card_id, household_id) references cards (id, household_id) on delete cascade;
alter table work_installments drop constraint work_installments_work_id_fkey,
  add constraint work_installments_work_fk foreign key (work_id, household_id) references works (id, household_id) on delete cascade;
alter table reserve_moves drop constraint reserve_moves_reserve_id_fkey,
  add constraint reserve_moves_reserve_fk foreign key (reserve_id, household_id) references reserves (id, household_id) on delete cascade;
alter table reserve_moves drop constraint reserve_moves_bill_id_fkey,
  add constraint reserve_moves_bill_fk foreign key (bill_id, household_id) references bills (id, household_id) on delete set null (bill_id);
alter table expenses drop constraint expenses_card_id_fkey,
  add constraint expenses_card_fk foreign key (card_id, household_id) references cards (id, household_id) on delete set null (card_id);
alter table expenses drop constraint expenses_category_id_fkey,
  add constraint expenses_category_fk foreign key (category_id, household_id) references categories (id, household_id) on delete set null (category_id);
alter table bills drop constraint bills_category_id_fkey,
  add constraint bills_category_fk foreign key (category_id, household_id) references categories (id, household_id) on delete set null (category_id);
alter table bills drop constraint bills_reserve_id_fkey,
  add constraint bills_reserve_fk foreign key (reserve_id, household_id) references reserves (id, household_id) on delete set null (reserve_id);

-- Limite diário de leituras de nota por pessoa (protege a cota grátis da Groq)
create table receipt_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
alter table receipt_usage enable row level security;
revoke all on receipt_usage from anon, authenticated;

create function use_receipt_quota() returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null or not exists (select 1 from members where user_id = auth.uid()) then return false; end if;
  insert into receipt_usage (user_id, day, count) values (auth.uid(), (now() at time zone 'America/Sao_Paulo')::date, 1)
    on conflict (user_id, day) do update set count = receipt_usage.count + 1
    returning count into n;
  return n <= 60;
end $$;
revoke execute on function use_receipt_quota() from public, anon;
grant execute on function use_receipt_quota() to authenticated;
