-- M3-12: backfill per-question difficulty and ensure every lesson has a concept.
--
-- Per-question difficulty: copy the lesson-level difficulty into each question
-- object for lessons that have difficulty set but questions that don't yet carry
-- it individually. Only questions missing the field are updated; already-tagged
-- questions are left untouched.
--
-- Concept backfill: any lesson whose top-level concept is missing or empty gets
-- the placeholder 'test' slug so the pipeline validator has something to work
-- with. Real concepts should be assigned via the authoring wizard.

-- Backfill difficulty onto questions in content_staging
update content_staging
set content = jsonb_set(
  content,
  '{questions}',
  (
    select jsonb_agg(
      case
        when q->>'difficulty' is null and content->>'difficulty' is not null
        then q || jsonb_build_object('difficulty', content->>'difficulty')
        else q
      end
    )
    from jsonb_array_elements(content->'questions') q
  )
)
where content_type = 'lesson'
  and content->>'difficulty' is not null
  and exists (
    select 1 from jsonb_array_elements(content->'questions') q
    where q->>'difficulty' is null
  );

-- Same for content_published
update content_published
set content = jsonb_set(
  content,
  '{questions}',
  (
    select jsonb_agg(
      case
        when q->>'difficulty' is null and content->>'difficulty' is not null
        then q || jsonb_build_object('difficulty', content->>'difficulty')
        else q
      end
    )
    from jsonb_array_elements(content->'questions') q
  )
)
where content_type = 'lesson'
  and content->>'difficulty' is not null
  and exists (
    select 1 from jsonb_array_elements(content->'questions') q
    where q->>'difficulty' is null
  );

-- Same for content_versions
update content_versions
set content = jsonb_set(
  content,
  '{questions}',
  (
    select jsonb_agg(
      case
        when q->>'difficulty' is null and content->>'difficulty' is not null
        then q || jsonb_build_object('difficulty', content->>'difficulty')
        else q
      end
    )
    from jsonb_array_elements(content->'questions') q
  )
)
where content_type = 'lesson'
  and content->>'difficulty' is not null
  and exists (
    select 1 from jsonb_array_elements(content->'questions') q
    where q->>'difficulty' is null
  );

-- Backfill concept = 'test' for lessons missing a concept (staging)
update content_staging
set content = content || '{"concept": "test"}'::jsonb
where content_type = 'lesson'
  and (content->>'concept' is null or content->>'concept' = '');

-- Same for published
update content_published
set content = content || '{"concept": "test"}'::jsonb
where content_type = 'lesson'
  and (content->>'concept' is null or content->>'concept' = '');
