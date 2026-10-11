# YouTube Automated Video Pipeline & Media Bot

An end-to-end automated media processing, video rendering, and scheduled publishing tool running autonomously in a mobile Linux/Android environment (Termux).

## Key Features
- **Automated Media Ingestion:** Fetches source tracks and extracts maximum-resolution cover artwork via `yt-dlp`.
- **Dynamic FFmpeg Video Synthesis:** Composites cover poster intro transitions with 3D audio-reactive loops.
- **YouTube Data API v3 Automation:** Uploads and schedules videos directly to specified daily release slots (6 AM & 6 PM IST) using OAuth 2.0.
- **Resource Optimized:** Tuned encoding parameters (`libx264 ultrafast`) for resource-constrained ARM environments.

## Tech Stack
Node.js, FFmpeg, YouTube Data API v3, OAuth 2.0, Shell/Bash, Termux
