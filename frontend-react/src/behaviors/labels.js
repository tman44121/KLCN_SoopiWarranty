/* ==========================================================================
   Nhãn/tone cố định theo MÃ ENUM của API — CODEX mục 7.1, 15.2 (D-003)
   Chỉ chứa hằng số hiển thị và hàm định dạng — KHÔNG có dữ liệu nghiệp vụ.
   Mọi màn hình so sánh theo mã enum, không so chuỗi tiếng Việt.
   ========================================================================== */

export default function initialize() {

  /** Bảng 7.1: trạng thái phiếu → nhãn UI (badge) + tone mục 4. */
  const TICKET_STATUS = {
    RECEIVED: { label: "Chưa phân công", tone: "neutral" },
    INSPECTING: { label: "Đang chẩn đoán", tone: "processing" },
    DIAGNOSED: { label: "Đã chẩn đoán", tone: "processing" },
    AWAITING_QUOTE_APPROVAL: { label: "Chờ phê duyệt báo giá", tone: "warning" },
    AWAITING_CUSTOMER_CONFIRMATION: { label: "Chờ khách xác nhận", tone: "warning" },
    AWAITING_PARTS: { label: "Chờ linh kiện", tone: "warning" },
    REPAIRING: { label: "Đang sửa chữa", tone: "processing" },
    COMPLETED: { label: "Hoàn thành – Chờ bàn giao", tone: "success" },
    DELIVERED: { label: "Đã bàn giao", tone: "success" },
    AWAITING_RETURN: { label: "Chờ trả máy", tone: "warning" },
    RETURNED_UNREPAIRED: { label: "Đã trả máy (không sửa)", tone: "neutral" },
  };

  /* Nhãn phía khách (/, /account, /portal). Giữ nguyên mã trạng thái và nhãn nhân viên; chỉ đổi lời cho khách:
     máy đã sửa xong hoặc không sửa và đang chờ ra quầy lấy thì khách đọc là "chờ nhận máy". */
  const TICKET_STATUS_CUSTOMER = {
    ...TICKET_STATUS,
    COMPLETED: { label: "Sửa xong – Chờ nhận máy", tone: "success" },
    AWAITING_RETURN: { label: "Chờ nhận máy", tone: "warning" },
  };

  const CATEGORY = {
    PHONE: "Điện thoại",
    LAPTOP_TABLET: "Laptop/Tablet",
    TV_MONITOR: "TV/Monitor",
    AUDIO_WEARABLE: "Audio/Wearables",
    HOME_APPLIANCE: "Thiết bị gia dụng",
    SMALL_ELECTRONICS: "Điện tử nhỏ",
  };

  const SLA_LEVEL = {
    EXPRESS_12H: "Nhanh (12h)",
    PRIORITY_24H: "Ưu tiên (24h)",
    STANDARD_48H: "Tiêu chuẩn (48h)",
  };

  const PRIORITY = { URGENT: "Gấp", NORMAL: "Bình thường", LOW: "Thấp" };

  const CHANNEL = {
    COUNTER: "Tại quầy",
    MOBILE_APP: "Qua App Mobile",
    ONLINE_REQUEST: "Đăng ký trực tuyến",
    PHONE: "Qua điện thoại",
  };

  const REQUEST_TYPE = { WARRANTY: "Bảo hành", PAID_REPAIR: "Sửa chữa dịch vụ" };

  const WARRANTY_STATUS = {
    IN_WARRANTY: { label: "Còn bảo hành", tone: "success" },
    OUT_OF_WARRANTY: { label: "Hết bảo hành", tone: "danger" },
    NOT_ACTIVATED: { label: "Chưa kích hoạt", tone: "neutral" },
  };

  const CLASSIFICATION = {
    FREE_WARRANTY: "Hợp lệ (Miễn phí)",
    OUT_OF_WARRANTY: "Ngoài bảo hành (Tính phí)",
    PARTIAL_WARRANTY: "Bảo hành một phần",
  };

  const STEP_RESULT = {
    PENDING: { label: "Chưa kiểm tra", tone: "neutral" },
    PASS: { label: "Đạt", tone: "success" },
    FAIL: { label: "Không đạt", tone: "danger" },
    NA: { label: "Không áp dụng", tone: "neutral" },
  };

  /** Mục 5.6 — bước QC chung (UI 16E). */
  const QC_STEPS = [
    { code: "VISUAL", label: "Kiểm tra ngoại quan" },
    { code: "MAIN_FUNCTION", label: "Kiểm tra chức năng chính" },
    { code: "SECONDARY", label: "Kiểm tra phụ" },
    { code: "POWER_CHARGING", label: "Kiểm tra nguồn/sạc" },
    { code: "DATA", label: "Xác nhận dữ liệu" },
    { code: "FINAL", label: "Kết quả QC" },
  ];

  const QUOTE_APPROVAL = {
    PENDING: { label: "Chờ phê duyệt", tone: "warning" },
    APPROVED: { label: "Đã phê duyệt", tone: "success" },
    REJECTED: { label: "Đã từ chối", tone: "danger" },
  };

  const QUOTE_DECISION = {
    PENDING: { label: "Chờ phản hồi", tone: "warning" },
    ACCEPTED: { label: "Đã xác nhận", tone: "success" },
    DECLINED: { label: "Khách từ chối", tone: "danger" },
  };

  /** D-009: không có "Thanh toán một phần"/"Hoàn tiền". */
  const PAYMENT_STATUS = {
    UNPAID: { label: "Chưa thanh toán", tone: "neutral" },
    PAID: { label: "Đã thanh toán", tone: "success" },
    FREE_WARRANTY: { label: "Miễn phí bảo hành", tone: "success" },
  };

  const PAYMENT_METHOD = {
    CASH: "Tiền mặt",
    BANK_TRANSFER: "Chuyển khoản",
    E_WALLET: "Ví điện tử",
    CARD: "Thẻ",
    NONE: "Không thu",
  };

  const STOCK_ISSUE_STATUS = {
    PENDING: { label: "Chờ duyệt", tone: "warning" },
    ISSUED: { label: "Đã xuất kho", tone: "success" },
    REJECTED: { label: "Đã từ chối", tone: "danger" },
  };

  const STOCK_RECEIPT_STATUS = {
    PENDING: { label: "Chờ duyệt", tone: "warning" },
    APPROVED: { label: "Đã nhập kho", tone: "success" },
    REJECTED: { label: "Đã từ chối", tone: "danger" },
  };

  const STOCK_TRANSFER_STATUS = {
    PENDING: { label: "Chờ duyệt", tone: "warning" },
    COMPLETED: { label: "Đã điều chuyển", tone: "success" },
    REJECTED: { label: "Đã từ chối", tone: "danger" },
  };

  const WARRANTY_REQUEST_STATUS = {
    PENDING_INTAKE: { label: "Chờ tiếp nhận", tone: "warning" },
    CONVERTED: { label: "Đã tiếp nhận", tone: "success" },
    CANCELLED: { label: "Đã hủy", tone: "neutral" },
  };

  const ACCOUNT_STATUS = {
    ACTIVE: { label: "Đang hoạt động", tone: "success" },
    LOCKED: { label: "Đã khóa", tone: "danger" },
  };

  /** Tài khoản đăng nhập của khách (NONE = khách chưa tự đăng ký). */
  const CUSTOMER_ACCOUNT_STATUS = {
    NONE: { label: "Chưa có tài khoản", tone: "neutral" },
    ACTIVE: { label: "Đang hoạt động", tone: "success" },
    TEMP_LOCKED: { label: "Tạm khóa (đăng nhập sai nhiều lần)", tone: "warning" },
    LOCKED: { label: "Đã khóa", tone: "danger" },
  };

  const CUSTOMER_STATUS = {
    ACTIVE: { label: "Đang hoạt động", tone: "success" },
    ARCHIVED: { label: "Đã lưu trữ", tone: "neutral" },
    MERGED: { label: "Đã gộp", tone: "neutral" },
  };

  const ROLE = {
    ADMIN: "Quản trị viên",
    RECEPTIONIST: "Tiếp nhận & Lễ tân",
    DISPATCHER: "Điều phối viên",
    TECHNICIAN: "Kỹ thuật viên",
    WAREHOUSE_KEEPER: "Quản lý kho vật tư",
    CASHIER: "Thu ngân & Bàn giao",
    CUSTOMER: "Khách hàng",
  };

  const SCRATCHES = { NONE: "Không", LIGHT: "Nhẹ", HEAVY: "Nặng" };
  const MOISTURE = { NONE: "Không", SUSPECTED: "Nghi ngờ", YES: "Có" };
  const ACCESSORIES = { COMPLETE: "Đủ", MISSING: "Thiếu" };

  /* ------------------------------------------------------------------ */
  /* Định dạng                                                            */
  /* ------------------------------------------------------------------ */

  const ZONE = "Asia/Ho_Chi_Minh";
  const dateTimeFormat = new Intl.DateTimeFormat("vi-VN", {
    timeZone: ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dateFormat = new Intl.DateTimeFormat("vi-VN", {
    timeZone: ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  /** "17/09/2026 08:12" theo giờ Việt Nam; null → "—". */
  function dateTime(value) {
    if (!value) return "—";
    const parts = Object.fromEntries(dateTimeFormat.formatToParts(new Date(value)).map((p) => [p.type, p.value]));
    return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
  }

  /** Ngày nghiệp vụ "yyyy-MM-dd" (không có giờ) hoặc thời điểm ISO → "dd/MM/yyyy". */
  function date(value) {
    if (!value) return "—";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-");
      return `${d}/${m}/${y}`;
    }
    return dateFormat.format(new Date(value));
  }

  function money(value) {
    const number = Number(value || 0);
    return number.toLocaleString("vi-VN") + " đ";
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  /** Đếm ngược SLA: "01:42:18" hoặc "Trễ 00:18:05". */
  function countdown(ms) {
    const overdue = ms < 0;
    const abs = Math.abs(ms);
    const h = Math.floor(abs / 3600000);
    const m = Math.floor((abs % 3600000) / 60000);
    const s = Math.floor((abs % 60000) / 1000);
    const text = `${pad(h)}:${pad(m)}:${pad(s)}`;
    return overdue ? `Trễ ${text}` : text;
  }

  /* Icon theo tông (cùng hình với StatusBadge trang khách): tốt / cảnh báo / lỗi phải phân biệt được cả khi
     không thấy màu — với mù màu đỏ, nền "tốt" và "lỗi" gần như trùng nhau. Đang xử lý / trung tính giữ chấm ●. */
  const BADGE_ICON = {
    success: () => window.html`<svg class="status-badge__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>`,
    warning: () => window.html`<svg class="status-badge__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
    danger: () => window.html`<svg class="status-badge__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>`,
  };

  /** Badge chuẩn mục 4 — luôn có icon/● + nhãn tiếng Việt, không chỉ dựa vào màu. */
  function badge(tone, label) {
    const icon = BADGE_ICON[tone] ? BADGE_ICON[tone]() : window.html`<span class="status-badge__dot">●</span>`;
    return window.html`<span class="status-badge status-badge--${tone}">${icon}${label}</span>`;
  }

  function badgeOf(table, code) {
    const entry = table[code];
    return entry ? badge(entry.tone, entry.label) : badge("neutral", code || "—");
  }

  window.LML_LABELS = {
    TICKET_STATUS,
    TICKET_STATUS_CUSTOMER,
    CATEGORY,
    SLA_LEVEL,
    PRIORITY,
    CHANNEL,
    REQUEST_TYPE,
    WARRANTY_STATUS,
    CLASSIFICATION,
    STEP_RESULT,
    QC_STEPS,
    QUOTE_APPROVAL,
    QUOTE_DECISION,
    PAYMENT_STATUS,
    PAYMENT_METHOD,
    STOCK_ISSUE_STATUS,
    STOCK_RECEIPT_STATUS,
    STOCK_TRANSFER_STATUS,
    WARRANTY_REQUEST_STATUS,
    ACCOUNT_STATUS,
    CUSTOMER_ACCOUNT_STATUS,
    CUSTOMER_STATUS,
    ROLE,
    SCRATCHES,
    MOISTURE,
    ACCESSORIES,
  };

  window.LML_FMT = { dateTime, date, money, countdown, badge, badgeOf };
}
