import { useEffect, useCallback } from 'react';

interface ShortcutMap {
  [key: string]: () => void;
}

const useKeyboardShortcuts = (shortcuts: ShortcutMap) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger if user is typing in an input
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Still allow Escape and Enter
      if (event.key !== 'Escape' && event.key !== 'Enter') return;
    }

    const key = [
      event.ctrlKey || event.metaKey ? 'Ctrl' : '',
      event.shiftKey ? 'Shift' : '',
      event.altKey ? 'Alt' : '',
      event.key.length === 1 ? event.key.toUpperCase() : event.key,
    ].filter(Boolean).join('+');

    if (shortcuts[key]) {
      event.preventDefault();
      shortcuts[key]();
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

export const SHORTCUT_DESCRIPTIONS: Record<string, string> = {
  'Ctrl+N': 'New customer',
  'Ctrl+S': 'Save / Merge',
  'Delete': 'Delete selected',
  'F2': 'Rename file',
  'Escape': 'Close panel / Cancel',
  'Ctrl+F': 'Focus search',
};

export default useKeyboardShortcuts;
