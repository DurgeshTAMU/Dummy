import { useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';

const MAX_VIEW_WIDTH = 900;
const MAX_VIEW_HEIGHT = 620;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

function getBoundingBox(points) {
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);

  return {
    minX: Math.round(Math.min(...xs)),
    minY: Math.round(Math.min(...ys)),
    maxX: Math.round(Math.max(...xs)),
    maxY: Math.round(Math.max(...ys)),
  };
}

function buildPayload(imageMeta, annotations) {
  return {
    image: imageMeta,
    annotations: annotations.map((annotation) => ({
      id: annotation.id,
      color: annotation.color,
      points: annotation.points.reduce((result, value, index, source) => {
        if (index % 2 === 0) {
          result.push({
            x: Math.round(value),
            y: Math.round(source[index + 1]),
          });
        }
        return result;
      }, []),
      boundingBox: getBoundingBox(annotation.points),
    })),
  };
}

export default function App() {
  const [image, setImage] = useState(null);
  const [imageMeta, setImageMeta] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [activePoints, setActivePoints] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [color, setColor] = useState('#ff3b30');
  const [zoom, setZoom] = useState(1);
  const [jsonOutput, setJsonOutput] = useState('');
  const [status, setStatus] = useState('');
  const nextId = useRef(1);

  const fitScale = useMemo(() => {
    if (!imageMeta) return 1;
    return Math.min(
      MAX_VIEW_WIDTH / imageMeta.width,
      MAX_VIEW_HEIGHT / imageMeta.height,
      1
    );
  }, [imageMeta]);

  const displayScale = fitScale * zoom;
  const stageWidth = imageMeta ? Math.round(imageMeta.width * displayScale) : 0;
  const stageHeight = imageMeta ? Math.round(imageMeta.height * displayScale) : 0;

  function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();

    img.onload = () => {
      setImage(img);
      setImageMeta({
        fileName: file.name,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      setAnnotations([]);
      setSelectedId(null);
      setZoom(1);
      setJsonOutput('');
      setStatus('Image loaded. Draw an outline by dragging over the image.');
      nextId.current = 1;
    };

    img.src = objectUrl;
  }

  function pointerToImage(stage) {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;

    return {
      x: Math.max(0, Math.min(imageMeta.width, pointer.x / displayScale)),
      y: Math.max(0, Math.min(imageMeta.height, pointer.y / displayScale)),
    };
  }

  function handlePointerDown(event) {
    if (!imageMeta || event.target !== event.target.getStage()) return;

    const point = pointerToImage(event.target.getStage());
    if (!point) return;

    setSelectedId(null);
    setActivePoints([point.x, point.y]);
    setIsDrawing(true);
  }

  function handlePointerMove(event) {
    if (!isDrawing) return;

    const point = pointerToImage(event.target.getStage());
    if (!point) return;

    setActivePoints((previous) => [...previous, point.x, point.y]);
  }

  function handlePointerUp() {
    if (!isDrawing) return;

    setIsDrawing(false);

    if (activePoints.length >= 6) {
      const id = `rock-${nextId.current++}`;
      setAnnotations((previous) => [
        ...previous,
        { id, color, points: activePoints },
      ]);
      setSelectedId(id);
      setStatus(`${id} added.`);
    }

    setActivePoints([]);
  }

  function undoLast() {
    if (!annotations.length) return;
    const removed = annotations[annotations.length - 1];
    setAnnotations((previous) => previous.slice(0, -1));
    if (selectedId === removed.id) setSelectedId(null);
    setStatus(`${removed.id} removed.`);
  }

  function deleteSelected() {
    if (!selectedId) return;
    setAnnotations((previous) => previous.filter((a) => a.id !== selectedId));
    setStatus(`${selectedId} deleted.`);
    setSelectedId(null);
  }

  async function generateJson() {
    if (!imageMeta) return;

    const payload = buildPayload(imageMeta, annotations);

    try {
      const response = await fetch('http://localhost:4000/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Server rejected annotation data.');
      const data = await response.json();
      setJsonOutput(JSON.stringify(data, null, 2));
      setStatus('JSON generated and validated by the Node server.');
    } catch (error) {
      setJsonOutput(JSON.stringify(payload, null, 2));
      setStatus('Node server is not reachable; showing the local JSON payload instead.');
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">IMAGE ANNOTATION ASSIGNMENT</p>
        <h1>Rock & Fossil Outline Tool</h1>
        <p>
          Upload an image, draw multiple colored outlines, remove mistakes, zoom for precision,
          and export image-relative coordinates as JSON.
        </p>
      </header>

      {!image ? (
        <section className="upload-card">
          <h2>Upload an image</h2>
          <p>PNG, JPG, or other browser-supported image formats work.</p>
          <label className="primary-button upload-button">
            Choose image
            <input type="file" accept="image/*" onChange={handleUpload} hidden />
          </label>
        </section>
      ) : (
        <section className="workspace">
          <div className="toolbar">
            <label className="color-control">
              Outline color
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </label>

            <button onClick={undoLast} disabled={!annotations.length}>Undo</button>
            <button onClick={deleteSelected} disabled={!selectedId}>Delete selected</button>

            <div className="zoom-control">
              <button onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}>−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}>+</button>
            </div>

            <label className="secondary-button upload-button small">
              New image
              <input type="file" accept="image/*" onChange={handleUpload} hidden />
            </label>
          </div>

          <div className="content-grid">
            <div className="canvas-card">
              <div className="canvas-scroll">
                <Stage
                  width={stageWidth}
                  height={stageHeight}
                  onMouseDown={handlePointerDown}
                  onMouseMove={handlePointerMove}
                  onMouseUp={handlePointerUp}
                  onMouseLeave={handlePointerUp}
                  onTouchStart={handlePointerDown}
                  onTouchMove={handlePointerMove}
                  onTouchEnd={handlePointerUp}
                >
                  <Layer>
                    <KonvaImage
                      image={image}
                      width={imageMeta.width}
                      height={imageMeta.height}
                      scaleX={displayScale}
                      scaleY={displayScale}
                      listening={false}
                    />

                    {annotations.map((annotation) => (
                      <Line
                        key={annotation.id}
                        points={annotation.points}
                        scaleX={displayScale}
                        scaleY={displayScale}
                        stroke={annotation.color}
                        strokeWidth={selectedId === annotation.id ? 4 / displayScale : 3 / displayScale}
                        closed
                        lineCap="round"
                        lineJoin="round"
                        hitStrokeWidth={12 / displayScale}
                        onClick={(event) => {
                          event.cancelBubble = true;
                          setSelectedId(annotation.id);
                        }}
                        onTap={(event) => {
                          event.cancelBubble = true;
                          setSelectedId(annotation.id);
                        }}
                      />
                    ))}

                    {activePoints.length > 0 && (
                      <Line
                        points={activePoints}
                        scaleX={displayScale}
                        scaleY={displayScale}
                        stroke={color}
                        strokeWidth={3 / displayScale}
                        lineCap="round"
                        lineJoin="round"
                        listening={false}
                      />
                    )}
                  </Layer>
                </Stage>
              </div>
              <p className="status">{status}</p>
            </div>

            <aside className="side-panel">
              <div className="panel-section">
                <div className="panel-heading">
                  <h2>Annotations</h2>
                  <span>{annotations.length}</span>
                </div>

                {!annotations.length ? (
                  <p className="muted">No outlines yet.</p>
                ) : (
                  <div className="annotation-list">
                    {annotations.map((annotation) => (
                      <button
                        key={annotation.id}
                        className={`annotation-item ${selectedId === annotation.id ? 'selected' : ''}`}
                        onClick={() => setSelectedId(annotation.id)}
                      >
                        <span className="swatch" style={{ background: annotation.color }} />
                        <span>{annotation.id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button className="primary-button full-width" onClick={generateJson}>
                Generate JSON
              </button>

              {jsonOutput && (
                <div className="json-panel">
                  <div className="panel-heading">
                    <h2>JSON output</h2>
                    <button
                      className="text-button"
                      onClick={() => navigator.clipboard.writeText(jsonOutput)}
                    >
                      Copy
                    </button>
                  </div>
                  <pre>{jsonOutput}</pre>
                </div>
              )}
            </aside>
          </div>
        </section>
      )}
    </main>
  );
}
