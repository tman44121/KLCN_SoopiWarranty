/* ==========================================================================
   Lớp gọi API dùng chung — CODEX mục 15.2, 9.1, 9.5, 9.7
   - Access token (15 phút) giữ trong bộ nhớ + sessionStorage (không dùng
     localStorage); refresh token là cookie HttpOnly do máy chủ quản lý.
   - 401 → gọi /auth/refresh MỘT lần (dùng chung một Promise cho các request
     song song) rồi thử lại; refresh thất bại → về trang đăng nhập ?next=.
   - Portal token của khách lưu riêng (key lml_portal), không có refresh.
   ========================================================================== */

export default function initialize(global = window) {

  const BASE = (import.meta.env?.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const TOKEN_KEY = "lml_access_token";
  const USER_KEY = "lml_user";
  const PORTAL_KEY = "lml_portal";

  class ApiError extends Error {
    constructor(status, problem) {
      super((problem && problem.detail) || "Đã xảy ra lỗi hệ thống. Vui lòng thử lại.");
      this.status = status;
      this.code = (problem && problem.code) || (status === 0 ? "NETWORK_ERROR" : "SYSTEM_ERROR");
      this.fieldErrors = (problem && problem.fieldErrors) || [];
      this.detail = [this.message, ...this.fieldErrors.map((item) => `${item.field}: ${item.message}`)].join(" ");
    }
  }

  function readStorage(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      if (value === null || value === undefined) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch (e) {
      /* Trình duyệt chặn storage — token vẫn giữ trong bộ nhớ của trang. */
    }
  }

  let accessToken = readStorage(TOKEN_KEY);
  let refreshing = null;

  const tokens = {
    get: () => accessToken,
    set(value) {
      accessToken = value;
      writeStorage(TOKEN_KEY, value);
    },
    clear() {
      accessToken = null;
      writeStorage(TOKEN_KEY, null);
      writeStorage(USER_KEY, null);
    },
  };

  /**
   * Thông tin người dùng của phiên (lần /auth/login, /auth/refresh, /auth/me gần nhất) để trang kế tiếp vào ngay mà
   * không chờ /auth/me. Chỉ dùng cho hiển thị; máy chủ vẫn kiểm quyền từng request.
   */
  const session = {
    user() {
      try {
        return JSON.parse(readStorage(USER_KEY));
      } catch (e) {
        return null;
      }
    },
    remember(user) {
      if (user) writeStorage(USER_KEY, JSON.stringify(user));
      return user;
    },
  };

  const portalTokens = {
    get() {
      try {
        return JSON.parse(readStorage(PORTAL_KEY) || "null");
      } catch (e) {
        return null;
      }
    },
    set(value) {
      writeStorage(PORTAL_KEY, value ? JSON.stringify(value) : null);
    },
    clear() {
      writeStorage(PORTAL_KEY, null);
    },
  };

  function loginHref() { return "/login"; }

  function redirectToLogin(extra) {
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    location.replace(`${loginHref()}?next=${next}${extra || ""}`);
  }

  function buildUrl(path, query) {
    const url = new URL(BASE + path, location.origin);
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
      else url.searchParams.set(key, value);
    });
    return url.toString();
  }

  function newCorrelationId() {
    return global.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
  }

  async function send(method, path, options, bearer) {
    const headers = { "X-Requested-With": "fetch", "X-Correlation-Id": newCorrelationId() };
    let body;
    if (options.formData) {
      body = options.formData;
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    if (options.ifMatch !== undefined && options.ifMatch !== null) headers["If-Match"] = String(options.ifMatch);
    try {
      return await fetch(buildUrl(path, options.query), {
        method,
        headers,
        body,
        credentials: "include",
      });
    } catch (e) {
      throw new ApiError(0, { detail: "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại." });
    }
  }

  async function parse(response) {
    if (response.status === 204) return null;
    const type = response.headers.get("Content-Type") || "";
    if (type.includes("json")) return response.json();
    if (type.startsWith("text/")) return response.text();
    return response.blob();
  }

  async function fail(response) {
    let problem = null;
    try {
      problem = await response.json();
    } catch (e) {
      problem = null;
    }
    return new ApiError(response.status, problem);
  }

  /** Làm mới access token bằng cookie refresh; các lời gọi song song dùng chung một Promise. */
  function refresh() {
    if (!refreshing) {
      refreshing = send("POST", "/auth/refresh", {}, null)
        .then(async (response) => {
          if (!response.ok) throw await fail(response);
          const data = await response.json();
          tokens.set(data.accessToken);
          session.remember(data.user);
          return data;
        })
        .finally(() => {
          refreshing = null;
        });
    }
    return refreshing;
  }

  /**
   * request(method, path, {body, query, formData, ifMatch, auth})
   * auth: "staff" (mặc định, access token + refresh), "portal" (portal token), "none".
   */
  async function request(method, path, options = {}) {
    const auth = options.auth || "staff";
    const bearer = auth === "staff" ? accessToken : auth === "portal" ? (portalTokens.get() || {}).accessToken : null;
    let response = await send(method, path, options, bearer);

    if (response.status === 401 && auth === "staff" && !path.startsWith("/auth/")) {
      try {
        await refresh();
      } catch (e) {
        tokens.clear();
        redirectToLogin();
        throw new ApiError(401, { detail: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." });
      }
      response = await send(method, path, options, accessToken);
    }
    if (!response.ok) {
      const error = await fail(response);
      if (error.code === "AUTH_PASSWORD_CHANGE_REQUIRED" && auth === "staff") redirectToLogin("&change=1");
      if (response.status === 401 && auth === "portal") portalTokens.clear();
      throw error;
    }
    return parse(response);
  }

  const get = (path, query, opts) => request("GET", path, Object.assign({ query }, opts));
  const post = (path, body, opts) => request("POST", path, Object.assign({ body }, opts));
  const put = (path, body, opts) => request("PUT", path, Object.assign({ body }, opts));
  const patch = (path, body, opts) => request("PATCH", path, Object.assign({ body }, opts));
  const enc = encodeURIComponent;

  /** multipart có part "data" là JSON (D-032): Blob kiểu application/json để Spring bind @RequestPart. */
  function multipart(data, files) {
    const form = new FormData();
    form.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));
    Object.entries(files || {}).forEach(([name, value]) => {
      (Array.isArray(value) ? value : [value]).filter(Boolean).forEach((file) => form.append(name, file));
    });
    return form;
  }

  global.LML_API = {
    ApiError,
    tokens,
    portalTokens,
    request,
    get,
    post,
    put,
    patch,
    multipart,
    refresh,
    redirectToLogin,
    session,

    auth: {
      login: (username, password, remember) =>
        request("POST", "/auth/login", { body: { username, password, remember }, auth: "none" }).then((result) => {
          session.remember(result.user);
          return result;
        }),
      me: () => get("/auth/me").then(session.remember),
      logout: (all) => request("POST", "/auth/logout", { query: { all: all ? "true" : null }, auth: "none" }),
      changePassword: (currentPassword, newPassword) =>
        post("/auth/change-password", { currentPassword, newPassword }),
    },

    tickets: {
      list: (query) => get("/tickets", query),
      open: () => get("/tickets/open"),
      get: (code) => get(`/tickets/${enc(code)}`),
      history: (code) => get(`/tickets/${enc(code)}/history`),
      receipt: (code) => get(`/tickets/${enc(code)}/receipt`),
      receive: (body) => post("/tickets", body),
      candidates: (code) => get(`/tickets/${enc(code)}/assignment-candidates`),
      assign: (code, body) => post(`/tickets/${enc(code)}/assignment`, body),
      reassign: (code, body) => put(`/tickets/${enc(code)}/assignment`, body),
      inspect: (code, body) => post(`/tickets/${enc(code)}/inspection`, body),
      reviseInspection: (code, body) => put(`/tickets/${enc(code)}/inspection`, body),
      startRepair: (code) => post(`/tickets/${enc(code)}/repair/start`),
      partsReady: (code) => post(`/tickets/${enc(code)}/repair/parts-ready`),
      recordResult: (code, body) => post(`/tickets/${enc(code)}/repair/results`, body),
      customerNote: (code, text) => post(`/tickets/${enc(code)}/customer-notes`, { text }),
      internalNote: (code, text) => post(`/tickets/${enc(code)}/internal-notes`, { text }),
      billing: (code) => get(`/tickets/${enc(code)}/billing`),
      collect: (code, body) => post(`/tickets/${enc(code)}/payments`, body),
      confirmFree: (code, note) => post(`/tickets/${enc(code)}/payments/free-warranty`, { note }),
      handOver: (code, data, signature) =>
        request("POST", `/tickets/${enc(code)}/handover`, { formData: multipart(data, { signature }) }),
      handoverSlip: (code) => get(`/tickets/${enc(code)}/handover-slip`),
    },

    technicians: {
      workload: () => get("/technicians/workload"),
      myQueue: () => get("/technicians/me/queue"),
    },

    quotations: {
      create: (ticketCode, body) => post(`/tickets/${enc(ticketCode)}/quotations`, body),
      list: (query) => get("/quotations", query),
      get: (code) => get(`/quotations/${enc(code)}`),
      updateLines: (code, lines) => put(`/quotations/${enc(code)}/lines`, lines),
      approve: (code, note) => post(`/quotations/${enc(code)}/approve`, { note }),
      reject: (code, note) => post(`/quotations/${enc(code)}/reject`, { note }),
      decideAtCounter: (code, decision, reason) =>
        post(`/quotations/${enc(code)}/customer-decision`, { decision, reason }),
    },

    customers: {
      search: (q, page, size) => get("/customers", { q, page: page || 0, size: size || 25 }),
      get: (code) => get(`/customers/${enc(code)}`),
      devices: (code) => get(`/customers/${enc(code)}/devices`),
      tickets: (code) => get(`/customers/${enc(code)}/tickets`),
      payments: (code) => get(`/customers/${enc(code)}/payments`),
    },

    devices: {
      lookup: (serial) => get("/devices/lookup", { serial }),
    },

    catalog: {
      list: (type) => get(`/catalog/${enc(type)}`),
      get: (type, code) => get(`/catalog/${enc(type)}/${enc(code)}`),
      create: (type, body) => post(`/catalog/${enc(type)}`, body),
      update: (type, code, body) => put(`/catalog/${enc(type)}/${enc(code)}`, body),
    },

    inventory: {
      parts: (query) => get("/parts", query),
      part: (sku) => get(`/parts/${enc(sku)}`),
      lowStock: () => get("/parts/low-stock"),
      requestIssue: (body) => post("/stock-issues", body),
      issues: (status) => get("/stock-issues", { status }),
      myIssues: (status) => get("/stock-issues/mine", { status }),
      approveIssue: (code, lineBins) => post(`/stock-issues/${enc(code)}/approve`, { lineBins: lineBins || [] }),
      rejectIssue: (code, reason) => post(`/stock-issues/${enc(code)}/reject`, { reason }),
      receipts: (status) => get("/stock-receipts", { status }),
      createReceipt: (body) => post("/stock-receipts", body),
      approveReceipt: (code) => post(`/stock-receipts/${enc(code)}/approve`),
      rejectReceipt: (code, reason) => post(`/stock-receipts/${enc(code)}/reject`, { reason }),
      transfers: (status) => get("/stock-transfers", { status }),
      createTransfer: (body) => post("/stock-transfers", body),
      approveTransfer: (code) => post(`/stock-transfers/${enc(code)}/approve`),
      rejectTransfer: (code, reason) => post(`/stock-transfers/${enc(code)}/reject`, { reason }),
    },

    warrantyRequests: {
      list: (status, q) => get("/warranty-requests", { status, q }),
      get: (code) => get(`/warranty-requests/${enc(code)}`),
      cancel: (code, reason) => post(`/warranty-requests/${enc(code)}/cancel`, { reason }),
    },

    reports: {
      get: (name, query) => get(`/reports/${enc(name)}`, query),
      auditLogs: (query) => get("/audit-logs", query),
    },

    admin: {
      employees: (query) => get("/admin/employees", query),
      createEmployee: (body) => post("/admin/employees", body),
      updateEmployee: (code, body) => patch(`/admin/employees/${enc(code)}`, body),
      changeRoles: (code, roles) => put(`/admin/employees/${enc(code)}/roles`, { roles }),
      lock: (code) => post(`/admin/employees/${enc(code)}/lock`),
      unlock: (code) => post(`/admin/employees/${enc(code)}/unlock`),
      resetPassword: (code) => post(`/admin/employees/${enc(code)}/reset-password`),
    },

    notifications: {
      inbox: (unread) => get("/notifications", { unread: unread ? "true" : null }),
      read: (id) => post(`/notifications/${enc(id)}/read`),
      readAll: () => post("/notifications/read-all"),
    },

    search: (q) => get("/search", { q }),

    portal: {
      catalog: () => request("GET", "/portal/catalog", { auth: "none" }),
      lookup: (code, phone) => request("POST", "/portal/lookup", { body: { code, phone }, auth: "none" }),
      submitRequest: (data, files) =>
        request("POST", "/portal/warranty-requests", { formData: multipart(data, { files }), auth: "none" }),
      request: (code) => request("GET", `/portal/warranty-requests/${enc(code)}`, { auth: "portal" }),
      ticket: (code) => request("GET", `/portal/tickets/${enc(code)}`, { auth: "portal" }),
      decide: (code, decision, reason) =>
        request("POST", `/portal/tickets/${enc(code)}/quotation-decision`, {
          body: { decision, reason },
          auth: "portal",
        }),
    },

    fileUrl: (id) => `${BASE}/files/${enc(id)}`,
  };
}
