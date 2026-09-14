-- Repair legacy owner records created before memberships became the canonical
-- source of tenant access. Only the declared office owner is promoted.
insert into public.memberships (office_id, user_id, email, name, role, status)
select
  office.id,
  office.owner_user_id,
  profile.email,
  coalesce(nullif(profile.name, ''), office.lawyer_name, ''),
  'owner',
  'active'
from public.offices office
join public.profiles profile on profile.id = office.owner_user_id
on conflict (office_id, user_id) do update
set role = 'owner', status = 'active', email = excluded.email, name = excluded.name;

update public.profiles profile
set office_id = (
  select office.id
  from public.offices office
  where office.owner_user_id = profile.id
  order by office.created_at asc, office.id asc
  limit 1
), role = 'owner'
where profile.office_id is null
  and exists (
    select 1 from public.offices office where office.owner_user_id = profile.id
  );

create or replace function public.create_office_with_owner(input jsonb)
returns public.offices
language plpgsql
security definer
set search_path = public
as $$
declare
  new_office public.offices;
  existing_office public.offices;
  current_email text;
  current_name text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select email, name into current_email, current_name
  from public.profiles
  where id = auth.uid();
  if current_email is null then
    raise exception 'profile_required';
  end if;

  select office.* into existing_office
  from public.offices office
  join public.memberships membership on membership.office_id = office.id
  where membership.user_id = auth.uid() and membership.status = 'active'
  order by membership.created_at asc, office.created_at asc
  limit 1;

  if existing_office.id is not null then
    update public.profiles
    set office_id = existing_office.id, role = (
      select membership.role from public.memberships membership
      where membership.office_id = existing_office.id and membership.user_id = auth.uid()
    )
    where id = auth.uid();
    return existing_office;
  end if;

  insert into public.offices (
    name, lawyer_name, oab, city, state, whatsapp, email, areas, slug,
    owner_user_id, subscription_status, plan_code, trial_started_at,
    trial_ends_at, trial_ends_at_ms, limits
  ) values (
    trim(coalesce(input->>'name', '')),
    trim(coalesce(input->>'lawyerName', '')),
    trim(coalesce(input->>'oab', '')),
    trim(coalesce(input->>'city', '')),
    upper(trim(coalesce(input->>'state', ''))),
    trim(coalesce(input->>'whatsapp', '')),
    trim(coalesce(input->>'email', current_email)),
    coalesce(input->'areas', '[]'::jsonb),
    nullif(trim(input->>'slug'), ''),
    auth.uid(), 'TRIALING', 'trial', timezone('utc', now()),
    timezone('utc', now()) + interval '15 days',
    (extract(epoch from (timezone('utc', now()) + interval '15 days')) * 1000)::bigint,
    jsonb_build_object('maxUsers', 2, 'maxContacts', 100, 'maxStorageBytes', 536870912)
  ) returning * into new_office;

  insert into public.memberships (office_id, user_id, email, name, role, status)
  values (new_office.id, auth.uid(), current_email, coalesce(nullif(current_name, ''), new_office.lawyer_name), 'owner', 'active');

  update public.profiles set office_id = new_office.id, role = 'owner' where id = auth.uid();
  return new_office;
end;
$$;

revoke all on function public.create_office_with_owner(jsonb) from public;
grant execute on function public.create_office_with_owner(jsonb) to authenticated;
