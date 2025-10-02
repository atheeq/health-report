import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, '..');
  const [pathArg] = process.argv.slice(2);
  const defaultPath = resolve(
    root,
    'node_modules/bluebutton/_site/bower_components/sample_ccdas/Allscripts Samples/Sunrise Clinical Manager/C-CDA_101646_20130617114506_Everyman_Adam.xml'
  );
  const xmlPath = pathArg || defaultPath;

  try {
    const xml = await readFile(xmlPath, 'utf8');
    const { renderHtml } = await import(resolve(root, 'dist/esm/index.js'));
    const html = await renderHtml(xml, { hiddenSections: ['other', 'financial', 'privacy'] });
    if (typeof html === 'string' && html.length > 100) {
      console.log('✅ CCDA smoke OK for', xmlPath);
      process.exit(0);
    }
    console.error('❌ CCDA smoke produced empty/short HTML');
    process.exit(2);
  } catch (err) {
    console.error('❌ CCDA smoke failed:', err?.message || err);
    process.exit(1);
  }
}

main();

