import { renderHtml, type RenderOptions } from '../render-html/index';

export async function renderPdfBrowser(input: object|string, opts: RenderOptions = {}): Promise<void> {
  const html = await renderHtml(input, opts);
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position:'fixed', right:'0', bottom:'0', width:'0', height:'0', border:'0' });
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  iframe.onload = () => { iframe.contentWindow!.focus(); iframe.contentWindow!.print(); };
}
