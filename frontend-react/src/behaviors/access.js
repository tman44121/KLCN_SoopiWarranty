/** Server counts visits by the signed login session; reloads and tabs never increment a browser-side counter. */
export default function startAccess(global = window) {
  const api = global.LML_API;
  const doc = global.document;
  let stopped = false, busy = false, repaired = false;
  async function heartbeat() {
    if (stopped || busy || doc.hidden || global.navigator?.onLine === false) return;
    busy = true;
    try {
      const result = await api.post('/access/heartbeat', undefined, { redirect: false });
      if (result?.tracked === false && !repaired && !stopped) {
        repaired = true;
        await api.refresh();
        if (!stopped && !doc.hidden) await api.post('/access/heartbeat', undefined, { redirect: false });
      }
    } catch {
      // Optional presence must not interrupt a customer's form when connectivity is lost.
    } finally { busy = false; }
  }
  const visible = () => { if (!doc.hidden) void heartbeat(); };
  doc.addEventListener('visibilitychange', visible);
  global.addEventListener('online', visible);
  const timer = global.setInterval(heartbeat, 30000);
  void heartbeat();
  return () => {
    stopped = true;
    global.clearInterval(timer);
    doc.removeEventListener('visibilitychange', visible);
    global.removeEventListener('online', visible);
  };
}
