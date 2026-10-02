import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { usePage } from "../usePage";

export default function LoginPage() {
  usePage("login", {"class": "is-fluid"}, "Đăng nhập — Soopi");
  return (<>
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <div className="auth-card__brand-name">
            {"Soopi"}
          </div>
          <div className="auth-card__brand-sub">
            {"Service Center — Hệ thống quản lý bảo hành & sửa chữa nội bộ"}
          </div>
        </div>
        <form className="auth-card__form" data-login-form="" noValidate={true}>
          <div className="auth-card__error" data-login-error="" hidden={true}>
          </div>
          <div className="form-field">
            <label htmlFor="login-username">
              {"Tên đăng nhập / Mã nhân viên"}
            </label>
            <input type="text" id="login-username" name="username" autoComplete="username" />
          </div>
          <div className="form-field">
            <label htmlFor="login-password">
              {"Mật khẩu"}
            </label>
            <input type="password" id="login-password" name="password" autoComplete="current-password" />
          </div>
          <div className="checkbox-row" style={{"padding": "0"} as CSSProperties}>
            <input type="checkbox" id="login-remember" name="remember" />
            <label htmlFor="login-remember">
              {"Ghi nhớ đăng nhập"}
            </label>
          </div>
          <button type="submit" className="btn btn--primary" style={{"width": "100%", "justifyContent": "center"} as CSSProperties}>
            {"Đăng nhập"}
          </button>
          <div className="auth-card__hint">
            {"\n        Khách hàng tra cứu tiến độ sửa chữa tại "}
            <Link to="/portal" reloadDocument className="link">
              {"Cổng khách hàng"}
            </Link>
            {".\n      "}
          </div>
        </form>
        <div className="role-choice-list" data-role-choice-list="" hidden={true}>
          <div className="form-field__helper">
            {"Tài khoản này được gán nhiều vai trò — bắt đầu với vai trò nào?"}
          </div>
        </div>
        <form className="auth-card__form" data-change-password-form="" noValidate={true} hidden={true}>
          <div className="form-field__helper">
            {"Cần đổi mật khẩu trước khi tiếp tục."}
          </div>
          <div className="auth-card__error" data-change-password-error="" hidden={true}>
          </div>
          <div className="form-field">
            <label htmlFor="current-password">
              {"Mật khẩu hiện tại"}
            </label>
            <input type="password" id="current-password" name="currentPassword" autoComplete="current-password" />
          </div>
          <div className="form-field">
            <label htmlFor="new-password">
              {"Mật khẩu mới"}
            </label>
            <input type="password" id="new-password" name="newPassword" autoComplete="new-password" />
            <span className="form-field__helper">
              {"Tối thiểu 10 ký tự, gồm chữ và số, không chứa tên đăng nhập."}
            </span>
          </div>
          <div className="form-field">
            <label htmlFor="confirm-password">
              {"Nhập lại mật khẩu mới"}
            </label>
            <input type="password" id="confirm-password" name="confirmPassword" autoComplete="new-password" />
          </div>
          <button type="submit" className="btn btn--primary" style={{"width": "100%", "justifyContent": "center"} as CSSProperties}>
            {"Đổi mật khẩu"}
          </button>
        </form>
      </div>
    </div>
  </>);
}
