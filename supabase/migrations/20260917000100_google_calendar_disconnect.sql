-- Disconnect one user's Google Calendar integration without deleting CRM events.
-- External OAuth/channel revocation happens in the Edge Function; this RPC keeps
-- the local state transition atomic and service-role only.

create or replace function public.disconnect_google_calendar_local(
  target_connection_id uuid,
  actor_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_connection public.calendar_connections;
  preserved_events integer := 0;
  cancelled_queue_items integer := 0;
  has_another_active_connection boolean := false;
begin
  select * into target_connection
    from public.calendar_connections
   where id = target_connection_id
     and user_id = actor_user_id
     and provider = 'google'
   for update;

  if target_connection.id is null then
    raise exception 'calendar_connection_not_found';
  end if;

  if not exists (
    select 1 from public.memberships
     where office_id = target_connection.office_id
       and user_id = actor_user_id
       and status = 'active'
  ) then
    raise exception 'active_membership_required';
  end if;

  delete from public.calendar_connections where id = target_connection.id;

  select exists (
    select 1 from public.calendar_connections
     where office_id = target_connection.office_id
       and provider = 'google'
       and status = 'active'
  ) into has_another_active_connection;

  if not has_another_active_connection then
    update public.calendar_sync_outbox
       set status = 'completed',
           locked_at = null,
           last_error = 'Cancelada porque o Google Agenda foi desconectado.',
           updated_at = timezone('utc', now())
     where office_id = target_connection.office_id
       and status in ('pending', 'processing');
    get diagnostics cancelled_queue_items = row_count;

    update public.calendar_events
       set sync_status = 'not_connected',
           sync_error = null,
           last_synced_at = null
     where office_id = target_connection.office_id
       and external_provider = 'google';
    get diagnostics preserved_events = row_count;
  end if;

  insert into public.audit_logs (office_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    target_connection.office_id,
    actor_user_id,
    'google_calendar_disconnected',
    'calendar_connection',
    target_connection.id,
    jsonb_build_object(
      'googleAccountEmail', target_connection.google_account_email,
      'calendarId', target_connection.calendar_id,
      'calendarName', target_connection.calendar_name,
      'preservedEvents', preserved_events,
      'cancelledQueueItems', cancelled_queue_items
    )
  );

  return jsonb_build_object(
    'officeId', target_connection.office_id,
    'preservedEvents', preserved_events,
    'cancelledQueueItems', cancelled_queue_items
  );
end;
$$;

revoke all on function public.disconnect_google_calendar_local(uuid, uuid) from public, anon, authenticated;
grant execute on function public.disconnect_google_calendar_local(uuid, uuid) to service_role;
