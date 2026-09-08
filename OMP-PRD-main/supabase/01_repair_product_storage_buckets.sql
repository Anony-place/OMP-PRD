-- OopsMyPassword — repair live product media storage
-- Covers are public; paid deliverables remain private.
-- This migration is idempotent and restores the storage contract used by
-- assets/js/admin.js and assets/js/products.js.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('product-files', 'product-files', false)
on conflict (id) do update set public = excluded.public;

-- Public product cover reads.
drop policy if exists "products_bucket_public_read" on storage.objects;
create policy "products_bucket_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'products');

-- Admin-only product cover writes.
drop policy if exists "products_bucket_admin_insert" on storage.objects;
create policy "products_bucket_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'products' and public.is_admin());

drop policy if exists "products_bucket_admin_update" on storage.objects;
create policy "products_bucket_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'products' and public.is_admin())
  with check (bucket_id = 'products' and public.is_admin());

drop policy if exists "products_bucket_admin_delete" on storage.objects;
create policy "products_bucket_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'products' and public.is_admin());

-- Private paid deliverables: admins only. There is intentionally no anon
-- read policy; purchases should receive short-lived signed URLs.
drop policy if exists "product_files_admin_insert" on storage.objects;
create policy "product_files_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-files' and public.is_admin());

drop policy if exists "product_files_admin_read" on storage.objects;
create policy "product_files_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-files' and public.is_admin());

drop policy if exists "product_files_admin_update" on storage.objects;
create policy "product_files_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-files' and public.is_admin())
  with check (bucket_id = 'product-files' and public.is_admin());

drop policy if exists "product_files_admin_delete" on storage.objects;
create policy "product_files_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-files' and public.is_admin());
