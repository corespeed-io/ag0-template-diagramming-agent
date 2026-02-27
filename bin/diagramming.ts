#!/usr/bin/env bun
import { Command } from 'commander';
import path from 'path';
import { startServer } from '../server/index.ts';

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
    const port = parseInt(opts.port, 10);

    console.log(`Starting Diagramming Studio...`);
    console.log(`Watching: ${rootDir}`);
    console.log(`Port: ${port}`);

    await startServer({ rootDir, port, open: opts.open });
  });

program.parse(process.argv);
