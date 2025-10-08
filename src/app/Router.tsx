import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import ZWaveAdminPage from '../plugins/zwave/admin-page';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/zwave/admin" element={<ZWaveAdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}

