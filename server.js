const express = require('express');
const path = require('node:path');
const { DEFAULTS, generateSuggestedValues, stylePreview, normalizeInput, createSiteSpool } = require('./lib/spooler');

const app = express();
const port = process.env.PORT || 3030;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/defaults', (req, res) => {
  res.json({
    defaults: DEFAULTS,
    templateFolder: 'wp-new-theme',
  });
});

app.post('/api/suggest', (req, res) => {
  const { siteName = '' } = req.body || {};
  return res.json({ suggestions: generateSuggestedValues(siteName) });
});

app.post('/api/preview', (req, res) => {
  try {
    const values = normalizeInput(req.body || {});
    return res.json({ preview: stylePreview(values) });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/create-site', async (req, res) => {
  try {
    const result = await createSiteSpool(req.body || {}, {
      rootPath: process.cwd(),
      templateFolderName: 'wp-new-theme',
    });
    return res.json({ result });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`WP Theme Spooler running at http://localhost:${port}`);
  console.log(`Working directory: ${process.cwd()}`);
});
