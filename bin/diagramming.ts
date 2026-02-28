#!/usr/bin/env bun
import { Command } from 'commander';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '..', 'server');

const program = new Command();

program
  .name('diagramming')
  .description('Diagramming Studio CLI - edit .excalidraw files in a local web studio')
  .version('0.1.0');

program
  .command('studio [dir]')
  .description('Start the diagramming studio web app')
  .option('-p, --port <port>', 'port to listen on', '3456')
  .option('--no-open', 'do not open browser automatically')
  .action(async (dir: string | undefined, opts: { port: string; open: boolean }) => {
    const rootDir = dir ? path.resolve(dir) : process.cwd();
    const port = opts.port;

    console.log(`Starting Diagramming Studio...`);
    console.log(`Watching: ${rootDir}`);
    console.log(`Port: ${port}`);

    const proc = spawn(
      'deno',
      ['run', '-A', `--config=${serverDir}/deno.json`, `${serverDir}/main.ts`],
      {
        env: { ...process.env, ROOT_DIR: rootDir, PORT: port },
        stdio: 'inherit',
      },
    );

    proc.on('error', (err) => console.error('Failed to start Deno server:', err));

    if (opts.open) {
      setTimeout(() => {
        const url = `http://localhost:${port}`;
        const cmd =
          process.platform === 'win32' ? `start ${url}`
          : process.platform === 'darwin' ? `open ${url}`
          : `xdg-open ${url}`;
        spawn(cmd, { shell: true, stdio: 'ignore' });
      }, 1500);
    }

    // Keep process alive
    await new Promise(() => {});
  });

program.parse(process.argv);
