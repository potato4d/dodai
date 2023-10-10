import * as http from 'http';
import * as chokidar from 'chokidar';
import { build } from './build';
import * as express from 'express';
import { getPort, isSafePort } from 'get-port-please';
const consola = require('consola');

let clients: http.ServerResponse[] = [];

const PORT =
  process.env.PORT && isSafePort(~~process.env.PORT)
    ? ~~process.env.PORT
    : 3000;

export async function dev() {
  const cwd = process.cwd();
  const port = await getPort({
    port: PORT,
  });

  const app = express();

  http
    .createServer((_, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Request-Method', '*');
      res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
      res.setHeader('Access-Control-Allow-Headers', '*');
      clients.push(res);
    })
    .listen(10020);

  app.use((req, res, next) => {
    const now = new Date();
    console.log(`[${now.getHours().toString().padEnd(2, '0')}:${now.getMinutes().toString().padEnd(2, '0')}:${now.getSeconds().toString().padEnd(2, '0')}] ${req.path}`)
    next();
  })

  app.use(express.static(`${cwd}/dist`, { etag: false }));
  app.listen(port, '0.0.0.0');

  consola.info(`Execute first build...`);
  await build();
  consola.success(`success!`);
  consola.info(`Preview Server: http://localhost:${port}`);
  consola.info('Polling Server: http://localhost:10020');
  chokidar.watch(['./src']).on('all', async (event, filepath) => {
    try {
      if (event === 'add' || event === 'addDir') {
        return;
      }
      if (filepath.includes('.')) {
        const rp = `${cwd}/${filepath}`;
        if (require.cache[require.resolve(rp)]) {
          delete require.cache[require.resolve(rp)];
          consola.debug(`clear cache: ${require.resolve(rp)}`);
        }
      }
      consola.info(`Update ${new Date().toISOString()}`);
      await build();
    } catch (e) {
      consola.error(e);
    }
    clients.forEach((client) => {
      client.end();
    });
    clients = [];
  });
}
