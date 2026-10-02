/* ==========================================================================
   View: Phiếu sửa chữa (Tất cả phiếu) — CODEX mục 11.4, 15.4
   API: GET /tickets (lọc + phân trang 25/50/100 phía máy chủ),
        GET /tickets/{c}, /tickets/{c}/history, /tickets/{c}/billing
   ========================================================================== */

export default function initialize() {

  const api = window.LML_API;
  const ui = window.LML_UI;
  const fmt = window.LML_FMT;
  const L = window.LML_LABELS;
  const { html } = window;
  const COLUMNS = 9;

  const state = { status: "all", category: "all", technician: "all", q: "", page: 0, size: 25, total: 0, totalPages: 1 };

  const el = {
    tbody: document.querySelector("[data-ticket-tbody]"),
    count: document.querySelector("[data-result-count]"),
    statusFilter: document.querySelector("[data-filter-status]"),
    categoryFilter: document.querySelector("[data-filter-category]"),
    techFilter: document.querySelector("[data-filter-tech]"),
    techField: document.querySelector("[data-tech-filter-field]"),
    search: document.querySelector("[data-table-search]"),
    rowsPerPage: document.querySelector("[data-rows-per-page]"),
    pageLabel: document.querySelector("[data-page-label]"),
    prevBtn: document.querySelector("[data-page-prev]"),
    nextBtn: document.querySelector("[data-page-next]"),
    drawer: document.querySelector("[data-ticket-detail-drawer]"),
    drawerSubtitle: document.querySelector("[data-ticket-detail-subtitle]"),
    drawerBody: document.querySelector("[data-ticket-detail-body]"),
  };

  function query() {
    return {
      status: state.status === "all" ? null : state.status,
      category: state.category === "all" ? null : state.category,
      technician: state.technician === "all" ? null : state.technician,
      q: state.q.trim() || null,
      page: state.page,
      size: state.size,
    };
  }

  function isFiltered() {
    return state.status !== "all" || state.category !== "all" || state.technician !== "all" || state.q.trim() !== "";
  }

  async function load() {
    ui.skeletonRows(el.tbody, COLUMNS, 6);
    el.count.textContent = "Đang tải…";
    try {
      const page = await api.tickets.list(query());
      state.total = page.totalItems;
      state.totalPages = Math.max(1, page.totalPages);
      renderPagination();
      el.count.textContent = `${page.totalItems} phiếu`;
      if (page.items.length === 0) {
        ui.tableState(el.tbody, COLUMNS, isFiltered() ? "filtered" : "empty", {
          title: isFiltered() ? "Không tìm thấy phiếu phù hợp" : "Chưa có phiếu tiếp nhận nào",
        });
        return;
      }
      el.tbody.innerHTML = html`${page.items.map((t) => html`
        <tr>
          <td class="mono cell-primary">${t.code}</td>
          <td>${t.customer ? t.customer.fullName : "—"}</td>
          <td>${t.device.deviceTypeName}<br><span class="cell-muted">${t.device.productName}</span></td>
          <td>${L.CATEGORY[t.device.categoryCode] || "—"}</td>
          <td class="mono">${t.device.serialOrImei}</td>
          <td>${fmt.badgeOf(L.TICKET_STATUS, t.status)}</td>
          <td>${t.technicianName || html`<span class="cell-muted">Chưa có</span>`}</td>
          <td class="cell-muted">${fmt.dateTime(t.receivedAt)}</td>
          <td><button type="button" class="btn btn--secondary btn--sm" data-view-ticket="${t.code}">Xem chi tiết</button></td>
        </tr>`)}`;
      el.tbody.querySelectorAll("[data-view-ticket]").forEach((btn) => {
        btn.addEventListener("click", () => openDetail(btn.getAttribute("data-view-ticket")));
      });
    } catch (error) {
      el.count.textContent = "Lỗi tải dữ liệu";
      ui.tableState(el.tbody, COLUMNS, "error", { title: "Không thể tải danh sách phiếu", desc: error.detail }, load);
    }
  }

  function renderPagination() {
    el.pageLabel.textContent = `Trang ${state.page + 1} / ${state.totalPages}`;
    el.prevBtn.disabled = state.page <= 0;
    el.nextBtn.disabled = state.page + 1 >= state.totalPages;
  }

  /* ---------------------------------------------------------------------- */
  /* Drawer chi tiết phiếu                                                   */
  /* ---------------------------------------------------------------------- */

  function section(title, body) {
    return html`<h3 class="card__title" style="margin:16px 0 10px;">${title}</h3>${body}`;
  }

  function kv(label, value, wide) {
    return html`<div class="detail-grid__item${wide ? " detail-grid__item--wide" : ""}"><span class="kv-key">${label}</span><span>${value}</span></div>`;
  }

  function billingSection(b) {
    return section(
      "Chi phí & thanh toán",
      html`
        <div class="billing-row"><span class="kv-key">Miễn phí trong bảo hành</span><span>${fmt.money(b.freeWarrantyAmount)}</span></div>
        <div class="billing-row"><span class="kv-key">Phí linh kiện ngoài bảo hành</span><span>${fmt.money(b.partsFee)}</span></div>
        <div class="billing-row"><span class="kv-key">Phí dịch vụ ngoài bảo hành</span><span>${fmt.money(b.serviceFee)}</span></div>
        <div class="billing-row"><span class="kv-key">Thuế VAT</span><span>${fmt.money(b.vat)}</span></div>
        <div class="billing-total-row"><span class="kv-key">Tổng khách phải trả</span><span>${fmt.money(b.total)}</span></div>
        <div style="margin-top:8px;">${fmt.badgeOf(L.PAYMENT_STATUS, b.paymentStatus)}</div>`
    );
  }

  function historySection(history) {
    const rows = history.statusHistory.slice().reverse();
    return section(
      "Lịch sử trạng thái",
      html`<div class="checklist">${rows.map((h) => html`
        <div class="checklist-item" style="flex-direction:column; align-items:flex-start; gap:4px;">
          <span class="cell-muted cell-muted--sm">${fmt.dateTime(h.at)} — ${h.actorName || h.actor} · ${L.ROLE[h.actorRole] || h.actorRole || ""}</span>
          <span class="checklist-item__label">${L.TICKET_STATUS[h.status].label}: ${h.description}</span>
        </div>`)}</div>`
    );
  }

  async function openDetail(code) {
    el.drawerSubtitle.textContent = code;
    ui.blockState(el.drawerBody, "loading");
    window.openDialog(el.drawer);
    try {
      const [t, history, billing] = await Promise.all([
        api.tickets.get(code),
        api.tickets.history(code),
        window.LML_AUTH.hasPermission("PAYMENT_READ") ? api.tickets.billing(code) : Promise.resolve(null),
      ]);
      const customer = t.customer || {};
      const w = t.warrantyAtIntake || {};
      const c = t.cosmetic || {};
      el.drawerSubtitle.textContent = [customer.fullName, customer.phone].filter(Boolean).join(" · ") || t.code;
      el.drawerBody.innerHTML = html`
        <div class="detail-grid">
          ${kv("Mã phiếu", html`<span class="mono">${t.code}</span>`)}
          ${kv("Trạng thái", fmt.badgeOf(L.TICKET_STATUS, t.status))}
          ${kv("Thiết bị", t.device.deviceTypeName)}
          ${kv("Hãng/Model", `${t.device.brandName} ${t.device.productName}`)}
          ${kv(t.device.identifierType === "IMEI" ? "IMEI" : "Serial", html`<span class="mono">${t.device.serialOrImei}</span>`)}
          ${kv("Nhóm thiết bị", L.CATEGORY[t.device.categoryCode] || "—")}
          ${kv("Kỹ thuật viên", t.technicianName || "Chưa phân công")}
          ${kv("Thời gian tiếp nhận", fmt.dateTime(t.receivedAt))}
          ${kv("Kênh tiếp nhận", L.CHANNEL[t.channel])}
          ${kv("Ngày hẹn trả", fmt.dateTime(t.promisedReturnAt))}
          ${kv("Triệu chứng khách hàng", t.reportedIssue, true)}
        </div>
        ${section("Thông tin bảo hành", html`
          <div class="detail-grid">
            ${kv("Tình trạng bảo hành", fmt.badgeOf(L.WARRANTY_STATUS, w.status))}
            ${kv("Nhà phân phối", w.distributor || "—")}
            ${kv("Ngày kích hoạt", fmt.date(w.activatedOn))}
            ${kv("Ngày hết hạn", fmt.date(w.expiresOn))}
            ${kv("Điều kiện bảo hành", w.conditions || "—", true)}
          </div>`)}
        ${section("Tình trạng ngoại quan khi tiếp nhận", html`
          <div class="detail-grid">
            ${kv("Vết trầy", L.SCRATCHES[c.scratches] || "—")}
            ${kv("Cấn móp", c.dents ? "Có" : "Không")}
            ${kv("Nứt/vỡ", c.cracks ? "Có" : "Không")}
            ${kv("Dấu hiệu ẩm nước", L.MOISTURE[c.moisture] || "—")}
            ${kv("Phụ kiện đi kèm", `${L.ACCESSORIES[c.accessories] || "—"}${c.accessoriesNote ? ` — ${c.accessoriesNote}` : ""}`)}
            ${kv("Tình trạng tem", t.sealCondition || "—")}
          </div>`)}
        ${billing ? billingSection(billing) : ""}
        ${historySection(history)}`;
    } catch (error) {
      ui.blockState(el.drawerBody, "error", { desc: error.detail }, () => openDetail(code));
    }
  }

  function closeDetail() {
    window.closeDialog(el.drawer);
  }

  async function populateFilters() {
    ui.fillSelect(el.statusFilter, Object.entries(L.TICKET_STATUS).map(([value, s]) => ({ value, label: s.label })));
    ui.fillSelect(el.categoryFilter, Object.entries(L.CATEGORY).map(([value, label]) => ({ value, label })));
    if (!window.LML_AUTH.hasPermission("TICKET_ASSIGN")) {
      el.techField.hidden = true;
      return;
    }
    try {
      const technicians = await api.technicians.workload();
      ui.fillSelect(el.techFilter, technicians.map((t) => ({ value: t.technicianId, label: t.fullName })));
    } catch (error) {
      el.techField.hidden = true;
    }
  }

  window.LML_AUTH.ready(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("q")) {
      state.q = params.get("q");
      el.search.value = state.q;
    }
    populateFilters();
    load();

    const onChange = (key, input) => () => {
      state[key] = input.value;
      state.page = 0;
      load();
    };
    el.statusFilter.addEventListener("change", onChange("status", el.statusFilter));
    el.categoryFilter.addEventListener("change", onChange("category", el.categoryFilter));
    el.techFilter.addEventListener("change", onChange("technician", el.techFilter));
    let timer = null;
    el.search.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(onChange("q", el.search), 300);
    });
    el.rowsPerPage.addEventListener("change", () => {
      state.size = Number(el.rowsPerPage.value);
      state.page = 0;
      load();
    });
    el.prevBtn.addEventListener("click", () => {
      state.page = Math.max(0, state.page - 1);
      load();
    });
    el.nextBtn.addEventListener("click", () => {
      state.page += 1;
      load();
    });

    document.querySelector("[data-ticket-detail-close]").addEventListener("click", closeDetail);
    el.drawer.addEventListener("click", (e) => {
      if (e.target === el.drawer) closeDetail();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !el.drawer.hasAttribute("hidden")) closeDetail();
    });
    if (params.get("ticket")) openDetail(params.get("ticket"));
  });
}
