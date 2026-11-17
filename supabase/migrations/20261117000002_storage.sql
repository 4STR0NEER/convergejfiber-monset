-- Private buckets. Object names start with the PO id ("<poId>/<file>"), so visibility follows the PO.
-- Files not tied to a PO use the folder "no-po" and are visible to their uploader and to users who see everything.
insert into storage.buckets (id, name, public) values
  ('field-photos', 'field-photos', false),
  ('signatures', 'signatures', false),
  ('moa-scans', 'moa-scans', false)
on conflict (id) do nothing;

create function app.sees_object(object_name text, object_owner uuid) returns boolean language sql stable security definer set search_path = public as $$
  select case (storage.foldername(object_name))[1]
    when 'no-po' then object_owner = auth.uid() or app.scope() = 'all'
    else app.sees_po((storage.foldername(object_name))[1]) end
$$;
grant execute on function app.sees_object(text, uuid) to authenticated;

create policy "read own scope" on storage.objects for select to authenticated
  using (bucket_id in ('field-photos', 'signatures', 'moa-scans') and app.sees_object(name, owner));
create policy "field uploads" on storage.objects for insert to authenticated
  with check (bucket_id in ('field-photos', 'signatures') and app.can('can_submit_field') and app.sees_object(name, auth.uid()));
-- Retrying an upload from the outbox overwrites the same object.
create policy "field re-uploads" on storage.objects for update to authenticated
  using (bucket_id in ('field-photos', 'signatures') and owner = auth.uid());
create policy "moa uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'moa-scans' and app.can('can_create_pos'));
