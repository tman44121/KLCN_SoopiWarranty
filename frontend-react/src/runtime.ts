import html from './behaviors/html.js';
import labels from './behaviors/labels.js';
import api from './behaviors/api.js';
import shell from './behaviors/shell.js';
import ui from './behaviors/ui.js';
import charts from './behaviors/charts.js';
import auth from './behaviors/auth.js';

/** Controller DOM của một trang; có thể trả về hàm chạy sau khi shell sẵn sàng. */
export type Controller = () => unknown;

export async function initializePage(name: string, controller?: Controller) {
  html();
  labels();
  api();
  const startShell = shell();
  ui();
  charts();
  const startAuth = !['home', 'login', 'portal', 'register', 'forgot-password'].includes(name) ? auth() : null;
  // ponytail: one document per page preserves existing DOM handlers; move handlers
  // into React state only if navigation must retain a mounted shell.
  // Controller đi cùng chunk của trang (import tĩnh trong pages/*.tsx) nên đã có sẵn khi trang render:
  // gắn đồng bộ trước paint, form đăng nhập không bao giờ submit GET khi chưa có handler.
  // Trang khách (home, account, register) dựng bằng React state, không có controller DOM.
  const startPage = controller?.();
  startShell();
  if (typeof startPage === 'function') startPage();
  await startAuth?.();
}
