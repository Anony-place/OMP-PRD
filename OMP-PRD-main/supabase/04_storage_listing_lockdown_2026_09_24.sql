-- OopsMyPassword — storage listing lockdown (2026-09-24)
--
-- Finding: anon can call POST /storage/v1/object/list/articles and enumerate
-- every uploaded file (verified live 2026-09-24), including documents that
-- belonged to deleted or unpublished articles.
--
-- Public buckets serve /storage/v1/object/public/<bucket>/<path> WITHOUT
-- consulting RLS, so the broad anon SELECT policy is not needed for the site to
-- display covers or documents. It only enables enumeration. Replace it with
-- admin-only SELECT. Public URLs keep working.
--
-- Also enforce server-side size/MIME limits. Until now these were only checked in
-- the browser (assets/js/filevalidate.js).
--
-- Apply in the Supabase SQL editor, then re-run the verification at the bottom.

begin;

drop policy if exists "articles_bucket_public_read" on storage.objects;
drop policy if exists "products_bucket_public_read" on storage.objects;

drop policy if exists "articles_bucket_admin_select" on storage.objects;
create policy "articles_bucket_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'articles' and (select public.is_admin()));

drop policy if exists "products_bucket_admin_select" on storage.objects;
create policy "products_bucket_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'products' and (select public.is_admin()));

-- Server-side upload limits (mirror assets/js/filevalidate.js).
update storage.buckets set
  file_size_limit = 26214400,  -- 25 MB
  allowed_mime_types = array[
    'application/pdf','text/plain','text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png','image/jpeg','image/webp','image/gif'
  ]
where id = 'articles';

update storage.buckets set
  file_size_limit = 5242880,   -- 5 MB covers
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif']
where id = 'products';

commit;

-- Verify (expect "[]" or an error, NOT a file list):
--   curl -X POST -H "apikey: <publishable>" -H "Authorization: Bearer <publishable>" \
--     -H 'Content-Type: application/json' -d '{"prefix":""}' \
--     https://aeehfulikupskyrvcpzb.supabase.co/storage/v1/object/list/articles
-- And confirm an existing public URL still returns 200.
