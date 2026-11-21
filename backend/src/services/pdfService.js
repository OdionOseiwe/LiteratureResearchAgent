import path from 'path';
import fs from 'fs';
import config from '../config/index.js';
import Research from '../models/Research.js';
import { buildReportHtml } from './reportTemplate.js';

/** Generate (or regenerate) the PDF for a completed job. Returns the absolute PDF path. */
export async function generatePdfForJob(jobId) {
  const job = await Research.findById(jobId);
  if (!job) throw new Error('Research job not found');
  if (!job.report) throw new Error('Report not generated yet; cannot render PDF');

  const html = buildReportHtml(job.report, job);
  const dir = config.pdfStoragePath;
  await fs.promises.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `report-${jobId}.pdf`);

  const puppeteer = (await import('puppeteer')).default;
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-size:7px;color:#64748b;padding:0 18mm;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif;">
        <span>${escapeAttr(job.report.title || 'Research Report').slice(0, 90)}</span>
        <span>page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`,
    });
  } finally {
    await browser.close();
  }

  job.pdfPath = filePath;
  job.pdfGeneratedAt = new Date();
  await job.save();
  return filePath;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Resolve the stored PDF path for a job, ensuring it lives inside the storage dir. */
export function resolvePdfPath(job) {
  if (!job?.pdfPath) return null;
  const resolved = path.resolve(job.pdfPath);
  const base = path.resolve(config.pdfStoragePath);
  if (!resolved.startsWith(base + path.sep)) return null; // path traversal guard
  return resolved;
}

export function deletePdfForJob(job) {
  const p = resolvePdfPath(job);
  if (p && fs.existsSync(p)) fs.unlinkSync(p);
}
