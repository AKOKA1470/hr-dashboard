alter table public.induction_modules
  alter column status set default 'uploaded',
  add column conversion_stage text
    check (conversion_stage is null or conversion_stage in ('extracting', 'generating'));

alter table public.induction_modules
  drop constraint induction_modules_conversion_mode_check,
  add constraint induction_modules_conversion_mode_check
    check (conversion_mode in ('metadata_template', 'gemini_ai'));

create table public.induction_sections (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.induction_modules (id) on delete cascade,
  position smallint not null check (position between 1 and 30),
  title text not null check (length(trim(title)) between 1 and 180),
  summary text not null check (length(trim(summary)) between 1 and 5000),
  lessons jsonb not null default '[]'::jsonb check (jsonb_typeof(lessons) = 'array'),
  source_references text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (module_id, position)
);

create table public.induction_activities (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.induction_modules (id) on delete cascade,
  section_id uuid references public.induction_sections (id) on delete cascade,
  position smallint not null check (position between 1 and 120),
  activity_type text not null
    check (activity_type in ('scenario', 'quiz', 'knowledge_check', 'poll')),
  title text not null check (length(trim(title)) between 1 and 180),
  prompt text not null check (length(trim(prompt)) between 1 and 3000),
  choices jsonb not null default '[]'::jsonb check (jsonb_typeof(choices) = 'array'),
  correct_choice smallint,
  explanation text check (explanation is null or length(explanation) <= 2000),
  source_references text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint induction_activity_correct_choice_valid check (
    correct_choice is null or correct_choice between 0 and 9
  )
);

alter table public.induction_questions
  add column question_type text not null default 'hrbp_question'
    check (question_type in ('hrbp_question', 'quiz', 'knowledge_check')),
  add column choices jsonb not null default '[]'::jsonb
    check (jsonb_typeof(choices) = 'array'),
  add column correct_choice smallint,
  add column explanation text check (explanation is null or length(explanation) <= 2000),
  add column source_references text[] not null default '{}',
  add column activity_id uuid references public.induction_activities (id) on delete cascade,
  add constraint induction_question_correct_choice_valid check (
    correct_choice is null or correct_choice between 0 and 9
  );

create index induction_sections_module_position_idx
  on public.induction_sections (module_id, position);
create index induction_activities_module_position_idx
  on public.induction_activities (module_id, position);
create index induction_questions_module_type_created_idx
  on public.induction_questions (module_id, question_type, created_at desc);

alter table public.induction_sections enable row level security;
alter table public.induction_activities enable row level security;

create policy "HR and assigned employees can read induction sections"
  on public.induction_sections for select to authenticated
  using (
    public.current_app_role()::text in ('hr_admin', 'hr', 'hrbp')
    or exists (
      select 1 from public.induction_modules as module
      join public.induction_assignments as assignment on assignment.module_id = module.id
      where module.id = induction_sections.module_id
        and module.status = 'published'
        and assignment.employee_id = auth.uid()
    )
  );

create policy "HR and assigned employees can read induction activities"
  on public.induction_activities for select to authenticated
  using (
    public.current_app_role()::text in ('hr_admin', 'hr', 'hrbp')
    or exists (
      select 1 from public.induction_modules as module
      join public.induction_assignments as assignment on assignment.module_id = module.id
      where module.id = induction_activities.module_id
        and module.status = 'published'
        and assignment.employee_id = auth.uid()
    )
  );

revoke all on public.induction_sections, public.induction_activities from anon, authenticated;
grant select (
  id, module_id, position, title, summary, lessons, source_references, created_at
) on public.induction_sections to authenticated;
grant select (
  id, module_id, section_id, position, activity_type, title, prompt, choices,
  source_references, created_at
) on public.induction_activities to authenticated;

revoke select on public.induction_questions from authenticated;
grant select (
  id, module_id, author_id, question, answer, answered_by, created_at, answered_at,
  question_type
) on public.induction_questions to authenticated;
grant select (conversion_stage) on public.induction_modules to authenticated;
grant insert (status) on public.induction_modules to authenticated;

create or replace function public.save_induction_module(
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
  if auth.uid() is null or public.current_app_role()::text not in ('hr_admin', 'hr', 'hrbp') then
    raise exception 'Only HR can manage induction modules' using errcode = '42501';
  end if;

  if p_title is null or length(trim(p_title)) not between 1 and 180
    or p_content is null or jsonb_typeof(p_content) <> 'object'
    or p_status is null then
    raise exception 'Module title and content are required' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.induction_assignments as assignment
    where assignment.module_id = p_module_id
  ) then
    raise exception 'Modules with learner assignments are locked; upload a revised deck as a new module'
      using errcode = '22023';
  end if;

  if p_status in ('review', 'review_required', 'published') then
    if jsonb_typeof(p_content->'topics') is distinct from 'array'
      or jsonb_typeof(p_content->'poll'->'options') is distinct from 'array'
      or jsonb_typeof(p_content->'assessment'->'options') is distinct from 'array'
      or jsonb_array_length(p_content->'topics') not between 1 and 30
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

    for topic in select value from jsonb_array_elements(p_content->'topics') as topic_items(value)
    loop
      if length(trim(coalesce(topic->>'id', ''))) = 0
        or length(trim(coalesce(topic->>'title', ''))) = 0
        or length(trim(coalesce(topic->>'summary', ''))) = 0
        or length(trim(coalesce(topic->>'activityPrompt', ''))) = 0
        or jsonb_typeof(topic->'activityOptions') is distinct from 'array'
        or jsonb_array_length(topic->'activityOptions') not between 2 and 6 then
        raise exception 'Each topic needs learning content, an activity, and at least two choices'
          using errcode = '22023';
      end if;
      for option_text in select jsonb_array_elements_text(topic->'activityOptions')
      loop
        if length(trim(option_text)) = 0 then
          raise exception 'Activity choices cannot be empty' using errcode = '22023';
        end if;
      end loop;
    end loop;

    for option_text in select jsonb_array_elements_text(p_content->'poll'->'options')
    loop
      if length(trim(option_text)) = 0 then
        raise exception 'Poll choices cannot be empty' using errcode = '22023';
      end if;
    end loop;
    assessment_options := p_content->'assessment'->'options';
    for option_text in select jsonb_array_elements_text(assessment_options)
    loop
      if length(trim(option_text)) = 0 then
        raise exception 'Assessment choices cannot be empty' using errcode = '22023';
      end if;
    end loop;
    if p_correct_choice is null or p_correct_choice < 0
      or p_correct_choice >= jsonb_array_length(assessment_options) then
      raise exception 'Choose a valid correct assessment answer before review or publishing'
        using errcode = '22023';
    end if;
  end if;

  update public.induction_modules
  set title = trim(p_title),
      content = p_content,
      status = p_status,
      conversion_stage = null,
      published_at = case when p_status = 'published' then now() else null end,
      updated_at = now()
  where id = p_module_id;
  if not found then
    raise exception 'Induction module not found' using errcode = '22023';
  end if;

  if p_correct_choice is not null then
    insert into public.induction_assessment_keys (module_id, correct_choice)
    values (p_module_id, p_correct_choice)
    on conflict (module_id) do update set correct_choice = excluded.correct_choice;
  end if;
end;
$$;

create function public.begin_induction_conversion(p_module_id uuid, p_file_path text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null or public.current_app_role()::text not in ('hr_admin', 'hr', 'hrbp') then
    raise exception 'Only HR can convert induction decks' using errcode = '42501';
  end if;
  update public.induction_modules
  set status = 'processing', conversion_stage = 'extracting', updated_at = now()
  where id = p_module_id
    and source_path = p_file_path
    and status in ('uploaded', 'draft', 'generation_failed');
  if not found then
    raise exception 'The module is unavailable or is already being converted' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.induction_assignments where module_id = p_module_id
  ) then
    raise exception 'Assigned modules cannot be regenerated' using errcode = '22023';
  end if;
end;
$$;

create function public.set_induction_conversion_stage(
  p_module_id uuid,
  p_stage text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null or public.current_app_role()::text not in ('hr_admin', 'hr', 'hrbp')
    or p_stage is null or p_stage not in ('extracting', 'generating') then
    raise exception 'Invalid induction conversion stage or role' using errcode = '42501';
  end if;
  update public.induction_modules
  set conversion_stage = p_stage, updated_at = now()
  where id = p_module_id and status = 'processing';
  if not found then
    raise exception 'The induction conversion is no longer active' using errcode = '22023';
  end if;
end;
$$;

create function public.fail_induction_conversion(p_module_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null or public.current_app_role()::text not in ('hr_admin', 'hr', 'hrbp') then
    raise exception 'Only HR can update induction conversion status' using errcode = '42501';
  end if;
  update public.induction_modules
  set status = 'generation_failed', conversion_stage = null, updated_at = now()
  where id = p_module_id and status in ('uploaded', 'processing');
end;
$$;

create function public.complete_induction_conversion(
  p_module_id uuid,
  p_file_path text,
  p_title text,
  p_content jsonb,
  p_sections jsonb,
  p_activities jsonb,
  p_questions jsonb,
  p_correct_choice smallint
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  module_record public.induction_modules%rowtype;
  section_item jsonb;
  activity_item jsonb;
  question_item jsonb;
  section_ids uuid[] := '{}';
  activity_ids uuid[] := '{}';
  new_section_id uuid;
  new_activity_id uuid;
  activity_index integer;
  question_activity_index integer;
  item_position integer := 0;
begin
  if auth.uid() is null or public.current_app_role()::text not in ('hr_admin', 'hr', 'hrbp') then
    raise exception 'Only HR can save induction conversions' using errcode = '42501';
  end if;

  select * into module_record
  from public.induction_modules
  where id = p_module_id and source_path = p_file_path
    and status = 'processing' and conversion_stage = 'generating'
  for update;
  if not found then
    raise exception 'The induction module is not processing or its source path changed'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_sections) is distinct from 'array'
    or jsonb_array_length(p_sections) not between 1 and 30
    or jsonb_typeof(p_activities) is distinct from 'array'
    or jsonb_array_length(p_activities) not between 1 and 120
    or jsonb_typeof(p_questions) is distinct from 'array'
    or jsonb_array_length(p_questions) not between 1 and 120 then
    raise exception 'Generated sections and activities are incomplete' using errcode = '22023';
  end if;
  if exists (select 1 from public.induction_assignments where module_id = p_module_id) then
    raise exception 'Assigned modules cannot be regenerated' using errcode = '22023';
  end if;

  perform public.save_induction_module(
    p_module_id, p_title, p_content, p_correct_choice, 'review_required'
  );
  delete from public.induction_questions
  where module_id = p_module_id and question_type in ('quiz', 'knowledge_check');
  delete from public.induction_sections where module_id = p_module_id;

  for section_item in
    select value from jsonb_array_elements(p_sections) with ordinality as items(value, ordinal)
    order by ordinal
  loop
    insert into public.induction_sections (
      module_id, position, title, summary, lessons, source_references
    ) values (
      p_module_id,
      cardinality(section_ids) + 1,
      trim(section_item->>'title'),
      trim(section_item->>'summary'),
      coalesce(section_item->'lessons', '[]'::jsonb),
      coalesce(array(select jsonb_array_elements_text(section_item->'sourceReferences')), '{}')
    ) returning id into new_section_id;
    section_ids := array_append(section_ids, new_section_id);
  end loop;

  for activity_item in
    select value from jsonb_array_elements(p_activities) with ordinality as items(value, ordinal)
    order by ordinal
  loop
    item_position := item_position + 1;
    new_section_id := null;
    if activity_item->>'sectionIndex' is not null then
      activity_index := (activity_item->>'sectionIndex')::integer;
      if activity_index < 0 or activity_index >= cardinality(section_ids) then
        raise exception 'An activity references an invalid section' using errcode = '22023';
      end if;
      new_section_id := section_ids[activity_index + 1];
    end if;
    insert into public.induction_activities (
      module_id, section_id, position, activity_type, title, prompt, choices,
      correct_choice, explanation, source_references
    ) values (
      p_module_id,
      new_section_id,
      item_position,
      activity_item->>'type',
      trim(activity_item->>'title'),
      trim(activity_item->>'prompt'),
      coalesce(activity_item->'choices', '[]'::jsonb),
      case when activity_item ? 'correctChoice'
        then (activity_item->>'correctChoice')::smallint else null end,
      nullif(trim(activity_item->>'explanation'), ''),
      coalesce(array(select jsonb_array_elements_text(activity_item->'sourceReferences')), '{}')
    ) returning id into new_activity_id;
    activity_ids := array_append(activity_ids, new_activity_id);
  end loop;

  for question_item in select value from jsonb_array_elements(p_questions)
  loop
    question_activity_index := (question_item->>'activityIndex')::integer;
    if question_activity_index < 0 or question_activity_index >= cardinality(activity_ids) then
      raise exception 'A generated question references an invalid activity' using errcode = '22023';
    end if;
    insert into public.induction_questions (
      module_id, author_id, question, question_type, choices, correct_choice,
      explanation, source_references, activity_id
    ) values (
      p_module_id,
      module_record.created_by,
      trim(question_item->>'question'),
      question_item->>'type',
      coalesce(question_item->'choices', '[]'::jsonb),
      (question_item->>'correctChoice')::smallint,
      nullif(trim(question_item->>'explanation'), ''),
      coalesce(array(select jsonb_array_elements_text(question_item->'sourceReferences')), '{}'),
      activity_ids[question_activity_index + 1]
    );
  end loop;

  return p_module_id;
end;
$$;

revoke all on function public.begin_induction_conversion(uuid, text) from public, anon;
revoke all on function public.set_induction_conversion_stage(uuid, text) from public, anon;
revoke all on function public.fail_induction_conversion(uuid) from public, anon;
revoke all on function public.complete_induction_conversion(
  uuid, text, text, jsonb, jsonb, jsonb, jsonb, smallint
) from public, anon;
grant execute on function public.begin_induction_conversion(uuid, text) to authenticated;
grant execute on function public.set_induction_conversion_stage(uuid, text) to authenticated;
grant execute on function public.fail_induction_conversion(uuid) to authenticated;
grant execute on function public.complete_induction_conversion(
  uuid, text, text, jsonb, jsonb, jsonb, jsonb, smallint
) to authenticated;
