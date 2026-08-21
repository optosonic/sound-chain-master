import React, { useState, useEffect, useCallback } from 'react';
import { Bookmark, Save, Trash2, ChevronDown, ChevronUp, LogIn, Check, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * PresetDropdown — save / load / delete full-app-state presets, stored in the
 * `Preset` entity (owner-only). Lives inside the Mastering panel. A preset
 * captures the entire signal chain: every module's params, on/off state,
 * signal-chain order, parallel-loop config, routing, BPM, layout and meters.
 *
 * Saving requires login (presets are per-user). When logged out the dropdown
 * shows a "Log in to save presets" call-to-action instead of the list.
 */
export default function PresetDropdown({ engine, accent = '#f59e0b' }) {
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(null); // null = checking, false, true
  const [presets, setPresets] = useState([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const checkAuth = useCallback(async () => {
    try { setAuthed(await base44.auth.isAuthenticated()); } catch { setAuthed(false); }
  }, []);
  useEffect(() => { checkAuth(); }, [checkAuth]);

  const refresh = useCallback(async () => {
    setBusy(true); setMsg('');
    try {
      const items = await base44.entities.Preset.filter({}, '-updated_date', 100);
      setPresets(items || []);
    } catch (e) { setMsg('Could not load presets'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { if (open && authed) refresh(); }, [open, authed, refresh]);

  const save = async () => {
    const n = name.trim();
    if (!n) { setMsg('Enter a name first'); return; }
    setBusy(true); setMsg('');
    try {
      const rec = await base44.entities.Preset.create({
        name: n,
        category: 'mastering',
        state: engine.captureState(),
      });
      setPresets((p) => [rec, ...p]);
      setName('');
      setMsg('Saved');
      window.dispatchEvent(new Event('scm-preset-change'));
    } catch (e) { setMsg('Save failed: ' + (e?.message || e)); }
    finally { setBusy(false); }
  };

  const apply = (p) => {
    try { engine.applyState(p.state); setMsg('Loaded "' + p.name + '"'); }
    catch { setMsg('Load failed'); }
  };

  const remove = async (p) => {
    setBusy(true);
    try { await base44.entities.Preset.delete(p.id); setPresets((arr) => arr.filter((x) => x.id !== p.id)); window.dispatchEvent(new Event('scm-preset-change')); }
    catch (e) { setMsg('Delete failed'); }
    finally { setBusy(false); }
  };

  const login = () => {
    const next = window.location.pathname + window.location.search;
    base44.auth.redirectToLogin?.(next);
  };

  const iconBtn = (onClick, title, Icon, color) => (
    <button onClick={onClick} title={title} className="flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/15 hover:text-white">
      <Icon className="h-3.5 w-3.5" style={color ? { color } : undefined} />
    </button>
  );

  return (
    <div className="rounded-lg border border-white/15 bg-black/40 p-2">
      <div className="flex items-center gap-2">
        <Bookmark className="h-4 w-4" style={{ color: accent }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/85">Presets</span>
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-white/75 transition hover:bg-white/15">
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {open ? 'Close' : `${presets.length || ''}`}
        </button>
        <span className="ml-auto text-[9px] text-white/40">saves the full signal chain</span>
      </div>

      {open && (
        <div className="mt-2 border-t border-white/10 pt-2">
          {authed === false ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-[11px] text-white/70">Log in to save & load your presets</span>
              <button onClick={login} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold text-black" style={{ background: accent }}>
                <LogIn className="h-3.5 w-3.5" /> Log in
              </button>
            </div>
          ) : authed === null ? (
            <div className="flex items-center gap-2 px-2 py-3 text-[11px] text-white/50"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking session…</div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                  placeholder="Preset name…"
                  className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/50 px-2.5 py-1.5 text-[11px] text-white outline-none placeholder:text-white/30 focus:border-white/35"
                />
                <button onClick={save} disabled={busy} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold text-black transition disabled:opacity-50" style={{ background: accent }}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                </button>
              </div>

              {msg && <div className="mt-1.5 flex items-center gap-1 text-[10px] text-white/55"><Check className="h-3 w-3" style={{ color: accent }} />{msg}</div>}

              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto pr-1">
                {presets.length === 0 && !busy && (
                  <div className="px-2 py-3 text-center text-[11px] text-white/40">No presets yet — save your current chain above.</div>
                )}
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-[11px] text-white/85" title={p.name}>{p.name}</span>
                    <span className="shrink-0 text-[9px] font-mono text-white/35">{p.updated_date ? new Date(p.updated_date).toLocaleDateString() : ''}</span>
                    {iconBtn(() => apply(p), 'Load preset', Check, accent)}
                    {iconBtn(() => remove(p), 'Delete preset', Trash2, '#fb7185')}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}