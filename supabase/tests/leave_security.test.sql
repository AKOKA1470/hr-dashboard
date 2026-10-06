begin;

select plan(18);

insert into public.departments (id, name) values
  ('10000000-0000-4000-8000-000000000001', 'Test department');
insert into public.teams (id, department_id, name) values
  ('20000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001', 'Authorized team'),
  ('20000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000001', 'Other team');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('30000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'hr@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('30000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'manager@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('30000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'employee-one@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('30000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'employee-two@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('30000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
   'unprovisioned@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, full_name, role, department_id, team_id) values
  ('30000000-0000-4000-8000-000000000001', 'Test HR', 'hr_admin', null, null),
  ('30000000-0000-4000-8000-000000000002', 'Test Manager', 'manager',
   '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000003', 'Employee One', 'employee',
   '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000004', 'Employee Two', 'employee',
   '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');

insert into public.manager_scopes (manager_id, department_id, team_id) values
  ('30000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001');

insert into public.leave_requests (
  id, employee_id, department_id, team_id, leave_type, start_date, end_date, reason
) values
  ('40000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001',
   'earned', current_date + 5, current_date + 6, 'Team one test'),
  ('40000000-0000-4000-8000-000000000002',
   '30000000-0000-4000-8000-000000000004',
   '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000002',
   'casual', current_date + 7, current_date + 7, 'Team two test'),
  ('40000000-0000-4000-8000-000000000003',
   '30000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001',
   'sick', current_date + 9, current_date + 9, 'HR-only decision test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);

select is(
  (select count(*)::integer from public.leave_requests),
  2,
  'Employee reads only their own leave requests'
);
select is(
  (select count(*)::integer from public.profiles),
  1,
  'Employee reads only their own profile'
);
select throws_ok(
  $$select public.decide_leave_request(
    '40000000-0000-4000-8000-000000000001', 'approved'
  )$$,
  '42501',
  'Employee cannot decide a leave request'
);
select lives_ok(
  $$select public.submit_leave_request(
    'earned', current_date + 20, current_date + 21, 'Submitted by test employee'
  )$$,
  'Employee can submit a leave request'
);
select is(
  (select count(*)::integer from public.leave_requests),
  3,
  'Submitted request is attributed to the signed-in employee'
);
select throws_ok(
  $$insert into public.leave_requests (
    employee_id, department_id, team_id, leave_type, start_date, end_date
  ) values (
    '30000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'earned', current_date + 22, current_date + 22
  )$$,
  '42501',
  'Employee cannot bypass the request submission function'
);

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.leave_requests),
  3,
  'Manager reads only requests in their assigned team'
);
select is(
  (select count(*)::integer from public.profiles),
  2,
  'Manager reads only profiles in their assigned team and their own'
);
select lives_ok(
  $$select public.decide_leave_request(
    '40000000-0000-4000-8000-000000000001', 'approved'
  )$$,
  'Manager can decide a pending request in their assigned team'
);
select throws_ok(
  $$select public.decide_leave_request(
    '40000000-0000-4000-8000-000000000002', 'approved'
  )$$,
  '42501',
  'Manager cannot decide a request in another team'
);
select throws_ok(
  $$select public.decide_leave_request(
    '40000000-0000-4000-8000-000000000001', 'declined'
  )$$,
  '40001',
  'Manager cannot decide a request a second time'
);

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
select is(
  (select count(*)::integer from public.leave_requests),
  4,
  'HR administrator can read organization requests'
);
select lives_ok(
  $$select public.decide_leave_request(
    '40000000-0000-4000-8000-000000000002', 'declined'
  )$$,
  'HR administrator can decide requests in any team'
);
select throws_ok(
  $$update public.leave_requests
    set status = 'approved'
    where id = '40000000-0000-4000-8000-000000000003'$$,
  '42501',
  'HR cannot bypass the audited decision function with a direct update'
);
select throws_ok(
  $$select public.decide_leave_request(
    '40000000-0000-4000-8000-000000000002', 'approved'
  )$$,
  '40001',
  'HR cannot decide a request a second time'
);

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000004', true);
select is(
  (select count(*)::integer from public.leave_requests),
  1,
  'Second employee reads only their own request'
);
select is(
  (select count(*)::integer from public.leave_decisions),
  1,
  'Employee reads only the decision for their own request'
);

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000005', true);
select throws_ok(
  $$select public.decide_leave_request(
    '40000000-0000-4000-8000-000000000003', 'approved'
  )$$,
  '42501',
  'Unprovisioned authenticated user cannot make decisions'
);

reset role;
select * from finish();
rollback;
