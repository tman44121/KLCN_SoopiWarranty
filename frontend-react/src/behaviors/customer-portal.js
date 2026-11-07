import { businessTimeError, businessInstant, appointmentEnd } from "../business-hours.js";
import { phoneError } from "../validation.ts";
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
  /** Kết quả kiểm tra bảo hành theo Serial của lần tra cứu hiện tại; hiện phía trên phiếu/yêu cầu. */
  let warranty = null;
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
    window.LML_UI.clearFieldErrors(document);
    el.error.hidden = true;
    el.error.textContent = "";
  }

  function clearField(name) {
    const wrapper = field(name);
    if (!wrapper) return;
    window.LML_UI.clearFieldErrors(wrapper);
  }

  /** Mã phiếu (TN-/YC-) hoặc số Serial/IMEI. */
  function lookupIdError(raw) {
    const code = raw.trim().toUpperCase();
    if (!code) return "Vui lòng nhập mã phiếu (TN-…, YC-…) hoặc số Serial/IMEI.";
    if (/^(TN|YC)-/.test(code)) return /^(TN|YC)-[0-9]{4}-[0-9]{4}-[0-9]{5}$/.test(code) ? null : "Mã phiếu chưa đủ — dạng TN-2026-0917-00421.";
    if (/[^A-Z0-9\s-]/.test(code)) return "Số Serial/IMEI chỉ gồm chữ, số và dấu gạch ngang.";
    return code.replace(/\s/g, "").length < 4 ? "Số Serial/IMEI quá ngắn — kiểm tra lại số in trên tem thiết bị." : null;
  }

  /** Báo lỗi ngay khi gõ (ô trống chỉ báo khi rời ô hoặc bấm gửi). */
  function liveCheck(name, input, check) {
    const run = (requireValue) => {
      const message = !input.value.trim() && !requireValue ? null : check(input.value);
      if (message) invalid(name, message);
      else clearField(name);
      input.setAttribute("aria-invalid", message ? "true" : "false");
      if (message) input.removeAttribute("data-valid"); else if (input.value.trim()) input.setAttribute("data-valid", "true");
    };
    input.addEventListener("input", () => run(false));
    input.addEventListener("blur", () => { if (input.dataset.touched) run(true); });
    input.addEventListener("input", () => { input.dataset.touched = "1"; }, { once: true });
  }

  function invalid(name, message) {
    window.LML_UI.fieldError(field(name), message);
  }

  function showError(error) {
    el.error.textContent = (error && error.detail) || "Đã xảy ra lỗi. Vui lòng thử lại.";
    el.error.hidden = false;
  }

  const WARRANTY_NOTE = {
    IN_WARRANTY: "Bảo hành áp dụng cho lỗi kỹ thuật của nhà sản xuất; trung tâm kiểm tra điều kiện bảo hành khi tiếp nhận máy.",
    OUT_OF_WARRANTY: "Máy vẫn được sửa chữa dịch vụ; trung tâm báo giá để bạn duyệt trước khi sửa.",
    NOT_ACTIVATED: "Mang kèm hóa đơn mua hàng tới trạm để trung tâm xác định ngày bắt đầu bảo hành.",
  };

  function warrantyCard() {
    if (!warranty) return "";
    const w = warranty.data;
    const repairs = w.repairCount
      ? html`Đã tiếp nhận ${w.repairCount} lần, gần nhất ${fmt.date(w.lastReceivedOn)}${w.atServiceCenter ? " · máy đang ở trung tâm" : ""}`
      : "Chưa sửa chữa lần nào tại trung tâm";
    const expiry = !w.warrantyExpiresOn ? "—"
      : w.warrantyStatus === "IN_WARRANTY" ? html`${fmt.date(w.warrantyExpiresOn)} <span class="warranty-check-remaining">${w.daysRemaining === 0 ? "hết hạn hôm nay" : `còn ${w.daysRemaining} ngày`}</span>`
      : html`${fmt.date(w.warrantyExpiresOn)} <span class="warranty-check-remaining is-expired">đã hết hạn</span>`;
    return html`<section class="content-panel-card warranty-check-card" aria-labelledby="warranty-check-title">
      <div class="panel-head"><div><h2 class="card-heading-title" id="warranty-check-title">Thông tin bảo hành</h2>
        <p class="card-heading-desc">${[w.brandName, w.productName].filter(Boolean).join(" ")}${w.deviceTypeName ? ` · ${w.deviceTypeName}` : ""}</p></div>
        ${badge(labels.WARRANTY_STATUS, w.warrantyStatus)}</div>
      <div class="kv-list">
        <div class="kv-row"><span>${w.identifierType === "IMEI" ? "IMEI" : "Serial"}</span><strong class="mono">${w.serialOrImei}</strong></div>
        <div class="kv-row"><span>Ngày kích hoạt bảo hành</span><strong>${w.warrantyActivatedOn ? fmt.date(w.warrantyActivatedOn) : "Chưa kích hoạt"}</strong></div>
        <div class="kv-row"><span>Hạn bảo hành</span><strong>${expiry}</strong></div>
        <div class="kv-row"><span>Thời hạn theo chính sách</span><strong>${w.warrantyMonths} tháng</strong></div>
        <div class="kv-row"><span>Lịch sử sửa chữa</span><strong>${repairs}</strong></div>
      </div>
      <p class="card-heading-desc warranty-check-note">${WARRANTY_NOTE[w.warrantyStatus] || ""}</p>
      ${warranty.notice ? html`<div class="kh-alert kh-alert--warning" role="status">${warranty.notice}</div>` : ""}
    </section>`;
  }

  function renderWarranty() {
    el.result.innerHTML = html`${warrantyCard()}`;
    el.result.hidden = false;
  }

  function renderTicket(ticket) {
    const costs = ticket.costs;
    el.result.innerHTML = html`${warrantyCard()}
      <div class="ticket-hero-card">
        <div><h2 style="font-size:26px;font-weight:900;line-height:1.2;margin-bottom:8px;">${ticket.brandName} ${ticket.productName}</h2>
          <div class="ticket-hero-meta"><span>Mã phiếu: <strong class="mono">${ticket.code}</strong></span><span>Serial/IMEI: <strong class="mono">${ticket.serialOrImei}</strong></span></div></div>
        ${badge(labels.TICKET_STATUS_CUSTOMER, ticket.status)}
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
          </div>${costs.paymentQr ? html`<figure class="payment-qr">
            <img src="${costs.paymentQr.imageUrl}" alt="Mã VietQR chuyển khoản ${fmt.money(costs.paymentQr.amount)}, nội dung ${costs.paymentQr.transferNote}" width="240" height="240" loading="lazy" />
            <figcaption><div>Quét bằng ứng dụng ngân hàng để chuyển khoản</div>
              <div>${costs.paymentQr.bankId} · <strong class="mono">${costs.paymentQr.accountNo}</strong></div>
              <div>Nội dung: <strong class="mono">${costs.paymentQr.transferNote}</strong></div></figcaption>
          </figure>` : ""}</section>
        </div>
      </div>
      <section class="content-panel-card"><h2 class="card-heading-title" style="margin-bottom:16px;">Ghi chú từ trung tâm sửa chữa</h2>
        ${ticket.customerNotes.length ? html`<ul class="note-list">${ticket.customerNotes.map((note) => html`<li><time>${fmt.dateTime(note.at)}</time>${note.text}</li>`)}</ul>` : html`<p class="card-heading-desc">Chưa có ghi chú mới.</p>`}
      </section>`;
    el.result.hidden = false;
    const accept = el.result.querySelector("[data-quote-accept]");
    const decline = el.result.querySelector("[data-quote-decline]");
    if (accept) accept.addEventListener("click", async (event) => {
      const quote = ticket.pendingQuotation;
      const confirmed = await window.LML_UI.confirm({
        title: "Xác nhận duyệt báo giá sửa chữa?",
        message: `Tổng chi phí xác nhận thanh toán là ${fmt.money(quote.grandTotal)} (đã gồm linh kiện, tiền công và thuế VAT). Linh kiện thay thế được bảo hành chính hãng. Bạn chỉ thanh toán khi đã kiểm tra và nhận máy hoàn tất.`,
        confirmLabel: `Tôi đồng ý mức giá (${fmt.money(quote.grandTotal)})`,
        cancelLabel: "Xem lại",
        destructive: false,
      });
      if (confirmed) await decide(ticket.code, "ACCEPT", null, event.currentTarget);
    });
    if (decline) decline.addEventListener("click", async (event) => {
      const reason = await window.LML_UI.promptReason({
        title: "Từ chối báo giá sửa chữa?",
        message: "Lưu ý: Trung tâm sẽ dừng phần sửa chữa tính phí và chuẩn bị thủ tục trả lại thiết bị nguyên trạng.",
        confirmLabel: "Xác nhận từ chối",
        placeholder: "Nhập lý do từ chối (bắt buộc)...",
      });
      if (reason) await decide(ticket.code, "DECLINE", reason, event.currentTarget);
    });
  }

  function quotation(ticket) {
    const quote = ticket.pendingQuotation;
    return html`<section class="content-panel-card quote-card"><div class="panel-head"><div><h2 class="card-heading-title">Xác nhận báo giá sửa chữa</h2><p class="card-heading-desc">Có hiệu lực đến ${fmt.date(quote.validUntil)}</p>${quote.respondBy ? html`<p class="card-heading-desc">Vui lòng phản hồi trước ${fmt.dateTime(quote.respondBy)}. Hết hạn, báo giá sẽ tự động bị từ chối và máy chờ trả lại.</p>` : ""}</div><span class="badge badge-waiting">Chờ khách xác nhận</span></div>
      <div class="kv-list">${quote.lines.map((line) => html`<div class="kv-row"><span>${line.description} × ${line.quantity}</span><span>${fmt.money(line.lineTotal)}</span></div>`)}
        <div class="kv-row"><span>Linh kiện thay thế</span><span>${fmt.money(quote.partsTotal)}</span></div>
        <div class="kv-row"><span>Tiền công kỹ thuật</span><span>${fmt.money(quote.laborTotal)}</span></div>
        <div class="kv-row"><span>Thuế VAT (${Number(quote.vatRate)}%)</span><span>${fmt.money(quote.grandTotal - quote.partsTotal - quote.laborTotal)}</span></div>
        <div class="kv-row is-total"><span>Tổng khách phải trả</span><span style="color:var(--kh-forest);font-weight:800;">${fmt.money(quote.grandTotal)}</span></div></div>
      <div class="quote-actions"><button type="button" class="btn-secondary-white btn-danger-outline" data-quote-decline>Từ chối báo giá</button><button type="button" class="btn-primary-teal" data-quote-accept>Kiểm tra &amp; Xác nhận giá →</button></div>
    </section>`;
  }

  async function decide(code, decision, reason, button) {
    try {
      const updated = await window.LML_UI.busy(button, () => api.portal.decide(code, decision, reason));
      window.showToast(decision === "ACCEPT" ? "Đã xác nhận báo giá. Kỹ thuật viên sẽ tiến hành sửa chữa." : "Đã từ chối báo giá.", "success");
      renderTicket(updated);
    } catch (error) {
      showError(error);
    }
  }

  function renderRequest(request) {
    el.result.innerHTML = html`${warrantyCard()}<section class="content-panel-card"><div class="panel-head"><h2 class="card-heading-title">Yêu cầu bảo hành trực tuyến</h2>${badge(labels.WARRANTY_REQUEST_STATUS, request.status)}</div><div class="kv-list">
      <div class="kv-row"><span>Mã yêu cầu</span><strong class="mono">${request.code}</strong></div>
      <div class="kv-row"><span>Thiết bị</span><strong>${request.brandModel}</strong></div>
      <div class="kv-row"><span>Serial/IMEI</span><strong class="mono">${request.serialOrImei}</strong></div>
      <div class="kv-row"><span>Thời gian mong muốn</span><strong>${fmt.dateTime(request.preferredFrom)}</strong></div>
      ${request.ticketCode ? html`<div class="kv-row"><span>Phiếu tiếp nhận</span><strong class="mono">${request.ticketCode}</strong></div>` : ""}
    </div>
    ${request.ticketCode ? html`
      <div class="kh-alert kh-alert--warning" style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <strong>Thiết bị đã được tiếp nhận tại trạm:</strong>
          <div>Phiếu sửa chữa <span class="mono">${request.ticketCode}</span> đã được lập. Bạn có thể xem chi tiết tiến độ và xác nhận báo giá.</div>
        </div>
        <button type="button" class="btn-primary-teal btn-sm" data-load-ticket="${request.ticketCode}">Xem tiến độ &amp; Báo giá →</button>
      </div>` : ""}
    </section>`;
    el.result.hidden = false;
    const loadTicketBtn = el.result.querySelector("[data-load-ticket]");
    if (loadTicketBtn) {
      loadTicketBtn.addEventListener("click", async () => {
        const ticketCode = loadTicketBtn.getAttribute("data-load-ticket");
        const phone = el.lookupPhone.value.trim();
        try {
          const grant = await window.LML_UI.busy(loadTicketBtn, () => api.portal.lookup(ticketCode, phone));
          api.portalTokens.set(grant);
          renderTicket(await api.portal.ticket(grant.code));
          window.scrollTo({ top: el.result.offsetTop - 20, behavior: window.LML_UI.scrollBehavior() });
        } catch (error) {
          showError(error);
        }
      });
    }
  }

  async function showGrant(grant) {
    api.portalTokens.set(grant);
    if (grant.scope === "TICKET") renderTicket(await api.portal.ticket(grant.code));
    else renderRequest(await api.portal.request(grant.code));
  }

  /**
   * Mã phiếu: bắt buộc SĐT. Serial/IMEI: luôn kiểm tra bảo hành (không cần SĐT); có SĐT thì tra thêm phiếu/yêu cầu của máy đó.
   * Máy chưa đăng ký nhưng đã gửi yêu cầu (YC) vẫn hiện yêu cầu nếu SĐT khớp.
   */
  async function lookup() {
    clearErrors();
    warranty = null;
    el.result.hidden = true;
    const code = el.lookupId.value.trim().toUpperCase();
    const phone = el.lookupPhone.value.trim();
    const byCode = /^(TN|YC)-/.test(code);
    const idError = lookupIdError(code);
    if (idError) invalid("lookupId", idError);
    if (!phone && byCode) invalid("lookupPhone", "Vui lòng nhập số điện thoại đã đăng ký khi gửi máy.");
    else if (phone && phoneError(phone)) invalid("lookupPhone", phoneError(phone));
    if (document.querySelector("[data-field].has-error")) {
      document.querySelector('[data-field].has-error [aria-invalid="true"]')?.focus();
      return;
    }
    try {
      if (byCode) {
        await window.LML_UI.busy(el.submit, async () => showGrant(await api.portal.lookup(code, phone)));
        return;
      }
      await window.LML_UI.busy(el.submit, async () => {
        const [check, grant] = await Promise.allSettled([
          api.portal.warrantyCheck(code),
          phone ? api.portal.lookup(code, phone) : Promise.resolve(null),
        ]);
        if (check.status === "fulfilled") {
          const notice = !phone ? "Nhập thêm số điện thoại đã đăng ký khi gửi máy để xem tiến độ và chi tiết từng lần sửa chữa."
            : grant.status === "rejected" && grant.reason && grant.reason.code === "PORTAL_NOT_FOUND"
              ? "Không có phiếu sửa chữa hay yêu cầu nào của máy này đăng ký bằng số điện thoại đã nhập. Kiểm tra lại số điện thoại nếu bạn đã gửi máy."
              : null;
          warranty = { data: check.value, notice };
        }
        if (grant.status === "fulfilled" && grant.value) return showGrant(grant.value);
        if (warranty) return renderWarranty();
        // Không có thiết bị: SĐT có nhập thì lỗi tra phiếu cụ thể hơn, không thì lỗi kiểm tra bảo hành.
        throw phone && grant.status === "rejected" && check.reason && check.reason.code === "WARRANTY_SERIAL_NOT_FOUND" ? grant.reason : check.reason;
      });
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
    // BusinessDateTime owns its date-specific message; do not replace it with a missing-value error.
    const date = document.querySelector('#reg-time-date');
    if (date.validity.customError) { date.focus(); return; }
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
    if (value("#reg-phone") && phoneError(value("#reg-phone"))) { invalid("regPhone", phoneError(value("#reg-phone"))); valid = false; }
    if (!valid || !type) {
      el.register.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    const chosen = value("#reg-time");
    if (businessTimeError(chosen) || businessInstant(chosen).getTime() < Date.now()) {
      invalid("regTime", businessTimeError(chosen) || "Thời gian hẹn phải ở tương lai."); return;
    }
    const from = businessInstant(chosen);
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
      preferredTo: businessInstant(appointmentEnd(chosen)).toISOString(),
    };
    try {
      const created = await window.LML_UI.busy(el.registerSubmit, () => api.portal.submitRequest(data, files));
      el.registerSuccess.innerHTML = html`<div class="kh-alert kh-alert--success" role="status"><span>Gửi yêu cầu thành công — Mã yêu cầu: <span class="mono">${created.code}</span>. Vui lòng lưu lại mã này để tra cứu.</span></div>`;
      el.registerSuccess.hidden = false;
    } catch (error) {
      showError(error);
    }
  }

  return () => {
    loadCatalog();
    el.submit.addEventListener("click", lookup);
    el.lookupPhone.addEventListener("keydown", (event) => { if (event.key === "Enter") lookup(); });
    el.lookupId.addEventListener("keydown", (event) => { if (event.key === "Enter") lookup(); });
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
    liveCheck("lookupId", el.lookupId, lookupIdError);
    // Tra bằng Serial thì SĐT không bắt buộc: chỉ báo khi đã gõ mà sai; bỏ trống với mã phiếu thì báo lúc bấm Tra cứu.
    liveCheck("lookupPhone", el.lookupPhone, (raw) => (raw.trim() ? phoneError(raw) || null : null));
    liveCheck("regName", document.querySelector("#reg-name"), (raw) => !raw.trim() ? "Vui lòng nhập họ và tên." : /[0-9]/.test(raw) ? "Họ và tên không được chứa chữ số." : null);
    liveCheck("regPhone", document.querySelector("#reg-phone"), (raw) => phoneError(raw) || null);
    liveCheck("regSerial", document.querySelector("#reg-serial"), (raw) => {
      const serial = raw.replace(/\s/g, "");
      if (!serial) return "Vui lòng nhập Serial/IMEI.";
      const imei = el.serialLabel.textContent.startsWith("IMEI");
      if (imei) return /^[A-Za-z0-9-]{4,50}$/.test(serial) ? null : "IMEI cần 4–50 ký tự chữ, số hoặc dấu gạch ngang.";
      if (/[^A-Za-z0-9-]/.test(serial)) return "Serial chỉ gồm chữ, số và dấu gạch ngang.";
      return serial.length < 4 ? "Serial quá ngắn — tối thiểu 4 ký tự." : serial.length > 50 ? "Serial quá dài — tối đa 50 ký tự." : null;
    });
  };
}
