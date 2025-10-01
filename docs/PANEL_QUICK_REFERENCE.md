# Panel System - Quick Reference

## Panel Types

| Type | Status | Description | Use Case |
|------|--------|-------------|----------|
| `single` | ✅ Implemented | One widget per panel | Default, backward compatible |
| `tabbed` | ✅ Implemented | Multiple widgets as tabs | Group related widgets |
| `stacked` | 🔮 Future | Widgets stacked vertically | Related info in sequence |
| `grid` | 🔮 Future | Widgets in sub-grid | Complex layouts |

## Configuration Syntax

### Single Panel

```yaml
- panelType: single
  x: 1
  y: 1
  w: 3
  h: 2
  widget:
    type: weather
    title: Weather
    props:
      latitude: 48.1351
      longitude: 11.5820
```

### Tabbed Panel

```yaml
- panelType: tabbed
  x: 1
  y: 1
  w: 6
  h: 3
  defaultTab: 0  # Optional
  widgets:
    - type: weather
      title: Munich
      props: {...}
    - type: weather
      title: Berlin
      props: {...}
```

## Component Structure

```
BasePanel
  ├─ Handles: positioning, drag/drop, resize
  └─ Used by: All panel types

SingleWidgetPanel
  ├─ Extends: BasePanel
  ├─ Contains: One widget
  └─ UI: Standard DashboardCard

TabbedPanel
  ├─ Extends: BasePanel
  ├─ Contains: Multiple widgets
  └─ UI: DashboardCard with MUI Tabs
```

## Type Definitions

```typescript
// Base
interface BasePanelConfig {
  panelType: 'single' | 'tabbed' | 'stacked' | 'grid';
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

// Single
interface SinglePanelConfig extends BasePanelConfig {
  panelType: 'single';
  widget: WidgetConfig;
}

// Tabbed
interface TabbedPanelConfig extends BasePanelConfig {
  panelType: 'tabbed';
  widgets: WidgetConfig[];
  defaultTab?: number;
}
```

## Migration

### Old Format (Still Works)

```yaml
widgets:
  - type: weather
    title: Weather
    x: 1
    y: 1
    w: 3
    h: 2
```

### New Format

```yaml
panels:
  - panelType: single
    x: 1
    y: 1
    w: 3
    h: 2
    widget:
      type: weather
      title: Weather
```

### Auto-Migration

Old configs automatically convert to `single` panels. No changes required.

## Common Patterns

### Weather Comparison

```yaml
- panelType: tabbed
  x: 1
  y: 1
  w: 6
  h: 3
  widgets:
    - type: weather
      title: Munich
    - type: weather
      title: Berlin
    - type: weather
      title: London
```

### News Categories

```yaml
- panelType: tabbed
  x: 1
  y: 4
  w: 12
  h: 5
  widgets:
    - type: rss-feed
      title: Tech
      props:
        urls: [...]
    - type: rss-feed
      title: Science
      props:
        urls: [...]
```

### Current + Forecast

```yaml
- panelType: tabbed
  x: 1
  y: 1
  w: 4
  h: 3
  widgets:
    - type: weather
      title: Current
    - type: weather-forecast
      title: Forecast
```

## Files

| File | Purpose |
|------|---------|
| `src/types/panel.ts` | Type definitions |
| `src/app/components/panels/BasePanel.tsx` | Base panel logic |
| `src/app/components/panels/SingleWidgetPanel.tsx` | Single widget panel |
| `src/app/components/panels/TabbedPanel.tsx` | Tabbed panel |
| `src/app/components/DashboardCard.tsx` | Enhanced card (customHeader) |

## Key Features

### Tabbed Panel

- ✅ MUI Tabs in header
- ✅ One widget visible at a time
- ✅ Refresh button (active tab only)
- ✅ Separate refresh signals per widget
- ✅ Drag/drop/resize in edit mode
- ✅ Accessible (ARIA attributes)

### Single Panel

- ✅ Identical to current WidgetRenderer
- ✅ Widget-specific actions (e.g., links-list)
- ✅ Backward compatible
- ✅ Drag/drop/resize in edit mode

## Implementation Status

### ✅ Completed

- Type definitions (`panel.ts`)
- Base panel component
- Single widget panel
- Tabbed panel
- Enhanced DashboardCard
- Documentation
- Example configurations

### 🚧 To Do

- Create PanelRenderer dispatcher
- Update App.tsx to use panels
- Add migration logic
- Update YAML schema validation
- Update save layout logic
- Testing

### 🔮 Future

- Stacked panel type
- Grid panel type
- Carousel panel type
- Panel-specific settings
- Nested panels

## Benefits

| Benefit | Description |
|---------|-------------|
| **Space Efficiency** | Group multiple widgets in one panel |
| **Organization** | Logical grouping of related info |
| **Clean UI** | Less visual clutter |
| **Extensible** | Easy to add new panel types |
| **Compatible** | No breaking changes |

## Examples

See:
- `docs/examples/tabbed-panel-example.yaml` - Full example
- `docs/PANEL_MIGRATION.md` - Migration guide
- `docs/PANEL_CONCEPT.md` - Detailed concept

