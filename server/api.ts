import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import fg from 'fast-glob';

export function createApiRouter(rootDir: string) {
  const router = Router();

  // GET /api/files — list all .excalidraw files
  router.get('/files', async (_req: Request, res: Response) => {
    try {
      const files = await fg('**/*.excalidraw', {
        cwd: rootDir,
        dot: false,
        ignore: ['node_modules/**', '.git/**'],
      });
      files.sort();
      res.json(files);
    } catch (err) {
      console.error('[API] Error listing files:', err);
      res.status(500).json({ error: 'Failed to list files' });
    }
  });

  // GET /api/file?path=relative/path.excalidraw — read file contents
  router.get('/file', async (req: Request, res: Response) => {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: 'path query param required' });
    }

    const absPath = path.resolve(rootDir, filePath);
    if (!absPath.startsWith(rootDir)) {
      return res.status(403).json({ error: 'Path traversal not allowed' });
    }

    try {
      const content = await fs.readFile(absPath, 'utf-8');
      const json = JSON.parse(content);
      res.json(json);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
      }
      console.error('[API] Error reading file:', err);
      res.status(500).json({ error: 'Failed to read file' });
    }
  });

  // PUT /api/file?path=relative/path.excalidraw — write file contents
  router.put('/file', async (req: Request, res: Response) => {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: 'path query param required' });
    }

    const absPath = path.resolve(rootDir, filePath);
    if (!absPath.startsWith(rootDir)) {
      return res.status(403).json({ error: 'Path traversal not allowed' });
    }

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      const content = JSON.stringify(req.body, null, 2);
      await fs.writeFile(absPath, content, 'utf-8');
      res.json({ ok: true });
    } catch (err) {
      console.error('[API] Error writing file:', err);
      res.status(500).json({ error: 'Failed to write file' });
    }
  });

  // POST /api/file — create a new file
  router.post('/file', async (req: Request, res: Response) => {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: 'path query param required' });
    }

    const absPath = path.resolve(rootDir, filePath);
    if (!absPath.startsWith(rootDir)) {
      return res.status(403).json({ error: 'Path traversal not allowed' });
    }

    try {
      // Check if file already exists
      await fs.access(absPath);
      return res.status(409).json({ error: 'File already exists' });
    } catch {
      // File doesn't exist, create it
    }

    const emptyDiagram = {
      type: 'excalidraw',
      version: 2,
      source: 'diagramming-studio',
      elements: [],
      appState: {
        gridSize: null,
        viewBackgroundColor: '#ffffff',
      },
      files: {},
    };

    try {
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, JSON.stringify(emptyDiagram, null, 2), 'utf-8');
      res.status(201).json({ ok: true });
    } catch (err) {
      console.error('[API] Error creating file:', err);
      res.status(500).json({ error: 'Failed to create file' });
    }
  });

  return router;
}
