# NYC Open Routing - Promotional Video Recording Guide

## Prerequisites

1. Docker services running: `docker-compose up -d`
2. ffmpeg installed: `brew install ffmpeg`
3. Chrome browser (clean profile preferred - no bookmarks bar, no extensions)

## Pre-Recording Setup

1. Open http://localhost:3002 in Chrome
2. Set browser window to 1920x1080: open DevTools console (Cmd+Option+J) and run:
   ```js
   window.resizeTo(1920, 1080)
   ```
3. Pre-warm the map: zoom/pan around Manhattan, run a test route so tiles are cached
4. Reset the app to clean state: reload the page (Cmd+R)

## Recording Sequence

Start recording with **Cmd+Shift+5**, select "Record Selected Portion", draw the selection over the browser viewport.

| Step | Action | Hold |
|------|--------|------|
| 1 | App loads, map centered on Manhattan | 2s |
| 2 | Type origin address (e.g., "350 5th Ave") slowly, select from autocomplete | 4s |
| 3 | Type destination (e.g., "1 Centre St"), select from autocomplete | 3s |
| 4 | Route renders (drive mode) - let route and directions appear | 3s |
| 5 | Click bike mode toggle | 3s |
| 6 | Switch to Isochrone mode | 3s |
| 7 | Isochrone polygons render | 3s |
| 8 | Switch back to Route mode, enable traffic toggle | 3s |
| 9 | Pause on final result | 2s |
| 10 | Stop recording (Cmd+Shift+5 again or click Stop in menu bar) | -- |

**Tips:**
- Move cursor slowly and deliberately
- Type at a moderate pace (not too fast)
- Hold 1-2 seconds after each action so the viewer can see the result
- Total recording should be approximately 26-30 seconds of content

## After Recording

The .mov file is usually saved to `~/Desktop/Screen Recording YYYY-MM-DD at HH.MM.SS.mov`.

## Converting to LinkedIn MP4

Run the conversion script from the project root:

```bash
# Basic conversion (2s start trim, 45s max duration)
scripts/promo-convert.sh ~/Desktop/"Screen Recording....mov"

# Custom trim
scripts/promo-convert.sh ~/Desktop/"Screen Recording....mov" --start 1 --duration 35

# Also generate a GIF
scripts/promo-convert.sh ~/Desktop/"Screen Recording....mov" --start 1 --duration 35 --gif
```

Output files will be created next to the input file:
- `*-linkedin.mp4` - LinkedIn-ready MP4 (H.264, 1920x1080, no audio)
- `*-promo.gif` - Optional palette-optimized GIF (800px, 12fps)

## Before Uploading

1. Play the MP4 in QuickTime or VLC to verify it looks good
2. Check file size is under 200MB (the script reports this)
3. Upload to LinkedIn as a native video post
