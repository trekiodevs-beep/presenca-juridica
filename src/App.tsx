/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';

import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Hoje } from './pages/Hoje';
import { Leads } from './pages/Leads';
import { LeadDetail } from './pages/LeadDetail';
import { NewLead } from './pages/NewLead';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { PublicForm } from './pages/PublicForm';
import { OfficePublicPage } from './pages/OfficePublicPage';
import { Channels } from './pages/Channels';

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/public/:officeSlug/contact" element={<PublicForm />} />
            <Route path="/o/:officeSlug" element={<OfficePublicPage />} />
            
            <Route path="/" element={<Layout />}>
              <Route index element={<Hoje />} />
              <Route path="leads" element={<Leads />} />
              <Route path="leads/new" element={<NewLead />} />
              <Route path="leads/:id" element={<LeadDetail />} />
              <Route path="canais" element={<Channels />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </Router>
      </DataProvider>
    </AuthProvider>
  );
}
