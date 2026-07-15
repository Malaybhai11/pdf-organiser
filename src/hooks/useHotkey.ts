import { useEffect } from 'react';

type HotkeyHandler = (e: KeyboardEvent) => void;

const hotkeys = new Map<string, HotkeyHandler[]>();

export function useHotkey(key: string, handler: HotkeyHandler, deps: any[] = []) {
  useEffect(() => {
    const normalized = key.toLowerCase();
    if (!hotkeys.has(normalized)) {
      hotkeys.set(normalized, []);
    }
    hotkeys.get(normalized)!.push(handler);

    return () => {
      const handlers = hotkeys.get(normalized);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
        if (handlers.length === 0) hotkeys.delete(normalized);
      }
    };
  }, [key, ...deps]);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const handlers = hotkeys.get(e.key.toLowerCase());
      handlers?.forEach(h => h(e));
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}
