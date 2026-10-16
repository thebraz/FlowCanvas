import { useEffect } from 'react';
import { useAppStore } from '../state/context';
import { applyTheme } from './theme';
export function ThemeControl() {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  useEffect(() => {
    const system = matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      applyTheme(theme);
    };
    update();
    system.addEventListener('change', update);
    return () => {
      system.removeEventListener('change', update);
    };
  }, [theme]);
  return (
    <div className="theme-control">
      <label htmlFor="theme">Theme</label>
      <select
        id="theme"
        value={theme}
        onChange={(event) => {
          const value = event.target.value;
          if (value !== 'system' && value !== 'dark' && value !== 'light') return;
          setTheme(value);
        }}
      >
        <option value="system">System</option>
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>
    </div>
  );
}
