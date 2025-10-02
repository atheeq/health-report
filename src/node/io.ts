import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

async function readNdjson(file: string): Promise<any[]> {
  const text = await readFile(file, 'utf8');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: any[] = [];
  for (const ln of lines) {
    try {
      const obj = JSON.parse(ln);
      if (obj && obj.resourceType) out.push(obj);
    } catch {}
  }
  return out;
}

export async function collectFhirResourcesFromDir(dir: string): Promise<any[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const resources: any[] = [];
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) {
      resources.push(...(await collectFhirResourcesFromDir(full)));
      continue;
    }
    const ext = extname(e.name).toLowerCase();
    if (ext === '.json' || ext === '.ndjson') {
      const raw = await readFile(full, 'utf8');
      try {
        if (ext === '.ndjson') {
          resources.push(...(await readNdjson(full)));
        } else {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const r of parsed) if (r && r.resourceType) resources.push(r);
          } else if (parsed?.resourceType === 'Bundle') {
            for (const e of parsed.entry || []) if (e?.resource?.resourceType) resources.push(e.resource);
          } else if (parsed?.resourceType) {
            resources.push(parsed);
          }
        }
      } catch {}
    }
  }
  return resources;
}

export async function loadFhirFromPath(path: string): Promise<any | any[]> {
  const st = await stat(path);
  if (st.isDirectory()) return await collectFhirResourcesFromDir(path);
  const ext = extname(path).toLowerCase();
  if (ext === '.ndjson') return await readNdjson(path);
  const raw = await readFile(path, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    // allow raw XML (CCDA) pass-through
    return raw;
  }
}

