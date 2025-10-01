import React, { useState, useMemo, ComponentType } from 'react';
import { Tabs, Tab, Box, IconButton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DashboardCard from '../DashboardCard';
import BasePanel, { BasePanelProps } from './BasePanel';
import { getPlugin } from '@plugins/index';
import type { TabbedPanelConfig, WidgetConfig } from '@types/panel';

/**
 * Props for TabbedPanel component
 */
export interface TabbedPanelProps extends Omit<BasePanelProps, 'panel'> {
  panel: TabbedPanelConfig;
  onChangePropsPersist?: (widgetIndex: number, updater: any) => void;
}

/**
 * Tabbed panel - displays multiple widgets as tabs
 * Only one widget is visible at a time, selected via tabs in the header
 */
export default function TabbedPanel({
  panel,
  editMode,
  onChange,
  onDragEnd,
  onChangePropsPersist,
}: TabbedPanelProps) {
  const { widgets, defaultTab = 0 } = panel;
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [refreshSignals, setRefreshSignals] = useState<number[]>(
    widgets.map(() => 0)
  );

  // Generate unique widget IDs
  const wids = useMemo(
    () => widgets.map(() => `widget-${Math.random().toString(36).slice(2)}-${Date.now()}`),
    [widgets.length]
  );

  // Ensure activeTab is within bounds
  const safeActiveTab = Math.min(activeTab, widgets.length - 1);

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle refresh for active widget
  const handleRefresh = () => {
    setRefreshSignals((prev) => {
      const next = [...prev];
      next[safeActiveTab] = (next[safeActiveTab] || 0) + 1;
      return next;
    });
  };

  // Custom header with tabs
  const customHeader = (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <Tabs
        value={safeActiveTab}
        onChange={handleTabChange}
        sx={{
          flexGrow: 1,
          minHeight: 40,
          '& .MuiTab-root': {
            minHeight: 40,
            textTransform: 'none',
            fontSize: '0.875rem',
            color: 'rgba(200,210,230,0.7)',
            '&.Mui-selected': {
              color: 'rgba(200,210,230,0.95)',
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: 'primary.main',
          },
        }}
      >
        {widgets.map((widget, index) => (
          <Tab
            key={index}
            label={widget.title || `Tab ${index + 1}`}
            id={`panel-tab-${index}`}
            aria-controls={`panel-tabpanel-${index}`}
          />
        ))}
      </Tabs>
      <Tooltip title="Reload">
        <IconButton size="small" onClick={handleRefresh} aria-label="reload">
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );

  return (
    <BasePanel panel={panel} editMode={editMode} onChange={onChange} onDragEnd={onDragEnd}>
      <DashboardCard customHeader={customHeader}>
        {widgets.map((widget, index) => {
          const { type, props = {} } = widget;
          const plugin = getPlugin(type);
          const WidgetComponent = plugin?.widget as ComponentType<any>;

          if (!WidgetComponent) {
            return (
              <Box
                key={index}
                role="tabpanel"
                hidden={safeActiveTab !== index}
                id={`panel-tabpanel-${index}`}
                aria-labelledby={`panel-tab-${index}`}
                sx={{ display: safeActiveTab === index ? 'block' : 'none' }}
              >
                <Box sx={{ p: 2, color: 'error.main' }}>
                  Unknown widget type: {type}
                </Box>
              </Box>
            );
          }

          return (
            <Box
              key={index}
              role="tabpanel"
              hidden={safeActiveTab !== index}
              id={`panel-tabpanel-${index}`}
              aria-labelledby={`panel-tab-${index}`}
              sx={{ display: safeActiveTab === index ? 'block' : 'none' }}
            >
              <WidgetComponent
                {...props}
                wid={wids[index]}
                refreshSignal={refreshSignals[index]}
                onChangePropsPersist={
                  onChangePropsPersist
                    ? (updater: any) => onChangePropsPersist(index, updater)
                    : undefined
                }
              />
            </Box>
          );
        })}
      </DashboardCard>
    </BasePanel>
  );
}

