# Unsplash Wallpaper - Quick Start Guide

Get beautiful, rotating photos from Unsplash on your dashboard in 3 easy steps!

## Step 1: Get Your Free API Key

1. Go to https://unsplash.com/oauth/applications
2. Sign up or log in
3. Click "New Application"
4. Accept the terms
5. Give your app a name (e.g., "My Dashboard")
6. Copy your **Access Key**

## Step 2: Add API Key to Your Dashboard

Edit your dashboard YAML file (e.g., `dashboards/tobe.yaml`):

```yaml
settings:
  apiKeys:
    unsplash: paste_your_access_key_here
```

## Step 3: Configure the Wallpaper

Add this to your dashboard YAML:

```yaml
wallpaper:
  type: unsplash
  props:
    query: nature          # Search term (try: nature, minimal, architecture)
    orientation: landscape # landscape, portrait, or squarish
    changeInterval: 300    # Change photo every 5 minutes
    darken: 0.2           # Darken by 20% for better text readability
```

## That's It!

Restart your dashboard and enjoy beautiful rotating photos!

## Popular Search Queries

Try these in the `query` field:
- `nature landscape`
- `minimal`
- `architecture`
- `ocean`
- `mountains`
- `city`
- `abstract`
- `workspace`

## Common Customizations

### Slower rotation (every 10 minutes)
```yaml
changeInterval: 600
```

### More dramatic darkening
```yaml
darken: 0.4
```

### Subtle background blur
```yaml
blur: 5
darken: 0.3
```

### Only featured/curated photos
```yaml
featured: true
```

## Need Help?

- Full documentation: [docs/UNSPLASH_WALLPAPER.md](docs/UNSPLASH_WALLPAPER.md)
- Wallpapers guide: [src/wallpapers/README.md](src/wallpapers/README.md)
- Unsplash API: https://unsplash.com/documentation

