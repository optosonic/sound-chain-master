import React, { useEffect, useState } from 'react';
import { List, ChevronDown } from 'lucide-react';

/**
 * Booklet table-of-contents navigator.
 *  - Desktop (lg+): a sticky left sidebar with active-section highlighting.
 *  - Mobile: a collapsible "Contents" panel above the content.
 * Clicking an item smooth-scrolls to the section (anchors are the `id`s on the
 * booklet's section wrappers). Active tracking uses an IntersectionObserver
 * keyed to the top ~35% of the viewport. The whole component is `.bk-no-print`
 * so it never appears in the PDF; a separate print-only Contents page lives in
 * the booklet flow for that.
 */
export default function BookletNav({ items, isDark }) {
  const [active, setActive] = useState(items[0]?.id || '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const els = items.map((it) => document.getElementById(it.id)).filter(Boolean);
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: '-96px 0px -65% 0px', threshold: [0, 0.2, 0.5, 1] }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [items]);

  const go = (id) => {
    setOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const muted = isDark ? '#94a3b8' : '#475569';
  const activeColor = isDark ? '#e2e8f0' : '#0f172a';
  const border = isDark ? 'rgba(255,255,255,0.10)' : '#e2e8f0';
  const bg = isDark ? 'rgba(255,255,255,0.03)' : '#ffffff';

  const Item = ({ it }) => (
    <button
      onClick={() => go(it.id)}
      className="w-full text-left text-[12px] leading-snug transition-colors"
      style={{
        color: active === it.id ? activeColor : muted,
        fontWeight: active === it.id ? 600 : 400,
        padding: '4px 10px 4px 12px',
        borderLeft: `2px solid ${active === it.id ? '#38e0ff' : 'transparent'}`,
      }}
    >
      {it.label}
    </button>
  );

  return (
    <>
      <aside className="bk-no-print hidden w-56 shrink-0 lg:block">
        <div
          className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border p-3"
          style={{ borderColor: border, background: bg }}
        >
          <div className="mb-2 px-2 text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
            Contents
          </div>
          <nav className="space-y-0.5">
            {items.map((it) => <Item key={it.id} it={it} />)}
          </nav>
        </div>
      </aside>

      <div className="bk-no-print mb-4 lg:hidden">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-[12px] font-semibold"
          style={{ borderColor: border, background: bg, color: activeColor }}
        >
          <span className="flex items-center gap-2"><List className="h-4 w-4" /> Contents</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <nav className="mt-2 space-y-0.5 rounded-lg border p-2" style={{ borderColor: border, background: bg }}>
            {items.map((it) => <Item key={it.id} it={it} />)}
          </nav>
        )}
      </div>
    </>
  );
}