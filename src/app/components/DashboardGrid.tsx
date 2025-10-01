import React, { useLayoutEffect, useRef, useState, ReactNode } from 'react';
import Box from '@mui/material/Box';
import { GridContext, GridContextValue } from './GridContext';

export interface DashboardGridProps {
  columns?: number;
  gap?: number;
  rowHeight?: number;
  children?: ReactNode;
}

export default function DashboardGrid({
  columns = 12,
  gap = 12,
  rowHeight = 120,
  children,
}: DashboardGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<Omit<GridContextValue, 'columns' | 'gap' | 'rowHeight'>>({
    colWidth: 0,
    offsetLeft: 0,
    offsetTop: 0,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const colWidth = (rect.width - (columns - 1) * gap) / columns;
      setMetrics({ colWidth, offsetLeft: rect.left, offsetTop: rect.top });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [columns, gap]);

  const contextValue: GridContextValue = {
    columns,
    gap,
    rowHeight,
    ...metrics,
  };

  return (
    <GridContext.Provider value={contextValue}>
      <Box
        ref={ref}
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridAutoRows: `${rowHeight}px`,
          gap,
          alignItems: 'stretch',
        }}
      >
        {React.Children.map(children, (child) => child)}
      </Box>
    </GridContext.Provider>
  );
}
