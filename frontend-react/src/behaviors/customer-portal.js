/* Public customer portal. Only the deliberately projected /portal API is used. */
export default function initialize() {

  const api = window.LML_API;
  const fmt = window.LML_FMT;
  const labels = window.LML_LABELS;
  const el = {
    lookupId: document.querySelector("#lookupId"),
    lookupPhone: document.querySelector("#lookupPhone"),
    submit: document.querySelector("[data-lookup-submit]"),
    error: document.querySelector("[data-lookup-error]"),
    result: document.querySelector("[data-lookup-result]"),
    register: document.querySelector("[data-register-section]"),
    openRegister: document.querySelector("[data-open-register]"),
    closeRegister: document.querySelector("[data-close-register]"),
    registerSubmit: document.querySelector("[data-register-submit]"),
    registerSuccess: document.querySelector("[data-register-success]"),
    category: document.querySelector("#reg-category"),
    station: document.querySelector("#reg-station"),
    serialLabel: document.querySelector("[data-reg-serial-label]"),
  };
  let catalog = null;

  function field(name) {
    return document.querySelector(`[data-field="${name}"]`);
  }

  function clearErrors() {
    document.querySelectorAll(".form-field.has-error").forEach((node) => node.classList.remove("has-error"));
    document.querySelectorAll(".form-field__error").forEach((node) => node.setAttribute("hidden", ""));
    el.error.hidden = true;
    el.error.textContent = "";
  }

  function invalid(name, message) {
    const wrapper = field(name);
    if (!wrapper) return;
    wrapper.classList.add("has-error");
    const note = wrapper.querySelector(".form-field__error");
    if (note) {
      note.textContent = message;
      note.hidden = false;
    }
  }

  function showError(error) {
    el.error.textContent = (error && error.detail) || "Đã xảy ra lỗi. Vui lòng thử lại.";
    el.error.hidden = false;
  }

  function renderTicket(ticket) {
    el.result.innerHTML = html`
      <section class="card">
        <div class="card__header"><h2 class="card__title">Thông tin thiết bị</h2>${fmt.badgeOf(labels.TICKET_STATUS, ticket.status)}</div>
        <div class="card__body"><div class="detail-grid">
          <div class="detail-grid__item"><span class="kv-key">Mã phiếu</span><span class="mono">${ticket.code}</span></div>
          <div class="detail-grid__item"><span class="kv-key">Thiết bị</span><span>${ticket.brandName} ${ticket.productName}</span></div>
          <div class="detail-grid__item"><span class="kv-key">Serial/IMEI</span><span class="mono">${ticket.serialOrImei}</span></div>
          <div class="detail-grid__item"><span class="kv-key">Ngày tiếp nhận</span><span>${fmt.dateTime(ticket.receivedAt)}</span></div>
          <div class="detail-grid__item"><span class="kv-key">Ngày dự kiến trả</span><span>${fmt.dateTime(ticket.promisedReturnAt)}</span></div>
        </div></div>
      </section>
      <section class="card"><div class="card__header"><h2 class="card__title">Tiến độ sửa chữa</h2></div>
        <div class="card__body"><div class="progress-stepper">${ticket.steps.map((step, index) => html`
          <div class="progress-step ${step.state === "DONE" ? "is-done" : ""} ${step.state === "CURRENT" ? "is-current" : ""}">
            <div class="progress-step__track"><div class="progress-step__line progress-step__line--left"></div><div class="progress-step__circle">${step.state === "DONE" ? "✓" : index + 1}</div><div class="progress-step__line progress-step__line--right"></div></div>
            <div class="progress-step__label">${step.label}</div><div class="progress-step__state">${step.state === "DONE" ? "Hoàn tất" : step.state === "CURRENT" ? "Đang xử lý" : "Chưa tới"}</div>
          </div>`)}</div></div>
      </section>
      <section class="card"><div class="card__header"><h2 class="card__title">Ghi chú từ trung tâm sửa chữa</h2></div>
        <div class="card__body">${ticket.customerNotes.length ? ticket.customerNotes.map((note) => html`<p><span class="cell-muted">${fmt.dateTime(note.at)}</span> — ${note.text}</p>`) : html`<div class="empty-selection-hint">Chưa có ghi chú mới.</div>`}</div>
      </section>
      <section class="card"><div class="card__header"><h2 class="card__title">Chi phí dự kiến</h2></div><div class="card__body">
        <div class="billing-row"><span class="kv-key">Chi phí trong bảo hành</span><span>${fmt.money(ticket.costs.inWarrantyAmount)}</span></div>
        <div class="billing-row"><span class="kv-key">Linh kiện ngoài bảo hành</span><span>${fmt.money(ticket.costs.outOfWarrantyParts)}</span></div>
        <div class="billing-row"><span class="kv-key">Phí dịch vụ</span><span>${fmt.money(ticket.costs.serviceFee)}</span></div>
        <div class="billing-row"><span class="kv-key">VAT</span><span>${fmt.money(ticket.costs.vat)}</span></div>
        <div class="billing-total-row"><span class="kv-key">Tổng thanh toán</span><span>${fmt.money(ticket.costs.total)}</span></div>
      </div></section>
      ${ticket.pendingQuotation ? quotation(ticket) : ""}`;
    el.result.hidden = false;
    const accept = el.result.querySelector("[data-quote-accept]");
    const decline = el.result.querySelector("[data-quote-decline]");
    if (accept) accept.addEventListener("click", (event) => decide(ticket.code, "ACCEPT", null, event.currentTarget));
    if (decline) decline.addEventListener("click", async (event) => {
      const reason = await window.LML_UI.promptReason({
        title: "Từ chối báo giá?",
        message: "Trung tâm sẽ dừng phần sửa chữa tính phí sau khi xác nhận.",
        confirmLabel: "Từ chối báo giá",
        placeholder: "Nhập lý do từ chối",
      });
      if (reason) await decide(ticket.code, "DECLINE", reason, event.currentTarget);
    });
  }

  function quotation(ticket) {
    const quote = ticket.pendingQuotation;
    return html`<section class="card"><div class="card__header"><div><h2 class="card__title">Xác nhận báo giá sửa chữa</h2><div class="card__title-meta">Có hiệu lực đến ${fmt.date(quote.validUntil)}</div></div>${fmt.badge("warning", "Chờ khách xác nhận")}</div>
      <div class="card__body">${quote.lines.map((line) => html`<div class="billing-row"><span>${line.description} × ${line.quantity}</span><span>${fmt.money(line.lineTotal)}</span></div>`)}
        <div class="billing-total-row"><span class="kv-key">Tổng khách phải trả</span><span>${fmt.money(quote.grandTotal)}</span></div>
        <div class="action-bar" style="margin-top:14px;"><button type="button" class="btn btn--destructive" data-quote-decline>Từ chối báo giá</button><button type="button" class="btn btn--primary" data-quote-accept>Xác nhận báo giá</button></div>
      </div></section>`;
  }

  async function decide(code, decision, reason, button) {
    try {
      const updated = await window.LML_UI.busy(button, () => api.portal.decide(code, decision, reason));
      window.showToast(decision === "ACCEPT" ? "Đã xác nhận báo giá." : "Đã từ chối báo giá.", "success");
      renderTicket(updated);
    } catch (error) {
      showError(error);
    }
  }

  function renderRequest(request) {
    el.result.innerHTML = html`<section class="card"><div class="card__header"><h2 class="card__title">Yêu cầu bảo hành trực tuyến</h2>${fmt.badgeOf(labels.WARRANTY_REQUEST_STATUS, request.status)}</div><div class="card__body"><div class="detail-grid">
      <div class="detail-grid__item"><span class="kv-key">Mã yêu cầu</span><span class="mono">${request.code}</span></div>
      <div class="detail-grid__item"><span class="kv-key">Thiết bị</span><span>${request.brandModel}</span></div>
      <div class="detail-grid__item"><span class="kv-key">Serial/IMEI</span><span class="mono">${request.serialOrImei}</span></div>
      <div class="detail-grid__item"><span class="kv-key">Thời gian mong muốn</span><span>${fmt.dateTime(request.preferredFrom)}</span></div>
      ${request.ticketCode ? html`<div class="detail-grid__item"><span class="kv-key">Phiếu tiếp nhận</span><span class="mono">${request.ticketCode}</span></div>` : ""}
    </div></div></section>`;
    el.result.hidden = false;
  }

  async function lookup() {
    clearErrors();
    const code = el.lookupId.value.trim().toUpperCase();
    const phone = el.lookupPhone.value.trim();
    if (!code) invalid("lookupId", "Vui lòng nhập mã phiếu hoặc mã yêu cầu.");
    if (!phone) invalid("lookupPhone", "Vui lòng nhập số điện thoại.");
    if (!code || !phone) return;
    try {
      const grant = await window.LML_UI.busy(el.submit, () => api.portal.lookup(code, phone));
      api.portalTokens.set(grant);
      if (grant.scope === "TICKET") renderTicket(await api.portal.ticket(grant.code));
      else renderRequest(await api.portal.request(grant.code));
    } catch (error) {
      showError(error);
    }
  }

  function selectedCategory() {
    return catalog && catalog.categories.find((item) => item.code === el.category.value);
  }

  function updateSerialLabel() {
    const type = selectedCategory() && selectedCategory().deviceTypes[0];
    el.serialLabel.innerHTML = html`${type && type.identifierType === "IMEI" ? "IMEI" : "Serial Number"}<span class="required-mark">*</span>`;
  }

  async function loadCatalog() {
    try {
      catalog = await api.portal.catalog();
      el.category.innerHTML = html`<option value="">— Chọn loại thiết bị —</option>${catalog.categories.map((item) => html`<option value="${item.code}">${item.name}</option>`)}`;
      el.station.innerHTML = html`<option value="">— Chọn trạm —</option>${catalog.stations.map((item) => html`<option value="${item.code}">${item.name} — ${item.address}</option>`)}`;
    } catch (error) {
      showError(error);
    }
  }

  async function register() {
    clearErrors();
    const category = selectedCategory();
    const type = category && category.deviceTypes[0];
    const value = (id) => document.querySelector(id).value.trim();
    const required = [
      ["regName", "#reg-name", "Vui lòng nhập họ và tên."], ["regPhone", "#reg-phone", "Vui lòng nhập số điện thoại."],
      ["regCategory", "#reg-category", "Vui lòng chọn loại thiết bị."], ["regBrandModel", "#reg-brand-model", "Vui lòng nhập hãng/model."],
      ["regSerial", "#reg-serial", "Vui lòng nhập Serial/IMEI."], ["regSymptom", "#reg-symptom", "Vui lòng mô tả lỗi."],
      ["regStation", "#reg-station", "Vui lòng chọn trạm."], ["regTime", "#reg-time", "Vui lòng chọn thời gian mong muốn."],
    ];
    let valid = true;
    required.forEach(([name, selector, message]) => { if (!value(selector)) { invalid(name, message); valid = false; } });
    if (!valid || !type) return;
    const from = new Date(value("#reg-time"));
    if (Number.isNaN(from.getTime())) {
      invalid("regTime", "Thời gian không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }
    const files = Array.from(document.querySelector("#reg-media").files || []);
    const data = {
      customer: { fullName: value("#reg-name"), phone: value("#reg-phone"), email: null, address: null },
      categoryCode: category.code,
      deviceTypeCode: type.code,
      brandModel: value("#reg-brand-model"),
      identifierType: type.identifierType,
      serialOrImei: value("#reg-serial"),
      symptom: value("#reg-symptom"),
      preferredStation: value("#reg-station"),
      preferredFrom: from.toISOString(),
      preferredTo: new Date(from.getTime() + 3600000).toISOString(),
    };
    try {
      const created = await window.LML_UI.busy(el.registerSubmit, () => api.portal.submitRequest(data, files));
      el.registerSuccess.innerHTML = html`<div class="success-banner">Gửi yêu cầu thành công — Mã yêu cầu: <span class="mono">${created.code}</span>. Vui lòng lưu lại mã này để tra cứu.</div>`;
      el.registerSuccess.hidden = false;
    } catch (error) {
      showError(error);
    }
  }

  return () => {
    loadCatalog();
    el.submit.addEventListener("click", lookup);
    el.lookupPhone.addEventListener("keydown", (event) => { if (event.key === "Enter") lookup(); });
    el.openRegister.addEventListener("click", () => { el.register.hidden = false; el.register.scrollIntoView({ behavior: window.LML_UI.scrollBehavior() }); });
    el.closeRegister.addEventListener("click", () => { el.register.hidden = true; });
    el.category.addEventListener("change", updateSerialLabel);
    el.registerSubmit.addEventListener("click", register);
  };
}
