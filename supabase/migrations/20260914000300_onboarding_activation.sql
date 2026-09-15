-- Guided activation: the backend is the source of truth for the minimum
-- viable setup. Optional integrations must not block first value.
alter table public.offices
  add column if not exists onboarding_version integer not null default 2;

create or replace function public.get_onboarding_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_office_id uuid;
  office_ready boolean;
  first_contact_ready boolean;
  first_action_ready boolean;
  google_connected boolean;
  next_action text;
  recommendations jsonb := '[]'::jsonb;
begin
  select membership.office_id
    into current_office_id
    from public.memberships membership
   where membership.user_id = auth.uid()
     and membership.status = 'active'
   order by membership.created_at asc
   limit 1;

  if current_office_id is null then
    raise exception 'office_membership_required';
  end if;

  select (
    nullif(trim(office.name), '') is not null
    and nullif(trim(office.lawyer_name), '') is not null
    and nullif(trim(office.whatsapp), '') is not null
    and nullif(trim(coalesce(office.slug, '')), '') is not null
    and jsonb_typeof(coalesce(office.areas, '[]'::jsonb)) = 'array'
    and jsonb_array_length(coalesce(office.areas, '[]'::jsonb)) > 0
  ) into office_ready
  from public.offices office
  where office.id = current_office_id;

  select exists (
    select 1 from public.leads lead
     where lead.office_id = current_office_id
       and lead.archived_at is null
  ) into first_contact_ready;

  select exists (
    select 1 from public.tasks task
     where task.office_id = current_office_id
  ) or exists (
    select 1 from public.calendar_events event
     where event.office_id = current_office_id
       and event.deleted_at is null
  ) or exists (
    select 1 from public.leads lead
     where lead.office_id = current_office_id
       and lead.archived_at is null
       and lead.next_action_at is not null
  ) into first_action_ready;

  select exists (
    select 1 from public.calendar_connections connection
     where connection.office_id = current_office_id
       and connection.status = 'active'
       and nullif(trim(coalesce(connection.calendar_id, '')), '') is not null
  ) into google_connected;

  if not office_ready then
    next_action := 'office';
    recommendations := recommendations || jsonb_build_array(jsonb_build_object(
      'key', 'office', 'label', 'Complete o perfil do escritório', 'href', '/settings'
    ));
  elsif not first_contact_ready then
    next_action := 'first_contact';
    recommendations := recommendations || jsonb_build_array(jsonb_build_object(
      'key', 'first_contact', 'label', 'Crie ou receba seu primeiro contato', 'href', '/onboarding'
    ));
  elsif not first_action_ready then
    next_action := 'first_action';
    recommendations := recommendations || jsonb_build_array(jsonb_build_object(
      'key', 'first_action', 'label', 'Registre a próxima providência', 'href', '/tarefas'
    ));
  else
    next_action := 'activated';
  end if;

  if not google_connected then
    recommendations := recommendations || jsonb_build_array(jsonb_build_object(
      'key', 'google_calendar', 'label', 'Conecte a Google Agenda quando quiser', 'href', '/settings#integrations', 'optional', true
    ));
  end if;

  return jsonb_build_object(
    'version', 2,
    'officeId', current_office_id,
    'milestones', jsonb_build_object(
      'officeReady', coalesce(office_ready, false),
      'firstContactReady', first_contact_ready,
      'firstActionReady', first_action_ready
    ),
    'optional', jsonb_build_object('googleCalendarConnected', google_connected),
    'nextAction', next_action,
    'recommendations', recommendations
  );
end;
$$;

create or replace function public.create_onboarding_example_contact()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_office_id uuid;
  actor_user_id uuid := auth.uid();
  existing_lead public.leads;
  created_lead public.leads;
begin
  select membership.office_id into current_office_id
    from public.memberships membership
   where membership.user_id = actor_user_id
     and membership.status = 'active'
     and membership.role in ('owner', 'admin', 'lawyer', 'assistant')
   order by membership.created_at asc limit 1;

  if current_office_id is null then raise exception 'office_membership_required'; end if;

  select * into existing_lead from public.leads
   where office_id = current_office_id
     and created_via = 'onboarding_example'
     and archived_at is null
   order by created_at asc limit 1;

  if existing_lead.id is not null then
    return to_jsonb(existing_lead);
  end if;

  insert into public.leads (
    office_id, name, phone, email, city, state, source, area, status, priority,
    summary, notes, consent_lgpd, responsible_user_id, created_via
  )
  select current_office_id, 'Contato de exemplo', '00000000000', '', office.city, office.state,
    'Cadastro Manual', coalesce(office.areas->>0, 'Outro'), 'Novo contato', 'Média',
    'Contato criado para conhecer a jornada do sistema.', 'Exemplo interno; não representa uma pessoa real.',
    false, actor_user_id, 'onboarding_example'
  from public.offices office where office.id = current_office_id
  returning * into created_lead;

  insert into public.lead_events (office_id, lead_id, type, description, created_by, metadata)
  values (current_office_id, created_lead.id, 'created', 'Contato de exemplo criado no onboarding.', actor_user_id,
    jsonb_build_object('source', 'onboarding_example'));

  return to_jsonb(created_lead);
end;
$$;

grant execute on function public.get_onboarding_state() to authenticated;
grant execute on function public.create_onboarding_example_contact() to authenticated;
