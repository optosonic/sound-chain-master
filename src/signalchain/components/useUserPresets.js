import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useUserPresets — fetches the current user's saved Preset records and keeps
 * them fresh whenever a preset is saved or deleted. PresetDropdown dispatches
 * a `scm-preset-change` window event on every save/delete; this hook listens
 * for it (plus window focus) so the factory preset bar stays in sync without a
 * reload. Returns [] when logged out.
 */
export function useUserPresets() {
  const [presets, setPresets] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) { setPresets([]); return; }
      const items = await base44.entities.Preset.filter({}, '-updated_date', 100);
      setPresets(items || []);
    } catch {
      setPresets([]);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('scm-preset-change', handler);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('scm-preset-change', handler);
      window.removeEventListener('focus', handler);
    };
  }, [refresh]);

  return presets;
}

/**
 * toLaneEntry — map a saved Preset record into the factory-lane shape so the
 * preset bar can render it (name / metadata) and apply it via
 * engine.applyState (its full captured chain state) instead of applyRecipe.
 */
export function toLaneEntry(p) {
  return {
    name: p.name,
    medium: 'album',
    style: 'medium',
    targetLufs: -14,
    author: 'You',
    info: 'Your saved preset — full signal-chain snapshot.',
    recipe: null,
    userState: p.state,
    isUser: true,
  };
}