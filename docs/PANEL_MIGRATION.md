# Panel System Migration Guide

## Overview

This guide explains how to migrate from the old widget-based configuration to the new panel-based configuration.

## Configuration Format Comparison

### Old Format (Widget-Based)

```yaml
title: My Dashboard
grid:
  columns: 12
  gap: 3

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

  - type: rss-feed
    title: News
    x: 4
    y: 1
    w: 6
    h: 4
    props:
      urls:
        - https://techcrunch.com/feed/
```

### New Format (Panel-Based)

```yaml
title: My Dashboard
grid:
  columns: 12
  gap: 3

panels:
  # Single widget panel (same as before)
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

  # Single widget panel
  - panelType: single
    x: 4
    y: 1
    w: 6
    h: 4
    widget:
      type: rss-feed
      title: News
      props:
        urls:
          - https://techcrunch.com/feed/
```

## New Feature: Tabbed Panels

The main benefit of the new system is the ability to group multiple widgets into tabs:

```yaml
panels:
  # Tabbed panel with multiple weather locations
  - panelType: tabbed
    x: 1
    y: 1
    w: 6
    h: 3
    defaultTab: 0  # Optional: which tab to show by default
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

This creates a single panel with three tabs: "Munich", "Berlin", and "London". Only one weather widget is visible at a time.

## Backward Compatibility

The system maintains backward compatibility in two ways:

### 1. Automatic Migration

If your YAML file uses the old `widgets` array, it will be automatically converted to panels:

```typescript
// Old config with widgets array
{
  widgets: [
    { type: 'weather', title: 'Weather', x: 1, y: 1, w: 3, h: 2, props: {...} }
  ]
}

// Automatically converted to
{
  panels: [
    {
      panelType: 'single',
      x: 1,
      y: 1,
      w: 3,
      h: 2,
      widget: { type: 'weather', title: 'Weather', props: {...} }
    }
  ]
}
```

### 2. Mixed Format Support

You can use both `widgets` and `panels` in the same file during migration:

```yaml
# This works during transition
widgets:
  - type: weather
    title: Old Style Widget
    x: 1
    y: 1
    w: 3
    h: 2

panels:
  - panelType: tabbed
    x: 4
    y: 1
    w: 6
    h: 3
    widgets:
      - type: weather
        title: Tab 1
      - type: weather
        title: Tab 2
```

## Migration Steps

### Step 1: Keep Using Old Format

No changes needed! Your existing dashboards will continue to work.

### Step 2: Gradually Adopt New Format (Optional)

When you want to use tabbed panels:

1. Add a new `panels` array to your YAML
2. Move widgets you want to group into tabbed panels
3. Leave other widgets in the `widgets` array (they'll auto-convert)

### Step 3: Full Migration (Optional)

To fully migrate to the new format:

1. Replace `widgets:` with `panels:`
2. Wrap each widget in a panel configuration:
   ```yaml
   # Before
   - type: weather
     title: Weather
     x: 1
     y: 1
     w: 3
     h: 2
     props: {...}
   
   # After
   - panelType: single
     x: 1
     y: 1
     w: 3
     h: 2
     widget:
       type: weather
       title: Weather
       props: {...}
   ```

## Common Use Cases

### Use Case 1: Multiple Locations

Instead of having separate panels for each location:

```yaml
# Old way - 3 separate panels
widgets:
  - type: weather
    title: Munich Weather
    x: 1
    y: 1
    w: 3
    h: 2
  - type: weather
    title: Berlin Weather
    x: 4
    y: 1
    w: 3
    h: 2
  - type: weather
    title: London Weather
    x: 7
    y: 1
    w: 3
    h: 2
```

Group them in one tabbed panel:

```yaml
# New way - 1 tabbed panel
panels:
  - panelType: tabbed
    x: 1
    y: 1
    w: 6
    h: 2
    widgets:
      - type: weather
        title: Munich
        props: {...}
      - type: weather
        title: Berlin
        props: {...}
      - type: weather
        title: London
        props: {...}
```

### Use Case 2: Different News Sources

```yaml
panels:
  - panelType: tabbed
    x: 1
    y: 3
    w: 12
    h: 5
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

### Use Case 3: Related Information

Group related widgets together:

```yaml
panels:
  - panelType: tabbed
    x: 1
    y: 1
    w: 4
    h: 3
    widgets:
      - type: weather
        title: Current
        props: {...}
      - type: weather-forecast
        title: Forecast
        props: {...}
      - type: aqi
        title: Air Quality
        props: {...}
```

## Future Panel Types

The panel system is designed to be extensible. Future panel types might include:

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
        title: Weather
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
        gridX: 1
        gridY: 1
      - type: system-stats
        gridX: 2
        gridY: 1
```

## Benefits of New System

1. **Space Efficiency**: Group related widgets in tabs instead of spreading them across the dashboard
2. **Better Organization**: Logically group related information
3. **Cleaner UI**: Reduce visual clutter by hiding widgets in tabs
4. **Extensibility**: Easy to add new panel types in the future
5. **Backward Compatible**: Existing dashboards continue to work without changes

