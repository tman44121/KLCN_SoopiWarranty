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
  const INVENTORY_COLUMNS = 10;
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
  };

  const partName = (sku) => (state.parts.find((p) => p.sku === sku) || {}).name || "—";
  const pendingFirst = (a, b) => (a.status === "PENDING" ? 0 : 1) - (b.status === "PENDING" ? 0 : 1);

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
      </tr>`)}`;
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
    ui.blockState(container, "loading");
    try {
      const items = (await loader()).sort(pendingFirst);
      if (items.length === 0) {
        ui.blockState(container, "empty", { desc: emptyText });
        return items;
      }
      container.innerHTML = html`${items.map(render)}`;
      return items;
    } catch (error) {
      ui.blockState(container, "error", { desc: error.detail }, () => loadList(container, loader, render, emptyText));
      return [];
    }
  }

  async function loadReceipts() {
    state.receipts = await loadList(
      el.stockinList,
      () => api.inventory.receipts(),
      (r) => requestRow(
        r.code,
        `${state.suppliers[r.supplierId] || r.supplierId} · Lô ${r.batchNo || "—"} · Ngày nhập ${fmt.date(r.receivedOn)} · ${r.lines.length} dòng`,
        fmt.badgeOf(L.STOCK_RECEIPT_STATUS, r.status),
        html`<button type="button" class="btn btn--secondary btn--sm" data-view-receipt="${r.code}">${r.status === "PENDING" ? "Xem & duyệt" : "Xem chi tiết"}</button>`
      ),
      "Chưa có phiếu nhập kho nào."
    );
    el.stockinList.querySelectorAll("[data-view-receipt]").forEach((btn) =>
      btn.addEventListener("click", () => openReceipt(btn.getAttribute("data-view-receipt")))
    );
  }

  async function loadIssues() {
    state.issues = await loadList(
      el.stockoutList,
      () => api.inventory.issues(),
      (i) => requestRow(
        i.code,
        html`<span class="mono">${i.ticketCode}</span> · ${i.technicianName || i.technicianId} · ${i.lines.map((l) => `${partName(l.sku)} × ${l.quantity}`).join(", ")} · ${fmt.dateTime(i.requestedAt)}`,
        fmt.badgeOf(L.STOCK_ISSUE_STATUS, i.status),
        html`<button type="button" class="btn btn--secondary btn--sm" data-view-issue="${i.code}">${i.status === "PENDING" ? "Xem & duyệt" : "Xem chi tiết"}</button>`
      ),
      "Chưa có phiếu xuất kho nào."
    );
    el.stockoutList.querySelectorAll("[data-view-issue]").forEach((btn) =>
      btn.addEventListener("click", () => openIssue(btn.getAttribute("data-view-issue")))
    );
  }

  async function loadTransfers() {
    state.transfers = await loadList(
      el.transferList,
      () => api.inventory.transfers(),
      (t) => requestRow(
        t.code,
        html`<span class="mono">${t.sku}</span> · ${partName(t.sku)} × ${t.quantity} · <span class="mono">${t.fromBin}</span> → <span class="mono">${t.toBin}</span>`,
        fmt.badgeOf(L.STOCK_TRANSFER_STATUS, t.status),
        html`<button type="button" class="btn btn--secondary btn--sm" data-view-transfer="${t.code}">${t.status === "PENDING" ? "Xem & duyệt" : "Xem chi tiết"}</button>`
      ),
      "Chưa có phiếu điều chuyển nào."
    );
    el.transferList.querySelectorAll("[data-view-transfer]").forEach((btn) =>
      btn.addEventListener("click", () => openTransfer(btn.getAttribute("data-view-transfer")))
    );
  }

  function refreshAll() {
    loadParts();
    loadReceipts();
    loadIssues();
    loadTransfers();
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
  }

  window.LML_AUTH.ready(async () => {
    ui.fillSelect(el.invGroup, Object.entries(L.CATEGORY).map(([value, label]) => ({ value, label })));
    bindEvents();
    try {
      const suppliers = await api.catalog.list("suppliers");
      state.suppliers = Object.fromEntries(suppliers.map((s) => [s._id, s.name]));
      ui.fillSelect(el.createSupplier, suppliers.filter((s) => s.active !== false).map((s) => ({ value: s._id, label: s.name })));
    } catch (error) {
      ui.showError(error);
    }
    await loadParts();
    loadReceipts();
    loadIssues();
    loadTransfers();
    setInterval(refreshAll, 60 * 1000);
  });
}
