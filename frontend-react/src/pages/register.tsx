import { useEffect, useState, type FormEvent } from "react";
import { usePage } from "../usePage";
import { BrandLogo, Icon, PasswordInput, api, errorText, useAuthScale, useBusy } from "../customer";

type Field = "fullName" | "phone" | "email" | "otp" | "password" | "confirm";
const EMPTY: Record<Field, string> = { fullName: "", phone: "", email: "", otp: "", password: "", confirm: "" };

/** Cùng quy tắc với PhoneNumber/EmailAddress/PasswordPolicy ở backend để báo lỗi ngay tại ô nhập. */
const normalizePhone = (raw: string) => {
  const digits = raw.replace(/[^0-9+]/g, "");
  return (digits.startsWith("+84") ? "0" + digits.slice(3) : digits).replace(/\+/g, "");
};
const phoneError = (raw: string) =>
  !raw.trim() ? "Vui lòng nhập số điện thoại."
    : /^0[0-9]{9,10}$/.test(normalizePhone(raw)) ? undefined
      : "Số điện thoại không hợp lệ — cần 10 hoặc 11 chữ số và bắt đầu bằng 0 (ví dụ 0912345678).";
const emailError = (raw: string) =>
  !raw.trim() ? "Vui lòng nhập email để nhận mã OTP."
    : raw.trim().length > 100 ? "Email quá dài — tối đa 100 ký tự."
      : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw.trim()) ? undefined
        : "Email không đúng định dạng (ví dụ ten@gmail.com).";
const passwordError = (password: string, phone: string) => {
  if (!password) return "Vui lòng nhập mật khẩu.";
  if (password.length < 10) return `Mật khẩu mới có ${password.length} ký tự — cần tối thiểu 10 ký tự.`;
  if (!/\p{L}/u.test(password)) return "Mật khẩu cần có ít nhất một chữ cái.";
  if (!/[0-9]/.test(password)) return "Mật khẩu cần có ít nhất một chữ số.";
  const login = normalizePhone(phone);
  if (login && password.toLowerCase().includes(login)) return "Mật khẩu không được chứa số điện thoại (tên đăng nhập).";
  return undefined;
};

/** Lỗi máy chủ → đúng ô nhập; lỗi không gắn được ô nào thì hiện ở hộp tóm tắt phía trên. */
const SERVER_FIELD: Record<string, Field> = {
  CUSTOMER_ACCOUNT_EXISTS: "phone", CUSTOMER_PHONE_DUPLICATE: "phone",
  CUSTOMER_EMAIL_DUPLICATE: "email", CUSTOMER_PROFILE_VERIFICATION_REQUIRED: "email", CUSTOMER_EMAIL_NOT_FOUND: "email",
  OTP_INVALID: "otp", AUTH_PASSWORD_POLICY: "password",
};
function serverFieldErrors(error: { code?: string; detail?: string; message?: string; fieldErrors?: { field: string; message: string }[] }) {
  const result: Partial<Record<Field, string>> = {};
  const text = error?.message || errorText(error);
  if (error?.code && SERVER_FIELD[error.code]) result[SERVER_FIELD[error.code]] = text;
  else if (error?.code === "VALIDATION_FAILED") {
    for (const item of error.fieldErrors || []) {
      const field = item.field.split(".").pop() as Field;
      if (field in EMPTY) result[field] = text;
    }
    if (!error.fieldErrors?.length) {
      if (/số điện thoại/i.test(text)) result.phone = text;
      else if (/email/i.test(text)) result.email = text;
      else if (/họ và tên/i.test(text)) result.fullName = text;
    }
  }
  return result;
}

/* Đăng ký tài khoản khách (giao diện web khách KLCN). SĐT là tên đăng nhập; backend xác thực email bằng OTP gửi qua email
   (/auth/mobile/otp). Đăng ký xong đăng nhập phiên web (cookie refresh) rồi thu hồi refresh token kiểu mobile mà /register
   trả về. */
export default function RegisterPage() {
  usePage("register", {}, "Đăng ký — Soopi");
  const scaled = useAuthScale();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [summary, setSummary] = useState("");
  const [otpSentTo, setOtpSentTo] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [sending, runSend] = useBusy();
  const [submitting, runSubmit] = useBusy();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const set = (field: Field) => (value: string) => {
    if (field === "email" && otpSentTo && value.trim() !== otpSentTo) setOtpSentTo("");
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function sendOtp() {
    setSummary("");
    const email = form.email.trim();
    const next = { ...errors, email: emailError(email), phone: form.phone.trim() ? phoneError(form.phone) : errors.phone };
    setErrors(next);
    if (next.email || next.phone) return document.getElementById(next.phone ? "phone" : "email")?.focus();
    await runSend(async () => {
      try {
        const issued = await api().request("POST", "/auth/mobile/otp", {
          body: { email, phone: form.phone.trim() || null, purpose: "REGISTER" },
          auth: "none",
        });
        setOtpSentTo(email);
        setResendIn(Number(issued.resendAfter) || 60);
        document.getElementById("otp")?.focus();
      } catch (error) {
        showServerError(error);
      }
    });
  }

  function showServerError(error: any) {
    const fields = serverFieldErrors(error);
    if (Object.keys(fields).length) {
      setErrors((current) => ({ ...current, ...fields }));
      document.getElementById(Object.keys(fields)[0])?.focus();
    } else setSummary(errorText(error));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSummary("");
    const next: Partial<Record<Field, string>> = {};
    if (!form.fullName.trim()) next.fullName = "Vui lòng nhập họ và tên.";
    next.phone = phoneError(form.phone);
    next.email = emailError(form.email);
    if (!next.email && !otpSentTo) next.otp = "Bấm “Gửi mã OTP” để nhận mã xác thực qua email.";
    else if (!next.email && !/^[0-9]{4,8}$/.test(form.otp.trim()))
      next.otp = form.otp.trim() ? "Mã OTP chỉ gồm chữ số — kiểm tra lại mã trong email." : "Vui lòng nhập mã OTP đã gửi tới email.";
    next.password = passwordError(form.password, form.phone);
    if (!form.confirm) next.confirm = "Vui lòng nhập lại mật khẩu.";
    else if (form.confirm !== form.password) next.confirm = "Mật khẩu xác nhận không khớp với mật khẩu đã nhập.";
    const failed = (Object.keys(next) as Field[]).filter((field) => next[field]);
    setErrors(next);
    if (failed.length) return document.getElementById(failed[0])?.focus();
    await runSubmit(async () => {
      try {
        const created = await api().request("POST", "/auth/mobile/register", {
          body: { phone: form.phone.trim(), email: otpSentTo, otp: form.otp.trim(), fullName: form.fullName.trim(), password: form.password },
          auth: "none",
        });
        void api().request("POST", "/auth/mobile/logout", { body: { refreshToken: created.refreshToken }, auth: "none" }).catch(() => undefined);
        const session = await api().auth.login(created.user.username, form.password, false);
        api().tokens.set(session.accessToken);
        window.location.href = "/account";
      } catch (error) {
        showServerError(error);
      }
    });
  }

  const invalid = (field: Field) => (errors[field] ? true : undefined);
  const fieldError = (field: Field) => errors[field] && <div className="field-error" id={`${field}-error`}>{errors[field]}</div>;

  return (
    <div className="kh-app kh-auth kh-auth--wide" ref={scaled}>
      <aside className="auth-banner">
        <div className="banner-header">
          <a href="/" className="banner-logo">
            <BrandLogo light={true} />
          </a>
          <a href="/portal" className="banner-home-link"><Icon glyph="search" />Tra cứu không cần đăng nhập</a>
        </div>
        <div className="process-card">
          <h3 className="process-card-header">Ba bước để bắt đầu</h3>
          <ol className="process-steps">
            <li className="process-step-item">
              <span className="step-number">01</span>
              <div className="step-text"><h4>Xác thực email</h4><p>Nhận mã OTP qua email và nhập vào form.</p></div>
            </li>
            <li className="process-step-item">
              <span className="step-number">02</span>
              <div className="step-text"><h4>Tạo mật khẩu</h4><p>Tối thiểu 10 ký tự, gồm chữ và số.</p></div>
            </li>
            <li className="process-step-item">
              <span className="step-number">03</span>
              <div className="step-text"><h4>Theo dõi bảo hành</h4><p>Phiếu sửa chữa trước đây cùng số điện thoại tự hiện trong tài khoản.</p></div>
            </li>
          </ol>
        </div>
        <div className="banner-footer">
          <h2 className="banner-heading">Tạo tài khoản để quản lý<br />bảo hành điện tử</h2>
          <p className="banner-subheading">Xem thiết bị và hạn bảo hành, theo dõi phiếu sửa chữa, xác nhận báo giá và gửi yêu cầu trực tuyến.</p>
        </div>
      </aside>

      <main className="auth-form-panel">
        <div className="tab-switcher-wrapper">
          <nav className="tab-switcher" aria-label="Đăng nhập hoặc đăng ký">
            <a href="/login" className="tab-btn">Đăng nhập</a>
            <a href="/register" className="tab-btn active" aria-current="page">Đăng ký</a>
          </nav>
        </div>

        <div className="form-content">
          <div className="form-header">
            <h1>Tạo tài khoản mới</h1>
            <p>Đăng ký tài khoản để theo dõi và quản lý bảo hành thiết bị.</p>
          </div>
          {summary && <div className="validation-summary-errors" role="alert">{summary}</div>}

          <form onSubmit={submit} noValidate={true}>
            <div className="form-group">
              <label htmlFor="fullName">Họ và tên</label>
              <div className="input-wrapper">
                <span className="input-icon"><Icon glyph="user" /></span>
                <input type="text" id="fullName" className="form-input" autoComplete="name" placeholder="Ví dụ: Nguyễn Văn A"
                  value={form.fullName} onChange={(e) => set("fullName")(e.target.value)} aria-invalid={invalid("fullName")} aria-describedby="fullName-error" />
              </div>
              {fieldError("fullName")}
            </div>

            <div className="form-group">
              <label htmlFor="phone">Số điện thoại</label>
              <div className="input-wrapper">
                <span className="input-icon"><Icon glyph="phone" /></span>
                <input type="tel" id="phone" className="form-input" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxx"
                  value={form.phone} onChange={(e) => set("phone")(e.target.value)} aria-invalid={invalid("phone")} aria-describedby="phone-note phone-error" />
              </div>
              <div className="input-subnote" id="phone-note">Dùng làm tên đăng nhập.</div>
              {fieldError("phone")}
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <div className="input-wrapper">
                <div className="input-wrapper" style={{ flex: 1 }}>
                  <span className="input-icon"><Icon glyph="mail" /></span>
                  <input type="email" id="email" className="form-input" autoComplete="email" placeholder="name@example.com"
                    value={form.email} onChange={(e) => set("email")(e.target.value)} aria-invalid={invalid("email")} aria-describedby="email-note email-error" />
                </div>
                <button type="button" className="btn-otp" onClick={sendOtp} disabled={sending || resendIn > 0}>
                  {sending ? "Đang gửi…" : resendIn > 0 ? `Gửi lại sau ${resendIn}s` : otpSentTo ? "Gửi lại mã" : "Gửi mã OTP"}
                </button>
              </div>
              <div className="input-subnote" id="email-note">
                {otpSentTo ? `Mã OTP đã gửi tới ${otpSentTo}. Không thấy thư? Xem cả mục Spam.` : "Nhận mã OTP và dùng để lấy lại mật khẩu."}
              </div>
              {fieldError("email")}
            </div>

            <div className="form-group">
              <label htmlFor="otp">Mã OTP</label>
              <div className="input-wrapper">
                <span className="input-icon"><Icon glyph="shield" /></span>
                <input type="text" id="otp" className="form-input" inputMode="numeric" autoComplete="one-time-code" placeholder="Nhập mã gồm các chữ số"
                  value={form.otp} onChange={(e) => set("otp")(e.target.value)} aria-invalid={invalid("otp")} aria-describedby="otp-error" />
              </div>
              {fieldError("otp")}
            </div>

            <div className="form-group">
              <label htmlFor="password">Mật khẩu</label>
              <PasswordInput id="password" name="password" autoComplete="new-password" placeholder="Tối thiểu 10 ký tự, gồm chữ và số"
                value={form.password} onChange={set("password")} invalid={invalid("password")} describedBy="password-error" />
              {fieldError("password")}
            </div>

            <div className="form-group">
              <label htmlFor="confirm">Xác nhận mật khẩu</label>
              <PasswordInput id="confirm" name="confirm" autoComplete="new-password" placeholder="Nhập lại mật khẩu"
                value={form.confirm} onChange={set("confirm")} invalid={invalid("confirm")} describedBy="confirm-error" />
              {fieldError("confirm")}
            </div>

            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
            </button>
          </form>

          <div className="form-switch-text">
            Đã có tài khoản? <a href="/login">Đăng nhập ngay</a>
          </div>
        </div>

        <p className="form-footer-note">Mật khẩu không chứa số điện thoại và không dùng mật khẩu phổ biến.</p>
      </main>
    </div>
  );
}
