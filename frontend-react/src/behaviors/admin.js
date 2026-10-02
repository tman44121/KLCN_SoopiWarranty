/* System administration: accounts, catalogs and reports from live APIs. */
export default function initialize() {

  const api = window.LML_API;
  const ui = window.LML_UI;
  const fmt = window.LML_FMT;
  const L = window.LML_LABELS;
  const $ = (selector) => document.querySelector(selector);
  const state = { employees: [], categories: [], brands: [], products: [], parts: [], services: [], policies: [] };
  const roles = Object.entries(L.ROLE).filter(([code]) => code !== "CUSTOMER");

  function slug(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
      .toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
  }

  function checks(container, options, selected, prefix) {
    container.innerHTML = html`${options.map(([value, label], index) => html`<div class="checkbox-row" style="padding:6px 0"><input type="checkbox" id="${prefix}-${index}" value="${value}" ${selected.includes(value) ? "checked" : ""} /><label for="${prefix}-${index}">${label}</label></div>`)}`;
  }

  function checked(container) {
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map((node) => node.value);
  }

  function open(selector) { window.openDialog($(selector)); }
  function close(selector) { window.closeDialog($(selector)); }
  function bindClose(prefix, selector) {
    $(`[data-${prefix}-cancel]`).addEventListener("click", () => close(selector));
    $(`[data-${prefix}-close]`).addEventListener("click", () => close(selector));
  }

  async function loadEmployees() {
    const tbody = $("[data-employee-tbody]");
    ui.skeletonRows(tbody, 6);
    try {
      state.employees = await api.admin.employees({});
      if (!state.employees.length) return ui.tableState(tbody, 6, "empty");
      tbody.innerHTML = html`${state.employees.map((employee) => html`<tr>
        <td class="mono cell-primary">${employee.employeeId}</td><td>${employee.fullName}</td>
        <td>${employee.roles.map((role) => role.label).join(", ") || "—"}</td>
        <td>${fmt.badgeOf(L.ACCOUNT_STATUS, employee.accountStatus)}</td><td class="cell-muted">${fmt.dateTime(employee.lastLoginAt)}</td>
        <td><div class="cell-actions"><button type="button" class="btn btn--secondary btn--sm" data-edit-roles="${employee.employeeId}">Sửa vai trò</button>
          <button type="button" class="btn ${employee.accountStatus === "LOCKED" ? "btn--secondary" : "btn--destructive"} btn--sm" data-toggle-lock="${employee.employeeId}">${employee.accountStatus === "LOCKED" ? "Mở khóa tài khoản" : "Khóa tài khoản"}</button>
          <button type="button" class="btn btn--secondary btn--sm" data-reset-password="${employee.employeeId}">Đặt lại mật khẩu</button></div></td>
      </tr>`)}`;
      tbody.querySelectorAll("[data-edit-roles]").forEach((button) => button.addEventListener("click", () => editRoles(button.dataset.editRoles)));
      tbody.querySelectorAll("[data-toggle-lock]").forEach((button) => button.addEventListener("click", () => toggleLock(button.dataset.toggleLock, button)));
      tbody.querySelectorAll("[data-reset-password]").forEach((button) => button.addEventListener("click", () => resetPassword(button.dataset.resetPassword, button)));
    } catch (error) {
      ui.tableState(tbody, 6, "error", { desc: error.detail }, loadEmployees);
    }
  }

  let editingEmployee = null;
  function editRoles(code) {
    editingEmployee = state.employees.find((employee) => employee.employeeId === code);
    $("[data-edit-roles-subtitle]").textContent = `${editingEmployee.fullName} — ${code}`;
    checks($("[data-edit-roles-list]"), roles, editingEmployee.roles.map((role) => role.code), "edit-role");
    open("[data-edit-roles-modal]");
  }

  async function saveRoles(button) {
    const selected = checked($("[data-edit-roles-list]"));
    if (!selected.length) return window.showToast("Vui lòng chọn ít nhất một vai trò.", "error");
    try {
      await ui.busy(button, () => api.admin.changeRoles(editingEmployee.employeeId, selected));
      close("[data-edit-roles-modal]");
      window.showToast("Đã cập nhật vai trò.", "success");
      loadEmployees();
    } catch (error) { ui.showError(error); }
  }

  async function toggleLock(code, button) {
    const employee = state.employees.find((item) => item.employeeId === code);
    if (employee.accountStatus !== "LOCKED") {
      const confirmed = await ui.confirm({ title: "Khóa tài khoản này?", message: `${employee.fullName} sẽ không thể đăng nhập cho tới khi được mở khóa.`, confirmLabel: "Khóa tài khoản" });
      if (!confirmed) return;
    }
    try {
      await ui.busy(button, () => employee.accountStatus === "LOCKED" ? api.admin.unlock(code) : api.admin.lock(code));
      window.showToast(employee.accountStatus === "LOCKED" ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản.", "success");
      loadEmployees();
    } catch (error) { ui.showError(error); }
  }

  async function resetPassword(code, button) {
    const confirmed = await ui.confirm({
      title: `Đặt lại mật khẩu cho ${code}?`,
      message: "Mật khẩu trở về mật khẩu mặc định; mọi phiên đăng nhập hiện tại bị đăng xuất. Nhân viên phải đổi mật khẩu mới ngay khi đăng nhập lại.",
      confirmLabel: "Đặt lại mật khẩu",
    });
    if (!confirmed) return;
    try {
      const result = await ui.busy(button, () => api.admin.resetPassword(code));
      window.showToast(`Đã đặt lại mật khẩu của ${code} về ${result.temporaryPassword}. Nhân viên phải đổi mật khẩu khi đăng nhập.`, "success");
    } catch (error) { ui.showError(error); }
  }

  async function createEmployee(button) {
    const fullName = $("[data-add-emp-name]").value.trim();
    const username = $("[data-add-emp-username]").value.trim();
    const phone = $("[data-add-emp-phone]").value.trim();
    const selected = checked($("[data-add-emp-roles]"));
    if (!fullName || !username || !phone || !selected.length) return window.showToast("Vui lòng nhập đủ họ tên, tên đăng nhập, số điện thoại và vai trò.", "error");
    try {
      const result = await ui.busy(button, () => api.admin.createEmployee({ fullName, phone, email: null, specialty: null, skills: [], maxActiveTickets: 10, username, roles: selected }));
      close("[data-add-employee-drawer]");
      window.showToast(`Đã tạo ${result.employee.employeeId}. Mật khẩu tạm thời: ${result.temporaryPassword}`, "success");
      loadEmployees();
    } catch (error) { ui.showError(error); }
  }

  async function loadCatalogs() {
    try {
      [state.categories, state.brands, state.products, state.parts, state.services, state.policies] = await Promise.all([
        api.catalog.list("device-categories"), api.catalog.list("brands"), api.catalog.list("products"), api.catalog.list("parts"),
        api.catalog.list("service-prices"), api.catalog.list("warranty-policies"),
      ]);
      renderCatalogs();
    } catch (error) {
      ["category", "brand", "sku", "service", "warranty-policy"].forEach((name) => ui.tableState($(`[data-${name}-tbody]`), name === "category" || name === "brand" ? 3 : name === "sku" ? 5 : 4, "error", { desc: error.detail }, loadCatalogs));
    }
  }

  /** Mục đã ngừng dùng vẫn hiện để tra cứu phiếu cũ, kèm nhãn để không nhầm với mục đang dùng. */
  function named(item, text) {
    return html`${text}${item.active === false ? html` ${fmt.badge("neutral", "Ngừng dùng")}` : ""}`;
  }

  const IDENTIFIER = { IMEI: "IMEI", SERIAL: "Serial" };

  function renderCatalogs() {
    const modelsByBrand = new Map();
    state.products.forEach((product) => {
      if (!modelsByBrand.has(product.brandId)) modelsByBrand.set(product.brandId, []);
      modelsByBrand.get(product.brandId).push(product.name);
    });
    const empty = (tbody, columns, desc) => ui.tableState($(tbody), columns, "empty", { desc });
    if (!state.categories.length) empty("[data-category-tbody]", 3, "Chưa có nhóm thiết bị nào.");
    else $("[data-category-tbody]").innerHTML = html`${state.categories.map((item) => {
      const types = item.deviceTypes || [];
      const identifiers = [...new Set(types.map((type) => IDENTIFIER[type.identifierType] || type.identifierType))];
      return html`<tr><td>${named(item, item.name)}</td><td>${types.length ? types.map((type) => type.name).join(", ") : html`<span class="cell-muted">Chưa có loại thiết bị</span>`}</td><td>${identifiers.join(", ") || "—"}</td></tr>`;
    })}`;
    if (!state.brands.length) empty("[data-brand-tbody]", 3, "Chưa có hãng nào.");
    else $("[data-brand-tbody]").innerHTML = html`${state.brands.map((item) => {
      const models = modelsByBrand.get(item._id) || [];
      return html`<tr><td>${named(item, item.name)}</td><td>${(item.categoryCodes || []).map(categoryName).join(", ") || "—"}</td><td>${models.length ? models.join(", ") : html`<span class="cell-muted">Chưa có model</span>`}</td></tr>`;
    })}`;
    if (!state.parts.length) empty("[data-sku-tbody]", 5, "Chưa có linh kiện nào.");
    else $("[data-sku-tbody]").innerHTML = html`${state.parts.map((item) => html`<tr><td class="mono">${item._id}</td><td>${named(item, item.name)}</td><td>${categoryName(item.categoryCode)}</td><td>${item.brandName || "—"}</td><td>${fmt.money(item.servicePrice)}</td></tr>`)}`;
    if (!state.services.length) empty("[data-service-tbody]", 4, "Chưa có dịch vụ nào.");
    else $("[data-service-tbody]").innerHTML = html`${state.services.map((item) => html`<tr><td class="mono">${item._id}</td><td>${named(item, item.name)}</td><td>${categoryName(item.categoryCode)}</td><td>${fmt.money(item.price)}</td></tr>`)}`;
    renderPolicies();
    const categoryOptions = state.categories.map((item) => html`<option value="${item._id}">${item.name}</option>`);
    $("[data-add-sku-category]").innerHTML = html`${categoryOptions}`;
    $("[data-add-svc-category]").innerHTML = html`${categoryOptions}`;
  }

  /** Theo hãng, chính sách chung của hãng đứng trước các chính sách riêng từng model. */
  function renderPolicies() {
    const productName = (id) => (state.products.find((item) => item._id === id) || {}).name || id;
    const scope = (item) => (item.scope === "PRODUCT"
      ? html`Model ${productName(item.productId)} <span class="cell-muted">(${brandName(item.brandId)})</span>`
      : html`Mọi model ${brandName(item.brandId)}`);
    const rows = [...state.policies].sort((a, b) =>
      brandName(a.brandId).localeCompare(brandName(b.brandId), "vi")
      || (a.scope === "BRAND" ? 0 : 1) - (b.scope === "BRAND" ? 0 : 1)
      || productName(a.productId).localeCompare(productName(b.productId), "vi"));
    if (!rows.length) return ui.tableState($("[data-warranty-policy-tbody]"), 4, "empty", { desc: "Chưa có chính sách bảo hành nào." });
    $("[data-warranty-policy-tbody]").innerHTML = html`${rows.map((item) => html`<tr><td>${named(item, scope(item))}</td><td>${item.warrantyMonths} tháng</td><td>${item.conditions || "—"}</td><td>${item.distributor || "—"}</td></tr>`)}`;
  }

  function categoryName(code) { return (state.categories.find((item) => item._id === code) || {}).name || code || "—"; }
  function brandName(code) { return (state.brands.find((item) => item._id === code) || {}).name || code || "—"; }

  async function createCatalog(type, body, drawer, button) {
    try {
      await ui.busy(button, () => api.catalog.create(type, body));
      close(drawer);
      window.showToast("Đã thêm mục danh mục.", "success");
      loadCatalogs();
    } catch (error) { ui.showError(error); }
  }

  const charts = window.LML_CHARTS;
  const STATUS_ORDER = Object.keys(L.TICKET_STATUS);
  let reportLoad = 0;

  function isoDate(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  /** Khoảng thời gian đã chọn → [from, to] theo ngày (to = hôm nay) và danh sách tháng để vẽ trục. */
  function reportPeriod() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const first = {
      month: new Date(year, month, 1),
      quarter: new Date(year, month - (month % 3), 1),
      year: new Date(year, 0, 1),
      last12: new Date(year, month - 11, 1),
    }[$("[data-admin-range]").value] || new Date(year, month - 11, 1);
    const months = [];
    for (let cursor = new Date(first); cursor <= today; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    }
    return { from: isoDate(first), to: isoDate(today), months };
  }

  function hours(value) {
    return value == null ? "—" : `${charts.number(value)} giờ`;
  }

  function monthLabel(key) {
    const [year, month] = key.split("-");
    return `${month}/${year}`;
  }

  function empty(target, desc) {
    ui.blockState(target, "empty", { desc });
  }

  function renderStats(revenue, statuses, turnaround, warranty) {
    const revenueTotal = revenue.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const payments = revenue.reduce((sum, row) => sum + Number(row.payments || 0), 0);
    const tickets = statuses.reduce((sum, row) => sum + Number(row.count || 0), 0);
    const delivered = (statuses.find((row) => row.status === "DELIVERED") || {}).count || 0;
    const classified = warranty.freeWarranty + warranty.charged;
    charts.stats($("[data-report-stats]"), [
      { label: "Doanh thu", value: fmt.money(revenueTotal), meta: `${payments} phiếu thu` },
      { label: "Phiếu tiếp nhận", value: charts.number(tickets, 0), meta: `${delivered} đã hoàn thành` },
      { label: "Thời gian xử lý trung bình", value: hours(turnaround.avgHours), meta: `${turnaround.delivered} máy đã bàn giao` },
      {
        label: "Trong bảo hành",
        value: classified ? `${charts.number(warranty.freeRatePercent)}%` : "—",
        meta: `${warranty.freeWarranty}/${classified} phiếu đã phân loại`,
      },
    ]);
  }

  function renderRevenue(revenue, months) {
    const target = $("[data-revenue-chart]");
    const byMonth = new Map(revenue.map((row) => [row.month, row]));
    if (!revenue.some((row) => Number(row.total) > 0)) return empty(target, "Chưa có khoản thu nào trong khoảng thời gian này.");
    if (months.length < 2) {
      return empty(target, "Khoảng thời gian chỉ gồm một tháng, tổng doanh thu ở ô phía trên. Chọn Quý này, Năm nay hoặc 12 tháng gần nhất để xem xu hướng.");
    }
    charts.columns(target, {
      title: "Doanh thu theo tháng",
      headers: ["Tháng", "Doanh thu", "Số phiếu thu"],
      rows: months.map((key) => {
        const row = byMonth.get(key) || { total: 0, payments: 0 };
        return { label: monthLabel(key), value: Number(row.total), display: fmt.money(row.total), cells: [monthLabel(key), fmt.money(row.total), row.payments] };
      }),
    });
  }

  function renderStatuses(statuses) {
    const target = $("[data-status-chart]");
    const rows = statuses
      .filter((row) => row.count > 0)
      .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
    if (!rows.length) return empty(target, "Không có phiếu nào được tiếp nhận trong khoảng thời gian này.");
    charts.bars(target, {
      title: "Số phiếu theo trạng thái",
      headers: ["Trạng thái", "Số phiếu"],
      rows: rows.map((row) => ({
        label: (L.TICKET_STATUS[row.status] || {}).label || row.status,
        value: row.count,
        display: `${row.count} phiếu`,
      })),
    });
  }

  function renderTurnaround(turnaround) {
    const target = $("[data-turnaround-chart]");
    const rows = turnaround.byCategory.filter((row) => row.avgHours != null);
    if (!rows.length) return empty(target, "Chưa có máy nào được bàn giao trong khoảng thời gian này.");
    charts.bars(target, {
      title: "Thời gian xử lý trung bình theo nhóm thiết bị",
      headers: ["Nhóm thiết bị", "Thời gian trung bình"],
      rows: rows
        .map((row) => ({
          label: categoryName(row.categoryCode),
          value: Number(row.avgHours),
          display: `${hours(row.avgHours)} · ${row.delivered} máy`,
        }))
        .sort((a, b) => b.value - a.value),
    });
  }

  function renderTechnicians(technicians) {
    const target = $("[data-technician-chart]");
    const rows = technicians.filter((row) => row.assigned > 0 || row.completed > 0);
    if (!rows.length) return empty(target, "Chưa có phiếu sửa chữa nào được giao trong khoảng thời gian này.");
    charts.bars(target, {
      title: "Phiếu hoàn tất theo kỹ thuật viên",
      headers: ["Kỹ thuật viên", "Phiếu hoàn tất"],
      rows: rows
        .map((row) => ({ label: row.fullName, value: row.completed, display: `${row.completed}/${row.assigned} phiếu` }))
        .sort((a, b) => b.value - a.value),
    });
  }

  function renderWarranty(warranty) {
    const target = $("[data-warranty-ratio-chart]");
    if (!(warranty.freeWarranty + warranty.charged)) {
      return empty(target, "Chưa có phiếu nào được phân loại bảo hành trong khoảng thời gian này.");
    }
    charts.split(target, {
      title: "Tỷ lệ trong bảo hành / ngoài bảo hành",
      headers: ["Phân loại", "Số phiếu", "Tỷ lệ"],
      parts: [
        { label: "Trong bảo hành", value: warranty.freeWarranty, display: `${warranty.freeWarranty} phiếu` },
        { label: "Ngoài bảo hành (tính phí)", value: warranty.charged, display: `${warranty.charged} phiếu` },
      ],
    });
  }

  function renderPerformance(technicians) {
    const tbody = $("[data-techperf-tbody]");
    if (!technicians.length) return ui.tableState(tbody, 5, "empty", { desc: "Chưa có kỹ thuật viên nào." });
    tbody.innerHTML = html`${technicians.map((row) => html`<tr><td>${row.fullName}</td><td>${row.assigned}</td><td>${row.completed}</td><td>${hours(row.avgRepairHours)}</td><td>${row.firstPassQcRate == null ? "—" : `${charts.number(row.firstPassQcRate)}%`}</td></tr>`)}`;
  }

  const REPORT_TARGETS = ["[data-revenue-chart]", "[data-status-chart]", "[data-turnaround-chart]", "[data-technician-chart]", "[data-warranty-ratio-chart]"];

  async function loadReports() {
    const body = $("[data-report-body]");
    const first = body.getAttribute("aria-busy") === "true" && !body.hasAttribute("data-loaded");
    const load = ++reportLoad;
    const period = reportPeriod();
    const query = { from: period.from, to: period.to, station: $("[data-admin-station]").value || null };
    $("[data-report-period]").textContent = `${period.from.split("-").reverse().join("/")} – ${period.to.split("-").reverse().join("/")}`;
    if (first) {
      REPORT_TARGETS.forEach((selector) => ui.blockState($(selector), "loading"));
      ui.skeletonRows($("[data-techperf-tbody]"), 5);
    } else {
      body.classList.add("is-refreshing");
    }
    body.setAttribute("aria-busy", "true");
    try {
      const [revenue, statuses, turnaround, technicians, warranty] = await Promise.all([
        api.reports.get("revenue-monthly", query), api.reports.get("tickets-by-status", query), api.reports.get("turnaround", query),
        api.reports.get("technician-performance", query), api.reports.get("warranty-ratio", query),
      ]);
      if (load !== reportLoad) return; // đã đổi bộ lọc trong lúc chờ: bỏ kết quả cũ
      renderStats(revenue, statuses, turnaround, warranty);
      renderRevenue(revenue, period.months);
      renderStatuses(statuses);
      renderTurnaround(turnaround);
      renderTechnicians(technicians);
      renderWarranty(warranty);
      renderPerformance(technicians);
      body.setAttribute("data-loaded", "");
    } catch (error) {
      if (load !== reportLoad) return;
      $("[data-report-stats]").textContent = "";
      REPORT_TARGETS.forEach((selector) => ui.blockState($(selector), "error", { desc: error.detail }, loadReports));
      ui.tableState($("[data-techperf-tbody]"), 5, "error", { desc: error.detail }, loadReports);
    } finally {
      if (load === reportLoad) {
        body.classList.remove("is-refreshing");
        body.setAttribute("aria-busy", "false");
      }
    }
  }

  function bindCatalogActions() {
    $("[data-open-add-category]").addEventListener("click", () => open("[data-add-category-drawer]"));
    $("[data-add-category-submit]").addEventListener("click", (event) => { const name = $("[data-add-cat-name]").value.trim(); if (name) createCatalog("device-categories", { code: slug(name), name, sortOrder: state.categories.length + 1, deviceTypes: [], active: true }, "[data-add-category-drawer]", event.currentTarget); });
    $("[data-open-add-brand]").addEventListener("click", () => { checks($("[data-add-brand-categories]"), state.categories.map((item) => [item._id, item.name]), [], "brand-category"); open("[data-add-brand-drawer]"); });
    $("[data-add-brand-submit]").addEventListener("click", (event) => { const name = $("[data-add-brand-name]").value.trim(); const categoryCodes = checked($("[data-add-brand-categories]")); if (name && categoryCodes.length) createCatalog("brands", { code: slug(name), name, categoryCodes, active: true }, "[data-add-brand-drawer]", event.currentTarget); });
    $("[data-open-add-sku]").addEventListener("click", () => open("[data-add-sku-drawer]"));
    $("[data-add-sku-submit]").addEventListener("click", (event) => { const code = $("[data-add-sku-code]").value.trim().toUpperCase(); const name = $("[data-add-sku-name]").value.trim(); const price = Number($("[data-add-sku-price]").value); if (code && name && Number.isFinite(price)) createCatalog("parts", { code, name, categoryCode: $("[data-add-sku-category]").value, brandName: $("[data-add-sku-brand]").value.trim(), unit: "Cái", costPrice: 0, servicePrice: price, minLevel: 0, primaryBin: $("[data-add-sku-bin]").value.trim() || "KHO-A-99-99", warrantyMonths: 0, supplierId: "NCC-001", active: true }, "[data-add-sku-drawer]", event.currentTarget); });
    $("[data-open-add-service]").addEventListener("click", () => open("[data-add-service-drawer]"));
    $("[data-add-service-submit]").addEventListener("click", (event) => { const name = $("[data-add-svc-name]").value.trim(); const price = Number($("[data-add-svc-price]").value); if (name && Number.isFinite(price)) createCatalog("service-prices", { code: `DV-${slug(name)}`, name, categoryCode: $("[data-add-svc-category]").value, price, active: true }, "[data-add-service-drawer]", event.currentTarget); });
    $("[data-open-add-policy]").addEventListener("click", () => open("[data-add-policy-drawer]"));
    $("[data-add-policy-submit]").addEventListener("click", (event) => { const brandText = $("[data-add-policy-brand]").value.trim(); const brand = state.brands.find((item) => item._id === brandText.toUpperCase() || item.name.toLowerCase() === brandText.toLowerCase()); const months = Number($("[data-add-policy-months]").value); if (brand && months > 0) createCatalog("warranty-policies", { scope: "BRAND", brandId: brand._id, name: `Bảo hành ${brand.name} ${months} tháng`, warrantyMonths: months, conditions: $("[data-add-policy-note]").value.trim(), rejectionCases: "", distributor: brand.name, active: true }, "[data-add-policy-drawer]", event.currentTarget); else window.showToast("Vui lòng nhập đúng hãng đã có trong danh mục và thời hạn hợp lệ.", "error"); });
  }

  function bind() {
    $("[data-open-add-employee]").addEventListener("click", () => { checks($("[data-add-emp-roles]"), roles, [], "add-role"); open("[data-add-employee-drawer]"); });
    $("[data-add-employee-submit]").addEventListener("click", (event) => createEmployee(event.currentTarget));
    $("[data-edit-roles-save]").addEventListener("click", (event) => saveRoles(event.currentTarget));
    bindClose("add-employee", "[data-add-employee-drawer]"); bindClose("edit-roles", "[data-edit-roles-modal]");
    ["category", "brand", "sku", "policy", "service"].forEach((name) => bindClose(`add-${name}`, `[data-add-${name}-drawer]`));
    bindCatalogActions();
    $("[data-admin-station]").addEventListener("change", loadReports);
    $("[data-admin-range]").addEventListener("change", loadReports);
  }

  window.LML_AUTH.ready(async () => {
    bind();
    await Promise.all([loadEmployees(), loadCatalogs()]);
    const stations = await api.catalog.list("stations");
    $("[data-admin-station]").innerHTML = html`<option value="">Tất cả trạm</option>${stations.map((station) => html`<option value="${station._id}">${station.name}</option>`)}`;
    loadReports();
  });
}
