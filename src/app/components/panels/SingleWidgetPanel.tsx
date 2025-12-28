import React, { useMemo, useState, ComponentType } from 'react';
import { Tooltip, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import DashboardCard from '../DashboardCard';
import BasePanel, { BasePanelProps } from './BasePanel';
import { getPlugin } from '@plugins/index';
import { useDashboardSettings } from '../DashboardSettingsContext';
import type { SinglePanelConfig } from '@types/panel';

/**
 * Props for SingleWidgetPanel component
 */
export interface SingleWidgetPanelProps extends Omit<BasePanelProps, 'panel'> {
  panel: SinglePanelConfig;
  onChangePropsPersist?: (updater: any) => void;
}

/**
 * Single widget panel - displays one widget in a card
 * This is the default panel type and maintains backward compatibility
 */
export default function SingleWidgetPanel({
  panel,
  editMode,
  onChange,
  onDragEnd,
  onChangePropsPersist,
}: SingleWidgetPanelProps) {
  const { widget } = panel;
  const { type, title, subtitle, props = {} } = widget;
  const [refreshSignal, setRefreshSignal] = useState(0);
  const wid = useMemo(() => `widget-${Math.random().toString(36).slice(2)}-${Date.now()}`, []);
  const [linksLocked, setLinksLocked] = useState(true);
  const dashboardSettings = useDashboardSettings();

  // Get plugin from registry
  const plugin = getPlugin(type);
  const WidgetComponent = plugin?.widget as ComponentType<any>;

  if (!WidgetComponent) {
    return (
      <BasePanel panel={panel} editMode={editMode} onChange={onChange} onDragEnd={onDragEnd}>
        <DashboardCard title={`Unknown widget: ${type}`}>
          No renderer registered for type "{type}".
        </DashboardCard>
      </BasePanel>
    );
  }

  // Widget-specific actions (currently only for links-list)
  const widgetActions =
    type === 'links-list' ? (
      <>
        <Tooltip title={linksLocked ? 'Unlock links editing' : 'Lock links editing'}>
          <IconButton
            size="small"
            onClick={() => {
              const next = !linksLocked;
              setLinksLocked(next);
              window.dispatchEvent(
                new CustomEvent('links:lock', { detail: { wid, locked: next } })
              );
            }}
          >
            {linksLocked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        {!linksLocked && (
          <Tooltip title="Add link">
            <IconButton
              size="small"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('links:add', { detail: { wid } }));
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </>
    ) : null;

  return (
    <BasePanel panel={panel} editMode={editMode} onChange={onChange} onDragEnd={onDragEnd}>
      <DashboardCard
        title={title}
        subtitle={subtitle}
        onReload={() => setRefreshSignal((s) => s + 1)}
        actions={widgetActions}
      >
        <WidgetComponent
          {...props}
          wid={wid}
          refreshSignal={refreshSignal}
          onChangePropsPersist={onChangePropsPersist}
          dashboardSettings={dashboardSettings}
        />
      </DashboardCard>
    </BasePanel>
  );
}

