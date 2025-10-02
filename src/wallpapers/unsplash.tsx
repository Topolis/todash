import React, { useEffect, useState, useCallback } from 'react';
import { Box } from '@mui/material';

export interface UnsplashWallpaperProps {
  apiKey?: string;
  query?: string;
  collections?: string;
  orientation?: 'landscape' | 'portrait' | 'squarish';
  featured?: boolean;
  changeInterval?: number; // seconds
  transitionDuration?: number; // seconds
  opacity?: number;
  blur?: number;
  darken?: number;
}

interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
  };
  user: {
    name: string;
    username: string;
  };
  links: {
    html: string;
  };
}

/**
 * Unsplash wallpaper component
 * Displays random photos from Unsplash API with automatic rotation
 */
export default function UnsplashWallpaper({
  apiKey,
  query,
  collections,
  orientation = 'landscape',
  featured = false,
  changeInterval = 300, // 5 minutes default
  transitionDuration = 2,
  opacity = 1,
  blur = 0,
  darken = 0,
}: UnsplashWallpaperProps) {
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch photos from Unsplash API
  const fetchPhotos = useCallback(async () => {
    if (!apiKey) {
      setError('Unsplash API key not configured');
      console.error('Unsplash: API key not configured');
      return;
    }

    console.log('Unsplash: Fetching photos with config:', { query, collections, orientation, featured });

    try {
      const params = new URLSearchParams({
        client_id: apiKey,
        count: '30', // Fetch 30 random photos
      });

      // Add orientation if specified
      if (orientation) {
        params.set('orientation', orientation);
      }

      // Add query if specified
      if (query) {
        params.set('query', query);
      }

      // Add collections if specified
      if (collections) {
        params.set('collections', collections);
      }

      // Featured is only supported without query
      if (featured && !query) {
        params.set('featured', 'true');
      }

      const endpoint = 'https://api.unsplash.com/photos/random';
      const url = `${endpoint}?${params.toString()}`;

      console.log('Unsplash: Fetching from:', url.replace(apiKey, 'API_KEY_HIDDEN'));

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Unsplash API error response:', errorText);
        throw new Error(`Unsplash API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const photoArray = Array.isArray(data) ? data : [data];

      console.log('Unsplash: Received', photoArray.length, 'photos');

      if (photoArray.length === 0) {
        throw new Error('No photos returned from Unsplash API');
      }

      setPhotos(photoArray);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch Unsplash photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch photos');
    }
  }, [apiKey, query, collections, orientation, featured]);

  // Initial fetch
  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Rotate photos
  useEffect(() => {
    if (photos.length === 0) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      
      // After transition starts, update indices
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
        setNextIndex((prev) => (prev + 1) % photos.length);
        setIsTransitioning(false);
      }, transitionDuration * 1000);
    }, changeInterval * 1000);

    return () => clearInterval(interval);
  }, [photos.length, changeInterval, transitionDuration]);

  // Refetch photos when we've cycled through all
  useEffect(() => {
    if (photos.length === 0) return;
    
    if (currentIndex === 0 && currentIndex !== nextIndex) {
      // We've completed a full cycle, fetch new photos
      fetchPhotos();
    }
  }, [currentIndex, nextIndex, photos.length, fetchPhotos]);

  if (error) {
    return (
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: -10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, rgba(20, 20, 30, 1) 0%, rgba(10, 10, 15, 1) 100%)',
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '14px',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        Unsplash wallpaper error: {error}
      </Box>
    );
  }

  if (photos.length === 0) {
    return (
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: -10,
          background: 'linear-gradient(180deg, rgba(20, 20, 30, 1) 0%, rgba(10, 10, 15, 1) 100%)',
        }}
      />
    );
  }

  const currentPhoto = photos[currentIndex];
  const nextPhoto = photos[nextIndex];

  // Build image URL with optimizations
  const getImageUrl = (photo: UnsplashPhoto) => {
    const url = new URL(photo.urls.raw);
    url.searchParams.set('w', '1920');
    url.searchParams.set('q', '85');
    url.searchParams.set('fm', 'jpg');
    url.searchParams.set('fit', 'crop');
    return url.toString();
  };

  return (
    <>
      {/* Current photo */}
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: -10,
          backgroundImage: `url(${getImageUrl(currentPhoto)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: isTransitioning ? 0 : opacity,
          filter: `blur(${blur}px) brightness(${1 - darken})`,
          transition: `opacity ${transitionDuration}s ease-in-out, filter 0.3s ease-in-out`,
        }}
      />

      {/* Next photo (for smooth transition) */}
      {nextPhoto && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: -10,
            backgroundImage: `url(${getImageUrl(nextPhoto)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: isTransitioning ? opacity : 0,
            filter: `blur(${blur}px) brightness(${1 - darken})`,
            transition: `opacity ${transitionDuration}s ease-in-out, filter 0.3s ease-in-out`,
          }}
        />
      )}

      {/* Attribution overlay (required by Unsplash API guidelines) */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 8,
          right: 8,
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.5)',
          color: 'rgba(255, 255, 255, 0.8)',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          pointerEvents: 'auto',
          '& a': {
            color: 'rgba(255, 255, 255, 0.9)',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            },
          },
        }}
      >
        Photo by{' '}
        <a
          href={`${currentPhoto.links.html}?utm_source=todash&utm_medium=referral`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {currentPhoto.user.name}
        </a>
        {' on '}
        <a
          href="https://unsplash.com?utm_source=todash&utm_medium=referral"
          target="_blank"
          rel="noopener noreferrer"
        >
          Unsplash
        </a>
      </Box>
    </>
  );
}

