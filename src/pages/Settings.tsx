import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { disconnectGoogleCalendar, GoogleCalendarSettingsError, listGoogleCalendars, selectGoogleCalendar as selectGoogleCalendarConnection, updateOffice as dbUpdateOffice, updatePublicForm, type GoogleCalendarOption } from '../services/supabaseDb';
import { createSupabaseOffice } from '../services/supabaseAuth';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Building2, MessageSquare, ShieldAlert, Link as LinkIcon, Copy, ExternalLink, Globe, Clock, Calendar, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { useToast } from '../context/ToastContext';
import { getTrialState, TRIAL_DAYS } from '../lib/trial';
import { supabase } from '../lib/supabase';
import { DEFAULT_WHATSAPP_MESSAGE } from '../lib/whatsappMessage';
import { CityStateFields } from '../components/CityStateFields';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

const DEFAULT_AREAS = ['Direito de Família', 'Direito Trabalhista', 'Direito do Consumidor', 'Direito Empresarial'];

export const Settings = () => {
  const { office, user, updateUserOfficeId, setOffice } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarConnection, setCalendarConnection] = useState<{ google_account_email: string | null; calendar_id: string | null; calendar_name: string | null; status: string; last_sync_at: string | null } | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarOption[]>([]);
  const [confirmingCalendarDisconnect, setConfirmingCalendarDisconnect] = useState(false);

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Link copiado com sucesso.', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const [formData, setFormData] = useState({
    name: '',
    lawyerName: '',
    oab: '',
    email: '',
    whatsapp: '',
    whatsappMessageTemplate: DEFAULT_WHATSAPP_MESSAGE,
    city: '',
    state: '',
    slug: ''
  });

  const trialState = getTrialState(office);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('calendar');
    if (!result) return;
    const messages: Record<string, [string, 'success' | 'error' | 'info']> = {
      connected: ['Google Agenda conectada com sucesso.', 'success'],
      error: ['Não foi possível conectar a Google Agenda.', 'error'],
      not_configured: ['A integração Google Agenda ainda não está configurada no servidor.', 'error'],
      invalid_state: ['A autorização expirou. Tente conectar novamente.', 'error'],
      server_error: ['Não foi possível validar a autorização no servidor. Tente novamente em instantes.', 'error'],
      token_error: ['O Google não autorizou a conexão.', 'error'],
    };
    const message = messages[result];
    if (message) showToast(message[0], message[1]);
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
  }, [showToast]);

  const connectGoogleCalendar = async () => {
    if (!office?.id) {
      showToast('Crie o escritório antes de conectar a Google Agenda.', 'info');
      return;
    }
    setCalendarLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calendar-oauth-start', { body: {} });
      if (error || !data?.authorizationUrl) {
        const context = error?.context as { json?: () => Promise<{ missing?: string[] }> } | undefined;
        const details = context?.json ? await context.json().catch(() => ({ missing: [] as string[] })) : { missing: [] as string[] };
        const missingConfiguration = Array.isArray(details.missing) && details.missing.length > 0;
        throw new Error(missingConfiguration ? 'calendar_configuration_incomplete' : error?.message || 'calendar_authorization_unavailable');
      }
      window.location.assign(String(data.authorizationUrl));
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error && error.message === 'calendar_configuration_incomplete'
        ? 'A conexão com o Google Agenda está temporariamente indisponível. Tente novamente mais tarde.'
        : 'Não foi possível conectar ao Google Agenda agora. Tente novamente.', 'error');
    } finally { setCalendarLoading(false); }
  };

  const loadGoogleCalendars = async () => {
    setCalendarLoading(true);
    try {
      const calendars = await listGoogleCalendars();
      setGoogleCalendars(calendars);
      showToast(calendars.length > 0 ? 'Agendas disponíveis carregadas. Escolha onde os compromissos do CRM serão sincronizados.' : 'Nenhuma agenda disponível para sincronização foi encontrada nesta conta Google.', calendars.length > 0 ? 'success' : 'info');
    } catch (error) { console.error(error); showToast(error instanceof GoogleCalendarSettingsError ? error.message : 'Não foi possível carregar suas agendas agora. Tente novamente.', 'error'); }
    finally { setCalendarLoading(false); }
  };

  const selectGoogleCalendar = async (calendarId: string) => {
    const selected = googleCalendars.find(calendar => calendar.id === calendarId);
    if (!selected) return;
    setCalendarLoading(true);
    try {
      const data = await selectGoogleCalendarConnection(selected);
      setCalendarConnection(current => current ? { ...current, ...data.connection } : current);
      showToast(data.syncQueued ? 'Agenda selecionada. Os compromissos do CRM serão sincronizados com o Google Agenda.' : 'Agenda selecionada. A sincronização automática será retomada em instantes.', data.syncQueued ? 'success' : 'info');
    } catch (error) {
      console.error(error);
      showToast(error instanceof GoogleCalendarSettingsError ? error.message : 'Não foi possível selecionar esta agenda. Tente novamente.', 'error');
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleDisconnectGoogleCalendar = async () => {
    setCalendarLoading(true);
    try {
      const result = await disconnectGoogleCalendar();
      setCalendarConnection(null);
      setGoogleCalendars([]);
      setConfirmingCalendarDisconnect(false);
      showToast(result.googleRevoked
        ? 'Google Agenda desconectada. Os compromissos continuam disponíveis somente no CRM.'
        : 'Google Agenda desconectada do CRM. Para concluir a revogação também no Google, remova o acesso nas conexões da sua Conta Google.', result.googleRevoked ? 'success' : 'info');
    } catch (error) {
      console.error(error);
      showToast(error instanceof GoogleCalendarSettingsError ? error.message : 'Não foi possível desconectar o Google Agenda. Tente novamente.', 'error');
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    if (!office?.id) {
      setCalendarConnection(null);
      return;
    }
    let cancelled = false;
    void supabase.functions.invoke('calendar-connection-status', { method: 'GET' }).then(({ data, error }) => {
      if (!cancelled && !error) {
        setCalendarConnection(data?.connection || null);
        if (data?.connection?.status === 'active') void loadGoogleCalendars();
      }
    });
    return () => { cancelled = true; };
  }, [user?.id, office?.id]);

  useEffect(() => {
    if (office) {
      setFormData({
        name: office.name || '',
        lawyerName: office.lawyerName || '',
        oab: office.oab || '',
        email: office.email || '',
        whatsapp: office.whatsapp || '',
        whatsappMessageTemplate: office.whatsappMessageTemplate || DEFAULT_WHATSAPP_MESSAGE,
        city: office.city || '',
        state: office.state || '',
        slug: office.slug || ''
      });
    }
  }, [office]);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove accents
    value = value.replace(/[^a-z0-9-]/g, '-'); // replace non-alphanumeric with hyphen
    value = value.replace(/-+/g, '-'); // remove multiple hyphens
    value = value.replace(/^-|-$/g, ''); // remove leading/trailing hyphens
    setFormData({ ...formData, slug: value });
  };

  const generateSlug = (name: string) => {
    let value = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    value = value.replace(/[^a-z0-9-]/g, '-');
    value = value.replace(/-+/g, '-');
    value = value.replace(/^-|-$/g, '');
    return value;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    setSuccess(false);
    try {
      const finalSlug = formData.slug || generateSlug(formData.name);
      const dataToSave = { ...formData, slug: finalSlug };

      if (!office) {
        const { id: newOfficeId } = await createSupabaseOffice({
          ...dataToSave,
          areas: DEFAULT_AREAS as any
        });
        
        await updatePublicForm(finalSlug, {
          officeId: newOfficeId,
          officeName: dataToSave.name,
          lawyerName: dataToSave.lawyerName,
          whatsapp: dataToSave.whatsapp,
          email: dataToSave.email,
          city: dataToSave.city,
          state: dataToSave.state,
          areas: DEFAULT_AREAS as any,
          isActive: true
        });

        await updateUserOfficeId(newOfficeId);
        navigate('/onboarding');
      } else {
        await dbUpdateOffice(office.id, dataToSave);
        
        await updatePublicForm(finalSlug, {
          officeId: office.id,
          officeName: dataToSave.name,
          lawyerName: dataToSave.lawyerName,
          whatsapp: dataToSave.whatsapp,
          email: dataToSave.email,
          city: dataToSave.city,
          state: dataToSave.state,
          areas: office.areas,
          isActive: true
        });

        setOffice({ ...office, ...dataToSave, updatedAt: new Date().toISOString() });
        setSuccess(true);
        showToast('Configurações salvas com sucesso!', 'success');
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Error saving office:", error);
      showToast('Erro ao salvar as configurações.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 pb-12">
      <PageHeader
        title={office ? 'Configurações' : 'Configure seu escritório'}
        description={office ? 'Personalize a identificação e mensagens do seu escritório.' : 'Esta é a primeira etapa. Depois você poderá configurar canais, agenda e equipe.'}
        breadcrumbItems={[{ label: 'Configurações' }]}
      />

      {success && (
        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <p className="font-medium text-sm">Configurações salvas com sucesso!</p>
        </div>
      )}

      {!office && (
        <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">1</div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Primeiro passo obrigatório</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">Cadastre os dados básicos do escritório</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">A criação estabelece seu ambiente seguro e o vínculo de proprietário. As integrações serão liberadas na sequência.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="rounded-full bg-brand-100 px-3 py-1.5 text-brand-800">1. Escritório</span>
                <ArrowRight className="h-3.5 w-3.5" />
                <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">2. Primeiros passos</span>
                <ArrowRight className="h-3.5 w-3.5" />
                <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">3. Integrações</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {office && <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
          <CardTitle className="text-base text-brand-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-700" />
            Plano comercial
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">
                {office
                  ? trialState?.label ?? 'Plano não configurado'
                  : `Teste grátis de ${TRIAL_DAYS} dias`}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {office
                  ? 'O teste permite validar atendimento inicial, triagem, histórico e retorno pelo WhatsApp antes da contratação.'
                  : 'Ao criar o escritório, o período de teste começa automaticamente.'}
              </p>
            </div>

            <span className={`inline-flex w-fit items-center rounded-md px-3 py-1.5 text-xs font-semibold ${
              trialState?.kind === 'expired'
                ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                : trialState?.kind === 'active'
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
            }`}>
              {trialState?.kind === 'expired'
                ? 'Conversão pendente'
                : trialState?.kind === 'active'
                  ? 'Ativo'
                  : `${TRIAL_DAYS} dias de teste`}
            </span>
          </div>
        </CardContent>
      </Card>}

      {office && <Card id="integrations" className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
          <CardTitle className="text-base text-brand-900 flex items-center gap-2"><Calendar className="w-4 h-4 text-brand-700" />Integrações</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-bold text-slate-900">Google Agenda</p><p className="mt-1 text-sm text-slate-500">{calendarConnection?.status === 'active' ? `Conectada${calendarConnection.google_account_email ? `: ${calendarConnection.google_account_email}` : ''}. Agenda: ${calendarConnection.calendar_name || 'não selecionada'}.` : 'Envie compromissos do CRM para uma agenda Google autorizada.'}</p></div>
            <div className="flex flex-wrap gap-2">
              {calendarConnection?.status === 'active' && <Button type="button" variant="outline" disabled={calendarLoading} onClick={loadGoogleCalendars}>{calendarLoading ? 'Carregando...' : 'Listar agendas'}</Button>}
              <Button type="button" variant="outline" disabled={calendarLoading} onClick={connectGoogleCalendar}>{calendarLoading ? 'Conectando...' : calendarConnection?.status === 'active' ? 'Reconectar Google Agenda' : 'Conectar Google Agenda'}</Button>
              {calendarConnection && <Button type="button" variant="danger" disabled={calendarLoading} onClick={() => setConfirmingCalendarDisconnect(true)}>{calendarConnection.status === 'active' ? 'Desconectar' : 'Remover conexão Google'}</Button>}
            </div>
          </div>
          {calendarConnection?.status === 'active' && googleCalendars.length > 0 && <div className="mt-4 max-w-xl"><label className="mb-1 block text-sm font-medium text-slate-700">Agenda de destino</label><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={calendarConnection.calendar_id || ''} onChange={event => void selectGoogleCalendar(event.target.value)}><option value="">Selecione uma agenda</option>{googleCalendars.map(calendar => <option key={calendar.id} value={calendar.id}>{calendar.summary}{calendar.primary ? ' (principal)' : ''}</option>)}</select></div>}
        </CardContent>
      </Card>}
      <ConfirmDialog open={confirmingCalendarDisconnect} title="Desconectar Google Agenda?" description="A sincronização será interrompida e a autorização do Google será revogada. Os compromissos existentes permanecerão no CRM e não serão apagados do Google Agenda." confirmLabel="Desconectar Google Agenda" variant="danger" loading={calendarLoading} onCancel={() => setConfirmingCalendarDisconnect(false)} onConfirm={handleDisconnectGoogleCalendar} />

      <form onSubmit={handleSubmit} className="space-y-6">
        
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
            <CardTitle className="text-base text-brand-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-700" />
              {office ? 'Dados principais' : 'Dados do escritório'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome do Escritório *</label>
                <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Silva & Associados" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Advogado(a) Principal *</label>
                <Input required value={formData.lawyerName} onChange={e => setFormData({...formData, lawyerName: e.target.value})} placeholder="Seu nome" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Número da OAB</label>
                <Input value={formData.oab} onChange={e => setFormData({...formData, oab: e.target.value})} placeholder="UF000000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail de Contato *</label>
                <Input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="contato@escritorio.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp Principal</label>
                <Input value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} placeholder="(00) 00000-0000" />
              </div>
              <div className="md:col-span-2">
                <CityStateFields
                  city={formData.city}
                  state={formData.state}
                  onCityChange={city => setFormData(current => ({ ...current, city }))}
                  onStateChange={state => setFormData(current => ({ ...current, state }))}
                  idPrefix="office-settings"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Endereço público do escritório</label>
                <div className="flex rounded-md shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-slate-500 sm:text-sm">
                    /public/
                  </span>
                  <Input 
                    value={formData.slug} 
                    onChange={handleSlugChange} 
                    placeholder="marcela-advocacia" 
                    className="rounded-l-none"
                  />
                  <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-300 bg-slate-50 text-slate-500 sm:text-sm">
                    /contact
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                  <LinkIcon className="w-3.5 h-3.5" />
                  Escolha a parte personalizada dos seus links. Use apenas letras minúsculas, números e hífen.
                </p>

                {office?.slug ? (
                  <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Links públicos ativos</h4>
                    
                    {/* Link 1: Página Pública */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                        <span className="flex items-center gap-1 font-semibold text-slate-900">
                          <Globe className="w-3.5 h-3.5 text-indigo-600" />
                          Página Pública do Escritório
                        </span>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => handleCopyText(`${window.location.origin}/o/${office.slug}`, 'pub')}
                            className="text-brand-700 hover:text-brand-900 flex items-center gap-1 font-semibold"
                          >
                            {copiedKey === 'pub' ? 'Link copiado com sucesso.' : 'Copiar'}
                          </button>
                          <span className="text-slate-300">|</span>
                          <a 
                            href={`${window.location.origin}/o/${office.slug}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-brand-700 hover:text-brand-900 flex items-center gap-1 font-semibold"
                          >
                            Abrir
                          </a>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 font-mono bg-white p-2 rounded border border-slate-100 truncate">
                        {`${window.location.origin}/o/${office.slug}`}
                      </p>
                    </div>

                    {/* Link 2: Formulário Direto */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                        <span className="flex items-center gap-1 font-semibold text-slate-900">
                          <LinkIcon className="w-3.5 h-3.5 text-brand-700" />
                          Formulário Direto
                        </span>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => handleCopyText(`${window.location.origin}/public/${office.slug}/contact`, 'form')}
                            className="text-brand-700 hover:text-brand-900 flex items-center gap-1 font-semibold"
                          >
                            {copiedKey === 'form' ? 'Link copiado com sucesso.' : 'Copiar'}
                          </button>
                          <span className="text-slate-300">|</span>
                          <a 
                            href={`${window.location.origin}/public/${office.slug}/contact`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-brand-700 hover:text-brand-900 flex items-center gap-1 font-semibold"
                          >
                            Abrir
                          </a>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 font-mono bg-white p-2 rounded border border-slate-100 truncate">
                        {`${window.location.origin}/public/${office.slug}/contact`}
                      </p>
                    </div>

                  </div>
                ) : (
                  <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                    Salve os dados do escritório para gerar e ativar seus links públicos.
                  </p>
                )}
              </div>
            </div>

            {office && (
              <div className="pt-6 border-t border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-3">Áreas de Atuação Registradas</label>
                <div className="flex flex-wrap gap-2">
                  {office.areas.map((area, idx) => (
                    <span key={idx} className="bg-brand-50 text-brand-700 px-3 py-1.5 rounded-md text-xs font-medium border border-brand-100">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {office && (
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
              <CardTitle className="text-base text-brand-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-brand-700" />
                Comunicação com o Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <label htmlFor="whatsapp-message-template" className="block text-sm font-medium text-slate-700 mb-2">Mensagem padrão de WhatsApp</label>
              <p className="text-sm text-slate-500 mb-4">Personalize a mensagem inicial usada ao abrir o WhatsApp de um novo contato. Use [Nome], [Origem] e [Área] para inserir os dados automaticamente.</p>
              <textarea
                id="whatsapp-message-template"
                value={formData.whatsappMessageTemplate}
                onChange={e => setFormData({ ...formData, whatsappMessageTemplate: e.target.value })}
                rows={8}
                maxLength={2000}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                aria-describedby="whatsapp-message-help"
              />
              <p id="whatsapp-message-help" className="mt-2 text-xs text-slate-500">A mensagem padrão já vem preenchida. Deixe em branco para restaurar o texto padrão. {formData.whatsappMessageTemplate.length}/2000</p>
              
              <div className="bg-[#EFEAE2] p-4 rounded-xl max-w-lg shadow-sm border border-slate-200 relative">
                <div className="absolute top-0 right-0 w-4 h-4 bg-[#EFEAE2] rotate-45 -mr-2 mt-4 border-t border-r border-slate-200 hidden sm:block"></div>
                 <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{formData.whatsappMessageTemplate || DEFAULT_WHATSAPP_MESSAGE}</p>
              </div>

              <div className="mt-4 flex items-start gap-2 text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                 <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                 <p className="text-xs leading-relaxed">Este texto será usado como base no retorno pelo WhatsApp. Revise a mensagem antes de enviar e mantenha uma abordagem compatível com a atuação do escritório.</p>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
          {!office && <p className="text-sm text-slate-500 sm:mr-auto">Você será levado aos próximos passos após criar o escritório.</p>}
          <Button type="submit" disabled={loading} className="px-8 bg-brand-700 hover:bg-brand-800 shadow-sm">
            {loading ? 'Salvando...' : (office ? 'Salvar perfil' : 'Criar escritório e continuar')}
          </Button>
        </div>
      </form>
    </div>
  );
};
