import { internalRoute } from "../navigation.ts";
/* ==========================================================================
   Phiên đăng nhập + điều hướng theo vai trò — CODEX mục 15.3, 9.7; UI mục 32
   - Tải trang: dùng ngay thông tin phiên đã lưu (LML_API.session) rồi hỏi lại GET /auth/me ở nền; quyền đổi thì
     tải lại trang. Chưa có thông tin lưu thì chờ /auth/me (access token hết hạn → tự refresh một lần).
   - Sidebar/nhóm nav lọc theo MÃ vai trò (data-roles="DISPATCHER,..."),
     nút hành động ẩn theo quyền (data-perm="QUOTE_REVIEW,..."). Backend vẫn là
     lớp chặn cuối cùng.
   - Trang chỉ hiện với tài khoản có một trong các vai trò ở <body data-roles>.
   - Script của từng trang khởi chạy qua LML_AUTH.ready(fn) sau khi có user.
   ========================================================================== */

export default function initialize() {

  const ACTIVE_ROLE_KEY = "lml_active_role";
  const IDLE_LIMIT_MS = 20 * 60 * 1000;
  const IDLE_WARN_BEFORE_MS = 60 * 1000;

  let currentUser = null;
  const readyCallbacks = [];


  function loginHref() { return "/login"; }

  /** Landing dạng gốc ("index.html", "pages/x.html") → đường dẫn đúng từ trang hiện tại. */
  function resolveLanding(landing) { return internalRoute(landing) || "/login"; }

  function roleCodes(user) {
    return (user.roles || []).map((r) => r.code);
  }

  function listAttr(element, name) {
    return (element.getAttribute(name) || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  function activeRoleFor(user, pageRoles) {
    let stored = null;
    try {
      stored = sessionStorage.getItem(ACTIVE_ROLE_KEY);
    } catch (e) {
      stored = null;
    }
    const codes = roleCodes(user);
    if (stored && codes.includes(stored) && (pageRoles.length === 0 || pageRoles.includes(stored))) return stored;
    return codes.find((c) => pageRoles.includes(c)) || codes[0];
  }

  function applyRoleNav(user) {
    const codes = roleCodes(user);
    const pageRoles = listAttr(document.body, "data-roles");
    if (pageRoles.length > 0 && !pageRoles.some((r) => codes.includes(r))) {
      // Khu khách: tài khoản nhân viên được mời đăng nhập bằng tài khoản khách thay vì bị đưa về màn nội bộ.
      if (pageRoles.length === 1 && pageRoles[0] === "CUSTOMER") window.LML_API.redirectToLogin();
      else window.location.replace(resolveLanding(user.landing || "index.html"));
      return false;
    }

    document.querySelectorAll(".sidebar-nav__item[data-roles], .sidebar-nav__group[data-roles]").forEach((node) => {
      node.hidden = !listAttr(node, "data-roles").some((r) => codes.includes(r));
    });
    document.querySelectorAll(".sidebar-nav__group").forEach((group) => {
      if (group.hidden) return;
      const items = group.querySelectorAll(".sidebar-nav__item");
      group.hidden = items.length > 0 && Array.from(items).every((item) => item.hidden);
    });

    const permissions = new Set(user.permissions || []);
    if (!permissions.has("TICKET_READ_ALL")) {
      document.querySelectorAll('.sidebar-nav__item[href="/tickets"]').forEach((link) => {
        const label = Array.from(link.childNodes).reverse().find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (label) label.textContent = " Lịch sử phiếu";
      });
    }
    document.querySelectorAll("[data-perm]").forEach((node) => {
      node.hidden = !listAttr(node, "data-perm").some((p) => permissions.has(p));
    });

    const nameEl = document.querySelector(".header-user__name");
    const roleEl = document.querySelector(".header-user__role");
    if (nameEl) nameEl.textContent = user.displayName || user.username;
    if (roleEl) {
      const active = activeRoleFor(user, pageRoles);
      const role = (user.roles || []).find((r) => r.code === active);
      roleEl.textContent = role ? role.label : "";
    }
    return true;
  }

  function hasUnsavedChanges() {
    return document.body.getAttribute("data-has-unsaved") === "1";
  }

  async function doLogout() {
    try {
      await window.LML_API.auth.logout(false);
    } catch (e) {
      /* Dù máy chủ không phản hồi vẫn xóa phiên phía trình duyệt. */
    }
    window.LML_API.tokens.clear();
    try {
      sessionStorage.removeItem(ACTIVE_ROLE_KEY);
    } catch (e) {
      /* bỏ qua */
    }
    window.location.href = loginHref();
  }

  /** Nhân viên tự đổi mật khẩu từ header (POST /auth/change-password); phiên hiện tại nhận token mới, phiên khác bị thu hồi. */
  function openChangePassword() {
    const api = window.LML_API;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "lml-change-password-title");
    overlay.innerHTML = window.html`
      <form class="modal" data-change-password-dialog novalidate>
        <div class="modal__header"><div>
          <div class="modal__title" id="lml-change-password-title">Đổi mật khẩu</div>
          <div class="modal__subtitle">Các thiết bị khác đang đăng nhập bằng tài khoản này sẽ bị đăng xuất.</div>
        </div></div>
        <div class="modal__body stack">
          <div class="auth-card__error" data-change-password-error role="alert" hidden></div>
          <div class="form-field">
            <label for="lml-current-password">Mật khẩu hiện tại<span class="required-mark">*</span></label>
            <input type="password" id="lml-current-password" autocomplete="current-password" data-current-password />
          </div>
          <div class="form-field">
            <label for="lml-new-password">Mật khẩu mới<span class="required-mark">*</span></label>
            <input type="password" id="lml-new-password" autocomplete="new-password" aria-describedby="lml-new-password-help" data-new-password />
            <span class="form-field__helper" id="lml-new-password-help">Ít nhất 10 ký tự, có cả chữ và số, không chứa tên đăng nhập, không dùng mật khẩu phổ biến.</span>
          </div>
          <div class="form-field">
            <label for="lml-confirm-password">Nhập lại mật khẩu mới<span class="required-mark">*</span></label>
            <input type="password" id="lml-confirm-password" autocomplete="new-password" data-confirm-password />
          </div>
        </div>
        <div class="modal__footer">
          <button type="button" class="btn btn--secondary" data-change-password-cancel>Hủy</button>
          <button type="submit" class="btn btn--primary">Đổi mật khẩu</button>
        </div>
      </form>`;
    document.body.appendChild(overlay);
    window.openDialog(overlay);
    const form = overlay.querySelector("[data-change-password-dialog]");
    const errorBox = overlay.querySelector("[data-change-password-error]");
    const field = (name) => overlay.querySelector(`[data-${name}]`);
    const close = () => {
      window.closeDialog(overlay);
      overlay.remove();
    };
    const fail = (message, focus) => {
      errorBox.textContent = message;
      errorBox.hidden = false;
      if (focus) focus.focus();
    };
    field("current-password").focus();
    overlay.querySelector("[data-change-password-cancel]").addEventListener("click", close);
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorBox.hidden = true;
      const current = field("current-password").value;
      const next = field("new-password").value;
      if (!current) return fail("Vui lòng nhập mật khẩu hiện tại.", field("current-password"));
      if (!next) return fail("Vui lòng nhập mật khẩu mới.", field("new-password"));
      if (next !== field("confirm-password").value) return fail("Mật khẩu nhập lại không khớp.", field("confirm-password"));
      if (next === current) return fail("Mật khẩu mới phải khác mật khẩu hiện tại.", field("new-password"));
      try {
        const result = await window.LML_UI.busy(form.querySelector('button[type="submit"]'), () =>
          api.auth.changePassword(current, next));
        api.tokens.set(result.accessToken);
        api.session.remember(result.user);
        close();
        window.showToast("Đã đổi mật khẩu.", "success");
      } catch (error) {
        fail(error.detail);
      }
    });
  }

  function initChangePassword() {
    const logout = document.querySelector("[data-logout-btn]");
    if (!logout || document.querySelector("[data-change-password-btn]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button";
    button.setAttribute("data-change-password-btn", "");
    button.setAttribute("aria-label", "Đổi mật khẩu");
    button.title = "Đổi mật khẩu";
    button.innerHTML = window.html`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="12" r="3.5"/><path d="M9.5 9.5L16 3M13.5 5.5L15.5 7.5M11.5 7.5l1.5 1.5"/></svg>`;
    button.addEventListener("click", openChangePassword);
    logout.before(button);
  }

  function initLogout() {
    const btn = document.querySelector("[data-logout-btn]");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      if (hasUnsavedChanges()) {
        const ok = await window.LML_UI.confirm({
          title: "Đăng xuất khỏi hệ thống?",
          message: "Dữ liệu đang nhập ở form hiện tại chưa được lưu và sẽ bị mất.",
          confirmLabel: "Đăng xuất",
        });
        if (!ok) return;
      }
      doLogout();
    });
  }

  function initIdleTimeout() {
    let warnTimer = null;
    let logoutTimer = null;

    function reset() {
      clearTimeout(warnTimer);
      clearTimeout(logoutTimer);
      warnTimer = setTimeout(() => {
        window.showToast(
          "Phiên làm việc sắp hết hạn do không hoạt động. Hãy thao tác để tiếp tục đăng nhập.",
          "error"
        );
      }, IDLE_LIMIT_MS - IDLE_WARN_BEFORE_MS);
      logoutTimer = setTimeout(doLogout, IDLE_LIMIT_MS);
    }

    ["click", "keydown", "mousemove", "scroll"].forEach((evt) => {
      document.addEventListener(evt, reset, { passive: true });
    });
    reset();
  }

  async function loadUser() {
    const api = window.LML_API;
    if (!api.tokens.get()) {
      try {
        await api.refresh();
      } catch (e) {
        api.redirectToLogin();
        return null;
      }
    }
    try {
      return await api.auth.me();
    } catch (e) {
      if (e.status !== 401) {
        window.showToast(e.detail, "error");
        return null;
      }
    }
    // Access token lưu trong sessionStorage đã hết hạn (15 phút): làm mới bằng cookie refresh rồi hỏi lại một lần.
    try {
      await api.refresh();
      return await api.auth.me();
    } catch (e) {
      api.redirectToLogin();
      return null;
    }
  }

  /** Những gì quyết định nav và quyền trên trang; khác nhau thì thông tin đã lưu không còn đúng. */
  function fingerprint(user) {
    return JSON.stringify([
      user.accountId,
      user.displayName,
      roleCodes(user),
      user.permissions || [],
      Boolean(user.mustChangePassword),
    ]);
  }

  /** Áp dụng phiên cho trang; false nếu đã chuyển đi nơi khác (đổi mật khẩu, sai vai trò). */
  function enter(user) {
    if (user.mustChangePassword) {
      window.LML_API.redirectToLogin("&change=1");
      return false;
    }
    if (!applyRoleNav(user)) return false;
    document.body.removeAttribute("aria-busy");
    currentUser = user;
    initChangePassword();
    initLogout();
    initIdleTimeout();
    readyCallbacks.splice(0).forEach((fn) => fn(user));
    return true;
  }

  window.LML_AUTH = {
    user: () => currentUser,
    hasPermission: (permission) => Boolean(currentUser && (currentUser.permissions || []).includes(permission)),
    hasRole: (role) => Boolean(currentUser && roleCodes(currentUser).includes(role)),
    /** Chạy fn(user) sau khi phiên hợp lệ và nav đã áp dụng. */
    ready(fn) {
      if (currentUser) fn(currentUser);
      else readyCallbacks.push(fn);
    },
    logout: doLogout,
  };

  return async () => {
    document.body.setAttribute("aria-busy", "true");
    const api = window.LML_API;
    const cached = api.tokens.get() ? api.session.user() : null;
    const user = cached || (await loadUser());
    if (!user || !enter(user)) return;
    if (!cached) return;
    const fresh = await loadUser();
    if (fresh && fingerprint(fresh) !== fingerprint(cached)) window.location.reload();
  };
}
