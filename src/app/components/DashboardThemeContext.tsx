import { createContext } from 'react';
import type { DashboardTheme } from '@types/dashboard';

export const DashboardThemeContext = createContext<DashboardTheme>({});

