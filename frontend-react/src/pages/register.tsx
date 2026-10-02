import { useEffect, useState, type FormEvent } from "react";
import { usePage } from "../usePage";
import { Icon, PasswordInput, api, errorText, useBusy } from "../customer";

type Field = "fullName" | "phone" | "email" | "otp" | "password" | "confirm";
const EMPTY: Record<Field, string> = { fullName: "", phone: "", email: "", otp: "", password: "", confirm: "" };

/* Đăng ký tài khoản khách (giao diện web khách KLCN). Backend xác thực SĐT bằng OTP qua /auth/mobile; đăng ký xong
   đăng nhập phiên web (cookie refresh) rồi thu hồi refresh token kiểu mobile mà /register trả về. */
export default function RegisterPage() {
  usePage("register", {"class": "is-fluid"}, "Đăng ký — Soopi");
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
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function sendOtp() {
    setSummary("");
    const phone = form.phone.trim();
    if (!phone) return setErrors({ ...errors, phone: "Vui lòng nhập số điện thoại." });
    await runSend(async () => {
      try {
        const issued = await api().request("POST", "/auth/mobile/otp", { body: { phone, purpose: "REGISTER" }, auth: "none" });
        setOtpSentTo(phone);
        setResendIn(Number(issued.resendAfter) || 60);
        document.getElementById("otp")?.focus();
      } catch (error) {
        setSummary(errorText(error));
      }
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSummary("");
    const next: Partial<Record<Field, string>> = {};
    if (!form.fullName.trim()) next.fullName = "Vui lòng nhập họ và tên.";
    if (!form.phone.trim()) next.phone = "Vui lòng nhập số điện thoại.";
    if (!otpSentTo) next.otp = "Bấm “Gửi mã OTP” để nhận mã xác thực.";
    else if (!form.otp.trim()) next.otp = "Vui lòng nhập mã OTP.";
    if (!form.password) next.password = "Vui lòng nhập mật khẩu.";
    if (form.password && form.confirm !== form.password) next.confirm = "Mật khẩu xác nhận không khớp.";
    setErrors(next);
    if (Object.keys(next).length) return;
    await runSubmit(async () => {
      try {
        const created = await api().request("POST", "/auth/mobile/register", {
          body: { phone: form.phone.trim(), otp: form.otp.trim(), fullName: form.fullName.trim(), password: form.password, email: form.email.trim() || null },
          auth: "none",
        });
        void api().request("POST", "/auth/mobile/logout", { body: { refreshToken: created.refreshToken }, auth: "none" }).catch(() => undefined);
        const session = await api().auth.login(created.user.username, form.password, false);
        api().tokens.set(session.accessToken);
        window.location.href = "/account";
      } catch (error) {
        setSummary(errorText(error));
      }
    });
  }

  const invalid = (field: Field) => (errors[field] ? true : undefined);
  const fieldError = (field: Field) => errors[field] && <div className="field-error" id={`${field}-error`}>{errors[field]}</div>;

  return (
    <div className="kh-app kh-auth">
      <aside className="auth-banner">
        <div className="banner-header">
          <a href="/portal" className="banner-logo">
            <span className="banner-logo-icon" aria-hidden="true">S</span>
            <span className="banner-logo-text">
              <span className="banner-logo-title">Soopi</span>
              <span className="banner-logo-sub">KHÁCH HÀNG / BẢO HÀNH ĐIỆN TỬ</span>
            </span>
          </a>
          <a href="/portal" className="banner-home-link"><Icon glyph="search" />Tra cứu không cần đăng nhập</a>
        </div>
        <div className="process-card">
          <h3 className="process-card-header">Ba bước để bắt đầu</h3>
          <ol className="process-steps">
            <li className="process-step-item">
              <span className="step-number">01</span>
              <div className="step-text"><h4>Xác thực số điện thoại</h4><p>Nhận mã OTP qua SMS và nhập vào form.</p></div>
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
                <div className="input-wrapper" style={{ flex: 1 }}>
                  <span className="input-icon"><Icon glyph="phone" /></span>
                  <input type="tel" id="phone" className="form-input" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxx"
                    value={form.phone} onChange={(e) => set("phone")(e.target.value)} aria-invalid={invalid("phone")} aria-describedby="phone-note phone-error" />
                </div>
                <button type="button" className="btn-otp" onClick={sendOtp} disabled={sending || resendIn > 0}>
                  {sending ? "Đang gửi…" : resendIn > 0 ? `Gửi lại sau ${resendIn}s` : otpSentTo ? "Gửi lại mã" : "Gửi mã OTP"}
                </button>
              </div>
              <div className="input-subnote" id="phone-note">
                {otpSentTo ? `Mã OTP đã gửi tới ${otpSentTo}.` : "Dùng làm tên đăng nhập và để nhận mã OTP."}
              </div>
              {fieldError("phone")}
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
              <label htmlFor="email">Email <span style={{ textTransform: "none", fontWeight: 500 }}>(không bắt buộc)</span></label>
              <div className="input-wrapper">
                <span className="input-icon"><Icon glyph="mail" /></span>
                <input type="email" id="email" className="form-input" autoComplete="email" placeholder="name@example.com"
                  value={form.email} onChange={(e) => set("email")(e.target.value)} />
              </div>
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
