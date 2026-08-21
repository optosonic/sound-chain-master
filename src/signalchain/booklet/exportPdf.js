import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { INFO_KEYS, PANEL_INFO } from '../infoContent.js';

/**
 * Generate the Booklet as a real, downloadable PDF with a navigable
 * outline (the PDF bookmark sidebar). The browser's "Save as PDF" cannot emit
 * an outline tree, so we render the booklet to images with html2canvas and lay
 * each section into a jsPDF, writing an outline bookmark for every section.
 *
 * Each top-level bookmark jumps to the first page its section starts on.
 * Run this while the Booklet is rendered in LIGHT mode for best print quality.
 */

const PDF_SECTIONS = [
  { id: 'cover', label: 'Introduction' },
  ...INFO_KEYS.map((id) => ({ id, label: PANEL_INFO[id].title })),
  { id: 'references', label: 'References' },
];

const pxToPt = 0.75; // CSS px @ 96dpi → PDF pt @ 72dpi

export async function exportBookletPdf({ onProgress } = {}) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  let started = false;

  for (let i = 0; i < PDF_SECTIONS.length; i++) {
    const sec = PDF_SECTIONS[i];
    const el = document.getElementById(sec.id);
    if (!el) continue;
    if (onProgress) onProgress(`Capturing ${sec.label}…`);

    // Yield to the browser so the light-theme repaint is flushed before capture.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    // Measure block positions from the html2canvas CLONE — its layout is the
    // exact render that produces the canvas, so the coordinates line up
    // pixel-for-pixel regardless of viewport/reflow quirks.
    let cloneData = null;
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      onclone: (doc) => {
        const cSec = doc.getElementById(sec.id);
        if (!cSec) return;
        const cSecRect = cSec.getBoundingClientRect();
        const cBlocks = [...cSec.querySelectorAll('[data-atomic]')].filter(
          (e) => !e.parentElement?.closest?.('[data-atomic]')
        );
        cloneData = {
          secWidth: cSecRect.width,
          rects: cBlocks.map((b) => {
            const r = b.getBoundingClientRect();
            return {
              top: r.top - cSecRect.top,
              bottom: r.bottom - cSecRect.top,
              keepNext: b.hasAttribute('data-keep-next'),
            };
          }),
        };
      },
    });
    if (!cloneData) continue;

    // Each CSS px in the canvas maps to pxToPt pt on the page.
    const imgW = canvas.width * pxToPt;
    // Fit the section width into the printable area (page minus margins).
    const margin = 34; // ~0.47in on every side
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;
    const scale = usableW / imgW;
    const drawW = imgW * scale;

    // Paginate at atomic-block boundaries so a panel is never sliced in half.
    // Each [data-atomic] element is an unbreakable unit; [data-keep-next]
    // glues a heading to the block that follows it.
    const pageStripPx = Math.floor(usableH / (pxToPt * scale)); // printable height in canvas px
    // clone rects are in clone-CSS px; scale them to canvas px.
    const factor = canvas.width / Math.max(1, cloneData.secWidth);
    const rects = cloneData.rects
      .map((r) => ({ top: r.top * factor, bottom: r.bottom * factor, keepNext: r.keepNext }))
      .filter((r) => r.bottom > 0 && r.top < canvas.height);

    // Group keep-next headings with their following block(s).
    const groups = [];
    for (let k = 0; k < rects.length; k++) {
      let m = k;
      let bottom = rects[k].bottom;
      while (rects[m].keepNext && m + 1 < rects.length) {
        m++;
        bottom = rects[m].bottom;
      }
      groups.push({ top: rects[k].top, bottom });
      k = m;
    }

    // Build the page breaks: fill each page with as many whole groups as fit;
    // a group that does not fit starts a fresh page (unless it is taller than a
    // full page, in which case it is sliced — unavoidable for oversized content).
    const pages = [];
    let cursor = 0;
    let gi = 0;
    while (cursor < canvas.height) {
      let bottom = cursor;
      while (gi < groups.length) {
        const g = groups[gi];
        if (g.bottom <= cursor + pageStripPx) {
          bottom = g.bottom;
          gi++;
        } else {
          const gH = g.bottom - g.top;
          if (gH <= pageStripPx) {
            if (bottom > cursor) break;            // placed some → push group to next page
            if (g.top > cursor) { bottom = g.top; break; } // empty page → leave gap here, group next page
          }
          // group taller than a full page (unavoidable) → slice
          bottom = Math.min(canvas.height, cursor + pageStripPx);
          break;
        }
      }
      if (bottom <= cursor) bottom = Math.min(canvas.height, cursor + pageStripPx);
      pages.push({ top: cursor, bottom });
      cursor = bottom;
      if (gi >= groups.length && cursor >= canvas.height) break;
    }

    let sectionFirst = true;
    for (const page of pages) {
      const stripH = page.bottom - page.top;
      if (stripH <= 1) continue;
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = stripH;
      const ctx = slice.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, page.top, canvas.width, stripH, 0, 0, canvas.width, stripH);

      if (started) pdf.addPage();
      started = true;
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageW, pageH, 'F');
      const pageNo = pdf.internal.getNumberOfPages();
      if (sectionFirst) {
        pdf.outline.add(null, sec.label, { pageNumber: pageNo });
        sectionFirst = false;
      }
      const sliceDrawH = stripH * pxToPt * scale;
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, drawW, sliceDrawH);
    }
  }

  if (onProgress) onProgress('Saving PDF…');
  pdf.save('Sound Chain Master — Booklet.pdf');
}