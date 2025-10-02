import React from 'react';
import { Box } from '@mui/material';

export interface WavesWallpaperProps {
  colors?: string[];
  speed?: number;
  opacity?: number;
  baseBackground?: string;
}

/**
 * Waves wallpaper component with smooth, rounded wave shapes
 * Creates a parallax scrolling effect with multiple layers
 */
export default function WavesWallpaper({
  colors = [
    'rgba(20, 30, 48, 0.9)',
    'rgba(36, 59, 85, 0.8)',
    'rgba(52, 88, 122, 0.7)',
    'rgba(68, 117, 159, 0.6)',
  ],
  speed = 40,
  opacity = 1,
  baseBackground = 'linear-gradient(180deg, rgba(10, 15, 25, 1) 0%, rgba(20, 30, 48, 1) 100%)',
}: WavesWallpaperProps) {
  // Generate unique animation names
  const animId = Math.random().toString(36).substr(2, 9);

  // Create wave layers with different speeds for parallax effect
  const waves = colors.map((color, index) => {
    const animationName = `wave-${animId}-${index}`;
    // Each layer moves at a different speed (parallax)
    const layerSpeed = speed * (1 + index * 0.3);
    
    const keyframes = `
      @keyframes ${animationName} {
        0% {
          transform: translateX(0) translateZ(0);
        }
        100% {
          transform: translateX(-50%) translateZ(0);
        }
      }
    `;

    return {
      keyframes,
      animationName,
      color,
      speed: layerSpeed,
    };
  });

  // SVG wave path - smooth, rounded wave shape
  const wavePath = `
    M0,100 
    C150,120 350,80 500,100 
    C650,120 850,80 1000,100 
    C1150,120 1350,80 1500,100 
    C1650,120 1850,80 2000,100 
    L2000,200 L0,200 Z
  `;

  return (
    <>
      <style>
        {waves.map(w => w.keyframes).join('\n')}
      </style>

      {/* Base gradient background */}
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: -10,
          pointerEvents: 'none',
          background: baseBackground,
          opacity,
        }}
      />

      {/* Wave layers */}
      {waves.map((wave, index) => {
        // Distribute waves across full screen
        // More separation at top, closer together at bottom
        const totalLayers = waves.length;
        const progress = index / (totalLayers - 1); // 0 to 1
        // Use exponential curve for vertical position: more space at top, compressed at bottom
        // First wave at top (0%), last wave near bottom, with exponential distribution
        const topPosition = 100 * Math.pow(progress, 0.6);

        return (
          <Box
            key={index}
            sx={{
              position: 'fixed',
              top: `${topPosition}%`,
              bottom: 0,
              left: 0,
              width: '200%',
              zIndex: -9 + index,
              pointerEvents: 'none',
              opacity,
              animation: `${wave.animationName} ${wave.speed}s linear infinite`,
              willChange: 'transform',
            }}
          >
            <svg
              viewBox="0 0 2000 200"
              preserveAspectRatio="none"
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
              }}
            >
              <path
                d={wavePath}
                fill={wave.color}
                opacity={0.85 - index * 0.08}
              />
            </svg>
          </Box>
        );
      })}
    </>
  );
}

