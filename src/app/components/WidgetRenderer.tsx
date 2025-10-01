import React, { useMemo, useState, ComponentType } from 'react';
import Box from '@mui/material/Box';
import { Tooltip, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import DashboardCard from './DashboardCard';
import { useGrid } from './GridContext';
import { getPlugin } from '@plugins/index';
import type { WidgetConfig } from '@types/dashboard';

export interface WidgetRendererProps {
  widget: WidgetConfig;
  editMode?: boolean;
  onChange?: (widget: WidgetConfig) => void;
  onChangePropsPersist?: (updater: any) => void;
  onDragEnd?: (widget: WidgetConfig) => void;
}

export default function WidgetRenderer({
  widget,
  editMode,
  onChange,
  onChangePropsPersist,
  onDragEnd,
}: WidgetRendererProps) {
  const { x = 1, y = 1, w = 3, h = 1, type, title, subtitle, props = {} } = widget;
  const [refreshSignal, setRefreshSignal] = useState(0);
  const grid = useGrid();
  const wid = useMemo(() => `widget-${Math.random().toString(36).slice(2)}-${Date.now()}`, []);
  const [linksLocked, setLinksLocked] = useState(true);

  // Get plugin from registry
  const plugin = getPlugin(type);
  const WidgetComponent = plugin?.widget as ComponentType<any>;

  if (!WidgetComponent) {
    return (
      <Box sx={{ gridColumn: `${x} / span ${w}`, gridRow: `${y} / span ${h}` }}>
        <DashboardCard title={`Unknown widget: ${type}`}>
          No renderer registered for type "{type}".
        </DashboardCard>
      </Box>
    );
  }

  const style = {
    position: 'relative' as const,
    gridColumn: `${x} / span ${w}`,
    gridRow: `${y} / span ${h}`,
    minHeight: h * grid.rowHeight,
  };

  // Drag/resize logic when editMode is enabled
  function startDrag(dragType: 'move' | 'resize-right' | 'resize-bottom' | 'resize-corner', e: React.PointerEvent) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();

    const start = {
      px: e.clientX,
      py: e.clientY,
      x,
      y,
      w,
      h,
      widthPx: w * grid.colWidth + (w - 1) * grid.gap,
      heightPx: h * grid.rowHeight + (h - 1) * grid.gap,
    };

    let last: { nx: number; ny: number; nw: number; nh: number } | null = null;

    function onMove(ev: PointerEvent) {
      ev.preventDefault();
      const dx = ev.clientX - start.px;
      const dy = ev.clientY - start.py;
      let nx = start.x,
        ny = start.y,
        nw = start.w,
        nh = start.h;

      if (dragType === 'move') {
        const dCols = Math.round(dx / (grid.colWidth + grid.gap));
        const dRows = Math.round(dy / (grid.rowHeight + grid.gap));
        nx = Math.max(1, Math.min(grid.columns - start.w + 1, start.x + dCols));
        ny = Math.max(1, start.y + dRows);
      } else {
        if (dragType === 'resize-right' || dragType === 'resize-corner') {
          nw = Math.max(1, Math.round((start.widthPx + dx) / (grid.colWidth + grid.gap)));
          nw = Math.min(nw, grid.columns - start.x + 1);
        }
        if (dragType === 'resize-bottom' || dragType === 'resize-corner') {
          nh = Math.max(1, Math.round((start.heightPx + dy) / (grid.rowHeight + grid.gap)));
        }
      }

      last = { nx, ny, nw, nh };
      onChange && onChange({ ...widget, x: nx, y: ny, w: nw, h: nh });
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (last && onDragEnd) {
        onDragEnd({ ...widget, x: last.nx, y: last.ny, w: last.nw, h: last.nh });
      }
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }

  return (
    <Box sx={style}>
      {editMode && (
        <>
          {/* Move handle: top bar */}
          <Box
            onPointerDown={(e) => startDrag('move', e)}
            sx={{
              position: 'absolute',
              top: 4,
              left: 4,
              right: 4,
              height: 16,
              cursor: 'move',
              zIndex: 2,
              bgcolor: 'rgba(144,202,249,0.15)',
              borderRadius: 1,
            }}
          />
          {/* Resize handles */}
          <Box
            onPointerDown={(e) => startDrag('resize-right', e)}
            sx={{
              position: 'absolute',
              top: 20,
              bottom: 20,
              right: 0,
              width: 8,
              cursor: 'ew-resize',
              zIndex: 2,
              bgcolor: 'rgba(144,202,249,0.25)',
            }}
          />
          <Box
            onPointerDown={(e) => startDrag('resize-bottom', e)}
            sx={{
              position: 'absolute',
              left: 20,
              right: 20,
              bottom: 0,
              height: 8,
              cursor: 'ns-resize',
              zIndex: 2,
              bgcolor: 'rgba(144,202,249,0.25)',
            }}
          />
          <Box
            onPointerDown={(e) => startDrag('resize-corner', e)}
            sx={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: 14,
              height: 14,
              cursor: 'nwse-resize',
              zIndex: 2,
              bgcolor: 'rgba(144,202,249,0.35)',
              borderTopLeftRadius: 2,
            }}
          />
        </>
      )}
      <DashboardCard
        title={title}
        subtitle={subtitle}
        onReload={() => setRefreshSignal((s) => s + 1)}
        actions={
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
          ) : null
        }
      >
        <WidgetComponent
          {...props}
          wid={wid}
          refreshSignal={refreshSignal}
          onChangePropsPersist={onChangePropsPersist}
        />
      </DashboardCard>
    </Box>
  );
}
