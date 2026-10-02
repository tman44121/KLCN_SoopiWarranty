import { internalRoute } from "../navigation.ts";
/* ==========================================================================
   Màn hình đăng nhập — CODEX mục 9.2, 9.3, 15.3; UI mục 32
   - POST /auth/login; lỗi hiện dưới form đúng câu thông báo của máy chủ.
   - Tài khoản nhiều vai trò → "Bắt đầu với vai trò nào?".
   - mustChangePassword → form đổi mật khẩu trước khi vào hệ thống.
   ========================================================================== */

export default function initialize() {

  const ACTIVE_ROLE_KEY = "lml_active_role";
  const api = window.LML_API;

  const form = document.querySelector("[data-login-form]");
  const errorBox = document.querySelector("[data-login-error]");
  const choiceList = document.querySelector("[data-role-choice-list]");
  const changeForm = document.querySelector("[data-change-password-form]");
  const changeError = document.querySelector("[data-change-password-error]");
  const params = new URLSearchParams(location.search);

  function show(box, message) {
    box.textContent = message;
    box.hidden = false;
  }

  /** Chỉ cho phép quay lại trang nội bộ cùng origin (chống open redirect); trang không đúng vai trò
   * sẽ được auth.js chuyển về landing của tài khoản. */
  function safeNext() {
    const next = internalRoute(params.get("next"));
    return next && !next.startsWith("/login") ? next : null;
  }

  function enter(role) {
    try {
      sessionStorage.setItem(ACTIVE_ROLE_KEY, role.code);
    } catch (e) {
      /* bỏ qua */
    }
    window.location.href = safeNext() || internalRoute(role.landing) || "/login";
  }

  function offerRoleChoice(user) {
    form.hidden = true;
    changeForm.hidden = true;
    choiceList.hidden = false;
    choiceList.querySelectorAll(".role-choice").forEach((node) => node.remove());
    user.roles.forEach((role) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "role-choice";
      btn.textContent = role.label;
      btn.addEventListener("click", () => enter(role));
      choiceList.appendChild(btn);
    });
  }

  function proceed(user) {
    if (user.mustChangePassword) {
      form.hidden = true;
      choiceList.hidden = true;
      changeForm.hidden = false;
      document.getElementById("current-password").focus();
      return;
    }
    if (user.roles.length > 1) offerRoleChoice(user);
    else enter(user.roles[0]);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    const remember = document.getElementById("login-remember").checked;
    if (!username || !password) {
      show(errorBox, "Vui lòng nhập tên đăng nhập và mật khẩu.");
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    try {
      const result = await window.LML_UI.busy(button, () => api.auth.login(username, password, remember));
      api.tokens.set(result.accessToken);
      proceed(result.user);
    } catch (error) {
      show(errorBox, error.detail);
    }
  });

  changeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    changeError.hidden = true;
    const current = document.getElementById("current-password").value;
    const next = document.getElementById("new-password").value;
    const confirm = document.getElementById("confirm-password").value;
    if (!current || !next) {
      show(changeError, "Vui lòng nhập đủ mật khẩu hiện tại và mật khẩu mới.");
      return;
    }
    if (next !== confirm) {
      show(changeError, "Mật khẩu nhập lại không khớp.");
      return;
    }
    const button = changeForm.querySelector('button[type="submit"]');
    try {
      await window.LML_UI.busy(button, () => api.auth.changePassword(current, next));
      // Đổi mật khẩu tăng securityVersion: token cũ bị thu hồi → lấy token mới qua cookie refresh.
      await api.refresh();
      proceed(await api.auth.me());
    } catch (error) {
      show(changeError, error.detail);
    }
  });

  /** Đến từ trang nội bộ với yêu cầu đổi mật khẩu, hoặc đã có phiên còn hạn. */
  (async function resume() {
    if (!api.tokens.get() && params.get("change") !== "1") return;
    try {
      if (!api.tokens.get()) await api.refresh();
      proceed(await api.auth.me());
    } catch (error) {
      api.tokens.clear();
    }
  })();
}
