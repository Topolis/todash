import React from 'react';
import { Box } from '@mui/material';

export interface NebulaWallpaperProps {
  colors?: string[];
  speed?: number;
  opacity?: number;
}

/**
 * Nebula wallpaper component with animated radial gradients
 * Creates a slowly flowing cosmic effect using multiple animated layers
 */
export default function NebulaWallpaper({
  colors = [
    'rgba(64, 91, 155, 0.25)',
    'rgba(113, 63, 136, 0.22)',
    'rgba(38, 90, 102, 0.22)',
    'rgba(128, 96, 56, 0.14)',
  ],
  speed = 40,
  opacity = 1,
}: NebulaWallpaperProps) {
  const animationDuration = `${speed}s`;

  // Generate unique animation names
  const animId = Math.random().toString(36).substr(2, 9);

  // Create individual animated layers for each color
  const layers = colors.map((color, index) => {
    const animationName = `nebula-${animId}-${index}`;
    const delay = index * (speed / colors.length / 4); // Stagger the animations

    // Different movement patterns for each layer (using vw/vh units)
    const movements = [
      { from: '10vw, 20vh', mid: '40vw, 50vh', to: '80vw, 70vh' },
      { from: '80vw, 10vh', mid: '50vw, 40vh', to: '20vw, 80vh' },
      { from: '50vw, 80vh', mid: '60vw, 50vh', to: '30vw, 20vh' },
      { from: '20vw, 70vh', mid: '70vw, 60vh', to: '70vw, 30vh' },
    ];

    const movement = movements[index % movements.length];

    const keyframes = `
      @keyframes ${animationName} {
        0%   { transform: translate(${movement.from}); }
        50%  { transform: translate(${movement.mid}); }
        100% { transform: translate(${movement.to}); }
      }
    `;

    const sizes = ['800px', '700px', '750px', '650px'];
    const size = sizes[index % sizes.length];

    return { keyframes, animationName, delay, color, size };
  });

  return (
    <>
      <style>
        {layers.map(l => l.keyframes).join('\n')}
      </style>

      {/* Base dark layer */}
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse 1400px 1000px at 50% 50%, rgba(11, 15, 25, 0.60), rgba(11, 15, 25, 0.60))',
          opacity,
        }}
      />

      {/* Animated gradient layers */}
      {layers.map((layer, index) => (
        <Box
          key={index}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            opacity,
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              width: layer.size,
              height: layer.size,
              left: '0',
              top: '0',
              marginLeft: `-${parseInt(layer.size) / 2}px`,
              marginTop: `-${parseInt(layer.size) / 2}px`,
              background: `radial-gradient(circle, ${layer.color} 0%, transparent 70%)`,
              filter: 'blur(40px) saturate(1.2)',
              animation: `${layer.animationName} ${animationDuration} ease-in-out infinite alternate`,
              animationDelay: `${layer.delay}s`,
              willChange: 'transform',
            },
          }}
        />
      ))}
    </>
  );
}

