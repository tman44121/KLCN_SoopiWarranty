import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { usePage } from "../usePage";
import controller from "../behaviors/admin.js";
import { BrandLogo } from "../customer";

export default function AdminPage() {
  usePage("admin", {"data-roles": "ADMIN"}, "Soopi — Quản trị viên", controller);
  return (<>
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Điều hướng chính">
        <div className="sidebar-brand">
          <div className="sidebar-brand__logo">
            <BrandLogo />
          </div>
          <div className="sidebar-brand__system">
            {"Hệ thống quản lý bảo hành & sửa chữa nội bộ"}
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-nav__group">
            <div className="sidebar-nav__group-title">
              {"Quản trị"}
            </div>
            <a className="sidebar-nav__item is-active" data-roles="ADMIN" data-page-tab="accounts" href="#accounts">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="10" cy="7" r="3">
                </circle>
                <path d="M4 17c0-3 2.7-5 6-5s6 2 6 5">
                </path>
              </svg>
              {"\n          Tài khoản & Phân quyền\n        "}
            </a>
            <a className="sidebar-nav__item" data-roles="ADMIN" data-page-tab="catalogs" href="#catalogs">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="4" width="14" height="4" rx="1">
                </rect>
                <rect x="3" y="10" width="14" height="6" rx="1">
                </rect>
              </svg>
              {"\n          Danh mục hệ thống\n        "}
            </a>
            <a className="sidebar-nav__item" data-roles="ADMIN" data-page-tab="reports" href="#reports">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 16V9M10 16V4M16 16v-6">
                </path>
              </svg>
              {"\n          Báo cáo & Thống kê\n        "}
            </a>
          </div>
        </nav>
      </aside>
      <header className="app-header">
        <div className="header-search">
          <svg className="header-search__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="9" cy="9" r="6">
            </circle>
            <path d="M17 17l-4-4">
            </path>
          </svg>
          <input type="text" placeholder="Tìm theo số Serial/IMEI, Mã phiếu TN, SĐT..." data-global-search="" aria-label="Tìm kiếm toàn hệ thống" autoComplete="off" />
          <span className="header-search__shortcut">
            {"Ctrl K"}
          </span>
          <div className="header-search__results" data-global-search-results="" hidden={true}>
          </div>
        </div>
        <span className="status-badge status-badge--success">
          <span className="status-badge__dot">
            {"●"}
          </span>
          {"Trạm HCM đang hoạt động\n    "}
        </span>
        <div className="header-spacer">
        </div>
        <div className="header-right">
          <button type="button" className="icon-button" data-notification-bell="" aria-haspopup="true" aria-expanded="false" aria-label="Thông báo">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M5 8a5 5 0 0110 0c0 4 1.5 5 1.5 5h-13S5 12 5 8z">
              </path>
              <path d="M8.5 16a1.5 1.5 0 003 0">
              </path>
            </svg>
            <span className="icon-button__dot" aria-hidden="true">
            </span>
          </button>
          <div className="header-search__results notification-popover" data-notification-popover="" hidden={true}>
          </div>
          <button type="button" className="icon-button" data-logout-btn="" aria-label="Đăng xuất">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 4H5a1 1 0 00-1 1v10a1 1 0 001 1h3">
              </path>
              <path d="M13 14l4-4-4-4">
              </path>
              <path d="M17 10H8">
              </path>
            </svg>
          </button>
          <div className="header-user">
            <span className="header-user__name">
              {"Ngô Bảo Châu"}
            </span>
            <span className="header-user__role">
              {"Quản trị viên"}
            </span>
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">
              {"Quản trị hệ thống"}
            </h1>
            <div className="page-subtitle">
              {"Quản lý tài khoản, danh mục dùng chung và báo cáo vận hành toàn hệ thống"}
            </div>
          </div>
        </div>
        <div data-page-panel="accounts">
          <section className="card" aria-labelledby="accounts-title">
            <div className="card__header">
              <div>
                <h2 className="card__title" id="accounts-title">
                  {"Tài khoản & phân quyền"}
                </h2>
                <div className="card__title-meta">
                  {"Danh sách nhân viên và vai trò được gán trong hệ thống"}
                </div>
              </div>
              <button type="button" className="btn btn--primary btn--sm" data-open-add-employee="">
                {"+ Thêm nhân viên"}
              </button>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      {"Mã NV"}
                    </th>
                    <th>
                      {"Họ tên"}
                    </th>
                    <th>
                      {"Vai trò"}
                    </th>
                    <th>
                      {"Trạng thái"}
                    </th>
                    <th>
                      {"Lần đăng nhập gần nhất"}
                    </th>
                    <th>
                      {"Thao tác"}
                    </th>
                  </tr>
                </thead>
                <tbody data-employee-tbody="">
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div data-page-panel="catalogs" hidden={true}>
          <section className="card" aria-labelledby="catalogs-title">
            <div className="card__header">
              <div>
                <h2 className="card__title" id="catalogs-title">
                  {"Danh mục hệ thống"}
                </h2>
                <div className="card__title-meta">
                  {"Dùng chung cho Tiếp nhận, báo giá của kỹ thuật viên, Kho vật tư và việc xác định bảo hành khi tiếp nhận máy"}
                </div>
              </div>
            </div>
            <div className="section-divider">
            </div>
            <div className="section-head">
              <h3 className="card__title card__title--sm">
                {"Nhóm & loại thiết bị"}
              </h3>
              <button type="button" className="btn btn--secondary btn--sm" data-open-add-category="">
                {"+ Thêm nhóm thiết bị"}
              </button>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      {"Nhóm thiết bị"}
                    </th>
                    <th>
                      {"Loại thiết bị"}
                    </th>
                    <th>
                      {"Định danh"}
                    </th>
                  </tr>
                </thead>
                <tbody data-category-tbody="">
                </tbody>
              </table>
            </div>
            <div className="section-divider">
            </div>
            <div className="section-head">
              <h3 className="card__title card__title--sm">
                {"Hãng & model"}
              </h3>
              <button type="button" className="btn btn--secondary btn--sm" data-open-add-brand="">
                {"+ Thêm hãng"}
              </button>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      {"Hãng"}
                    </th>
                    <th>
                      {"Áp dụng nhóm thiết bị"}
                    </th>
                    <th>
                      {"Model"}
                    </th>
                  </tr>
                </thead>
                <tbody data-brand-tbody="">
                </tbody>
              </table>
            </div>
            <div className="section-divider">
            </div>
            <div className="section-head">
              <h3 className="card__title card__title--sm">
                {"Linh kiện (SKU)"}
              </h3>
              <button type="button" className="btn btn--secondary btn--sm" data-open-add-sku="">
                {"+ Thêm linh kiện"}
              </button>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      {"SKU"}
                    </th>
                    <th>
                      {"Tên linh kiện"}
                    </th>
                    <th>
                      {"Nhóm thiết bị"}
                    </th>
                    <th>
                      {"Hãng"}
                    </th>
                    <th>
                      {"Giá tính khách"}
                    </th>
                  </tr>
                </thead>
                <tbody data-sku-tbody="">
                </tbody>
              </table>
            </div>
            <div className="section-divider">
            </div>
            <div className="section-head">
              <h3 className="card__title card__title--sm">
                {"Bảng giá dịch vụ sửa chữa"}
              </h3>
              <button type="button" className="btn btn--secondary btn--sm" data-open-add-service="">
                {"+ Thêm dịch vụ"}
              </button>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      {"Mã dịch vụ"}
                    </th>
                    <th>
                      {"Tên dịch vụ"}
                    </th>
                    <th>
                      {"Áp dụng nhóm thiết bị"}
                    </th>
                    <th>
                      {"Giá công"}
                    </th>
                  </tr>
                </thead>
                <tbody data-service-tbody="">
                </tbody>
              </table>
            </div>
            <div className="section-divider">
            </div>
            <div className="section-head">
              <div>
                <h3 className="card__title card__title--sm">
                  {"Chính sách bảo hành"}
                </h3>
                <div className="card__title-meta">
                  {"Khi tiếp nhận, hệ thống dùng chính sách riêng của model nếu có, không thì dùng chính sách của hãng"}
                </div>
              </div>
              <button type="button" className="btn btn--secondary btn--sm" data-open-add-policy="">
                {"+ Thêm chính sách theo hãng"}
              </button>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      {"Áp dụng cho"}
                    </th>
                    <th>
                      {"Thời hạn"}
                    </th>
                    <th>
                      {"Điều kiện"}
                    </th>
                    <th>
                      {"Nhà phân phối"}
                    </th>
                  </tr>
                </thead>
                <tbody data-warranty-policy-tbody="">
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div data-page-panel="reports" hidden={true}>
          <section className="card" aria-labelledby="reports-title">
            <div className="card__header">
              <div>
                <h2 className="card__title" id="reports-title">
                  {"Báo cáo & thống kê"}
                </h2>
                <div className="card__title-meta">
                  {"Chỉ dùng cho quyết định vận hành — lọc theo khoảng thời gian và trạm dịch vụ"}
                </div>
              </div>
            </div>
            <div className="toolbar">
              <div className="toolbar__field">
                <label htmlFor="admin-range">
                  {"Khoảng thời gian"}
                </label>
                <select defaultValue="last12" id="admin-range" className="select-field" data-admin-range="">
                  <option value="last12">
                    {"12 tháng gần nhất"}
                  </option>
                  <option value="year">
                    {"Năm nay"}
                  </option>
                  <option value="quarter">
                    {"Quý này"}
                  </option>
                  <option value="month">
                    {"Tháng này"}
                  </option>
                </select>
              </div>
              <div className="toolbar__field">
                <label htmlFor="admin-station">
                  {"Trạm dịch vụ"}
                </label>
                <select id="admin-station" className="select-field" data-admin-station="">
                  <option value="">
                    {"Tất cả trạm"}
                  </option>
                </select>
              </div>
              <div className="toolbar__spacer">
              </div>
              <span className="toolbar__count" data-report-period="">
              </span>
            </div>
            <div className="report-body" data-report-body="" aria-live="polite" aria-busy="true">
              <div className="stat-row" data-report-stats="">
              </div>
              <div className="report-grid">
                <section className="report-panel report-panel--wide" aria-labelledby="report-revenue-title">
                  <h3 className="report-panel__title" id="report-revenue-title">
                    {"Doanh thu theo tháng"}
                  </h3>
                  <p className="report-panel__meta">
                    {"Tổng tiền đã thu trong tháng, gồm mọi phiếu thu của trạm được chọn"}
                  </p>
                  <div data-revenue-chart="">
                  </div>
                </section>
                <section className="report-panel" aria-labelledby="report-status-title">
                  <h3 className="report-panel__title" id="report-status-title">
                    {"Số phiếu theo trạng thái"}
                  </h3>
                  <p className="report-panel__meta">
                    {"Phiếu tiếp nhận trong khoảng thời gian, xếp theo thứ tự quy trình"}
                  </p>
                  <div data-status-chart="">
                  </div>
                </section>
                <section className="report-panel" aria-labelledby="report-turnaround-title">
                  <h3 className="report-panel__title" id="report-turnaround-title">
                    {"Thời gian xử lý trung bình theo nhóm thiết bị"}
                  </h3>
                  <p className="report-panel__meta">
                    {"Từ lúc tiếp nhận tới lúc bàn giao, tính trên máy đã bàn giao"}
                  </p>
                  <div data-turnaround-chart="">
                  </div>
                </section>
                <section className="report-panel" aria-labelledby="report-technician-title">
                  <h3 className="report-panel__title" id="report-technician-title">
                    {"Phiếu hoàn tất theo kỹ thuật viên"}
                  </h3>
                  <p className="report-panel__meta">
                    {"Số phiếu sửa chữa đã hoàn tất; chi tiết ở bảng hiệu suất bên dưới"}
                  </p>
                  <div data-technician-chart="">
                  </div>
                </section>
                <section className="report-panel" aria-labelledby="report-warranty-title">
                  <h3 className="report-panel__title" id="report-warranty-title">
                    {"Tỷ lệ trong bảo hành / ngoài bảo hành"}
                  </h3>
                  <p className="report-panel__meta">
                    {"Theo kết quả phân loại lúc chẩn đoán"}
                  </p>
                  <div data-warranty-ratio-chart="">
                  </div>
                </section>
              </div>
              <section aria-labelledby="report-performance-title">
                <h3 className="report-panel__title" id="report-performance-title">
                  {"Hiệu suất từng kỹ thuật viên"}
                </h3>
                <p className="report-panel__meta">
                  {"Trong khoảng thời gian và trạm đã chọn"}
                </p>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>
                          {"Kỹ thuật viên"}
                        </th>
                        <th>
                          {"Được giao"}
                        </th>
                        <th>
                          {"Hoàn tất"}
                        </th>
                        <th>
                          {"Thời gian sửa TB"}
                        </th>
                        <th>
                          {"Tỷ lệ QC đạt lần đầu"}
                        </th>
                      </tr>
                    </thead>
                    <tbody data-techperf-tbody="">
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </section>
        </div>
      </main>
    </div>
    <div className="drawer-overlay" data-add-employee-drawer="" hidden={true}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="add-employee-title">
        <div className="drawer__header">
          <div>
            <div className="drawer__title" id="add-employee-title">
              {"Thêm nhân viên"}
            </div>
            <div className="drawer__subtitle">
              {"Tạo tài khoản mới và gán vai trò truy cập hệ thống"}
            </div>
          </div>
          <button type="button" className="modal__close" data-add-employee-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="drawer__body">
          <div className="form-field">
            <label htmlFor="add-emp-name">
              {"Họ và tên"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <input type="text" id="add-emp-name" data-add-emp-name="" />
            <span className="form-field__error" data-add-emp-name-error="" hidden={true}>
              {"Vui lòng nhập họ tên nhân viên."}
            </span>
          </div>
          <div className="form-field">
            <label htmlFor="add-emp-username">
              {"Tên đăng nhập"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <input type="text" id="add-emp-username" data-add-emp-username="" />
            <span className="form-field__error" data-add-emp-username-error="" hidden={true}>
              {"Tên đăng nhập đã tồn tại hoặc còn trống."}
            </span>
          </div>
          <div className="form-field">
            <label htmlFor="add-emp-phone">
              {"Số điện thoại"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <input type="tel" id="add-emp-phone" data-add-emp-phone="" />
            <span className="form-field__error" data-add-emp-phone-error="" hidden={true}>
              {"Vui lòng nhập số điện thoại hợp lệ."}
            </span>
          </div>
          <div className="form-field">
            <label>
              {"Vai trò"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <div data-add-emp-roles="">
            </div>
            <span className="form-field__error" data-add-emp-roles-error="" hidden={true}>
              {"Vui lòng chọn ít nhất một vai trò."}
            </span>
          </div>
        </div>
        <div className="drawer__footer">
          <button type="button" className="btn btn--secondary" data-add-employee-cancel="">
            {"Hủy"}
          </button>
          <button type="button" className="btn btn--primary" data-add-employee-submit="">
            {"Thêm nhân viên"}
          </button>
        </div>
      </div>
    </div>
    <div className="modal-overlay" data-edit-roles-modal="" hidden={true} role="dialog" aria-modal="true" aria-labelledby="edit-roles-title">
      <div className="modal">
        <div className="modal__header">
          <div>
            <div className="modal__title" id="edit-roles-title">
              {"Sửa vai trò"}
            </div>
            <div className="modal__subtitle" data-edit-roles-subtitle="">
              {"—"}
            </div>
          </div>
          <button type="button" className="modal__close" data-edit-roles-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="modal__body">
          <div data-edit-roles-list="">
          </div>
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--secondary" data-edit-roles-cancel="">
            {"Hủy"}
          </button>
          <button type="button" className="btn btn--primary" data-edit-roles-save="">
            {"Cập nhật vai trò"}
          </button>
        </div>
      </div>
    </div>
    <div className="drawer-overlay" data-add-category-drawer="" hidden={true}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="add-category-title">
        <div className="drawer__header">
          <div>
            <div className="drawer__title" id="add-category-title">
              {"Thêm nhóm thiết bị"}
            </div>
            <div className="drawer__subtitle">
              {"Bổ sung nhóm thiết bị mới vào danh mục dùng chung"}
            </div>
          </div>
          <button type="button" className="modal__close" data-add-category-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="drawer__body">
          <div className="form-field">
            <label htmlFor="add-cat-name">
              {"Tên nhóm thiết bị"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <input type="text" id="add-cat-name" data-add-cat-name="" placeholder="VD: Thiết bị nhà thông minh" />
            <span className="form-field__error" data-add-cat-name-error="" hidden={true}>
              {"Vui lòng nhập tên nhóm thiết bị."}
            </span>
          </div>
        </div>
        <div className="drawer__footer">
          <button type="button" className="btn btn--secondary" data-add-category-cancel="">
            {"Hủy"}
          </button>
          <button type="button" className="btn btn--primary" data-add-category-submit="">
            {"Thêm nhóm thiết bị"}
          </button>
        </div>
      </div>
    </div>
    <div className="drawer-overlay" data-add-brand-drawer="" hidden={true}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="add-brand-title">
        <div className="drawer__header">
          <div>
            <div className="drawer__title" id="add-brand-title">
              {"Thêm hãng"}
            </div>
            <div className="drawer__subtitle">
              {"Bổ sung hãng mới vào danh mục Hãng & model"}
            </div>
          </div>
          <button type="button" className="modal__close" data-add-brand-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="drawer__body">
          <div className="form-field">
            <label htmlFor="add-brand-name">
              {"Tên hãng"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <input type="text" id="add-brand-name" data-add-brand-name="" placeholder="VD: Xiaomi" />
            <span className="form-field__error" data-add-brand-name-error="" hidden={true}>
              {"Vui lòng nhập tên hãng."}
            </span>
          </div>
          <div className="form-field">
            <label>
              {"Áp dụng nhóm thiết bị"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <div data-add-brand-categories="">
            </div>
            <span className="form-field__error" data-add-brand-categories-error="" hidden={true}>
              {"Vui lòng chọn ít nhất một nhóm thiết bị."}
            </span>
          </div>
          <div className="form-field">
            <label htmlFor="add-brand-models">
              {"Số model (tuỳ chọn)"}
            </label>
            <input type="number" id="add-brand-models" data-add-brand-models="" min="0" step="1" placeholder="0" />
          </div>
        </div>
        <div className="drawer__footer">
          <button type="button" className="btn btn--secondary" data-add-brand-cancel="">
            {"Hủy"}
          </button>
          <button type="button" className="btn btn--primary" data-add-brand-submit="">
            {"Thêm hãng"}
          </button>
        </div>
      </div>
    </div>
    <div className="drawer-overlay" data-add-sku-drawer="" hidden={true}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="add-sku-title">
        <div className="drawer__header">
          <div>
            <div className="drawer__title" id="add-sku-title">
              {"Thêm linh kiện (SKU)"}
            </div>
            <div className="drawer__subtitle">
              {"Bổ sung linh kiện mới vào danh mục — tồn kho ban đầu là 0"}
            </div>
          </div>
          <button type="button" className="modal__close" data-add-sku-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="drawer__body">
          <div className="form-field">
            <label htmlFor="add-sku-code">
              {"SKU"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <input type="text" id="add-sku-code" className="mono" data-add-sku-code="" placeholder="VD: LK-DISP-AMOLED" />
            <span className="form-field__error" data-add-sku-code-error="" hidden={true}>
              {"Vui lòng nhập mã SKU (không được trùng)."}
            </span>
          </div>
          <div className="form-field">
            <label htmlFor="add-sku-name">
              {"Tên linh kiện"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <input type="text" id="add-sku-name" data-add-sku-name="" />
            <span className="form-field__error" data-add-sku-name-error="" hidden={true}>
              {"Vui lòng nhập tên linh kiện."}
            </span>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="add-sku-category">
                {"Nhóm thiết bị"}
                <span className="required-mark">
                  {"*"}
                </span>
              </label>
              <select id="add-sku-category" data-add-sku-category="">
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="add-sku-brand">
                {"Hãng"}
                <span className="required-mark">
                  {"*"}
                </span>
              </label>
              <input type="text" id="add-sku-brand" data-add-sku-brand="" placeholder="VD: Samsung" />
              <span className="form-field__error" data-add-sku-brand-error="" hidden={true}>
                {"Vui lòng nhập hãng."}
              </span>
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="add-sku-price">
                {"Giá tính khách (VNĐ)"}
                <span className="required-mark">
                  {"*"}
                </span>
              </label>
              <input type="number" id="add-sku-price" data-add-sku-price="" min="0" step="1000" />
              <span className="form-field__error" data-add-sku-price-error="" hidden={true}>
                {"Vui lòng nhập đơn giá hợp lệ."}
              </span>
            </div>
            <div className="form-field">
              <label htmlFor="add-sku-bin">
                {"Kệ/Ngăn (tuỳ chọn)"}
              </label>
              <input type="text" id="add-sku-bin" className="mono" data-add-sku-bin="" placeholder="VD: KHO-A-05-01" />
            </div>
          </div>
        </div>
        <div className="drawer__footer">
          <button type="button" className="btn btn--secondary" data-add-sku-cancel="">
            {"Hủy"}
          </button>
          <button type="button" className="btn btn--primary" data-add-sku-submit="">
            {"Thêm linh kiện"}
          </button>
        </div>
      </div>
    </div>
    <div className="drawer-overlay" data-add-policy-drawer="" hidden={true}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="add-policy-title">
        <div className="drawer__header">
          <div>
            <div className="drawer__title" id="add-policy-title">
              {"Thêm chính sách theo hãng"}
            </div>
            <div className="drawer__subtitle">
              {"Áp dụng cho mọi model của hãng chưa có chính sách riêng"}
            </div>
          </div>
          <button type="button" className="modal__close" data-add-policy-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="drawer__body">
          <div className="form-field">
            <label htmlFor="add-policy-brand">
              {"Hãng"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <input type="text" id="add-policy-brand" data-add-policy-brand="" placeholder="VD: Xiaomi" />
            <span className="form-field__error" data-add-policy-brand-error="" hidden={true}>
              {"Vui lòng nhập tên hãng."}
            </span>
          </div>
          <div className="form-field">
            <label htmlFor="add-policy-months">
              {"Thời hạn (tháng)"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <input type="number" id="add-policy-months" data-add-policy-months="" min="1" step="1" />
            <span className="form-field__error" data-add-policy-months-error="" hidden={true}>
              {"Vui lòng nhập thời hạn bảo hành hợp lệ."}
            </span>
          </div>
          <div className="form-field">
            <label htmlFor="add-policy-note">
              {"Điều kiện"}
            </label>
            <textarea id="add-policy-note" data-add-policy-note="" placeholder="VD: Không bảo hành lỗi rơi vỡ/vào nước…">
            </textarea>
          </div>
        </div>
        <div className="drawer__footer">
          <button type="button" className="btn btn--secondary" data-add-policy-cancel="">
            {"Hủy"}
          </button>
          <button type="button" className="btn btn--primary" data-add-policy-submit="">
            {"Thêm chính sách"}
          </button>
        </div>
      </div>
    </div>
    <div className="drawer-overlay" data-add-service-drawer="" hidden={true}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="add-service-title">
        <div className="drawer__header">
          <div>
            <div className="drawer__title" id="add-service-title">
              {"Thêm dịch vụ sửa chữa"}
            </div>
            <div className="drawer__subtitle">
              {"Bổ sung dòng giá mới vào bảng giá dịch vụ dùng chung"}
            </div>
          </div>
          <button type="button" className="modal__close" data-add-service-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="drawer__body">
          <div className="form-field">
            <label htmlFor="add-svc-name">
              {"Tên dịch vụ"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <input type="text" id="add-svc-name" data-add-svc-name="" placeholder="VD: Công sửa chữa — Điện thoại" />
            <span className="form-field__error" data-add-svc-name-error="" hidden={true}>
              {"Vui lòng nhập tên dịch vụ."}
            </span>
          </div>
          <div className="form-field">
            <label htmlFor="add-svc-category">
              {"Áp dụng nhóm thiết bị"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <select id="add-svc-category" data-add-svc-category="">
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="add-svc-price">
              {"Đơn giá (VNĐ)"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <input type="number" id="add-svc-price" data-add-svc-price="" min="0" step="1000" />
            <span className="form-field__error" data-add-svc-price-error="" hidden={true}>
              {"Vui lòng nhập đơn giá hợp lệ."}
            </span>
          </div>
        </div>
        <div className="drawer__footer">
          <button type="button" className="btn btn--secondary" data-add-service-cancel="">
            {"Hủy"}
          </button>
          <button type="button" className="btn btn--primary" data-add-service-submit="">
            {"Thêm dịch vụ"}
          </button>
        </div>
      </div>
    </div>
    <div className="modal-overlay" data-confirm-modal="" hidden={true} role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="modal modal--critical">
        <div className="modal__header">
          <div>
            <div className="modal__title" id="confirm-modal-title" data-confirm-title="">
              {"—"}
            </div>
            <div className="modal__subtitle" data-confirm-desc="">
              {"—"}
            </div>
          </div>
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--secondary" data-confirm-cancel="">
            {"Hủy"}
          </button>
          <button type="button" className="btn btn--destructive" data-confirm-ok="">
            {"—"}
          </button>
        </div>
      </div>
    </div>
  </>);
}
