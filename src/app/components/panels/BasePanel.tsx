import React, { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { useGrid } from '../GridContext';
import type { PanelConfig } from '@types/panel';

/**
 * Props shared by all panel components
 */
export interface BasePanelProps {
  panel: PanelConfig;
  editMode?: boolean;
  onChange?: (panel: PanelConfig) => void;
  onDragEnd?: (panel: PanelConfig) => void;
  children?: ReactNode;
}

/**
 * Base panel component that handles grid positioning and drag/drop
 * All specific panel types should extend this or use similar logic
 */
export default function BasePanel({
  panel,
  editMode,
  onChange,
  onDragEnd,
  children,
}: BasePanelProps) {
  const { x = 1, y = 1, w = 3, h = 1 } = panel;
  const grid = useGrid();

  const style = {
    position: 'relative' as const,
    gridColumn: `${x} / span ${w}`,
    gridRow: `${y} / span ${h}`,
    minHeight: h * grid.rowHeight,
  };

  // Drag/resize logic when editMode is enabled
  function startDrag(
    dragType: 'move' | 'resize-right' | 'resize-bottom' | 'resize-corner',
    e: React.PointerEvent
  ) {
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

    function onMove(me: PointerEvent) {
      const dx = me.clientX - start.px;
      const dy = me.clientY - start.py;

      let newX = start.x;
      let newY = start.y;
      let newW = start.w;
      let newH = start.h;

      if (dragType === 'move') {
        const colDelta = Math.round(dx / (grid.colWidth + grid.gap));
        const rowDelta = Math.round(dy / (grid.rowHeight + grid.gap));
        newX = Math.max(1, Math.min(grid.columns - w + 1, start.x + colDelta));
        newY = Math.max(1, start.y + rowDelta);
      } else if (dragType === 'resize-right' || dragType === 'resize-corner') {
        const newWidthPx = start.widthPx + dx;
        newW = Math.max(1, Math.round((newWidthPx + grid.gap) / (grid.colWidth + grid.gap)));
        newW = Math.min(newW, grid.columns - x + 1);
      }

      if (dragType === 'resize-bottom' || dragType === 'resize-corner') {
        const newHeightPx = start.heightPx + dy;
        newH = Math.max(1, Math.round((newHeightPx + grid.gap) / (grid.rowHeight + grid.gap)));
      }

      if (newX !== x || newY !== y || newW !== w || newH !== h) {
        onChange?.({ ...panel, x: newX, y: newY, w: newW, h: newH });
      }
    }

    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      onDragEnd?.(panel);
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
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
              width: 20,
              height: 20,
              cursor: 'nwse-resize',
              zIndex: 2,
              bgcolor: 'rgba(144,202,249,0.35)',
            }}
          />
        </>
      )}
      {children}
    </Box>
  );
}

