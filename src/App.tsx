/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';

const Layout = lazy(() => import('./components/layout/Layout').then(module => ({ default: module.Layout })));
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Hoje = lazy(() => import('./pages/Hoje').then(module => ({ default: module.Hoje })));
const Leads = lazy(() => import('./pages/Leads').then(module => ({ default: module.Leads })));
const LeadDetail = lazy(() => import('./pages/LeadDetail').then(module => ({ default: module.LeadDetail })));
const NewLead = lazy(() => import('./pages/NewLead').then(module => ({ default: module.NewLead })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const PublicForm = lazy(() => import('./pages/PublicForm').then(module => ({ default: module.PublicForm })));
const OfficePublicPage = lazy(() => import('./pages/OfficePublicPage').then(module => ({ default: module.OfficePublicPage })));
const Channels = lazy(() => import('./pages/Channels').then(module => ({ default: module.Channels })));
const Onboarding = lazy(() => import('./pages/Onboarding').then(module => ({ default: module.Onboarding })));
const Agenda = lazy(() => import('./pages/Agenda').then(module => ({ default: module.Agenda })));
const Finance = lazy(() => import('./pages/Finance').then(module => ({ default: module.Finance })));
const Portal = lazy(() => import('./pages/Portal').then(module => ({ default: module.Portal })));
const PublicClientPortal = lazy(() => import('./pages/PublicClientPortal').then(module => ({ default: module.PublicClientPortal })));
const Tasks = lazy(() => import('./pages/Tasks').then(module => ({ default: module.Tasks })));
const Billing = lazy(() => import('./pages/Billing').then(module => ({ default: module.Billing })));
const Team = lazy(() => import('./pages/Team').then(module => ({ default: module.Team })));
const InvitationAccept = lazy(() => import('./pages/InvitationAccept').then(module => ({ default: module.InvitationAccept })));
const Privacy = lazy(() => import('./pages/Privacy').then(module => ({ default: module.Privacy })));
const Admin = lazy(() => import('./pages/Admin').then(module => ({ default: module.Admin })));
const Legal = lazy(() => import('./pages/Legal').then(module => ({ default: module.Legal })));
const Support = lazy(() => import('./pages/Support').then(module => ({ default: module.Support })));
const Status = lazy(() => import('./pages/Status').then(module => ({ default: module.Status })));
const Security = lazy(() => import('./pages/Security').then(module => ({ default: module.Security })));
const Alarms = lazy(() => import('./pages/Alarms').then(module => ({ default: module.Alarms })));

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <ToastProvider>
          <Router>
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Carregando…</div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/public/:officeSlug/contact" element={<PublicForm />} />
              <Route path="/o/:officeSlug" element={<OfficePublicPage />} />
              <Route path="/portal/cliente/:token" element={<PublicClientPortal />} />
              <Route path="/convite/:token" element={<InvitationAccept />} />
              <Route path="/legal/:document" element={<Legal />} />
              <Route path="/status" element={<Status />} />
              
              <Route path="/" element={<Layout />}>
                <Route index element={<Hoje />} />
                <Route path="onboarding" element={<Onboarding />} />
                <Route path="leads" element={<Leads />} />
                <Route path="leads/new" element={<NewLead />} />
                <Route path="leads/:id" element={<LeadDetail />} />
                <Route path="tarefas" element={<Tasks />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="financeiro" element={<Finance />} />
                <Route path="portal" element={<Portal />} />
                <Route path="canais" element={<Channels />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="settings" element={<Settings />} />
                <Route path="billing" element={<Billing />} />
                <Route path="equipe" element={<Team />} />
                <Route path="privacidade" element={<Privacy />} />
                <Route path="admin" element={<Admin />} />
                <Route path="suporte" element={<Support />} />
                <Route path="seguranca" element={<Security />} />
                <Route path="alertas" element={<Alarms />} />
              </Route>
            </Routes>
            </Suspense>
          </Router>
        </ToastProvider>
      </DataProvider>
    </AuthProvider>
  );
}
