import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box } from '@mui/material';
import { logger } from '../lib/logger';

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
  const isFetchingRef = useRef(false);
  const hasStartedRotatingRef = useRef(false);

  // Fetch photos from Unsplash API
  const fetchPhotos = useCallback(async () => {
    if (!apiKey) {
      setError('Unsplash API key not configured');
      logger.error('Unsplash', 'API key not configured');
      return;
    }

    // Prevent duplicate fetches
    if (isFetchingRef.current) {
      logger.debug('Unsplash', 'Fetch already in progress, skipping');
      return;
    }

    isFetchingRef.current = true;
    logger.info('Unsplash', 'Fetching photos', { query, collections, orientation, featured });

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

      logger.debug('Unsplash', `Fetching from: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Unsplash', `API error: ${response.status}`, errorText);
        throw new Error(`Unsplash API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const photoArray = Array.isArray(data) ? data : [data];

      logger.info('Unsplash', `Received ${photoArray.length} photos`);

      if (photoArray.length === 0) {
        throw new Error('No photos returned from Unsplash API');
      }

      setPhotos(photoArray);
      setError(null);
    } catch (err) {
      logger.error('Unsplash', 'Failed to fetch photos', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch photos');
    } finally {
      isFetchingRef.current = false;
    }
  }, [apiKey, query, collections, orientation, featured]);

  // Initial fetch - only once on mount
  useEffect(() => {
    logger.info('Unsplash', 'Component mounted, initiating first fetch');
    fetchPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // Rotate photos
  useEffect(() => {
    if (photos.length === 0) return;

    logger.info('Unsplash', `Starting photo rotation (interval: ${changeInterval}s, ${photos.length} photos loaded)`);
    hasStartedRotatingRef.current = false; // Reset on new photo set

    const interval = setInterval(() => {
      logger.debug('Unsplash', 'Rotating to next photo');
      hasStartedRotatingRef.current = true; // Mark that we've started rotating
      setIsTransitioning(true);

      // After transition starts, update indices
      setTimeout(() => {
        setCurrentIndex((prev) => {
          const next = (prev + 1) % photos.length;
          logger.debug('Unsplash', `Photo index: ${prev} → ${next}`);
          return next;
        });
        setNextIndex((prev) => (prev + 1) % photos.length);
        setIsTransitioning(false);
      }, transitionDuration * 1000);
    }, changeInterval * 1000);

    return () => {
      logger.debug('Unsplash', 'Clearing rotation interval');
      clearInterval(interval);
    };
  }, [photos.length, changeInterval, transitionDuration]);

  // Refetch photos when we've cycled through all
  useEffect(() => {
    if (photos.length === 0) return;

    // Only refetch if we've actually started rotating and cycled back to index 0
    if (hasStartedRotatingRef.current && currentIndex === 0 && nextIndex !== 0) {
      // We've completed a full cycle, fetch new photos
      logger.info('Unsplash', 'Completed full cycle, fetching new photos');
      fetchPhotos();
      hasStartedRotatingRef.current = false; // Reset to prevent immediate refetch
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

