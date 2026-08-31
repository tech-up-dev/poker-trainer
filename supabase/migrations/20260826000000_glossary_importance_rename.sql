-- Steve M3 QA #42 - rename glossary importance values.
--   'core'        -> 'general'
--   'useful'      -> 'controlled_chaos'
--   'situational' -> 'controlled_chaos'   (assumption: situational was between
--                    core and useful, and the new two-tier model keeps only
--                    'general' + 'controlled_chaos'; 'controlled_chaos' is the
--                    closer semantic match. Change to 'general' if the client
--                    disagrees; single UPDATE below.)
--
-- Glossary entries live as jsonb inside content_published.content /
-- content_staging.content (content_type='glossary'), so this is a jsonb
-- key-value rewrite, not an enum alter.

update content_published
   set content = jsonb_set(content, '{importance}', to_jsonb('general'::text)),
       updated_at = now()
 where content_type = 'glossary' and content->>'importance' = 'core';

update content_published
   set content = jsonb_set(content, '{importance}', to_jsonb('controlled_chaos'::text)),
       updated_at = now()
 where content_type = 'glossary' and content->>'importance' in ('useful', 'situational');

update content_staging
   set content = jsonb_set(content, '{importance}', to_jsonb('general'::text)),
       updated_at = now()
 where content_type = 'glossary' and content->>'importance' = 'core';

update content_staging
   set content = jsonb_set(content, '{importance}', to_jsonb('controlled_chaos'::text)),
       updated_at = now()
 where content_type = 'glossary' and content->>'importance' in ('useful', 'situational');
