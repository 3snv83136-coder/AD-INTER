-- Présence en temps réel (qui est connecté)

create table if not exists presences (
  id          uuid primary key default gen_random_uuid(),
  session_key text not null unique,
  login       text not null,
  role        text not null,
  label       text not null,
  path        text,
  last_seen   timestamptz not null default now()
);

create index if not exists presences_last_seen_idx on presences (last_seen desc);
