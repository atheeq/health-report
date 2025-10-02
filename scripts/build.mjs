import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tsmod = await import('typescript');
const ts = tsmod.default ?? tsmod;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && full.endsWith('.ts')) yield full;
  }
}

async function ensureDir(p) { await mkdir(p, { recursive: true }).catch(()=>{}); }

function transpile(src, esm=true) {
  const res = ts.transpileModule(src, { compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: esm ? ts.ModuleKind.ES2020 : ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.None,
    removeComments: false,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove
  }});
  return res.outputText;
}

// Transpile TS -> ESM only
for await (const file of walk(resolve(root, 'src'))) {
  const rel = file.substring(resolve(root, 'src').length + 1);
  const jsRel = rel.replace(/\.ts$/, '.js');
  const src = await readFile(file, 'utf8');
  const esmOut = transpile(src, true);
  const esmPath = resolve(root, 'dist/esm', jsRel);
  await ensureDir(dirname(esmPath));
  await writeFile(esmPath, esmOut, 'utf8');
}

// Post-process ESM output to append .js to relative imports/exports
async function* walkJs(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) yield* walkJs(full);
    else if (entry.isFile() && full.endsWith('.js')) yield full;
  }
}
for await (const file of walkJs(resolve(root, 'dist/esm'))) {
  let js = await readFile(file, 'utf8');
  js = js.replace(/(from\s+['"])((?:\.|\..)\/[^'"\n]+)(['"];?)/g, (m, a, spec, b) => {
    if (/\.(js|mjs|cjs|json)$/.test(spec)) return m;
    return a + spec + '.js' + b;
  });
  await writeFile(file, js, 'utf8');
}
