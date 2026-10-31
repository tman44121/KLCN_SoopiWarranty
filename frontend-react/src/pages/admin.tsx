import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { usePage } from "../usePage";
import controller from "../behaviors/admin.js";
import { BrandLogo } from "../customer";
import { NotificationBroadcast } from "../NotificationBroadcast";
import { AccessStatistics } from "../AccessStatistics";

export default function AdminPage() {
  usePage("admin", {"data-roles": "ADMIN"}, "Soopi — Quản trị hệ thống", controller);
  return (<>
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Điều hướng chính">
        <div className="sidebar-brand">
          <div className="sidebar-brand__logo">
            <BrandLogo />
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
            <a className="sidebar-nav__item" data-roles="ADMIN" data-perm="CUSTOMER_ACCOUNT_MANAGE" data-page-tab="customers" href="#customers">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="7.5" cy="7" r="2.5">
                </circle>
                <path d="M2.5 16c0-2.5 2.2-4.2 5-4.2s5 1.7 5 4.2M13 5.5a2.3 2.3 0 010 4.4M15 12.2c1.6.5 2.5 1.8 2.5 3.8">
                </path>
              </svg>
              {"Tài khoản khách hàng"}
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
            <a className="sidebar-nav__item" data-roles="ADMIN" data-page-tab="notifications-broadcast" href="#notifications-broadcast">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 8a5 5 0 0 1 10 0c0 5 2 6 2 6H3s2-1 2-6M8 17a2 2 0 0 0 4 0" />
              </svg>
              Gửi thông báo khách hàng
            </a>
            <a className="sidebar-nav__item" data-roles="ADMIN" data-page-tab="reports" href="#reports">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 16V9M10 16V4M16 16v-6">
                </path>
              </svg>
              {"\n          Báo cáo & Thống kê\n        "}
            </a>
            <a className="sidebar-nav__item" data-roles="ADMIN" data-page-tab="access" href="#access">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="10" cy="10" r="7" />
                <path d="M10 6v4l3 2" />
              </svg>
              Nhật ký đăng nhập &amp; Truy cập
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
          <input type="text" placeholder="Serial/IMEI, mã phiếu, SĐT" data-global-search="" aria-label="Tìm kiếm toàn hệ thống" autoComplete="off" />
          <span className="header-search__shortcut">
            {"Ctrl K"}
          </span>
          <div className="header-search__results" data-global-search-results="" hidden={true}>
          </div>
        </div>
        <div className="header-spacer">
        </div>
        <div className="header-right">
          <span data-chat-launcher="" />
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
                  {"Chọn nhân viên để chỉnh sửa."}
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
                  </tr>
                </thead>
                <tbody data-employee-tbody="">
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div data-page-panel="customers" hidden={true}>
          <section className="card" aria-labelledby="customers-title">
            <div className="card__header">
              <div>
                <h2 className="card__title" id="customers-title">
                  {"Tài khoản khách hàng"}
                </h2>
                <div className="card__title-meta">
                  {"Chọn khách để xem chi tiết."}
                </div>
              </div>
            </div>
            <div className="toolbar">
              <div className="toolbar__field">
                <label htmlFor="cust-filter-account">
                  {"Tài khoản"}
                </label>
                <select id="cust-filter-account" className="select-field" data-cust-filter-account="">
                  <option value="">
                    {"Tất cả"}
                  </option>
                  <option value="ACTIVE">
                    {"Đang hoạt động"}
                  </option>
                  <option value="TEMP_LOCKED">
                    {"Tạm khóa (đăng nhập sai nhiều lần)"}
                  </option>
                  <option value="LOCKED">
                    {"Đã khóa"}
                  </option>
                  <option value="NONE">
                    {"Chưa có tài khoản"}
                  </option>
                </select>
              </div>
              <div className="toolbar__field">
                <label htmlFor="cust-filter-status">
                  {"Hồ sơ"}
                </label>
                <select id="cust-filter-status" className="select-field" data-cust-filter-status="" defaultValue="ACTIVE">
                  <option value="ACTIVE">
                    {"Đang hoạt động"}
                  </option>
                  <option value="ARCHIVED">
                    {"Đã lưu trữ"}
                  </option>
                  <option value="MERGED">
                    {"Đã gộp"}
                  </option>
                  <option value="">
                    {"Tất cả"}
                  </option>
                </select>
              </div>
              <div className="toolbar__field toolbar__field--search">
                <input type="text" className="text-field" placeholder="Tìm theo tên, SĐT, mã khách…" data-cust-search="" aria-label="Tìm khách hàng" />
              </div>
              <div className="toolbar__spacer">
              </div>
              <div className="toolbar__count" data-cust-count="">
                {"—"}
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table data-table--fluid">
                <thead>
                  <tr>
                    <th>
                      {"Mã KH"}
                    </th>
                    <th>
                      {"Họ tên"}
                    </th>
                    <th>
                      {"Số điện thoại"}
                    </th>
                    <th>
                      {"Hồ sơ"}
                    </th>
                    <th>
                      {"Tài khoản"}
                    </th>
                    <th>
                      {"Đăng nhập cuối"}
                    </th>
                  </tr>
                </thead>
                <tbody data-cust-tbody="">
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <div className="pagination__rows">
                {"25 dòng / trang"}
              </div>
              <div className="pagination__nav">
                <button type="button" className="pagination__nav-btn" data-cust-prev="">
                  {"← Trước"}
                </button>
                <span data-cust-page="">
                  {"Trang 1 / 1"}
                </span>
                <button type="button" className="pagination__nav-btn" data-cust-next="">
                  {"Sau →"}
                </button>
              </div>
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
                  {"Ưu tiên chính sách theo model, sau đó theo hãng."}
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
        <div data-page-panel="notifications-broadcast" hidden={true}>
          <NotificationBroadcast />
        </div>
        <div data-page-panel="access" hidden={true}><AccessStatistics /></div>
        <div data-page-panel="reports" hidden={true}>
          <section className="card" aria-labelledby="reports-title">
            <div className="card__header">
              <div>
                <h2 className="card__title" id="reports-title">
                  {"Báo cáo & thống kê"}
                </h2>
              </div>
              <button type="button" className="btn btn--primary btn--sm" data-export-report="" data-perm="REPORT_SYSTEM" disabled>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M10 3v9m-3-3 3 3 3-3M4 12v4h12v-4" />
                </svg>
                {"Xuất Excel"}
              </button>
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
              <details className="admin-help"><summary>Cách tính báo cáo</summary><ul>
                <li>Doanh thu theo ngày thu tiền; trạng thái và hiệu suất theo ngày tiếp nhận.</li>
                <li>Thời gian xử lý: từ tiếp nhận đến bàn giao, lọc theo ngày bàn giao.</li>
                <li>Bảo hành theo kết quả và ngày phân loại.</li>
                <li>Điểm cũ thiếu nguồn/ngày không tính vào điểm trung bình của khách.</li>
              </ul></details>
              <div className="report-grid">
                <section className="report-panel report-panel--wide" aria-labelledby="report-revenue-title">
                  <h3 className="report-panel__title" id="report-revenue-title">
                    {"Doanh thu theo tháng"}
                  </h3>
                  <div data-revenue-chart="">
                  </div>
                </section>
                <section className="report-panel" aria-labelledby="report-status-title">
                  <h3 className="report-panel__title" id="report-status-title">
                    {"Số phiếu theo trạng thái"}
                  </h3>
                  <div data-status-chart="">
                  </div>
                </section>
                <section className="report-panel" aria-labelledby="report-turnaround-title">
                  <h3 className="report-panel__title" id="report-turnaround-title">
                    {"Thời gian xử lý trung bình"}
                  </h3>
                  <div data-turnaround-chart="">
                  </div>
                </section>
                <section className="report-panel" aria-labelledby="report-technician-title">
                  <h3 className="report-panel__title" id="report-technician-title">
                    {"Phiếu hoàn tất theo kỹ thuật viên"}
                  </h3>
                  <div data-technician-chart="">
                  </div>
                </section>
                <section className="report-panel" aria-labelledby="report-warranty-title">
                  <h3 className="report-panel__title" id="report-warranty-title">
                    {"Tỷ lệ bảo hành"}
                  </h3>
                  <div data-warranty-ratio-chart="">
                  </div>
                </section>
              </div>
              <section aria-labelledby="report-performance-title">
                <h3 className="report-panel__title" id="report-performance-title">
                  {"Hiệu suất từng kỹ thuật viên"}
                </h3>
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
              <section className="report-panel customer-review-report" aria-label="Đánh giá khách hàng">
                <h3 className="report-panel__title">Đánh giá khách hàng</h3>
                <div className="toolbar">
                  <label className="toolbar__field">Thời gian đánh giá
                    <select className="select-field" aria-label="Thời gian đánh giá" data-review-period="" defaultValue="all">
                      <option value="all">Tất cả thời gian, gồm dữ liệu cũ</option>
                      <option value="report">Theo khoảng thời gian báo cáo phía trên</option>
                    </select>
                  </label>
                  <label className="toolbar__field">Số sao
                    <select className="select-field" aria-label="Số sao" data-review-rating="" defaultValue="">
                      <option value="">Tất cả số sao</option>
                      {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} sao</option>)}
                    </select>
                  </label>
                  <label className="toolbar__field">Tìm đánh giá
                    <input type="search" className="text-field" aria-label="Tìm đánh giá" data-review-search="" maxLength={100} placeholder="Tên, SĐT hoặc mã phiếu" />
                  </label>
                  <label className="toolbar__field">Số dòng
                    <select className="select-field" aria-label="Số dòng" data-review-size="" defaultValue="25">
                      {[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                </div>
                <p data-review-summary="" role="status"></p>
                <div className="table-scroll">
                  <table className="data-table customer-review-table">
                    <thead><tr><th>Thời điểm</th><th>Khách hàng</th><th>Phiếu / thiết bị</th><th>Trạm</th><th>Số sao</th><th>Nhận xét</th><th>Trang chủ</th></tr></thead>
                    <tbody data-review-tbody=""></tbody>
                  </table>
                </div>
                <div className="toolbar">
                  <span className="toolbar__count" data-review-count=""></span>
                  <div className="toolbar__spacer"></div>
                  <button type="button" className="btn btn--secondary btn--sm" data-review-prev="" disabled>Trang trước</button>
                  <span data-review-page=""></span>
                  <button type="button" className="btn btn--secondary btn--sm" data-review-next="" disabled>Trang sau</button>
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
    <div className="drawer-overlay" data-cust-drawer="" hidden={true}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="cust-drawer-title">
        <div className="drawer__header">
          <div>
            <div className="drawer__title" id="cust-drawer-title" data-cust-drawer-title="">
              {"Khách hàng"}
            </div>
            <div className="drawer__subtitle" data-cust-drawer-subtitle="">
              {"—"}
            </div>
          </div>
          <button type="button" className="modal__close" data-cust-drawer-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="drawer__body" data-cust-drawer-body="">
        </div>
        <div className="drawer__footer">
          <div className="drawer-actions" data-cust-drawer-actions="">
          </div>
        </div>
      </div>
    </div>
    <div className="modal-overlay" data-cust-contact-modal="" hidden={true} role="dialog" aria-modal="true" aria-labelledby="cust-contact-title">
      <div className="modal">
        <div className="modal__header">
          <div>
            <div className="modal__title" id="cust-contact-title">
              {"Sửa liên hệ khách hàng"}
            </div>
            <div className="modal__subtitle" data-cust-contact-subtitle="">
              {"Đổi số điện thoại của khách đã có tài khoản thì tên đăng nhập đổi theo và khách bị đăng xuất."}
            </div>
          </div>
          <button type="button" className="modal__close" data-cust-contact-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="modal__body" data-cust-contact-form="">
          <div className="form-field">
            <label htmlFor="cust-contact-phone">
              {"Số điện thoại"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <input type="tel" id="cust-contact-phone" data-cust-contact-phone="" />
          </div>
          <div className="form-field">
            <label htmlFor="cust-contact-email">
              {"Email"}
            </label>
            <input type="email" id="cust-contact-email" data-cust-contact-email="" />
          </div>
          <div className="form-field">
            <label htmlFor="cust-contact-address">
              {"Địa chỉ"}
            </label>
            <input type="text" id="cust-contact-address" data-cust-contact-address="" />
          </div>
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--secondary" data-cust-contact-cancel="">
            {"Hủy"}
          </button>
          <button type="button" className="btn btn--primary" data-cust-contact-save="">
            {"Lưu liên hệ"}
          </button>
        </div>
      </div>
    </div>
    <div className="modal-overlay" data-cust-merge-modal="" hidden={true} role="dialog" aria-modal="true" aria-labelledby="cust-merge-title">
      <div className="modal">
        <div className="modal__header">
          <div>
            <div className="modal__title" id="cust-merge-title">
              {"Gộp hồ sơ khách hàng"}
            </div>
            <div className="modal__subtitle" data-cust-merge-subtitle="">
              {"—"}
            </div>
          </div>
          <button type="button" className="modal__close" data-cust-merge-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="modal__body" data-cust-merge-form="">
          <div className="form-field">
            <label htmlFor="cust-merge-target">
              {"Mã khách hàng giữ lại"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <input type="text" id="cust-merge-target" className="mono" placeholder="KH-000001" data-cust-merge-target="" />
          </div>
          <p className="cell-muted">
            {"Thiết bị và phiếu chuyển sang hồ sơ giữ lại. Nếu hồ sơ đó đã có tài khoản, tài khoản của hồ sơ này bị khóa."}
          </p>
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--secondary" data-cust-merge-cancel="">
            {"Hủy"}
          </button>
          <button type="button" className="btn btn--destructive" data-cust-merge-save="">
            {"Gộp hồ sơ"}
          </button>
        </div>
      </div>
    </div>
    <div className="modal-overlay" data-emp-modal="" hidden={true} role="dialog" aria-modal="true" aria-labelledby="emp-modal-title">
      <div className="modal">
        <div className="modal__header">
          <div>
            <div className="modal__title" id="emp-modal-title" data-emp-modal-title="">
              {"Nhân viên"}
            </div>
            <div className="modal__subtitle" data-emp-modal-subtitle="">
              {"—"}
            </div>
          </div>
          <button type="button" className="modal__close" data-emp-modal-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="modal__body" data-emp-modal-body="">
        </div>
        <div className="modal__footer" data-emp-modal-actions="">
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
