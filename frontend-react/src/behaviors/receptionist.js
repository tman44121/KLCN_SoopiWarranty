/* ==========================================================================
   View: Tiếp nhận & Lễ tân — UI mục 18, 20, 34, 35; CODEX mục 11.3–11.7, 15.4
   API: GET /customers?q=, GET /catalog/device-categories|products|brands,
        GET /devices/lookup, GET|POST /warranty-requests*, POST /tickets,
        GET /tickets/{c}/receipt, POST /quotations/{c}/customer-decision
   ========================================================================== */

export default function initialize() {

  const api = window.LML_API;
  const ui = window.LML_UI;
  const fmt = window.LML_FMT;
  const L = window.LML_LABELS;
  const { html } = window;
  const $ = (selector) => document.querySelector(selector);

  function markDirty() {
    document.body.setAttribute("data-has-unsaved", "1");
  }

  /**
   * Nhóm nút chọn thay cho <select>: cùng .value / .disabled và sự kiện đổi lựa chọn, nên logic biểu mẫu giữ nguyên.
   * Gán .value một giá trị không có trong danh sách thì coi như chưa chọn, giống <select>.
   */
  function choiceGroup(container, emptyText) {
    let options = [];
    let value = "";
    let disabled = false;
    const listeners = [];
    function render() {
      if (options.length === 0) {
        container.innerHTML = html`<span class="choice-group__empty">${typeof emptyText === "function" ? emptyText() : emptyText}</span>`;
        return;
      }
      // Mẫu radio ARIA: cả nhóm là một điểm dừng Tab (nút đang chọn, hoặc nút đầu khi chưa chọn); mũi tên đổi lựa chọn.
      const tabbable = options.some((o) => o.value === value) ? value : options[0].value;
      container.innerHTML = html`${options.map((o) => html`<button type="button" class="choice-group__btn${o.value === value ? " is-active" : ""}" role="radio" aria-checked="${o.value === value ? "true" : "false"}" tabindex="${o.value === tabbable ? "0" : "-1"}" data-value="${o.value}"${disabled ? html` disabled` : ""}>${o.label}</button>`)}`;
    }
    function choose(next) {
      value = next;
      render();
      // Vẽ lại làm mất nút đang focus: đưa focus về lựa chọn mới để bàn phím đi tiếp được.
      const active = Array.from(container.querySelectorAll("[data-value]")).find((b) => b.getAttribute("data-value") === next);
      if (active) active.focus();
      if (container.closest("[data-intake-form]")) markDirty();
      listeners.forEach((listener) => listener());
    }
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-value]");
      if (!button || disabled) return;
      choose(button.getAttribute("data-value"));
    });
    container.addEventListener("keydown", (event) => {
      const steps = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (disabled || options.length === 0 || !(event.key in steps || event.key === "Home" || event.key === "End")) return;
      event.preventDefault();
      const current = Math.max(0, options.findIndex((o) => o.value === event.target.getAttribute("data-value")));
      const index = event.key === "Home" ? 0
        : event.key === "End" ? options.length - 1
        : (current + steps[event.key] + options.length) % options.length;
      choose(options[index].value);
    });
    render();
    return {
      get value() {
        return value;
      },
      set value(next) {
        value = options.some((o) => o.value === next) ? next : "";
        render();
      },
      get disabled() {
        return disabled;
      },
      set disabled(next) {
        disabled = Boolean(next);
        render();
      },
      setOptions(next) {
        options = next;
        if (!options.some((o) => o.value === value)) value = "";
        render();
      },
      onChange(listener) {
        listeners.push(listener);
      },
    };
  }

  /** Hãng/Model: danh sách dài nên có ô gõ để lọc (khớp mọi từ đã gõ); lựa chọn hiện tại luôn được giữ lại. */
  function productPicker(search, list) {
    const MAX_SHOWN = 12;
    let all = [];
    const group = choiceGroup(list, () =>
      all.length === 0 ? "Chọn nhóm và loại thiết bị để hiện hãng/model" : "Không có hãng/model khớp từ khóa"
    );
    function refresh() {
      const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const selected = all.find((o) => o.value === group.value);
      const matches = all.filter((o) => words.every((word) => o.label.toLowerCase().includes(word))).slice(0, MAX_SHOWN);
      if (selected && !matches.includes(selected)) matches.unshift(selected);
      const current = group.value;
      group.setOptions(matches);
      group.value = current;
    }
    search.addEventListener("input", refresh);
    return {
      get value() {
        return group.value;
      },
      set value(next) {
        group.setOptions(all);
        group.value = next;
        refresh();
      },
      get disabled() {
        return group.disabled;
      },
      set disabled(next) {
        group.disabled = next;
        search.disabled = Boolean(next);
      },
      setOptions(next) {
        all = next;
        search.value = "";
        group.setOptions([]);
        refresh();
      },
      /** Gợi ý sẵn từ khóa (vd. hãng/model khách tự khai) để lễ tân chỉ việc bấm chọn. */
      filter(text) {
        search.value = text || "";
        refresh();
      },
    };
  }

  const state = {
    categories: [],
    products: [],
    brands: {},
    customerCode: null,
    device: null,
    warrantyRequestCode: null,
    counterQuotation: null,
  };

  const el = {
    form: $("[data-intake-form]"),
    phone: $("#phone"),
    name: $("#customerName"),
    email: $("#email"),
    address: $("#address"),
    customerHint: $("[data-customer-hint]"),
    category: choiceGroup($("[data-device-category]"), "Đang tải danh mục…"),
    deviceType: choiceGroup($("[data-device-type]"), "Chọn nhóm thiết bị trước"),
    product: productPicker($("[data-product-search]"), $("[data-product-choices]")),
    ycBrandModel: $("[data-yc-brand-model]"),
    identifier: $("#identifier"),
    identifierLabel: $("[data-identifier-label]"),
    channel: choiceGroup($("[data-channel]"), "—"),
    requestType: choiceGroup($("[data-request-type]"), "—"),
    sla: choiceGroup($("[data-sla-level]"), "—"),
    customerLookup: $("[data-customer-lookup]"),
    promised: $("#promisedReturnAt"),
    estimatedCost: $("#estimatedCost"),
    seal: $("#sealCondition"),
    warrantyHint: $("[data-warranty-hint]"),
    warrantyBadge: $("[data-warranty-badge]"),
    warrantyResult: $("[data-warranty-result]"),
    newDeviceFields: $("[data-new-device-fields]"),
    activatedAt: $("#activatedAt"),
    expiresAt: $("#expiresAt"),
    distributor: $("#distributor"),
    symptom: $("#symptom"),
    accessoriesNote: $("#accessoriesNote"),
    cosmeticNotes: $("#cosmeticNotes"),
    ack: $("#ack"),
    ackError: $("[data-ack-error]"),
    submit: $("[data-submit-intake]"),
    reset: $("[data-reset-form]"),
    resultSection: $("[data-result-section]"),
    createdId: $("[data-created-ticket-id]"),
    receipt: $("[data-receipt-preview]"),
    ycStatus: choiceGroup($("[data-yc-status]"), "—"),
    ycList: $("[data-yc-list]"),
    ycCode: $("[data-yc-code]"),
    ycBanner: $("[data-yc-banner]"),
    ycBannerCode: $("[data-yc-banner-code]"),
    counterTicket: $("[data-counter-ticket]"),
    counterBody: $("[data-counter-body]"),
  };

  function normalizePhone(value) {
    let digits = String(value || "").replace(/[^0-9+]/g, "");
    if (digits.startsWith("+84")) digits = "0" + digits.slice(3);
    return digits.replace(/\+/g, "");
  }

  /**
   * Tiếp nhận từ yêu cầu khách tự gửi (YC-): thông tin khách khai chỉ đọc. Lễ tân vẫn chọn hãng/model đúng danh mục
   * (khách chỉ gõ tự do) và làm phần tại quầy: ngoại quan, loại yêu cầu, SLA, hẹn trả, chi phí.
   */
  function applyLocks() {
    const fromRequest = Boolean(state.warrantyRequestCode);
    [el.phone, el.identifier, el.symptom].forEach((input) => {
      input.readOnly = fromRequest;
    });
    [el.name, el.email, el.address].forEach((input) => {
      input.readOnly = fromRequest || Boolean(state.customerCode);
    });
    el.customerLookup.disabled = fromRequest;
    el.channel.disabled = fromRequest;
    el.category.disabled = fromRequest || Boolean(state.device);
    el.deviceType.disabled = fromRequest || Boolean(state.device);
    el.product.disabled = Boolean(state.device);
  }

  /* ---------------------------------------------------------------------- */
  /* Danh mục thiết bị (mục 18B–C): nhóm → loại → hãng/model                */
  /* ---------------------------------------------------------------------- */

  function selectedDeviceType() {
    const category = state.categories.find((c) => c._id === el.category.value);
    return category ? (category.deviceTypes || []).find((t) => t.code === el.deviceType.value) : null;
  }

  function onCategoryChange() {
    const category = state.categories.find((c) => c._id === el.category.value);
    el.deviceType.setOptions((category ? category.deviceTypes : []).map((t) => ({ value: t.code, label: t.name })));
    el.deviceType.value = "";
    onDeviceTypeChange();
  }

  function onDeviceTypeChange() {
    const type = selectedDeviceType();
    const products = state.products.filter(
      (p) => p.active !== false && p.categoryCode === el.category.value && (!type || p.deviceTypeCode === type.code)
    );
    el.product.setOptions(products.map((p) => ({ value: p._id, label: `${state.brands[p.brandId] || p.brandId} — ${p.name}` })));
    el.product.value = "";
    const isImei = type && type.identifierType === "IMEI";
    el.identifierLabel.innerHTML = html`${isImei ? "IMEI" : "Serial Number"}<span class="required-mark">*</span>`;
    el.identifier.placeholder = isImei ? "Nhập 15 số IMEI" : "Nhập số Serial";
  }

  function selectProduct(productId) {
    const product = state.products.find((p) => p._id === productId);
    if (!product) return;
    el.category.value = product.categoryCode;
    onCategoryChange();
    el.deviceType.value = product.deviceTypeCode;
    onDeviceTypeChange();
    el.product.value = product._id;
  }

  /* ---------------------------------------------------------------------- */
  /* Khách hàng                                                              */
  /* ---------------------------------------------------------------------- */

  function setCustomer(customer) {
    state.customerCode = customer ? customer.code : null;
    applyLocks();
    if (customer) {
      el.name.value = customer.fullName || "";
      el.email.value = customer.email || "";
      el.address.value = customer.address || "";
      el.customerHint.innerHTML = html`Khách hàng đã có hồ sơ: <span class="mono">${customer.code}</span> — ${customer.fullName}`;
    } else {
      el.customerHint.textContent = "Khách hàng mới — hồ sơ sẽ được tạo khi tiếp nhận thiết bị.";
    }
  }

  async function lookupCustomer(button) {
    const phone = normalizePhone(el.phone.value);
    if (phone.length < 9) {
      ui.showError({ code: "VALIDATION_FAILED", fieldErrors: [{ field: "customer.newCustomer.phone", message: "Vui lòng nhập số điện thoại hợp lệ." }] }, el.form);
      return;
    }
    try {
      const page = await ui.busy(button, () => api.customers.search(phone, 0, 25));
      const match = page.items.find((c) => normalizePhone(c.phone) === phone && c.status === "ACTIVE");
      setCustomer(match || null);
    } catch (error) {
      ui.showError(error, el.form);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Tra cứu thiết bị & xác nhận bảo hành (mục 18D, R1)                      */
  /* ---------------------------------------------------------------------- */

  function renderWarranty(device) {
    const w = device.warranty || {};
    el.warrantyBadge.innerHTML = html`${fmt.badgeOf(L.WARRANTY_STATUS, w.status)}`;
    el.warrantyResult.hidden = false;
    el.newDeviceFields.hidden = true;
    const kv = (label, value, wide) =>
      html`<div class="detail-grid__item${wide ? " detail-grid__item--wide" : ""}"><span class="kv-key">${label}</span><span>${value}</span></div>`;
    el.warrantyResult.innerHTML = html`
      ${kv("Thiết bị đã đăng ký", html`<span class="mono">${device.code}</span> — ${device.product.brandName} ${device.product.name}`)}
      ${kv("Tình trạng bảo hành", fmt.badgeOf(L.WARRANTY_STATUS, w.status))}
      ${kv("Ngày kích hoạt", fmt.date(device.warrantyActivatedOn))}
      ${kv("Ngày hết hạn", fmt.date(device.warrantyExpiresOn))}
      ${kv("Nhà phân phối", w.distributor || device.distributor || "—")}
      ${kv("Phiếu trước đây", String((device.tickets || []).length))}
      ${kv("Điều kiện bảo hành", w.conditions || "—", true)}
      ${kv("Trường hợp từ chối bảo hành", w.rejectionCases || "—", true)}`;
    el.warrantyHint.textContent = "Kết quả tra cứu theo Serial/IMEI — lễ tân ghi nhận, kỹ thuật viên sẽ phân loại lại khi chẩn đoán.";
  }

  function clearWarranty() {
    state.device = null;
    el.warrantyBadge.innerHTML = "";
    el.warrantyResult.hidden = true;
    el.newDeviceFields.hidden = false;
    applyLocks();
  }

  async function checkWarranty(button) {
    const serial = el.identifier.value.trim();
    if (!serial) {
      ui.showError({ code: "VALIDATION_FAILED", fieldErrors: [{ field: "device.newDevice.serialOrImei", message: "Vui lòng nhập Serial Number." }] }, el.form);
      return;
    }
    try {
      const device = await ui.busy(button, () => api.devices.lookup(serial));
      state.device = device;
      selectProduct(device.productId);
      applyLocks();
      renderWarranty(device);
      // Từ yêu cầu khách gửi: không tự đổi sang khách khác; nếu máy thuộc người khác, server sẽ từ chối khi tiếp nhận.
      if (!state.warrantyRequestCode && device.customerCode && device.customerCode !== state.customerCode) {
        try {
          const owner = await api.customers.get(device.customerCode);
          el.phone.value = owner.phone || el.phone.value;
          setCustomer(owner);
        } catch (e) {
          /* Không đọc được hồ sơ chủ máy — lễ tân vẫn nhập tay. */
        }
      }
    } catch (error) {
      if (error.code === "DEVICE_NOT_FOUND") {
        clearWarranty();
        el.warrantyHint.textContent = "Thiết bị chưa đăng ký trong hệ thống — sẽ được đăng ký mới khi tiếp nhận.";
        el.warrantyBadge.innerHTML = html`${fmt.badge("neutral", "Thiết bị mới")}`;
      } else {
        ui.showError(error, el.form);
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Tạo phiếu tiếp nhận (T1)                                                */
  /* ---------------------------------------------------------------------- */

  function cosmeticValue(key) {
    const active = document.querySelector(`[data-cosmetic="${key}"] .is-active`);
    return active ? active.getAttribute("data-value") : null;
  }

  function validate() {
    const errors = [];
    const need = (condition, field, message) => {
      if (!condition) errors.push({ field, message });
    };
    need(normalizePhone(el.phone.value).length >= 9, "customer.newCustomer.phone", "Vui lòng nhập số điện thoại.");
    if (!state.customerCode) need(el.name.value.trim(), "customer.newCustomer.fullName", "Vui lòng nhập họ tên khách hàng.");
    if (!state.device) {
      need(el.category.value, "category", "Vui lòng chọn nhóm thiết bị.");
      need(el.deviceType.value, "deviceType", "Vui lòng chọn loại thiết bị.");
      need(el.product.value, "device.newDevice.productId", "Vui lòng chọn hãng/model.");
    }
    need(el.identifier.value.trim(), "device.newDevice.serialOrImei", "Vui lòng nhập Serial Number.");
    need(el.symptom.value.trim(), "reportedIssue", "Vui lòng nhập mô tả lỗi của khách hàng.");
    el.ackError.hidden = el.ack.checked;
    return { errors, ok: errors.length === 0 && el.ack.checked };
  }

  function requestBody() {
    const type = selectedDeviceType();
    return {
      customer: state.customerCode
        ? { code: state.customerCode }
        : {
            newCustomer: {
              fullName: el.name.value.trim(),
              phone: el.phone.value.trim(),
              email: el.email.value.trim() || null,
              address: el.address.value.trim() || null,
            },
          },
      device: state.device
        ? { code: state.device.code }
        : {
            newDevice: {
              productId: el.product.value,
              identifierType: type ? type.identifierType : "SERIAL",
              serialOrImei: el.identifier.value.trim(),
              warrantyActivatedOn: el.activatedAt.value || null,
              warrantyExpiresOn: el.expiresAt.value || null,
              distributor: el.distributor.value.trim() || null,
            },
          },
      warrantyRequestCode: state.warrantyRequestCode,
      channel: el.channel.value,
      requestType: el.requestType.value,
      sealCondition: el.seal.value.trim() || null,
      cosmetic: {
        scratches: cosmeticValue("scratches"),
        dents: cosmeticValue("dents") === "true",
        cracks: cosmeticValue("cracks") === "true",
        moisture: cosmeticValue("moisture"),
        accessories: cosmeticValue("accessories"),
        accessoriesNote: el.accessoriesNote.value.trim() || null,
        notes: el.cosmeticNotes.value.trim() || null,
        customerAcknowledged: el.ack.checked,
      },
      reportedIssue: el.symptom.value.trim(),
      promisedReturnAt: el.promised.value ? new Date(el.promised.value).toISOString() : null,
      estimatedCost: el.estimatedCost.value ? Number(el.estimatedCost.value) : null,
      slaLevel: el.sla.value,
    };
  }

  function cosmeticSummary(c) {
    const parts = [`Trầy: ${L.SCRATCHES[c.scratches]}`, `Móp: ${c.dents ? "Có" : "Không"}`, `Nứt/vỡ: ${c.cracks ? "Có" : "Không"}`,
      `Ẩm nước: ${L.MOISTURE[c.moisture]}`, `Phụ kiện: ${L.ACCESSORIES[c.accessories]}${c.accessoriesNote ? ` (${c.accessoriesNote})` : ""}`];
    return parts.join(" · ");
  }

  function renderReceipt(t) {
    const set = (attr, value) => {
      el.receipt.querySelector(`[${attr}]`).textContent = value;
    };
    set("data-r-id", t.code);
    set("data-r-received", fmt.dateTime(t.receivedAt));
    set("data-r-customer", t.customer ? `${t.customer.fullName} — ${t.customer.phone}` : "—");
    set("data-r-device", `${t.device.deviceTypeName} — ${t.device.brandName} ${t.device.productName}`);
    set("data-r-id-label", t.device.identifierType === "IMEI" ? "IMEI" : "Serial Number");
    set("data-r-serial", t.device.serialOrImei);
    set("data-r-warranty", (L.WARRANTY_STATUS[t.warrantyAtIntake && t.warrantyAtIntake.status] || {}).label || "—");
    set("data-r-cosmetic", cosmeticSummary(t.cosmetic));
    set("data-r-symptom", t.reportedIssue);
    set("data-r-expected", t.promisedReturnAt ? fmt.dateTime(t.promisedReturnAt) : `Theo SLA — trước ${fmt.dateTime(t.sla.dueAt)}`);
  }

  async function submit() {
    const { errors, ok } = validate();
    ui.clearFieldErrors(el.form);
    if (errors.length) ui.showError({ code: "VALIDATION_FAILED", fieldErrors: errors }, el.form);
    if (!ok) {
      window.showToast("Vui lòng kiểm tra lại các trường còn thiếu hoặc chưa hợp lệ.", "error");
      return;
    }
    try {
      const created = await ui.busy(el.submit, () => api.tickets.receive(requestBody()));
      document.body.removeAttribute("data-has-unsaved");
      el.createdId.textContent = created.code;
      renderReceipt(created);
      el.resultSection.hidden = false;
      el.resultSection.scrollIntoView({ behavior: ui.scrollBehavior(), block: "start" });
      window.showToast(`Tạo phiếu thành công — Mã phiếu: ${created.code}`, "success");
      if (state.warrantyRequestCode) {
        clearWarrantyRequest();
        loadWarrantyRequests();
      }
    } catch (error) {
      ui.showError(error, el.form);
    }
  }

  function applyDefaults() {
    el.channel.value = "COUNTER";
    el.requestType.value = "WARRANTY";
    el.sla.value = "STANDARD_48H";
  }

  function resetForm() {
    el.form.querySelectorAll("input[type=text], input[type=number], input[type=date], input[type=datetime-local], textarea").forEach((input) => {
      input.value = "";
      input.readOnly = false;
    });
    el.ack.checked = false;
    el.ackError.hidden = true;
    document.querySelectorAll("[data-cosmetic]").forEach((group) => {
      group.querySelectorAll(".result-toggle__btn").forEach((btn, i) => btn.classList.toggle("is-active", i === 0));
    });
    el.category.value = "";
    onCategoryChange();
    applyDefaults();
    setCustomer(null);
    el.customerHint.textContent = "Nhập số điện thoại để tra cứu khách hàng đã có hồ sơ";
    clearWarranty();
    el.warrantyHint.textContent = "Nhập Serial/IMEI rồi bấm “Kiểm tra bảo hành” để tra thiết bị đã đăng ký";
    clearWarrantyRequest();
    el.resultSection.hidden = true;
    ui.clearFieldErrors(el.form);
    document.body.removeAttribute("data-has-unsaved");
  }

  /* ---------------------------------------------------------------------- */
  /* Yêu cầu bảo hành trực tuyến (YC-) — tự điền & hủy                       */
  /* ---------------------------------------------------------------------- */

  const EMPTY_REQUESTS = {
    PENDING_INTAKE: "Không có yêu cầu bảo hành trực tuyến nào đang chờ tiếp nhận.",
    CONVERTED: "Chưa có yêu cầu nào được tiếp nhận thành phiếu.",
    CANCELLED: "Không có yêu cầu nào bị hủy.",
  };

  function requestOutcome(r) {
    if (r.status === "CONVERTED" && r.convertedTicketId) {
      return html` · Đã thành phiếu <span class="mono">${r.convertedTicketId}</span>`;
    }
    if (r.status === "CANCELLED" && r.cancelReason) return html` · Lý do hủy: ${r.cancelReason}`;
    return "";
  }

  let requestsLoad = 0;

  async function loadWarrantyRequests() {
    if (!window.LML_AUTH.hasPermission("WARRANTY_REQUEST_HANDLE")) return;
    const status = el.ycStatus.value || "PENDING_INTAKE";
    // Đổi tab khi lượt tải trước chưa xong: chỉ lượt mới nhất được vẽ, tránh danh sách cũ đè lên tab đang xem.
    const load = ++requestsLoad;
    ui.blockState(el.ycList, "loading");
    try {
      const requests = await api.warrantyRequests.list(status);
      if (load !== requestsLoad) return;
      if (requests.length === 0) {
        ui.blockState(el.ycList, "empty", { desc: EMPTY_REQUESTS[status] });
        return;
      }
      el.ycList.innerHTML = html`${requests.map((r) => html`
        <div class="request-row">
          <div class="request-row__main">
            <span class="request-row__title mono">${r._id}</span>
            <span class="request-row__meta">${r.customer.fullName} · ${r.customer.phone} · ${r.brandModel} · <span class="mono">${r.serialOrImei}</span> · Gửi lúc ${fmt.dateTime(r.createdAt)}${requestOutcome(r)}</span>
          </div>
          <div class="request-row__right">
            ${fmt.badgeOf(L.WARRANTY_REQUEST_STATUS, r.status)}
            ${r.status === "PENDING_INTAKE"
              ? html`<button type="button" class="btn btn--primary btn--sm" data-yc-use="${r._id}">Tiếp nhận</button>
                <button type="button" class="btn btn--secondary btn--sm" data-yc-cancel="${r._id}">Hủy yêu cầu</button>`
              : ""}
          </div>
        </div>`)}`;
      el.ycList.querySelectorAll("[data-yc-use]").forEach((btn) =>
        btn.addEventListener("click", () => applyWarrantyRequest(btn.getAttribute("data-yc-use")))
      );
      el.ycList.querySelectorAll("[data-yc-cancel]").forEach((btn) =>
        btn.addEventListener("click", () => cancelWarrantyRequest(btn.getAttribute("data-yc-cancel")))
      );
    } catch (error) {
      if (load !== requestsLoad) return;
      ui.blockState(el.ycList, "error", { desc: error.detail }, loadWarrantyRequests);
    }
  }

  async function cancelWarrantyRequest(code) {
    const reason = await ui.promptReason({
      title: "Hủy yêu cầu bảo hành trực tuyến?",
      message: `Yêu cầu ${code} sẽ chuyển sang trạng thái Đã hủy.`,
      label: "Lý do hủy",
      confirmLabel: "Hủy yêu cầu",
    });
    if (!reason) return;
    try {
      await api.warrantyRequests.cancel(code, reason);
      window.showToast(`Đã hủy yêu cầu ${code}.`, "success");
      loadWarrantyRequests();
    } catch (error) {
      ui.showError(error);
    }
  }

  function clearWarrantyRequest() {
    state.warrantyRequestCode = null;
    el.ycBanner.hidden = true;
    el.ycBrandModel.hidden = true;
    applyLocks();
  }

  async function applyWarrantyRequest(code) {
    if (!code) return;
    try {
      const r = await api.warrantyRequests.get(code.trim().toUpperCase());
      if (r.status !== "PENDING_INTAKE") {
        window.showToast(`Yêu cầu ${r._id} đã được xử lý (${L.WARRANTY_REQUEST_STATUS[r.status].label}).`, "error");
        return;
      }
      resetForm();
      state.warrantyRequestCode = r._id;
      el.ycBanner.hidden = false;
      el.ycBannerCode.textContent = r._id;
      el.phone.value = r.customer.phone || "";
      el.name.value = r.customer.fullName || "";
      el.email.value = r.customer.email || "";
      el.address.value = r.customer.address || "";
      el.category.value = r.categoryCode;
      onCategoryChange();
      el.deviceType.value = r.deviceTypeCode;
      onDeviceTypeChange();
      el.ycBrandModel.hidden = false;
      el.ycBrandModel.textContent = `Khách khai: ${r.brandModel}. Chọn đúng hãng/model trong danh mục.`;
      el.product.filter(r.brandModel);
      el.identifier.value = r.serialOrImei;
      el.symptom.value = r.symptom;
      el.channel.value = "ONLINE_REQUEST";
      applyLocks();
      markDirty();
      el.form.scrollIntoView({ behavior: ui.scrollBehavior(), block: "start" });
      await lookupCustomer(null);
      await checkWarranty(null);
      window.showToast(`Đã tự điền thông tin từ yêu cầu ${r._id}.`, "success");
    } catch (error) {
      ui.showError(error);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Khách xác nhận báo giá tại quầy (T7, channel COUNTER)                   */
  /* ---------------------------------------------------------------------- */

  async function loadCounterQuotation(button) {
    const code = el.counterTicket.value.trim().toUpperCase();
    if (!code) return;
    state.counterQuotation = null;
    try {
      const ticket = await ui.busy(button, () => api.tickets.get(code));
      if (ticket.status !== "AWAITING_CUSTOMER_CONFIRMATION" || !ticket.activeQuotationCode) {
        el.counterBody.innerHTML = html`<div class="empty-selection-hint">Phiếu <span class="mono">${ticket.code}</span> hiện ở trạng thái “${L.TICKET_STATUS[ticket.status].label}” — không có báo giá chờ khách xác nhận.</div>`;
        return;
      }
      const q = await api.quotations.get(ticket.activeQuotationCode);
      state.counterQuotation = q;
      el.counterBody.innerHTML = html`
        <div class="detail-grid" style="margin-bottom:12px;">
          <div class="detail-grid__item"><span class="kv-key">Báo giá</span><span class="mono">${q.code}</span></div>
          <div class="detail-grid__item"><span class="kv-key">Khách hàng</span><span>${ticket.customer ? ticket.customer.fullName : "—"}</span></div>
          <div class="detail-grid__item"><span class="kv-key">Thiết bị</span><span>${ticket.device.productName}</span></div>
          <div class="detail-grid__item"><span class="kv-key">Hiệu lực đến</span><span>${fmt.date(q.validUntil)}</span></div>
        </div>
        <div class="table-scroll">
          <table class="drawer-table">
            <thead><tr><th>Nội dung</th><th>SL</th><th>Đơn giá</th><th>Tiền công</th><th>Thành tiền</th></tr></thead>
            <tbody>${q.lines.map((line) => html`<tr><td>${line.description}</td><td>${line.quantity}</td><td>${fmt.money(line.unitPrice)}</td><td>${fmt.money(line.laborFee)}</td><td>${fmt.money(line.lineTotal)}</td></tr>`)}</tbody>
          </table>
        </div>
        <div class="billing-row"><span>Tổng linh kiện</span><span>${fmt.money(q.partsTotal)}</span></div>
        <div class="billing-row"><span>Tiền công</span><span>${fmt.money(q.laborTotal)}</span></div>
        <div class="billing-total-row"><span>Tổng thanh toán (gồm VAT ${Number(q.vatRate)}%)</span><span>${fmt.money(q.grandTotal)}</span></div>
        <div class="checkbox-row" style="padding:12px 0 0;">
          <input type="checkbox" id="counter-agree" data-counter-agree />
          <label for="counter-agree">Khách hàng đã đồng ý báo giá</label>
        </div>
        <div class="action-bar" style="margin-top:12px;">
          <button type="button" class="btn btn--destructive" data-counter-decline>Khách từ chối báo giá</button>
          <button type="button" class="btn btn--primary" data-counter-accept disabled>Xác nhận báo giá</button>
        </div>`;
      const agree = el.counterBody.querySelector("[data-counter-agree]");
      const accept = el.counterBody.querySelector("[data-counter-accept]");
      agree.addEventListener("change", () => {
        accept.disabled = !agree.checked;
      });
      accept.addEventListener("click", () => decideAtCounter("ACCEPT", accept));
      el.counterBody.querySelector("[data-counter-decline]").addEventListener("click", (e) => decideAtCounter("DECLINE", e.currentTarget));
    } catch (error) {
      el.counterBody.innerHTML = html`<div class="empty-selection-hint">${error.detail}</div>`;
    }
  }

  async function decideAtCounter(decision, button) {
    const q = state.counterQuotation;
    if (!q) return;
    let reason = null;
    if (decision === "DECLINE") {
      reason = await ui.promptReason({
        title: "Khách từ chối báo giá?",
        message: `Phiếu ${q.ticketCode} sẽ chuyển sang “Ngừng sửa theo yêu cầu khách” và chờ trả máy.`,
        label: "Lý do khách từ chối",
        confirmLabel: "Ghi nhận khách từ chối",
      });
      if (!reason) return;
    }
    try {
      await ui.busy(button, () => api.quotations.decideAtCounter(q.code, decision, reason));
      window.showToast(
        decision === "ACCEPT" ? `Đã ghi nhận khách đồng ý báo giá ${q.code}.` : `Đã ghi nhận khách từ chối báo giá ${q.code}.`,
        "success"
      );
      el.counterBody.innerHTML = html`<div class="empty-selection-hint">Đã cập nhật phiếu <span class="mono">${q.ticketCode}</span>.</div>`;
      state.counterQuotation = null;
    } catch (error) {
      ui.showError(error);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Khởi tạo                                                               */
  /* ---------------------------------------------------------------------- */

  async function loadCatalog() {
    try {
      const [categories, products, brands] = await Promise.all([
        api.catalog.list("device-categories"),
        api.catalog.list("products"),
        api.catalog.list("brands"),
      ]);
      state.categories = categories.filter((c) => c.active !== false).sort((a, b) => a.sortOrder - b.sortOrder);
      state.products = products;
      state.brands = Object.fromEntries(brands.map((b) => [b._id, b.name]));
      el.category.setOptions(state.categories.map((c) => ({ value: c._id, label: c.name })));
    } catch (error) {
      ui.showError(error);
    }
  }

  function bindEvents() {
    el.category.onChange(onCategoryChange);
    el.deviceType.onChange(onDeviceTypeChange);
    el.ycStatus.onChange(loadWarrantyRequests);
    el.phone.addEventListener("input", () => {
      if (state.customerCode) setCustomer(null);
    });
    el.identifier.addEventListener("input", () => {
      if (state.device) clearWarranty();
    });
    el.customerLookup.addEventListener("click", (e) => lookupCustomer(e.currentTarget));
    $("[data-warranty-check]").addEventListener("click", (e) => checkWarranty(e.currentTarget));
    el.submit.addEventListener("click", submit);
    el.reset.addEventListener("click", resetForm);
    $("[data-print-receipt]").addEventListener("click", () => ui.printElement(el.receipt));
    $("[data-yc-load]").addEventListener("click", () => applyWarrantyRequest(el.ycCode.value));
    $("[data-yc-clear]").addEventListener("click", clearWarrantyRequest);
    $("[data-counter-load]").addEventListener("click", (e) => loadCounterQuotation(e.currentTarget));

    document.querySelectorAll("[data-cosmetic]").forEach((group) => {
      group.querySelectorAll(".result-toggle__btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          group.querySelectorAll(".result-toggle__btn").forEach((b) => b.classList.remove("is-active"));
          btn.classList.add("is-active");
          markDirty();
        });
      });
    });
    el.form.addEventListener("input", markDirty);
    el.ack.addEventListener("change", () => {
      el.ackError.hidden = el.ack.checked;
    });
  }

  window.LML_AUTH.ready(async () => {
    el.channel.setOptions(Object.entries(L.CHANNEL).map(([value, label]) => ({ value, label })));
    el.requestType.setOptions(Object.entries(L.REQUEST_TYPE).map(([value, label]) => ({ value, label })));
    el.sla.setOptions(["STANDARD_48H", "PRIORITY_24H", "EXPRESS_12H"].map((value) => ({ value, label: L.SLA_LEVEL[value] })));
    el.ycStatus.setOptions(Object.entries(L.WARRANTY_REQUEST_STATUS).map(([value, status]) => ({ value, label: status.label })));
    el.ycStatus.value = "PENDING_INTAKE";
    applyDefaults();
    bindEvents();
    await loadCatalog();
    loadWarrantyRequests();
    const request = new URLSearchParams(location.search).get("request");
    if (request) applyWarrantyRequest(request);
  });
}
