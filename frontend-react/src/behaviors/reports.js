/* Reports page backed only by R5, R12 and R13. */
export default function initialize() {

  const api = window.LML_API;
  const ui = window.LML_UI;
  const fmt = window.LML_FMT;
  const el = {
    sla: document.querySelector("[data-sla-summary]"),
    performance: document.querySelector("[data-performance-tbody]"),
    audit: document.querySelector("[data-audit-tbody]"),
  };

  function percent(value) {
    return Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  }

  async function loadSla() {
    ui.blockState(el.sla, "loading");
    try {
      const rows = await api.reports.get("sla-distribution");
      const totals = rows.reduce(
        (sum, row) => ({
          breached: sum.breached + Number(row.breached || 0),
          atRisk: sum.atRisk + Number(row.atRisk || 0),
          onTrack: sum.onTrack + Number(row.onTrack || 0),
        }),
        { breached: 0, atRisk: 0, onTrack: 0 }
      );
      const total = totals.breached + totals.atRisk + totals.onTrack;
      if (!total) {
        ui.blockState(el.sla, "empty", { desc: "Chưa có phiếu đang mở để phân tích SLA." });
        return;
      }
      const onTrackPct = Math.round((totals.onTrack / total) * 100);
      const atRiskPct = Math.round((totals.atRisk / total) * 100);
      const breachedPct = 100 - onTrackPct - atRiskPct;
      el.sla.innerHTML = html`
        <div style="display:flex; height:10px; overflow:hidden; margin-bottom:16px;">
          <div style="width:${onTrackPct}%; background:var(--status-success-text);"></div>
          <div style="width:${atRiskPct}%; background:var(--status-warning-text);"></div>
          <div style="width:${breachedPct}%; background:var(--status-danger-text);"></div>
        </div>
        <div style="display:flex; gap:32px; flex-wrap:wrap;">
          ${summary("success", "Đúng hạn", totals.onTrack, onTrackPct)}
          ${summary("warning", "Sắp tới hạn", totals.atRisk, atRiskPct)}
          ${summary("danger", "Trễ hạn SLA", totals.breached, breachedPct)}
        </div>`;
    } catch (error) {
      ui.blockState(el.sla, "error", { desc: error.detail }, loadSla);
    }
  }

  function summary(tone, label, count, pct) {
    return html`<div>
      ${fmt.badge(tone, label)}
      <div class="metric-figure">${count}</div>
      <div class="cell-muted cell-muted--sm">phiếu (${pct}%)</div>
    </div>`;
  }

  async function loadPerformance() {
    ui.skeletonRows(el.performance, 6);
    try {
      const rows = await api.reports.get("technician-performance");
      if (!rows.length) {
        ui.tableState(el.performance, 6, "empty");
        return;
      }
      el.performance.innerHTML = html`${rows.map((row) => html`
        <tr>
          <td class="cell-primary">${row.fullName}</td>
          <td class="cell-muted">${row.specialty || "—"}</td>
          <td>${row.assigned}</td>
          <td>${row.completed}</td>
          <td>${row.avgRepairHours == null ? "—" : `${percent(row.avgRepairHours)}h`}</td>
          <td>${row.firstPassQcRate == null ? "—" : `${percent(row.firstPassQcRate)}%`}</td>
        </tr>`)}`;
    } catch (error) {
      ui.tableState(el.performance, 6, "error", { desc: error.detail }, loadPerformance);
    }
  }

  async function loadAudit() {
    ui.skeletonRows(el.audit, 6);
    try {
      const page = await api.reports.auditLogs({ page: 0, size: 25, sort: "at,desc" });
      if (!page.items.length) {
        ui.tableState(el.audit, 6, "empty");
        return;
      }
      el.audit.innerHTML = html`${page.items.map((entry) => html`
        <tr>
          <td class="cell-muted mono">${fmt.dateTime(entry.at)}</td>
          <td>${entry.actorName || entry.actorId}</td>
          <td class="cell-muted">${(entry.actorRoles || []).map((role) => window.LML_LABELS.ROLE[role] || role).join(", ")}</td>
          <td>${entry.actionLabel || entry.action}</td>
          <td class="cell-muted">${entry.before || "—"}</td>
          <td>${entry.after || "—"}</td>
        </tr>`)}`;
    } catch (error) {
      ui.tableState(el.audit, 6, "error", { desc: error.detail }, loadAudit);
    }
  }

  window.LML_AUTH.ready(() => {
    loadSla();
    loadPerformance();
    loadAudit();
  });
}
