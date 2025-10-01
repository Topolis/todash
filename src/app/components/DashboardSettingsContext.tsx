import React, { createContext, useContext } from 'react';
import type { DashboardSettings } from '@types/dashboard';

export const DashboardSettingsContext = createContext<DashboardSettings>({});

export const useDashboardSettings = () => useContext(DashboardSettingsContext);
