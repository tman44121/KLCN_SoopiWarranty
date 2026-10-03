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
    ui.skeletonRows(tbody, 5);
    try {
      state.employees = await api.admin.employees({});
      if (!state.employees.length) return ui.tableState(tbody, 5, "empty");
      tbody.innerHTML = html`${state.employees.map((employee) => html`<tr class="data-table__row-action" tabindex="0" data-row-open="${employee.employeeId}" aria-label="Thao tác với tài khoản ${employee.employeeId} — ${employee.fullName}">
        <td class="mono cell-primary">${employee.employeeId}</td><td>${employee.fullName}</td>
        <td>${employee.roles.map((role) => role.label).join(", ") || "—"}</td>
        <td>${fmt.badgeOf(L.ACCOUNT_STATUS, employee.accountStatus)}</td><td class="cell-muted">${fmt.dateTime(employee.lastLoginAt)}</td>
      </tr>`)}`;
      bindRowOpen(tbody, openEmployee);
    } catch (error) {
      ui.tableState(tbody, 5, "error", { desc: error.detail }, loadEmployees);
    }
  }

  /** Dòng bảng mở chi tiết/thao tác khi bấm chuột hoặc Enter/Space (dòng có tabindex để chọn bằng bàn phím). */
  function bindRowOpen(tbody, openRow) {
    tbody.querySelectorAll("[data-row-open]").forEach((row) => {
      row.addEventListener("click", () => openRow(row.dataset.rowOpen));
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openRow(row.dataset.rowOpen);
      });
    });
  }

  /** Popup thao tác của một tài khoản nhân viên: thông tin tóm tắt + sửa vai trò, khóa/mở khóa, đặt lại mật khẩu. */
  function openEmployee(code) {
    const employee = state.employees.find((item) => item.employeeId === code);
    if (!employee) return;
    const locked = employee.accountStatus === "LOCKED";
    const kv = (label, value) => html`<div class="detail-grid__item"><span class="kv-key">${label}</span><span>${value}</span></div>`;
    $("[data-emp-modal-title]").textContent = employee.fullName;
    $("[data-emp-modal-subtitle]").textContent = `${employee.employeeId}${employee.username ? ` · ${employee.username}` : ""}`;
    $("[data-emp-modal-body]").innerHTML = html`<div class="detail-grid">
      ${kv("Vai trò", employee.roles.map((role) => role.label).join(", ") || "—")}
      ${kv("Trạng thái", fmt.badgeOf(L.ACCOUNT_STATUS, employee.accountStatus))}
      ${kv("Số điện thoại", html`<span class="mono">${employee.phone}</span>`)}
      ${kv("Lần đăng nhập gần nhất", employee.lastLoginAt ? fmt.dateTime(employee.lastLoginAt) : "—")}
    </div>`;
    $("[data-emp-modal-actions]").innerHTML = html`
      <button type="button" class="btn btn--secondary" data-emp-action="roles">Sửa vai trò</button>
      <button type="button" class="btn btn--secondary" data-emp-action="reset">Đặt lại mật khẩu</button>
      <button type="button" class="btn ${locked ? "btn--primary" : "btn--destructive"}" data-emp-action="lock">${locked ? "Mở khóa tài khoản" : "Khóa tài khoản"}</button>`;
    const actions = { roles: () => editRoles(code), reset: () => resetPassword(code), lock: () => toggleLock(code) };
    $("[data-emp-modal-actions]").querySelectorAll("[data-emp-action]").forEach((button) => button.addEventListener("click", () => {
      close("[data-emp-modal]");
      actions[button.dataset.empAction]();
    }));
    open("[data-emp-modal]");
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

  async function toggleLock(code) {
    const employee = state.employees.find((item) => item.employeeId === code);
    if (employee.accountStatus !== "LOCKED") {
      const confirmed = await ui.confirm({ title: "Khóa tài khoản này?", message: `${employee.fullName} sẽ không thể đăng nhập cho tới khi được mở khóa.`, confirmLabel: "Khóa tài khoản" });
      if (!confirmed) return;
    }
    try {
      await (employee.accountStatus === "LOCKED" ? api.admin.unlock(code) : api.admin.lock(code));
      window.showToast(employee.accountStatus === "LOCKED" ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản.", "success");
      loadEmployees();
    } catch (error) { ui.showError(error); }
  }

  async function resetPassword(code) {
    const confirmed = await ui.confirm({
      title: `Đặt lại mật khẩu cho ${code}?`,
      message: "Mật khẩu trở về mật khẩu mặc định; mọi phiên đăng nhập hiện tại bị đăng xuất. Nhân viên phải đổi mật khẩu mới ngay khi đăng nhập lại.",
      confirmLabel: "Đặt lại mật khẩu",
    });
    if (!confirmed) return;
    try {
      const result = await api.admin.resetPassword(code);
      window.showToast(`Đã đặt lại mật khẩu của ${code} về ${result.temporaryPassword}. Nhân viên phải đổi mật khẩu khi đăng nhập.`, "success");
    } catch (error) { ui.showError(error); }
  }

  /* ---- Tài khoản khách hàng: hồ sơ + tài khoản đăng nhập cổng khách ---- */
  const CUSTOMER_COLUMNS = 6;
  const customers = { page: 0, size: 25, totalPages: 1, filtered: false, selected: null };

  async function loadCustomers() {
    const tbody = $("[data-cust-tbody]");
    const query = { q: $("[data-cust-search]").value.trim() || null, account: $("[data-cust-filter-account]").value || null,
      status: $("[data-cust-filter-status]").value || null, page: customers.page, size: customers.size };
    customers.filtered = Boolean(query.q || query.account || query.status !== "ACTIVE");
    ui.skeletonRows(tbody, CUSTOMER_COLUMNS);
    try {
      const page = await api.admin.customers(query);
      customers.totalPages = Math.max(1, page.totalPages);
      $("[data-cust-count]").textContent = `${page.totalItems} khách hàng`;
      $("[data-cust-page]").textContent = `Trang ${customers.page + 1} / ${customers.totalPages}`;
      $("[data-cust-prev]").disabled = customers.page <= 0;
      $("[data-cust-next]").disabled = customers.page + 1 >= customers.totalPages;
      if (!page.items.length) {
        return ui.tableState(tbody, CUSTOMER_COLUMNS, customers.filtered ? "filtered" : "empty", {
          title: customers.filtered ? "Không tìm thấy khách hàng phù hợp" : "Chưa có khách hàng nào",
        });
      }
      tbody.innerHTML = html`${page.items.map((c) => html`<tr class="data-table__row-action" tabindex="0" data-row-open="${c.code}" aria-label="Xem chi tiết khách hàng ${c.code} — ${c.fullName}">
        <td class="mono cell-primary">${c.code}</td><td>${c.fullName}${c.email ? html`<br><span class="cell-muted">${c.email}</span>` : ""}</td><td class="mono">${c.phone}</td>
        <td>${fmt.badgeOf(L.CUSTOMER_STATUS, c.status)}</td><td>${fmt.badgeOf(L.CUSTOMER_ACCOUNT_STATUS, c.accountStatus)}</td>
        <td class="cell-muted">${c.lastLoginAt ? fmt.dateTime(c.lastLoginAt) : "—"}</td>
      </tr>`)}`;
      bindRowOpen(tbody, openCustomer);
    } catch (error) {
      ui.tableState(tbody, CUSTOMER_COLUMNS, "error", { desc: error.detail }, loadCustomers);
    }
  }

  async function openCustomer(code) {
    const body = $("[data-cust-drawer-body]");
    $("[data-cust-drawer-title]").textContent = "Khách hàng";
    $("[data-cust-drawer-subtitle]").textContent = code;
    $("[data-cust-drawer-actions]").innerHTML = "";
    ui.blockState(body, "loading");
    if ($("[data-cust-drawer]").hidden) window.openDialog($("[data-cust-drawer]"));
    try {
      renderCustomer(await api.admin.customer(code));
    } catch (error) {
      ui.blockState(body, "error", { desc: error.detail }, () => openCustomer(code));
    }
  }

  function renderCustomer(detail) {
    const c = detail.customer;
    customers.selected = c;
    const kv = (label, value, wide) => html`<div class="detail-grid__item${wide ? " detail-grid__item--wide" : ""}"><span class="kv-key">${label}</span><span>${value}</span></div>`;
    const dash = html`<span class="cell-muted">—</span>`;
    $("[data-cust-drawer-title]").textContent = c.fullName;
    $("[data-cust-drawer-subtitle]").textContent = `${c.code} · ${c.phone}`;
    const account = c.accountStatus === "NONE"
      ? html`<p class="cell-muted" style="margin:0">Khách chưa đăng ký tài khoản. Khách tự đăng ký trên cổng khách hàng bằng số điện thoại (OTP).</p>`
      : html`<div class="detail-grid">
          ${kv("Trạng thái", fmt.badgeOf(L.CUSTOMER_ACCOUNT_STATUS, c.accountStatus))}
          ${kv("Tên đăng nhập", html`<span class="mono">${c.username}</span>`)}
          ${kv("Đăng nhập gần nhất", c.lastLoginAt ? fmt.dateTime(c.lastLoginAt) : dash)}
          ${c.accountStatus === "TEMP_LOCKED" ? kv("Tự mở khóa lúc", fmt.dateTime(c.temporaryLockUntil)) : ""}
        </div>`;
    $("[data-cust-drawer-body]").innerHTML = html`
      <h3 class="report-panel__title">Hồ sơ</h3>
      <div class="detail-grid">
        ${kv("Trạng thái hồ sơ", fmt.badgeOf(L.CUSTOMER_STATUS, c.status))}
        ${kv("Ngày tạo", fmt.dateTime(c.createdAt))}
        ${kv("Email", c.email || dash)}
        ${kv("Thiết bị / phiếu đang mở", `${detail.devices} thiết bị · ${detail.openTickets} phiếu đang mở`)}
        ${kv("Địa chỉ", c.address || dash, true)}
        ${c.mergedInto ? kv("Đã gộp vào", html`<span class="mono">${c.mergedInto}</span>`, true) : ""}
      </div>
      <hr class="section-divider" />
      <h3 class="report-panel__title">Tài khoản đăng nhập</h3>
      ${account}`;
    const active = c.status === "ACTIVE";
    const hasAccount = c.accountStatus !== "NONE";
    const locked = c.accountStatus === "LOCKED";
    const action = (name, label, kind) => html`<button type="button" class="btn ${kind} btn--sm" data-cust-action="${name}">${label}</button>`;
    $("[data-cust-drawer-actions]").innerHTML = html`
      ${hasAccount && active && !locked ? action("reset", "Đặt lại mật khẩu", "btn--secondary") : ""}
      ${hasAccount && active && (locked || c.accountStatus === "TEMP_LOCKED") ? action("unlock", "Mở khóa tài khoản", "btn--secondary") : ""}
      ${hasAccount && !locked ? action("lock", "Khóa tài khoản", "btn--destructive") : ""}
      ${active ? action("contact", "Sửa liên hệ", "btn--secondary") : ""}
      ${active ? action("merge", "Gộp hồ sơ", "btn--secondary") : ""}
      ${active ? action("archive", "Lưu trữ hồ sơ", "btn--destructive") : ""}`;
    $("[data-cust-drawer-actions]").querySelectorAll("[data-cust-action]").forEach((button) =>
      button.addEventListener("click", () => CUSTOMER_ACTIONS[button.dataset.custAction](button)));
  }

  /** Thao tác xong: vẽ lại chi tiết từ bản mới nhất và làm mới danh sách (trạng thái có thể đã đổi). */
  async function afterCustomerChange(code, message) {
    window.showToast(message, "success");
    loadCustomers();
    if (!$("[data-cust-drawer]").hidden) openCustomer(code);
  }

  const CUSTOMER_ACTIONS = {
    async reset(button) {
      const c = customers.selected;
      const confirmed = await ui.confirm({
        title: `Đặt lại mật khẩu cho ${c.fullName}?`,
        message: "Hệ thống tạo mật khẩu tạm mới; mọi phiên đăng nhập hiện tại của khách bị đăng xuất. Chỉ làm khi đã xác minh đúng chủ tài khoản.",
        confirmLabel: "Đặt lại mật khẩu",
        destructive: false,
      });
      if (!confirmed) return;
      try {
        const result = await ui.busy(button, () => api.customers.resetPassword(c.code));
        await ui.showTemporaryPassword({ title: "Mật khẩu tạm của khách", message: `${c.fullName} — đăng nhập bằng ${c.username}`, password: result.temporaryPassword });
        afterCustomerChange(c.code, "Đã đặt lại mật khẩu khách.");
      } catch (error) { ui.showError(error); }
    },
    async lock(button) {
      const c = customers.selected;
      const reason = await ui.promptReason({
        title: `Khóa tài khoản của ${c.fullName}?`,
        message: "Khách bị đăng xuất ngay và không đăng nhập được cho tới khi được mở khóa.",
        label: "Lý do khóa",
        confirmLabel: "Khóa tài khoản",
      });
      if (!reason) return;
      try {
        await ui.busy(button, () => api.admin.lockCustomer(c.code, reason));
        afterCustomerChange(c.code, "Đã khóa tài khoản khách.");
      } catch (error) { ui.showError(error); }
    },
    async unlock(button) {
      const c = customers.selected;
      try {
        await ui.busy(button, () => api.admin.unlockCustomer(c.code));
        afterCustomerChange(c.code, "Đã mở khóa tài khoản khách.");
      } catch (error) { ui.showError(error); }
    },
    contact() {
      const c = customers.selected;
      $("[data-cust-contact-phone]").value = c.phone;
      $("[data-cust-contact-email]").value = c.email || "";
      $("[data-cust-contact-address]").value = c.address || "";
      ui.clearFieldErrors($("[data-cust-contact-form]"));
      open("[data-cust-contact-modal]");
    },
    merge() {
      const c = customers.selected;
      $("[data-cust-merge-subtitle]").textContent = `Gộp ${c.code} — ${c.fullName} vào một hồ sơ khác`;
      $("[data-cust-merge-target]").value = "";
      ui.clearFieldErrors($("[data-cust-merge-form]"));
      open("[data-cust-merge-modal]");
    },
    async archive(button) {
      const c = customers.selected;
      const confirmed = await ui.confirm({
        title: `Lưu trữ hồ sơ ${c.code}?`,
        message: c.accountStatus === "NONE"
          ? "Hồ sơ không còn dùng để tiếp nhận được nữa. Khách không được còn phiếu đang mở."
          : "Hồ sơ không còn dùng để tiếp nhận được nữa và tài khoản đăng nhập của khách bị khóa. Khách không được còn phiếu đang mở.",
        confirmLabel: "Lưu trữ hồ sơ",
      });
      if (!confirmed) return;
      try {
        await ui.busy(button, () => api.customers.archive(c.code));
        afterCustomerChange(c.code, `Đã lưu trữ hồ sơ ${c.code}.`);
      } catch (error) { ui.showError(error); }
    },
  };

  async function saveContact(button) {
    const c = customers.selected;
    const body = {
      phone: $("[data-cust-contact-phone]").value.trim(),
      email: $("[data-cust-contact-email]").value.trim(),
      address: $("[data-cust-contact-address]").value.trim(),
    };
    if (!body.phone) return window.showToast("Vui lòng nhập số điện thoại.", "error");
    try {
      await ui.busy(button, () => api.customers.updateContact(c.code, body));
      close("[data-cust-contact-modal]");
      afterCustomerChange(c.code, "Đã cập nhật liên hệ khách hàng.");
    } catch (error) { ui.showError(error, $("[data-cust-contact-form]")); }
  }

  async function saveMerge(button) {
    const c = customers.selected;
    const target = $("[data-cust-merge-target]").value.trim().toUpperCase();
    if (!target) return window.showToast("Vui lòng nhập mã khách hàng giữ lại.", "error");
    try {
      await ui.busy(button, () => api.customers.merge(c.code, target));
      close("[data-cust-merge-modal]");
      afterCustomerChange(target, `Đã gộp ${c.code} vào ${target}.`);
    } catch (error) { ui.showError(error, $("[data-cust-merge-form]")); }
  }

  function bindCustomers() {
    const reload = () => { customers.page = 0; loadCustomers(); };
    let timer = null;
    $("[data-cust-search]").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(reload, 300); });
    $("[data-cust-filter-account]").addEventListener("change", reload);
    $("[data-cust-filter-status]").addEventListener("change", reload);
    $("[data-cust-prev]").addEventListener("click", () => { customers.page = Math.max(0, customers.page - 1); loadCustomers(); });
    $("[data-cust-next]").addEventListener("click", () => { customers.page += 1; loadCustomers(); });
    $("[data-cust-drawer-close]").addEventListener("click", () => close("[data-cust-drawer]"));
    $("[data-cust-contact-save]").addEventListener("click", (event) => saveContact(event.currentTarget));
    $("[data-cust-merge-save]").addEventListener("click", (event) => saveMerge(event.currentTarget));
    bindClose("cust-contact", "[data-cust-contact-modal]");
    bindClose("cust-merge", "[data-cust-merge-modal]");
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
    $("[data-emp-modal-close]").addEventListener("click", () => close("[data-emp-modal]"));
    // Esc đóng hộp thoại nằm trên cùng (hộp con như Sửa liên hệ/Gộp hồ sơ trước drawer chi tiết khách).
    const ESCAPE_ORDER = ["[data-cust-contact-modal]", "[data-cust-merge-modal]", "[data-edit-roles-modal]", "[data-emp-modal]",
      "[data-cust-drawer]", "[data-add-employee-drawer]", "[data-add-category-drawer]", "[data-add-brand-drawer]", "[data-add-sku-drawer]",
      "[data-add-service-drawer]", "[data-add-policy-drawer]"];
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      // Hộp xác nhận/nhập lý do của ui.js tự đóng và tự gỡ khỏi trang trước khi sự kiện tới đây: không đóng thêm hộp bên dưới.
      const owner = event.target.closest && event.target.closest(".modal-overlay, .drawer-overlay");
      if (owner && !owner.isConnected) return;
      const top = ESCAPE_ORDER.find((selector) => $(selector) && !$(selector).hidden);
      if (top) close(top);
    });
    ["category", "brand", "sku", "policy", "service"].forEach((name) => bindClose(`add-${name}`, `[data-add-${name}-drawer]`));
    bindCatalogActions();
    bindCustomers();
    $("[data-admin-station]").addEventListener("change", loadReports);
    $("[data-admin-range]").addEventListener("change", loadReports);
  }

  window.LML_AUTH.ready(async () => {
    bind();
    await Promise.all([loadEmployees(), loadCatalogs(), window.LML_AUTH.hasPermission("CUSTOMER_ACCOUNT_MANAGE") ? loadCustomers() : null]);
    const stations = await api.catalog.list("stations");
    $("[data-admin-station]").innerHTML = html`<option value="">Tất cả trạm</option>${stations.map((station) => html`<option value="${station._id}">${station.name}</option>`)}`;
    loadReports();
  });
}
