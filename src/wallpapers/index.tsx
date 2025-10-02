import React, { useMemo } from 'react';
import NebulaWallpaper, { NebulaWallpaperProps } from './nebula';
import WavesWallpaper, { WavesWallpaperProps } from './waves';
import UnsplashWallpaper, { UnsplashWallpaperProps } from './unsplash';
import type { DashboardSettings } from '@types/dashboard';

/**
 * Wallpaper configuration types
 */
export interface WallpaperConfig {
  type: 'nebula' | 'waves' | 'unsplash' | 'solid' | 'gradient';
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

export interface UnsplashWallpaperConfig extends WallpaperConfig {
  type: 'unsplash';
  props?: UnsplashWallpaperProps;
}

/**
 * Wallpaper renderer component
 * Renders the appropriate wallpaper based on config
 */
export interface WallpaperRendererProps {
  config?: WallpaperConfig;
  settings?: DashboardSettings;
}

export function WallpaperRenderer({ config, settings }: WallpaperRendererProps) {
  // Memoize props to prevent unnecessary re-renders
  const wallpaperProps = useMemo(() => {
    if (!config) return null;

    // Merge API keys from settings into props for wallpapers that need them
    const baseProps = config.props || {};

    if (config.type === 'unsplash' && settings?.apiKeys?.unsplash) {
      return {
        ...baseProps,
        apiKey: settings.apiKeys.unsplash,
      };
    }

    return baseProps;
  }, [config, settings?.apiKeys?.unsplash]);

  if (!config) {
    return null;
  }

  switch (config.type) {
    case 'nebula':
      return <NebulaWallpaper {...wallpaperProps} />;
    case 'waves':
      return <WavesWallpaper {...wallpaperProps} />;
    case 'unsplash':
      return <UnsplashWallpaper {...wallpaperProps} />;
    default:
      return null;
  }
}

export { NebulaWallpaper, WavesWallpaper, UnsplashWallpaper };
export type { NebulaWallpaperProps, WavesWallpaperProps, UnsplashWallpaperProps };

