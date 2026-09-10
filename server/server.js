import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/annotations', (req, res) => {
  const { image, annotations } = req.body ?? {};

  if (!image || !Array.isArray(annotations)) {
    return res.status(400).json({
      error: 'Payload must contain image metadata and an annotations array.',
    });
  }

  const invalidAnnotation = annotations.find((annotation) =>
    !annotation?.id ||
    !Array.isArray(annotation?.points) ||
    annotation.points.length < 3 ||
    !annotation?.boundingBox
  );

  if (invalidAnnotation) {
    return res.status(400).json({
      error: `Invalid annotation: ${invalidAnnotation.id ?? 'unknown'}`,
    });
  }

  return res.json({
    image,
    annotationCount: annotations.length,
    annotations,
    generatedAt: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Rock annotation server running at http://localhost:${PORT}`);
});
