import chokidar from 'chokidar';
import path from 'path';

export type WatchEvent = {
  event: 'add' | 'change' | 'unlink';
  path: string;
};

export function createWatcher(rootDir: string, broadcast: (data: WatchEvent) => void) {
  const watcher = chokidar.watch('**/*.excalidraw', {
    cwd: rootDir,
    ignored: ['node_modules/**', '.git/**'],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  watcher
    .on('add', (filePath) => {
      const relPath = path.relative(rootDir, path.resolve(rootDir, filePath));
      console.log(`[Watcher] File added: ${relPath}`);
      broadcast({ event: 'add', path: relPath });
    })
    .on('change', (filePath) => {
      const relPath = path.relative(rootDir, path.resolve(rootDir, filePath));
      console.log(`[Watcher] File changed: ${relPath}`);
      broadcast({ event: 'change', path: relPath });
    })
    .on('unlink', (filePath) => {
      const relPath = path.relative(rootDir, path.resolve(rootDir, filePath));
      console.log(`[Watcher] File removed: ${relPath}`);
      broadcast({ event: 'unlink', path: relPath });
    })
    .on('error', (err) => {
      console.error('[Watcher] Error:', err);
    });

  console.log(`[Watcher] Watching ${rootDir} for .excalidraw files`);

  return watcher;
}
