import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApiRouter } from './api.ts';
import { createWatcher } from './watcher.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ServerOptions {
  rootDir: string;
  port: number;
  open: boolean;
}

export async function startServer({ rootDir, port, open }: ServerOptions) {
  const app = express();
  const httpServer = createServer(app);

  // WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const broadcast = (data: object) => {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  };

  wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    ws.on('close', () => console.log('[WS] Client disconnected'));
    ws.on('error', (err) => console.error('[WS] Error:', err));
  });

  // JSON body parsing
  app.use(express.json({ limit: '50mb' }));

  // CORS for dev
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // API routes
  app.use('/api', createApiRouter(rootDir));

  // Serve built client
  const clientDist = path.join(__dirname, '../dist/client');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  // File watcher
  createWatcher(rootDir, broadcast);

  // Start server
  httpServer.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\nDiagramming Studio running at ${url}\n`);

    if (open) {
      import('child_process').then(({ exec }) => {
        const cmd =
          process.platform === 'win32'
            ? `start ${url}`
            : process.platform === 'darwin'
              ? `open ${url}`
              : `xdg-open ${url}`;
        exec(cmd);
      });
    }
  });

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    httpServer.close();
    process.exit(0);
  });
}
