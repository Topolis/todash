import React from 'react';
import NebulaWallpaper, { NebulaWallpaperProps } from './nebula';
import WavesWallpaper, { WavesWallpaperProps } from './waves';

/**
 * Wallpaper configuration types
 */
export interface WallpaperConfig {
  type: 'nebula' | 'waves' | 'solid' | 'gradient';
  props?: any;
}

export interface NebulaWallpaperConfig extends WallpaperConfig {
  type: 'nebula';
  props?: NebulaWallpaperProps;
}

export interface WavesWallpaperConfig extends WallpaperConfig {
  type: 'waves';
  props?: WavesWallpaperProps;
}

/**
 * Wallpaper renderer component
 * Renders the appropriate wallpaper based on config
 */
export interface WallpaperRendererProps {
  config?: WallpaperConfig;
}

export function WallpaperRenderer({ config }: WallpaperRendererProps) {
  if (!config) {
    return null;
  }

  switch (config.type) {
    case 'nebula':
      return <NebulaWallpaper {...(config.props || {})} />;
    case 'waves':
      return <WavesWallpaper {...(config.props || {})} />;
    default:
      return null;
  }
}

export { NebulaWallpaper, WavesWallpaper };
export type { NebulaWallpaperProps, WavesWallpaperProps };

