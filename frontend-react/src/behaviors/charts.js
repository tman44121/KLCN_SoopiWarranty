/* ==========================================================================
   Biểu đồ báo cáo — HTML/CSS thuần, không thư viện ngoài (CSP chỉ cho script 'self').
   - columns(): cột theo thời gian (một chuỗi), trục Y làm tròn, nhãn giá trị chỉ ở cột cao nhất và cột cuối.
   - bars(): thanh ngang so sánh độ lớn (một chuỗi, một màu), giá trị ở đầu thanh.
   - split(): một thanh 100% cho tỷ lệ hai-ba phần, kèm chú giải có số liệu.
   - stats(): hàng ô số liệu tổng.
   Mỗi biểu đồ có bảng số liệu tương đương (<details>) và tooltip hiện cả khi di chuột lẫn khi focus bằng
   bàn phím; cả biểu đồ là một điểm dừng Tab, phím mũi tên chuyển giữa các cột/thanh.
   ========================================================================== */

export default function initialize(global = window) {

  const html = global.html;
  const MARK = "[data-chart-mark]";
  let tooltip = null;

  function number(value, digits = 1) {
    return Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: digits });
  }

  /** Số gọn cho trục: 1,5 tỷ · 2,2 tr · 850 k. */
  function compact(value) {
    const abs = Math.abs(value);
    if (abs >= 1e9) return `${number(value / 1e9)} tỷ`;
    if (abs >= 1e6) return `${number(value / 1e6)} tr`;
    if (abs >= 1e3) return `${number(value / 1e3)} k`;
    return number(value);
  }

  /** Trục từ 0 với 4 khoảng tròn (1 · 2 · 2,5 · 5 × 10^n). */
  function niceTicks(max) {
    if (!(max > 0)) return [0, 1, 2, 3, 4];
    const raw = max / 4;
    const power = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((candidate) => candidate >= raw);
    return [0, 1, 2, 3, 4].map((i) => i * step);
  }

  function dataTable(caption, headers, rows) {
    return html`
      <details class="chart-data">
        <summary>Xem số liệu dạng bảng</summary>
        <div class="table-scroll">
          <table class="data-table">
            <caption class="visually-hidden">${caption}</caption>
            <thead><tr>${headers.map((header) => html`<th scope="col">${header}</th>`)}</tr></thead>
            <tbody>${rows.map((cells) => html`<tr>${cells.map((cell) => html`<td>${cell}</td>`)}</tr>`)}</tbody>
          </table>
        </div>
      </details>`;
  }

  function mark(label, display, series, extraClass) {
    return html`class="${extraClass}" data-chart-mark tabindex="-1" role="img" aria-label="${label}: ${display}"
      data-tip-label="${label}" data-tip-value="${display}" data-tip-series="${series || ""}"`;
  }

  /* ---------------------------------------------------------------- tooltip */

  function ensureTooltip() {
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip";
    tooltip.setAttribute("role", "presentation");
    tooltip.hidden = true;
    const value = document.createElement("div");
    value.className = "chart-tooltip__value";
    const label = document.createElement("div");
    label.className = "chart-tooltip__label";
    tooltip.append(value, label);
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function showTooltip(target) {
    const tip = ensureTooltip();
    const [value, label] = tip.children;
    // Nhãn đến từ dữ liệu API: gán bằng textContent, không qua innerHTML.
    value.textContent = target.getAttribute("data-tip-value");
    label.textContent = target.getAttribute("data-tip-label");
    label.setAttribute("data-series", target.getAttribute("data-tip-series") || "");
    tip.hidden = false;
    const anchor = (target.querySelector("[data-tip-anchor]") || target).getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    const x = Math.min(Math.max(anchor.left + anchor.width / 2, box.width / 2 + 8), window.innerWidth - box.width / 2 - 8);
    const above = anchor.top - box.height - 8;
    tip.style.left = `${x}px`;
    tip.style.top = `${above < 72 ? anchor.bottom + 8 : above}px`;
  }

  function hideTooltip() {
    if (tooltip) tooltip.hidden = true;
  }

  /** Gắn hover/focus/phím mũi tên một lần cho mỗi vùng chứa biểu đồ (ủy quyền sự kiện). */
  function bind(container) {
    if (container.hasAttribute("data-chart-bound")) return;
    container.setAttribute("data-chart-bound", "");
    container.addEventListener("pointerover", (event) => {
      const target = event.target.closest(MARK);
      if (target) showTooltip(target);
    });
    container.addEventListener("pointerleave", hideTooltip);
    container.addEventListener("focusin", (event) => {
      const target = event.target.closest(MARK);
      if (target) showTooltip(target);
    });
    container.addEventListener("focusout", hideTooltip);
    container.addEventListener("keydown", (event) => {
      const current = event.target.closest(MARK);
      if (!current) return;
      const marks = Array.from(current.closest("[data-chart]").querySelectorAll(MARK));
      const index = marks.indexOf(current);
      const next = {
        ArrowRight: index + 1,
        ArrowDown: index + 1,
        ArrowLeft: index - 1,
        ArrowUp: index - 1,
        Home: 0,
        End: marks.length - 1,
      }[event.key];
      if (next === undefined) {
        if (event.key === "Escape") hideTooltip();
        return;
      }
      event.preventDefault();
      const target = marks[(next + marks.length) % marks.length];
      current.tabIndex = -1;
      target.tabIndex = 0;
      target.focus();
    });
  }

  /** Cả biểu đồ là một điểm dừng Tab: mark đầu tiên nhận tabindex 0. */
  function render(container, content) {
    hideTooltip();
    container.innerHTML = html`${content}`;
    container.querySelectorAll("[data-chart]").forEach((chart) => {
      const first = chart.querySelector(MARK);
      if (first) first.tabIndex = 0;
    });
    bind(container);
  }

  /* ---------------------------------------------------------------- forms */

  /** rows: [{ label, value, display }] theo thứ tự thời gian. */
  function columns(container, { title, rows, axis = compact, headers }) {
    const max = Math.max(0, ...rows.map((row) => row.value));
    const ticks = niceTicks(max);
    const top = ticks[ticks.length - 1];
    const peak = rows.findIndex((row) => row.value === max && max > 0);
    const labelled = new Set([peak, rows.length - 1].filter((i) => i >= 0 && rows[i].value > 0));
    render(container, html`
      <div class="chart-columns" data-chart role="group" aria-label="${title}">
        <div class="chart-columns__plot">
          ${ticks.map((tick) => html`
            <div class="chart-columns__grid" style="bottom:${(tick / top) * 100}%">
              <span class="chart-columns__tick">${axis(tick)}</span>
            </div>`)}
          <div class="chart-columns__slots" style="--count:${rows.length}">
            ${rows.map((row, i) => html`
              <div ${mark(row.label, row.display, "", "chart-columns__slot")}>
                <div class="chart-columns__bar" data-tip-anchor style="height:${(row.value / top) * 100}%">
                  ${labelled.has(i) ? html`<span class="chart-columns__value">${axis(row.value)}</span>` : ""}
                </div>
              </div>`)}
          </div>
        </div>
        <div class="chart-columns__labels" style="--count:${rows.length}" aria-hidden="true">
          ${rows.map((row) => html`<span>${row.label}</span>`)}
        </div>
      </div>
      ${dataTable(title, headers, rows.map((row) => row.cells || [row.label, row.display]))}`);
  }

  /** rows: [{ label, value, display }] — một chuỗi, cùng một màu. */
  function bars(container, { title, rows, headers }) {
    const max = Math.max(0, ...rows.map((row) => row.value));
    render(container, html`
      <div class="chart-bars" data-chart role="group" aria-label="${title}">
        ${rows.map((row) => html`
          <div ${mark(row.label, row.display, "", "chart-bars__row")}>
            <span class="chart-bars__label">${row.label}</span>
            <span class="chart-bars__track">
              <span class="chart-bars__bar" data-tip-anchor style="--p:${max > 0 ? row.value / max : 0}"></span>
              <span class="chart-bars__value">${row.display}</span>
            </span>
          </div>`)}
      </div>
      ${dataTable(title, headers, rows.map((row) => row.cells || [row.label, row.display]))}`);
  }

  /** parts: [{ label, value, display }] — tối đa 3 phần, màu theo thứ tự cố định series 1, 2, 3. */
  function split(container, { title, parts, headers }) {
    const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
    const share = (part) => `${number((part.value / total) * 100)}%`;
    render(container, html`
      <div class="chart-split" data-chart role="group" aria-label="${title}">
        <div class="chart-split__bar">
          ${parts.filter((part) => part.value > 0).map((part) => html`
            <span ${mark(part.label, `${part.display} · ${share(part)}`, parts.indexOf(part) + 1,
              `chart-split__segment chart-split__segment--${parts.indexOf(part) + 1}`)} style="flex-grow:${part.value}"></span>`)}
        </div>
        <ul class="chart-legend">
          ${parts.map((part, i) => html`
            <li class="chart-legend__item">
              <span class="chart-legend__key chart-legend__key--${i + 1}" aria-hidden="true"></span>
              <span class="chart-legend__label">${part.label}</span>
              <span class="chart-legend__value">${part.display} · ${share(part)}</span>
            </li>`)}
        </ul>
      </div>
      ${dataTable(title, headers, parts.map((part) => [part.label, part.display, share(part)]))}`);
  }

  /** tiles: [{ label, value, meta }] */
  function stats(container, tiles) {
    container.innerHTML = html`${tiles.map((tile) => html`
      <div class="stat-tile">
        <div class="stat-tile__label">${tile.label}</div>
        <div class="stat-tile__value">${tile.value}</div>
        <div class="stat-tile__meta">${tile.meta}</div>
      </div>`)}`;
  }

  global.LML_CHARTS = { columns, bars, split, stats, compact, number };
}
