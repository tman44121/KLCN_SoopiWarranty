/* ==========================================================================
   View: Kỹ thuật viên — UI mục 16, 34; CODEX mục 7 (T3, T3b, T4, T5, T8, T9c, T10)
   Mọi chuyển trạng thái đi qua API theo máy trạng thái — KTV không tự đổi
   trạng thái tùy ý (D-005: không có "Tạm dừng", "Đang kiểm tra QC").
   API: GET /technicians/me/queue, GET /tickets/{c}, POST|PUT /tickets/{c}/inspection,
        POST /tickets/{c}/repair/start|parts-ready|results, POST /tickets/{c}/quotations,
        GET /quotations/{c}, GET /parts, POST /stock-issues, GET /stock-issues/mine,
        POST /tickets/{c}/customer-notes|internal-notes
   ========================================================================== */

export default function initialize() {

  const api = window.LML_API;
  const ui = window.LML_UI;
  const fmt = window.LML_FMT;
  const L = window.LML_LABELS;
  const { html } = window;

  const state = {
    queue: [],
    selected: null,
    ticket: null,
    quotation: null,
    pendingIssue: null,
    catalog: { categories: [], servicePrices: [] },
    parts: [],
    inspectionDraft: null,
    editingInspection: false,
    quoteDraft: null,
    qc: {},
    partLines: [],
  };

  const el = {
    queueList: document.querySelector("[data-queue-list]"),
    detail: document.querySelector("[data-detail-column]"),
    drawer: document.querySelector("[data-parts-drawer]"),
    drawerSubtitle: document.querySelector("[data-parts-drawer-subtitle]"),
    partSelect: document.querySelector("[data-part-select]"),
    partInfo: document.querySelector("[data-part-info]"),
    partAvailable: document.querySelector("[data-part-available]"),
    partReserved: document.querySelector("[data-part-reserved]"),
    partBin: document.querySelector("[data-part-bin]"),
    partQty: document.querySelector("[data-part-qty]"),
    qtyField: document.querySelector("[data-qty-field]"),
    qtyError: document.querySelector("[data-qty-error]"),
    partLines: document.querySelector("[data-parts-lines]"),
    partReason: document.querySelector("[data-part-reason]"),
    submitParts: document.querySelector("[data-submit-parts-request]"),
  };

  const pad = (n) => String(n).padStart(2, "0");
  const card = (title, meta, body, headerRight) => html`
    <section class="card">
      <div class="card__header">
        <div>
          <h2 class="card__title">${title}</h2>
          ${meta ? html`<div class="card__title-meta">${meta}</div>` : ""}
        </div>
        ${headerRight || ""}
      </div>
      <div class="card__body">${body}</div>
    </section>`;
  const kv = (label, value, wide) =>
    html`<div class="detail-grid__item${wide ? " detail-grid__item--wide" : ""}"><span class="kv-key">${label}</span><span>${value}</span></div>`;
  const banner = (text, warning) =>
    html`<div class="qc-summary-banner ${warning ? "qc-summary-banner--warning" : ""}" style="margin-top:10px;">${text}</div>`;

  /* ---------------------------------------------------------------------- */
  /* Hàng đợi của tôi (UI 16A)                                               */
  /* ---------------------------------------------------------------------- */

  async function loadQueue() {
    if (!state.queue.length) ui.blockState(el.queueList, "loading");
    try {
      state.queue = await api.technicians.myQueue();
      renderQueue();
    } catch (error) {
      ui.blockState(el.queueList, "error", { desc: error.detail }, loadQueue);
    }
  }

  function renderQueue() {
    if (state.queue.length === 0) {
      ui.blockState(el.queueList, "empty", { desc: "Bạn chưa được phân công phiếu nào." });
      return;
    }
    el.queueList.innerHTML = html`${state.queue.map((t) => html`
      <div class="queue-item ${state.selected === t.code ? "is-selected" : ""}" data-ticket-id="${t.code}" tabindex="0" role="button" aria-label="Mở phiếu ${t.code}">
        <div class="queue-item__top">
          <span class="mono cell-primary">${t.code}</span>
          ${t.status === "COMPLETED" ? "" : html`<span class="sla-timer" data-deadline="${new Date(t.sla.dueAt).getTime()}"></span>`}
        </div>
        <div class="queue-item__device">${t.device.deviceTypeName} · ${t.device.productName}</div>
        <div class="queue-item__symptom" title="${t.reportedIssue}">${t.reportedIssue}</div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">${fmt.badgeOf(L.TICKET_STATUS, t.status)}${t.sla.status === "BREACHED" && t.status !== "COMPLETED" ? fmt.badge("danger", "Trễ hẹn SLA") : ""}</div>
      </div>`)}`;
    el.queueList.querySelectorAll("[data-ticket-id]").forEach((item) => {
      const open = () => {
        selectTicket(item.getAttribute("data-ticket-id"));
        ui.revealDetail(el.detail);
      };
      item.addEventListener("click", open);
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
    tickTimers();
  }

  function tickTimers() {
    document.querySelectorAll(".sla-timer[data-deadline]").forEach((node) => {
      const diff = Number(node.getAttribute("data-deadline")) - Date.now();
      node.textContent = fmt.countdown(diff);
      node.classList.toggle("is-overdue", diff < 0);
      node.classList.toggle("is-risk", diff >= 0 && diff < 2 * 3600 * 1000);
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Chi tiết phiếu                                                          */
  /* ---------------------------------------------------------------------- */

  async function selectTicket(code) {
    if (state.selected !== code) {
      state.inspectionDraft = null;
      state.editingInspection = false;
      state.quoteDraft = null;
    }
    state.selected = code;
    renderQueue();
    ui.blockState(el.detail, "loading");
    try {
      const ticket = await api.tickets.get(code);
      state.ticket = ticket;
      state.quotation = ticket.activeQuotationCode ? await api.quotations.get(ticket.activeQuotationCode) : null;
      const pending = await api.inventory.myIssues("PENDING");
      state.pendingIssue = pending.find((issue) => issue.ticketCode === code) || null;
      renderDetail();
    } catch (error) {
      ui.blockState(el.detail, "error", { desc: error.detail }, () => selectTicket(code));
    }
  }

  function checklistFor(ticket) {
    const category = state.catalog.categories.find((c) => c._id === ticket.device.categoryCode);
    const type = category && (category.deviceTypes || []).find((t) => t.code === ticket.device.deviceTypeCode);
    return type ? type.diagnosticChecklist || [] : [];
  }

  function summaryCard(t) {
    const w = t.warrantyAtIntake || {};
    const counted = !["COMPLETED", "DELIVERED", "CANCELLED", "RETURNED_UNREPAIRED"].includes(t.status);
    return card(
      html`Chi tiết phiếu — <span class="mono">${t.code}</span>`,
      t.customer ? `${t.customer.fullName} · ${t.customer.phone || ""}` : "",
      html`
        <div class="detail-grid">
          ${kv("Thiết bị", t.device.deviceTypeName)}
          ${kv("Hãng/Model", `${t.device.brandName} ${t.device.productName}`)}
          ${kv(t.device.identifierType === "IMEI" ? "IMEI" : "Serial", html`<span class="mono">${t.device.serialOrImei}</span>`)}
          ${kv("Nhóm thiết bị", L.CATEGORY[t.device.categoryCode] || "—")}
          ${kv("SLA còn lại", counted ? html`<span class="sla-timer" data-deadline="${new Date(t.sla.dueAt).getTime()}"></span>` : "—")}
          ${kv("Trạng thái hiện tại", fmt.badgeOf(L.TICKET_STATUS, t.status))}
          ${kv("Ưu tiên", t.assignment ? L.PRIORITY[t.assignment.priority] : "—")}
          ${kv("Mức SLA", L.SLA_LEVEL[t.sla.level])}
          ${kv("Triệu chứng khách hàng", t.reportedIssue, true)}
        </div>
        <hr class="section-divider" />
        <h3 class="card__title" style="margin-bottom:10px;">Thông tin bảo hành khi tiếp nhận</h3>
        <div class="detail-grid">
          ${kv("Tình trạng bảo hành", fmt.badgeOf(L.WARRANTY_STATUS, w.status))}
          ${kv("Nhà phân phối", w.distributor || "—")}
          ${kv("Ngày kích hoạt", fmt.date(w.activatedOn))}
          ${kv("Ngày hết hạn", fmt.date(w.expiresOn))}
          ${kv("Điều kiện bảo hành", w.conditions || "—", true)}
          ${kv("Ngoại quan", `Trầy ${L.SCRATCHES[t.cosmetic.scratches]} · Ẩm nước ${L.MOISTURE[t.cosmetic.moisture]} · Phụ kiện ${L.ACCESSORIES[t.cosmetic.accessories]}${t.cosmetic.notes ? ` · ${t.cosmetic.notes}` : ""}`, true)}
        </div>`
    );
  }

  function renderDetail() {
    const t = state.ticket;
    if (!t) return;
    const sections = [summaryCard(t)];
    switch (t.status) {
      case "INSPECTING":
        sections.push(inspectionForm(t, false));
        break;
      case "DIAGNOSED":
        sections.push(state.editingInspection ? inspectionForm(t, true) : inspectionSummary(t, true));
        if (!state.editingInspection) sections.push(diagnosedActions(t));
        break;
      case "AWAITING_QUOTE_APPROVAL":
      case "AWAITING_CUSTOMER_CONFIRMATION":
      case "CANCELLED":
        sections.push(inspectionSummary(t, false), quotationCard(t));
        break;
      case "AWAITING_PARTS":
        sections.push(inspectionSummary(t, false), partsStage(t));
        if (state.quotation) sections.push(quotationCard(t));
        break;
      case "REPAIRING":
        sections.push(inspectionSummary(t, false), qcCard(t));
        break;
      default:
        sections.push(inspectionSummary(t, false), resultsHistory(t));
    }
    sections.push(notesCard(t));
    el.detail.innerHTML = html`${sections}`;
    bindDetail(t);
    tickTimers();
  }

  /* ---- Chẩn đoán & phân loại bảo hành (T3/T3b — UI 16C, 16C2) ---- */

  function draftFor(t, revise) {
    if (!state.inspectionDraft) {
      const existing = revise && t.inspection;
      const items = existing ? existing.checklist : checklistFor(t).map((item) => ({ item, result: "PENDING", note: "" }));
      state.inspectionDraft = {
        checklist: items.map((c) => ({ item: c.item, result: c.result || "PENDING", note: c.note || "" })),
        findings: existing ? existing.findings : "",
        waterDamage: existing ? existing.waterDamage : t.cosmetic.moisture === "YES",
        classification: existing
          ? existing.classification
          : (t.warrantyAtIntake || {}).status === "IN_WARRANTY"
            ? "FREE_WARRANTY"
            : "OUT_OF_WARRANTY",
        outOfWarrantyReason: existing ? existing.outOfWarrantyReason || "" : "",
        proposedFix: existing ? existing.proposedFix || "" : "",
        reclassNote: existing ? existing.reclassNote || "" : "",
      };
    }
    return state.inspectionDraft;
  }

  /** BR-11: phân loại khác kết quả lễ tân → bắt buộc ghi lý do. */
  function reclassRequired(t, classification) {
    const intake = (t.warrantyAtIntake || {}).status;
    return intake === "IN_WARRANTY" ? classification !== "FREE_WARRANTY" : classification !== "OUT_OF_WARRANTY";
  }

  function inspectionForm(t, revise) {
    const d = draftFor(t, revise);
    const needsReason = d.classification !== "FREE_WARRANTY";
    const needsNote = reclassRequired(t, d.classification);
    const toggle = (name, value, current, label, tone) =>
      html`<button type="button" class="result-toggle__btn ${current === value ? `is-active--${tone}` : ""}" data-${name}="${value}">${label}</button>`;
    return card(
      revise ? "Sửa lại phân loại" : "Chẩn đoán & phân loại bảo hành",
      `Lễ tân ghi nhận ban đầu: ${(L.WARRANTY_STATUS[(t.warrantyAtIntake || {}).status] || {}).label || "—"}`,
      html`
        <form data-inspection-form novalidate>
          ${d.checklist.length
            ? html`<div class="qc-stepper" style="margin-bottom:14px;">${d.checklist.map((c, i) => html`
                <div class="qc-step">
                  <span class="qc-step__index">${pad(i + 1)}</span>
                  <span class="qc-step__label">${c.item}</span>
                  <div class="result-toggle" data-check-index="${i}">
                    ${toggle("check-result", "PASS", c.result, "Đạt", "PASS")}
                    ${toggle("check-result", "FAIL", c.result, "Không đạt", "FAIL")}
                    ${toggle("check-result", "NA", c.result, "Không áp dụng", "NA")}
                  </div>
                </div>`)}</div>`
            : ""}
          <div class="form-field" data-field="findings">
            <label for="insp-findings">Kết quả kiểm tra<span class="required-mark">*</span></label>
            <textarea id="insp-findings" name="findings" data-insp="findings" placeholder="Mô tả lỗi phát hiện được…">${d.findings}</textarea>
          </div>
          <div class="checkbox-row" style="padding:10px 0;">
            <input type="checkbox" id="insp-water" data-insp-water ${d.waterDamage ? html`checked` : ""} />
            <label for="insp-water">Thiết bị có dấu hiệu vào nước</label>
          </div>
          <div class="form-field" data-field="classification">
            <label>Tình trạng bảo hành thực tế<span class="required-mark">*</span></label>
            <div class="result-toggle">
              ${toggle("classification", "FREE_WARRANTY", d.classification, "Trong bảo hành", "PASS")}
              ${toggle("classification", "OUT_OF_WARRANTY", d.classification, "Ngoài bảo hành", "PASS")}
              ${toggle("classification", "PARTIAL_WARRANTY", d.classification, "Bảo hành một phần", "PASS")}
            </div>
          </div>
          ${needsReason ? html`
            <div class="form-field" data-field="outOfWarrantyReason">
              <label for="insp-reason">Lý do ngoài bảo hành<span class="required-mark">*</span></label>
              <input type="text" id="insp-reason" name="outOfWarrantyReason" data-insp="outOfWarrantyReason" value="${d.outOfWarrantyReason}" />
            </div>` : ""}
          <div class="form-field" data-field="proposedFix">
            <label for="insp-fix">Phương án sửa chữa đề xuất</label>
            <input type="text" id="insp-fix" name="proposedFix" data-insp="proposedFix" value="${d.proposedFix}" />
          </div>
          <div class="form-field" data-field="reclassNote">
            <label for="insp-note">Ghi chú lý do phân loại lại${needsNote ? html`<span class="required-mark">*</span>` : ""}</label>
            <textarea id="insp-note" name="reclassNote" data-insp="reclassNote" placeholder="Bắt buộc khi khác với kết quả kiểm tra ban đầu ở lễ tân…">${d.reclassNote}</textarea>
          </div>
          <div class="action-bar">
            ${revise ? html`<button type="button" class="btn btn--secondary" data-cancel-revise>Hủy sửa</button>` : ""}
            <button type="button" class="btn btn--primary" data-save-inspection>${revise ? "Lưu phân loại mới" : "Xác nhận tình trạng bảo hành"}</button>
          </div>
        </form>`
    );
  }

  function inspectionSummary(t, canRevise) {
    const i = t.inspection;
    if (!i) return "";
    return card(
      "Kết quả chẩn đoán",
      `Ghi nhận lúc ${fmt.dateTime(i.inspectedAt)}`,
      html`
        <div class="detail-grid">
          ${kv("Kết luận", L.CLASSIFICATION[i.classification])}
          ${kv("Vào nước", i.waterDamage ? "Có" : "Không")}
          ${kv("Kết quả kiểm tra", i.findings, true)}
          ${i.outOfWarrantyReason ? kv("Lý do ngoài bảo hành", i.outOfWarrantyReason, true) : ""}
          ${i.proposedFix ? kv("Phương án sửa chữa", i.proposedFix, true) : ""}
          ${i.reclassNote ? kv("Lý do phân loại lại", i.reclassNote, true) : ""}
          ${(i.checklist || []).length ? kv("Checklist", i.checklist.map((c) => `${c.item}: ${L.STEP_RESULT[c.result].label}`).join(" · "), true) : ""}
        </div>
        ${canRevise ? html`<div class="action-bar" style="margin-top:10px;"><button type="button" class="btn btn--secondary btn--sm" data-edit-inspection>Sửa lại phân loại</button></div>` : ""}`
    );
  }

  /* ---- Sau chẩn đoán: miễn phí (T4/T8) hoặc lập báo giá (T5) ---- */

  function diagnosedActions(t) {
    if (t.inspection.classification === "FREE_WARRANTY") {
      return card(
        "Sửa chữa trong bảo hành",
        "Ca miễn phí — sửa ngay nếu không cần linh kiện, hoặc gửi yêu cầu linh kiện tới kho",
        html`<div class="action-bar action-bar--start">
          <button type="button" class="btn btn--primary" data-start-repair>Bắt đầu sửa chữa</button>
          <button type="button" class="btn btn--secondary" data-open-parts>Gửi yêu cầu linh kiện</button>
        </div>`
      );
    }
    return quotationForm(t);
  }

  function quoteDraft(t) {
    if (!state.quoteDraft) {
      const svc = state.catalog.servicePrices.find((s) => s.categoryCode === t.device.categoryCode && s.active !== false);
      const valid = new Date(Date.now() + 3 * 24 * 3600 * 1000);
      state.quoteDraft = {
        serviceFeeCode: svc ? svc._id : "",
        validUntil: valid.toISOString().slice(0, 10),
        lines: [{ sku: "", description: "", quantity: 1, unitPrice: "", laborFee: svc ? Number(svc.price) : 0 }],
      };
    }
    return state.quoteDraft;
  }

  function quotePreviewTotal(d) {
    const subtotal = d.lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.unitPrice || 0) + Number(l.laborFee || 0), 0);
    return Math.round(subtotal * 1.08);
  }

  function quotationForm(t) {
    const d = quoteDraft(t);
    const partOptions = state.parts.filter((p) => p.active !== false);
    return card(
      "Lập phiếu báo giá sửa chữa",
      "Thiết bị ngoài bảo hành — cần báo giá được duyệt và khách xác nhận trước khi sửa phần này",
      html`
        <form data-quote-form novalidate>
          <div class="table-scroll">
            <table class="drawer-table drawer-table--inputs">
              <thead><tr><th>Linh kiện (SKU)</th><th>Nội dung</th><th style="width:70px;">SL</th><th style="width:120px;">Đơn giá</th><th style="width:120px;">Tiền công</th><th></th></tr></thead>
              <tbody>${d.lines.map((line, i) => html`
                <tr data-quote-line="${i}">
                  <td><select data-q="sku" aria-label="Chọn linh kiện">
                    <option value="">— Hàng đặt riêng / chỉ tiền công —</option>
                    ${partOptions.map((p) => html`<option value="${p.sku}" ${p.sku === line.sku ? html`selected` : ""}>${p.sku} — ${p.name}</option>`)}
                  </select></td>
                  <td><input type="text" data-q="description" value="${line.description}" placeholder="Mô tả hạng mục" aria-label="Nội dung" /></td>
                  <td><input type="number" min="1" data-q="quantity" value="${line.quantity}" aria-label="Số lượng" /></td>
                  <td><input type="number" min="0" step="1000" data-q="unitPrice" value="${line.unitPrice}" aria-label="Đơn giá" /></td>
                  <td><input type="number" min="0" step="1000" data-q="laborFee" value="${line.laborFee}" aria-label="Tiền công" /></td>
                  <td><button type="button" class="item-row__remove" data-remove-line="${i}" aria-label="Xoá dòng">×</button></td>
                </tr>`)}</tbody>
            </table>
          </div>
          <button type="button" class="btn btn--secondary btn--sm" data-add-line style="margin-top:8px;">+ Thêm hạng mục</button>
          <div class="form-row" style="margin-top:14px;">
            <div class="form-field">
              <label for="quote-service">Bảng giá dịch vụ tham chiếu</label>
              <select id="quote-service" data-quote-service>
                <option value="">— Không áp dụng —</option>
                ${state.catalog.servicePrices.map((s) => html`<option value="${s._id}" ${d.serviceFeeCode === s._id ? html`selected` : ""}>${s.name} — ${fmt.money(s.price)}</option>`)}
              </select>
            </div>
            <div class="form-field" data-field="validUntil">
              <label for="quote-valid">Hiệu lực đến</label>
              <input type="date" id="quote-valid" name="validUntil" data-quote-valid value="${d.validUntil}" />
            </div>
          </div>
          <div class="billing-total-row" style="margin-top:10px;"><span>Tổng tạm tính (gồm VAT 8%)</span><span data-quote-total>${fmt.money(quotePreviewTotal(d))}</span></div>
          <div class="form-field__helper">Máy chủ tính lại tổng tiền khi gửi; đơn giá trống sẽ lấy theo giá dịch vụ của linh kiện.</div>
          <div class="action-bar" style="margin-top:12px;">
            <button type="button" class="btn btn--primary" data-submit-quote>Gửi phiếu báo giá</button>
          </div>
        </form>`
    );
  }

  function quotationCard(t) {
    const q = state.quotation;
    if (!q) {
      return t.status === "CANCELLED"
        ? card("Báo giá sửa chữa", "", banner("Khách hàng từ chối báo giá — phiếu chờ bàn giao lại thiết bị chưa sửa.", true))
        : "";
    }
    const note = {
      PENDING: "Đang chờ Điều phối viên phê duyệt báo giá.",
      APPROVED:
        q.customerDecision.status === "ACCEPTED"
          ? "Khách hàng đã xác nhận báo giá — có thể tiếp tục sửa chữa phần ngoài bảo hành."
          : q.customerDecision.status === "DECLINED"
            ? "Khách hàng từ chối báo giá — phiếu chuyển sang bàn giao lại thiết bị chưa sửa."
            : "Đã phê duyệt — đang chờ khách hàng xác nhận báo giá (qua Lễ tân hoặc Cổng khách hàng).",
    }[q.approval.status];
    return card(
      html`Phiếu báo giá sửa chữa — <span class="mono">${q.code}</span>`,
      `Hiệu lực đến ${fmt.date(q.validUntil)}`,
      html`
        <div class="table-scroll">
          <table class="drawer-table">
            <thead><tr><th>SKU</th><th>Nội dung</th><th>SL</th><th>Thành tiền</th></tr></thead>
            <tbody>${q.lines.map((l) => html`<tr><td class="mono">${l.sku || "—"}</td><td>${l.description}</td><td>${l.quantity}</td><td>${fmt.money(l.lineTotal)}</td></tr>`)}</tbody>
          </table>
        </div>
        <div class="billing-row"><span>Tổng linh kiện</span><span>${fmt.money(q.partsTotal)}</span></div>
        <div class="billing-row"><span>Tiền công</span><span>${fmt.money(q.laborTotal)}</span></div>
        <div class="billing-total-row"><span>Tổng thanh toán (gồm VAT ${Number(q.vatRate)}%)</span><span>${fmt.money(q.grandTotal)}</span></div>
        ${note ? banner(note, q.customerDecision.status === "DECLINED") : ""}`,
      html`<div style="display:flex; gap:6px;">${fmt.badgeOf(L.QUOTE_APPROVAL, q.approval.status)}${q.approval.status === "APPROVED" ? fmt.badgeOf(L.QUOTE_DECISION, q.customerDecision.status) : ""}</div>`
    );
  }

  /* ---- Chờ linh kiện (T8 theo báo giá, T9c đủ linh kiện ngoài kho) ---- */

  function partsStage(t) {
    if (state.pendingIssue) {
      const issue = state.pendingIssue;
      return card(
        "Yêu cầu linh kiện",
        `Phiếu xuất ${issue.code} gửi lúc ${fmt.dateTime(issue.requestedAt)}`,
        html`${issue.lines.map((l) => html`<div class="billing-row"><span class="mono">${l.sku}</span><span>× ${l.quantity}</span></div>`)}
          ${banner("Đang chờ Kho vật tư duyệt & thực xuất kho — phiếu tự chuyển sang Đang sửa chữa khi kho duyệt.")}`,
        fmt.badgeOf(L.STOCK_ISSUE_STATUS, issue.status)
      );
    }
    const q = state.quotation;
    const isFree = t.inspection && t.inspection.classification === "FREE_WARRANTY";
    if (isFree) {
      return card("Yêu cầu linh kiện", "Yêu cầu trước đã bị kho từ chối — gửi lại yêu cầu mới", html`
        <div class="action-bar action-bar--start"><button type="button" class="btn btn--primary" data-open-parts>Gửi yêu cầu linh kiện</button></div>`);
    }
    const hasStockLines = q && q.lines.some((l) => l.sku);
    return card(
      "Chuẩn bị linh kiện theo báo giá",
      hasStockLines ? "Linh kiện lấy từ kho theo đúng các dòng có SKU của báo giá đã được khách xác nhận" : "Báo giá chỉ gồm hàng đặt riêng / tiền công",
      html`<div class="action-bar action-bar--start">
        ${hasStockLines
          ? html`<button type="button" class="btn btn--primary" data-request-quote-parts>Gửi yêu cầu linh kiện theo báo giá</button>`
          : html`<button type="button" class="btn btn--primary" data-parts-ready>Xác nhận đã đủ linh kiện</button>`}
      </div>`
    );
  }

  /* ---- QC 6 bước + ghi kết quả sửa chữa (T10 — UI 16E) ---- */

  function qcState(t) {
    if (!state.qc[t.code]) {
      state.qc[t.code] = {
        steps: Object.fromEntries(L.QC_STEPS.map((s) => [s.code, "PENDING"])),
        workDone: "",
        qcDetails: "",
      };
    }
    return state.qc[t.code];
  }

  function qcCard(t) {
    const qc = qcState(t);
    const values = Object.values(qc.steps);
    const pending = values.includes("PENDING");
    const failed = values.includes("FAIL");
    const toggle = (code, value, label) =>
      html`<button type="button" class="result-toggle__btn ${qc.steps[code] === value ? `is-active--${value}` : ""}" data-qc-step="${code}" data-qc-value="${value}">${label}</button>`;
    return card(
      "Sửa chữa & kiểm tra chất lượng (QC)",
      "Hoàn tất đủ 6 bước trước khi xác nhận sửa chữa xong",
      html`
        <form data-qc-form novalidate>
          <div class="form-field" data-field="workDone">
            <label for="qc-work">Công việc đã thực hiện<span class="required-mark">*</span></label>
            <textarea id="qc-work" name="workDone" data-qc-work placeholder="VD: Thay pin mới, vệ sinh bo mạch…">${qc.workDone}</textarea>
          </div>
          <div class="qc-stepper">${L.QC_STEPS.map((s, i) => html`
            <div class="qc-step">
              <span class="qc-step__index">${pad(i + 1)}</span>
              <span class="qc-step__label">${s.label}</span>
              <div class="result-toggle">
                ${toggle(s.code, "PASS", "Đạt")}${toggle(s.code, "FAIL", "Không đạt")}${toggle(s.code, "NA", "Không áp dụng")}
              </div>
            </div>`)}</div>
          <div class="form-field" style="margin-top:12px;">
            <label for="qc-details">Chi tiết kiểm tra</label>
            <input type="text" id="qc-details" data-qc-details value="${qc.qcDetails}" placeholder="VD: Test sạc 3 chu kỳ, khởi động 20 lần" />
          </div>
          ${failed ? banner('Có bước QC "Không đạt" — lần thử sẽ được ghi nhận "Chưa đạt" và phiếu tiếp tục ở trạng thái Đang sửa chữa.', true) : ""}
          <div style="margin-top:14px; display:flex; justify-content:flex-end;">
            <button type="button" class="btn ${failed ? "btn--destructive" : "btn--primary"}" data-submit-qc ${pending ? html`disabled` : ""}>${failed ? "Ghi nhận QC chưa đạt" : "Xác nhận hoàn tất sửa chữa"}</button>
          </div>
        </form>
        ${resultsList(t)}`
    );
  }

  function resultsList(t) {
    const results = (t.repairOrder && t.repairOrder.results) || [];
    if (!results.length) return "";
    return html`<h3 class="card__title" style="margin:16px 0 10px;">Các lần ghi kết quả</h3>
      <div class="checklist">${results.map((r) => html`
        <div class="checklist-item" style="flex-direction:column; align-items:flex-start; gap:4px;">
          <span class="cell-muted cell-muted--sm">${fmt.dateTime(r.recordedAt)} — <span class="mono">${r.code}</span></span>
          <span class="checklist-item__label">${r.workDone}</span>
          ${fmt.badge(r.qcResult === "PASS" ? "success" : "danger", r.qcResult === "PASS" ? "QC đạt" : "Không đạt QC")}
        </div>`)}</div>`;
  }

  function resultsHistory(t) {
    return card("Kết quả sửa chữa", "", html`${resultsList(t) || html`<div class="empty-selection-hint">Chưa có kết quả sửa chữa.</div>`}`);
  }

  /* ---- Ghi chú khách / nội bộ (POL-06: tách bạch) ---- */

  function notesCard(t) {
    const list = (notes) =>
      notes.length
        ? html`<div class="checklist">${notes.slice().reverse().map((n) => html`
            <div class="checklist-item" style="flex-direction:column; align-items:flex-start; gap:2px;">
              <span class="cell-muted cell-muted--sm">${fmt.dateTime(n.at)}</span>
              <span class="checklist-item__label">${n.text}</span>
            </div>`)}</div>`
        : html`<div class="cell-muted" style="font-size:12.5px;">Chưa có ghi chú.</div>`;
    return card(
      "Ghi chú",
      "Ghi chú cho khách hiển thị trên Cổng khách hàng; ghi chú nội bộ chỉ nhân viên thấy",
      html`
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
          <div>
            <h3 class="card__title card__title--spaced">Ghi chú cho khách hàng</h3>
            ${list(t.customerNotes || [])}
            <div class="inline-group inline-group--offset">
              <input type="text" class="text-field" data-note-input="customer" placeholder="VD: Đã hoàn tất kiểm tra nguồn." aria-label="Ghi chú cho khách hàng" />
              <button type="button" class="btn btn--secondary btn--sm" data-add-note="customer">Thêm</button>
            </div>
          </div>
          <div>
            <h3 class="card__title card__title--spaced">Ghi chú nội bộ</h3>
            ${list(t.internalNotes || [])}
            <div class="inline-group inline-group--offset">
              <input type="text" class="text-field" data-note-input="internal" placeholder="Chỉ nhân viên nội bộ thấy" aria-label="Ghi chú nội bộ" />
              <button type="button" class="btn btn--secondary btn--sm" data-add-note="internal">Thêm</button>
            </div>
          </div>
        </div>`
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Sự kiện chi tiết                                                        */
  /* ---------------------------------------------------------------------- */

  async function act(button, action, successMessage) {
    try {
      await ui.busy(button, action);
      if (successMessage) window.showToast(successMessage, "success");
      state.inspectionDraft = null;
      state.editingInspection = false;
      state.quoteDraft = null;
      await loadQueue();
      await selectTicket(state.selected);
    } catch (error) {
      ui.showError(error, el.detail.querySelector("form"));
    }
  }

  function bindInspection(t) {
    const form = el.detail.querySelector("[data-inspection-form]");
    if (!form) return;
    const d = state.inspectionDraft;
    form.querySelectorAll("[data-insp]").forEach((input) => {
      input.addEventListener("input", () => {
        d[input.getAttribute("data-insp")] = input.value;
      });
    });
    form.querySelector("[data-insp-water]").addEventListener("change", (e) => {
      d.waterDamage = e.target.checked;
    });
    form.querySelectorAll("[data-check-result]").forEach((btn) => {
      btn.addEventListener("click", () => {
        d.checklist[Number(btn.closest("[data-check-index]").getAttribute("data-check-index"))].result = btn.getAttribute("data-check-result");
        renderDetail();
      });
    });
    form.querySelectorAll("[data-classification]").forEach((btn) => {
      btn.addEventListener("click", () => {
        d.classification = btn.getAttribute("data-classification");
        renderDetail();
      });
    });
    const cancel = form.querySelector("[data-cancel-revise]");
    if (cancel) {
      cancel.addEventListener("click", () => {
        state.editingInspection = false;
        state.inspectionDraft = null;
        renderDetail();
      });
    }
    form.querySelector("[data-save-inspection]").addEventListener("click", (e) => {
      const body = {
        findings: d.findings.trim(),
        checklist: d.checklist.filter((c) => c.result !== "PENDING").map((c) => ({ item: c.item, result: c.result, note: c.note || null })),
        waterDamage: d.waterDamage,
        classification: d.classification,
        outOfWarrantyReason: d.classification === "FREE_WARRANTY" ? null : d.outOfWarrantyReason.trim() || null,
        proposedFix: d.proposedFix.trim() || null,
        reclassNote: d.reclassNote.trim() || null,
      };
      if (!body.findings) {
        ui.showError({ code: "VALIDATION_FAILED", fieldErrors: [{ field: "findings", message: "Vui lòng nhập kết quả kiểm tra." }] }, form);
        return;
      }
      const revise = t.status === "DIAGNOSED";
      act(
        e.currentTarget,
        () => (revise ? api.tickets.reviseInspection(t.code, body) : api.tickets.inspect(t.code, body)),
        revise ? `Đã cập nhật phân loại bảo hành cho ${t.code}.` : `Đã ghi nhận kết quả chẩn đoán cho ${t.code}.`
      );
    });
  }

  function bindQuoteForm(t) {
    const form = el.detail.querySelector("[data-quote-form]");
    if (!form) return;
    const d = state.quoteDraft;
    const refreshTotal = () => {
      form.querySelector("[data-quote-total]").textContent = fmt.money(quotePreviewTotal(d));
    };
    form.querySelectorAll("[data-quote-line]").forEach((row) => {
      const line = d.lines[Number(row.getAttribute("data-quote-line"))];
      row.querySelectorAll("[data-q]").forEach((input) => {
        input.addEventListener("input", () => {
          line[input.getAttribute("data-q")] = input.value;
          refreshTotal();
        });
      });
      row.querySelector('[data-q="sku"]').addEventListener("change", (e) => {
        const part = state.parts.find((p) => p.sku === e.target.value);
        line.sku = e.target.value;
        if (part) {
          line.description = line.description || part.name;
          line.unitPrice = line.unitPrice || Number(part.servicePrice);
        }
        renderDetail();
      });
    });
    form.querySelectorAll("[data-remove-line]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (d.lines.length > 1) d.lines.splice(Number(btn.getAttribute("data-remove-line")), 1);
        renderDetail();
      });
    });
    form.querySelector("[data-add-line]").addEventListener("click", () => {
      d.lines.push({ sku: "", description: "", quantity: 1, unitPrice: "", laborFee: 0 });
      renderDetail();
    });
    form.querySelector("[data-quote-service]").addEventListener("change", (e) => {
      d.serviceFeeCode = e.target.value;
      const svc = state.catalog.servicePrices.find((s) => s._id === d.serviceFeeCode);
      if (svc && !Number(d.lines[0].laborFee)) d.lines[0].laborFee = Number(svc.price);
      renderDetail();
    });
    form.querySelector("[data-quote-valid]").addEventListener("input", (e) => {
      d.validUntil = e.target.value;
    });
    form.querySelector("[data-submit-quote]").addEventListener("click", (e) => {
      const lines = d.lines
        .filter((l) => l.sku || String(l.description).trim())
        .map((l) => ({
          sku: l.sku || null,
          description: String(l.description).trim() || null,
          quantity: Number(l.quantity) || 1,
          unitPrice: l.unitPrice === "" ? null : Number(l.unitPrice),
          laborFee: Number(l.laborFee) || 0,
        }));
      if (lines.length === 0) {
        window.showToast("Báo giá phải có ít nhất 1 dòng chi tiết.", "error");
        return;
      }
      act(
        e.currentTarget,
        () => api.quotations.create(t.code, { validUntil: d.validUntil || null, vatRate: 8, serviceFeeCode: d.serviceFeeCode || null, lines }),
        `Đã gửi phiếu báo giá cho ${t.code} tới Điều phối viên để phê duyệt.`
      );
    });
  }

  function bindQc(t) {
    const form = el.detail.querySelector("[data-qc-form]");
    if (!form) return;
    const qc = qcState(t);
    form.querySelector("[data-qc-work]").addEventListener("input", (e) => {
      qc.workDone = e.target.value;
    });
    form.querySelector("[data-qc-details]").addEventListener("input", (e) => {
      qc.qcDetails = e.target.value;
    });
    form.querySelectorAll("[data-qc-step]").forEach((btn) => {
      btn.addEventListener("click", () => {
        qc.steps[btn.getAttribute("data-qc-step")] = btn.getAttribute("data-qc-value");
        renderDetail();
      });
    });
    form.querySelector("[data-submit-qc]").addEventListener("click", (e) => {
      if (!qc.workDone.trim()) {
        ui.showError({ code: "VALIDATION_FAILED", fieldErrors: [{ field: "workDone", message: "Vui lòng mô tả công việc đã thực hiện." }] }, form);
        return;
      }
      const failed = Object.values(qc.steps).includes("FAIL");
      const body = {
        workDone: qc.workDone.trim(),
        qcSteps: L.QC_STEPS.map((s) => ({ step: s.code, result: qc.steps[s.code] })),
        qcResult: failed ? "FAIL" : "PASS",
        qcDetails: qc.qcDetails.trim() || null,
      };
      act(e.currentTarget, async () => {
        await api.tickets.recordResult(t.code, body);
        delete state.qc[t.code];
      }, failed ? `Đã ghi nhận lần thử QC chưa đạt cho ${t.code}.` : `Đã xác nhận hoàn tất sửa chữa cho ${t.code}. Phiếu sẵn sàng bàn giao.`);
    });
  }

  function bindDetail(t) {
    bindInspection(t);
    bindQuoteForm(t);
    bindQc(t);
    const on = (selector, handler) => {
      const node = el.detail.querySelector(selector);
      if (node) node.addEventListener("click", handler);
    };
    on("[data-edit-inspection]", () => {
      state.editingInspection = true;
      state.inspectionDraft = null;
      renderDetail();
    });
    on("[data-start-repair]", (e) => act(e.currentTarget, () => api.tickets.startRepair(t.code), `Đã bắt đầu sửa chữa ${t.code}.`));
    on("[data-parts-ready]", (e) => act(e.currentTarget, () => api.tickets.partsReady(t.code), `Đã xác nhận đủ linh kiện — ${t.code} chuyển sang Đang sửa chữa.`));
    on("[data-request-quote-parts]", (e) =>
      act(
        e.currentTarget,
        () => api.inventory.requestIssue({ ticketCode: t.code, quotationCode: state.quotation.code }),
        `Đã gửi yêu cầu linh kiện theo báo giá ${state.quotation.code} tới kho vật tư.`
      )
    );
    el.detail.querySelectorAll("[data-open-parts]").forEach((btn) => btn.addEventListener("click", () => openPartsDrawer(t)));
    el.detail.querySelectorAll("[data-add-note]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.getAttribute("data-add-note");
        const input = el.detail.querySelector(`[data-note-input="${kind}"]`);
        const text = input.value.trim();
        if (!text) return;
        act(btn, () => (kind === "customer" ? api.tickets.customerNote(t.code, text) : api.tickets.internalNote(t.code, text)), "Đã thêm ghi chú.");
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Drawer yêu cầu linh kiện (T8 — ca miễn phí, UI 16D)                     */
  /* ---------------------------------------------------------------------- */

  function renderPartLines() {
    if (state.partLines.length === 0) {
      el.partLines.innerHTML = html`<tr><td colspan="4" class="cell-muted">Chưa có linh kiện nào trong yêu cầu.</td></tr>`;
    } else {
      el.partLines.innerHTML = html`${state.partLines.map((line, i) => {
        const part = state.parts.find((p) => p.sku === line.sku) || {};
        return html`<tr><td class="mono">${line.sku}</td><td>${part.name || "—"}</td><td>${line.quantity}</td>
          <td><button type="button" class="item-row__remove" data-remove-part="${i}" aria-label="Xoá dòng">×</button></td></tr>`;
      })}`;
      el.partLines.querySelectorAll("[data-remove-part]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.partLines.splice(Number(btn.getAttribute("data-remove-part")), 1);
          renderPartLines();
        });
      });
    }
    el.submitParts.disabled = state.partLines.length === 0;
  }

  async function openPartsDrawer(t) {
    el.drawerSubtitle.textContent = `${t.code} — ${t.device.deviceTypeName} (${t.device.productName})`;
    state.partLines = [];
    el.partReason.value = "";
    el.partQty.value = 1;
    el.partInfo.hidden = true;
    el.qtyField.classList.remove("has-error");
    el.qtyError.hidden = true;
    renderPartLines();
    window.openDialog(el.drawer);
    try {
      state.parts = await api.inventory.parts({ category: t.device.categoryCode });
      ui.fillSelect(el.partSelect, state.parts.map((p) => ({ value: p.sku, label: `${p.sku} — ${p.name}` })));
    } catch (error) {
      ui.showError(error);
    }
  }

  function closePartsDrawer() {
    window.closeDialog(el.drawer);
  }

  function addPartLine() {
    const part = state.parts.find((p) => p.sku === el.partSelect.value);
    const qty = Number(el.partQty.value);
    el.qtyField.classList.remove("has-error");
    el.qtyError.hidden = true;
    const fail = (message) => {
      el.qtyField.classList.add("has-error");
      el.qtyError.textContent = message;
      el.qtyError.hidden = false;
    };
    if (!part) return fail("Vui lòng chọn linh kiện cần yêu cầu.");
    if (!qty || qty <= 0) return fail("Vui lòng nhập số lượng yêu cầu.");
    const already = state.partLines.filter((l) => l.sku === part.sku).reduce((s, l) => s + l.quantity, 0);
    if (qty + already > part.available) return fail("Số lượng xuất kho không được vượt quá tồn khả dụng.");
    const existing = state.partLines.find((l) => l.sku === part.sku);
    if (existing) existing.quantity += qty;
    else state.partLines.push({ sku: part.sku, quantity: qty });
    renderPartLines();
    return undefined;
  }

  async function submitPartsRequest() {
    const t = state.ticket;
    if (!t || state.partLines.length === 0) return;
    try {
      const issue = await ui.busy(el.submitParts, () =>
        api.inventory.requestIssue({ ticketCode: t.code, lines: state.partLines, reason: el.partReason.value.trim() || null })
      );
      closePartsDrawer();
      window.showToast(`Đã gửi yêu cầu linh kiện ${issue.code} tới kho vật tư.`, "success");
      await loadQueue();
      await selectTicket(t.code);
    } catch (error) {
      ui.showError(error);
    }
  }

  function bindDrawer() {
    document.querySelector("[data-drawer-close]").addEventListener("click", closePartsDrawer);
    document.querySelector("[data-drawer-cancel]").addEventListener("click", closePartsDrawer);
    el.drawer.addEventListener("click", (e) => {
      if (e.target === el.drawer) closePartsDrawer();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !el.drawer.hasAttribute("hidden")) closePartsDrawer();
    });
    el.partSelect.addEventListener("change", () => {
      const part = state.parts.find((p) => p.sku === el.partSelect.value);
      el.partInfo.hidden = !part;
      if (!part) return;
      el.partAvailable.textContent = part.available;
      el.partReserved.textContent = part.reserved;
      el.partBin.textContent = part.primaryBin;
    });
    document.querySelector("[data-add-part-line]").addEventListener("click", addPartLine);
    el.submitParts.addEventListener("click", submitPartsRequest);
  }

  window.LML_AUTH.ready(async () => {
    bindDrawer();
    try {
      const [categories, servicePrices, parts] = await Promise.all([
        api.catalog.list("device-categories"),
        api.catalog.list("service-prices"),
        api.inventory.parts({}),
      ]);
      state.catalog = { categories, servicePrices: servicePrices.filter((s) => s.active !== false) };
      state.parts = parts;
    } catch (error) {
      ui.showError(error);
    }
    await loadQueue();
    const requested = new URLSearchParams(location.search).get("ticket");
    if (requested) selectTicket(requested);
    setInterval(tickTimers, 1000);
    setInterval(loadQueue, 60 * 1000);
  });
}
