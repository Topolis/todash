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
- `baseBackground` (string): CSS gradient for the base background layer. Default: dark blue gradient
- `colors` (string[]): Array of RGBA color strings for the wave layers (back to front). Default: dark blue gradient
- `speed` (number): Base animation speed in seconds. Each layer moves at a different speed for parallax. Higher = slower. Default: 40
- `opacity` (number): Overall opacity of the wallpaper (0-1). Default: 1

**Example:**
```yaml
wallpaper:
  type: waves
  props:
    baseBackground: 'linear-gradient(180deg, rgba(45, 24, 16, 1) 0%, rgba(26, 14, 8, 1) 100%)'
    colors:
      - rgba(240, 100, 73, 0.85)
      - rgba(235, 77, 100, 0.85)
      - rgba(220, 68, 146, 0.85)
      - rgba(145, 70, 160, 0.85)
    speed: 35
    opacity: 1
```

### Unsplash

Displays random photos from Unsplash API with automatic rotation and smooth transitions.

**Type:** `unsplash`

**Props:**
- `apiKey` (string): Unsplash API key. Can be set in dashboard settings under `settings.apiKeys.unsplash`
- `query` (string): Search query for photos (e.g., "nature", "architecture", "minimal"). Optional
- `collections` (string): Comma-separated Unsplash collection IDs. Optional
- `orientation` (string): Photo orientation - "landscape", "portrait", or "squarish". Default: "landscape"
- `featured` (boolean): Only show featured/curated photos. Default: false
- `changeInterval` (number): Seconds between photo changes. Default: 300 (5 minutes)
- `transitionDuration` (number): Transition animation duration in seconds. Default: 2
- `opacity` (number): Overall opacity of the wallpaper (0-1). Default: 1
- `blur` (number): Blur amount in pixels. Default: 0
- `darken` (number): Darken amount (0-1). 0 = no darkening, 1 = completely black. Default: 0

**Setup:**
1. Get a free API key from https://unsplash.com/developers:
   - Create an Unsplash account (if you don't have one)
   - Go to https://unsplash.com/oauth/applications
   - Click "New Application"
   - Accept the terms and create your app
   - Copy the "Access Key" (this is your API key)
   - Demo mode allows 50 requests/hour, which is sufficient for most dashboards
2. Add to your dashboard settings:
```yaml
settings:
  apiKeys:
    unsplash: YOUR_UNSPLASH_ACCESS_KEY_HERE
```

**Example:**
```yaml
wallpaper:
  type: unsplash
  props:
    query: nature
    orientation: landscape
    featured: true
    changeInterval: 300
    transitionDuration: 2
    darken: 0.2
```

**Note:** Attribution is automatically displayed in the bottom-right corner as required by Unsplash API guidelines.

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

