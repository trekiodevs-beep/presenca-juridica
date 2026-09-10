import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ShieldAlert, Users, Clock, CalendarCheck, AlertTriangle, ArrowRight, TrendingUp, Info, Activity, Hourglass, CheckCircle2, ChevronRight, FileText } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusBadge } from '../components/ui/Badge';
import { 
  DashboardPeriod, 
  filterContactsByPeriod, 
  filterEventsByPeriod, 
  getTriagePendingCount,
  getOverdueActions,
  getUnassignedContacts,
  getFirstResponseTime,
  formatTimeMinutes,
  getReturnStartedRate,
  groupBySource,
  groupByArea,
  groupByStatus,
  groupByUtm,
  getAttentionItems,
  getTimelineSeries
} from '../lib/dashboardMetrics';
import { cn } from '../lib/utils';

export const Dashboard = () => {
  const { leads, events, loading } = useData();
  const [period, setPeriod] = useState<DashboardPeriod>('30days');

  useEffect(() => {
    const saved = localStorage.getItem('crm_dashboard_period') as DashboardPeriod;
    if (saved) setPeriod(saved);
  }, []);

  const handlePeriodChange = (newPeriod: DashboardPeriod) => {
    setPeriod(newPeriod);
    localStorage.setItem('crm_dashboard_period', newPeriod);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600"></div>
      </div>
    );
  }

  const periodLeads = filterContactsByPeriod(leads, period);
  const periodEvents = filterEventsByPeriod(events, period);

  // General Metrics
  const totalLeads = periodLeads.length;
  const triagePending = getTriagePendingCount(periodLeads);
  const overdueActions = getOverdueActions(periodLeads);
  const unassigned = getUnassignedContacts(periodLeads);
  const avgResponseTime = getFirstResponseTime(periodLeads, periodEvents);
  const returnRate = getReturnStartedRate(periodLeads, periodEvents);
  const attentionItems = getAttentionItems(periodLeads, periodEvents);
  
  const statusData = groupByStatus(periodLeads);
  const sourceData = groupBySource(periodLeads);
  const areaData = groupByArea(periodLeads);
  const utmData = groupByUtm(periodLeads);
  const timelineData = getTimelineSeries(periodLeads, period);

  const mainSource = sourceData.length > 0 ? sourceData[0] : null;
  const mainArea = areaData.length > 0 ? areaData[0] : null;

  // Funnel calculations
  const triageRate = totalLeads > 0 ? Math.round(((totalLeads - triagePending) / totalLeads) * 100) : 0;
  const scheduledCount = statusData.find(s => s.name === 'Consulta agendada')?.value || 0;
  const contractedCount = statusData.find(s => s.name === 'Contratado')?.value || 0;
  const lossCount = statusData.find(s => s.name === 'Não avançou')?.value || 0;

  const getStatusColor = (status: string) => {
    if (['Novo contato', 'Aguardando triagem'].includes(status)) return '#f59e0b'; // Amber
    if (['Triagem realizada', 'Aguardando informações'].includes(status)) return '#8b5cf6'; // Purple
    if (['Consulta agendada', 'Proposta enviada'].includes(status)) return '#3b82f6'; // Blue
    if (['Contratado'].includes(status)) return '#10b981'; // Green
    return '#94a3b8'; // Slate
  };

  const COLORS = ['#1a365d', '#2a4365', '#2c5282', '#2b6cb0', '#3182ce', '#4299e1', '#63b3ed', '#90cdf4'];

  const renderEmptyState = () => (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-1">Acompanhe a organização do atendimento.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          {(['today', '7days', '30days', 'thisMonth', 'all'] as DashboardPeriod[]).map(p => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                period === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {p === 'today' ? 'Hoje' : p === '7days' ? '7 dias' : p === '30days' ? '30 dias' : p === 'thisMonth' ? 'Mês atual' : 'Todos'}
            </button>
          ))}
        </div>
      </div>
      
      <Card className="flex flex-col items-center justify-center py-24 text-center border-slate-200 shadow-sm bg-slate-50/50">
        <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
          <FileText className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Nenhum contato encontrado neste período.</h3>
        <p className="text-slate-500 max-w-sm mx-auto mb-6 text-sm">
          Altere o período do filtro ou receba novos contatos para visualizar os indicadores do escritório.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/canais">Ir para Canais</Link>
          </Button>
          <Button asChild className="gap-2 bg-brand-700 hover:bg-brand-800">
            <Link to="/leads/new">Novo contato</Link>
          </Button>
        </div>
      </Card>
    </div>
  );

  if (totalLeads === 0) {
    return renderEmptyState();
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      {/* Header and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Painel de gestão</h1>
          <p className="text-slate-500 mt-1">Acompanhe a rotina de atendimento inicial, origem dos contatos e providências pendentes.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg shrink-0 overflow-x-auto">
          {(['today', '7days', '30days', 'thisMonth', 'all'] as DashboardPeriod[]).map(p => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                period === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {p === 'today' ? 'Hoje' : p === '7days' ? '7 dias' : p === '30days' ? '30 dias' : p === 'thisMonth' ? 'Mês atual' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {totalLeads < 10 && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            Base inicial de dados. Os indicadores ajudam a validar a rotina, mas ficam mais precisos conforme novos contatos e eventos forem registrados.
          </p>
        </div>
      )}

      {/* 1. Pulso do Atendimento */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Resumo do atendimento</h2>
          <p className="text-slate-500 text-sm">Visão rápida da rotina de atendimento inicial no período selecionado.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
            <CardContent className="p-5 flex flex-col gap-2 h-full">
              <div className="flex items-center gap-2 text-brand-600 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Contatos recebidos</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{totalLeads}</p>
              <p className="text-xs text-slate-500 mt-auto pt-2 border-t border-slate-50">Solicitações recebidas no período.</p>
            </CardContent>
          </Card>
          
          <Link to="/leads" className="block focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-xl">
            <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow bg-amber-50/30 h-full cursor-pointer hover:border-amber-300 group">
              <CardContent className="p-5 flex flex-col gap-2 h-full">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <Hourglass className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Aguardando triagem</span>
                </div>
                <p className="text-3xl font-bold text-slate-900">{triagePending}</p>
                <p className="text-xs text-slate-500 mt-auto pt-2 border-t border-amber-50/50 group-hover:text-amber-700 transition-colors">Contatos que ainda precisam de análise inicial.</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/leads" className="block focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-xl">
            <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow bg-red-50/30 h-full cursor-pointer hover:border-red-300 group">
              <CardContent className="p-5 flex flex-col gap-2 h-full">
                <div className="flex items-center gap-2 text-red-600 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Providências vencidas</span>
                </div>
                <p className="text-3xl font-bold text-slate-900">{overdueActions}</p>
                <p className="text-xs text-slate-500 mt-auto pt-2 border-t border-red-50/50 group-hover:text-red-700 transition-colors">Providências fora do prazo.</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/leads" className="block focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-xl">
            <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow h-full cursor-pointer hover:border-slate-300 group">
              <CardContent className="p-5 flex flex-col gap-2 h-full">
                <div className="flex items-center gap-2 text-slate-600 mb-1">
                  <ShieldAlert className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Sem responsável definido</span>
                </div>
                <p className="text-3xl font-bold text-slate-900">{unassigned}</p>
                <p className="text-xs text-slate-500 mt-auto pt-2 border-t border-slate-50 group-hover:text-slate-700 transition-colors">Contatos ainda sem responsável.</p>
              </CardContent>
            </Card>
          </Link>

          <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow" title="Tempo médio entre a criação do contato e o primeiro registro de atendimento, como WhatsApp aberto, anotação ou mudança de situação.">
            <CardContent className="p-5 flex flex-col gap-2 h-full">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Tempo até o primeiro retorno</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 pt-1">{formatTimeMinutes(avgResponseTime)}</p>
              <p className="text-xs text-slate-500 mt-auto pt-2 border-t border-slate-50">Média até o primeiro registro de atendimento.</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow" title="Percentual de contatos que já tiveram pelo menos uma providência ou registro de atendimento.">
            <CardContent className="p-5 flex flex-col gap-2 h-full">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Primeiro retorno registrado</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{returnRate}%</p>
              <p className="text-xs text-slate-500 mt-auto pt-2 border-t border-slate-50">Contatos com pelo menos um registro de atendimento.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 2. Atenção Necessária */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Pontos de atenção
            </h2>
            <p className="text-slate-500 text-sm">Contatos que podem estar parados ou exigem providências do escritório.</p>
          </div>
        </div>

        {attentionItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attentionItems.map((item, idx) => (
              <Card key={idx} className="border-amber-200 bg-amber-50/10 shadow-sm">
                <CardContent className="p-4 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-slate-900 truncate pr-2">{item.lead.name}</h4>
                      <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800" title={item.reason}>
                        <span className="truncate max-w-[120px]">{item.reason}</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500 mb-4">
                      <span className="font-medium text-slate-700">{item.lead.area}</span>
                      <span>&bull;</span>
                      <span>{item.lead.status}</span>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="w-full text-brand-700 border-brand-200 hover:bg-brand-50 bg-white">
                    <Link to={`/leads/${item.lead.id}`}>Abrir contato</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-emerald-900 font-bold mb-1">Nenhum ponto crítico no período.</h3>
            <p className="text-emerald-700 text-sm">Continue acompanhando a aba Hoje para manter a triagem em dia.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 3. Evolução no Tempo */}
        <Card className="border-slate-200 shadow-sm overflow-hidden bg-gradient-to-br from-white to-blue-50/40">
          <CardHeader className="border-b border-slate-100 flex-row items-start justify-between">
            <div><CardTitle className="text-base text-slate-900">Ritmo de entrada</CardTitle><p className="text-xs text-slate-500 mt-1">Quando a demanda chega ao escritório</p></div>
            <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-1 rounded-full">{totalLeads} contatos</span>
          </CardHeader>
          <CardContent className="p-6 h-[300px]">
             {timelineData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={timelineData}>
                   <defs><linearGradient id="contactsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} /></linearGradient></defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                   <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                   <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                   <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                   <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} fill="url(#contactsFill)" dot={{ r: 3, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
                 </AreaChart>
               </ResponsiveContainer>
             ) : (
               <div className="flex flex-col h-full items-center justify-center text-sm text-slate-500 gap-3">
                 <p>Nenhum dado suficiente neste período.</p>
                 <Button asChild variant="outline" size="sm" className="mt-2">
                   <Link to="/canais">Ir para Canais de entrada</Link>
                 </Button>
               </div>
             )}
          </CardContent>
        </Card>

        {/* 4. Funil de Atendimento Inicial */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 flex-row items-start justify-between"><div><CardTitle className="text-base text-slate-900">Onde o funil trava</CardTitle><p className="text-xs text-slate-500 mt-1">Distribuição atual por etapa</p></div><span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">{triageRate}% triados</span>
          </CardHeader>
          <CardContent className="p-6 h-[300px]">
            {statusData.length > 0 ? (
               <div className="h-full overflow-y-auto space-y-3 py-1">{statusData.map(entry => { const share = totalLeads ? Math.round(entry.value / totalLeads * 100) : 0; return <div key={entry.name}><div className="flex justify-between text-xs mb-1"><span className="font-medium text-slate-700">{entry.name}</span><span className="text-slate-500">{entry.value} · {share}%</span></div><div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(share, 4)}%`, backgroundColor: getStatusColor(entry.name) }} /></div></div>})}</div>
             ) : (
               <div className="flex flex-col h-full items-center justify-center text-sm text-slate-500 gap-3">
                 <p>Nenhum dado suficiente neste período.</p>
               </div>
             )}
          </CardContent>
        </Card>

        {/* 5. Canais e Origem */}
        <Card className="border-slate-200 shadow-sm lg:col-span-1 flex flex-col">
          <CardHeader className="border-b border-slate-100 flex-row items-center justify-between">
            <CardTitle className="text-base text-slate-900">Origem dos contatos</CardTitle>
            {mainSource && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium">Principal: {mainSource.name}</span>}
          </CardHeader>
          <CardContent className="p-5 flex-1">
            <div className="space-y-3"><table className="w-full text-sm text-left">
              <thead className="hidden bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-100">Origem do contato</th>
                  <th className="px-4 py-3 border-b border-slate-100 text-center">Contatos</th>
                  <th className="px-4 py-3 border-b border-slate-100 text-center">Aguardando triagem</th>
                  <th className="px-4 py-3 border-b border-slate-100 text-center">Sem primeiro retorno</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sourceData.length > 0 ? (
                  sourceData.map((src, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50"><td className="py-2 font-medium text-slate-800 whitespace-nowrap">{src.name}</td><td className="py-2 text-right text-sm font-bold text-slate-900">{src.total}<span className="ml-1 text-[10px] font-normal text-slate-400">contatos</span></td></tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Sem origens mapeadas.</td>
                  </tr>
                )}
              </tbody>
            </table></div>
            
            {utmData.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Campanhas rastreáveis</h4>
                  <span className="text-xs text-slate-400" title="Parâmetros técnicos de rastreamento (UTM)">
                    <Info className="w-4 h-4" />
                  </span>
                </div>
                <div className="space-y-2">
                  {utmData.map((utm, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 truncate pr-2" title={utm.name}>{utm.name}</span>
                      <span className="font-medium text-slate-900 bg-slate-100 px-2 rounded-md">{utm.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {utmData.length === 0 && sourceData.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-500 text-center">Nenhuma campanha rastreada no período.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 6. Áreas Jurídicas */}
        <Card className="border-slate-200 shadow-sm lg:col-span-1 flex flex-col">
          <CardHeader className="border-b border-slate-100 flex-row items-center justify-between">
            <CardTitle className="text-base text-slate-900">Áreas de atuação</CardTitle>
            {mainArea && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium">Top: {mainArea.name}</span>}
          </CardHeader>
          <CardContent className="p-5 flex-1">
            <div className="space-y-3"><table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-100">Área de atuação</th>
                  <th className="px-4 py-3 border-b border-slate-100 text-center">Contatos</th>
                  <th className="px-4 py-3 border-b border-slate-100 text-center">Consultas agendadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {areaData.length > 0 ? (
                  areaData.map((area, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50"><td className="py-2 font-medium text-slate-800 whitespace-nowrap truncate max-w-[200px]" title={area.name}>{area.name}</td><td className="py-2 text-right text-sm font-bold text-slate-900">{area.total}<span className="ml-1 text-[10px] font-normal text-slate-400">contatos</span></td></tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">Sem áreas mapeadas.</td>
                  </tr>
                )}
              </tbody>
            </table></div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-200">
        <div className="flex items-start gap-3 text-slate-500 bg-slate-50 p-4 rounded-xl">
           <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0 text-slate-400" />
           <p className="text-sm leading-relaxed">
             <strong>Nota de conformidade:</strong> Os indicadores exibidos medem exclusivamente métricas de organização e rastreabilidade administrativa do atendimento inicial. Não representam gestão processual, promessa de contratação ou garantia de resultado.
           </p>
        </div>
      </div>
    </div>
  );
};
