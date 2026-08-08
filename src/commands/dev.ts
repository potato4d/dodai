import * as http from 'node:http';
import chokidar from 'chokidar';
import { build } from './build.js';
import express from 'express';
import { getPort, isSafePort } from 'get-port-please';
import consolaModule, { type Consola } from 'consola';

let clients: http.ServerResponse[] = [];
const consola = consolaModule as unknown as Consola;

const PORT =
  process.env.PORT && isSafePort(~~process.env.PORT)
    ? ~~process.env.PORT
    : 3000;
const RELOAD_PORT =
  process.env.DODAI_RELOAD_PORT &&
  isSafePort(~~process.env.DODAI_RELOAD_PORT)
    ? ~~process.env.DODAI_RELOAD_PORT
    : 10020;

const listen = (server: http.Server, port: number, host?: string) =>
  new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    if (host) {
      server.listen(port, host);
    } else {
      server.listen(port);
    }
  });

export async function dev() {
  const cwd = process.cwd();
  const port = await getPort({
    port: PORT,
  });

  consola.info(`Execute first build...`);
  await build();
  consola.success(`success!`);

  const app = express();

  const reloadServer = http.createServer((_, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Request-Method', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', '*');
    clients.push(res);
  });

  app.use((req, res, next) => {
    const now = new Date();
    console.log(
      `[${now.getHours().toString().padEnd(2, '0')}:${now
        .getMinutes()
        .toString()
        .padEnd(2, '0')}:${now
        .getSeconds()
        .toString()
        .padEnd(2, '0')}] ${req.path}`,
    );
    next();
  });

  app.use(express.static(`${cwd}/dist`, { etag: false }));
  const previewServer = http.createServer(app);
  await listen(reloadServer, RELOAD_PORT);
  try {
    await listen(previewServer, port, '0.0.0.0');
  } catch (error) {
    reloadServer.close();
    throw error;
  }

  let rebuildQueue = Promise.resolve();
  const watcher = chokidar.watch(['./src'], { ignoreInitial: true });
  watcher.on('all', () => {
    rebuildQueue = rebuildQueue
      .then(async () => {
        consola.info(`Update ${new Date().toISOString()}`);
        await build(true);
        clients.forEach((client) => {
          client.end();
        });
        clients = [];
      })
      .catch((error) => {
        consola.error(error);
      });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      watcher.once('ready', resolve);
      watcher.once('error', reject);
    });
  } catch (error) {
    reloadServer.close();
    previewServer.close();
    throw error;
  }
  consola.info(`Preview Server: http://localhost:${port}`);
  consola.info(`Polling Server: http://localhost:${RELOAD_PORT}`);
}
