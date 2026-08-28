-- ============================================
-- GridPulse — Forza Horizon Stats & Leaderboards
-- Supabase Migration: Initial Schema + RLS
-- ============================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  gamertag text unique not null,
  display_name text,
  avatar_url text,
  preferred_units text default 'mph' check (preferred_units in ('mph', 'kph')),
  total_races integer default 0,
  total_distance_miles float default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Anyone can read profiles
create policy "Profiles are viewable by everyone" on public.profiles
  for select using (true);

-- Users can insert their own profile
create policy "Users can create their own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Users can update their own profile  
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- ============================================
-- CARS (Reference Data)
-- ============================================
create table public.cars (
  ordinal integer primary key, -- Forza car ordinal ID
  name text not null,
  manufacturer text not null,
  year integer,
  default_class text check (default_class in ('D', 'C', 'B', 'A', 'S1', 'S2', 'X')),
  default_pi integer,
  drivetrain text check (drivetrain in ('FWD', 'RWD', 'AWD')),
  game text default 'FH6' check (game in ('FH4', 'FH5', 'FH6', 'FM')),
  created_at timestamptz default now()
);

alter table public.cars enable row level security;

-- Everyone can read cars
create policy "Cars are viewable by everyone" on public.cars
  for select using (true);

-- Only service role can insert/update cars (admin seeding)
create policy "Only service role can manage cars" on public.cars
  for all using (auth.role() = 'service_role');

-- ============================================
-- SPRINT RECORDS (0-60, 1/4 mile, top speed, etc.)
-- ============================================
create table public.sprint_records (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  car_ordinal integer, -- nullable if car not in our DB yet
  car_class text not null check (car_class in ('D', 'C', 'B', 'A', 'S1', 'S2', 'X')),
  car_pi integer not null check (car_pi between 100 and 999),
  drivetrain text check (drivetrain in ('FWD', 'RWD', 'AWD')),
  category text not null check (category in (
    '0-60', '0-100', '60-130',
    'quarter_mile', 'half_mile',
    'top_speed', 'braking_100_0'
  )),
  time_seconds float, -- null for top_speed category
  speed_mph float,    -- trap speed or top speed
  distance_feet float, -- for braking distance
  telemetry_proof jsonb, -- 5-second telemetry snippet for verification
  verified boolean default false,
  flagged boolean default false,
  created_at timestamptz default now()
);

alter table public.sprint_records enable row level security;

-- Create indexes for leaderboard queries
create index idx_sprint_category on public.sprint_records(category);
create index idx_sprint_class on public.sprint_records(car_class);
create index idx_sprint_user on public.sprint_records(user_id);
create index idx_sprint_created on public.sprint_records(created_at desc);
create index idx_sprint_leaderboard on public.sprint_records(category, car_class, time_seconds asc nulls last);

-- Everyone can read sprint records
create policy "Sprint records are viewable by everyone" on public.sprint_records
  for select using (true);

-- Users can insert their own records
create policy "Users can insert their own sprint records" on public.sprint_records
  for insert with check (auth.uid() = user_id);

-- Users cannot update or delete records (immutable leaderboard)
-- Only service role can update (for verification/flagging)
create policy "Service role can update sprint records" on public.sprint_records
  for update using (auth.role() = 'service_role');

-- ============================================
-- DAILY AWARDS (Hottest Tire, G-Force King, etc.)
-- ============================================
create table public.daily_awards (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  car_ordinal integer,
  car_class text check (car_class in ('D', 'C', 'B', 'A', 'S1', 'S2', 'X')),
  car_pi integer,
  award_type text not null check (award_type in (
    'hottest_tire', 'g_force_gladiator', 'drift_king',
    'brake_cooker', 'suspension_slammer', 'rev_limiter_addict',
    'speed_demon', 'launch_master'
  )),
  value float not null, -- the measured value (temp, Gs, mph, seconds, etc.)
  unit text not null, -- 'fahrenheit', 'g', 'degrees', 'mph', 'seconds', 'meters'
  telemetry_proof jsonb,
  award_date date default current_date,
  created_at timestamptz default now()
);

alter table public.daily_awards enable row level security;

-- Indexes
create index idx_awards_type_date on public.daily_awards(award_type, award_date);
create index idx_awards_user on public.daily_awards(user_id);
create index idx_awards_leaderboard on public.daily_awards(award_type, award_date, value desc);

-- Everyone can read
create policy "Daily awards are viewable by everyone" on public.daily_awards
  for select using (true);

-- Users can insert their own
create policy "Users can submit their own daily awards" on public.daily_awards
  for insert with check (auth.uid() = user_id);

-- Immutable
create policy "Service role can update daily awards" on public.daily_awards
  for update using (auth.role() = 'service_role');

-- ============================================
-- HALL OF FAME (Daily award winners, archived)
-- ============================================
create table public.hall_of_fame (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  gamertag text not null, -- denormalized for persistence
  award_type text not null,
  value float not null,
  unit text not null,
  car_ordinal integer,
  car_class text,
  car_pi integer,
  award_date date not null,
  created_at timestamptz default now()
);

alter table public.hall_of_fame enable row level security;

create index idx_hof_date on public.hall_of_fame(award_date desc);
create index idx_hof_type on public.hall_of_fame(award_type);

create policy "Hall of fame is viewable by everyone" on public.hall_of_fame
  for select using (true);

create policy "Only service role can manage hall of fame" on public.hall_of_fame
  for all using (auth.role() = 'service_role');

-- ============================================
-- SESSIONS (tracking play sessions)
-- ============================================
create table public.sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  game text default 'FH6',
  started_at timestamptz default now(),
  ended_at timestamptz,
  total_distance_miles float default 0,
  total_packets integer default 0,
  cars_driven integer[] default '{}', -- array of car ordinals
  created_at timestamptz default now()
);

alter table public.sessions enable row level security;

create policy "Users can view their own sessions" on public.sessions
  for select using (auth.uid() = user_id);

create policy "Users can insert their own sessions" on public.sessions
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own sessions" on public.sessions
  for update using (auth.uid() = user_id);

-- ============================================
-- VIEWS for Leaderboard Queries
-- ============================================

-- Sprint leaderboard view with profile info
create or replace view public.sprint_leaderboard as
select
  sr.id,
  sr.category,
  sr.car_class,
  sr.car_pi,
  sr.drivetrain,
  sr.car_ordinal,
  sr.time_seconds,
  sr.speed_mph,
  sr.distance_feet,
  sr.created_at,
  sr.verified,
  p.gamertag,
  p.avatar_url,
  c.name as car_name,
  c.manufacturer as car_manufacturer,
  row_number() over (
    partition by sr.category, sr.car_class
    order by 
      case when sr.category = 'top_speed' then sr.speed_mph end desc nulls last,
      case when sr.category != 'top_speed' then sr.time_seconds end asc nulls last
  ) as rank
from public.sprint_records sr
join public.profiles p on sr.user_id = p.id
left join public.cars c on sr.car_ordinal = c.ordinal
where sr.flagged = false;

-- Today's daily award leaders
create or replace view public.daily_award_leaders as
select
  da.id,
  da.award_type,
  da.value,
  da.unit,
  da.car_ordinal,
  da.car_class,
  da.car_pi,
  da.award_date,
  da.created_at,
  p.gamertag,
  p.avatar_url,
  c.name as car_name,
  c.manufacturer as car_manufacturer,
  row_number() over (
    partition by da.award_type, da.award_date
    order by da.value desc
  ) as rank
from public.daily_awards da
join public.profiles p on da.user_id = p.id
left join public.cars c on da.car_ordinal = c.ordinal;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, gamertag)
  values (new.id, coalesce(new.raw_user_meta_data->>'gamertag', 'Racer_' || substr(new.id::text, 1, 8)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Updated_at trigger
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at();
