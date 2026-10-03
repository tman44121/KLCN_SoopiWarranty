/* ==========================================================================
   View: Điều phối viên — UI mục 15; CODEX mục 15.4
   API: GET /tickets/open, GET /technicians/workload,
        GET /tickets/{c}/assignment-candidates, POST|PUT /tickets/{c}/assignment,
        GET /quotations?approvalStatus=PENDING, POST /quotations/{c}/approve|reject
   ========================================================================== */

export default function initialize() {

  const api = window.LML_API;
  const ui = window.LML_UI;
  const fmt = window.LML_FMT;
  const L = window.LML_LABELS;
  const { html } = window;
  const COLUMNS = 11;
  /** Trạng thái còn đếm SLA (SLA không phải trạng thái — mục 7.1). */
  const SLA_COUNTED = (status) => !["COMPLETED", "AWAITING_RETURN", "DELIVERED", "RETURNED_UNREPAIRED"].includes(status);
  const REASSIGNABLE = ["INSPECTING", "DIAGNOSED", "AWAITING_QUOTE_APPROVAL", "AWAITING_CUSTOMER_CONFIRMATION", "AWAITING_PARTS", "REPAIRING"];

  const state = {
    tickets: [],
    loading: true,
    error: null,
    searchTerm: "",
    statusFilter: "all",
    categoryFilter: "all",
    slaFilter: "all",
    sortKey: "deadline",
    sortDir: "asc",
    page: 1,
    rowsPerPage: 25,
    expandedRow: null,
    assign: null,
    selectedCandidateId: null,
    quotation: null,
  };

  const el = {
    tbody: document.querySelector("[data-ticket-tbody]"),
    count: document.querySelector("[data-result-count]"),
    statusFilter: document.querySelector("[data-filter-status]"),
    categoryFilter: document.querySelector("[data-filter-category]"),
    slaFilter: document.querySelector("[data-filter-sla]"),
    searchInput: document.querySelector("[data-table-search]"),
    refreshBtn: document.querySelector("[data-refresh-btn]"),
    rowsPerPageSelect: document.querySelector("[data-rows-per-page]"),
    pageLabel: document.querySelector("[data-page-label]"),
    prevBtn: document.querySelector("[data-page-prev]"),
    nextBtn: document.querySelector("[data-page-next]"),
    workloadList: document.querySelector("[data-workload-list]"),
    modalOverlay: document.querySelector("[data-assign-modal]"),
    modalTitle: document.getElementById("assign-modal-title"),
    modalSubtitle: document.querySelector("[data-assign-modal-subtitle]"),
    candidateList: document.querySelector("[data-candidate-list]"),
    confirmAssignBtn: document.querySelector("[data-confirm-assign]"),
    priorityField: document.querySelector("[data-assign-priority-field]"),
    priority: document.querySelector("[data-assign-priority]"),
    assignNote: document.querySelector("[data-assign-note]"),

    quotationApprovalList: document.querySelector("[data-quotation-approval-list]"),
    quotationDrawer: document.querySelector("[data-quotation-drawer]"),
    quotationDrawerSubtitle: document.querySelector("[data-quotation-drawer-subtitle]"),
    quotationDrawerReclass: document.querySelector("[data-quotation-drawer-reclass]"),
    quotationDrawerTech: document.querySelector("[data-quotation-drawer-tech]"),
    quotationDrawerNote: document.querySelector("[data-quotation-drawer-note]"),
    quotationDrawerNoteLabel: document.querySelector("[data-quotation-drawer-note-label]"),
    quotationDrawerVat: document.querySelector("[data-quotation-drawer-vat]"),
    quotationDrawerVatLabel: document.querySelector("[data-quotation-drawer-vat-label]"),
    quotationDrawerItems: document.querySelector("[data-quotation-drawer-items]"),
    quotationDrawerPartsTotal: document.querySelector("[data-quotation-drawer-parts-total]"),
    quotationDrawerServiceFee: document.querySelector("[data-quotation-drawer-service-fee]"),
    quotationDrawerTotal: document.querySelector("[data-quotation-drawer-total]"),
    quotationDispatchNote: document.querySelector("[data-quotation-dispatch-note]"),
    quotationDispatchNoteError: document.querySelector("[data-quotation-dispatch-note-error]"),
    approveBtn: document.querySelector("[data-quotation-approve]"),
    rejectBtn: document.querySelector("[data-quotation-request-changes]"),
  };

  /* ---------------------------------------------------------------------- */
  /* Bảng phiếu đang xử lý                                                   */
  /* ---------------------------------------------------------------------- */

  function deadline(t) {
    return new Date(t.sla.dueAt).getTime();
  }

  function filtered() {
    const q = state.searchTerm.trim().toLowerCase();
    const list = state.tickets.filter((t) => {
      if (state.statusFilter !== "all" && t.status !== state.statusFilter) return false;
      if (state.categoryFilter !== "all" && t.device.categoryCode !== state.categoryFilter) return false;
      if (state.slaFilter !== "all" && t.sla.level !== state.slaFilter) return false;
      if (!q) return true;
      return [t.code, t.device.serialOrImei, t.customer && t.customer.fullName, t.customer && t.customer.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    const dir = state.sortDir === "asc" ? 1 : -1;
    const key = {
      receivedAt: (t) => t.receivedAt,
      status: (t) => L.TICKET_STATUS[t.status].label,
      deadline: (t) => (SLA_COUNTED(t.status) ? deadline(t) : Number.MAX_SAFE_INTEGER),
    }[state.sortKey];
    return list.sort((a, b) => (key(a) < key(b) ? -dir : key(a) > key(b) ? dir : 0));
  }

  function statusCell(t) {
    const badges = [fmt.badgeOf(L.TICKET_STATUS, t.status)];
    if (SLA_COUNTED(t.status) && t.sla.status === "BREACHED") badges.push(fmt.badge("danger", "Trễ hẹn SLA"));
    return html`<div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">${badges}</div>`;
  }

  function actionButtons(t) {
    if (t.status === "RECEIVED") {
      return html`<button type="button" class="btn btn--primary btn--sm" data-open-assign="${t.code}">Phân công</button>`;
    }
    if (REASSIGNABLE.includes(t.status)) {
      return html`<button type="button" class="btn btn--secondary btn--sm" data-open-assign="${t.code}">Đổi KTV</button>`;
    }
    return "";
  }

  function detailRow(t) {
    const customer = t.customer || {};
    return html`
      <tr class="detail-row">
        <td colspan="${COLUMNS}" style="background:var(--surface-utility); padding:12px 16px;">
          <div style="display:flex; flex-wrap:wrap; gap:20px; font-size:12.5px; color:var(--text-default);">
            <div><span class="cell-muted">SĐT khách hàng: </span><strong>${customer.phone || "—"}</strong></div>
            <div><span class="cell-muted">${t.device.identifierType === "IMEI" ? "IMEI" : "Serial"}: </span><span class="mono">${t.device.serialOrImei}</span></div>
            <div><span class="cell-muted">Nhóm thiết bị: </span><strong>${L.CATEGORY[t.device.categoryCode] || t.device.categoryCode}</strong></div>
            <div><span class="cell-muted">Mức SLA: </span><strong>${L.SLA_LEVEL[t.sla.level]}</strong></div>
            <div><span class="cell-muted">Ưu tiên: </span><strong>${t.assignment ? L.PRIORITY[t.assignment.priority] : "—"}</strong></div>
            <div><span class="cell-muted">Hẹn trả: </span><strong>${fmt.dateTime(t.promisedReturnAt)}</strong></div>
            <div style="flex-basis:100%;"><span class="cell-muted">Lỗi tiếp nhận: </span>${t.reportedIssue}</div>
          </div>
        </td>
      </tr>`;
  }

  function renderRows(list) {
    const start = (state.page - 1) * state.rowsPerPage;
    const rows = list.slice(start, start + state.rowsPerPage).map((t) => html`
      <tr data-ticket-id="${t.code}">
        <td class="mono cell-primary">${t.code}</td>
        <td class="cell-muted">${fmt.dateTime(t.receivedAt)}</td>
        <td>${t.customer ? t.customer.fullName : "—"}</td>
        <td class="col-category">${L.CATEGORY[t.device.categoryCode] || "—"}</td>
        <td>${t.device.deviceTypeName}<br><span class="cell-muted">${t.device.productName}</span></td>
        <td class="mono">${t.device.serialOrImei}</td>
        <td>${L.SLA_LEVEL[t.sla.level]}</td>
        <td>${SLA_COUNTED(t.status)
          ? html`<span class="sla-timer" data-deadline="${deadline(t)}"></span>`
          : html`<span class="cell-muted">—</span>`}</td>
        <td>${statusCell(t)}</td>
        <td>${t.technicianName || html`<span class="cell-muted">Chưa có</span>`}</td>
        <td><div class="cell-actions">
          <button type="button" class="btn btn--secondary btn--sm" data-toggle-detail="${t.code}">Chi tiết</button>
          ${actionButtons(t)}
        </div></td>
      </tr>
      ${state.expandedRow === t.code ? detailRow(t) : ""}`);
    el.tbody.innerHTML = html`${rows}`;

    el.tbody.querySelectorAll("[data-toggle-detail]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn.getAttribute("data-toggle-detail");
        state.expandedRow = state.expandedRow === code ? null : code;
        render();
      });
    });
    el.tbody.querySelectorAll("[data-open-assign]").forEach((btn) => {
      btn.addEventListener("click", () => openAssignModal(btn.getAttribute("data-open-assign")));
    });
    tickSlaTimers();
  }

  function renderPagination(total) {
    const totalPages = Math.max(1, Math.ceil(total / state.rowsPerPage));
    if (state.page > totalPages) state.page = totalPages;
    el.pageLabel.textContent = `Trang ${state.page} / ${totalPages}`;
    el.prevBtn.disabled = state.page <= 1;
    el.nextBtn.disabled = state.page >= totalPages;
  }

  function render() {
    if (state.loading) {
      ui.skeletonRows(el.tbody, COLUMNS, 6);
      el.count.textContent = "Đang tải…";
      return;
    }
    if (state.error) {
      ui.tableState(el.tbody, COLUMNS, "error", { title: "Không thể tải danh sách phiếu", desc: state.error.detail }, loadTickets);
      el.count.textContent = "Lỗi tải dữ liệu";
      renderPagination(0);
      return;
    }
    const list = filtered();
    el.count.textContent = `${list.length} phiếu`;
    if (list.length === 0) {
      const isFiltered =
        state.statusFilter !== "all" || state.categoryFilter !== "all" || state.slaFilter !== "all" || state.searchTerm.trim() !== "";
      ui.tableState(el.tbody, COLUMNS, isFiltered ? "filtered" : "empty", {
        title: isFiltered ? "Không tìm thấy phiếu phù hợp" : "Chưa có phiếu tiếp nhận nào",
        desc: isFiltered
          ? "Hãy thử điều chỉnh bộ lọc hoặc từ khoá tìm kiếm."
          : "Phiếu mới sẽ xuất hiện tại đây khi lễ tân tiếp nhận thiết bị.",
      });
      renderPagination(0);
      return;
    }
    renderRows(list);
    renderPagination(list.length);
  }

  function tickSlaTimers() {
    document.querySelectorAll(".sla-timer[data-deadline]").forEach((node) => {
      const diff = Number(node.getAttribute("data-deadline")) - Date.now();
      node.textContent = fmt.countdown(diff);
      node.classList.toggle("is-overdue", diff < 0);
      node.classList.toggle("is-risk", diff >= 0 && diff < 2 * 3600 * 1000);
    });
  }

  async function loadTickets() {
    state.loading = true;
    state.error = null;
    render();
    try {
      state.tickets = await api.tickets.open();
    } catch (error) {
      state.error = error;
    }
    state.loading = false;
    render();
  }

  /* ---------------------------------------------------------------------- */
  /* Tải công việc kỹ thuật viên                                             */
  /* ---------------------------------------------------------------------- */

  async function loadWorkload() {
    ui.blockState(el.workloadList, "loading");
    try {
      const rows = await api.technicians.workload();
      if (rows.length === 0) {
        ui.blockState(el.workloadList, "empty", { desc: "Chưa có kỹ thuật viên nào đang làm việc." });
        return;
      }
      el.workloadList.innerHTML = html`${rows.map((tech) => {
        const pct = Math.min(100, tech.loadPercent);
        const bars = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
        return html`
          <div class="workload-row">
            <div class="workload-row__info">
              <div class="workload-row__name">${tech.fullName}</div>
              <div class="workload-row__meta">${tech.activeTickets}/${tech.maxActiveTickets} phiếu · SLA nguy cơ: ${tech.atRiskSla}${tech.onSite ? "" : " · Không có mặt tại trạm"}</div>
            </div>
            <div class="workload-row__bar-track" role="img" aria-label="${bars} ${tech.loadPercent}%">
              <div class="workload-row__bar-fill ${tech.overloaded ? "is-overload" : ""}" style="width:${pct}%"></div>
            </div>
            <div class="workload-row__pct">${tech.loadPercent}%</div>
            <div class="workload-row__status">${tech.overloaded ? fmt.badge("danger", "Quá tải công việc") : ""}</div>
          </div>`;
      })}`;
    } catch (error) {
      ui.blockState(el.workloadList, "error", { desc: error.detail }, loadWorkload);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Phân công / đổi kỹ thuật viên (T2, T2b)                                 */
  /* ---------------------------------------------------------------------- */

  async function openAssignModal(code) {
    const ticket = state.tickets.find((t) => t.code === code);
    if (!ticket) return;
    const reassign = ticket.status !== "RECEIVED";
    state.assign = { ticket, reassign };
    state.selectedCandidateId = null;
    el.modalTitle.textContent = reassign ? "Đổi kỹ thuật viên phụ trách" : "Phân công kỹ thuật viên";
    el.modalSubtitle.textContent = `${ticket.code} — ${ticket.device.deviceTypeName} (${ticket.device.productName}) — ${ticket.customer ? ticket.customer.fullName : ""}`;
    el.priorityField.hidden = reassign;
    el.priority.value = "NORMAL";
    el.assignNote.value = "";
    el.confirmAssignBtn.disabled = true;
    el.confirmAssignBtn.textContent = reassign ? "Xác nhận đổi kỹ thuật viên" : "Xác nhận giao việc";
    ui.blockState(el.candidateList, "loading");
    window.openDialog(el.modalOverlay);

    try {
      const candidates = await api.tickets.candidates(code);
      renderCandidates(candidates, ticket);
    } catch (error) {
      ui.blockState(el.candidateList, "error", { desc: error.detail }, () => openAssignModal(code));
    }
  }

  function renderCandidates(candidates, ticket) {
    const currentTech = ticket.assignment && ticket.assignment.technicianId;
    const list = candidates.filter((c) => c.technicianId !== currentTech);
    if (list.length === 0) {
      ui.blockState(el.candidateList, "empty", { desc: "Không có kỹ thuật viên phù hợp đang làm việc." });
      return;
    }
    el.candidateList.innerHTML = html`${list.map((c) => html`
      <label class="candidate ${c.overloaded ? "is-disabled" : ""}" data-candidate="${c.technicianId}">
        <input type="radio" name="candidate" class="candidate__radio" value="${c.technicianId}" ${c.overloaded ? html`disabled` : ""} />
        <div class="candidate__main">
          <div class="candidate__name-row">
            <span class="candidate__name">${c.fullName}</span>
            ${c.overloaded ? fmt.badge("danger", "Quá tải công việc") : ""}
            ${c.skillMatch ? fmt.badge("success", "Đúng chuyên môn") : ""}
          </div>
          <div class="candidate__factors">
            <span class="candidate__factor">Chuyên môn: <strong>${c.skills.length ? c.skills.join(", ") : "—"}</strong></span>
            <span class="candidate__factor">Tải hiện tại: <strong>${c.activeTickets}/${c.maxActiveTickets}</strong></span>
            <span class="candidate__factor">SLA nguy cơ: <strong>${c.atRiskSla} phiếu</strong></span>
            <span class="candidate__factor">Có mặt tại trạm: <strong>${c.onSite ? "Có" : "Không"}</strong></span>
          </div>
          ${c.reason ? html`<div class="cell-muted" style="font-size:12px; margin-top:4px;">${c.reason}</div>` : ""}
        </div>
      </label>`)}`;
    el.candidateList.querySelectorAll("[data-candidate]").forEach((item) => {
      const radio = item.querySelector("input");
      if (radio.disabled) return;
      radio.addEventListener("change", () => {
        state.selectedCandidateId = radio.value;
        el.candidateList.querySelectorAll(".candidate").forEach((c) => c.classList.remove("is-selected"));
        item.classList.add("is-selected");
        el.confirmAssignBtn.disabled = false;
      });
    });
  }

  function closeAssignModal() {
    window.closeDialog(el.modalOverlay);
    state.assign = null;
    state.selectedCandidateId = null;
  }

  async function confirmAssignment() {
    const { ticket, reassign } = state.assign || {};
    if (!ticket || !state.selectedCandidateId) return;
    const note = el.assignNote.value.trim() || null;
    try {
      const updated = await ui.busy(el.confirmAssignBtn, () =>
        reassign
          ? api.tickets.reassign(ticket.code, { technicianId: state.selectedCandidateId, note })
          : api.tickets.assign(ticket.code, { technicianId: state.selectedCandidateId, priority: el.priority.value, note })
      );
      closeAssignModal();
      window.showToast(`Đã giao ${updated.code} cho kỹ thuật viên ${updated.technicianName}.`, "success");
      loadTickets();
      loadWorkload();
    } catch (error) {
      ui.showError(error);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Phê duyệt báo giá (T6a/T6b — mục 15D, 34)                               */
  /* ---------------------------------------------------------------------- */

  async function loadQuotations() {
    if (!el.quotationApprovalList) return;
    ui.blockState(el.quotationApprovalList, "loading");
    try {
      const page = await api.quotations.list({ approvalStatus: "PENDING", page: 0, size: 100 });
      if (page.items.length === 0) {
        ui.blockState(el.quotationApprovalList, "empty", { desc: "Không có phiếu báo giá nào đang chờ phê duyệt." });
        return;
      }
      el.quotationApprovalList.innerHTML = html`${page.items.map((q) => html`
        <div class="request-row">
          <div class="request-row__main">
            <span class="request-row__title mono">${q.code}</span>
            <span class="request-row__meta"><span class="mono">${q.ticketCode}</span> · Lập lúc ${fmt.dateTime(q.createdAt)} · Tổng thanh toán ${fmt.money(q.grandTotal)}</span>
          </div>
          <div class="request-row__right">
            ${fmt.badgeOf(L.QUOTE_APPROVAL, q.approval.status)}
            <button type="button" class="btn btn--secondary btn--sm" data-view-quotation="${q.code}">Xem chi tiết</button>
          </div>
        </div>`)}`;
      el.quotationApprovalList.querySelectorAll("[data-view-quotation]").forEach((btn) => {
        btn.addEventListener("click", () => openQuotationDrawer(btn.getAttribute("data-view-quotation")));
      });
    } catch (error) {
      ui.blockState(el.quotationApprovalList, "error", { desc: error.detail }, loadQuotations);
    }
  }

  async function openQuotationDrawer(code) {
    try {
      const quotation = await api.quotations.get(code);
      const ticket = await api.tickets.get(quotation.ticketCode);
      state.quotation = quotation;
      const inspection = ticket.inspection || {};
      el.quotationDrawerSubtitle.textContent = `${quotation.code} — ${ticket.code} — ${ticket.device.deviceTypeName} (${ticket.device.productName})`;
      el.quotationDrawerReclass.textContent = L.CLASSIFICATION[inspection.classification] || "—";
      el.quotationDrawerTech.textContent = ticket.technicianName || quotation.createdBy;
      el.quotationDrawerNoteLabel.textContent = inspection.reclassNote ? "Lý do phân loại lại" : "Lý do ngoài bảo hành";
      el.quotationDrawerNote.textContent = inspection.reclassNote || inspection.outOfWarrantyReason || "—";
      el.quotationDrawerItems.innerHTML = html`${quotation.lines.map((line) => html`
        <tr>
          <td class="mono">${line.sku || "—"}</td>
          <td>${line.description}</td>
          <td>${line.quantity}</td>
          <td>${fmt.money(line.lineTotal)}</td>
        </tr>`)}`;
      el.quotationDrawerPartsTotal.textContent = fmt.money(quotation.partsTotal);
      el.quotationDrawerServiceFee.textContent = fmt.money(quotation.laborTotal);
      // VAT tính trên cả linh kiện lẫn tiền công: hiện thành dòng riêng để tổng cộng lại được.
      el.quotationDrawerVatLabel.textContent = `Thuế VAT (${Number(quotation.vatRate)}%)`;
      el.quotationDrawerVat.textContent = fmt.money(quotation.grandTotal - quotation.partsTotal - quotation.laborTotal);
      el.quotationDrawerTotal.textContent = fmt.money(quotation.grandTotal);
      el.quotationDispatchNote.value = "";
      el.quotationDispatchNoteError.setAttribute("hidden", "");
      window.openDialog(el.quotationDrawer);
    } catch (error) {
      ui.showError(error);
    }
  }

  function closeQuotationDrawer() {
    window.closeDialog(el.quotationDrawer);
    state.quotation = null;
  }

  async function reviewQuotation(approve) {
    const quotation = state.quotation;
    if (!quotation) return;
    const note = el.quotationDispatchNote.value.trim();
    if (!approve && !note) {
      el.quotationDispatchNoteError.removeAttribute("hidden");
      el.quotationDispatchNote.focus();
      return;
    }
    try {
      await ui.busy(approve ? el.approveBtn : el.rejectBtn, () =>
        approve ? api.quotations.approve(quotation.code, note || null) : api.quotations.reject(quotation.code, note)
      );
      closeQuotationDrawer();
      window.showToast(
        approve
          ? `Đã phê duyệt báo giá ${quotation.code} — đang chờ khách hàng xác nhận.`
          : `Đã yêu cầu kỹ thuật viên sửa lại báo giá ${quotation.code}.`,
        approve ? "success" : "error"
      );
      loadQuotations();
      loadTickets();
    } catch (error) {
      ui.showError(error);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Khởi tạo                                                               */
  /* ---------------------------------------------------------------------- */

  function populateFilterOptions() {
    ui.fillSelect(el.categoryFilter, Object.entries(L.CATEGORY).map(([value, label]) => ({ value, label })));
    ui.fillSelect(el.statusFilter, Object.entries(L.TICKET_STATUS)
      .filter(([code]) => !["DELIVERED", "RETURNED_UNREPAIRED"].includes(code))
      .map(([value, s]) => ({ value, label: s.label })));
    ui.fillSelect(el.slaFilter, Object.entries(L.SLA_LEVEL).map(([value, label]) => ({ value, label })));
  }

  function bindEvents() {
    const onFilter = (key, input) => () => {
      state[key] = input.value;
      state.page = 1;
      render();
    };
    el.statusFilter.addEventListener("change", onFilter("statusFilter", el.statusFilter));
    el.categoryFilter.addEventListener("change", onFilter("categoryFilter", el.categoryFilter));
    el.slaFilter.addEventListener("change", onFilter("slaFilter", el.slaFilter));
    el.searchInput.addEventListener("input", onFilter("searchTerm", el.searchInput));

    document.querySelectorAll("[data-sort-key]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort-key");
        state.sortDir = state.sortKey === key && state.sortDir === "asc" ? "desc" : "asc";
        state.sortKey = key;
        document.querySelectorAll("[data-sort-key]").forEach((h) => {
          h.classList.remove("is-sorted-asc", "is-sorted-desc");
          h.removeAttribute("aria-sort");
        });
        th.classList.add(state.sortDir === "asc" ? "is-sorted-asc" : "is-sorted-desc");
        th.setAttribute("aria-sort", state.sortDir === "asc" ? "ascending" : "descending");
        render();
      });
    });

    el.rowsPerPageSelect.addEventListener("change", () => {
      state.rowsPerPage = Number(el.rowsPerPageSelect.value);
      state.page = 1;
      render();
    });
    el.prevBtn.addEventListener("click", () => {
      state.page = Math.max(1, state.page - 1);
      render();
    });
    el.nextBtn.addEventListener("click", () => {
      state.page += 1;
      render();
    });
    el.refreshBtn.addEventListener("click", () => {
      loadTickets();
      loadWorkload();
      loadQuotations();
    });

    document.querySelector("[data-modal-close]").addEventListener("click", closeAssignModal);
    document.querySelector("[data-modal-cancel]").addEventListener("click", closeAssignModal);
    el.modalOverlay.addEventListener("click", (e) => {
      if (e.target === el.modalOverlay) closeAssignModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !el.modalOverlay.hasAttribute("hidden")) closeAssignModal();
    });
    el.confirmAssignBtn.addEventListener("click", confirmAssignment);

    document.querySelector("[data-quotation-drawer-close]").addEventListener("click", closeQuotationDrawer);
    el.quotationDrawer.addEventListener("click", (e) => {
      if (e.target === el.quotationDrawer) closeQuotationDrawer();
    });
    el.approveBtn.addEventListener("click", () => reviewQuotation(true));
    el.rejectBtn.addEventListener("click", () => reviewQuotation(false));
  }

  window.LML_AUTH.ready(() => {
    const ticketParam = new URLSearchParams(location.search).get("ticket");
    if (ticketParam) {
      state.searchTerm = ticketParam;
      el.searchInput.value = ticketParam;
    }
    populateFilterOptions();
    bindEvents();
    loadTickets();
    loadWorkload();
    loadQuotations();
    setInterval(tickSlaTimers, 1000);
    // SLA/trạng thái thay đổi theo thao tác của vai trò khác — làm mới định kỳ mỗi phút.
    setInterval(loadTickets, 60 * 1000);
  });
}
