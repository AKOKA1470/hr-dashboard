alter table public.departments
  add column code text,
  add column description text,
  add column is_active boolean not null default true,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

update public.departments
set code = case name
  when 'Executive Leadership' then 'EXEC'
  when 'Human Resources' then 'HR'
  when 'Finance' then 'FIN'
  when 'Business Development' then 'BD'
  when 'Product Design' then 'DESIGN'
  else left(
    coalesce(
      nullif(trim(both '_' from upper(regexp_replace(name, '[^A-Za-z0-9]+', '_', 'g'))), ''),
      'DEPT'
    ),
    12
  ) || '_' || upper(substr(replace(id::text, '-', ''), 1, 6))
end
where code is null;

alter table public.departments
  alter column code set not null,
  add constraint departments_code_unique unique (code),
  add constraint departments_code_format check (code ~ '^[A-Z0-9_]{2,20}$');

insert into public.departments (name, code, description)
values
  ('Executive Leadership', 'EXEC', 'Executive leadership'),
  ('Human Resources', 'HR', 'Human resources and recruiting'),
  ('Finance', 'FIN', 'Finance'),
  ('Business Development', 'BD', 'Business development'),
  ('Product Design', 'DESIGN', 'Product design')
on conflict (name) do update
set description = coalesce(public.departments.description, excluded.description);

create table public.designations (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  code text not null unique check (code ~ '^[A-Z0-9_]{2,30}$'),
  department_id uuid references public.departments (id) on delete set null,
  level smallint check (level is null or level between 1 and 20),
  description text,
  is_managerial boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.designations (title, code, department_id, level, is_managerial)
select seed.title, seed.code, department.id, seed.level, seed.is_managerial
from (values
  ('CEO and HRO', 'CEO_HRO', 'EXEC', 1, true),
  ('HR Head', 'HR_HEAD', 'HR', 2, true),
  ('Team Lead', 'HR_TL', 'HR', 3, true),
  ('Recruiter', 'RECRUITER', 'HR', 4, false),
  ('Finance Head', 'FIN_HEAD', 'FIN', 2, true),
  ('Finance Manager', 'FIN_MANAGER', 'FIN', 3, true),
  ('Business Development Associate', 'BDA', 'BD', 4, false),
  ('UI/UX Designer', 'UI_UX', 'DESIGN', 4, false)
) as seed(title, code, department_code, level, is_managerial)
join public.departments as department on department.code = seed.department_code
on conflict (code) do update
set title = excluded.title,
    department_id = excluded.department_id,
    level = excluded.level,
    is_managerial = excluded.is_managerial,
    updated_at = now();

create table public.employee_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique
    references public.profiles (id) on delete restrict,
  employee_number text not null unique
    check (length(trim(employee_number)) between 1 and 50),
  work_email text not null,
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  middle_name text check (middle_name is null or length(middle_name) <= 100),
  last_name text check (last_name is null or length(last_name) <= 100),
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  department_id uuid references public.departments (id) on delete set null,
  designation_id uuid references public.designations (id) on delete set null,
  manager_id uuid references public.employee_profiles (id) on delete set null,
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time', 'part_time', 'contract', 'intern', 'consultant')),
  employment_status text not null default 'active'
    check (employment_status in ('draft', 'preboarding', 'active', 'on_leave', 'suspended', 'exited')),
  date_of_joining date not null,
  date_of_leaving date,
  phone_number text,
  profile_photo_url text,
  location text,
  time_zone text not null default 'Asia/Kolkata',
  emergency_contact_name text,
  emergency_contact_phone text,
  account_status text not null default 'invited'
    check (account_status in ('invited', 'active', 'disabled', 'locked')),
  induction_status text not null default 'not_assigned'
    check (induction_status in ('not_assigned', 'assigned', 'in_progress', 'completed', 'overdue', 'exempted')),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_profiles_email_format check (
    work_email::text ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  constraint employee_profiles_not_own_manager check (manager_id is null or manager_id <> id),
  constraint employee_profiles_dates_valid check (
    date_of_leaving is null or date_of_leaving >= date_of_joining
  )
);

create table public.employee_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{2,30}$'),
  description text,
  is_system_role boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.employee_roles (name, code, description, is_system_role)
values
  ('Employee', 'employee', 'Standard employee access', true),
  ('Manager', 'manager', 'Access to direct-report management functions', true),
  ('HR Administrator', 'hr_admin', 'Access to HR administration and employee records', true),
  ('System Administrator', 'system_admin', 'Full platform administration access', true)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_system_role = excluded.is_system_role;

create table public.employee_role_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employee_profiles (id) on delete cascade,
  role_id uuid not null references public.employee_roles (id) on delete restrict,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint employee_role_assignment_unique unique (employee_id, role_id),
  constraint employee_role_expiry_valid check (expires_at is null or expires_at > assigned_at)
);

create table public.employee_manager_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employee_profiles (id) on delete cascade,
  manager_id uuid references public.employee_profiles (id) on delete set null,
  effective_from date not null,
  effective_to date,
  change_reason text,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint employee_manager_history_not_self check (manager_id is null or manager_id <> employee_id),
  constraint employee_manager_history_dates_valid check (
    effective_to is null or effective_to >= effective_from
  )
);

create table public.employee_import_staging (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  row_number integer not null check (row_number > 0),
  employee_number text,
  work_email text,
  first_name text,
  middle_name text,
  last_name text,
  display_name text,
  department_code text,
  designation_code text,
  manager_work_email text,
  date_of_joining date,
  employment_type text,
  validation_status text not null default 'pending'
    check (validation_status in ('pending', 'valid', 'invalid', 'imported', 'skipped')),
  validation_errors jsonb not null default '[]'::jsonb
    check (jsonb_typeof(validation_errors) = 'array'),
  matched_user_id uuid references auth.users (id) on delete set null,
  matched_employee_id uuid references public.employee_profiles (id) on delete set null,
  matched_manager_id uuid references public.employee_profiles (id) on delete set null,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  constraint employee_import_batch_row_unique unique (batch_id, row_number)
);

create index employee_profiles_department_idx on public.employee_profiles (department_id);
create index employee_profiles_designation_idx on public.employee_profiles (designation_id);
create index employee_profiles_manager_idx on public.employee_profiles (manager_id);
create index employee_profiles_status_idx on public.employee_profiles (employment_status);
create index employee_profiles_display_name_idx on public.employee_profiles (display_name);
create unique index employee_profiles_work_email_unique_idx
  on public.employee_profiles (lower(work_email));
create index employee_manager_history_employee_idx on public.employee_manager_history (employee_id);
create index employee_manager_history_manager_idx on public.employee_manager_history (manager_id);
create unique index employee_manager_history_one_current_idx
  on public.employee_manager_history (employee_id)
  where effective_to is null;
create index employee_import_staging_batch_idx on public.employee_import_staging (batch_id);
create index employee_import_staging_email_idx
  on public.employee_import_staging (lower(work_email));

create function public.touch_employee_directory_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger departments_touch_updated_at
before update on public.departments
for each row execute function public.touch_employee_directory_updated_at();

create trigger designations_touch_updated_at
before update on public.designations
for each row execute function public.touch_employee_directory_updated_at();

create trigger employee_profiles_touch_updated_at
before update on public.employee_profiles
for each row execute function public.touch_employee_directory_updated_at();

create function public.prevent_employee_manager_cycle()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.manager_id is null then
    return new;
  end if;

  if new.manager_id = new.id then
    raise exception 'An employee cannot report to themselves' using errcode = '23514';
  end if;

  if exists (
    with recursive manager_chain (employee_id, manager_id) as (
      select employee.id, employee.manager_id
      from public.employee_profiles as employee
      where employee.id = new.manager_id
      union
      select manager.id, manager.manager_id
      from public.employee_profiles as manager
      join manager_chain as chain on manager.id = chain.manager_id
    )
    select 1 from manager_chain where employee_id = new.id
  ) then
    raise exception 'Reporting assignments cannot create a management cycle' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger employee_profiles_prevent_manager_cycle
before insert or update of manager_id on public.employee_profiles
for each row execute function public.prevent_employee_manager_cycle();

create function public.record_employee_manager_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if tg_op = 'UPDATE' and old.manager_id is not distinct from new.manager_id then
    return new;
  end if;

  update public.employee_manager_history
  set effective_to = current_date
  where employee_id = new.id and effective_to is null;

  insert into public.employee_manager_history (
    employee_id, manager_id, effective_from, change_reason, changed_by
  ) values (
    new.id,
    new.manager_id,
    current_date,
    case when tg_op = 'INSERT' then 'Initial reporting assignment' else 'Reporting manager changed' end,
    auth.uid()
  );
  return new;
end;
$$;

create function public.can_read_employee_directory_profile(
  p_employee_user_id uuid,
  p_manager_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select auth.uid() = p_employee_user_id
    or public.current_app_role() = 'hr_admin'
    or (
      public.current_app_role() = 'manager'
      and exists (
        select 1 from public.employee_profiles as manager
        where manager.id = p_manager_id and manager.user_id = auth.uid()
      )
    )
$$;

create function public.can_read_employee_manager_history(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select public.current_app_role() = 'hr_admin'
    or exists (
      select 1
      from public.employee_profiles as employee
      where employee.id = p_employee_id
        and (
          employee.user_id = auth.uid()
          or (
            public.current_app_role() = 'manager'
            and exists (
              select 1 from public.employee_profiles as manager
              where manager.id = employee.manager_id and manager.user_id = auth.uid()
            )
          )
        )
    )
$$;

create trigger employee_profiles_record_manager_change
after insert or update of manager_id on public.employee_profiles
for each row execute function public.record_employee_manager_change();

alter table public.departments enable row level security;
alter table public.designations enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.employee_roles enable row level security;
alter table public.employee_role_assignments enable row level security;
alter table public.employee_manager_history enable row level security;
alter table public.employee_import_staging enable row level security;

create policy "Authenticated users can read active designations"
  on public.designations for select to authenticated
  using (auth.uid() is not null and is_active);

create policy "Employees read authorized directory profiles"
  on public.employee_profiles for select to authenticated
  using (public.can_read_employee_directory_profile(user_id, manager_id));

create policy "Authenticated users can read employee role catalog"
  on public.employee_roles for select to authenticated
  using (auth.uid() is not null);

create policy "Users read their assigned employee roles"
  on public.employee_role_assignments for select to authenticated
  using (
    public.current_app_role() = 'hr_admin'
    or exists (
      select 1 from public.employee_profiles as employee
      where employee.id = employee_role_assignments.employee_id
        and employee.user_id = auth.uid()
    )
  );

create policy "Employees read authorized manager history"
  on public.employee_manager_history for select to authenticated
  using (public.can_read_employee_manager_history(employee_id));

create policy "HR can read employee import staging"
  on public.employee_import_staging for select to authenticated
  using (public.current_app_role() = 'hr_admin');

revoke all on public.designations, public.employee_profiles, public.employee_roles,
  public.employee_role_assignments, public.employee_manager_history,
  public.employee_import_staging from anon, authenticated;
grant select on public.departments to authenticated;
grant select (id, title, code, department_id, level, description, is_managerial, is_active)
  on public.designations to authenticated;
grant select (
  id, user_id, employee_number, work_email, first_name, middle_name, last_name,
  display_name, department_id, designation_id, manager_id, employment_type,
  employment_status, date_of_joining, date_of_leaving, location, time_zone,
  account_status, induction_status, created_at, updated_at
) on public.employee_profiles to authenticated;
grant select on public.employee_roles to authenticated;
grant select on public.employee_role_assignments to authenticated;
grant select on public.employee_manager_history to authenticated;
grant select on public.employee_import_staging to authenticated;

revoke all on function public.prevent_employee_manager_cycle() from public, anon, authenticated;
revoke all on function public.record_employee_manager_change() from public, anon, authenticated;
revoke all on function public.touch_employee_directory_updated_at() from public, anon, authenticated;
revoke all on function public.can_read_employee_directory_profile(uuid, uuid) from public, anon;
revoke all on function public.can_read_employee_manager_history(uuid) from public, anon;
grant execute on function public.can_read_employee_directory_profile(uuid, uuid) to authenticated;
grant execute on function public.can_read_employee_manager_history(uuid) to authenticated;
