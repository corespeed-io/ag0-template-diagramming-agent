/**
 * Dev mode: starts Express server only (Vite handles the client separately via proxy)
 */
import { startServer } from './index.ts';

const port = parseInt(process.env.PORT ?? '3456', 10);
const rootDir = process.env.ROOT_DIR ?? process.cwd();

console.log('[Dev] Starting server in dev mode...');
startServer({ rootDir, port, open: false });
