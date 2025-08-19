import React, { createContext, useContext } from 'react';

export const GridContext = createContext({ columns: 12, gap: 12, rowHeight: 120, colWidth: 100, offsetLeft: 0, offsetTop: 0 });
export const useGrid = () => useContext(GridContext);

