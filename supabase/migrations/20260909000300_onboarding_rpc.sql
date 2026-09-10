create or replace function public.create_office_with_owner(input jsonb)
returns public.offices
language plpgsql
security definer
set search_path = public
as $$
declare
  new_office public.offices;
  current_email text;
  current_name text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select email, name into current_email, current_name from public.profiles where id = auth.uid();
  if current_email is null then
    raise exception 'profile_required';
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

create policy profiles_self_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());
