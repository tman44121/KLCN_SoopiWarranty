import { useEffect, useState, type FormEvent } from "react";
import { usePage } from "../usePage";
import { BrandLogo, Icon, PasswordInput, api, errorText, useAuthScale, useBusy } from "../customer";
import { emailError, emailSuggestion, passwordError, passwordRules } from "../validation";

type Field = "email" | "otp" | "password" | "confirm";
const EMPTY: Record<Field, string> = { email: "", otp: "", password: "", confirm: "" };

/* Quên mật khẩu cho khách, hai bước:
   1. Gửi OTP tới email đã đăng ký (/auth/mobile/otp, RESET_PASSWORD) và xác nhận mã (/auth/mobile/password-reset/verify,
      chưa tiêu mã — D-047). Chỉ khi mã đúng mới sang bước 2.
   2. Đặt mật khẩu mới (/auth/mobile/password-reset): backend kiểm lại mã, tiêu mã và thu hồi mọi phiên cũ.
   Nhân viên không tự đặt lại được — quản trị viên đặt lại trong màn Quản trị. */
export default function ForgotPasswordPage() {
  usePage("forgot-password", {}, "Quên mật khẩu — Soopi");
  const scaled = useAuthScale();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [summary, setSummary] = useState("");
  const [otpSentTo, setOtpSentTo] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [step, setStep] = useState<"verify" | "password" | "done">("verify");
  const [sending, runSend] = useBusy();
  const [verifying, runVerify] = useBusy();
  const [submitting, runSubmit] = useBusy();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // Sang bước đặt mật khẩu (sau khi trang đã vẽ ô mới) thì đưa con trỏ vào ô mật khẩu.
  useEffect(() => {
    if (step === "password") document.getElementById("password")?.focus();
  }, [step]);

  /** Lỗi định dạng hiện ngay khi gõ; ô trống chỉ báo khi bấm xác nhận. Tên đăng nhập (SĐT) chưa biết nên máy chủ kiểm nốt. */
  function live(field: Field, value: string): string | undefined {
    if (!value) return undefined;
    if (field === "email") return emailError(value);
    if (field === "otp") return /[^0-9]/.test(value.trim()) ? "Mã OTP chỉ gồm chữ số."
      : value.trim().length !== 6 ? `Mã OTP gồm 6 chữ số — bạn mới nhập ${value.trim().length}.` : undefined;
    if (field === "password") return passwordError(value, "");
    return value !== form.password ? "Chưa khớp với mật khẩu mới." : undefined;
  }

  const set = (field: Field) => (value: string) => {
    // Đổi email sau khi đã gửi mã: gửi được mã tới địa chỉ mới ngay (máy chủ giới hạn theo từng email).
    if (field === "email" && otpSentTo && value.trim() !== otpSentTo) {
      setOtpSentTo("");
      setResendIn(0);
      setForm((current) => ({ ...current, otp: "" }));
    }
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current, [field]: live(field, value),
      ...(field === "password" && form.confirm ? { confirm: form.confirm !== value ? "Chưa khớp với mật khẩu mới." : undefined } : {}),
    }));
  };

  async function sendOtp() {
    setSummary("");
    const email = form.email.trim();
    const invalidEmail = email ? emailError(email) : "Vui lòng nhập email đã đăng ký.";
    if (invalidEmail) {
      setErrors({ ...errors, email: invalidEmail });
      return document.getElementById("email")?.focus();
    }
    await runSend(async () => {
      try {
        const issued = await api().request("POST", "/auth/mobile/otp", { body: { email, purpose: "RESET_PASSWORD" }, auth: "none" });
        setOtpSentTo(email);
        setResendIn(Number(issued.resendAfter) || 60);
        document.getElementById("otp")?.focus();
      } catch (error) {
        setSummary(errorText(error));
      }
    });
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setSummary("");
    const next: Partial<Record<Field, string>> = {};
    if (!form.email.trim()) next.email = "Vui lòng nhập email đã đăng ký.";
    else if (emailError(form.email)) next.email = emailError(form.email);
    if (!otpSentTo) next.otp = "Bấm “Gửi mã OTP” để nhận mã xác thực.";
    else next.otp = form.otp.trim() ? live("otp", form.otp) : "Vui lòng nhập mã OTP.";
    setErrors(next);
    const failed = (Object.keys(next) as Field[]).find((field) => next[field]);
    if (failed) return document.getElementById(failed)?.focus();
    await runVerify(async () => {
      try {
        await api().request("POST", "/auth/mobile/password-reset/verify", { body: { email: otpSentTo, otp: form.otp.trim() }, auth: "none" });
        setStep("password");
      } catch (error) {
        setErrors({ otp: errorText(error) });
      }
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSummary("");
    const next: Partial<Record<Field, string>> = {};
    next.password = form.password ? passwordError(form.password, "") : "Vui lòng nhập mật khẩu mới.";
    if (!form.confirm) next.confirm = "Vui lòng nhập lại mật khẩu mới.";
    else if (form.confirm !== form.password) next.confirm = "Chưa khớp với mật khẩu mới.";
    setErrors(next);
    const failed = (Object.keys(next) as Field[]).find((field) => next[field]);
    if (failed) return document.getElementById(failed)?.focus();
    await runSubmit(async () => {
      try {
        await api().request("POST", "/auth/mobile/password-reset", {
          body: { email: otpSentTo, otp: form.otp.trim(), newPassword: form.password },
          auth: "none",
        });
        setStep("done");
      } catch (error) {
        // Mã hết hạn (5 phút) trong lúc nhập mật khẩu: quay lại bước 1 để lấy mã mới.
        if ((error as { code?: string })?.code === "OTP_INVALID") {
          setForm((current) => ({ ...current, otp: "" }));
          setStep("verify");
        }
        setSummary(errorText(error));
      }
    });
  }

  function changeEmail() {
    setForm(EMPTY);
    setErrors({});
    setSummary("");
    setOtpSentTo("");
    setStep("verify");
  }

  const invalid = (field: Field) => (errors[field] ? true : undefined);
  const fieldError = (field: Field, visible = true) => <div className="field-error" id={`${field}-error`} role="alert" hidden={!errors[field] || !visible}>{errors[field] || ""}</div>;
  const suggestion = emailSuggestion(form.email);

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
          <h3 className="process-card-header">Lấy lại mật khẩu trong ba bước</h3>
          <ol className="process-steps">
            <li className="process-step-item">
              <span className="step-number">01</span>
              <div className="step-text"><h4>Nhập email</h4><p>Email bạn đã dùng để đăng ký tài khoản.</p></div>
            </li>
            <li className="process-step-item">
              <span className="step-number">02</span>
              <div className="step-text"><h4>Xác thực mã OTP</h4><p>Mã gửi qua email, dùng một lần trong 5 phút.</p></div>
            </li>
            <li className="process-step-item">
              <span className="step-number">03</span>
              <div className="step-text"><h4>Đặt mật khẩu mới</h4><p>Mọi thiết bị đang đăng nhập sẽ bị đăng xuất.</p></div>
            </li>
          </ol>
        </div>
        <div className="banner-footer">
          <h2 className="banner-heading">Lấy lại mật khẩu<br />bằng email</h2>
          <p className="banner-subheading">Phiếu sửa chữa, báo giá và lịch sử bảo hành của bạn vẫn được giữ nguyên.</p>
        </div>
      </aside>

      <main className="auth-form-panel">
        <div className="tab-switcher-wrapper">
          <nav className="tab-switcher" aria-label="Đăng nhập hoặc đăng ký">
            <a href="/login" className="tab-btn">Đăng nhập</a>
            <a href="/register" className="tab-btn">Đăng ký</a>
          </nav>
        </div>

        <div className="form-content">
          {step === "done" ? (
            <div className="form-header">
              <h1>Đã đặt lại mật khẩu</h1>
              <div className="kh-alert kh-alert--success" role="status">
                Mật khẩu mới đã có hiệu lực. Các phiên đăng nhập cũ trên mọi thiết bị đã bị đăng xuất.
              </div>
              <a href="/login" className="btn-submit">Đăng nhập với mật khẩu mới</a>
            </div>
          ) : step === "password" ? (
            <>
              <div className="form-header">
                <h1>Đặt mật khẩu mới</h1>
                <p>Mã OTP đã được xác nhận cho email {otpSentTo}. <button type="button" className="link-button" onClick={changeEmail}>Đổi email</button></p>
              </div>
              {summary && <div className="validation-summary-errors" role="alert">{summary}</div>}

              <form onSubmit={submit} noValidate={true}>
                <div className="form-group">
                  <label htmlFor="password">Mật khẩu mới</label>
                  <PasswordInput id="password" name="password" autoComplete="new-password" placeholder="Tối thiểu 10 ký tự, gồm chữ và số"
                    value={form.password} onChange={set("password")} invalid={invalid("password")} describedBy="password-rules password-error" />
                  <ul className="password-rules" id="password-rules" aria-label="Điều kiện mật khẩu" hidden={!form.password}>
                    {passwordRules(form.password, "").slice(0, 3).map((rule) => <li key={rule.label} className={rule.ok ? "is-ok" : ""}>
                      <span aria-hidden="true">{rule.ok ? "✓" : "•"}</span>{rule.label}
                    </li>)}
                  </ul>
                  {fieldError("password", !form.password)}
                </div>

                <div className="form-group">
                  <label htmlFor="confirm">Xác nhận mật khẩu mới</label>
                  <PasswordInput id="confirm" name="confirm" autoComplete="new-password" placeholder="Nhập lại mật khẩu mới"
                    value={form.confirm} onChange={set("confirm")} invalid={invalid("confirm")} describedBy="confirm-error" />
                  {fieldError("confirm")}
                </div>

                <button type="submit" className="btn-submit" disabled={submitting}>
                  {submitting ? "Đang đặt lại…" : "Đặt lại mật khẩu"}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="form-header">
                <h1>Quên mật khẩu</h1>
                <p>Nhận mã OTP qua email đã đăng ký và xác nhận mã để đặt mật khẩu mới.</p>
              </div>
              {summary && <div className="validation-summary-errors" role="alert">{summary}</div>}

              <form onSubmit={verify} noValidate={true}>
                <div className="form-group">
                  <label htmlFor="email">Email đã đăng ký</label>
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
                    {otpSentTo
                      ? <>Mã OTP đã gửi tới <strong>{otpSentTo}</strong>. Không thấy thư? Xem cả mục Spam. Gõ nhầm email? Sửa lại là gửi được mã mới ngay.</>
                      : "Email đã xác minh khi đăng ký tài khoản."}
                  </div>
                  {fieldError("email")}
                  {suggestion && !errors.email && <div className="field-warning" role="status">
                    Có phải bạn muốn nhập <strong>{suggestion}</strong>?{" "}
                    <button type="button" className="field-warning-fix" onClick={() => set("email")(suggestion)}>Sửa thành {suggestion.slice(suggestion.indexOf("@"))}</button>
                  </div>}
                </div>

                <div className="form-group">
                  <label htmlFor="otp">Mã OTP</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Icon glyph="shield" /></span>
                    <input type="text" id="otp" className="form-input" inputMode="numeric" autoComplete="one-time-code" placeholder="Nhập mã gồm 6 chữ số" maxLength={6}
                      value={form.otp} onChange={(e) => set("otp")(e.target.value)} aria-invalid={invalid("otp")} aria-describedby="otp-error" />
                  </div>
                  {fieldError("otp")}
                </div>

                <button type="submit" className="btn-submit" disabled={verifying}>
                  {verifying ? "Đang xác nhận…" : "Xác nhận mã"}
                </button>
              </form>
            </>
          )}

          <div className="form-switch-text">
            Nhớ ra mật khẩu? <a href="/login">Quay lại đăng nhập</a>
          </div>
        </div>

        <p className="form-footer-note">Nhân viên quên mật khẩu: liên hệ quản trị viên để được đặt lại.</p>
      </main>
    </div>
  );
}
