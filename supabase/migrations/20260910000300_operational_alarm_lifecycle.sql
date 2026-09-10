create or replace function public.assert_operational_alarm_recipient(target_alarm_id uuid, target_user_id uuid)
returns public.operational_alarms
language plpgsql
security definer
set search_path = public
as $$
declare
  alarm_row public.operational_alarms;
begin
  if target_user_id is null then
    raise exception 'authentication_required' using errcode = 'P0001';
  end if;

  select * into alarm_row
    from public.operational_alarms
   where id = target_alarm_id
   for update;

  if not found or not public.is_office_member(alarm_row.office_id) then
    raise exception 'operational_alarm_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.operational_alarm_recipients
     where alarm_id = alarm_row.id
       and office_id = alarm_row.office_id
       and user_id = target_user_id
  ) then
    raise exception 'operational_alarm_not_recipient' using errcode = 'P0003';
  end if;

  return alarm_row;
end;
$$;

revoke all on function public.assert_operational_alarm_recipient(uuid, uuid) from public, anon, authenticated;

create or replace function public.mark_operational_alarm_read(target_alarm_id uuid)
returns public.operational_alarm_recipients
language plpgsql
security definer
set search_path = public
as $$
declare
  alarm_row public.operational_alarms;
  recipient_row public.operational_alarm_recipients;
  actor uuid := auth.uid();
begin
  alarm_row := public.assert_operational_alarm_recipient(target_alarm_id, actor);

  update public.operational_alarm_recipients
     set read_at = coalesce(read_at, timezone('utc', now())),
         updated_at = timezone('utc', now())
   where alarm_id = alarm_row.id and user_id = actor
   returning * into recipient_row;

  return recipient_row;
end;
$$;

revoke all on function public.mark_operational_alarm_read(uuid) from public, anon;
grant execute on function public.mark_operational_alarm_read(uuid) to authenticated;

create or replace function public.snooze_operational_alarm_for_me(target_alarm_id uuid, until_at timestamptz)
returns public.operational_alarm_recipients
language plpgsql
security definer
set search_path = public
as $$
declare
  alarm_row public.operational_alarms;
  recipient_row public.operational_alarm_recipients;
  actor uuid := auth.uid();
begin
  alarm_row := public.assert_operational_alarm_recipient(target_alarm_id, actor);
  if alarm_row.state not in ('OPEN', 'ACKNOWLEDGED') then
    raise exception 'operational_alarm_not_open' using errcode = 'P0001';
  end if;
  if until_at is null or until_at <= timezone('utc', now()) or until_at > timezone('utc', now()) + interval '7 days' then
    raise exception 'invalid_snooze_window' using errcode = 'P0001';
  end if;

  update public.operational_alarm_recipients
     set snoozed_until = until_at,
         updated_at = timezone('utc', now())
   where alarm_id = alarm_row.id and user_id = actor
   returning * into recipient_row;

  return recipient_row;
end;
$$;

revoke all on function public.snooze_operational_alarm_for_me(uuid, timestamptz) from public, anon;
grant execute on function public.snooze_operational_alarm_for_me(uuid, timestamptz) to authenticated;

create or replace function public.dismiss_operational_alarm_for_me(target_alarm_id uuid)
returns public.operational_alarm_recipients
language plpgsql
security definer
set search_path = public
as $$
declare
  alarm_row public.operational_alarms;
  recipient_row public.operational_alarm_recipients;
  actor uuid := auth.uid();
begin
  alarm_row := public.assert_operational_alarm_recipient(target_alarm_id, actor);
  if alarm_row.severity = 'CRITICAL' then
    raise exception 'critical_alarm_cannot_be_dismissed' using errcode = 'P0001';
  end if;

  update public.operational_alarm_recipients
     set dismissed_at = coalesce(dismissed_at, timezone('utc', now())),
         updated_at = timezone('utc', now())
   where alarm_id = alarm_row.id and user_id = actor
   returning * into recipient_row;

  return recipient_row;
end;
$$;

revoke all on function public.dismiss_operational_alarm_for_me(uuid) from public, anon;
grant execute on function public.dismiss_operational_alarm_for_me(uuid) to authenticated;

create or replace function public.acknowledge_operational_alarm(target_alarm_id uuid, expected_version integer default null)
returns public.operational_alarms
language plpgsql
security definer
set search_path = public
as $$
declare
  alarm_row public.operational_alarms;
  updated_row public.operational_alarms;
  actor uuid := auth.uid();
begin
  alarm_row := public.assert_operational_alarm_recipient(target_alarm_id, actor);
  if expected_version is not null and alarm_row.version <> expected_version then
    raise exception 'operational_alarm_version_conflict' using errcode = 'P0009';
  end if;
  if alarm_row.state = 'ACKNOWLEDGED' then
    return alarm_row;
  end if;
  if alarm_row.state <> 'OPEN' then
    raise exception 'operational_alarm_not_open' using errcode = 'P0001';
  end if;

  update public.operational_alarms
     set state = 'ACKNOWLEDGED',
         acknowledged_at = coalesce(acknowledged_at, timezone('utc', now())),
         acknowledged_by = coalesce(acknowledged_by, actor),
         version = version + 1,
         updated_at = timezone('utc', now())
   where id = alarm_row.id
     and state = 'OPEN'
     and (expected_version is null or version = expected_version)
   returning * into updated_row;

  if not found then
    raise exception 'operational_alarm_version_conflict' using errcode = 'P0009';
  end if;

  insert into public.operational_alarm_events (alarm_id, office_id, event_type, from_state, to_state, actor_user_id)
  values (updated_row.id, updated_row.office_id, 'ACKNOWLEDGED', alarm_row.state, updated_row.state, actor);
  insert into public.audit_logs (office_id, actor_user_id, action, target_type, target_id, metadata)
  values (updated_row.office_id, actor, 'operational_alarm.acknowledged', 'operational_alarm', updated_row.id, jsonb_build_object('ruleCode', updated_row.rule_code));

  return updated_row;
end;
$$;

revoke all on function public.acknowledge_operational_alarm(uuid, integer) from public, anon;
grant execute on function public.acknowledge_operational_alarm(uuid, integer) to authenticated;

create or replace function public.resolve_operational_alarm(target_alarm_id uuid, resolution text default 'resolved', reason text default null, expected_version integer default null)
returns public.operational_alarms
language plpgsql
security definer
set search_path = public
as $$
declare
  alarm_row public.operational_alarms;
  updated_row public.operational_alarms;
  actor uuid := auth.uid();
  normalized_reason text := nullif(left(coalesce(reason, ''), 1000), '');
begin
  alarm_row := public.assert_operational_alarm_recipient(target_alarm_id, actor);
  if expected_version is not null and alarm_row.version <> expected_version then
    raise exception 'operational_alarm_version_conflict' using errcode = 'P0009';
  end if;
  if alarm_row.state = 'RESOLVED' or alarm_row.state = 'CANCELED' then
    return alarm_row;
  end if;
  if alarm_row.state not in ('OPEN', 'ACKNOWLEDGED') then
    raise exception 'operational_alarm_not_open' using errcode = 'P0001';
  end if;

  update public.operational_alarms
     set state = 'RESOLVED',
         acknowledged_at = coalesce(acknowledged_at, timezone('utc', now())),
         acknowledged_by = coalesce(acknowledged_by, actor),
         resolved_at = timezone('utc', now()),
         resolved_by = actor,
         resolution_code = left(coalesce(resolution, 'resolved'), 120),
         resolved_automatically = false,
         version = version + 1,
         updated_at = timezone('utc', now())
   where id = alarm_row.id
     and state in ('OPEN', 'ACKNOWLEDGED')
     and (expected_version is null or version = expected_version)
   returning * into updated_row;

  if not found then
    raise exception 'operational_alarm_version_conflict' using errcode = 'P0009';
  end if;

  insert into public.operational_alarm_events (alarm_id, office_id, event_type, from_state, to_state, actor_user_id, reason)
  values (updated_row.id, updated_row.office_id, 'RESOLVED', alarm_row.state, updated_row.state, actor, normalized_reason);
  insert into public.audit_logs (office_id, actor_user_id, action, target_type, target_id, metadata)
  values (updated_row.office_id, actor, 'operational_alarm.resolved', 'operational_alarm', updated_row.id, jsonb_build_object('ruleCode', updated_row.rule_code, 'resolutionCode', updated_row.resolution_code));

  return updated_row;
end;
$$;

revoke all on function public.resolve_operational_alarm(uuid, text, text, integer) from public, anon;
grant execute on function public.resolve_operational_alarm(uuid, text, text, integer) to authenticated;
