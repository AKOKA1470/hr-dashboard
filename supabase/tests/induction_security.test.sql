begin;

select plan(33);

insert into public.departments (id, name) values
  ('10000000-0000-4000-8000-000000000001', 'Induction test department');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('30000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'induction-hr@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('30000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'induction-employee@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('30000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'induction-other@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('30000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'induction-unprovisioned@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, full_name, role, department_id) values
  ('30000000-0000-4000-8000-000000000001', 'Induction HR', 'hr_admin', null),
  ('30000000-0000-4000-8000-000000000002', 'Induction Employee', 'employee',
   '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000003', 'Other Employee', 'employee',
   '10000000-0000-4000-8000-000000000001');

insert into public.induction_modules (
  id, created_by, title, source_file_name, source_path, source_file_size,
  source_file_type, content, status, published_at
) values (
  '50000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'Induction security test',
  'test.pdf',
  '30000000-0000-4000-8000-000000000001/test.pdf',
  100,
  'application/pdf',
  '{
    "topics": [{
      "id": "topic-1",
      "title": "Test topic",
      "summary": "Approved test guidance.",
      "activityPrompt": "Choose a response.",
      "activityOptions": ["First", "Second"]
    }],
    "poll": {"prompt": "Test poll", "options": ["One", "Two"]},
    "assessment": {"question": "Test assessment", "options": ["Wrong", "Correct"]}
  }'::jsonb,
  'published',
  now()
);

insert into public.induction_modules (
  id, created_by, title, source_file_name, source_path, source_file_size,
  source_file_type, status
) values (
  '50000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000001',
  'Conversion state test',
  'conversion.pdf',
  '30000000-0000-4000-8000-000000000001/conversion.pdf',
  100,
  'application/pdf',
  'uploaded'
);

insert into public.induction_modules (
  id, created_by, title, source_file_name, source_path, source_file_size,
  source_file_type, status
) values (
  '50000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000001',
  'Conversion persistence test',
  'persistence.pdf',
  '30000000-0000-4000-8000-000000000001/persistence.pdf',
  100,
  'application/pdf',
  'uploaded'
);

insert into public.induction_assessment_keys (module_id, correct_choice) values
  ('50000000-0000-4000-8000-000000000001', 1);

insert into public.induction_assignments (id, module_id, employee_id, assigned_by) values
  (
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);

select throws_ok(
  $$select correct_choice from public.induction_activities$$,
  '42501',
  'Employee cannot read correct answers from generated activities'
);
select throws_ok(
  $$select correct_choice from public.induction_questions$$,
  '42501',
  'Employee cannot read correct answers from generated questions'
);
select is(
  (select count(*)::integer from public.induction_modules),
  1,
  'Employee can read only their assigned published module'
);
select is(
  (select count(*)::integer from public.induction_assessment_keys),
  0,
  'Employee cannot read the private assessment answer key'
);
select is(
  (select count(*)::integer from public.induction_assignments),
  1,
  'Employee can read only their own assignment'
);
select throws_ok(
  $$select public.save_induction_progress(
    '60000000-0000-4000-8000-000000000099',
    array['topic-1'],
    '{"topic-1": 0}'::jsonb,
    '{"onboarding_poll": 0}'::jsonb,
    1::smallint
  )$$,
  '42501',
  'Employee cannot save progress for another assignment'
);
select is(
  (
    select public.save_induction_progress(
      '60000000-0000-4000-8000-000000000001',
      array['topic-1'],
      '{"topic-1": 1}'::jsonb,
      '{"onboarding_poll": 0}'::jsonb,
      1
    )
  ),
  true,
  'Employee can complete an assigned learning path with valid responses'
);
select ok(
  (
    select completed_at is not null
    from public.induction_progress
    where assignment_id = '60000000-0000-4000-8000-000000000001'
  ),
  'Completion is recorded after all activities, the poll, and the assessment'
);
select throws_ok(
  $$update public.induction_progress
    set completed_at = null
    where assignment_id = '60000000-0000-4000-8000-000000000001'$$,
  '42501',
  'Employee cannot bypass the guarded progress function'
);
select lives_ok(
  $$insert into public.induction_questions (module_id, author_id, question)
    values (
      '50000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002',
      'Where can I get help?'
    )$$,
  'Employee can ask HRBP about an assigned module'
);
select throws_ok(
  $$update public.induction_questions set answer = 'Forged response'$$,
  '42501',
  'Employee cannot write an HRBP answer'
);

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.begin_induction_conversion(
    '50000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001/conversion.pdf'
  )$$,
  'HR can move an uploaded module into processing'
);
select is(
  (select status::text from public.induction_modules
   where id = '50000000-0000-4000-8000-000000000002'),
  'processing',
  'Conversion begins in the processing state'
);
select lives_ok(
  $$select public.set_induction_conversion_stage(
    '50000000-0000-4000-8000-000000000002',
    'generating'
  )$$,
  'HR can advance an active conversion stage'
);
select lives_ok(
  $$select public.fail_induction_conversion(
    '50000000-0000-4000-8000-000000000002'
  )$$,
  'HR can record a failed generation'
);
select is(
  (select status::text from public.induction_modules
   where id = '50000000-0000-4000-8000-000000000002'),
  'generation_failed',
  'Failed generation is persisted for retry'
);
select lives_ok(
  $$select public.begin_induction_conversion(
    '50000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000001/persistence.pdf'
  )$$,
  'HR can start a second module conversion'
);
select lives_ok(
  $$select public.set_induction_conversion_stage(
    '50000000-0000-4000-8000-000000000003',
    'generating'
  )$$,
  'HR can mark extraction as complete'
);
select lives_ok(
  $$select public.complete_induction_conversion(
    '50000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000001/persistence.pdf',
    'Generated module',
    '{
      "topics": [{
        "id": "section-1",
        "title": "Test section",
        "summary": "Generated lesson content.",
        "activityPrompt": "Choose a response.",
        "activityOptions": ["First", "Second"]
      }],
      "poll": {"prompt": "Test poll", "options": ["One", "Two"]},
      "assessment": {"question": "Test check", "options": ["Wrong", "Correct"]}
    }'::jsonb,
    '[{"title":"Test section","summary":"Generated lesson content.","lessons":[],"sourceReferences":["Slide 1"]}]'::jsonb,
    '[{"type":"quiz","sectionIndex":0,"title":"Test quiz","prompt":"Test question","choices":["Wrong","Correct"],"correctChoice":1,"sourceReferences":["Slide 1"]}]'::jsonb,
    '[{"type":"quiz","question":"Test question","choices":["Wrong","Correct"],"correctChoice":1,"explanation":"Test explanation","sourceReferences":["Slide 1"],"activityIndex":0}]'::jsonb,
    1::smallint
  )$$,
  'Generated module content is saved atomically'
);
select is(
  (select status::text from public.induction_modules
   where id = '50000000-0000-4000-8000-000000000003'),
  'review_required',
  'Successful conversion reaches review_required'
);
select is(
  (select count(*)::integer from public.induction_sections
   where module_id = '50000000-0000-4000-8000-000000000003'),
  1,
  'Generated sections are persisted'
);
select is(
  (select count(*)::integer from public.induction_activities
   where module_id = '50000000-0000-4000-8000-000000000003'),
  1,
  'Generated activities are persisted'
);
select is(
  (select count(*)::integer from public.induction_questions
   where module_id = '50000000-0000-4000-8000-000000000003'
     and question_type = 'quiz'),
  1,
  'Generated quiz questions are persisted'
);
select is(
  (select count(*)::integer from public.induction_assignments),
  1,
  'HR can read assignments for reporting'
);
select is(
  (select count(*)::integer from public.induction_progress),
  1,
  'HR can read learner progress for reporting'
);
select is(
  (select count(*)::integer from public.induction_assessment_keys),
  1,
  'HR can read the assessment answer key'
);
select throws_ok(
  $$select public.save_induction_module(
    '50000000-0000-4000-8000-000000000001',
    'Changed after assignment',
    '{"topics":[],"poll":{"prompt":"","options":[]},"assessment":{"question":"","options":[]}}'::jsonb,
    0,
    'published'
  )$$,
  '22023',
  'Published modules with assignments cannot change under saved progress'
);
select is(
  (
    select status
    from public.assign_induction_roster(
      '50000000-0000-4000-8000-000000000001',
      array['induction-employee@example.test']
    )
    limit 1
  ),
  'already_assigned',
  'Roster assignment reports existing assignments without duplicating them'
);
select lives_ok(
  $$select public.answer_induction_question(
    (select id from public.induction_questions limit 1),
    'Ask your assigned HRBP for support.'
  )$$,
  'HR can answer an employee question'
);
select is(
  (select count(*)::integer from public.induction_questions),
  1,
  'HR can read employee induction questions'
);

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
select is(
  (
    select answer
    from public.induction_questions
    limit 1
  ),
  'Ask your assigned HRBP for support.',
  'Employee can read the HRBP response to their own question'
);

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
select is(
  (select count(*)::integer from public.induction_questions),
  0,
  'Other employees cannot read questions they did not author'
);

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select * from public.assign_induction_roster(
    '50000000-0000-4000-8000-000000000001',
    array['induction-employee@example.test']
  )$$,
  '42501',
  'Unprovisioned authenticated users cannot assign induction'
);

reset role;
select * from finish();
rollback;
