# Long Distance Photo Booth

React 18 + Vite + Tailwind CSS 3 + lucide-react + HTML5 Canvas.

## Run it

```bash
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173). Browsers allow the camera on localhost and on https pages.

## Build

```bash
npm run build
npm run preview
```

## Files

- `src/App.jsx` holds the whole app: room setup, the two feeds with live filters, the 3-2-1 capture sequence, strip rendering on a canvas, stickers, footer text and PNG export.
- `src/index.css` has the Tailwind layers and the color tokens.
- `tailwind.config.js` sets the three font families.

## Notes

- There is no live video link between two devices. The partner feed is a simulated camera, and the room code and link are generated locally.
- If the camera is blocked, you can retry, load a video or photo from your device, or keep the animated sample feed.
- The strip is drawn on a canvas at 1200 pixels wide for the preview and 2400 pixels wide for the download.
