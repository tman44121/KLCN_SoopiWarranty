import { createListFilters } from './list-filters.js';
/* ==========================================================================
   View: Quản lý kho vật tư — UI mục 17, 36; CODEX mục 11.6 (T8–T9b, BR-26, BR-36)
   API: GET /parts, GET /catalog/suppliers, /stock-receipts*, /stock-issues*,
        /stock-transfers*. Tồn kho tự trừ ngay khi "Duyệt & Thực xuất kho" (mục 36).
   ========================================================================== */

export default function initialize() {

  const api = window.LML_API;
  const ui = window.LML_UI;
  const fmt = window.LML_FMT;
  const L = window.LML_LABELS;
  const { html } = window;
  const $ = (selector) => document.querySelector(selector);
  const INVENTORY_COLUMNS = 11;
  const BIN_PATTERN = /^KHO-[A-Z]-\d{2}-\d{2}$/;

  const state = {
    parts: [],
    suppliers: {},
    invLoading: true,
    invError: null,
    filters: { group: "all", status: "all", q: "" },
    receipts: [],
    issues: [],
    transfers: [],
    stocktakes: [],
    sheet: [],
    activeStocktake: null,
    createItems: [],
    activeReceipt: null,
    activeIssue: null,
    activeTransfer: null,
  };

  const el = {
    invTbody: $("[data-inventory-tbody]"),
    invCount: $("[data-inv-count]"),
    invGroup: $("[data-inv-filter-group]"),
    invStatus: $("[data-inv-filter-status]"),
    invSearch: $("[data-inv-search]"),
    stockinList: $("[data-stockin-list]"),
    stockoutList: $("[data-stockout-list]"),
    transferList: $("[data-transfer-list]"),

    createDrawer: $("[data-create-stockin-drawer]"),
    createSupplier: $("[data-create-supplier]"),
    createBatch: $("[data-create-batch]"),
    createDate: $("[data-create-date]"),
    createNote: $("[data-create-note]"),
    createItems: $("[data-create-items]"),
    createItemsError: $("[data-create-items-error]"),
    createSubmit: $("[data-create-stockin-submit]"),

    stockinDrawer: $("[data-stockin-drawer]"),
    stockinSubtitle: $("[data-stockin-drawer-subtitle]"),
    stockinSupplier: $("[data-stockin-supplier]"),
    stockinBatch: $("[data-stockin-batch]"),
    stockinDate: $("[data-stockin-date]"),
    stockinStatus: $("[data-stockin-status]"),
    stockinItems: $("[data-stockin-items]"),
    stockinApprove: $("[data-stockin-approve]"),
    stockinReject: $("[data-stockin-reject]"),

    stockoutDrawer: $("[data-stockout-drawer]"),
    stockoutSubtitle: $("[data-stockout-drawer-subtitle]"),
    stockoutTicket: $("[data-stockout-ticket]"),
    stockoutTech: $("[data-stockout-tech]"),
    stockoutSource: $("[data-stockout-source]"),
    stockoutStatus: $("[data-stockout-status]"),
    stockoutLines: $("[data-stockout-lines]"),
    stockoutApprove: $("[data-stockout-approve]"),
    stockoutReject: $("[data-stockout-reject]"),

    transferCreateDrawer: $("[data-create-transfer-drawer]"),
    transferSku: $("[data-transfer-sku]"),
    transferInfo: $("[data-transfer-info]"),
    transferOnhand: $("[data-transfer-onhand]"),
    transferCurrentBin: $("[data-transfer-current-bin]"),
    transferQty: $("[data-transfer-qty]"),
    transferToBin: $("[data-transfer-to-bin]"),
    transferReason: $("[data-transfer-reason]"),
    transferSubmit: $("[data-create-transfer-submit]"),

    transferDrawer: $("[data-transfer-drawer]"),
    transferSubtitle: $("[data-transfer-drawer-subtitle]"),
    transferDetailPart: $("[data-transfer-detail-part]"),
    transferDetailQty: $("[data-transfer-detail-qty]"),
    transferDetailFrom: $("[data-transfer-detail-from]"),
    transferDetailTo: $("[data-transfer-detail-to]"),
    transferDetailReason: $("[data-transfer-detail-reason]"),
    transferApprove: $("[data-transfer-approve]"),
    transferReject: $("[data-transfer-reject]"),
    stocktakeList: $("[data-stocktake-list]"),
    ledgerDrawer: $("[data-ledger-drawer]"),
    ledgerSubtitle: $("[data-ledger-subtitle]"),
    ledgerBody: $("[data-ledger-body]"),
    stocktakeCreateDrawer: $("[data-create-stocktake-drawer]"),
    stocktakeCategory: $("[data-stocktake-category]"),
    stocktakeBin: $("[data-stocktake-bin]"),
    stocktakeLoad: $("[data-stocktake-load]"),
    stocktakeToolbar: $("[data-stocktake-toolbar]"),
    stocktakeSummary: $("[data-stocktake-summary]"),
    stocktakeFill: $("[data-stocktake-fill]"),
    stocktakeLines: $("[data-stocktake-lines]"),
    stocktakeNote: $("[data-stocktake-note]"),
    stocktakeSubmit: $("[data-create-stocktake-submit]"),
    stocktakeDrawer: $("[data-stocktake-drawer]"),
    stocktakeSubtitle: $("[data-stocktake-drawer-subtitle]"),
    stocktakeDetail: $("[data-stocktake-detail]"),
    stocktakeApprove: $("[data-stocktake-approve]"),
    stocktakeReject: $("[data-stocktake-reject]"),
  };

  const partName = (sku) => (state.parts.find((p) => p.sku === sku) || {}).name || "—";
  const listPages = new Map([
    [el.stockinList, createPage(el.stockinList, loadReceipts, 'phiếu nhập kho')],
    [el.stockoutList, createPage(el.stockoutList, loadIssues, 'phiếu xuất kho')],
    [el.transferList, createPage(el.transferList, loadTransfers, 'phiếu điều chuyển')],
    [el.stocktakeList, createPage(el.stocktakeList, loadStocktakes, 'phiếu kiểm kê')],
  ]);
  const listFilters = new Map([
    [el.stockinList, createListFilters(el.stockinList, () => queueListLoad(el.stockinList, loadReceipts), { statuses: L.STOCK_RECEIPT_STATUS })],
    [el.stockoutList, createListFilters(el.stockoutList, () => queueListLoad(el.stockoutList, loadIssues), { statuses: L.STOCK_ISSUE_STATUS })],
    [el.transferList, createListFilters(el.transferList, () => queueListLoad(el.transferList, loadTransfers), { statuses: L.STOCK_TRANSFER_STATUS })],
    [el.stocktakeList, createListFilters(el.stocktakeList, () => queueListLoad(el.stocktakeList, loadStocktakes), { statuses: L.STOCKTAKE_STATUS })],
  ]);
  listFilters.get(el.stockinList).toolbar.querySelector('[data-list-q]').placeholder = 'Mã phiếu, nhà cung cấp, lô, linh kiện…';
  listFilters.get(el.stockoutList).toolbar.querySelector('[data-list-q]').placeholder = 'Mã phiếu, báo giá, kỹ thuật viên, linh kiện…';
  listFilters.get(el.transferList).toolbar.querySelector('[data-list-q]').placeholder = 'Mã phiếu, linh kiện, kệ, lý do…';
  listFilters.get(el.stocktakeList).toolbar.querySelector('[data-list-q]').placeholder = 'Mã phiếu, phạm vi, linh kiện, kệ…';

  function createPage(container, reload, label) {
    const pager = document.createElement('nav');
    pager.className = 'pagination inventory-document-pagination';
    pager.setAttribute('aria-label', `Phân trang ${label}`);
    pager.innerHTML = html`<label class="pagination__rows">Hiển thị <select class="select-field" data-document-size aria-label="Số phiếu mỗi trang"><option value="25">25</option><option value="50">50</option><option value="100">100</option></select> phiếu / trang</label>
      <span data-document-count role="status">Chưa tải</span><div class="pagination__nav"><button type="button" class="btn btn--secondary" data-document-prev disabled>← Trước</button><button type="button" class="btn btn--secondary" data-document-next disabled>Sau →</button></div>`;
    container.after(pager);
    const state = { page: 0, size: 25, sequence: 0, loaded: false, timer: null, pager, reload };
    pager.querySelector('[data-document-prev]').addEventListener('click', () => { state.page--; reload(); });
    pager.querySelector('[data-document-next]').addEventListener('click', () => { state.page++; reload(); });
    pager.querySelector('[data-document-size]').addEventListener('change', e => { state.page=0; state.size=Number(e.target.value); reload(); });
    return state;
  }

  function queueListLoad(container, reload) {
    const page = listPages.get(container);
    page.page=0; page.sequence++; page.loaded=false;
    page.pager.querySelectorAll('button').forEach(button => button.disabled=true);
    clearTimeout(page.timer); page.timer=setTimeout(reload,250);
  }

  function loadCurrentList() {
    const current = { stockin: [el.stockinList,loadReceipts], stockout: [el.stockoutList,loadIssues], transfer: [el.transferList,loadTransfers], stocktake: [el.stocktakeList,loadStocktakes] }[(location.hash || '').slice(1)];
    if (current && !listPages.get(current[0]).loaded) current[1]();
  }

  /* ---------------------------------------------------------------------- */
  /* Tồn kho (UI 17A–C): Tồn thực tế / Đã giữ / Tồn khả dụng                 */
  /* ---------------------------------------------------------------------- */

  function stockBadge(p) {
    if (p.available <= 0) return fmt.badge("danger", "Hết hàng");
    if (p.lowStock) return fmt.badge("warning", "Tồn thấp");
    return fmt.badge("success", "Đủ hàng");
  }

  function renderInventory() {
    if (state.invLoading) {
      ui.skeletonRows(el.invTbody, INVENTORY_COLUMNS, 6);
      el.invCount.textContent = "Đang tải…";
      return;
    }
    if (state.invError) {
      ui.tableState(el.invTbody, INVENTORY_COLUMNS, "error", { title: "Không thể tải tồn kho", desc: state.invError.detail }, loadParts);
      el.invCount.textContent = "Lỗi tải dữ liệu";
      return;
    }
    const { group, status, q } = state.filters;
    const needle = q.trim().toLowerCase();
    const list = state.parts.filter((p) => {
      if (group !== "all" && p.categoryCode !== group) return false;
      if (status === "out" && p.available > 0) return false;
      if (status === "low" && !(p.lowStock && p.available > 0)) return false;
      if (status === "ok" && p.lowStock) return false;
      return !needle || p.sku.toLowerCase().includes(needle) || p.name.toLowerCase().includes(needle);
    });
    el.invCount.textContent = `${list.length} SKU`;
    if (list.length === 0) {
      const filtered = group !== "all" || status !== "all" || needle;
      ui.tableState(el.invTbody, INVENTORY_COLUMNS, filtered ? "filtered" : "empty", {
        title: filtered ? "Không tìm thấy linh kiện phù hợp" : "Chưa có linh kiện nào trong kho",
      });
      return;
    }
    el.invTbody.innerHTML = html`${list.map((p) => html`
      <tr>
        <td class="mono cell-primary">${p.sku}</td>
        <td>${p.name}</td>
        <td>${L.CATEGORY[p.categoryCode] || "—"}</td>
        <td>${p.brandName || "—"}</td>
        <td>${p.onHand}</td>
        <td>${p.reserved}</td>
        <td><strong>${p.available}</strong></td>
        <td>${p.minLevel}</td>
        <td>${stockBadge(p)}${p.lowStockReason ? html`<div class="cell-muted" style="font-size:12px; margin-top:2px;">${p.lowStockReason}</div>` : ""}</td>
        <td class="mono">${(p.bins || []).filter((b) => b.qty > 0).map((b) => `${b.binCode} (${b.qty})`).join(", ") || p.primaryBin}</td>
        <td><button type="button" class="btn btn--secondary btn--sm" data-ledger="${p.sku}" aria-label="Lịch sử biến động ${p.sku}">Lịch sử</button></td>
      </tr>`)}`;
    el.invTbody.querySelectorAll("[data-ledger]").forEach((btn) => btn.addEventListener("click", () => openLedger(btn.getAttribute("data-ledger"))));
  }

  async function loadParts() {
    state.invLoading = true;
    state.invError = null;
    renderInventory();
    try {
      state.parts = await api.inventory.parts({});
    } catch (error) {
      state.invError = error;
    }
    state.invLoading = false;
    renderInventory();
  }

  /* ---------------------------------------------------------------------- */
  /* Danh sách phiếu                                                         */
  /* ---------------------------------------------------------------------- */

  function requestRow(code, meta, badge, action) {
    return html`
      <div class="request-row">
        <div class="request-row__main">
          <span class="request-row__title mono">${code}</span>
          <span class="request-row__meta">${meta}</span>
        </div>
        <div class="request-row__right">${badge}${action}</div>
      </div>`;
  }

  async function loadList(container, loader, render, emptyText) {
    const state = listPages.get(container), filters = listFilters.get(container).values(), sequence = ++state.sequence;
    state.loaded=false;
    const count = state.pager.querySelector('[data-document-count]');
    state.pager.querySelectorAll('button').forEach(button => button.disabled=true);
    if (filters.from && filters.to && filters.from > filters.to) {
      count.textContent='Khoảng ngày chưa hợp lệ';
      ui.blockState(container,'empty',{desc:'Vui lòng chọn lại khoảng ngày.'}); return [];
    }
    ui.blockState(container, "loading"); count.textContent='Đang tải…';
    try {
      const page = await loader({status:filters.status || null,q:filters.q.trim() || null,
        from:filters.from ? `${filters.from}T00:00:00+07:00` : null,to:filters.to ? `${filters.to}T23:59:59+07:00` : null,
        sort:filters.sort || 'newest',page:state.page,size:state.size});
      if(sequence!==state.sequence) return null;
      const totalPages=Math.max(1,page.totalPages);
      if(state.page>=totalPages) {state.page=totalPages-1; return loadList(container,loader,render,emptyText);}
      state.loaded=true;
      count.textContent=`${page.totalItems} phiếu · Trang ${state.page+1}/${totalPages}`;
      state.pager.querySelector('[data-document-prev]').disabled=state.page<=0;
      state.pager.querySelector('[data-document-next]').disabled=state.page+1>=totalPages;
      if(!page.items.length) ui.blockState(container,'empty',{desc:filters.q || filters.status || filters.from || filters.to ? 'Không có phiếu khớp bộ lọc. Thử đổi từ khóa, trạng thái hoặc khoảng ngày.' : emptyText});
      else container.innerHTML=html`${page.items.map(render)}`;
      return page.items;
    } catch(error) {
      if(sequence!==state.sequence) return null;
      count.textContent='Không thể tải dữ liệu';
      ui.blockState(container,'error',{desc:error.detail},state.reload);
      return [];
    }
  }

  async function loadReceipts() {
    const items = await loadList(
      el.stockinList,
      api.inventory.searchReceipts,
      (r) => requestRow(
        r.code,
        `${state.suppliers[r.supplierId] || r.supplierId} · Lô ${r.batchNo || "—"} · Ngày nhập ${fmt.date(r.receivedOn)} · ${r.lines.length} dòng`,
        fmt.badgeOf(L.STOCK_RECEIPT_STATUS, r.status),
        html`<button type="button" class="btn btn--secondary btn--sm" data-view-receipt="${r.code}">${r.status === "PENDING" ? "Xem & duyệt" : "Xem chi tiết"}</button>`
      ),
      "Chưa có phiếu nhập kho nào."
    );
    if (!items) return;
    state.receipts = items;
    el.stockinList.querySelectorAll("[data-view-receipt]").forEach((btn) =>
      btn.addEventListener("click", () => openReceipt(btn.getAttribute("data-view-receipt")))
    );
  }

  async function loadIssues() {
    const items = await loadList(
      el.stockoutList,
      api.inventory.searchIssues,
      (i) => requestRow(
        i.code,
        html`<span class="mono">${i.ticketCode}</span> · ${i.technicianName || i.technicianId} · ${i.lines.map((l) => `${partName(l.sku)} × ${l.quantity}`).join(", ")} · ${fmt.dateTime(i.requestedAt)}`,
        fmt.badgeOf(L.STOCK_ISSUE_STATUS, i.status),
        html`<button type="button" class="btn btn--secondary btn--sm" data-view-issue="${i.code}">${i.status === "PENDING" ? "Xem & duyệt" : "Xem chi tiết"}</button>`
      ),
      "Chưa có phiếu xuất kho nào."
    );
    if (!items) return;
    state.issues = items;
    el.stockoutList.querySelectorAll("[data-view-issue]").forEach((btn) =>
      btn.addEventListener("click", () => openIssue(btn.getAttribute("data-view-issue")))
    );
  }

  async function loadTransfers() {
    const items = await loadList(
      el.transferList,
      api.inventory.searchTransfers,
      (t) => requestRow(
        t.code,
        html`<span class="mono">${t.sku}</span> · ${partName(t.sku)} × ${t.quantity} · <span class="mono">${t.fromBin}</span> → <span class="mono">${t.toBin}</span>`,
        fmt.badgeOf(L.STOCK_TRANSFER_STATUS, t.status),
        html`<button type="button" class="btn btn--secondary btn--sm" data-view-transfer="${t.code}">${t.status === "PENDING" ? "Xem & duyệt" : "Xem chi tiết"}</button>`
      ),
      "Chưa có phiếu điều chuyển nào."
    );
    if (!items) return;
    state.transfers = items;
    el.transferList.querySelectorAll("[data-view-transfer]").forEach((btn) =>
      btn.addEventListener("click", () => openTransfer(btn.getAttribute("data-view-transfer")))
    );
  }

  function refreshAll() {
    loadParts();
    listPages.forEach(page => { page.loaded=false; });
    loadCurrentList();
  }

  /* ---------------------------------------------------------------------- */
  /* Phiếu nhập kho (BR-36, D-013)                                           */
  /* ---------------------------------------------------------------------- */

  function renderCreateItems() {
    el.createItems.innerHTML = html`${state.createItems.map((item, i) => html`
      <div class="item-row" style="grid-template-columns: minmax(0,1.4fr) 70px 110px minmax(0,1fr) 28px;" data-create-item="${i}">
        <select data-item="sku" aria-label="Chọn linh kiện">
          <option value="">— Chọn linh kiện —</option>
          ${state.parts.map((p) => html`<option value="${p.sku}" ${p.sku === item.sku ? html`selected` : ""}>${p.sku} — ${p.name}</option>`)}
        </select>
        <input type="number" min="1" placeholder="SL" value="${item.quantity}" data-item="quantity" aria-label="Số lượng" />
        <input type="number" min="0" step="1000" placeholder="Đơn giá nhập" value="${item.unitCost}" data-item="unitCost" aria-label="Đơn giá nhập" />
        <input type="text" placeholder="Serial/Batch" value="${item.serialBatch}" data-item="serialBatch" aria-label="Serial hoặc số batch" />
        <button type="button" class="item-row__remove" data-remove-item="${i}" aria-label="Xoá dòng">×</button>
      </div>`)}`;
    el.createItems.querySelectorAll("[data-create-item]").forEach((row) => {
      const item = state.createItems[Number(row.getAttribute("data-create-item"))];
      row.querySelectorAll("[data-item]").forEach((input) => {
        input.addEventListener("input", () => {
          item[input.getAttribute("data-item")] = input.value;
        });
      });
    });
    el.createItems.querySelectorAll("[data-remove-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (state.createItems.length > 1) state.createItems.splice(Number(btn.getAttribute("data-remove-item")), 1);
        renderCreateItems();
      });
    });
  }

  function openCreateReceipt() {
    state.createItems = [{ sku: "", quantity: 1, unitCost: "", serialBatch: "" }];
    el.createSupplier.value = "";
    el.createBatch.value = "";
    el.createNote.value = "";
    el.createDate.value = new Date().toISOString().slice(0, 10);
    el.createItemsError.hidden = true;
    renderCreateItems();
    window.openDialog(el.createDrawer);
  }

  async function submitCreateReceipt() {
    const lines = state.createItems
      .filter((i) => i.sku)
      .map((i) => ({ sku: i.sku, quantity: Number(i.quantity), unitCost: Number(i.unitCost || 0), serialBatch: i.serialBatch || null, binCode: null }));
    const fail = (node, message) => {
      node.textContent = message;
      node.hidden = false;
    };
    el.createItemsError.hidden = true;
    if (!el.createSupplier.value) return fail(el.createItemsError, "Vui lòng chọn nhà cung cấp.");
    if (lines.length === 0) return fail(el.createItemsError, "Vui lòng thêm ít nhất một linh kiện.");
    if (lines.some((l) => !(l.quantity > 0))) return fail(el.createItemsError, "Số lượng nhập phải lớn hơn 0.");
    if (lines.some((l) => !(l.unitCost >= 0))) return fail(el.createItemsError, "Đơn giá nhập không hợp lệ.");
    try {
      const receipt = await ui.busy(el.createSubmit, () =>
        api.inventory.createReceipt({
          supplierId: el.createSupplier.value,
          batchNo: el.createBatch.value.trim() || null,
          receivedOn: el.createDate.value || null,
          note: el.createNote.value.trim() || null,
          lines,
        })
      );
      window.closeDialog(el.createDrawer);
      window.showToast(`Đã tạo phiếu nhập ${receipt.code} — chờ duyệt.`, "success");
      loadReceipts();
    } catch (error) {
      ui.showError(error);
    }
    return undefined;
  }

  function openReceipt(code) {
    const r = state.receipts.find((x) => x.code === code);
    if (!r) return;
    state.activeReceipt = r;
    el.stockinSubtitle.textContent = r.code;
    el.stockinSupplier.textContent = state.suppliers[r.supplierId] || r.supplierId;
    el.stockinBatch.textContent = r.batchNo || "—";
    el.stockinDate.textContent = fmt.date(r.receivedOn);
    el.stockinStatus.innerHTML = html`${fmt.badgeOf(L.STOCK_RECEIPT_STATUS, r.status)}`;
    el.stockinItems.innerHTML = html`${r.lines.map((l) => html`
      <tr><td class="mono">${l.sku}</td><td>${partName(l.sku)}</td><td>${l.quantity}</td><td class="mono">${l.serialBatch || "—"}</td></tr>`)}`;
    const pending = r.status === "PENDING";
    el.stockinApprove.hidden = !pending;
    el.stockinReject.hidden = !pending;
    window.openDialog(el.stockinDrawer);
  }

  async function approveReceipt() {
    const r = state.activeReceipt;
    try {
      await ui.busy(el.stockinApprove, () => api.inventory.approveReceipt(r.code));
      window.closeDialog(el.stockinDrawer);
      window.showToast(`Đã duyệt & thực nhập kho phiếu ${r.code}.`, "success");
      loadReceipts();
      loadParts();
    } catch (error) {
      ui.showError(error);
    }
  }

  async function rejectReceipt() {
    const r = state.activeReceipt;
    const reason = await ui.promptReason({
      title: "Từ chối phiếu nhập kho?",
      message: `Phiếu ${r.code} sẽ được chuyển sang trạng thái Từ chối.`,
      label: "Lý do từ chối",
      confirmLabel: "Từ chối phiếu nhập",
    });
    if (!reason) return;
    try {
      await api.inventory.rejectReceipt(r.code, reason);
      window.closeDialog(el.stockinDrawer);
      window.showToast(`Đã từ chối phiếu nhập ${r.code}.`, "success");
      loadReceipts();
    } catch (error) {
      ui.showError(error);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Phiếu xuất kho (T9/T9b — mục 36: tự trừ tồn)                            */
  /* ---------------------------------------------------------------------- */

  function openIssue(code) {
    const issue = state.issues.find((x) => x.code === code);
    if (!issue) return;
    state.activeIssue = issue;
    const pending = issue.status === "PENDING";
    el.stockoutSubtitle.textContent = issue.code;
    el.stockoutTicket.textContent = issue.ticketCode;
    el.stockoutTech.textContent = issue.technicianName || issue.technicianId;
    el.stockoutSource.textContent = issue.source === "QUOTATION" ? `Theo báo giá ${issue.quotationCode}` : "Bảo hành miễn phí";
    el.stockoutStatus.innerHTML = html`${fmt.badgeOf(L.STOCK_ISSUE_STATUS, issue.status)}${issue.rejectedReason ? html` <span class="cell-muted">— ${issue.rejectedReason}</span>` : ""}`;
    el.stockoutLines.innerHTML = html`${issue.lines.map((line) => {
      const part = state.parts.find((p) => p.sku === line.sku) || { bins: [] };
      const bins = (part.bins || []).filter((b) => b.qty > 0);
      return html`
        <tr>
          <td class="mono">${line.sku}</td>
          <td>${part.name || "—"}</td>
          <td>${line.quantity}</td>
          <td>${part.onHand ?? "—"} / ${part.reserved ?? "—"}</td>
          <td>${pending
            ? html`<select data-issue-bin="${line.sku}" aria-label="Kệ/Ngăn xuất cho ${line.sku}">
                ${bins.map((b) => html`<option value="${b.binCode}" ${b.binCode === part.primaryBin ? html`selected` : ""}>${b.binCode} (còn ${b.qty})</option>`)}
              </select>`
            : html`<span class="mono">${line.binCode || "—"}</span>`}</td>
        </tr>`;
    })}`;
    el.stockoutApprove.hidden = !pending;
    el.stockoutReject.hidden = !pending;
    window.openDialog(el.stockoutDrawer);
  }

  async function approveIssue() {
    const issue = state.activeIssue;
    const lineBins = Array.from(el.stockoutLines.querySelectorAll("[data-issue-bin]")).map((select) => ({
      sku: select.getAttribute("data-issue-bin"),
      binCode: select.value,
    }));
    try {
      const result = await ui.busy(el.stockoutApprove, () => api.inventory.approveIssue(issue.code, lineBins));
      window.closeDialog(el.stockoutDrawer);
      result.deductions.forEach((d) => window.showToast(`Đã trừ ${d.quantity} ${d.name} khỏi tồn kho.`, "success"));
      loadIssues();
      loadParts();
    } catch (error) {
      ui.showError(error);
    }
  }

  async function rejectIssue() {
    const issue = state.activeIssue;
    const reason = await ui.promptReason({
      title: "Từ chối phiếu xuất kho?",
      message: `Phiếu ${issue.code} sẽ được chuyển sang trạng thái Từ chối và giải phóng số lượng đã giữ.`,
      label: "Lý do từ chối",
      confirmLabel: "Từ chối phiếu xuất kho",
    });
    if (!reason) return;
    try {
      await api.inventory.rejectIssue(issue.code, reason);
      window.closeDialog(el.stockoutDrawer);
      window.showToast(`Đã từ chối phiếu xuất ${issue.code}.`, "success");
      loadIssues();
      loadParts();
    } catch (error) {
      ui.showError(error);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Điều chuyển kệ/ngăn (D-011)                                             */
  /* ---------------------------------------------------------------------- */

  function openCreateTransfer() {
    ui.fillSelect(el.transferSku, state.parts.map((p) => ({ value: p.sku, label: `${p.sku} — ${p.name}` })));
    el.transferSku.value = "";
    el.transferInfo.hidden = true;
    el.transferQty.value = "";
    el.transferToBin.value = "";
    el.transferReason.value = "";
    window.openDialog(el.transferCreateDrawer);
  }

  async function submitTransfer() {
    const part = state.parts.find((p) => p.sku === el.transferSku.value);
    const quantity = Number(el.transferQty.value);
    const toBin = el.transferToBin.value.trim().toUpperCase();
    const reason = el.transferReason.value.trim();
    const errors = [];
    if (!part) errors.push("Vui lòng chọn linh kiện.");
    if (!(quantity > 0)) errors.push("Số lượng phải lớn hơn 0.");
    if (!BIN_PATTERN.test(toBin)) errors.push("Mã kệ/ngăn đích phải có dạng KHO-X-yy-zz.");
    if (part && toBin === part.primaryBin) errors.push("Kệ/ngăn đích phải khác kệ/ngăn hiện tại.");
    if (!reason) errors.push("Vui lòng nhập lý do điều chuyển.");
    if (errors.length) {
      window.showToast(errors[0], "error");
      return;
    }
    try {
      const transfer = await ui.busy(el.transferSubmit, () =>
        api.inventory.createTransfer({ sku: part.sku, quantity, fromBin: part.primaryBin, toBin, reason })
      );
      window.closeDialog(el.transferCreateDrawer);
      window.showToast(`Đã tạo phiếu điều chuyển ${transfer.code} — chờ duyệt.`, "success");
      loadTransfers();
    } catch (error) {
      ui.showError(error);
    }
  }

  function openTransfer(code) {
    const t = state.transfers.find((x) => x.code === code);
    if (!t) return;
    state.activeTransfer = t;
    el.transferSubtitle.textContent = t.code;
    el.transferDetailPart.innerHTML = html`<span class="mono">${t.sku}</span> — ${partName(t.sku)}`;
    el.transferDetailQty.textContent = t.quantity;
    el.transferDetailFrom.textContent = t.fromBin;
    el.transferDetailTo.textContent = t.toBin;
    el.transferDetailReason.textContent = t.reason || "—";
    const pending = t.status === "PENDING";
    el.transferApprove.hidden = !pending;
    el.transferReject.hidden = !pending;
    window.openDialog(el.transferDrawer);
  }

  async function approveTransfer() {
    const t = state.activeTransfer;
    try {
      await ui.busy(el.transferApprove, () => api.inventory.approveTransfer(t.code));
      window.closeDialog(el.transferDrawer);
      window.showToast(`Đã điều chuyển ${t.quantity} ${partName(t.sku)} sang ${t.toBin}.`, "success");
      loadTransfers();
      loadParts();
    } catch (error) {
      ui.showError(error);
    }
  }

  async function rejectTransfer() {
    const t = state.activeTransfer;
    const reason = await ui.promptReason({
      title: "Từ chối phiếu điều chuyển?",
      message: `Phiếu ${t.code} sẽ được chuyển sang trạng thái Từ chối.`,
      label: "Lý do từ chối",
      confirmLabel: "Từ chối phiếu điều chuyển",
    });
    if (!reason) return;
    try {
      await api.inventory.rejectTransfer(t.code, reason);
      window.closeDialog(el.transferDrawer);
      window.showToast(`Đã từ chối phiếu điều chuyển ${t.code}.`, "success");
      loadTransfers();
    } catch (error) {
      ui.showError(error);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Thẻ kho: biến động đã duyệt của một linh kiện, tồn sau mỗi lần          */
  /* ---------------------------------------------------------------------- */

  const MOVEMENT = {
    RECEIPT: { label: "Nhập kho", tone: "success" },
    ISSUE: { label: "Xuất cho phiếu sửa", tone: "processing" },
    TRANSFER_OUT: { label: "Điều chuyển đi", tone: "neutral" },
    TRANSFER_IN: { label: "Điều chuyển đến", tone: "neutral" },
    STOCKTAKE: { label: "Điều chỉnh kiểm kê", tone: "warning" },
  };

  function movementReference(m) {
    if (m.kind === "RECEIPT") return html`NCC ${m.reference || "—"}${m.note ? html` · lô ${m.note}` : ""}`;
    if (m.kind === "ISSUE") return html`Phiếu sửa <span class="mono">${m.reference || "—"}</span>`;
    if (m.kind === "TRANSFER_OUT") return html`Sang <span class="mono">${m.reference}</span>${m.note ? html` · ${m.note}` : ""}`;
    if (m.kind === "TRANSFER_IN") return html`Từ <span class="mono">${m.reference}</span>${m.note ? html` · ${m.note}` : ""}`;
    return html`${m.reference || ""}${m.note ? html` · ${m.note}` : ""}`;
  }

  async function openLedger(sku) {
    const part = state.parts.find((p) => p.sku === sku);
    el.ledgerSubtitle.innerHTML = html`<span class="mono">${sku}</span> — ${part ? part.name : ""}`;
    ui.blockState(el.ledgerBody, "loading");
    window.openDialog(el.ledgerDrawer);
    try {
      const ledger = await api.inventory.movements(sku);
      const totals = ledger.movements.reduce((sum, m) => {
        if (m.kind === "RECEIPT") sum.in += m.quantity;
        else if (m.kind === "ISSUE") sum.out -= m.quantity;
        else if (m.kind === "STOCKTAKE") sum.adjust += m.quantity;
        return sum;
      }, { in: 0, out: 0, adjust: 0 });
      el.ledgerBody.innerHTML = html`
        <dl class="ledger-stats">
          <div><dt>Tồn thực tế hiện tại</dt><dd>${ledger.onHand} ${ledger.unit || ""}</dd></div>
          <div><dt>Đang giữ cho phiếu sửa</dt><dd>${ledger.reserved}</dd></div>
          <div><dt>Tổng nhập / xuất</dt><dd>+${totals.in} / −${totals.out}</dd></div>
          <div><dt>Điều chỉnh kiểm kê</dt><dd>${totals.adjust > 0 ? "+" : ""}${totals.adjust}</dd></div>
        </dl>
        ${ledger.movements.length ? html`<div class="table-scroll stocktake-table-wrap" style="margin-top:16px;"><table class="drawer-table stocktake-table ledger-table">
          <thead><tr><th>Thời gian</th><th>Loại</th><th>Chứng từ</th><th>Kệ/Ngăn</th><th class="num">Số lượng</th><th class="num">Tồn sau</th><th>Diễn giải</th></tr></thead>
          <tbody>${ledger.movements.map((m) => html`<tr>
            <td style="white-space:nowrap;">${fmt.dateTime(m.at)}</td>
            <td>${fmt.badge((MOVEMENT[m.kind] || {}).tone || "neutral", (MOVEMENT[m.kind] || {}).label || m.kind)}</td>
            <td class="mono">${m.documentCode}</td>
            <td class="mono">${m.binCode}</td>
            <td class="num"><span class="stocktake-diff ${m.quantity < 0 ? "is-off" : ""}">${m.quantity > 0 ? "+" : ""}${m.quantity}</span></td>
            <td class="num"><strong>${m.balanceAfter}</strong></td>
            <td>${movementReference(m)}${m.actorId ? html`<div class="cell-muted">Duyệt: ${m.actorId}</div>` : ""}</td>
          </tr>`)}
          <tr class="ledger-opening"><td colspan="5">${ledger.truncated ? "Tồn trước các biến động trên (chỉ hiện 500 lần gần nhất)" : "Tồn ban đầu (khi tạo linh kiện / dữ liệu trước khi có chứng từ)"}</td><td class="num"><strong>${ledger.openingBalance}</strong></td><td></td></tr>
          </tbody></table></div>`
          : html`<div class="empty-selection-hint" style="margin-top:16px;">Chưa có biến động nào được duyệt. Tồn hiện tại là tồn ban đầu: ${ledger.openingBalance}.</div>`}`;
    } catch (error) {
      ui.blockState(el.ledgerBody, "error", { desc: error.detail }, () => openLedger(sku));
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Kiểm kê: đếm thực tế theo kệ, duyệt thì điều chỉnh tồn theo chênh lệch  */
  /* ---------------------------------------------------------------------- */

  const signed = (n) => (n > 0 ? `+${n}` : String(n));

  function stocktakeMeta(s) {
    const diff = s.discrepancyCount
      ? html`<strong class="stocktake-diff is-off">${s.discrepancyCount} dòng lệch</strong> (thừa ${s.surplus}, thiếu ${s.shortage})`
      : html`<span class="stocktake-diff">Khớp tồn hệ thống</span>`;
    return html`${s.scope} · ${s.lineCount} dòng · ${diff} · Lập ${fmt.dateTime(s.createdAt)} bởi ${s.requestedBy}`;
  }

  async function loadStocktakes() {
    const items = await loadList(
      el.stocktakeList,
      api.inventory.searchStocktakes,
      (s) => requestRow(
        s.code,
        stocktakeMeta(s),
        fmt.badgeOf(L.STOCKTAKE_STATUS, s.status),
        html`<button type="button" class="btn btn--secondary btn--sm" data-view-stocktake="${s.code}">${s.status === "PENDING" ? "Xem & duyệt" : "Xem chi tiết"}</button>`
      ),
      "Chưa có phiếu kiểm kê nào. Bấm “Lập phiếu kiểm kê” để bắt đầu đếm."
    );
    if (!items) return;
    state.stocktakes = items;
    el.stocktakeList.querySelectorAll("[data-view-stocktake]").forEach((btn) =>
      btn.addEventListener("click", () => openStocktake(btn.getAttribute("data-view-stocktake")))
    );
  }

  function openCreateStocktake() {
    state.sheet = [];
    el.stocktakeBin.value = "";
    el.stocktakeNote.value = "";
    el.stocktakeLines.innerHTML = html`<div class="empty-selection-hint">Chọn nhóm thiết bị và/hoặc khu kệ cần đếm (để trống = toàn kho), rồi bấm “Lấy danh sách cần đếm”.</div>`;
    el.stocktakeToolbar.hidden = true;
    window.openDialog(el.stocktakeCreateDrawer);
  }

  async function loadSheet() {
    const bin = el.stocktakeBin.value.trim().toUpperCase();
    if (bin && !/^KHO(-[A-Z](-\d{0,2}(-\d{0,2})?)?)?$/.test(bin)) {
      window.showToast("Khu/kệ phải bắt đầu dạng KHO-A, KHO-A-01 hoặc KHO-A-01-02.", "error");
      el.stocktakeBin.focus();
      return;
    }
    if (state.sheet.some((row) => row.counted !== "") && !(await ui.confirm({
      title: "Lấy lại danh sách cần đếm?", message: "Các số đã nhập ở danh sách hiện tại sẽ bị xóa.", confirmLabel: "Lấy lại danh sách",
    }))) return;
    try {
      const rows = await ui.busy(el.stocktakeLoad, () => api.inventory.stocktakeSheet({ category: el.stocktakeCategory.value || null, bin: bin || null }));
      state.sheet = rows.map((row) => ({ ...row, counted: "", note: "" }));
      renderSheet();
      el.stocktakeLines.querySelector("[data-count]")?.focus();
    } catch (error) {
      ui.showError(error);
    }
  }

  function sheetDiff(row) {
    return row.counted === "" ? null : Number(row.counted) - row.systemQty;
  }

  function renderSheetSummary() {
    const counted = state.sheet.filter((row) => row.counted !== "");
    const off = counted.filter((row) => sheetDiff(row) !== 0);
    const surplus = off.filter((row) => sheetDiff(row) > 0).reduce((sum, row) => sum + sheetDiff(row), 0);
    const shortage = -off.filter((row) => sheetDiff(row) < 0).reduce((sum, row) => sum + sheetDiff(row), 0);
    el.stocktakeSummary.innerHTML = html`Đã đếm <strong>${counted.length}/${state.sheet.length}</strong> dòng · ${off.length
      ? html`<strong class="stocktake-diff is-off">lệch ${off.length} dòng</strong> (thừa ${surplus}, thiếu ${shortage})`
      : html`<span class="stocktake-diff">chưa có dòng lệch</span>`}`;
  }

  function renderSheet() {
    el.stocktakeToolbar.hidden = !state.sheet.length;
    if (!state.sheet.length) {
      el.stocktakeLines.innerHTML = html`<div class="empty-selection-hint">Không có linh kiện nào trong phạm vi đã chọn. Thử đổi nhóm thiết bị hoặc khu kệ.</div>`;
      return;
    }
    el.stocktakeLines.innerHTML = html`<div class="table-scroll stocktake-table-wrap"><table class="drawer-table stocktake-table">
      <thead><tr><th>Kệ/Ngăn</th><th>Linh kiện</th><th class="num">Tồn hệ thống</th><th class="num">Thực tế</th><th class="num">Chênh lệch</th><th>Lý do chênh lệch</th></tr></thead>
      <tbody>${state.sheet.map((row, i) => html`<tr data-sheet-row="${i}">
        <td class="mono">${row.binCode}</td>
        <td><span class="mono">${row.sku}</span><div class="cell-muted">${row.name}</div></td>
        <td class="num">${row.systemQty}</td>
        <td class="num"><input type="number" min="0" step="1" inputmode="numeric" class="stocktake-count" value="${row.counted}" data-count aria-label="Số đếm thực tế ${row.sku} tại ${row.binCode}" /></td>
        <td class="num" data-diff>—</td>
        <td><input type="text" maxlength="255" value="${row.note}" placeholder="Bắt buộc khi lệch" data-note aria-label="Lý do chênh lệch ${row.sku}" /></td>
      </tr>`)}</tbody></table></div>`;
    el.stocktakeLines.querySelectorAll("[data-sheet-row]").forEach((tr) => {
      const row = state.sheet[Number(tr.getAttribute("data-sheet-row"))];
      const count = tr.querySelector("[data-count]");
      const note = tr.querySelector("[data-note]");
      const paint = () => {
        const diff = sheetDiff(row);
        const invalidCount = row.counted !== "" && (!/^\d+$/.test(row.counted));
        tr.classList.toggle("is-off", diff !== null && diff !== 0);
        count.setAttribute("aria-invalid", invalidCount ? "true" : "false");
        note.setAttribute("aria-invalid", diff && !row.note.trim() ? "true" : "false");
        tr.querySelector("[data-diff]").innerHTML = invalidCount ? html`<span class="stocktake-diff is-off">Số không hợp lệ</span>`
          : diff === null ? "—" : html`<span class="stocktake-diff ${diff ? "is-off" : ""}">${diff ? signed(diff) : "Khớp"}</span>`;
        renderSheetSummary();
      };
      count.addEventListener("input", () => { row.counted = count.value.trim(); paint(); });
      count.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const next = tr.nextElementSibling?.querySelector("[data-count]");
        if (next) next.focus();
      });
      note.addEventListener("input", () => { row.note = note.value; paint(); });
      paint();
    });
  }

  function fillSystemQty() {
    state.sheet.forEach((row) => { if (row.counted === "") row.counted = String(row.systemQty); });
    renderSheet();
  }

  async function submitStocktake() {
    if (!state.sheet.length) {
      window.showToast("Chưa có dòng nào — bấm “Lấy danh sách cần đếm” trước.", "error");
      return;
    }
    const firstProblem = state.sheet.findIndex((row) => row.counted === "" || !/^\d+$/.test(row.counted) || (sheetDiff(row) !== 0 && !row.note.trim()));
    if (firstProblem >= 0) {
      const row = state.sheet[firstProblem];
      const tr = el.stocktakeLines.querySelector(`[data-sheet-row="${firstProblem}"]`);
      const missingCount = row.counted === "" || !/^\d+$/.test(row.counted);
      window.showToast(missingCount
        ? `Chưa nhập số đếm hợp lệ cho ${row.sku} tại ${row.binCode} (còn ${state.sheet.filter((r) => r.counted === "").length} dòng chưa đếm).`
        : `Vui lòng ghi lý do chênh lệch cho ${row.sku} tại ${row.binCode} (lệch ${signed(sheetDiff(row))}).`, "error");
      tr.querySelector(missingCount ? "[data-count]" : "[data-note]").focus();
      return;
    }
    const scope = [el.stocktakeCategory.value ? `Nhóm ${L.CATEGORY[el.stocktakeCategory.value] || el.stocktakeCategory.value}` : "",
      el.stocktakeBin.value.trim() ? `Khu ${el.stocktakeBin.value.trim().toUpperCase()}` : ""].filter(Boolean).join(" · ") || "Toàn kho";
    try {
      const created = await ui.busy(el.stocktakeSubmit, () => api.inventory.createStocktake({
        scope,
        note: el.stocktakeNote.value.trim() || null,
        lines: state.sheet.map((row) => ({ sku: row.sku, binCode: row.binCode, countedQty: Number(row.counted), note: row.note.trim() || null })),
      }));
      window.closeDialog(el.stocktakeCreateDrawer);
      window.showToast(`Đã lập phiếu kiểm kê ${created.code} — ${created.discrepancyCount ? `${created.discrepancyCount} dòng lệch, ` : ""}chờ duyệt.`, "success");
      state.sheet = [];
      listPages.get(el.stocktakeList).page = 0;
      loadStocktakes();
    } catch (error) {
      ui.showError(error);
    }
  }

  function openStocktake(code) {
    const s = state.stocktakes.find((x) => x.code === code);
    if (!s) return;
    state.activeStocktake = s;
    el.stocktakeSubtitle.innerHTML = html`<span class="mono">${s.code}</span> · ${L.STOCKTAKE_STATUS[s.status].label}`;
    const off = s.lines.filter((line) => line.difference !== 0);
    const lines = (list) => html`<div class="table-scroll stocktake-table-wrap"><table class="drawer-table stocktake-table">
      <thead><tr><th>Kệ/Ngăn</th><th>Linh kiện</th><th class="num">Tồn hệ thống</th><th class="num">Thực tế</th><th class="num">Chênh lệch</th><th>Lý do</th></tr></thead>
      <tbody>${list.map((line) => html`<tr class="${line.difference ? "is-off" : ""}">
        <td class="mono">${line.binCode}</td><td><span class="mono">${line.sku}</span><div class="cell-muted">${line.name}</div></td>
        <td class="num">${line.systemQty}</td><td class="num">${line.countedQty}</td>
        <td class="num"><span class="stocktake-diff ${line.difference ? "is-off" : ""}">${line.difference ? signed(line.difference) : "Khớp"}</span></td>
        <td>${line.note || "—"}</td></tr>`)}</tbody></table></div>`;
    el.stocktakeDetail.innerHTML = html`
      <div class="detail-grid">
        <div class="detail-grid__item"><span class="kv-key">Phạm vi</span><span>${s.scope}</span></div>
        <div class="detail-grid__item"><span class="kv-key">Người lập</span><span>${s.requestedBy} · ${fmt.dateTime(s.createdAt)}</span></div>
        <div class="detail-grid__item"><span class="kv-key">Kết quả đếm</span><span>${s.lineCount} dòng · ${s.discrepancyCount ? html`<strong class="stocktake-diff is-off">${s.discrepancyCount} dòng lệch</strong> (thừa ${s.surplus}, thiếu ${s.shortage})` : "Khớp toàn bộ"}</span></div>
        ${s.processedBy ? html`<div class="detail-grid__item"><span class="kv-key">${s.status === "REJECTED" ? "Người từ chối" : "Người duyệt"}</span><span>${s.processedBy} · ${fmt.dateTime(s.processedAt)}</span></div>` : ""}
        ${s.note ? html`<div class="detail-grid__item detail-grid__item--wide"><span class="kv-key">Ghi chú</span><span>${s.note}</span></div>` : ""}
        ${s.rejectedReason ? html`<div class="detail-grid__item detail-grid__item--wide"><span class="kv-key">Lý do từ chối</span><span>${s.rejectedReason}</span></div>` : ""}
      </div>
      ${s.status === "PENDING" && off.length ? html`<div class="stocktake-note" role="note">Khi duyệt, tồn kho được cộng/trừ đúng phần chênh lệch của ${off.length} dòng dưới đây (tính theo tồn lúc đếm, nên phiếu nhập/xuất phát sinh sau lúc đếm vẫn được giữ).</div>` : ""}
      <hr class="section-divider" />
      <h3 class="card__title card__title--sm" style="margin-bottom:10px;">${off.length ? `Dòng chênh lệch (${off.length})` : "Không có dòng chênh lệch"}</h3>
      ${off.length ? lines(off) : html`<p class="cell-muted">Số đếm khớp tồn hệ thống ở mọi dòng — duyệt phiếu chỉ ghi nhận kết quả kiểm kê, không thay đổi tồn.</p>`}
      ${s.lines.length > off.length ? html`<details class="stocktake-matched"><summary>Xem ${s.lines.length - off.length} dòng khớp</summary>${lines(s.lines.filter((line) => line.difference === 0))}</details>` : ""}`;
    const pending = s.status === "PENDING";
    el.stocktakeApprove.hidden = !pending;
    el.stocktakeReject.hidden = !pending;
    window.openDialog(el.stocktakeDrawer);
  }

  async function approveStocktake() {
    const s = state.activeStocktake;
    const confirmed = await ui.confirm({
      title: "Duyệt phiếu kiểm kê và điều chỉnh tồn?",
      message: s.discrepancyCount
        ? `Tồn kho sẽ được điều chỉnh ${s.discrepancyCount} dòng: cộng ${s.surplus}, trừ ${s.shortage}. Thao tác được ghi vào nhật ký và không hoàn tác tự động.`
        : "Số đếm khớp tồn hệ thống — phiếu được ghi nhận, tồn kho không đổi.",
      confirmLabel: "Duyệt & Điều chỉnh tồn",
      destructive: false,
    });
    if (!confirmed) return;
    try {
      await ui.busy(el.stocktakeApprove, () => api.inventory.approveStocktake(s.code));
      window.closeDialog(el.stocktakeDrawer);
      window.showToast(`Đã duyệt phiếu kiểm kê ${s.code}${s.discrepancyCount ? " và điều chỉnh tồn kho" : ""}.`, "success");
      loadStocktakes();
      loadParts();
    } catch (error) {
      ui.showError(error);
    }
  }

  async function rejectStocktake() {
    const s = state.activeStocktake;
    const reason = await ui.promptReason({
      title: "Từ chối phiếu kiểm kê?",
      message: `Phiếu ${s.code} chuyển sang Từ chối, tồn kho không thay đổi. Có thể lập phiếu mới để đếm lại.`,
      label: "Lý do từ chối",
      confirmLabel: "Từ chối phiếu kiểm kê",
      placeholder: "VD: Cần đếm lại khu KHO-A",
    });
    if (!reason) return;
    try {
      await api.inventory.rejectStocktake(s.code, reason);
      window.closeDialog(el.stocktakeDrawer);
      window.showToast(`Đã từ chối phiếu kiểm kê ${s.code}.`, "success");
      loadStocktakes();
    } catch (error) {
      ui.showError(error);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Khởi tạo                                                               */
  /* ---------------------------------------------------------------------- */

  function bindDrawer(overlay, closeSelectors) {
    closeSelectors.forEach((selector) => {
      const node = $(selector);
      if (node) node.addEventListener("click", () => window.closeDialog(overlay));
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) window.closeDialog(overlay);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.hasAttribute("hidden")) window.closeDialog(overlay);
    });
  }

  function bindEvents() {
    el.invGroup.addEventListener("change", () => {
      state.filters.group = el.invGroup.value;
      renderInventory();
    });
    el.invStatus.addEventListener("change", () => {
      state.filters.status = el.invStatus.value;
      renderInventory();
    });
    el.invSearch.addEventListener("input", () => {
      state.filters.q = el.invSearch.value;
      renderInventory();
    });

    bindDrawer(el.createDrawer, ["[data-create-stockin-close]", "[data-create-stockin-cancel]"]);
    bindDrawer(el.stockinDrawer, ["[data-stockin-drawer-close]"]);
    bindDrawer(el.stockoutDrawer, ["[data-stockout-drawer-close]"]);
    bindDrawer(el.transferCreateDrawer, ["[data-create-transfer-close]", "[data-create-transfer-cancel]"]);
    bindDrawer(el.transferDrawer, ["[data-transfer-drawer-close]"]);

    $("[data-open-create-stockin]").addEventListener("click", openCreateReceipt);
    $("[data-add-item-row]").addEventListener("click", () => {
      state.createItems.push({ sku: "", quantity: 1, unitCost: "", serialBatch: "" });
      renderCreateItems();
    });
    el.createSubmit.addEventListener("click", submitCreateReceipt);
    el.stockinApprove.addEventListener("click", approveReceipt);
    el.stockinReject.addEventListener("click", rejectReceipt);
    el.stockoutApprove.addEventListener("click", approveIssue);
    el.stockoutReject.addEventListener("click", rejectIssue);
    $("[data-open-create-transfer]").addEventListener("click", openCreateTransfer);
    el.transferSku.addEventListener("change", () => {
      const part = state.parts.find((p) => p.sku === el.transferSku.value);
      el.transferInfo.hidden = !part;
      if (!part) return;
      el.transferOnhand.textContent = part.onHand;
      el.transferCurrentBin.textContent = part.primaryBin;
    });
    el.transferSubmit.addEventListener("click", submitTransfer);
    el.transferApprove.addEventListener("click", approveTransfer);
    el.transferReject.addEventListener("click", rejectTransfer);

    bindDrawer(el.ledgerDrawer, ["[data-ledger-close]"]);
    bindDrawer(el.stocktakeCreateDrawer, ["[data-create-stocktake-close]", "[data-create-stocktake-cancel]"]);
    bindDrawer(el.stocktakeDrawer, ["[data-stocktake-drawer-close]"]);
    $("[data-open-create-stocktake]").addEventListener("click", openCreateStocktake);
    el.stocktakeLoad.addEventListener("click", loadSheet);
    el.stocktakeBin.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); loadSheet(); } });
    el.stocktakeFill.addEventListener("click", fillSystemQty);
    el.stocktakeSubmit.addEventListener("click", submitStocktake);
    el.stocktakeApprove.addEventListener("click", approveStocktake);
    el.stocktakeReject.addEventListener("click", rejectStocktake);
  }

  window.LML_AUTH.ready(async () => {
    ui.fillSelect(el.invGroup, Object.entries(L.CATEGORY).map(([value, label]) => ({ value, label })));
    ui.fillSelect(el.stocktakeCategory, Object.entries(L.CATEGORY).map(([value, label]) => ({ value, label })));
    bindEvents();
    try {
      const suppliers = await api.catalog.list("suppliers");
      state.suppliers = Object.fromEntries(suppliers.map((s) => [s._id, s.name]));
      ui.fillSelect(el.createSupplier, suppliers.filter((s) => s.active !== false).map((s) => ({ value: s._id, label: s.name })));
    } catch (error) {
      ui.showError(error);
    }
    await loadParts();
    document.addEventListener("lml:panel-shown", loadCurrentList);
    loadCurrentList();
    setInterval(refreshAll, 60 * 1000);
  });
}
