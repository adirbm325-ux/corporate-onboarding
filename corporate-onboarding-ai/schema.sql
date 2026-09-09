-- Corporate Onboarding AI — סכמת בסיס נתונים ל-Supabase
-- Checkpoint 3A
--
-- הרצה: העתק את כל הקובץ והדבק ב-Supabase Dashboard → SQL Editor → Run.
-- ניתן להריץ שוב בבטחה הודות ל-IF NOT EXISTS בכל טבלה.
--
-- הערת אבטחה חשובה: מדיניות ה-RLS כאן מוגדרת "demo allow all" — פתוחה
-- לחלוטין (true/true), כי האפליקציה עדיין לא כוללת אימות משתמשים אמיתי
-- (זה מתוכנן ל-Checkpoint 3B). זה מתאים אך ורק לשלב פיתוח/דמו על נתונים
-- שאינם אמיתיים. לפני כל שימוש עם נתונים אמיתיים או משתמשים מרובים,
-- יש להחליף את המדיניות הזו במדיניות שמבוססת על auth.uid() בפועל.

create table if not exists branch_settings (
  id text primary key default 'default',
  service_provider_name text default '',
  service_provider_company_number text default '',
  branch_name text default '',
  branch_number text default '',
  user_count text default '',
  target_minutes text default '',
  reminder_policy text default '',
  updated_at timestamptz default now()
);

create table if not exists cases (
  id text primary key,
  name text not null,
  company_number text,
  field text,
  address text,
  contact_name text,
  contact_phone text,
  contact_email text,
  service_type text,
  courier_involved boolean default false,
  status text,
  assignee text,
  updated_at text,
  documents jsonb default '[]',
  ai_suggestions jsonb default '[]',
  remote_id jsonb default '{}',
  portal_token text,
  created_at timestamptz default now()
);

create table if not exists people (
  id text primary key,
  case_id text references cases(id) on delete cascade,
  full_name text,
  role text,
  partial_id text,
  phone text,
  email text,
  kind text,
  primary_owner boolean default false,
  verified_remote_id boolean default false
);

create table if not exists couriers (
  id text primary key,
  case_id text references cases(id) on delete cascade,
  full_name text,
  id_number text,
  dob text,
  gender text,
  address text,
  phone text,
  email text,
  active boolean default true,
  auth_start text,
  auth_end text
);

create table if not exists forms (
  id text primary key,
  case_id text references cases(id) on delete cascade,
  form_type text not null,
  version int default 1,
  assigned_person_id text,
  assigned_person_role text,
  mandatory boolean default true,
  status text default 'not_started',
  completion_percent int default 0,
  data jsonb default '{}',
  validation_errors jsonb default '[]',
  signed_by text,
  signed_at text,
  signature_method text,
  stamp_applied boolean default false,
  stamp_applied_at text,
  submitted_at text,
  reviewed_by text,
  reviewed_at text,
  review_notes text,
  history jsonb default '[]',
  created_at text,
  updated_at text
);

create table if not exists tasks (
  id text primary key,
  case_id text references cases(id) on delete cascade,
  case_name text,
  type text,
  priority text,
  assignee text,
  due text,
  status text,
  created_ago text
);

-- יומן הפעילות אינו קושר case_id ישירות (כמו בקוד הקיים, שמזהה תיק לפי
-- caseName בלבד) — נשמר תואם למבנה המקורי כדי לא לשנות לוגיקה קיימת.
create table if not exists activity (
  id text primary key,
  case_name text,
  text text,
  time text,
  created_at timestamptz default now()
);

alter table branch_settings enable row level security;
alter table cases enable row level security;
alter table people enable row level security;
alter table couriers enable row level security;
alter table forms enable row level security;
alter table tasks enable row level security;
alter table activity enable row level security;

drop policy if exists "demo allow all - branch_settings" on branch_settings;
drop policy if exists "demo allow all - cases" on cases;
drop policy if exists "demo allow all - people" on people;
drop policy if exists "demo allow all - couriers" on couriers;
drop policy if exists "demo allow all - forms" on forms;
drop policy if exists "demo allow all - tasks" on tasks;
drop policy if exists "demo allow all - activity" on activity;

create policy "demo allow all - branch_settings" on branch_settings for all using (true) with check (true);
create policy "demo allow all - cases" on cases for all using (true) with check (true);
create policy "demo allow all - people" on people for all using (true) with check (true);
create policy "demo allow all - couriers" on couriers for all using (true) with check (true);
create policy "demo allow all - forms" on forms for all using (true) with check (true);
create policy "demo allow all - tasks" on tasks for all using (true) with check (true);
create policy "demo allow all - activity" on activity for all using (true) with check (true);
