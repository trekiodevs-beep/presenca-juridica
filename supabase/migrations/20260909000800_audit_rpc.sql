create or replace function public.record_audit_event(action_name text, target_type_name text, target_id_value uuid default null, metadata_value jsonb default '{}'::jsonb)
returns public.audit_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_office_id uuid;
  result_row public.audit_logs;
begin
  select office_id into actor_office_id from public.profiles where id = auth.uid();
  if actor_office_id is null or not public.is_office_member(actor_office_id) then raise exception 'office_membership_required'; end if;
  insert into public.audit_logs (office_id, actor_user_id, action, target_type, target_id, metadata)
  values (actor_office_id, auth.uid(), left(action_name, 120), left(target_type_name, 120), target_id_value, coalesce(metadata_value, '{}'::jsonb))
  returning * into result_row;
  return result_row;
end;
$$;

revoke all on function public.record_audit_event(text, text, uuid, jsonb) from public;
grant execute on function public.record_audit_event(text, text, uuid, jsonb) to authenticated;
