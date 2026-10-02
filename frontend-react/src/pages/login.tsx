import { usePage } from "../usePage";
import controller from "../behaviors/login.js";
import { BrandLogo, Icon, PasswordInput, STEP_LABELS, useAuthScale } from "../customer";

/* Giao diện đăng nhập của web khách KLCN; id/name và data-* giữ nguyên vì login.js (nhân viên + khách) gắn vào đó. */
export default function LoginPage() {
  usePage("login", {}, "Đăng nhập — Soopi", controller);
  const scaled = useAuthScale();
  return (
    <div className="kh-app kh-auth" ref={scaled}>
      <aside className="auth-banner">
        <div className="banner-header">
          <a href="/portal" className="banner-logo">
            <BrandLogo light={true} />
          </a>
          <a href="/portal" className="banner-home-link"><Icon glyph="search" />Tra cứu không cần đăng nhập</a>
        </div>
        <figure className="banner-ticket" aria-label="Minh họa tiến độ phiếu sửa chữa">
          <div className="banner-ticket-head">
            <div>
              <div className="banner-ticket-device">Phiếu sửa chữa của bạn</div>
              <div className="banner-ticket-code">Cập nhật theo từng bước</div>
            </div>
            <span className="badge badge-processing">Đang sửa</span>
          </div>
          <ol className="banner-steps">
            {STEP_LABELS.map((label, index) => (
              <li key={label} className={index < 3 ? "is-done" : index === 3 ? "is-current" : ""}>{label}</li>
            ))}
          </ol>
        </figure>
        <div className="banner-footer">
          <h2 className="banner-heading">Quản lý bảo hành thiết bị<br />dễ dàng hơn bao giờ hết</h2>
          <p className="banner-subheading">Theo dõi tiến độ sửa chữa, xác nhận báo giá và gửi yêu cầu bảo hành ngay trên tài khoản của bạn.</p>
        </div>
      </aside>

      <main className="auth-form-panel">
        <div className="tab-switcher-wrapper">
          <nav className="tab-switcher" aria-label="Đăng nhập hoặc đăng ký">
            <a href="/login" className="tab-btn active" aria-current="page">Đăng nhập</a>
            <a href="/register" className="tab-btn">Đăng ký</a>
          </nav>
        </div>

        <div className="form-content">
          <form data-login-form="" noValidate={true}>
            <div className="form-header">
              <h1>Đăng nhập tài khoản</h1>
            </div>
            <div className="validation-summary-errors" data-login-error="" role="alert" hidden={true}>
            </div>
            <div className="form-group">
              <label htmlFor="login-username">Số điện thoại / Tên đăng nhập</label>
              <div className="input-wrapper">
                <span className="input-icon"><Icon glyph="user" /></span>
                <input type="text" id="login-username" name="username" className="form-input" autoComplete="username" placeholder="09xxxxxxxx" />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Mật khẩu</label>
              <PasswordInput id="login-password" name="password" autoComplete="current-password" placeholder="Nhập mật khẩu của bạn" />
            </div>
            <div className="form-meta">
              <label className="checkbox-label">
                <input type="checkbox" id="login-remember" name="remember" />
                Ghi nhớ đăng nhập
              </label>
              <a href="/forgot-password" className="forgot-link">Quên mật khẩu?</a>
            </div>
            <button type="submit" className="btn-submit">Đăng nhập</button>
            <div className="form-switch-text">
              Chưa có tài khoản bảo hành? <a href="/register">Đăng ký ngay</a>
            </div>
          </form>

          <div className="role-choice-list" data-role-choice-list="" hidden={true}>
            <div className="form-header">
              <h1>Chọn vai trò</h1>
              <p>Tài khoản này được gán nhiều vai trò — bắt đầu với vai trò nào?</p>
            </div>
          </div>

          <form data-change-password-form="" noValidate={true} hidden={true}>
            <div className="form-header">
              <h1>Đổi mật khẩu</h1>
              <p>Cần đổi mật khẩu trước khi tiếp tục.</p>
            </div>
            <div className="validation-summary-errors" data-change-password-error="" role="alert" hidden={true}>
            </div>
            <div className="form-group">
              <label htmlFor="current-password">Mật khẩu hiện tại</label>
              <PasswordInput id="current-password" name="currentPassword" autoComplete="current-password" />
            </div>
            <div className="form-group">
              <label htmlFor="new-password">Mật khẩu mới</label>
              <PasswordInput id="new-password" name="newPassword" autoComplete="new-password" />
              <div className="input-subnote">Tối thiểu 10 ký tự, gồm chữ và số, không chứa tên đăng nhập.</div>
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">Nhập lại mật khẩu mới</label>
              <PasswordInput id="confirm-password" name="confirmPassword" autoComplete="new-password" />
            </div>
            <button type="submit" className="btn-submit">Đổi mật khẩu</button>
          </form>
        </div>

        <p className="form-footer-note">Soopi — hệ thống bảo hành &amp; sửa chữa.</p>
      </main>
    </div>
  );
}
