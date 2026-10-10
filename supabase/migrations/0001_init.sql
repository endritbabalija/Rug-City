-- Who Rugged? schema.
-- Players and rooms are versioned JSON documents updated with compare-and-swap
-- from the server (service role). RLS is on with no policies, so the anon key
-- cannot read or write anything. Clients only receive "room changed" pings over
-- Realtime broadcast (topic room:<code>) and refetch through the API.

create table if not exists public.players (
  id          bigint primary key,            -- Telegram user id
  doc         jsonb  not null,
  version     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.rooms (
  code        text primary key check (code ~ '^[A-Z0-9]{5}$'),
  doc         jsonb  not null,
  version     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists rooms_updated_at_idx on public.rooms (updated_at);

create table if not exists public.purchases (
  id          uuid primary key,
  user_id     bigint not null,
  sku         text not null,
  stars       integer not null check (stars > 0),
  status      text not null check (status in ('pending', 'paid', 'refunded')),
  charge_id   text unique,                   -- telegram_payment_charge_id
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists purchases_user_idx on public.purchases (user_id, created_at desc);

alter table public.players   enable row level security;
alter table public.rooms     enable row level security;
alter table public.purchases enable row level security;
