create or replace function public.transfer_office_ownership(actor_user_id uuid, target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_office_id uuid;
begin
  select office_id into target_office_id
  from public.memberships
  where user_id = actor_user_id and role = 'owner' and status = 'active'
  limit 1;
  if target_office_id is null then raise exception 'owner_required'; end if;
  if not exists (select 1 from public.memberships where office_id = target_office_id and user_id = target_user_id and status = 'active') then raise exception 'active_member_required'; end if;
  update public.memberships set role = 'admin' where office_id = target_office_id and user_id = actor_user_id;
  update public.memberships set role = 'owner' where office_id = target_office_id and user_id = target_user_id;
  update public.offices set owner_user_id = target_user_id where id = target_office_id;
  update public.profiles set office_id = target_office_id, role = 'admin' where id = actor_user_id;
  update public.profiles set office_id = target_office_id, role = 'owner' where id = target_user_id;
  return target_office_id;
end;
$$;

revoke all on function public.transfer_office_ownership(uuid, uuid) from public, anon, authenticated;
grant execute on function public.transfer_office_ownership(uuid, uuid) to service_role;
