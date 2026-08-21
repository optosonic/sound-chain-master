import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer, Sun, Moon, Download } from 'lucide-react';
import { BookletTree, BOOKLET_NAV_ITEMS } from '@/signalchain/booklet/BookletContent.jsx';
import BookletNav from '@/signalchain/booklet/BookletNav.jsx';

/**
 * /booklet — a readable, printable web version of the educational booklet.
 * A left TOC sidebar gives quick navigation; a Dark / Light toggle switches
 * the on-screen theme; printing always forces the light theme (via the print
 * stylesheet) and includes a print-only Contents page, so the PDF gets an index.
 */
export default function Booklet() {
  const [mode, setMode] = useState('dark');
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const isDark = mode === 'dark';

  const handleExportPdf = async () => {
    const prev = mode;
    setMode('light');
    setExporting(true);
    setExportMsg('Preparing…');
    try {
      // Flush the light-theme repaint before capturing.
      await new Promise((r) => setTimeout(r, 60));
      const { exportBookletPdf } = await import('@/signalchain/booklet/exportPdf.js');
      await exportBookletPdf({ onProgress: setExportMsg });
    } catch (e) {
      console.error(e);
      alert('Sorry, the bookmarked PDF could not be generated: ' + (e?.message || e));
    } finally {
      setExporting(false);
      setExportMsg('');
      setMode(prev);
    }
  };

  const btnStyle = {
    borderColor: isDark ? 'rgba(255,255,255,0.20)' : '#cbd5e1',
    background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
    color: isDark ? '#e2e8f0' : '#334155',
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: isDark ? '#070b13' : '#f1f5f9', color: isDark ? '#cbd5e1' : '#334155' }}
    >
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          .bk-no-print { display: none !important; }
          .bk-print-only { display: block !important; }
          .bk-root {
            --bk-bg:#ffffff !important; --bk-surface:#f8fafc !important; --bk-surface-2:#ffffff !important;
            --bk-surface-strong:#f1f5f9 !important; --bk-border:#e2e8f0 !important; --bk-border-strong:#cbd5e1 !important;
            --bk-text:#334155 !important; --bk-heading:#0f172a !important; --bk-muted:#475569 !important;
            --bk-faint:#64748b !important; --bk-code:#0e7490 !important;
            --bk-plate:linear-gradient(120deg,#ffffff,#f8fafc 45%,#eef2f7) !important;
            --bk-plate-border:#cbd5e1 !important; --bk-title:#0f172a !important; --bk-eyebrow:#64748b !important;
            background:var(--bk-bg) !important; color:var(--bk-text) !important;
          }
          .bk-root, .bk-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          [data-atomic] { break-inside: avoid; }
          [data-keep-next] { break-after: avoid; }
          .bk-web-wrap { max-width: none !important; padding: 0 !important; }
          .bk-web-root { padding: 0 !important; border: 0 !important; box-shadow: none !important; }
          body { background: #ffffff !important; }
          @page { @bottom-right { content: counter(page) " / " counter(pages); } }
        }
      `}</style>

      <div
        className="bk-no-print sticky top-0 z-20 border-b backdrop-blur"
        style={{
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#e2e8f0',
          background: isDark ? 'rgba(10,15,26,0.9)' : 'rgba(255,255,255,0.9)',
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs font-mono transition-colors"
            style={{ color: isDark ? '#cbd5e1' : '#475569' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to app
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-mono font-semibold transition-all hover:opacity-80"
              style={btnStyle}
              title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {isDark ? 'Light' : 'Dark'}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-mono font-semibold transition-all hover:opacity-80"
              style={btnStyle}
              title="Print or Save as PDF (uses the light theme)"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-mono font-semibold transition-all hover:opacity-80 disabled:cursor-wait disabled:opacity-50"
              style={{ ...btnStyle, borderColor: '#0891b2', color: '#0891b2' }}
              title="Download a PDF with a navigable bookmark sidebar"
            >
              <Download className="h-3.5 w-3.5" /> {exporting ? 'Rendering…' : 'PDF'}
            </button>
          </div>
        </div>
      </div>

      {exporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="flex items-center gap-3 rounded-xl border px-5 py-3 text-[12px] font-mono"
            style={{ background: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1' }}
          >
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-600" />
            {exportMsg || 'Preparing…'}
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:flex-row">
        <BookletNav items={BOOKLET_NAV_ITEMS} isDark={isDark} />
        <div className="bk-web-wrap min-w-0 flex-1">
          <div
            className="bk-web-root overflow-hidden rounded-2xl border"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#e2e8f0',
              boxShadow: isDark ? '0 18px 60px rgba(0,0,0,0.5)' : '0 18px 60px rgba(15,23,42,0.08)',
            }}
          >
            <BookletTree mode={mode} />
          </div>
          <div className="bk-no-print mt-8 text-center text-[11px] font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
            Spher8 · SCM — Sound Chain Master ·{' '}
            <a
              className="transition-colors"
              style={{ color: isDark ? '#94a3b8' : '#64748b' }}
              href="https://scm.spher8.com"
              target="_blank"
              rel="noreferrer"
            >
              scm.spher8.com
            </a>
            {' '}· © 2026 Ivan Zavada
          </div>
        </div>
      </div>
    </div>
  );
}