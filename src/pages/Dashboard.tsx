import React from 'react';
import { useData } from '../context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ShieldAlert, Users, Clock, CalendarCheck, TrendingUp } from 'lucide-react';

export const Dashboard = () => {
  const { leads, loading } = useData();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600"></div>
      </div>
    );
  }

  // Basic Metrics
  const totalLeads = leads.length;
  
  const bySource = leads.reduce((acc, lead) => {
    acc[lead.source] = (acc[lead.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const sourceData = Object.keys(bySource).map(key => ({ name: key, value: bySource[key] })).sort((a, b) => b.value - a.value);
  const mostActiveSource = sourceData.length > 0 ? sourceData[0].name : '-';

  const byArea = leads.reduce((acc, lead) => {
    acc[lead.area] = (acc[lead.area] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const areaData = Object.keys(byArea).map(key => ({ name: key, value: byArea[key] })).sort((a, b) => b.value - a.value);

  const byStatus = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const statusData = Object.keys(byStatus).map(key => ({ name: key, value: byStatus[key] })).sort((a, b) => b.value - a.value);

  const waitingTriage = leads.filter(l => l.status === 'Novo contato' || l.status === 'Aguardando triagem').length;
  const withNextAction = leads.filter(l => l.nextActionText).length;

  const COLORS = ['#1a365d', '#2a4365', '#2c5282', '#2b6cb0', '#3182ce', '#4299e1'];
  
  const getStatusColor = (status: string) => {
    if (['Novo contato', 'Aguardando triagem'].includes(status)) return '#eab308'; // Amber
    if (['Consulta agendada', 'Proposta enviada'].includes(status)) return '#3b82f6'; // Blue
    if (['Contratado'].includes(status)) return '#22c55e'; // Green
    return '#94a3b8'; // Slate
  };

  if (totalLeads === 0) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <div className="border-b border-slate-100 pb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Indicadores de Organização</h1>
          <p className="text-slate-500 mt-1">Acompanhe a origem, status e evolução dos contatos recebidos.</p>
        </div>
        <Card className="flex flex-col items-center justify-center py-24 text-center border-slate-200 shadow-sm bg-slate-50/50 relative overflow-hidden">
          <img 
            src="/atom_simbolo_transparente_clean.png" 
            alt="" 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 object-contain opacity-[0.03] pointer-events-none" 
            onError={(e) => e.currentTarget.style.display = 'none'}
          />
          <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100 relative z-10">
            <TrendingUp className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-xl font-medium text-slate-800 mb-2 relative z-10">Painel em preparação</h3>
          <p className="text-slate-500 max-w-md mx-auto leading-relaxed text-sm relative z-10">
            Os gráficos e indicadores de organização serão exibidos aqui automaticamente assim que você registrar os primeiros contatos no sistema.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <div className="border-b border-slate-100 pb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Indicadores de Organização</h1>
        <p className="text-slate-500 mt-1">Acompanhe a origem, status e evolução dos contatos recebidos.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-50 rounded-lg text-brand-600"><Users className="w-5 h-5" /></div>
              <p className="text-sm font-medium text-slate-500">Total de Contatos</p>
            </div>
            <p className="text-3xl font-bold text-slate-900">{totalLeads}</p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Clock className="w-5 h-5" /></div>
              <p className="text-sm font-medium text-slate-500">Aguardando Triagem</p>
            </div>
            <p className="text-3xl font-bold text-slate-900">{waitingTriage}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><CalendarCheck className="w-5 h-5" /></div>
              <p className="text-sm font-medium text-slate-500">Com Próxima Ação</p>
            </div>
            <p className="text-3xl font-bold text-slate-900">{withNextAction}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><TrendingUp className="w-5 h-5" /></div>
              <p className="text-sm font-medium text-slate-500">Origem Principal</p>
            </div>
            <p className="text-xl font-bold text-slate-900 truncate">{mostActiveSource}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
            <CardTitle className="text-base text-brand-900">Leads por Área Jurídica</CardTitle>
          </CardHeader>
          <CardContent className="h-80 p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={areaData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 12, fill: '#475569' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" fill="#1a365d" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
            <CardTitle className="text-base text-brand-900">Origem dos Contatos</CardTitle>
          </CardHeader>
          <CardContent className="h-80 flex items-center justify-center p-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
            <CardTitle className="text-base text-brand-900">Distribuição por Status de Atendimento</CardTitle>
          </CardHeader>
          <CardContent className="h-80 p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12, fill: '#475569' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <YAxis tick={{ fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getStatusColor(entry.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 space-y-4">
        <div className="pt-4 border-t border-slate-200 flex items-start gap-3 text-slate-500 bg-slate-50 p-4 rounded-xl">
           <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0 text-slate-400" />
           <p className="text-sm leading-relaxed">
             <strong>Nota de conformidade:</strong> Os indicadores exibidos medem exclusivamente métricas de organização e rastreabilidade administrativa. Não representam promessa de contratação, análise preditiva de fechamento ou qualquer tipo de garantia de resultado jurídico.
           </p>
        </div>
        <p className="text-center text-xs text-slate-400 font-medium tracking-wide">
          Dados organizados pela Presença Jurídica CRM &bull; TrekIO + ATOM
        </p>
      </div>
    </div>
  );
};
