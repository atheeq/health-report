import type { IR } from './model';
import { parseFhir } from './parse-fhir';
import { parseCcda } from './parse-ccda';

export type Input = object | string | any[];

function isBundle(obj: any): boolean {
  return Boolean(obj && typeof obj === 'object' && obj.resourceType === 'Bundle');
}

function bundleFromResources(resources: any[]): any {
  const entry = (resources || [])
    .filter((r) => r && typeof r === 'object' && typeof r.resourceType === 'string')
    .map((resource) => ({ resource }));
  return { resourceType: 'Bundle', type: 'collection', entry };
}

function maybeFlattenPerTypeObject(obj: any): any[] | null {
  if (!obj || typeof obj !== 'object' || isBundle(obj)) return null;
  const resources: any[] = [];
  let found = false;
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) {
      found = true;
      for (const item of v) if (item && typeof item === 'object' && item.resourceType) resources.push(item);
    }
  }
  return found ? resources : null;
}

export async function toIR(input: Input): Promise<IR> {
  if (typeof input === 'string') return await parseCcda(input);

  // Array of FHIR resources
  if (Array.isArray(input)) {
    const bundle = bundleFromResources(input);
    return parseFhir(bundle);
  }

  const obj = input as any;
  if (isBundle(obj)) return parseFhir(obj);

  // Object with per-type arrays: { Patient: [...], Observation: [...], ... }
  const flattened = maybeFlattenPerTypeObject(obj);
  if (flattened) return parseFhir(bundleFromResources(flattened));

  throw new Error('Unsupported input: pass a FHIR Bundle object, an array/object of FHIR resources, or a CCDA XML string.');
}

export { bundleFromResources };
