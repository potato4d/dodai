import * as http from 'http';
import * as chokidar from 'chokidar';
import * as dayjs from 'dayjs';
import { build } from './build';
import * as express from 'express';

let clients: http.ServerResponse[] = [];

export async function dev() {
  const cwd = process.cwd();

  const app = express();

  http
    .createServer(
      (_, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Request-Method', '*');
        res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
        res.setHeader('Access-Control-Allow-Headers', '*');
        clients.push(res);
      },
    )
    .listen(10020);

  app.use(express.static(`${cwd}/dist`, { etag: false }));
  app.listen(3000, '0.0.0.0');

  console.log(`Execute first build...`);
  await build();
  console.log(`success!`);
  console.info('Preview Server: http://localhost:3000');
  console.info('Polling Server: http://localhost:10020');
  chokidar
    .watch([
      './src'
    ])
    .on(
      'all',
      async (event, filepath) => {
        if (event === 'add' || event === 'addDir') {
          return;
        }
        if (filepath.includes('.')) {
          const rp = `${cwd}/${filepath}`;
          if (require.cache[require.resolve(rp)]) {
            delete require.cache[require.resolve(rp)];
            console.debug(`clear cache: ${require.resolve(rp)}`);
          }
        }
        console.info(`Update ${dayjs().format()}`);
        await build();
        clients.forEach((client) => {
          client.end();
        });
        clients = [];
      },
    );
}
