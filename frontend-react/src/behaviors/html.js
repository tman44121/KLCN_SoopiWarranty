/* ==========================================================================
   Dựng HTML an toàn — CODEX mục 15.2 / 9.9
   Dữ liệu giờ đến từ người dùng thật nên MỌI giá trị chèn vào innerHTML phải
   được escape. Dùng tagged template html`...`: giá trị nội suy tự escape,
   trừ khi chính nó là kết quả của html`...` (đã an toàn) hoặc mảng các kết
   quả đó. Gán thẳng vào innerHTML: el.innerHTML = html`<td>${value}</td>`.
   ========================================================================== */

export default function initialize(global = window) {

  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/[&<>"'`]/g, (ch) => ESCAPES[ch]);
  }

  class SafeHtml {
    constructor(value) {
      this.value = value;
    }
    toString() {
      return this.value;
    }
  }

  function render(value) {
    if (value instanceof SafeHtml) return value.value;
    if (Array.isArray(value)) return value.map(render).join("");
    if (value === false || value === null || value === undefined) return "";
    return escapeHtml(value);
  }

  function html(strings, ...values) {
    let out = strings[0];
    for (let i = 0; i < values.length; i++) {
      out += render(values[i]) + strings[i + 1];
    }
    return new SafeHtml(out);
  }

  global.escapeHtml = escapeHtml;
  global.html = html;
  global.SafeHtml = SafeHtml;
}
