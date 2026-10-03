/* ==========================================================================
   Trạng thái giao diện dùng chung — CODEX mục 15.2 (ui-errors), UI mục 13, 27
   - Bảng: skeleton đang tải / rỗng / rỗng theo bộ lọc / lỗi API + "Thử lại".
   - Lỗi API: fieldErrors hiện ngay cạnh trường, còn lại hiện toast.
   - Nút đang gửi: khóa + spinner cho tới khi request xong (thay simulateLoading).
   - Hộp xác nhận cho thao tác không hoàn tác được (mục 27).
   ========================================================================== */

export default function initialize() {

  const ICON_TABLE = window.html`<svg class="table-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 10h16"/></svg>`;
  const ICON_ERROR = window.html`<svg class="table-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>`;

  function skeletonRows(tbody, columns, rows = 5) {
    const cells = Array.from({ length: columns }, (_, i) =>
      window.html`<td><div class="skeleton-bar" style="width:${40 + ((i * 17) % 45)}%"></div></td>`
    );
    tbody.innerHTML = Array.from({ length: rows }, () => window.html`<tr class="table-skeleton-row">${cells}</tr>`)
      .join("");
  }

  /**
   * Ghi một hàng trạng thái vào tbody.
   * kind: "empty" | "filtered" | "error"; onRetry chỉ dùng cho "error".
   */
  function tableState(tbody, columns, kind, texts = {}, onRetry) {
    const isError = kind === "error";
    const title =
      texts.title ||
      (isError
        ? "Không thể tải dữ liệu"
        : kind === "filtered"
          ? "Không tìm thấy kết quả phù hợp"
          : "Chưa có dữ liệu");
    const desc =
      texts.desc ||
      (isError
        ? "Đã xảy ra lỗi khi kết nối máy chủ. Vui lòng thử lại."
        : kind === "filtered"
          ? "Hãy thử điều chỉnh bộ lọc hoặc từ khoá tìm kiếm."
          : "");
    tbody.innerHTML = window.html`
      <tr><td colspan="${columns}">
        <div class="table-state ${isError ? "table-state--error" : ""}">
          ${isError ? ICON_ERROR : ICON_TABLE}
          <div class="table-state__title">${title}</div>
          ${desc ? window.html`<div class="table-state__desc">${desc}</div>` : ""}
          ${isError && onRetry
            ? window.html`<div class="table-state__action"><button type="button" class="btn btn--secondary" data-retry-load>Thử lại</button></div>`
            : ""}
        </div>
      </td></tr>`;
    const retry = tbody.querySelector("[data-retry-load]");
    if (retry && onRetry) retry.addEventListener("click", onRetry);
  }

  /** Khối trạng thái cho vùng không phải bảng (danh sách, panel). */
  function blockState(container, kind, texts = {}, onRetry) {
    const isError = kind === "error";
    container.innerHTML = window.html`
      <div class="${isError ? "table-state table-state--error" : "empty-selection-hint"}">
        ${isError ? window.html`${ICON_ERROR}<div class="table-state__title">${texts.title || "Không thể tải dữ liệu"}</div>` : ""}
        <div class="${isError ? "table-state__desc" : ""}">${texts.desc || (kind === "loading" ? "Đang tải…" : "")}</div>
        ${isError && onRetry
          ? window.html`<div class="table-state__action"><button type="button" class="btn btn--secondary" data-retry-load>Thử lại</button></div>`
          : ""}
      </div>`;
    const retry = container.querySelector("[data-retry-load]");
    if (retry && onRetry) retry.addEventListener("click", onRetry);
  }

  function clearFieldErrors(form) {
    if (!form) return;
    form.querySelectorAll(".form-field.has-error").forEach((field) => field.classList.remove("has-error"));
    form.querySelectorAll("[data-api-field-error]").forEach((node) => node.remove());
  }

  /** Hiện lỗi API: lỗi theo trường nằm cạnh trường tương ứng (name hoặc data-field), còn lại là toast. */
  function showError(error, form) {
    clearFieldErrors(form);
    let placed = 0;
    if (form && error && Array.isArray(error.fieldErrors)) {
      error.fieldErrors.forEach((fieldError) => {
        const key = String(fieldError.field || "");
        const leaf = key.split(".").pop();
        const input =
          form.querySelector(`[data-field="${CSS.escape(key)}"]`) ||
          form.querySelector(`[name="${CSS.escape(key)}"]`) ||
          form.querySelector(`[name="${CSS.escape(leaf)}"]`);
        const wrapper = input && input.closest(".form-field");
        if (!wrapper) return;
        wrapper.classList.add("has-error");
        const note = document.createElement("span");
        note.className = "form-field__error";
        note.setAttribute("data-api-field-error", "");
        note.textContent = fieldError.message || "Giá trị không hợp lệ.";
        wrapper.appendChild(note);
        placed++;
      });
    }
    if (placed === 0 || (error && error.code !== "VALIDATION_FAILED")) {
      window.showToast((error && error.detail) || "Đã xảy ra lỗi hệ thống. Vui lòng thử lại.", "error");
    }
  }

  /** Chạy thao tác ghi: khóa nút + spinner đến khi xong; lỗi được hiển thị và ném tiếp cho nơi gọi. */
  async function busy(button, action) {
    if (button && button.disabled) return undefined;
    if (button) {
      button.disabled = true;
      button.classList.add("btn--loading");
    }
    try {
      return await action();
    } finally {
      if (button) {
        button.classList.remove("btn--loading");
        button.disabled = false;
      }
    }
  }

  /** Hộp xác nhận mục 27: không dùng OK/Cancel chung chung. Trả về Promise<boolean>. */
  function confirm({ title, message, confirmLabel, cancelLabel = "Hủy", destructive = true }) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.innerHTML = window.html`
        <div class="modal modal--critical">
          <div class="modal__header"><div>
            <div class="modal__title">${title}</div>
            ${message ? window.html`<div class="modal__subtitle">${message}</div>` : ""}
          </div></div>
          <div class="modal__footer">
            <button type="button" class="btn btn--secondary" data-confirm-cancel>${cancelLabel}</button>
            <button type="button" class="btn ${destructive ? "btn--destructive" : "btn--primary"}" data-confirm-ok>${confirmLabel}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      window.openDialog(overlay);
      const done = (value) => {
        window.closeDialog(overlay);
        overlay.remove();
        resolve(value);
      };
      overlay.querySelector("[data-confirm-cancel]").addEventListener("click", () => done(false));
      overlay.querySelector("[data-confirm-ok]").addEventListener("click", () => done(true));
      overlay.addEventListener("keydown", (e) => {
        if (e.key === "Escape") done(false);
      });
    });
  }

  /**
   * Hộp nhập lý do bắt buộc (từ chối/hủy) — mục 27. Trả về Promise<string|null> (null = đã hủy).
   */
  function promptReason({ title, message, label = "Lý do", confirmLabel, placeholder = "" }) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.innerHTML = window.html`
        <div class="modal modal--critical">
          <div class="modal__header"><div>
            <div class="modal__title">${title}</div>
            ${message ? window.html`<div class="modal__subtitle">${message}</div>` : ""}
          </div></div>
          <div class="modal__body">
            <div class="form-field" data-reason-field>
              <label for="lml-reason-input">${label}<span class="required-mark">*</span></label>
              <textarea id="lml-reason-input" data-reason-input placeholder="${placeholder}"></textarea>
              <span class="form-field__error" data-reason-error hidden>Vui lòng nhập lý do.</span>
            </div>
          </div>
          <div class="modal__footer">
            <button type="button" class="btn btn--secondary" data-confirm-cancel>Hủy</button>
            <button type="button" class="btn btn--destructive" data-confirm-ok>${confirmLabel}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      window.openDialog(overlay);
      const input = overlay.querySelector("[data-reason-input]");
      input.focus();
      const done = (value) => {
        window.closeDialog(overlay);
        overlay.remove();
        resolve(value);
      };
      overlay.querySelector("[data-confirm-cancel]").addEventListener("click", () => done(null));
      overlay.querySelector("[data-confirm-ok]").addEventListener("click", () => {
        const value = input.value.trim();
        if (!value) {
          overlay.querySelector("[data-reason-field]").classList.add("has-error");
          overlay.querySelector("[data-reason-error]").hidden = false;
          input.focus();
          return;
        }
        done(value);
      });
      overlay.addEventListener("keydown", (e) => {
        if (e.key === "Escape") done(null);
      });
    });
  }

  /** Hiện mật khẩu tạm đúng một lần (backend không lưu bản rõ) kèm nút sao chép; đóng là mất. */
  function showTemporaryPassword({ title, message, password }) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.innerHTML = window.html`
        <div class="modal">
          <div class="modal__header"><div>
            <div class="modal__title">${title}</div>
            ${message ? window.html`<div class="modal__subtitle">${message}</div>` : ""}
          </div></div>
          <div class="modal__body">
            <div class="temp-password" aria-label="Mật khẩu tạm"><span class="mono" data-temp-password>${password}</span></div>
            <p class="cell-muted" style="margin:10px 0 0">Mật khẩu này chỉ hiện một lần. Khách phải đổi mật khẩu mới ngay khi đăng nhập.</p>
          </div>
          <div class="modal__footer">
            <button type="button" class="btn btn--secondary" data-copy-password>Sao chép</button>
            <button type="button" class="btn btn--primary" data-confirm-ok>Đã báo cho khách</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      window.openDialog(overlay);
      const done = () => {
        window.closeDialog(overlay);
        overlay.remove();
        resolve();
      };
      const copy = overlay.querySelector("[data-copy-password]");
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(password);
          copy.textContent = "Đã sao chép";
        } catch {
          window.getSelection().selectAllChildren(overlay.querySelector("[data-temp-password]"));
        }
      });
      overlay.querySelector("[data-confirm-ok]").addEventListener("click", done);
      overlay.addEventListener("keydown", (e) => {
        if (e.key === "Escape") done();
      });
    });
  }

  /** In một khối nội dung: sao chép ra vùng .print-area cấp body (CSS in chỉ hiện vùng này). */
  function printElement(element) {
    const area = document.createElement("div");
    area.className = "print-area";
    area.appendChild(element.cloneNode(true));
    document.body.appendChild(area);
    window.print();
    area.remove();
  }

  /** Cuộn tới khối mới hiện: mượt khi được phép, nhảy thẳng khi người dùng chọn giảm chuyển động. */
  function scrollBehavior() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }

  /** Option cho <select> từ danh sách [{value,label}] — giữ option đầu tiên (placeholder). */
  function fillSelect(select, options, keepFirst = true) {
    const first = keepFirst && select.options.length > 0 ? select.options[0].outerHTML : "";
    select.innerHTML =
      first + options.map((o) => window.html`<option value="${o.value}">${o.label}</option>`).join("");
  }

  /** Bố cục danh sách + chi tiết xếp chồng dưới 1024px: chọn phiếu thì cuộn tới phần chi tiết. */
  function revealDetail(element) {
    if (!element || !window.matchMedia("(max-width: 1023px)").matches) return;
    element.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  }

  window.LML_UI = {
    skeletonRows,
    tableState,
    blockState,
    showError,
    clearFieldErrors,
    busy,
    confirm,
    promptReason,
    showTemporaryPassword,
    printElement,
    fillSelect,
    scrollBehavior,
    revealDetail,
  };
}
