import React, { createContext, useContext } from 'react';

/**
 * Grid context value
 */
export interface GridContextValue {
  columns: number;
  gap: number;
  rowHeight: number;
  colWidth: number;
  offsetLeft: number;
  offsetTop: number;
}

const defaultGridContext: GridContextValue = {
  columns: 12,
  gap: 12,
  rowHeight: 120,
  colWidth: 100,
  offsetLeft: 0,
  offsetTop: 0,
};

export const GridContext = createContext<GridContextValue>(defaultGridContext);

/**
 * Hook to access grid context
 */
export const useGrid = () => useContext(GridContext);
