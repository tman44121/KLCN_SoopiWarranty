import html from './behaviors/html.js';
import labels from './behaviors/labels.js';
import api from './behaviors/api.js';
import shell from './behaviors/shell.js';
import ui from './behaviors/ui.js';
import charts from './behaviors/charts.js';
import auth from './behaviors/auth.js';

const pages = import.meta.glob<{ default: () => unknown }>([
  './behaviors/*.js',
  '!./behaviors/{html,labels,api,shell,ui,charts,auth}.js',
], { eager: true });
// ponytail: eager controllers bind before paint; use Suspense for whole pages if
// the measured cost of this bundle later justifies loading pages separately.

export async function initializePage(name: string) {
  html(window);
  labels(window);
  api(window);
  const startShell = shell();
  ui(window);
  charts(window);
  const startAuth = !['login', 'portal', 'register'].includes(name) ? auth() : null;
  // ponytail: one document per page preserves existing DOM handlers; move handlers
  // into React state only if navigation must retain a mounted shell.
  // Bind handlers synchronously before paint: a late import allowed native GET
  // submission of the login form while its submit handler was still loading.
  const module = pages[`./behaviors/${name === 'portal' ? 'customer-portal' : name}.js`];
  // Trang khách (account, register) dựng bằng React state, không có controller DOM.
  const startPage = module?.default();
  startShell();
  if (typeof startPage === 'function') startPage();
  await startAuth?.();
}
