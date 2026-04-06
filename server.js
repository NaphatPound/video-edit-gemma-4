/**
 * Simple proxy server for Ollama Cloud API
 * Handles CORS by making server-side requests
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3002;

const OLLAMA_API_KEY = 'e71c42f8cbe24bb6afde747d0a70e692.AJv2tQuixzTaJpXyf13cIJv6';
const OLLAMA_API_URL = 'https://ollama.com/api/chat';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/api/chat', async (req, res) => {
  try {
    const { model, messages, options, images, stream } = req.body;

    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OLLAMA_API_KEY}`
      },
      body: JSON.stringify({
        model: model || 'gemma4:31b-cloud',
        messages,
        options,
        images,
        stream: false
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ollama-proxy' });
});

app.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`);
});
