create type public.induction_module_status as enum ('draft', 'review', 'published');

create table public.induction_modules (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 180),
  source_file_name text not null check (length(trim(source_file_name)) between 1 and 255),
  source_path text not null unique check (length(trim(source_path)) between 1 and 500),
  source_file_size bigint not null check (source_file_size between 1 and 52428800),
  source_file_type text not null check (length(source_file_type) <= 160),
  conversion_mode text not null default 'metadata_template'
    check (conversion_mode = 'metadata_template'),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object'),
  status public.induction_module_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint induction_module_publish_state check (
    (status = 'published' and published_at is not null)
    or (status <> 'published' and published_at is null)
  )
);

create table public.induction_assessment_keys (
  module_id uuid primary key
    references public.induction_modules (id) on delete cascade,
  correct_choice smallint not null check (correct_choice between 0 and 9)
);

create index induction_modules_status_created_idx
  on public.induction_modules (status, created_at desc);

create table public.induction_assignments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.induction_modules (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete restrict,
  assigned_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (module_id, employee_id)
);

create index induction_assignments_employee_created_idx
  on public.induction_assignments (employee_id, created_at desc);

create table public.induction_progress (
  assignment_id uuid primary key
    references public.induction_assignments (id) on delete cascade,
  completed_topic_ids text[] not null default '{}',
  activity_answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(activity_answers) = 'object'),
  poll_answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(poll_answers) = 'object'),
  assessment_choice smallint,
  assessment_passed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint induction_progress_assessment_choice_valid check (
    assessment_choice is null or assessment_choice between 0 and 9
  ),
  constraint induction_progress_completion_consistent check (
    completed_at is null or assessment_passed
  )
);

create table public.induction_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.induction_modules (id) on delete set null,
  author_id uuid not null references public.profiles (id) on delete restrict,
  question text not null check (length(trim(question)) between 1 and 3000),
  answer text check (answer is null or length(answer) <= 5000),
  answered_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  constraint induction_question_answer_consistent check (
    (answer is null and answered_by is null and answered_at is null)
    or (answer is not null and answered_by is not null and answered_at is not null)
  )
);

create index induction_questions_author_created_idx
  on public.induction_questions (author_id, created_at desc);
create index induction_questions_open_created_idx
  on public.induction_questions (created_at desc)
  where answered_at is null;

alter table public.induction_modules enable row level security;
alter table public.induction_assessment_keys enable row level security;
alter table public.induction_assignments enable row level security;
alter table public.induction_progress enable row level security;
alter table public.induction_questions enable row level security;

create policy "HR can read all induction modules"
  on public.induction_modules for select to authenticated
  using (public.current_app_role() = 'hr_admin');

create policy "HR can create induction modules"
  on public.induction_modules for insert to authenticated
  with check (
    public.current_app_role() = 'hr_admin'
    and created_by = auth.uid()
  );

create policy "Employees can read assigned published modules"
  on public.induction_modules for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1
      from public.induction_assignments as assignment
      where assignment.module_id = induction_modules.id
        and assignment.employee_id = auth.uid()
    )
  );

create policy "HR can read induction assessment keys"
  on public.induction_assessment_keys for select to authenticated
  using (public.current_app_role() = 'hr_admin');

create policy "HR and assigned employees can read induction assignments"
  on public.induction_assignments for select to authenticated
  using (
    public.current_app_role() = 'hr_admin'
    or employee_id = auth.uid()
  );

create policy "HR can read all induction progress"
  on public.induction_progress for select to authenticated
  using (
    public.current_app_role() = 'hr_admin'
    or exists (
      select 1
      from public.induction_assignments as assignment
      where assignment.id = induction_progress.assignment_id
        and assignment.employee_id = auth.uid()
    )
  );

create policy "Employees can save their own induction progress"
  on public.induction_progress for all to authenticated
  using (
    exists (
      select 1
      from public.induction_assignments as assignment
      where assignment.id = induction_progress.assignment_id
        and assignment.employee_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.induction_assignments as assignment
      where assignment.id = induction_progress.assignment_id
        and assignment.employee_id = auth.uid()
    )
  );

create policy "Employees and HR can read induction questions"
  on public.induction_questions for select to authenticated
  using (
    author_id = auth.uid()
    or public.current_app_role() = 'hr_admin'
  );

create policy "Employees can ask HRBP questions"
  on public.induction_questions for insert to authenticated
  with check (
    public.current_app_role() = 'employee'
    and author_id = auth.uid()
    and answer is null
    and answered_by is null
    and answered_at is null
    and (
      module_id is null
      or exists (
        select 1
        from public.induction_assignments as assignment
        where assignment.module_id = induction_questions.module_id
          and assignment.employee_id = auth.uid()
      )
    )
  );

revoke all on public.induction_modules, public.induction_assignments,
  public.induction_assessment_keys, public.induction_progress,
  public.induction_questions
  from anon, authenticated;

grant select (
  id, created_by, title, source_file_name, source_path, source_file_size,
  source_file_type, conversion_mode, content, status, created_at, updated_at, published_at
) on public.induction_modules to authenticated;
grant insert (
  created_by, title, source_file_name, source_path, source_file_size,
  source_file_type, conversion_mode, content
) on public.induction_modules to authenticated;
grant select on public.induction_assignments to authenticated;
grant select on public.induction_assessment_keys to authenticated;
grant select on public.induction_progress to authenticated;
grant select on public.induction_questions to authenticated;
grant insert (module_id, author_id, question)
  on public.induction_questions to authenticated;

create function public.assign_induction_roster(
  p_module_id uuid,
  p_emails text[]
)
returns table (email text, status text)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  normalized_email text;
  matched_employee_id uuid;
  inserted_count integer;
begin
  if actor_id is null or public.current_app_role() is distinct from 'hr_admin' then
    raise exception 'Only an HR administrator can assign induction' using errcode = '42501';
  end if;

  if p_module_id is null
    or p_emails is null
    or cardinality(p_emails) = 0
    or cardinality(p_emails) > 500 then
    raise exception 'Provide a published module and between 1 and 500 employee emails'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.induction_modules
    where id = p_module_id and public.induction_modules.status = 'published'
  ) then
    raise exception 'Publish the induction module before assigning employees'
      using errcode = '22023';
  end if;

  foreach normalized_email in array p_emails loop
    normalized_email := lower(trim(normalized_email));
    matched_employee_id := null;

    if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      email := normalized_email;
      status := 'invalid_email';
      return next;
      continue;
    end if;

    select account.id into matched_employee_id
    from auth.users as account
    join public.profiles as employee on employee.id = account.id
    where lower(account.email) = normalized_email
      and employee.role = 'employee'
    limit 1;

    if matched_employee_id is null then
      email := normalized_email;
      status := 'no_employee_account';
      return next;
      continue;
    end if;

    insert into public.induction_assignments (module_id, employee_id, assigned_by)
    values (p_module_id, matched_employee_id, actor_id)
    on conflict (module_id, employee_id) do nothing;
    get diagnostics inserted_count = row_count;

    email := normalized_email;
    status := case when inserted_count = 1 then 'assigned' else 'already_assigned' end;
    return next;
  end loop;
end;
$$;

create function public.save_induction_module(
  p_module_id uuid,
  p_title text,
  p_content jsonb,
  p_correct_choice smallint,
  p_status public.induction_module_status
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  assessment_options jsonb;
  topic jsonb;
  option_text text;
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'hr_admin' then
    raise exception 'Only an HR administrator can manage induction modules'
      using errcode = '42501';
  end if;

  if p_title is null or length(trim(p_title)) not between 1 and 180
    or p_content is null or jsonb_typeof(p_content) <> 'object'
    or p_status is null then
    raise exception 'Module title and content are required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.induction_assignments as assignment
    where assignment.module_id = p_module_id
  ) then
    raise exception 'Modules with learner assignments are locked to preserve progress; upload a revised deck as a new module'
      using errcode = '22023';
  end if;

  if p_status in ('review', 'published') then
    if jsonb_typeof(p_content->'topics') is distinct from 'array'
      or jsonb_typeof(p_content->'poll'->'options') is distinct from 'array'
      or jsonb_typeof(p_content->'assessment'->'options') is distinct from 'array' then
      raise exception 'Complete all topics, the poll, and assessment before review or publishing'
        using errcode = '22023';
    end if;
    if jsonb_array_length(p_content->'topics') not between 1 and 30
      or length(trim(coalesce(p_content->'poll'->>'prompt', ''))) = 0
      or jsonb_array_length(p_content->'poll'->'options') not between 2 and 6
      or length(trim(coalesce(p_content->'assessment'->>'question', ''))) = 0
      or jsonb_array_length(p_content->'assessment'->'options') not between 2 and 10 then
      raise exception 'Complete all topics, the poll, and assessment before review or publishing'
        using errcode = '22023';
    end if;
    if (
      select count(distinct topic_item.value->>'id')
      from jsonb_array_elements(p_content->'topics') as topic_item(value)
    ) <> jsonb_array_length(p_content->'topics') then
      raise exception 'Topic identifiers must be unique' using errcode = '22023';
    end if;

    for topic in
      select value
      from jsonb_array_elements(p_content->'topics') as topic_items(value)
    loop
      if length(trim(coalesce(topic->>'id', ''))) = 0
        or length(trim(coalesce(topic->>'title', ''))) = 0
        or length(trim(coalesce(topic->>'summary', ''))) = 0
        or length(trim(coalesce(topic->>'activityPrompt', ''))) = 0
        or jsonb_typeof(topic->'activityOptions') is distinct from 'array' then
        raise exception 'Each topic needs learning content, an activity, and at least two choices'
          using errcode = '22023';
      end if;
      if jsonb_array_length(topic->'activityOptions') not between 2 and 6 then
        raise exception 'Each topic needs learning content, an activity, and at least two choices'
          using errcode = '22023';
      end if;

      for option_text in
        select jsonb_array_elements_text(topic->'activityOptions')
      loop
        if length(trim(option_text)) = 0 then
          raise exception 'Activity choices cannot be empty' using errcode = '22023';
        end if;
      end loop;
    end loop;

    for option_text in
      select jsonb_array_elements_text(p_content->'poll'->'options')
    loop
      if length(trim(option_text)) = 0 then
        raise exception 'Poll choices cannot be empty' using errcode = '22023';
      end if;
    end loop;

    assessment_options := p_content->'assessment'->'options';
    for option_text in
      select jsonb_array_elements_text(assessment_options)
    loop
      if length(trim(option_text)) = 0 then
        raise exception 'Assessment choices cannot be empty' using errcode = '22023';
      end if;
    end loop;
    if p_correct_choice is null
      or p_correct_choice < 0
      or p_correct_choice >= jsonb_array_length(assessment_options) then
      raise exception 'Choose a valid correct assessment answer before review or publishing'
        using errcode = '22023';
    end if;
  end if;

  update public.induction_modules
  set title = trim(p_title),
      content = p_content,
      status = p_status,
      published_at = case when p_status = 'published' then now() else null end,
      updated_at = now()
  where id = p_module_id;

  if not found then
    raise exception 'Induction module not found' using errcode = '22023';
  end if;

  if p_correct_choice is not null then
    insert into public.induction_assessment_keys (module_id, correct_choice)
    values (p_module_id, p_correct_choice)
    on conflict (module_id) do update
      set correct_choice = excluded.correct_choice;
  end if;
end;
$$;

create function public.save_induction_progress(
  p_assignment_id uuid,
  p_completed_topic_ids text[],
  p_activity_answers jsonb,
  p_poll_answers jsonb,
  p_assessment_choice smallint default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  assigned_module public.induction_modules%rowtype;
  topic_count integer;
  distinct_topic_count integer;
  passed_assessment boolean;
  correct_choice smallint;
  topic_id text;
  topic_data jsonb;
  topic_answer integer;
  poll_answer integer;
begin
  if actor_id is null or public.current_app_role() is distinct from 'employee' then
    raise exception 'Only an assigned employee can save induction progress'
      using errcode = '42501';
  end if;

  select module.* into assigned_module
  from public.induction_assignments as assignment
  join public.induction_modules as module on module.id = assignment.module_id
  where assignment.id = p_assignment_id
    and assignment.employee_id = actor_id
    and module.status = 'published';

  if not found then
    raise exception 'Published induction assignment not found' using errcode = '42501';
  end if;

  if p_completed_topic_ids is null or p_activity_answers is null
    or jsonb_typeof(p_activity_answers) is distinct from 'object'
    or p_poll_answers is null
    or jsonb_typeof(p_poll_answers) is distinct from 'object' then
    raise exception 'Induction progress is invalid' using errcode = '22023';
  end if;
  if jsonb_object_length(p_activity_answers) > 100
    or jsonb_object_length(p_poll_answers) > 100 then
    raise exception 'Induction progress includes too many answers' using errcode = '22023';
  end if;

  for topic_id in select unnest(p_completed_topic_ids) loop
    select topic_item.value into topic_data
    from jsonb_array_elements(coalesce(assigned_module.content->'topics', '[]'::jsonb))
      as topic_item(value)
    where topic_item.value->>'id' = topic_id;
    if not found or topic_id is null then
      raise exception 'Progress includes a topic outside this induction module'
        using errcode = '22023';
    end if;
    if not (p_activity_answers ? topic_id)
      or jsonb_typeof(p_activity_answers->topic_id) is distinct from 'number'
      or (p_activity_answers->>topic_id) !~ '^[0-9]+$' then
      raise exception 'Complete each topic activity before saving it'
        using errcode = '22023';
    end if;
    topic_answer := (p_activity_answers->>topic_id)::integer;
    if topic_answer >= jsonb_array_length(topic_data->'activityOptions') then
      raise exception 'Activity choice is outside the topic options'
        using errcode = '22023';
    end if;
  end loop;

  for topic_id in select jsonb_object_keys(p_activity_answers) loop
    if not exists (
      select 1
      from jsonb_array_elements(coalesce(assigned_module.content->'topics', '[]'::jsonb))
        as topic_item(value)
      where topic_item.value->>'id' = topic_id
    ) then
      raise exception 'Activity answer is outside this induction module'
        using errcode = '22023';
    end if;
  end loop;

  if p_poll_answers ? 'onboarding_poll' then
    if jsonb_object_length(p_poll_answers) <> 1
      or jsonb_typeof(p_poll_answers->'onboarding_poll') is distinct from 'number'
      or (p_poll_answers->>'onboarding_poll') !~ '^[0-9]+$' then
      raise exception 'Poll response is invalid' using errcode = '22023';
    end if;
    poll_answer := (p_poll_answers->>'onboarding_poll')::integer;
    if jsonb_typeof(assigned_module.content->'poll'->'options') is distinct from 'array'
      or poll_answer >= jsonb_array_length(assigned_module.content->'poll'->'options') then
      raise exception 'Poll response is outside the available choices'
        using errcode = '22023';
    end if;
  elsif jsonb_object_length(p_poll_answers) > 0 then
    raise exception 'Poll response is invalid' using errcode = '22023';
  end if;

  select jsonb_array_length(coalesce(assigned_module.content->'topics', '[]'::jsonb))
    into topic_count;
  select count(distinct completed.topic_id) into distinct_topic_count
  from unnest(p_completed_topic_ids) as completed(topic_id);
  if cardinality(p_completed_topic_ids) <> distinct_topic_count
    or distinct_topic_count > topic_count then
    raise exception 'Progress contains duplicate or excess topic entries'
      using errcode = '22023';
  end if;
  select assessment_key.correct_choice into correct_choice
  from public.induction_assessment_keys as assessment_key
  where assessment_key.module_id = assigned_module.id;
  passed_assessment := coalesce(
    p_assessment_choice is not null and p_assessment_choice = correct_choice,
    false
  );

  insert into public.induction_progress (
    assignment_id, completed_topic_ids, activity_answers, poll_answers,
    assessment_choice, assessment_passed, completed_at, updated_at
  ) values (
    p_assignment_id, p_completed_topic_ids, p_activity_answers, p_poll_answers,
    p_assessment_choice, passed_assessment,
    case
      when cardinality(p_completed_topic_ids) = topic_count
        and distinct_topic_count = topic_count
        and p_poll_answers ? 'onboarding_poll'
        and passed_assessment
        then now()
      else null
    end,
    now()
  )
  on conflict (assignment_id) do update set
    completed_topic_ids = excluded.completed_topic_ids,
    activity_answers = excluded.activity_answers,
    poll_answers = excluded.poll_answers,
    assessment_choice = excluded.assessment_choice,
    assessment_passed = excluded.assessment_passed,
    completed_at = case
      when cardinality(excluded.completed_topic_ids) = topic_count
        and distinct_topic_count = topic_count
        and excluded.poll_answers ? 'onboarding_poll'
        and excluded.assessment_passed
        then coalesce(public.induction_progress.completed_at, now())
      else null
    end,
    updated_at = now();

  return passed_assessment;
end;
$$;

create function public.answer_induction_question(
  p_question_id uuid,
  p_answer text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'hr_admin' then
    raise exception 'Only an HR administrator can answer induction questions'
      using errcode = '42501';
  end if;

  if p_answer is null or length(trim(p_answer)) not between 1 and 5000 then
    raise exception 'Answers must contain between 1 and 5000 characters'
      using errcode = '22023';
  end if;

  update public.induction_questions
  set answer = trim(p_answer),
      answered_by = auth.uid(),
      answered_at = now()
  where id = p_question_id and answered_at is null;

  if not found then
    raise exception 'Open induction question not found' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.assign_induction_roster(uuid, text[]) from public, anon;
revoke all on function public.save_induction_module(
  uuid, text, jsonb, smallint, public.induction_module_status
) from public, anon;
revoke all on function public.save_induction_progress(
  uuid, text[], jsonb, jsonb, smallint
) from public, anon;
revoke all on function public.answer_induction_question(uuid, text) from public, anon;
grant execute on function public.assign_induction_roster(uuid, text[]) to authenticated;
grant execute on function public.save_induction_module(
  uuid, text, jsonb, smallint, public.induction_module_status
) to authenticated;
grant execute on function public.save_induction_progress(
  uuid, text[], jsonb, jsonb, smallint
) to authenticated;
grant execute on function public.answer_induction_question(uuid, text) to authenticated;
grant usage on type public.induction_module_status to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'induction-decks',
  'induction-decks',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "HR can manage induction deck files"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'induction-decks'
    and public.current_app_role() = 'hr_admin'
  )
  with check (
    bucket_id = 'induction-decks'
    and public.current_app_role() = 'hr_admin'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
