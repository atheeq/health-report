import type { IR } from './model';
import { listHandlers } from './registry';

export type CoverageReport = {
  fhirCounts: Record<string, number>;
  handledTypes: string[];
  unhandledTypes: string[];
};

export function coverageForIR(ir: IR): CoverageReport {
  const counts = ir.other?.fhirCounts ?? {};
  const handledSet = new Set(listHandlers());
  const present = Object.keys(counts);
  const handled = present.filter(t => handledSet.has(t));
  const unhandled = present.filter(t => !handledSet.has(t));
  return { fhirCounts: counts, handledTypes: handled.sort(), unhandledTypes: unhandled.sort() };
}

