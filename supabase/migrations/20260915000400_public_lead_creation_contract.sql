create or replace function public.create_public_lead(
  requested_slug text,
  lead_name text,
  lead_phone text,
  lead_email text,
  lead_city text,
  lead_state text,
  lead_area text,
  lead_summary text,
  lead_consent_lgpd boolean,
  lead_source text,
  lead_utm_source text default null,
  lead_utm_medium text default null,
  lead_utm_campaign text default null
)
returns table (
  lead_id uuid,
  success boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_slug text := lower(btrim(requested_slug));
  normalized_name text := btrim(lead_name);
  normalized_phone text := regexp_replace(coalesce(lead_phone, ''), '[^0-9]', '', 'g');
  normalized_email text := coalesce(btrim(lead_email), '');
  normalized_city text := btrim(lead_city);
  normalized_state text := upper(btrim(lead_state));
  normalized_area text := btrim(lead_area);
  normalized_summary text := btrim(lead_summary);
  normalized_source text := coalesce(nullif(btrim(lead_source), ''), 'Formulário Público');
  normalized_utm_source text := nullif(btrim(lead_utm_source), '');
  normalized_utm_medium text := nullif(btrim(lead_utm_medium), '');
  normalized_utm_campaign text := nullif(btrim(lead_utm_campaign), '');
  derived_office_id uuid;
  created_lead_id uuid;
begin
  if normalized_slug is null
     or length(normalized_slug) not between 1 and 120
     or normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'public_lead_invalid_payload';
  end if;

  if normalized_name is null
     or length(normalized_name) not between 1 and 200
     or normalized_name ~ '[[:cntrl:]]'
     or normalized_phone !~ '^[0-9]{10,15}$'
     or length(normalized_email) > 320
     or (normalized_email <> '' and normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
     or normalized_city is null
     or length(normalized_city) not between 1 and 120
     or normalized_city ~ '[[:cntrl:]]'
     or normalized_state is null
     or normalized_state !~ '^[A-Z]{2}$'
     or normalized_area is null
     or normalized_area not in (
       'Direito de Família', 'Direito Previdenciário', 'Direito Trabalhista',
       'Direito Civil', 'Direito do Consumidor', 'Direito Imobiliário',
       'Direito Empresarial', 'Direito Sucessório', 'Direito Contratual',
       'Direito Tributário', 'Outro'
     )
     or normalized_summary is null
     or length(normalized_summary) not between 1 and 5000
     or normalized_source not in (
       'Formulário Público', 'Landing Page', 'Site', 'WhatsApp',
       'Instagram', 'Indicação', 'Outro'
     )
     or normalized_utm_source is not null and (length(normalized_utm_source) > 120 or normalized_utm_source ~ '[[:cntrl:]]')
     or normalized_utm_medium is not null and (length(normalized_utm_medium) > 120 or normalized_utm_medium ~ '[[:cntrl:]]')
     or normalized_utm_campaign is not null and (length(normalized_utm_campaign) > 120 or normalized_utm_campaign ~ '[[:cntrl:]]') then
    raise exception using errcode = '22023', message = 'public_lead_invalid_payload';
  end if;

  if lead_consent_lgpd is not true then
    raise exception using errcode = '22023', message = 'public_lead_consent_required';
  end if;

  select f.office_id
    into derived_office_id
    from public.public_forms as f
   where f.slug = normalized_slug
     and f.is_active = true
   limit 1;

  if derived_office_id is null then
    raise exception using errcode = '22023', message = 'public_form_unavailable';
  end if;

  insert into public.leads (
    office_id,
    name,
    phone,
    email,
    city,
    state,
    area,
    summary,
    consent_lgpd,
    source,
    status,
    priority,
    responsible_user_id,
    notes,
    created_via,
    public_form_slug,
    utm_source,
    utm_medium,
    utm_campaign
  )
  values (
    derived_office_id,
    normalized_name,
    normalized_phone,
    normalized_email,
    normalized_city,
    normalized_state,
    normalized_area,
    normalized_summary,
    true,
    normalized_source,
    'Novo contato',
    'Média',
    null,
    '',
    'public_form',
    normalized_slug,
    normalized_utm_source,
    normalized_utm_medium,
    normalized_utm_campaign
  )
  returning id into created_lead_id;

  return query select created_lead_id, true;
end;
$$;

revoke all on function public.create_public_lead(text, text, text, text, text, text, text, text, boolean, text, text, text, text) from public;
grant execute on function public.create_public_lead(text, text, text, text, text, text, text, text, boolean, text, text, text, text) to anon, authenticated;
