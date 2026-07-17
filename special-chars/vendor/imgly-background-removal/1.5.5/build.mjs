import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';

const vendorDirectory = path.dirname(fileURLToPath(import.meta.url));
const requireFromWorkingDirectory = createRequire(path.join(process.cwd(), 'package.json'));
const { build } = requireFromWorkingDirectory('esbuild');
const ndarraySource = path.join(vendorDirectory, 'ndarray-csp.cjs');
const entryPoint = path.resolve(process.cwd(), 'node_modules/@imgly/background-removal/dist/index.mjs');

await build({
  absWorkingDir: process.cwd(),
  entryPoints: [entryPoint],
  outfile: path.join(vendorDirectory, 'background-removal.bundle.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  legalComments: 'eof',
  sourcemap: 'external',
  sourcesContent: true,
  plugins: [{
    name: 'csp-safe-ndarray',
    setup(buildApi) {
      buildApi.onResolve({ filter: /^ndarray$/ }, () => ({ path: 'ndarray-csp.cjs', namespace: 'csp-safe-ndarray' }));
      buildApi.onLoad({ filter: /.*/, namespace: 'csp-safe-ndarray' }, async () => ({
        contents: await readFile(ndarraySource, 'utf8'),
        loader: 'js',
        resolveDir: vendorDirectory
      }));
    }
  }]
});

// Make source identifiers independent of the temporary npm install path while
// retaining every embedded sourcesContent entry and its mapping.
const sourceMapPath = path.join(vendorDirectory, 'background-removal.bundle.js.map');
const sourceMap = JSON.parse(await readFile(sourceMapPath, 'utf8'));
sourceMap.sources = sourceMap.sources.map(source => (
  source.includes('/node_modules/') ? `npm/${source.split('/node_modules/').slice(1).join('/node_modules/')}` : source
));
await writeFile(sourceMapPath, JSON.stringify(sourceMap));
