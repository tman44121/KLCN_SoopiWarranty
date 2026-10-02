/* Cash collection and handover page backed by ticket, billing and handover APIs. */
export default function initialize() {

  const api = window.LML_API;
  const ui = window.LML_UI;
  const fmt = window.LML_FMT;
  const L = window.LML_LABELS;
  const queue = document.querySelector("[data-handover-queue]");
  const detail = document.querySelector("[data-handover-detail]");
  const state = { tickets: [], selected: null, billing: null, signed: false };

  async function loadQueue() {
    ui.blockState(queue, "loading");
    try {
      const [completed, cancelled] = await Promise.all([
        api.tickets.list({ status: "COMPLETED", page: 0, size: 100 }),
        api.tickets.list({ status: "CANCELLED", page: 0, size: 100 }),
      ]);
      state.tickets = completed.items.concat(cancelled.items);
      renderQueue();
      if (state.selected) await selectTicket(state.selected.code);
    } catch (error) {
      ui.blockState(queue, "error", { desc: error.detail }, loadQueue);
    }
  }

  function renderQueue() {
    if (!state.tickets.length) {
      ui.blockState(queue, "empty", { desc: "Không có phiếu nào đang chờ thu ngân hoặc bàn giao." });
      return;
    }
    queue.innerHTML = html`${state.tickets.map((ticket) => html`
      <button type="button" class="queue-item ${state.selected && state.selected.code === ticket.code ? "is-selected" : ""}" data-ticket="${ticket.code}">
        <div class="queue-item__top"><span class="mono cell-primary">${ticket.code}</span>${fmt.badgeOf(L.TICKET_STATUS, ticket.status)}</div>
        <div class="queue-item__device">${ticket.device.productName} · ${ticket.device.brandName}</div>
        <div class="queue-item__symptom">${ticket.customer ? `${ticket.customer.fullName} · ${ticket.customer.phone}` : "—"}</div>
      </button>`)}`;
    queue.querySelectorAll("[data-ticket]").forEach((button) =>
      button.addEventListener("click", () => {
        selectTicket(button.getAttribute("data-ticket"));
        ui.revealDetail(detail);
      })
    );
  }

  async function selectTicket(code) {
    ui.blockState(detail, "loading");
    try {
      state.selected = await api.tickets.get(code);
      state.billing = state.selected.status === "COMPLETED" ? await api.tickets.billing(code) : null;
      state.signed = false;
      renderQueue();
      renderDetail();
    } catch (error) {
      ui.blockState(detail, "error", { desc: error.detail }, () => selectTicket(code));
    }
  }

  function renderDetail() {
    const ticket = state.selected;
    if (!ticket) {
      ui.blockState(detail, "empty", { desc: "Chọn một phiếu trong danh sách “Sẵn sàng bàn giao” để thu tiền và bàn giao." });
      return;
    }
    const billing = state.billing;
    const cancelled = ticket.status === "CANCELLED";
    const settled = cancelled || (billing && billing.paymentStatus !== "UNPAID");
    detail.innerHTML = html`
      <section class="card"><div class="card__header"><div><h2 class="card__title">Chi tiết bàn giao — <span class="mono">${ticket.code}</span></h2>
        <div class="card__title-meta">${ticket.customer && ticket.customer.fullName} · ${ticket.customer && ticket.customer.phone} · ${ticket.device.productName}</div></div>${fmt.badgeOf(L.TICKET_STATUS, ticket.status)}</div></section>
      ${cancelled ? "" : billingCard(billing)}
      ${cancelled || settled ? "" : paymentCard(ticket, billing)}
      <section class="card"><div class="card__header"><h2 class="card__title">Kiểm tra và xác nhận bàn giao</h2></div><div class="card__body">
        <div class="form-field"><label for="receiver-name">Người nhận<span class="required-mark">*</span></label><input id="receiver-name" data-receiver-name value="${ticket.customer ? ticket.customer.fullName : ""}" /></div>
        <div class="form-field"><label for="return-condition">Tình trạng khi trả<span class="required-mark">*</span></label><textarea id="return-condition" data-return-condition>${cancelled ? "Trả nguyên trạng, chưa sửa chữa" : "Thiết bị hoạt động bình thường sau sửa chữa"}</textarea></div>
        ${cancelled ? "" : html`${rechecks()}<div class="form-field"><label>Chữ ký điện tử khách hàng<span class="required-mark">*</span></label><canvas data-signature width="640" height="160" style="width:100%;height:160px;border:1px dashed var(--border-universal);border-radius:var(--radius-table);touch-action:none"></canvas><button type="button" class="btn btn--secondary btn--sm" data-clear-signature style="margin-top:8px;align-self:flex-start;">Xóa chữ ký</button></div>`}
        <div class="checkbox-row" style="padding-left:0"><input type="checkbox" id="customer-confirmed" data-customer-confirmed /><label for="customer-confirmed">Khách hàng xác nhận đã nhận lại thiết bị và phụ kiện.</label></div>
      </div><div class="card__footer"><button type="button" class="btn btn--primary" data-complete-handover ${settled ? "" : "disabled"}>${cancelled ? "Hoàn tất trả máy" : "Hoàn tất bàn giao"}</button></div></section>`;
    bindDetail();
  }

  function billingCard(billing) {
    return html`<section class="card"><div class="card__header"><h2 class="card__title">Chi phí sửa chữa</h2>${fmt.badgeOf(L.PAYMENT_STATUS, billing.paymentStatus)}</div><div class="card__body">
      <div class="billing-row"><span class="kv-key">Miễn phí trong bảo hành</span><span>${fmt.money(billing.freeWarrantyAmount)}</span></div>
      <div class="billing-row"><span class="kv-key">Phí linh kiện ngoài bảo hành</span><span>${fmt.money(billing.partsFee)}</span></div>
      <div class="billing-row"><span class="kv-key">Phí dịch vụ</span><span>${fmt.money(billing.serviceFee)}</span></div>
      <div class="billing-row"><span class="kv-key">VAT</span><span>${fmt.money(billing.vat)}</span></div>
      <div class="billing-row billing-row--discount"><span class="kv-key">Giảm trừ</span><span>${fmt.money(billing.discount)}</span></div>
      <div class="billing-total-row"><span class="kv-key">Tổng khách phải trả</span><span>${fmt.money(billing.total)}</span></div>
    </div></section>`;
  }

  function paymentCard(ticket, billing) {
    const free = Number(billing.total) === 0;
    return html`<section class="card"><div class="card__header"><h2 class="card__title">Thanh toán</h2></div><div class="card__body">
      ${free ? "" : html`<div class="form-field" style="max-width:260px"><label for="payment-method">Phương thức thanh toán</label><select id="payment-method" data-payment-method><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option><option value="E_WALLET">Ví điện tử</option><option value="CARD">Thẻ</option></select></div>`}
      <button type="button" class="btn btn--primary" data-confirm-payment>${free ? "Xác nhận miễn phí bảo hành" : "Xác nhận đã thanh toán"}</button>
    </div></section>`;
  }

  function rechecks() {
    const rows = [
      ["cosmeticMatches", "Ngoại quan khớp biên nhận"], ["bootsNormally", "Thiết bị khởi động bình thường"],
      ["mainFunctionsOk", "Chức năng chính hoạt động tốt"], ["accessoriesComplete", "Đủ phụ kiện"], ["noNewIssues", "Không phát sinh lỗi mới"],
    ];
    return html`<div class="form-field"><label>Kiểm tra lại thiết bị<span class="required-mark">*</span></label>${rows.map(([key, label]) => html`<div class="checkbox-row"><input type="checkbox" id="recheck-${key}" data-recheck="${key}" /><label for="recheck-${key}">${label}</label></div>`)}</div>`;
  }

  function bindDetail() {
    const payment = detail.querySelector("[data-confirm-payment]");
    if (payment) payment.addEventListener("click", () => collect(payment));
    const canvas = detail.querySelector("[data-signature]");
    if (canvas) bindCanvas(canvas);
    const clear = detail.querySelector("[data-clear-signature]");
    if (clear) clear.addEventListener("click", () => {
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      state.signed = false;
    });
    detail.querySelector("[data-complete-handover]").addEventListener("click", (event) => handOver(event.currentTarget));
  }

  async function collect(button) {
    const ticket = state.selected;
    const billing = state.billing;
    try {
      if (Number(billing.total) === 0) await ui.busy(button, () => api.tickets.confirmFree(ticket.code, null));
      else {
        const method = detail.querySelector("[data-payment-method]").value;
        await ui.busy(button, () => api.tickets.collect(ticket.code, { payerName: ticket.customer.fullName, method, note: null, expectedAmount: billing.total }));
      }
      window.showToast("Đã ghi nhận thanh toán.", "success");
      await selectTicket(ticket.code);
    } catch (error) {
      ui.showError(error);
    }
  }

  function bindCanvas(canvas) {
    const context = canvas.getContext("2d");
    context.strokeStyle = getComputedStyle(canvas).getPropertyValue("--text-strong").trim();
    context.lineWidth = 2;
    context.lineCap = "round";
    let drawing = false;
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ((event.clientX - rect.left) / rect.width) * canvas.width, y: ((event.clientY - rect.top) / rect.height) * canvas.height };
    };
    canvas.addEventListener("pointerdown", (event) => { drawing = true; const p = point(event); context.beginPath(); context.moveTo(p.x, p.y); canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener("pointermove", (event) => { if (!drawing) return; const p = point(event); context.lineTo(p.x, p.y); context.stroke(); state.signed = true; });
    canvas.addEventListener("pointerup", () => { drawing = false; });
  }

  function canvasBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  async function handOver(button) {
    const ticket = state.selected;
    const cancelled = ticket.status === "CANCELLED";
    const receiverName = detail.querySelector("[data-receiver-name]").value.trim();
    const conditionOnReturn = detail.querySelector("[data-return-condition]").value.trim();
    const customerConfirmed = detail.querySelector("[data-customer-confirmed]").checked;
    const checks = Object.fromEntries(Array.from(detail.querySelectorAll("[data-recheck]")).map((node) => [node.getAttribute("data-recheck"), node.checked]));
    if (!receiverName || !conditionOnReturn || !customerConfirmed || (!cancelled && (!state.signed || Object.values(checks).some((value) => !value)))) {
      window.showToast("Vui lòng hoàn tất thông tin, kiểm tra lại và chữ ký trước khi bàn giao.", "error");
      return;
    }
    const data = { receiverName, conditionOnReturn, returnedOldParts: false, newWarrantyNote: null, rating: null, recheck: cancelled ? null : checks, customerConfirmed };
    try {
      const signature = cancelled ? null : await canvasBlob(detail.querySelector("[data-signature]"));
      await ui.busy(button, () => api.tickets.handOver(ticket.code, data, signature));
      window.showToast(cancelled ? "Đã hoàn tất trả máy." : "Đã hoàn tất bàn giao.", "success");
      state.selected = null;
      await loadQueue();
      renderDetail();
    } catch (error) {
      ui.showError(error);
    }
  }

  window.LML_AUTH.ready(() => loadQueue());
}
