import React from 'react';
import Box from '@mui/material/Box';
import DashboardCard from './DashboardCard';
import SingleWidgetPanel from './panels/SingleWidgetPanel';
import TabbedPanel from './panels/TabbedPanel';
import type { PanelConfig, SinglePanelConfig, TabbedPanelConfig } from '@types/panel';

export interface PanelRendererProps {
  panel: PanelConfig;
  editMode?: boolean;
  onChange?: (panel: PanelConfig) => void;
  onChangePropsPersist?: (widgetIndex: number, updater: any) => void;
  onDragEnd?: (panel: PanelConfig) => void;
}

/**
 * PanelRenderer - Dispatches to the appropriate panel component based on panelType
 */
export default function PanelRenderer({
  panel,
  editMode,
  onChange,
  onChangePropsPersist,
  onDragEnd,
}: PanelRendererProps) {
  switch (panel.panelType) {
    case 'single':
      return (
        <SingleWidgetPanel
          panel={panel as SinglePanelConfig}
          editMode={editMode}
          onChange={onChange}
          onDragEnd={onDragEnd}
          onChangePropsPersist={
            onChangePropsPersist ? (updater) => onChangePropsPersist(0, updater) : undefined
          }
        />
      );

    case 'tabbed':
      return (
        <TabbedPanel
          panel={panel as TabbedPanelConfig}
          editMode={editMode}
          onChange={onChange}
          onDragEnd={onDragEnd}
          onChangePropsPersist={onChangePropsPersist}
        />
      );

    case 'stacked':
      // Future implementation
      return (
        <Box sx={{ gridColumn: `${panel.x} / span ${panel.w}`, gridRow: `${panel.y} / span ${panel.h}` }}>
          <DashboardCard title="Stacked Panel">
            Stacked panel type not yet implemented.
          </DashboardCard>
        </Box>
      );

    case 'grid':
      // Future implementation
      return (
        <Box sx={{ gridColumn: `${panel.x} / span ${panel.w}`, gridRow: `${panel.y} / span ${panel.h}` }}>
          <DashboardCard title="Grid Panel">
            Grid panel type not yet implemented.
          </DashboardCard>
        </Box>
      );

    default:
      return (
        <Box sx={{ gridColumn: `${panel.x} / span ${panel.w}`, gridRow: `${panel.y} / span ${panel.h}` }}>
          <DashboardCard title="Unknown Panel Type">
            Unknown panel type: {(panel as any).panelType}
          </DashboardCard>
        </Box>
      );
  }
}

