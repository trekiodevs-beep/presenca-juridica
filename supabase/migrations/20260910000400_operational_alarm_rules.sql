create or replace function public.upsert_operational_alarm(
  target_office_id uuid,
  target_source_type text,
  target_source_id uuid,
  target_rule_code text,
  target_cycle_key text,
  target_severity text,
  target_title text,
  target_message text,
  target_action_path text,
  target_assigned_user_id uuid default null,
  target_base_at timestamptz default null,
  target_due_at timestamptz default null,
  target_metadata jsonb default '{}'::jsonb,
  target_recipient_roles text[] default '{}'::text[]
)
returns public.operational_alarms
language plpgsql
security definer
set search_path = public
as $$
declare
  alarm_row public.operational_alarms;
  inserted_row boolean := false;
begin
  if target_office_id is null or target_source_type is null or target_rule_code is null or target_cycle_key is null then
    raise exception 'operational_alarm_source_required' using errcode = 'P0001';
  end if;

  insert into public.operational_alarms (
    office_id, source_type, source_id, rule_code, cycle_key, severity,
    state, assigned_user_id, title, message, action_path, base_at, due_at,
    triggered_at, metadata, rule_version, version, last_evaluated_at
  )
  values (
    target_office_id, target_source_type, target_source_id, target_rule_code, target_cycle_key, target_severity,
    'OPEN', target_assigned_user_id, left(target_title, 160), left(coalesce(target_message, ''), 2000), target_action_path,
    target_base_at, target_due_at, timezone('utc', now()), coalesce(target_metadata, '{}'::jsonb), 1, 1, timezone('utc', now())
  )
  on conflict (office_id, source_type, source_id, rule_code, cycle_key)
    where state in ('OPEN', 'ACKNOWLEDGED')
  do nothing
  returning * into alarm_row;

  if found then
    inserted_row := true;
  else
    select * into alarm_row
      from public.operational_alarms
     where office_id = target_office_id
       and source_type = target_source_type
       and source_id is not distinct from target_source_id
       and rule_code = target_rule_code
       and cycle_key = target_cycle_key
       and state in ('OPEN', 'ACKNOWLEDGED')
     for update;

    if not found then
      raise exception 'operational_alarm_upsert_race' using errcode = 'P0001';
    end if;

    update public.operational_alarms
       set severity = target_severity,
           title = left(target_title, 160),
           message = left(coalesce(target_message, ''), 2000),
           action_path = target_action_path,
           assigned_user_id = target_assigned_user_id,
           base_at = target_base_at,
           due_at = target_due_at,
           metadata = coalesce(target_metadata, '{}'::jsonb),
           last_evaluated_at = timezone('utc', now()),
           version = version + 1,
           updated_at = timezone('utc', now())
     where id = alarm_row.id
     returning * into alarm_row;
  end if;

  if inserted_row then
    insert into public.operational_alarm_events (alarm_id, office_id, event_type, to_state, metadata)
    values (alarm_row.id, alarm_row.office_id, 'CREATED', alarm_row.state, jsonb_build_object('ruleCode', alarm_row.rule_code));
  end if;

  insert into public.operational_alarm_recipients (alarm_id, office_id, user_id, delivery_reason)
  select alarm_row.id,
         alarm_row.office_id,
         membership.user_id,
         case
           when membership.user_id = target_assigned_user_id then 'ASSIGNEE'
           when membership.role = 'owner' then 'OWNER'
           when membership.role = 'admin' then 'ADMIN'
           when membership.role = 'finance' then 'FINANCE'
           else 'FALLBACK'
         end
    from public.memberships membership
   where membership.office_id = alarm_row.office_id
     and membership.status = 'active'
     and membership.user_id is not null
     and (
       membership.user_id = target_assigned_user_id
       or membership.role = any(coalesce(target_recipient_roles, '{}'::text[]))
     )
  on conflict (alarm_id, user_id) do update
    set delivery_reason = excluded.delivery_reason,
        updated_at = timezone('utc', now());

  return alarm_row;
end;
$$;

revoke all on function public.upsert_operational_alarm(uuid, text, uuid, text, text, text, text, text, text, uuid, timestamptz, timestamptz, jsonb, text[]) from public, anon, authenticated;

create or replace function public.resolve_operational_alarm_internal(target_alarm_id uuid, target_resolution_code text, target_reason text default null)
returns public.operational_alarms
language plpgsql
security definer
set search_path = public
as $$
declare
  alarm_row public.operational_alarms;
  resolved_row public.operational_alarms;
begin
  select * into alarm_row from public.operational_alarms where id = target_alarm_id for update;
  if not found or alarm_row.state not in ('OPEN', 'ACKNOWLEDGED') then return alarm_row; end if;

  update public.operational_alarms
     set state = 'RESOLVED',
         resolved_at = timezone('utc', now()),
         resolved_by = null,
         resolution_code = left(coalesce(target_resolution_code, 'source_resolved'), 120),
         resolved_automatically = true,
         version = version + 1,
         updated_at = timezone('utc', now())
   where id = alarm_row.id and state in ('OPEN', 'ACKNOWLEDGED')
   returning * into resolved_row;

  insert into public.operational_alarm_events (alarm_id, office_id, event_type, from_state, to_state, reason)
  values (resolved_row.id, resolved_row.office_id, 'RESOLVED', alarm_row.state, resolved_row.state, left(target_reason, 1000));
  insert into public.audit_logs (office_id, actor_user_id, action, target_type, target_id, metadata)
  values (resolved_row.office_id, null, 'operational_alarm.auto_resolved', 'operational_alarm', resolved_row.id, jsonb_build_object('ruleCode', resolved_row.rule_code, 'resolutionCode', resolved_row.resolution_code));

  return resolved_row;
end;
$$;

revoke all on function public.resolve_operational_alarm_internal(uuid, text, text) from public, anon, authenticated;

create or replace function public.evaluate_office_operational_alarms(target_office_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_row record;
  task_row record;
  calendar_row record;
  financial_row record;
  alarm_row public.operational_alarms;
  created_count integer := 0;
  resolved_count integer := 0;
  now_at timestamptz := timezone('utc', now());
  status_cycle text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = 'P0001';
  end if;
  if target_office_id is null then
    raise exception 'office_required' using errcode = 'P0001';
  end if;

  for lead_row in
    select * from public.leads
     where office_id = target_office_id
       and archived_at is null
  loop
    if lead_row.responsible_user_id is null
       and lead_row.status not in ('Contratado', 'Arquivado', 'Não avançou')
       and lead_row.created_at < now_at - interval '30 minutes' then
      alarm_row := public.upsert_operational_alarm(
        target_office_id, 'LEAD', lead_row.id, 'LEAD_UNASSIGNED', 'created:' || lead_row.created_at::text,
        'WARNING', 'Contato sem responsável', 'Defina um responsável para este contato.', '/leads/' || lead_row.id::text,
        null, lead_row.created_at, lead_row.created_at + interval '30 minutes', jsonb_build_object('leadId', lead_row.id), array['owner', 'admin']
      );
      if alarm_row.triggered_at = alarm_row.created_at then created_count := created_count + 1; end if;
    end if;

    if lead_row.status in ('Novo contato', 'Aguardando triagem')
       and lead_row.created_at < now_at - interval '24 hours' then
      select coalesce(max(created_at), lead_row.created_at)::text into status_cycle
        from public.lead_events
       where lead_id = lead_row.id and type = 'status_changed' and to_status = lead_row.status;
      alarm_row := public.upsert_operational_alarm(
        target_office_id, 'LEAD', lead_row.id, 'TRIAGE_OVERDUE', 'status:' || lead_row.status || ':' || status_cycle,
        'WARNING', 'Triagem atrasada', 'Este contato aguarda triagem há mais de 24 horas.', '/leads/' || lead_row.id::text,
        lead_row.responsible_user_id, lead_row.created_at, lead_row.created_at + interval '24 hours', jsonb_build_object('leadId', lead_row.id, 'status', lead_row.status), array['owner', 'admin']
      );
    end if;

    if lead_row.next_action_at is not null
       and lead_row.next_action_at < now_at
       and lead_row.status not in ('Contratado', 'Arquivado', 'Não avançou') then
      alarm_row := public.upsert_operational_alarm(
        target_office_id, 'LEAD', lead_row.id, 'NEXT_ACTION_OVERDUE', 'next_action:' || lead_row.next_action_at::text,
        'WARNING', 'Providência vencida', coalesce(lead_row.next_action_text, 'A próxima ação deste contato está vencida.'), '/leads/' || lead_row.id::text,
        lead_row.responsible_user_id, lead_row.next_action_at, lead_row.next_action_at, jsonb_build_object('leadId', lead_row.id), array['owner', 'admin']
      );
    end if;
  end loop;

  for task_row in
    select * from public.tasks
     where office_id = target_office_id
       and not done
  loop
    if task_row.due_at < now_at then
      alarm_row := public.upsert_operational_alarm(
        target_office_id, 'TASK', task_row.id, 'TASK_OVERDUE', 'due:' || task_row.due_at::text,
        'WARNING', 'Tarefa vencida', task_row.title, '/tarefas', task_row.responsible_user_id,
        task_row.due_at, task_row.due_at, jsonb_build_object('taskId', task_row.id, 'leadId', task_row.lead_id), array['owner', 'admin']
      );
    end if;
  end loop;

  for calendar_row in
    select * from public.calendar_events
     where office_id = target_office_id
       and status = 'Agendado'
  loop
    if calendar_row.start_at >= now_at and calendar_row.start_at <= now_at + interval '24 hours' then
      alarm_row := public.upsert_operational_alarm(
        target_office_id, 'CALENDAR_EVENT', calendar_row.id, 'APPOINTMENT_UPCOMING_24H', 'start:24h:' || calendar_row.start_at::text,
        'INFO', 'Compromisso nas próximas 24 horas', calendar_row.title, '/agenda', calendar_row.responsible_user_id,
        calendar_row.start_at - interval '24 hours', calendar_row.start_at, jsonb_build_object('calendarEventId', calendar_row.id, 'type', calendar_row.type), array['owner', 'admin']
      );
    end if;
    if calendar_row.start_at >= now_at and calendar_row.start_at <= now_at + interval '1 hour' then
      alarm_row := public.upsert_operational_alarm(
        target_office_id, 'CALENDAR_EVENT', calendar_row.id, 'APPOINTMENT_UPCOMING_1H', 'start:1h:' || calendar_row.start_at::text,
        'WARNING', 'Compromisso na próxima hora', calendar_row.title, '/agenda', calendar_row.responsible_user_id,
        calendar_row.start_at - interval '1 hour', calendar_row.start_at, jsonb_build_object('calendarEventId', calendar_row.id, 'type', calendar_row.type), array['owner', 'admin']
      );
    end if;
  end loop;

  for financial_row in
    select * from public.financial_records
     where office_id = target_office_id
       and due_at is not null
       and due_at < now_at
       and status not in ('Pago', 'Cancelado')
  loop
    alarm_row := public.upsert_operational_alarm(
      target_office_id, 'FINANCIAL_RECORD', financial_row.id, 'FINANCIAL_OVERDUE', 'due:' || financial_row.due_at::text,
      'WARNING', 'Lançamento financeiro vencido', 'Existe um lançamento financeiro pendente de regularização.', '/financeiro', null,
      financial_row.due_at, financial_row.due_at, jsonb_build_object('financialRecordId', financial_row.id), array['owner', 'admin', 'finance']
    );
  end loop;

  for calendar_row in
    select * from public.calendar_events
     where office_id = target_office_id
       and sync_status = 'failed'
  loop
    alarm_row := public.upsert_operational_alarm(
      target_office_id, 'CALENDAR_INTEGRATION', calendar_row.id, 'CALENDAR_SYNC_FAILED', 'sync:' || coalesce(calendar_row.updated_at::text, calendar_row.id::text),
      'CRITICAL', 'Falha na sincronização da agenda', 'Um compromisso não foi sincronizado com o Google Agenda.', '/settings', calendar_row.responsible_user_id,
      calendar_row.updated_at, null, jsonb_build_object('calendarEventId', calendar_row.id), array['owner', 'admin']
    );
  end loop;

  update public.operational_alarms alarm
     set last_evaluated_at = now_at
   where office_id = target_office_id
     and state in ('OPEN', 'ACKNOWLEDGED')
     and last_evaluated_at is null;

  with stale as (
    select alarm.id
      from public.operational_alarms alarm
     where alarm.office_id = target_office_id
       and alarm.state in ('OPEN', 'ACKNOWLEDGED')
       and (
         (alarm.rule_code = 'LEAD_UNASSIGNED' and not exists (select 1 from public.leads lead where lead.id = alarm.source_id and lead.office_id = target_office_id and lead.responsible_user_id is null and lead.archived_at is null and lead.status not in ('Contratado', 'Arquivado', 'Não avançou') and lead.created_at < now_at - interval '30 minutes'))
         or (alarm.rule_code = 'TRIAGE_OVERDUE' and not exists (select 1 from public.leads lead where lead.id = alarm.source_id and lead.office_id = target_office_id and lead.status in ('Novo contato', 'Aguardando triagem') and lead.archived_at is null and lead.created_at < now_at - interval '24 hours'))
         or (alarm.rule_code = 'NEXT_ACTION_OVERDUE' and not exists (select 1 from public.leads lead where lead.id = alarm.source_id and lead.office_id = target_office_id and lead.next_action_at < now_at and lead.status not in ('Contratado', 'Arquivado', 'Não avançou')))
         or (alarm.rule_code = 'TASK_OVERDUE' and not exists (select 1 from public.tasks task where task.id = alarm.source_id and task.office_id = target_office_id and not task.done and task.due_at < now_at))
         or (alarm.rule_code like 'APPOINTMENT_UPCOMING_%' and not exists (select 1 from public.calendar_events event where event.id = alarm.source_id and event.office_id = target_office_id and event.status = 'Agendado' and event.start_at >= now_at and event.start_at <= now_at + case when alarm.rule_code like '%24H' then interval '24 hours' else interval '1 hour' end))
         or (alarm.rule_code = 'FINANCIAL_OVERDUE' and not exists (select 1 from public.financial_records record where record.id = alarm.source_id and record.office_id = target_office_id and record.due_at < now_at and record.status not in ('Pago', 'Cancelado')))
         or (alarm.rule_code = 'CALENDAR_SYNC_FAILED' and not exists (select 1 from public.calendar_events event where event.id = alarm.source_id and event.office_id = target_office_id and event.sync_status = 'failed'))
       )
  )
  select count(*) into resolved_count from stale;

  for alarm_row in
    select alarm.*
      from public.operational_alarms alarm
     where alarm.office_id = target_office_id
       and alarm.state in ('OPEN', 'ACKNOWLEDGED')
       and (
         (alarm.rule_code = 'LEAD_UNASSIGNED' and not exists (select 1 from public.leads lead where lead.id = alarm.source_id and lead.office_id = target_office_id and lead.responsible_user_id is null and lead.archived_at is null and lead.status not in ('Contratado', 'Arquivado', 'Não avançou') and lead.created_at < now_at - interval '30 minutes'))
         or (alarm.rule_code = 'TRIAGE_OVERDUE' and not exists (select 1 from public.leads lead where lead.id = alarm.source_id and lead.office_id = target_office_id and lead.status in ('Novo contato', 'Aguardando triagem') and lead.archived_at is null and lead.created_at < now_at - interval '24 hours'))
         or (alarm.rule_code = 'NEXT_ACTION_OVERDUE' and not exists (select 1 from public.leads lead where lead.id = alarm.source_id and lead.office_id = target_office_id and lead.next_action_at < now_at and lead.status not in ('Contratado', 'Arquivado', 'Não avançou')))
         or (alarm.rule_code = 'TASK_OVERDUE' and not exists (select 1 from public.tasks task where task.id = alarm.source_id and task.office_id = target_office_id and not task.done and task.due_at < now_at))
         or (alarm.rule_code like 'APPOINTMENT_UPCOMING_%' and not exists (select 1 from public.calendar_events event where event.id = alarm.source_id and event.office_id = target_office_id and event.status = 'Agendado' and event.start_at >= now_at and event.start_at <= now_at + case when alarm.rule_code like '%24H' then interval '24 hours' else interval '1 hour' end))
         or (alarm.rule_code = 'FINANCIAL_OVERDUE' and not exists (select 1 from public.financial_records record where record.id = alarm.source_id and record.office_id = target_office_id and record.due_at < now_at and record.status not in ('Pago', 'Cancelado')))
         or (alarm.rule_code = 'CALENDAR_SYNC_FAILED' and not exists (select 1 from public.calendar_events event where event.id = alarm.source_id and event.office_id = target_office_id and event.sync_status = 'failed'))
       )
  loop
    perform public.resolve_operational_alarm_internal(alarm_row.id, 'source_resolved', 'A condição de origem deixou de existir.');
  end loop;

  return jsonb_build_object('officeId', target_office_id, 'evaluatedAt', now_at, 'created', created_count, 'resolved', resolved_count);
end;
$$;

revoke all on function public.evaluate_office_operational_alarms(uuid) from public, anon, authenticated;
grant execute on function public.evaluate_office_operational_alarms(uuid) to service_role;
