import { internalRoute } from "../navigation.ts";
/* ==========================================================================
   Hành vi chung của shell: hộp thoại, tìm kiếm toàn cục, thông báo, toast
   Nguồn: UI mục 8, 9, 26; CODEX mục 15.4 (shell.js → /search, /notifications,
   /catalog/stations)
   ========================================================================== */

export default function initialize() {

  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function getFocusable(container) {
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => el.offsetParent !== null);
  }

  function trapTabKey(overlayEl, e) {
    if (e.key !== "Tab") return;
    const items = getFocusable(overlayEl);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Ngăn xếp hộp thoại đang mở — modal xác nhận có thể mở chồng lên drawer.
  const openDialogStack = [];

  /** Mở modal/drawer: nhớ phần tử kích hoạt, focus phần tử đầu, giữ Tab trong hộp thoại. */
  window.openDialog = function openDialog(overlayEl) {
    overlayEl._trigger = document.activeElement;
    overlayEl.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
    openDialogStack.push(overlayEl);
    const focusables = getFocusable(overlayEl);
    (focusables[0] || overlayEl).focus();
    overlayEl._trapHandler = (e) => trapTabKey(overlayEl, e);
    overlayEl.addEventListener("keydown", overlayEl._trapHandler);
  };

  /** Đóng modal/drawer và trả focus về phần tử đã mở nó. */
  window.closeDialog = function closeDialog(overlayEl) {
    overlayEl.setAttribute("hidden", "");
    const stackIndex = openDialogStack.indexOf(overlayEl);
    if (stackIndex !== -1) openDialogStack.splice(stackIndex, 1);
    if (openDialogStack.length === 0) document.body.style.overflow = "";
    if (overlayEl._trapHandler) {
      overlayEl.removeEventListener("keydown", overlayEl._trapHandler);
      overlayEl._trapHandler = null;
    }
    if (overlayEl._trigger && typeof overlayEl._trigger.focus === "function") overlayEl._trigger.focus();
    overlayEl._trigger = null;
  };

  function pageHref(rootRelative) { return internalRoute(rootRelative) || "/login"; }

  function relativeTime(iso) {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (minutes < 1) return "Vừa xong";
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    return window.LML_FMT.dateTime(iso);
  }

  /* ---------------------------------------------------------------------- */
  /* Chuông thông báo                                                        */
  /* ---------------------------------------------------------------------- */

  function initNotificationBell() {
    const bell = document.querySelector("[data-notification-bell]");
    const popover = document.querySelector("[data-notification-popover]");
    if (!bell || !popover || !window.LML_AUTH) return;
    const dot = bell.querySelector(".icon-button__dot");
    const { html } = window;

    function setUnread(count) {
      if (dot) dot.hidden = count === 0;
      bell.setAttribute("aria-label", count > 0 ? `Thông báo (${count} chưa đọc)` : "Thông báo");
    }

    async function load() {
      popover.innerHTML = html`<div class="header-search__group-label">Thông báo</div><div class="header-search__empty">Đang tải…</div>`;
      try {
        const inbox = await window.LML_API.notifications.inbox(false);
        setUnread(inbox.unreadCount);
        const items = inbox.items.slice(0, 8);
        popover.innerHTML = html`
          <div class="header-search__group-label" style="display:flex; justify-content:space-between; align-items:center;">
            <span>Thông báo${inbox.unreadCount ? html` (${inbox.unreadCount} chưa đọc)` : ""}</span>
            ${inbox.unreadCount ? html`<button type="button" class="link" data-read-all style="background:none; border:none; cursor:pointer;">Đánh dấu đã đọc tất cả</button>` : ""}
          </div>
          ${items.length === 0
            ? html`<div class="header-search__empty">Chưa có thông báo nào.</div>`
            : items.map(
                (item) => html`
                  <button type="button" class="header-search__result" data-notification="${item.id}" data-link="${item.link || ""}"
                          style="width:100%; text-align:left; border:none; background:transparent;${item.read ? "" : " font-weight:600;"}">
                    <span class="header-search__result-title">${item.message}</span>
                    <span class="header-search__result-meta">${relativeTime(item.createdAt)}${item.read ? "" : " · Chưa đọc"}</span>
                  </button>`
              )}`;
        const readAll = popover.querySelector("[data-read-all]");
        if (readAll) {
          readAll.addEventListener("click", async (e) => {
            e.stopPropagation();
            await window.LML_API.notifications.readAll();
            load();
          });
        }
        popover.querySelectorAll("[data-notification]").forEach((node) => {
          node.addEventListener("click", async () => {
            try {
              await window.LML_API.notifications.read(node.getAttribute("data-notification"));
            } catch (e) {
              /* đánh dấu đã đọc thất bại không chặn điều hướng */
            }
            const link = node.getAttribute("data-link");
            if (link) window.location.href = pageHref(link);
            else load();
          });
        });
      } catch (error) {
        popover.innerHTML = html`<div class="header-search__group-label">Thông báo</div><div class="header-search__empty">${error.detail}</div>`;
      }
    }

    function close() {
      popover.setAttribute("hidden", "");
      bell.setAttribute("aria-expanded", "false");
    }

    bell.addEventListener("click", (e) => {
      e.stopPropagation();
      if (popover.hasAttribute("hidden")) {
        popover.removeAttribute("hidden");
        bell.setAttribute("aria-expanded", "true");
        load();
      } else {
        close();
      }
    });
    document.addEventListener("click", (e) => {
      if (!popover.contains(e.target) && e.target !== bell) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    window.LML_AUTH.ready(async () => {
      try {
        const inbox = await window.LML_API.notifications.inbox(true);
        setUnread(inbox.unreadCount);
      } catch (e) {
        setUnread(0);
      }
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Tìm kiếm toàn cục                                                       */
  /* ---------------------------------------------------------------------- */

  function ticketTarget(code) {
    const auth = window.LML_AUTH;
    if (auth.hasPermission("TICKET_ASSIGN")) return pageHref(`index.html?ticket=${encodeURIComponent(code)}`);
    if (auth.hasPermission("TICKET_READ_ASSIGNED")) return pageHref(`pages/technician.html?ticket=${encodeURIComponent(code)}`);
    if (auth.hasPermission("PAYMENT_COLLECT")) return pageHref(`pages/cashier.html?ticket=${encodeURIComponent(code)}`);
    return pageHref(`pages/tickets.html?q=${encodeURIComponent(code)}`);
  }

  function initGlobalSearch() {
    const input = document.querySelector("[data-global-search]");
    const results = document.querySelector("[data-global-search-results]");
    if (!input || !results || !window.LML_AUTH) return;
    const { html } = window;
    const { TICKET_STATUS, WARRANTY_REQUEST_STATUS, QUOTE_APPROVAL, STOCK_ISSUE_STATUS } = window.LML_LABELS;
    let timer = null;
    let sequence = 0;

    const GROUPS = [
      { key: "tickets", label: "Phiếu sửa chữa", statuses: TICKET_STATUS, target: (hit) => ticketTarget(hit.code) },
      {
        key: "warrantyRequests",
        label: "Yêu cầu bảo hành trực tuyến",
        statuses: WARRANTY_REQUEST_STATUS,
        target: (hit) => pageHref(`pages/receptionist.html?request=${encodeURIComponent(hit.code)}`),
      },
      {
        key: "quotations",
        label: "Báo giá sửa chữa",
        statuses: QUOTE_APPROVAL,
        target: (hit) => pageHref(`index.html?ticket=${encodeURIComponent(hit.summary)}`),
      },
      {
        key: "stockIssues",
        label: "Phiếu xuất kho",
        statuses: STOCK_ISSUE_STATUS,
        target: () => pageHref("pages/warehouse.html#stockout"),
      },
    ];

    function hide() {
      results.setAttribute("hidden", "");
    }

    async function run(query) {
      const q = query.trim();
      const current = ++sequence;
      if (q.length < 2) {
        hide();
        results.innerHTML = "";
        return;
      }
      results.innerHTML = html`<div class="header-search__empty">Đang tìm…</div>`;
      results.removeAttribute("hidden");
      try {
        const data = await window.LML_API.search(q);
        if (current !== sequence) return;
        const groups = GROUPS.filter((g) => (data[g.key] || []).length > 0);
        results.innerHTML =
          groups.length === 0
            ? html`<div class="header-search__empty">Không tìm thấy kết quả phù hợp.</div>`
            : html`${groups.map(
                (group) => html`
                  <div class="header-search__group-label">${group.label}</div>
                  ${data[group.key].map(
                    (hit, index) => html`
                      <button type="button" class="header-search__result" data-group="${group.key}" data-index="${index}"
                              style="width:100%; text-align:left; border:none; background:transparent;">
                        <span class="header-search__result-title mono">${hit.code}</span>
                        <span class="header-search__result-meta">${(group.statuses[hit.status] || {}).label || hit.status} — ${hit.summary}</span>
                      </button>`
                  )}`
              )}`;
        results.querySelectorAll("[data-group]").forEach((node) => {
          node.addEventListener("click", () => {
            const group = GROUPS.find((g) => g.key === node.getAttribute("data-group"));
            const hit = data[group.key][Number(node.getAttribute("data-index"))];
            hide();
            window.location.href = group.target(hit);
          });
        });
      } catch (error) {
        if (current === sequence) results.innerHTML = html`<div class="header-search__empty">${error.detail}</div>`;
      }
    }

    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => run(input.value), 250);
    });
    input.addEventListener("focus", () => {
      if (input.value.trim().length >= 2) run(input.value);
    });
    document.addEventListener("click", (e) => {
      if (!results.contains(e.target) && e.target !== input) hide();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hide();
        input.blur();
      }
    });
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  /** Badge trạm dịch vụ ở header lấy từ danh mục trạm (mục 9). */
  function initStationBadge() {
    const badge = document.querySelector(".app-header > .status-badge");
    if (!badge || !window.LML_AUTH) return;
    window.LML_AUTH.ready(async () => {
      try {
        const stations = await window.LML_API.catalog.list("stations");
        const station = stations.find((s) => s.active) || stations[0];
        if (!station) return;
        badge.innerHTML = window.html`<span class="status-badge__dot">●</span>${station.name} đang hoạt động`;
      } catch (e) {
        /* Không có quyền đọc danh mục (vd portal) — giữ nguyên nhãn mặc định. */
      }
    });
  }

  /**
   * Chuyển màn theo mục nav cho các trang gộp nhiều section (Kho, Báo cáo,
   * Quản trị...): mỗi mục nav chỉ hiện đúng một [data-page-panel].
   */
  function initPagePanels() {
    const panels = document.querySelectorAll("[data-page-panel]");
    const links = document.querySelectorAll(".sidebar-nav__item[data-page-tab]");
    if (panels.length === 0 || links.length === 0) return;
    const panelIds = Array.from(panels).map((p) => p.getAttribute("data-page-panel"));

    function showPanel(id) {
      if (!panelIds.includes(id)) id = panelIds[0];
      panels.forEach((p) => {
        p.hidden = p.getAttribute("data-page-panel") !== id;
      });
      links.forEach((l) => l.classList.toggle("is-active", l.getAttribute("data-page-tab") === id));
      window.scrollTo(0, 0);
      document.dispatchEvent(new CustomEvent("lml:panel-shown", { detail: id }));
    }

    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const id = link.getAttribute("data-page-tab");
        history.replaceState(null, "", `#${id}`);
        showPanel(id);
      });
    });
    // Link cùng trang (vd. từ chuông thông báo) chỉ đổi hash, không tải lại trang.
    window.addEventListener("hashchange", () => showPanel((location.hash || "").slice(1)));
    showPanel((location.hash || "").slice(1));
  }

  function initDisabledNavLinks() {
    document.querySelectorAll('.sidebar-nav__item[href="#"]').forEach((link) => {
      link.classList.add("is-disabled");
      link.setAttribute("aria-disabled", "true");
      link.title = "Màn hình này chưa có trong hệ thống hiện tại.";
      link.addEventListener("click", (e) => {
        e.preventDefault();
        window.showToast("Màn hình này chưa có trong hệ thống hiện tại.", "error");
      });
    });
  }

  function initToast() {
    let stack = document.querySelector("[data-toast-stack]");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.setAttribute("data-toast-stack", "");
      stack.setAttribute("role", "status");
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }

    window.showToast = function showToast(message, type = "success") {
      const toast = document.createElement("div");
      toast.className = `toast toast--${type}`;
      const icon =
        type === "error"
          ? window.html`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="8"/><path d="M10 6v5M10 14h.01"/></svg>`
          : window.html`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="8"/><path d="M6.5 10.5l2.5 2.5 4.5-5.5"/></svg>`;
      toast.innerHTML = window.html`${icon}<span>${message}</span>`;
      stack.appendChild(toast);
      setTimeout(() => {
        toast.style.transition = "opacity 0.2s ease";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 220);
      }, 4200);
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Khung trên điện thoại/tablet (D-046)                                    */
  /* ---------------------------------------------------------------------- */

  /** Dưới 1024px sidebar thành ngăn kéo: nút menu trên header, nền mờ, Esc/chạm ngoài để đóng. */
  function initResponsiveShell() {
    const sidebar = document.querySelector(".app-sidebar");
    const header = document.querySelector(".app-header");
    const main = document.querySelector(".app-main");
    if (!sidebar || !header || !main) return;

    if (!main.id) main.id = "main-content";
    main.tabIndex = -1;
    const skip = document.createElement("a");
    skip.className = "skip-link";
    skip.href = `#${main.id}`;
    skip.textContent = "Bỏ qua tới nội dung chính";
    document.body.prepend(skip);

    sidebar.id = sidebar.id || "app-sidebar";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "icon-button app-menu-toggle";
    toggle.setAttribute("aria-controls", sidebar.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Mở menu điều hướng");
    toggle.innerHTML = window.html`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14"/></svg>`;
    header.prepend(toggle);

    const backdrop = document.createElement("div");
    backdrop.className = "app-sidebar-backdrop";
    backdrop.hidden = true;
    sidebar.after(backdrop);

    const compact = window.matchMedia("(max-width: 1023px)");

    function setOpen(open, { restoreFocus = false } = {}) {
      document.body.classList.toggle("is-nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Đóng menu điều hướng" : "Mở menu điều hướng");
      backdrop.hidden = !open;
      sidebar.inert = compact.matches && !open;
      main.inert = open;
      document.body.style.overflow = open ? "hidden" : "";
      if (open) {
        const first = sidebar.querySelector(".sidebar-nav__item.is-active:not([hidden])") || sidebar.querySelector(".sidebar-nav__item:not([hidden])");
        if (first) first.focus();
      } else if (restoreFocus) {
        toggle.focus();
      }
    }

    toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("is-nav-open")));
    backdrop.addEventListener("click", () => setOpen(false, { restoreFocus: true }));
    sidebar.addEventListener("click", (e) => {
      if (compact.matches && e.target.closest(".sidebar-nav__item")) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("is-nav-open")) setOpen(false, { restoreFocus: true });
    });
    compact.addEventListener("change", () => setOpen(false));
    setOpen(false);
  }

  /**
   * Bảng dữ liệu trên điện thoại hiển thị thành thẻ: mỗi ô mang nhãn cột (data-label) lấy từ thead.
   * Hàng do controller vẽ lại liên tục nên gắn nhãn mỗi khi tbody đổi.
   */
  function initTableLabels() {
    document.querySelectorAll("table.data-table").forEach((table) => {
      const labels = Array.from(table.querySelectorAll("thead th")).map((th) => {
        const copy = th.cloneNode(true);
        copy.querySelectorAll(".sort-caret").forEach((caret) => caret.remove());
        return copy.textContent.trim();
      });
      const label = () => {
        table.querySelectorAll("tbody tr").forEach((row) => {
          let column = 0;
          Array.from(row.cells).forEach((cell) => {
            const span = cell.colSpan || 1;
            if (span === 1 && labels[column]) cell.setAttribute("data-label", labels[column]);
            else cell.removeAttribute("data-label");
            column += span;
          });
        });
      };
      label();
      new MutationObserver(label).observe(table, { childList: true, subtree: true });
    });
  }

  // Toast phải sẵn sàng trước mọi script khác (kể cả khi auth lỗi sớm).
  initToast();

  return () => {
    initResponsiveShell();
    initTableLabels();
    initNotificationBell();
    initGlobalSearch();
    initStationBadge();
    initDisabledNavLinks();
    initPagePanels();
  };
}
