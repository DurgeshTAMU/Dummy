# Rock & Fossil Outline Tool

A JavaScript/React/Node assignment prototype for manually outlining rocks or fossils in an uploaded image and exporting each outline as structured JSON.

## Current features

- Upload an image in the browser
- Draw multiple independent freehand outlines
- Choose a different color for each outline
- Select an existing outline
- Delete the selected outline
- Undo the most recently created outline
- Zoom from 50% to 300%
- Preserve coordinates relative to the original image resolution
- Calculate `minX`, `minY`, `maxX`, and `maxY` for each outline
- Send annotations to a Node/Express endpoint for validation
- Preview and copy the resulting JSON

## Project structure

```text
.
├── client/           React + Vite frontend
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       └── styles.css
├── server/           Node + Express API
│   └── server.js
└── package.json      Convenience scripts
```

## Run locally

Requirements: a recent Node.js version and npm.

From the repository root:

```bash
npm run install:all
npm run dev
```

Then open:

```text
http://localhost:5173
```

The frontend runs on port `5173` and the Node API runs on port `4000`.

## Annotation JSON

The client stores full outline points in original-image pixel coordinates. On export it also derives a bounding box for each outline.

Example:

```json
{
  "image": {
    "fileName": "rocks.jpg",
    "width": 2000,
    "height": 1500
  },
  "annotations": [
    {
      "id": "rock-1",
      "color": "#ff3b30",
      "points": [
        { "x": 231, "y": 182 },
        { "x": 238, "y": 176 },
        { "x": 247, "y": 171 }
      ],
      "boundingBox": {
        "minX": 220,
        "minY": 160,
        "maxX": 510,
        "maxY": 430
      }
    }
  ]
}
```

## Implementation note

Zoom only changes how the image and outlines are displayed. The stored coordinates remain tied to the uploaded image's original width and height, so JSON output is stable regardless of browser display size or zoom level.
