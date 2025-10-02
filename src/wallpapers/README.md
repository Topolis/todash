# Wallpapers

Configurable wallpaper components for the dashboard background.

## Usage

Add a `wallpaper` configuration to your dashboard YAML:

```yaml
wallpaper:
  type: nebula
  props:
    colors:
      - rgba(64, 91, 155, 0.25)
      - rgba(113, 63, 136, 0.22)
      - rgba(38, 90, 102, 0.22)
      - rgba(128, 96, 56, 0.14)
    speed: 40
    opacity: 1
```

## Available Wallpapers

### Nebula

Animated cosmic background with flowing radial gradients.

**Type:** `nebula`

**Props:**
- `colors` (string[]): Array of RGBA color strings for the gradient layers. Default: blue/purple/teal/orange palette
- `speed` (number): Animation duration in seconds. Higher = slower. Default: 40
- `opacity` (number): Overall opacity of the wallpaper (0-1). Default: 1

**Example:**
```yaml
wallpaper:
  type: nebula
  props:
    colors:
      - rgba(80, 120, 200, 0.20)
      - rgba(150, 80, 180, 0.18)
      - rgba(60, 140, 140, 0.18)
      - rgba(180, 120, 80, 0.12)
    speed: 50
    opacity: 0.9
```

### Waves

Smooth, rounded wave shapes with parallax scrolling effect.

**Type:** `waves`

**Props:**
- `colors` (string[]): Array of RGBA color strings for the wave layers (back to front). Default: dark blue gradient
- `speed` (number): Base animation speed in seconds. Each layer moves at a different speed for parallax. Higher = slower. Default: 40
- `opacity` (number): Overall opacity of the wallpaper (0-1). Default: 1

**Example:**
```yaml
wallpaper:
  type: waves
  props:
    colors:
      - rgba(20, 30, 48, 0.9)
      - rgba(36, 59, 85, 0.8)
      - rgba(52, 88, 122, 0.7)
      - rgba(68, 117, 159, 0.6)
    speed: 30
    opacity: 1
```

## Creating New Wallpapers

1. Create a new component file in `src/wallpapers/` (e.g., `gradient.tsx`)
2. Export the component and its props interface
3. Add the type to `WallpaperConfig` in `index.tsx`
4. Add a case to the `WallpaperRenderer` switch statement

Example:

```typescript
// src/wallpapers/gradient.tsx
import React from 'react';
import { Box } from '@mui/material';

export interface GradientWallpaperProps {
  from: string;
  to: string;
  angle?: number;
}

export default function GradientWallpaper({
  from,
  to,
  angle = 135,
}: GradientWallpaperProps) {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background: `linear-gradient(${angle}deg, ${from}, ${to})`,
      }}
    />
  );
}
```

Then update `index.tsx`:

```typescript
import GradientWallpaper from './gradient';

export interface WallpaperConfig {
  type: 'nebula' | 'gradient';
  props?: any;
}

export function WallpaperRenderer({ config }: WallpaperRendererProps) {
  switch (config.type) {
    case 'nebula':
      return <NebulaWallpaper {...(config.props || {})} />;
    case 'gradient':
      return <GradientWallpaper {...(config.props || {})} />;
    default:
      return null;
  }
}
```

