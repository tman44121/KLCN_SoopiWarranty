import { useLayoutEffect, useRef } from 'react';
import { initializePage, type Controller } from './runtime';

export function usePage(name: string, body: Record<string, string>, title: string, controller?: Controller) {
  const mounted = useRef(false);
  useLayoutEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    document.title = title;
    Object.entries(body).forEach(([key, value]) => document.body.setAttribute(key, value));
    void initializePage(name, controller).catch(() => {
      const error = document.createElement('div');
      error.className = 'auth-card__error';
      error.setAttribute('role', 'alert');
      error.textContent = 'Không thể tải trang. Vui lòng tải lại.';
      document.getElementById('root')?.prepend(error);
    });
  }, [name, body, title, controller]);
}
