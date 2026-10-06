create type public.app_role as enum ('hr_admin', 'manager', 'employee');
create type public.leave_type as enum ('earned', 'sick', 'casual');
create type public.leave_status as enum ('pending', 'approved', 'declined');

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 120)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  unique (department_id, name),
  unique (department_id, id)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 160),
  role public.app_role not null,
  department_id uuid references public.departments (id) on delete restrict,
  team_id uuid,
  constraint profiles_team_department_fkey
    foreign key (department_id, team_id)
    references public.teams (department_id, id) on delete restrict,
  constraint non_hr_profiles_need_department
    check (role = 'hr_admin' or department_id is not null),
  constraint profile_team_needs_department
    check (team_id is null or department_id is not null)
);

create table public.manager_scopes (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.profiles (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete restrict,
  team_id uuid,
  constraint manager_scopes_team_department_fkey
    foreign key (department_id, team_id)
    references public.teams (department_id, id) on delete restrict
);

create index manager_scopes_manager_department_idx
  on public.manager_scopes (manager_id, department_id);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete restrict,
  department_id uuid not null references public.departments (id) on delete restrict,
  team_id uuid,
  leave_type public.leave_type not null,
  start_date date not null,
  end_date date not null,
  days integer generated always as (end_date - start_date + 1) stored,
  reason text check (reason is null or length(reason) <= 2000),
  status public.leave_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id) on delete restrict,
  decided_at timestamptz,
  constraint leave_requests_dates_valid
    check (end_date >= start_date and end_date - start_date < 366),
  constraint leave_requests_team_department_fkey
    foreign key (department_id, team_id)
    references public.teams (department_id, id) on delete restrict,
  constraint leave_requests_decision_fields_consistent check (
    (status = 'pending' and decided_by is null and decided_at is null)
    or
    (status in ('approved', 'declined') and decided_by is not null and decided_at is not null)
  )
);

create index leave_requests_employee_created_idx
  on public.leave_requests (employee_id, created_at desc);
create index leave_requests_department_team_status_idx
  on public.leave_requests (department_id, team_id, status);

create table public.leave_decisions (
  id uuid primary key default gen_random_uuid(),
  leave_request_id uuid not null references public.leave_requests (id) on delete restrict,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  previous_status public.leave_status not null,
  new_status public.leave_status not null
    check (new_status in ('approved', 'declined')),
  created_at timestamptz not null default now(),
  check (previous_status = 'pending')
);

create index leave_decisions_request_created_idx
  on public.leave_decisions (leave_request_id, created_at desc);

create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid()
$$;

create function public.has_manager_scope(
  p_department_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.manager_scopes as scope
    where scope.manager_id = auth.uid()
      and scope.department_id = p_department_id
      and (scope.team_id is null or scope.team_id = p_team_id)
  )
$$;

alter table public.departments enable row level security;
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.manager_scopes enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_decisions enable row level security;

create policy "Authenticated users can read departments"
  on public.departments for select to authenticated
  using (auth.uid() is not null);

create policy "Authenticated users can read teams"
  on public.teams for select to authenticated
  using (auth.uid() is not null);

create policy "Users read only authorized profiles"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.current_app_role() = 'hr_admin'
    or (
      public.current_app_role() = 'manager'
      and public.has_manager_scope(department_id, team_id)
    )
  );

create policy "Managers and HR read assigned scopes"
  on public.manager_scopes for select to authenticated
  using (
    manager_id = auth.uid()
    or public.current_app_role() = 'hr_admin'
  );

create policy "Users read only authorized leave requests"
  on public.leave_requests for select to authenticated
  using (
    employee_id = auth.uid()
    or public.current_app_role() = 'hr_admin'
    or (
      public.current_app_role() = 'manager'
      and public.has_manager_scope(department_id, team_id)
    )
  );

create policy "Users read decisions for authorized requests"
  on public.leave_decisions for select to authenticated
  using (
    public.current_app_role() = 'hr_admin'
    or exists (
      select 1
      from public.leave_requests as request
      where request.id = leave_request_id
    )
  );

create function public.submit_leave_request(
  p_leave_type public.leave_type,
  p_start_date date,
  p_end_date date,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  employee public.profiles%rowtype;
  new_request_id uuid;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into employee
  from public.profiles
  where id = actor_id;

  if not found or employee.role <> 'employee' then
    raise exception 'Only an assigned employee can submit leave' using errcode = '42501';
  end if;

  if employee.department_id is null
    or p_start_date is null
    or p_end_date is null
    or p_end_date < p_start_date
    or p_end_date - p_start_date >= 366 then
    raise exception 'Invalid leave dates or employee department' using errcode = '22023';
  end if;

  if p_reason is not null and length(p_reason) > 2000 then
    raise exception 'Reason must be 2000 characters or fewer' using errcode = '22023';
  end if;

  insert into public.leave_requests (
    employee_id, department_id, team_id, leave_type, start_date, end_date, reason
  ) values (
    actor_id, employee.department_id, employee.team_id, p_leave_type,
    p_start_date, p_end_date, nullif(trim(p_reason), '')
  )
  returning id into new_request_id;

  return new_request_id;
end;
$$;

create function public.decide_leave_request(
  p_request_id uuid,
  p_decision public.leave_status
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.app_role;
  request public.leave_requests%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  actor_role := public.current_app_role();
  if actor_role is null or actor_role not in ('hr_admin', 'manager') then
    raise exception 'Only HR or an authorized manager can decide leave' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('approved', 'declined') then
    raise exception 'Decision must be approved or declined' using errcode = '22023';
  end if;

  select * into request
  from public.leave_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Leave request not found or not authorized' using errcode = '42501';
  end if;

  if actor_role = 'manager'
    and not public.has_manager_scope(request.department_id, request.team_id) then
    raise exception 'Leave request not found or not authorized' using errcode = '42501';
  end if;

  if request.status <> 'pending' then
    raise exception 'Leave request has already been decided' using errcode = '40001';
  end if;

  update public.leave_requests
  set status = p_decision,
      decided_by = actor_id,
      decided_at = now()
  where id = request.id;

  insert into public.leave_decisions (
    leave_request_id, actor_id, previous_status, new_status
  ) values (
    request.id, actor_id, request.status, p_decision
  );
end;
$$;

revoke all on public.departments, public.teams, public.profiles,
  public.manager_scopes, public.leave_requests, public.leave_decisions
  from anon, authenticated;
grant select on public.departments, public.teams, public.profiles,
  public.manager_scopes, public.leave_requests, public.leave_decisions
  to authenticated;

revoke all on function public.current_app_role() from public, anon;
revoke all on function public.has_manager_scope(uuid, uuid) from public, anon;
revoke all on function public.submit_leave_request(
  public.leave_type, date, date, text
) from public, anon;
revoke all on function public.decide_leave_request(
  uuid, public.leave_status
) from public, anon;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.has_manager_scope(uuid, uuid) to authenticated;
grant execute on function public.submit_leave_request(
  public.leave_type, date, date, text
) to authenticated;
grant execute on function public.decide_leave_request(
  uuid, public.leave_status
) to authenticated;

grant usage on type public.app_role, public.leave_type, public.leave_status
  to authenticated;
