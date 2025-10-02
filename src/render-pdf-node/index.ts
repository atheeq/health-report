import { renderHtml, type RenderOptions } from '../render-html/index';

export async function renderPdfNode(input: object|string, opts: RenderOptions & {
  pdf?: { format?: 'A4'|'Letter'; margin?: string; headerTemplate?: string; footerTemplate?: string }
} = {}): Promise<Buffer> {
  const html = await renderHtml(input, opts);
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      printBackground: true,
      format: opts.pdf?.format ?? 'A4',
      margin: opts.pdf?.margin ? { top: opts.pdf.margin, bottom: opts.pdf.margin, left: opts.pdf.margin, right: opts.pdf.margin } : undefined,
      headerTemplate: opts.pdf?.headerTemplate,
      footerTemplate: opts.pdf?.footerTemplate,
      displayHeaderFooter: Boolean(opts.pdf?.headerTemplate || opts.pdf?.footerTemplate)
    });
    return pdf as Buffer;
  } finally {
    await browser.close();
  }
}
