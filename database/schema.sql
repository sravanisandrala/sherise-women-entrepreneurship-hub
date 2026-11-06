-- SheRise database schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 100),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  category text not null,
  description text not null check (char_length(description) between 10 and 1500),
  product_name text not null,
  price numeric(12,2) not null check (price >= 0),
  contact_email text not null,
  city text not null,
  status text not null default 'active' check (status in ('active','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  message text not null check (char_length(message) between 5 and 1000),
  status text not null default 'new' check (status in ('new','responded','closed')),
  created_at timestamptz not null default now(),
  unique (business_id, sender_id, created_at)
);

create table if not exists public.mentor_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  topic text not null check (char_length(topic) between 3 and 120),
  goals text not null check (char_length(goals) between 10 and 1000),
  preferred_contact text not null,
  status text not null default 'pending' check (status in ('pending','accepted','completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.funding_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  provider text not null,
  description text not null,
  eligibility text not null,
  official_url text,
  category text not null default 'General',
  created_at timestamptz not null default now()
);

create index if not exists businesses_owner_idx on public.businesses(owner_id);
create index if not exists businesses_category_idx on public.businesses(category);
create index if not exists businesses_created_idx on public.businesses(created_at desc);
create index if not exists inquiries_business_idx on public.inquiries(business_id);
create index if not exists mentor_requests_user_idx on public.mentor_requests(user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at before update on public.businesses
for each row execute function public.set_updated_at();

-- The Express server uses the service-role key and enforces ownership in every route.
-- RLS is enabled as defence-in-depth; never expose the service-role key to browsers.
alter table public.users enable row level security;
alter table public.businesses enable row level security;
alter table public.inquiries enable row level security;
alter table public.mentor_requests enable row level security;
alter table public.funding_resources enable row level security;

insert into public.funding_resources (title, provider, description, eligibility, official_url, category)
select 'Stand-Up India', 'Government of India', 'Information about bank loans for eligible greenfield enterprises promoted by women and other eligible entrepreneurs.', 'Check current scheme rules, applicant eligibility and participating bank requirements on the official portal.', 'https://www.standupmitra.in/', 'Loans'
where not exists (select 1 from public.funding_resources where title='Stand-Up India');
insert into public.funding_resources (title, provider, description, eligibility, official_url, category)
select 'Women Entrepreneurship Platform', 'NITI Aayog', 'A platform connecting women entrepreneurs with ecosystem resources, learning and support.', 'Review current programme availability and eligibility on the official website.', 'https://wep.gov.in/', 'Mentorship'
where not exists (select 1 from public.funding_resources where title='Women Entrepreneurship Platform');
