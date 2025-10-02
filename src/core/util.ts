export const ensureArray = <T>(x: T | T[] | undefined | null): T[] => Array.isArray(x) ? x : (x ? [x] : []);
export const esc = (s?: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
