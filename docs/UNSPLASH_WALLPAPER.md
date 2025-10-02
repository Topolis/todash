# Unsplash Wallpaper Integration

The Unsplash wallpaper component displays beautiful, high-quality photos from Unsplash's API with automatic rotation and smooth transitions.

## Features

- **Random Photos**: Fetches 30 random photos at a time from Unsplash
- **Automatic Rotation**: Changes photos at configurable intervals
- **Smooth Transitions**: Cross-fade between photos
- **Search & Filter**: Filter by query, collections, orientation, and featured status
- **Image Optimization**: Uses Unsplash CDN with optimized parameters
- **Attribution**: Automatically displays required attribution
- **Customization**: Blur, darken, and opacity controls

## Quick Start

### 1. Get an Unsplash API Key

1. Create an account at https://unsplash.com
2. Go to https://unsplash.com/oauth/applications
3. Click "New Application"
4. Accept the API terms and create your app
5. Copy your "Access Key" (this is your API key)

**Rate Limits:**
- Demo mode: 50 requests/hour (sufficient for most dashboards)
- Production: 5,000 requests/hour (requires approval)

### 2. Configure Your Dashboard

Add the API key to your dashboard settings:

```yaml
settings:
  apiKeys:
    unsplash: your_access_key_here
```

### 3. Add Wallpaper Configuration

```yaml
wallpaper:
  type: unsplash
  props:
    query: nature
    orientation: landscape
    changeInterval: 300
```

## Configuration Options

### Required

- **apiKey** (string): Your Unsplash API access key
  - Can be set in `settings.apiKeys.unsplash` or directly in wallpaper props

### Search & Filtering

- **query** (string): Search term for photos
  - Examples: "nature", "architecture", "minimal", "ocean", "mountains"
  - Leave empty for completely random photos
  
- **collections** (string): Comma-separated Unsplash collection IDs
  - Example: "1538150,1065976"
  - Find collections at https://unsplash.com/collections
  
- **orientation** (string): Photo orientation
  - Options: `landscape`, `portrait`, `squarish`
  - Default: `landscape`
  
- **featured** (boolean): Only show curated/featured photos
  - Default: `false`

### Display & Timing

- **changeInterval** (number): Seconds between photo changes
  - Default: `300` (5 minutes)
  - Minimum recommended: `60` (1 minute)
  
- **transitionDuration** (number): Transition animation duration in seconds
  - Default: `2`
  - Range: `0.5` to `5`

### Visual Effects

- **opacity** (number): Overall opacity
  - Range: `0` to `1`
  - Default: `1`
  
- **blur** (number): Blur amount in pixels
  - Default: `0`
  - Useful range: `0` to `20`
  
- **darken** (number): Darken amount
  - Range: `0` (no darkening) to `1` (completely black)
  - Default: `0`
  - Recommended: `0.1` to `0.3` for better text readability

## Example Configurations

### Nature Photography

```yaml
wallpaper:
  type: unsplash
  props:
    query: nature landscape
    orientation: landscape
    featured: true
    changeInterval: 600
    darken: 0.2
```

### Minimal & Clean

```yaml
wallpaper:
  type: unsplash
  props:
    query: minimal
    orientation: landscape
    changeInterval: 900
    blur: 5
    darken: 0.3
```

### Architecture

```yaml
wallpaper:
  type: unsplash
  props:
    query: architecture
    orientation: landscape
    featured: true
    changeInterval: 300
```

### Specific Collection

```yaml
wallpaper:
  type: unsplash
  props:
    collections: "1538150"
    orientation: landscape
    changeInterval: 300
```

### Completely Random

```yaml
wallpaper:
  type: unsplash
  props:
    orientation: landscape
    changeInterval: 300
    darken: 0.15
```

## Best Practices

### Performance

1. **Change Interval**: Don't set too low (< 60 seconds) to avoid excessive API calls
2. **Image Size**: Component automatically requests optimized 1920px width images
3. **Caching**: Unsplash CDN handles caching automatically

### API Usage

1. **Rate Limits**: With 30 photos per fetch and 5-minute intervals, you'll use ~12 requests/hour
2. **Attribution**: Required by Unsplash - automatically displayed in bottom-right corner
3. **Demo vs Production**: Demo mode (50 req/hour) is sufficient for personal dashboards

### Visual Quality

1. **Darken**: Use `0.1` to `0.3` to improve text readability over photos
2. **Blur**: Subtle blur (`2-5px`) can create a nice depth effect
3. **Featured**: Enable for higher quality, curated photos
4. **Orientation**: Match your screen orientation for best results

## Troubleshooting

### "Unsplash API key not configured"

- Ensure API key is set in `settings.apiKeys.unsplash`
- Check that the key is your "Access Key" not "Secret Key"

### Photos not changing

- Check browser console for API errors
- Verify your API key is valid
- Check rate limits (50 requests/hour in demo mode)

### Attribution not showing

- Attribution is required by Unsplash API terms
- It's automatically displayed and cannot be removed
- Positioned in bottom-right corner with semi-transparent background

### Images loading slowly

- Unsplash CDN is generally fast
- Check your internet connection
- Images are optimized to 1920px width automatically

## API Guidelines Compliance

This implementation follows Unsplash API Guidelines:

1. ✅ Attribution displayed for each photo
2. ✅ Links to photographer and Unsplash with UTM parameters
3. ✅ Uses official API endpoints
4. ✅ Respects rate limits
5. ✅ Hotlinks to Unsplash CDN (no downloading/re-hosting)

## Technical Details

### How It Works

1. Component fetches 30 random photos on mount
2. Photos are displayed one at a time with cross-fade transitions
3. After cycling through all 30, new photos are fetched
4. Images are loaded directly from Unsplash CDN
5. Attribution overlay is always visible

### Image URL Parameters

The component automatically adds these parameters to Unsplash image URLs:
- `w=1920`: Width optimization
- `q=85`: Quality (85%)
- `fm=jpg`: Format (JPEG)
- `fit=crop`: Crop to fit

### State Management

- Current and next photo indices tracked for smooth transitions
- Transition state prevents flickering
- Error state displays helpful message
- Loading state shows fallback gradient

## Related Documentation

- [Wallpapers README](../src/wallpapers/README.md)
- [Unsplash API Documentation](https://unsplash.com/documentation)
- [Unsplash API Guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)

