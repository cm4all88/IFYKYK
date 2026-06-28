import express from 'express';
import cors from 'cors';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {selectComposition, renderMedia, ensureBrowser} from '@remotion/renderer';

const app = express();
app.use(cors());
app.use(express.json({limit: '4mb'}));

// Bundle the Remotion project once at startup, reuse for every render.
let serveUrl = null;
const ready = (async () => {
  await ensureBrowser();
  serveUrl = await bundle({
    entryPoint: path.resolve(process.cwd(), 'src/index.ts'),
    // Keep webpack output quiet in logs.
    onProgress: () => {},
  });
  console.log('Remotion bundle ready.');
})();

app.get('/', (_req, res) => {
  res.send('Spotlightly render service. POST /render with JSON {"data": <VideoData>} to get an MP4.');
});

app.get('/health', (_req, res) => res.json({ok: serveUrl !== null}));

app.post('/render', async (req, res) => {
  try {
    await ready;
    const data = req.body?.data;
    if (!data || typeof data !== 'object') {
      return res.status(400).send('Missing "data" object in body.');
    }

    const composition = await selectComposition({
      serveUrl,
      id: 'MarketingVideo',
      inputProps: data,
    });

    const out = path.join(os.tmpdir(), `spotlightly-${Date.now()}.mp4`);
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: out,
      inputProps: data,
      // Reliable on headless servers.
      chromiumOptions: {gl: 'angle'},
    });

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="spotlightly.mp4"');
    const stream = fs.createReadStream(out);
    stream.pipe(res);
    stream.on('close', () => fs.unlink(out, () => {}));
  } catch (err) {
    console.error(err);
    res.status(500).send(String(err?.message ?? err));
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Spotlightly render service listening on ${port}`));
