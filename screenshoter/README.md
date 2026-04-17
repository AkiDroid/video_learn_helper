# Video Screenshoter

Chrome MV3 extension for capturing frames from page `video` elements.

## Load

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select this `screenshoter` folder

## Usage

- Default shortcut: `Alt + Shift + S`
- The popup shows the next filename, starting from `01.png`
- You can reset the index to `01`
- You can record a new shortcut directly in the popup
- "Capture now" triggers the same flow once from the popup

## Capture strategy

1. Try to export the current video frame directly at `videoWidth x videoHeight`
2. If direct export is blocked, fall back to tab capture and crop the visible video area, then rescale to the original video size

## Notes

- Fullscreen works as long as the page still exposes a regular `video` element
- Protected / DRM video may still block frame extraction in the browser
- If fallback mode is used, keep the video fully visible in the viewport for best results
