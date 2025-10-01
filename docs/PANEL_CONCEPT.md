# Panel System Concept

## Overview

This document describes the new panel system that allows grouping multiple widgets together in different layouts within a single panel. The system introduces base panel classes that can be extended for different presentation modes.

## Current Architecture

Currently, the system has a 1:1 relationship between widgets and panels:
- Each widget is wrapped in a `DashboardCard` component
- `WidgetRenderer` handles positioning, drag/drop, and rendering
- Widgets are positioned directly on the CSS grid

## Proposed Architecture

### Panel Types

We introduce a base panel abstraction with different implementations:

1. **SingleWidgetPanel** - Current behavior (1:1 widget to panel)
2. **TabbedPanel** - Multiple widgets in tabs
3. *(Future)* **StackedPanel** - Multiple widgets stacked vertically
4. *(Future)* **GridPanel** - Multiple widgets in a sub-grid layout

### Component Hierarchy

```
DashboardGrid
  └─ PanelRenderer (new)
       ├─ SingleWidgetPanel
       │    └─ DashboardCard
       │         └─ WidgetComponent
       │
       ├─ TabbedPanel
       │    └─ DashboardCard (with Tabs in header)
       │         ├─ Tab 1: WidgetComponent
       │         ├─ Tab 2: WidgetComponent
       │         └─ Tab N: WidgetComponent
       │
       └─ (Future panel types...)
```

## Configuration Changes

### Current YAML Structure

```yaml
widgets:
  - type: weather
    title: Current Weather
    x: 1
    y: 1
    w: 3
    h: 2
    props:
      latitude: 48.1351
      longitude: 11.5820
```

### New YAML Structure

#### Option A: Explicit Panel Configuration (Recommended)

```yaml
panels:
  # Single widget panel (backward compatible)
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

  # Tabbed panel with multiple widgets
  - panelType: tabbed
    x: 4
    y: 1
    w: 6
    h: 3
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
      - type: weather-forecast
        title: Forecast
        props:
          latitude: 48.1351
          longitude: 11.5820
```

#### Option B: Implicit Panel Type (Simpler)

```yaml
widgets:
  # Single widget (auto-detected as single panel)
  - type: weather
    title: Current Weather
    x: 1
    y: 1
    w: 3
    h: 2
    props:
      latitude: 48.1351
      longitude: 11.5820

  # Multiple widgets with same position = tabbed panel
  - panelType: tabbed  # explicit override
    x: 4
    y: 1
    w: 6
    h: 3
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

**Recommendation:** Use Option A for clarity and future extensibility.

## TypeScript Type Definitions

### Panel Configuration Types

```typescript
// Base panel configuration
export interface BasePanelConfig {
  panelType: 'single' | 'tabbed' | 'stacked' | 'grid';
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

// Single widget panel
export interface SinglePanelConfig extends BasePanelConfig {
  panelType: 'single';
  widget: WidgetConfig;
}

// Tabbed panel
export interface TabbedPanelConfig extends BasePanelConfig {
  panelType: 'tabbed';
  widgets: WidgetConfig[];
  defaultTab?: number; // Index of default active tab
}

// Union type for all panels
export type PanelConfig = SinglePanelConfig | TabbedPanelConfig;

// Dashboard config update
export interface DashboardConfig {
  name?: string;
  grid?: GridConfig;
  panels: PanelConfig[];  // Changed from widgets
  settings?: DashboardSettings;
}
```

### Panel Component Props

```typescript
export interface BasePanelProps {
  panel: PanelConfig;
  editMode?: boolean;
  onChange?: (panel: PanelConfig) => void;
  onDragEnd?: (panel: PanelConfig) => void;
}

export interface SinglePanelProps extends BasePanelProps {
  panel: SinglePanelConfig;
}

export interface TabbedPanelProps extends BasePanelProps {
  panel: TabbedPanelConfig;
}
```

## Component Implementation Outline

### 1. PanelRenderer Component

```typescript
// src/app/components/PanelRenderer.tsx
export default function PanelRenderer({
  panel,
  editMode,
  onChange,
  onDragEnd,
}: BasePanelProps) {
  // Determine which panel component to render
  switch (panel.panelType) {
    case 'single':
      return <SingleWidgetPanel panel={panel} editMode={editMode} ... />;
    case 'tabbed':
      return <TabbedPanel panel={panel} editMode={editMode} ... />;
    default:
      return <ErrorPanel message={`Unknown panel type: ${panel.panelType}`} />;
  }
}
```

### 2. SingleWidgetPanel Component

```typescript
// src/app/components/panels/SingleWidgetPanel.tsx
export default function SingleWidgetPanel({
  panel,
  editMode,
  onChange,
  onDragEnd,
}: SinglePanelProps) {
  // Essentially the current WidgetRenderer logic
  // Wraps single widget in DashboardCard
  // Handles drag/drop for the panel
  // Renders the widget component
}
```

### 3. TabbedPanel Component

```typescript
// src/app/components/panels/TabbedPanel.tsx
import { Tabs, Tab } from '@mui/material';

export default function TabbedPanel({
  panel,
  editMode,
  onChange,
  onDragEnd,
}: TabbedPanelProps) {
  const [activeTab, setActiveTab] = useState(panel.defaultTab || 0);
  
  // Render DashboardCard with custom header containing Tabs
  // Each tab shows a different widget
  // Only active tab's widget is rendered (or all are rendered but hidden)
  
  return (
    <Box sx={{ gridColumn: ..., gridRow: ... }}>
      {editMode && <DragHandles />}
      <DashboardCard
        title={null}  // No title, tabs replace it
        customHeader={
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            {panel.widgets.map((w, i) => (
              <Tab key={i} label={w.title || `Tab ${i + 1}`} />
            ))}
          </Tabs>
        }
        actions={<RefreshButton />}
      >
        {panel.widgets.map((widget, i) => (
          <Box key={i} sx={{ display: activeTab === i ? 'block' : 'none' }}>
            <WidgetComponent {...widget} />
          </Box>
        ))}
      </DashboardCard>
    </Box>
  );
}
```

### 4. DashboardCard Enhancement

```typescript
// src/app/components/DashboardCard.tsx
export interface DashboardCardProps {
  title?: string;
  subtitle?: string;
  customHeader?: ReactNode;  // NEW: Allow custom header content
  sx?: SxProps<Theme>;
  children?: ReactNode;
  onReload?: () => void;
  actions?: ReactNode;
}

export default function DashboardCard({
  title,
  subtitle,
  customHeader,  // NEW
  sx,
  children,
  onReload,
  actions,
}: DashboardCardProps) {
  // If customHeader is provided, use it instead of CardHeader
  // Otherwise use existing CardHeader logic
}
```

## Migration Strategy

### Backward Compatibility

To maintain backward compatibility with existing dashboards:

1. **Support both `widgets` and `panels` in YAML**
   - If `widgets` array exists, auto-convert to `SinglePanelConfig[]`
   - If `panels` array exists, use directly

2. **Auto-migration on load**
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

3. **Save format**
   - New dashboards save with `panels` array
   - Optionally keep `widgets` array for backward compatibility

## Example Use Cases

### Use Case 1: Weather Comparison

```yaml
panels:
  - panelType: tabbed
    x: 1
    y: 1
    w: 4
    h: 3
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
      - type: weather
        title: London
        props:
          latitude: 51.5074
          longitude: -0.1278
```

### Use Case 2: Multi-Source News

```yaml
panels:
  - panelType: tabbed
    x: 5
    y: 1
    w: 8
    h: 4
    widgets:
      - type: rss-feed
        title: Tech News
        props:
          urls:
            - https://techcrunch.com/feed/
      - type: rss-feed
        title: Science News
        props:
          urls:
            - https://www.sciencedaily.com/rss/all.xml
      - type: rss-feed
        title: World News
        props:
          urls:
            - https://feeds.bbci.co.uk/news/world/rss.xml
```

## Future Extensions

### Stacked Panel (Vertical Layout)

```yaml
panels:
  - panelType: stacked
    x: 1
    y: 1
    w: 3
    h: 4
    widgets:
      - type: weather
        title: Current Weather
      - type: system-stats
        title: System
```

### Grid Panel (Sub-grid Layout)

```yaml
panels:
  - panelType: grid
    x: 1
    y: 1
    w: 6
    h: 4
    gridConfig:
      columns: 2
      rows: 2
    widgets:
      - type: weather
        title: Weather
        gridX: 1
        gridY: 1
      - type: system-stats
        title: System
        gridX: 2
        gridY: 1
      - type: status
        title: Status
        gridX: 1
        gridY: 2
        gridW: 2
```

## Implementation Checklist

- [ ] Define TypeScript types for panel system
- [ ] Create base panel components structure
- [ ] Implement SingleWidgetPanel (refactor from WidgetRenderer)
- [ ] Enhance DashboardCard with customHeader support
- [ ] Implement TabbedPanel with MUI Tabs
- [ ] Create PanelRenderer dispatcher component
- [ ] Update App.tsx to use panels instead of widgets
- [ ] Implement backward compatibility migration
- [ ] Update YAML schema validation
- [ ] Update documentation
- [ ] Create example dashboards with tabbed panels

