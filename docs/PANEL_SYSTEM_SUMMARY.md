# Panel System - Implementation Summary

## Overview

This document provides a quick reference for the new panel system that allows grouping multiple widgets together in different layouts.

## What's Been Created

### 1. Type Definitions (`src/types/panel.ts`)

Defines the TypeScript types for the panel system:

- **`BasePanelConfig`** - Base interface for all panel types
- **`SinglePanelConfig`** - One widget per panel (current behavior)
- **`TabbedPanelConfig`** - Multiple widgets as tabs
- **`StackedPanelConfig`** - Multiple widgets stacked vertically (future)
- **`GridPanelConfig`** - Multiple widgets in sub-grid (future)
- **`PanelConfig`** - Union type of all panel types
- Helper functions: type guards, widget extraction, migration utilities

### 2. Base Panel Component (`src/app/components/panels/BasePanel.tsx`)

Handles common panel functionality:

- Grid positioning (x, y, w, h)
- Drag and drop in edit mode
- Resize handles (right, bottom, corner)
- Wraps all panel types

### 3. Single Widget Panel (`src/app/components/panels/SingleWidgetPanel.tsx`)

The default panel type that maintains backward compatibility:

- Displays one widget in a DashboardCard
- Handles widget-specific actions (e.g., links-list controls)
- Manages refresh signals
- Identical behavior to current WidgetRenderer

### 4. Tabbed Panel (`src/app/components/panels/TabbedPanel.tsx`)

New panel type for grouping widgets:

- Uses MUI Tabs component in the card header
- Shows multiple widgets, one visible at a time
- Each tab displays the widget's title
- Refresh button refreshes only the active tab
- Manages separate refresh signals for each widget

### 5. Enhanced DashboardCard (`src/app/components/DashboardCard.tsx`)

Updated to support custom headers:

- New `customHeader` prop for custom header content
- Falls back to standard CardHeader if no custom header
- Used by TabbedPanel to show tabs instead of title

### 6. Documentation

- **`docs/PANEL_CONCEPT.md`** - Detailed concept and architecture
- **`docs/PANEL_MIGRATION.md`** - Migration guide with examples
- **`docs/PANEL_SYSTEM_SUMMARY.md`** - This file
- **`docs/examples/tabbed-panel-example.yaml`** - Example configuration

## Configuration Format

### Single Widget Panel

```yaml
panels:
  - panelType: single
    x: 1
    y: 1
    w: 3
    h: 2
    widget:
      type: weather
      title: Current Weather
      props:
        latitude: 48.1351
        longitude: 11.5820
```

### Tabbed Panel

```yaml
panels:
  - panelType: tabbed
    x: 4
    y: 1
    w: 6
    h: 3
    defaultTab: 0
    widgets:
      - type: weather
        title: Munich
        props:
          latitude: 48.1351
          longitude: 11.5820
      - type: weather
        title: Berlin
        props:
          latitude: 52.52
          longitude: 13.405
```

## Component Hierarchy

```
App.tsx
  └─ DashboardGrid
       └─ PanelRenderer (to be created)
            ├─ SingleWidgetPanel
            │    └─ BasePanel
            │         └─ DashboardCard
            │              └─ WidgetComponent
            │
            └─ TabbedPanel
                 └─ BasePanel
                      └─ DashboardCard (with Tabs)
                           ├─ WidgetComponent (tab 1)
                           ├─ WidgetComponent (tab 2)
                           └─ WidgetComponent (tab N)
```

## What Still Needs to Be Done

To complete the implementation, you'll need to:

### 1. Create PanelRenderer Component

```typescript
// src/app/components/PanelRenderer.tsx
import SingleWidgetPanel from './panels/SingleWidgetPanel';
import TabbedPanel from './panels/TabbedPanel';

export default function PanelRenderer({ panel, editMode, onChange, onDragEnd }) {
  switch (panel.panelType) {
    case 'single':
      return <SingleWidgetPanel panel={panel} ... />;
    case 'tabbed':
      return <TabbedPanel panel={panel} ... />;
    default:
      return <ErrorPanel message={`Unknown panel type: ${panel.panelType}`} />;
  }
}
```

### 2. Update App.tsx

Replace the widget rendering loop with panel rendering:

```typescript
// Instead of:
{layout.map((w, idx) => (
  <WidgetRenderer widget={w} ... />
))}

// Use:
{panels.map((p, idx) => (
  <PanelRenderer panel={p} ... />
))}
```

### 3. Add Migration Logic

In App.tsx or a utility file:

```typescript
function migrateDashboardConfig(config: any): DashboardConfig {
  if (config.widgets && !config.panels) {
    return {
      ...config,
      panels: config.widgets.map(w => ({
        panelType: 'single',
        widget: w,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
      })),
    };
  }
  return config;
}
```

### 4. Update Dashboard Type

Update `src/types/dashboard.ts`:

```typescript
export interface DashboardConfig {
  name?: string;
  grid?: GridConfig;
  widgets?: WidgetConfig[];  // Keep for backward compatibility
  panels?: PanelConfig[];     // New panel-based config
  settings?: DashboardSettings;
}
```

### 5. Update YAML Schema Validation

Update `src/server/schema.ts` to accept both `widgets` and `panels` arrays.

### 6. Update Save Layout Logic

Ensure the save layout functionality works with panels instead of widgets.

## Key Design Decisions

### 1. Backward Compatibility

- Old `widgets` array is automatically converted to `panels`
- Existing dashboards work without changes
- Migration is optional and gradual

### 2. Panel Type Extensibility

- Base panel interface allows easy addition of new types
- Future types: stacked, grid, carousel, etc.
- Type guards make it easy to handle different panel types

### 3. Separation of Concerns

- **BasePanel**: Handles positioning and drag/drop
- **SingleWidgetPanel/TabbedPanel**: Handle widget rendering
- **DashboardCard**: Handles card UI and headers
- **WidgetComponents**: Handle widget-specific logic

### 4. MUI Tabs Integration

- Uses official MUI Tabs component
- Follows MUI styling patterns
- Accessible (ARIA attributes)
- Customizable via sx prop

## Benefits

1. **Space Efficiency**: Group related widgets in tabs
2. **Better Organization**: Logical grouping of information
3. **Cleaner UI**: Less visual clutter
4. **Extensible**: Easy to add new panel types
5. **Backward Compatible**: No breaking changes

## Example Use Cases

### Weather Comparison

Show weather for multiple cities in one panel with tabs instead of multiple panels.

### News Sources

Group different news feeds (Tech, Science, World) in tabs instead of separate panels.

### Related Metrics

Group related system metrics (CPU, Memory, Disk) in tabs for easy comparison.

### Development Environments

Group different environment dashboards (Dev, Staging, Prod) in tabs.

## Future Enhancements

### Stacked Panel

Vertically stack multiple widgets in one panel:

```yaml
- panelType: stacked
  widgets:
    - type: weather
    - type: system-stats
```

### Grid Panel

Create a sub-grid within a panel:

```yaml
- panelType: grid
  gridConfig:
    columns: 2
    rows: 2
  widgets:
    - type: weather
      gridX: 1
      gridY: 1
    - type: system-stats
      gridX: 2
      gridY: 1
```

### Carousel Panel

Automatically rotate through widgets:

```yaml
- panelType: carousel
  autoRotate: true
  interval: 5000
  widgets:
    - type: weather
    - type: news
```

## Testing Checklist

When implementing, test:

- [ ] Single widget panels render correctly
- [ ] Tabbed panels show all tabs
- [ ] Tab switching works
- [ ] Refresh button refreshes active tab only
- [ ] Drag and drop works in edit mode
- [ ] Resize handles work in edit mode
- [ ] Old widget configs auto-migrate
- [ ] Mixed widget/panel configs work
- [ ] Save layout preserves panel structure
- [ ] Widget-specific actions work (e.g., links-list)
- [ ] Multiple tabbed panels on same dashboard
- [ ] Empty tabs handle gracefully
- [ ] Unknown widget types show error message

## Files Created

```
src/
  types/
    panel.ts                              # Panel type definitions
  app/
    components/
      DashboardCard.tsx                   # Enhanced with customHeader
      panels/
        BasePanel.tsx                     # Base panel component
        SingleWidgetPanel.tsx             # Single widget panel
        TabbedPanel.tsx                   # Tabbed panel

docs/
  PANEL_CONCEPT.md                        # Detailed concept
  PANEL_MIGRATION.md                      # Migration guide
  PANEL_SYSTEM_SUMMARY.md                 # This file
  examples/
    tabbed-panel-example.yaml             # Example config
```

## Next Steps

1. Review the concept and type definitions
2. Create PanelRenderer component
3. Update App.tsx to use panels
4. Add migration logic
5. Test with example configurations
6. Update documentation
7. Create example dashboards

