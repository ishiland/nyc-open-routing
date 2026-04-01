#!/usr/bin/env bash
#
# promo-convert.sh - Convert screen recordings to LinkedIn-ready MP4 and optional GIF
#
# Requires: ffmpeg (brew install ffmpeg)
#

set -euo pipefail

usage() {
    cat <<EOF
Usage: $(basename "$0") <input.mov> [options]

Convert a screen recording to LinkedIn-ready MP4 (H.264, 1920x1080, no audio).

Options:
  --start <seconds>     Start offset in seconds (default: 2)
  --duration <seconds>  Duration in seconds (default: 45)
  --gif                 Also generate an optimized GIF (800px wide, 12fps, max 20s)
  --help                Show this help message

Output:
  <input>-linkedin.mp4  LinkedIn-ready MP4 (H.264, CRF 23)
  <input>-promo.gif     Optional palette-optimized GIF

Examples:
  $(basename "$0") ~/Desktop/recording.mov
  $(basename "$0") ~/Desktop/recording.mov --start 3 --duration 30
  $(basename "$0") ~/Desktop/recording.mov --start 1 --duration 40 --gif
EOF
}

# Defaults
START=2
DURATION=45
MAKE_GIF=false
INPUT=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --help|-h)
            usage
            exit 0
            ;;
        --start)
            START="$2"
            shift 2
            ;;
        --duration)
            DURATION="$2"
            shift 2
            ;;
        --gif)
            MAKE_GIF=true
            shift
            ;;
        -*)
            echo "Error: Unknown option $1" >&2
            usage
            exit 1
            ;;
        *)
            if [[ -z "$INPUT" ]]; then
                INPUT="$1"
            else
                echo "Error: Multiple input files not supported" >&2
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate input
if [[ -z "$INPUT" ]]; then
    echo "Error: No input file specified" >&2
    usage
    exit 1
fi

if [[ ! -f "$INPUT" ]]; then
    echo "Error: Input file not found: $INPUT" >&2
    exit 1
fi

# Check ffmpeg
if ! command -v ffmpeg &>/dev/null; then
    echo "Error: ffmpeg not found. Install with: brew install ffmpeg" >&2
    exit 1
fi

# Derive output paths (same directory as input)
DIR=$(dirname "$INPUT")
BASE=$(basename "$INPUT" | sed 's/\.[^.]*$//')
MP4_OUT="${DIR}/${BASE}-linkedin.mp4"
GIF_OUT="${DIR}/${BASE}-promo.gif"

echo "=== Promo Video Converter ==="
echo "Input:    $INPUT"
echo "Start:    ${START}s"
echo "Duration: ${DURATION}s"
echo ""

# --- MP4 conversion ---
echo "Converting to LinkedIn MP4..."
ffmpeg -y \
    -ss "$START" \
    -i "$INPUT" \
    -t "$DURATION" \
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black" \
    -c:v libx264 \
    -preset slow \
    -crf 23 \
    -pix_fmt yuv420p \
    -an \
    -movflags +faststart \
    "$MP4_OUT"

MP4_SIZE=$(du -h "$MP4_OUT" | cut -f1)
MP4_BYTES=$(stat -f%z "$MP4_OUT" 2>/dev/null || stat -c%s "$MP4_OUT" 2>/dev/null)
MP4_MB=$((MP4_BYTES / 1048576))

echo ""
echo "MP4 output: $MP4_OUT"
echo "MP4 size:   $MP4_SIZE ($MP4_MB MB)"

if [[ $MP4_MB -gt 200 ]]; then
    echo "WARNING: File exceeds LinkedIn's 200MB limit. Try reducing --duration or increase CRF."
else
    echo "OK: Under LinkedIn's 200MB limit."
fi

# --- Optional GIF conversion ---
if [[ "$MAKE_GIF" == true ]]; then
    GIF_DURATION=$DURATION
    if [[ $GIF_DURATION -gt 20 ]]; then
        GIF_DURATION=20
        echo ""
        echo "Note: GIF capped at 20s (requested ${DURATION}s)"
    fi

    echo ""
    echo "Generating optimized GIF..."

    # Two-pass palette optimization
    PALETTE=$(mktemp /tmp/palette-XXXXXX.png)

    ffmpeg -y \
        -ss "$START" \
        -i "$INPUT" \
        -t "$GIF_DURATION" \
        -vf "scale=800:-1:flags=lanczos,fps=12,palettegen=stats_mode=diff" \
        "$PALETTE"

    ffmpeg -y \
        -ss "$START" \
        -i "$INPUT" \
        -t "$GIF_DURATION" \
        -i "$PALETTE" \
        -lavfi "scale=800:-1:flags=lanczos,fps=12 [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5" \
        "$GIF_OUT"

    rm -f "$PALETTE"

    GIF_SIZE=$(du -h "$GIF_OUT" | cut -f1)
    GIF_BYTES=$(stat -f%z "$GIF_OUT" 2>/dev/null || stat -c%s "$GIF_OUT" 2>/dev/null)
    GIF_MB=$((GIF_BYTES / 1048576))

    echo "GIF output: $GIF_OUT"
    echo "GIF size:   $GIF_SIZE ($GIF_MB MB)"

    if [[ $GIF_MB -gt 10 ]]; then
        echo "WARNING: GIF exceeds 10MB. Consider shorter duration or lower fps."
    else
        echo "OK: GIF is a reasonable size."
    fi
fi

echo ""
echo "=== Done ==="
echo "Review the MP4 in QuickTime or VLC before uploading to LinkedIn."
