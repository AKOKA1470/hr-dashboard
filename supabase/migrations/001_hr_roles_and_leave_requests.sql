begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'employee' check (role in ('hr','manager','employee')),
  department text not null default 'Technology',
  created_at timestamptz not null default now()
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.profiles(id) on delete cascade,
  employee_name text not null,
  department text not null,
  leave_type text not null check (leave_type in ('Earned leave','Sick leave','Casual leave')),
  start_date date not null,
  end_date date not null,
  reason text not null default '',
  status text not null default 'Pending' check (status in ('Pending','Approved','Declined')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index leave_requests_department_idx on public.leave_requests(department);
create index leave_requests_employee_idx on public.leave_requests(employee_id);

alter table public.profiles enable row level security;
alter table public.leave_requests enable row level security;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.my_department() returns text
language sql stable security definer set search_path = '' as $$
  select department from public.profiles where id = auth.uid()
$$;

-- First account becomes HR; everyone else starts as employee. HR changes roles from the dashboard.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  dept text := coalesce(nullif(new.raw_user_meta_data ->> 'department',''), 'Technology');
begin
  if dept not in ('Technology','Operations','Creative','Finance','HR','Sales') then
    dept := 'Technology';
  end if;
  insert into public.profiles (id, full_name, email, role, department)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    case when exists (select 1 from public.profiles) then 'employee' else 'hr' end,
    dept
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.my_role() = 'hr'
  or (public.my_role() = 'manager' and department = public.my_department())
);
create policy profiles_update_hr on public.profiles for update to authenticated
  using (public.my_role() = 'hr') with check (public.my_role() = 'hr');

create policy leave_select on public.leave_requests for select to authenticated using (
  employee_id = auth.uid()
  or public.my_role() = 'hr'
  or (public.my_role() = 'manager' and department = public.my_department())
);

-- Forces owner/department/status from the caller's profile so clients cannot forge them.
-- Skipped when there is no JWT (migrations/seeding run as postgres).
create or replace function public.prepare_leave_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  if auth.uid() is null then
    return new;
  end if;
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then raise exception 'Profile not found'; end if;
  new.employee_id := p.id;
  new.employee_name := coalesce(nullif(p.full_name,''), p.email);
  new.department := p.department;
  new.status := 'Pending';
  new.reviewed_by := null;
  new.reviewed_by_name := null;
  new.reviewed_at := null;
  return new;
end;
$$;

create trigger before_leave_insert before insert on public.leave_requests
  for each row execute function public.prepare_leave_request();

create policy leave_insert_own on public.leave_requests for insert to authenticated
  with check (auth.uid() is not null);

create or replace function public.review_leave_request(request_id uuid, decision text)
returns public.leave_requests
language plpgsql security definer set search_path = '' as $$
declare
  reviewer public.profiles;
  req public.leave_requests;
begin
  if decision not in ('Approved','Declined') then raise exception 'Invalid decision'; end if;
  select * into reviewer from public.profiles where id = auth.uid();
  if reviewer.id is null or reviewer.role not in ('hr','manager') then
    raise exception 'Not allowed to review leave requests';
  end if;
  select * into req from public.leave_requests where id = request_id for update;
  if req.id is null then raise exception 'Request not found'; end if;
  if req.employee_id = reviewer.id then raise exception 'You cannot review your own request'; end if;
  if reviewer.role = 'manager' and req.department <> reviewer.department then
    raise exception 'Managers can only review their own department';
  end if;
  if req.status <> 'Pending' then raise exception 'Request already reviewed'; end if;

  update public.leave_requests
     set status = decision,
         reviewed_by = reviewer.id,
         reviewed_by_name = coalesce(nullif(reviewer.full_name,''), reviewer.email),
         reviewed_at = now()
   where id = request_id
  returning * into req;
  return req;
end;
$$;

revoke execute on function public.review_leave_request(uuid, text) from public, anon;
grant execute on function public.review_leave_request(uuid, text) to authenticated;

insert into public.leave_requests (employee_id, employee_name, department, leave_type, start_date, end_date, status)
select null, v.n, v.d, v.t, v.s::date, v.e::date, v.st from (values
  ('Ananya Rao','Technology','Earned leave','2026-09-25','2026-09-27','Pending'),
  ('Rohan Mehta','Creative','Sick leave','2026-09-24','2026-09-24','Approved'),
  ('Nisha Thomas','Finance','Casual leave','2026-09-30','2026-09-30','Pending'),
  ('Vikram Singh','Operations','Earned leave','2026-10-02','2026-10-04','Approved'),
  ('Sara Khan','HR','Casual leave','2026-09-26','2026-09-26','Declined')
) as v(n,d,t,s,e,st);

commit;
