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
  const TONE = { processing: "badge-processing", warning: "badge-waiting", success: "badge-completed", neutral: "badge-received", danger: "badge-danger" };

  /** Badge theo giao diện khách (customer.css); cùng bảng nhãn/tone với LML_LABELS. */
  function badge(table, code) {
    const entry = table[code];
    return html`<span class="badge ${TONE[entry ? entry.tone : "neutral"]}">${entry ? entry.label : code || "—"}</span>`;
  }

  function field(name) {
    return document.querySelector(`[data-field="${name}"]`);
  }

  function clearErrors() {
    document.querySelectorAll("[data-field].has-error").forEach((node) => node.classList.remove("has-error"));
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
    const costs = ticket.costs;
    el.result.innerHTML = html`
      <div class="ticket-hero-card">
        <div><h2 style="font-size:26px;font-weight:900;line-height:1.2;margin-bottom:8px;">${ticket.brandName} ${ticket.productName}</h2>
          <div class="ticket-hero-meta"><span>Mã phiếu: <strong class="mono">${ticket.code}</strong></span><span>Serial/IMEI: <strong class="mono">${ticket.serialOrImei}</strong></span></div></div>
        ${badge(labels.TICKET_STATUS, ticket.status)}
      </div>
      ${ticket.pendingQuotation ? quotation(ticket) : ""}
      <div class="detail-grid-2">
        <section class="content-panel-card"><h2 class="card-heading-title">Tiến độ sửa chữa</h2>
          <ol class="timeline-stepper">${ticket.steps.map((step, index) => html`
            <li class="timeline-node-item ${step.state === "DONE" ? "is-done" : ""} ${step.state === "CURRENT" ? "active" : ""}">
              <span class="timeline-dot">${step.state === "DONE" ? "✓" : index + 1}</span>
              <div class="timeline-title">${step.label}</div>
              <div class="timeline-desc">${step.state === "DONE" ? "Hoàn tất" : step.state === "CURRENT" ? "Đang xử lý" : "Chưa tới"}</div>
            </li>`)}</ol>
        </section>
        <div class="content-stack">
          <section class="content-panel-card"><h2 class="card-heading-title" style="margin-bottom:12px;">Thông tin phiếu</h2><div class="kv-list">
            <div class="kv-row"><span>Ngày tiếp nhận</span><strong>${fmt.dateTime(ticket.receivedAt)}</strong></div>
            <div class="kv-row"><span>Ngày dự kiến trả</span><strong>${fmt.dateTime(ticket.promisedReturnAt)}</strong></div>
          </div></section>
          <section class="content-panel-card"><h2 class="card-heading-title" style="margin-bottom:12px;">Chi phí dự kiến</h2><div class="kv-list">
            <div class="kv-row"><span>Chi phí trong bảo hành</span><span>${fmt.money(costs.inWarrantyAmount)}</span></div>
            <div class="kv-row"><span>Linh kiện ngoài bảo hành</span><span>${fmt.money(costs.outOfWarrantyParts)}</span></div>
            <div class="kv-row"><span>Phí dịch vụ</span><span>${fmt.money(costs.serviceFee)}</span></div>
            <div class="kv-row"><span>VAT</span><span>${fmt.money(costs.vat)}</span></div>
            <div class="kv-row is-total"><span>Tổng thanh toán</span><span>${fmt.money(costs.total)}</span></div>
          </div></section>
        </div>
      </div>
      <section class="content-panel-card"><h2 class="card-heading-title" style="margin-bottom:16px;">Ghi chú từ trung tâm sửa chữa</h2>
        ${ticket.customerNotes.length ? html`<ul class="note-list">${ticket.customerNotes.map((note) => html`<li><time>${fmt.dateTime(note.at)}</time>${note.text}</li>`)}</ul>` : html`<p class="card-heading-desc">Chưa có ghi chú mới.</p>`}
      </section>`;
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
    return html`<section class="content-panel-card quote-card"><div class="panel-head"><div><h2 class="card-heading-title">Xác nhận báo giá sửa chữa</h2><p class="card-heading-desc">Có hiệu lực đến ${fmt.date(quote.validUntil)}</p></div><span class="badge badge-waiting">Chờ khách xác nhận</span></div>
      <div class="kv-list">${quote.lines.map((line) => html`<div class="kv-row"><span>${line.description} × ${line.quantity}</span><span>${fmt.money(line.lineTotal)}</span></div>`)}
        <div class="kv-row is-total"><span>Tổng khách phải trả</span><span>${fmt.money(quote.grandTotal)}</span></div></div>
      <div class="quote-actions"><button type="button" class="btn-secondary-white btn-danger-outline" data-quote-decline>Từ chối báo giá</button><button type="button" class="btn-primary-teal" data-quote-accept>Xác nhận báo giá</button></div>
    </section>`;
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
    el.result.innerHTML = html`<section class="content-panel-card"><div class="panel-head"><h2 class="card-heading-title">Yêu cầu bảo hành trực tuyến</h2>${badge(labels.WARRANTY_REQUEST_STATUS, request.status)}</div><div class="kv-list">
      <div class="kv-row"><span>Mã yêu cầu</span><strong class="mono">${request.code}</strong></div>
      <div class="kv-row"><span>Thiết bị</span><strong>${request.brandModel}</strong></div>
      <div class="kv-row"><span>Serial/IMEI</span><strong class="mono">${request.serialOrImei}</strong></div>
      <div class="kv-row"><span>Thời gian mong muốn</span><strong>${fmt.dateTime(request.preferredFrom)}</strong></div>
      ${request.ticketCode ? html`<div class="kv-row"><span>Phiếu tiếp nhận</span><strong class="mono">${request.ticketCode}</strong></div>` : ""}
    </div></section>`;
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
      el.registerSuccess.innerHTML = html`<div class="kh-alert kh-alert--success" role="status">Gửi yêu cầu thành công — Mã yêu cầu: <span class="mono">${created.code}</span>. Vui lòng lưu lại mã này để tra cứu.</div>`;
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
    // #dang-ky (link "Gửi yêu cầu bảo hành" của header khi chưa đăng nhập) mở sẵn form yêu cầu.
    const openFromHash = () => { if (location.hash === "#dang-ky") el.openRegister.click(); };
    window.addEventListener("hashchange", openFromHash);
    openFromHash();
    el.closeRegister.addEventListener("click", () => {
      el.register.hidden = true;
      if (location.hash === "#dang-ky") history.replaceState(null, "", location.pathname + location.search);
    });
    el.category.addEventListener("change", updateSerialLabel);
    el.registerSubmit.addEventListener("click", register);
  };
}
