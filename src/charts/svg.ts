import type { LineSeries } from './types';

export const svgSparkline = (series: LineSeries[], w=320, h=80) => {
  const pad=6;
  const pts = series.flatMap(s=>s.points);
  if (!pts.length) return '';
  const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
  const [minX,maxX]=[Math.min(...xs), Math.max(...xs)]; const [minY,maxY]=[Math.min(...ys), Math.max(...ys)];
  const sx=(x:number)=> pad + (w-2*pad)*((x-minX)/(maxX-minX || 1));
  const sy=(y:number)=> h-pad - (h-2*pad)*((y-minY)/(maxY-minY || 1));
  const path=(ps:[number,number][])=> ps.map((p,i)=> (i?'L':'M')+sx(p[0]).toFixed(1)+','+sy(p[1]).toFixed(1)).join(' ');
  const d = series.map(s=>`<path d="${path(s.points)}" fill="none" stroke="currentColor" stroke-width="1.5"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${d}</svg>`;
};

export function tableForSeries(panel: { name: string; points: { t: string; v: number; unit?: string }[] }): string {
  const rows = panel.points.slice(-5).reverse().map(p => `<tr><td>${new Date(p.t).toLocaleDateString()}</td><td>${p.v}${p.unit?' '+p.unit:''}</td></tr>`).join('');
  return `<table class="hx-table hx-lab-table"><thead><tr><th>Date</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`;
}
