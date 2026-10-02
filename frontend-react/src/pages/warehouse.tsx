import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { usePage } from "../usePage";
import { BrandLogo } from "../customer";

export default function WarehousePage() {
  usePage("warehouse", {"data-roles": "WAREHOUSE_KEEPER"}, "Soopi — Kho vật tư");
  return (<>
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Điều hướng chính">
        <div className="sidebar-brand">
          <div className="sidebar-brand__logo" aria-label="soopiwarranty">
            <BrandLogo />
          </div>
          <div className="sidebar-brand__system">
            {"Hệ thống quản lý bảo hành & sửa chữa nội bộ"}
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-nav__group">
            <div className="sidebar-nav__group-title">
              {"Tổng quan"}
            </div>
            <Link to="/dispatch" reloadDocument className="sidebar-nav__item" data-roles="DISPATCHER">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="3" width="6" height="6" rx="1">
                </rect>
                <rect x="11" y="3" width="6" height="6" rx="1">
                </rect>
                <rect x="3" y="11" width="6" height="6" rx="1">
                </rect>
                <rect x="11" y="11" width="6" height="6" rx="1">
                </rect>
              </svg>
              {"\n          Dashboard\n        "}
            </Link>
          </div>
          <div className="sidebar-nav__group">
            <div className="sidebar-nav__group-title">
              {"Xử lý phiếu"}
            </div>
            <a className="sidebar-nav__item" data-roles="RECEPTIONIST" href="receptionist.html">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 4h12v12H4z">
                </path>
                <path d="M8 8h4M8 11h4">
                </path>
              </svg>
              {"\n          Tiếp nhận\n        "}
            </a>
            <a className="sidebar-nav__item" data-roles="DISPATCHER" href="tickets.html">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 3h5l3 3v11H6z">
                </path>
                <path d="M11 3v3h3">
                </path>
              </svg>
              {"\n          Phiếu sửa chữa\n        "}
            </a>
            <Link to="/dispatch" reloadDocument className="sidebar-nav__item" data-roles="DISPATCHER">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="10" cy="10" r="7">
                </circle>
                <path d="M10 6v4l3 2">
                </path>
              </svg>
              {"\n          Điều phối\n        "}
            </Link>
            <a className="sidebar-nav__item" data-roles="TECHNICIAN" href="technician.html">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M13 4l-1.5 1.5M4 16l6-6M9 6l5 5-1.5 3-5-5z">
                </path>
              </svg>
              {"\n          Kỹ thuật\n        "}
            </a>
          </div>
          <div className="sidebar-nav__group">
            <div className="sidebar-nav__group-title">
              {"Kho vật tư"}
            </div>
            <a className="sidebar-nav__item is-active" data-page-tab="inventory" data-roles="WAREHOUSE_KEEPER" href="#inventory">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 7l7-4 7 4v9H3z">
                </path>
                <path d="M3 7l7 4 7-4">
                </path>
              </svg>
              {"\n          Tồn kho\n        "}
            </a>
            <a className="sidebar-nav__item" data-page-tab="stockin" data-roles="WAREHOUSE_KEEPER" href="#stockin">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="4" y="7" width="12" height="9" rx="1">
                </rect>
                <path d="M4 7l2-3h8l2 3">
                </path>
              </svg>
              {"\n          Nhập kho\n        "}
            </a>
            <a className="sidebar-nav__item" data-page-tab="stockout" data-roles="WAREHOUSE_KEEPER" href="#stockout">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="4" y="7" width="12" height="9" rx="1">
                </rect>
                <path d="M10 10v4M8 12h4">
                </path>
              </svg>
              {"\n          Xuất kho\n        "}
            </a>
            <a className="sidebar-nav__item" data-page-tab="transfer" data-roles="WAREHOUSE_KEEPER" href="#transfer">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 10h12M11 6l4 4-4 4">
                </path>
              </svg>
              {"\n          Điều chuyển\n        "}
            </a>
          </div>
          <div className="sidebar-nav__group">
            <div className="sidebar-nav__group-title">
              {"Thanh toán"}
            </div>
            <a className="sidebar-nav__item" data-roles="CASHIER" href="cashier.html">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="5" width="14" height="10" rx="1.4">
                </rect>
                <path d="M3 8h14">
                </path>
              </svg>
              {"\n          Thu ngân\n        "}
            </a>
            <a className="sidebar-nav__item" data-roles="CASHIER" href="cashier.html">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 6h8v9l-4-2-4 2z">
                </path>
              </svg>
              {"\n          Bàn giao\n        "}
            </a>
          </div>
          <div className="sidebar-nav__group">
            <div className="sidebar-nav__group-title">
              {"Báo cáo"}
            </div>
            <a className="sidebar-nav__item" data-roles="DISPATCHER" href="reports.html#sla">
              {"SLA"}
            </a>
            <a className="sidebar-nav__item" data-roles="DISPATCHER" href="reports.html#performance">
              {"Hiệu suất"}
            </a>
            <a className="sidebar-nav__item" data-roles="DISPATCHER" href="reports.html#audit">
              {"Lịch sử thao tác"}
            </a>
          </div>
          <div className="sidebar-nav__group" data-roles="ADMIN">
            <div className="sidebar-nav__group-title">
              {"Quản trị"}
            </div>
            <a className="sidebar-nav__item" href="admin.html" data-roles="ADMIN">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M10 3l6 2.5v4c0 4-2.5 6.5-6 7.5-3.5-1-6-3.5-6-7.5v-4z">
                </path>
              </svg>
              {"\n          Quản trị\n        "}
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
              {"Đặng Văn Kiên"}
            </span>
            <span className="header-user__role">
              {"Quản lý kho vật tư"}
            </span>
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">
              {"Kho vật tư"}
            </h1>
            <div className="page-subtitle">
              {"Theo dõi tồn kho linh kiện và duyệt phiếu nhập/xuất"}
            </div>
          </div>
        </div>
        <div data-page-panel="inventory">
          <section className="card" aria-labelledby="inventory-title">
            <div className="card__header">
              <div>
                <h2 className="card__title" id="inventory-title">
                  {"Tồn kho linh kiện"}
                </h2>
                <div className="card__title-meta">
                  {"Tồn thực tế / Đã giữ / Tồn khả dụng cho từng SKU"}
                </div>
              </div>
            </div>
            <div className="toolbar">
              <div className="toolbar__field">
                <label htmlFor="inv-filter-group">
                  {"Nhóm thiết bị"}
                </label>
                <select id="inv-filter-group" className="select-field" data-inv-filter-group="">
                  <option value="all">
                    {"Tất cả nhóm thiết bị"}
                  </option>
                </select>
              </div>
              <div className="toolbar__field">
                <label htmlFor="inv-filter-status">
                  {"Trạng thái tồn"}
                </label>
                <select id="inv-filter-status" className="select-field" data-inv-filter-status="">
                  <option value="all">
                    {"Tất cả trạng thái"}
                  </option>
                  <option value="ok">
                    {"Đủ hàng"}
                  </option>
                  <option value="low">
                    {"Tồn thấp"}
                  </option>
                  <option value="out">
                    {"Hết hàng"}
                  </option>
                </select>
              </div>
              <div className="toolbar__field toolbar__field--search">
                <input type="text" className="text-field" placeholder="Tìm theo SKU, tên linh kiện…" data-inv-search="" aria-label="Tìm linh kiện" />
              </div>
              <div className="toolbar__spacer">
              </div>
              <div className="toolbar__count" data-inv-count="">
                {"—"}
              </div>
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
                      {"Tồn thực tế"}
                    </th>
                    <th>
                      {"Đã giữ"}
                    </th>
                    <th>
                      {"Tồn khả dụng"}
                    </th>
                    <th>
                      {"Mức tối thiểu"}
                    </th>
                    <th>
                      {"Trạng thái"}
                    </th>
                    <th>
                      {"Kệ/Ngăn"}
                    </th>
                  </tr>
                </thead>
                <tbody data-inventory-tbody="">
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div data-page-panel="stockin" hidden={true}>
          <section className="card" aria-labelledby="stockin-title">
            <div className="card__header">
              <div>
                <h2 className="card__title" id="stockin-title">
                  {"Phiếu nhập kho"}
                </h2>
                <div className="card__title-meta">
                  {"Tạo phiếu mới hoặc duyệt phiếu để cộng số lượng vào tồn kho"}
                </div>
              </div>
              <button type="button" className="btn btn--primary btn--sm" data-open-create-stockin="">
                {"+ Tạo phiếu nhập kho"}
              </button>
            </div>
            <div className="request-list" data-stockin-list="">
            </div>
          </section>
        </div>
        <div data-page-panel="stockout" hidden={true}>
          <section className="card" aria-labelledby="stockout-title">
            <div className="card__header">
              <div>
                <h2 className="card__title" id="stockout-title">
                  {"Phiếu xuất kho"}
                </h2>
                <div className="card__title-meta">
                  {"Yêu cầu linh kiện từ kỹ thuật viên, chờ kho duyệt xuất"}
                </div>
              </div>
            </div>
            <div className="request-list" data-stockout-list="">
            </div>
          </section>
        </div>
        <div data-page-panel="transfer" hidden={true}>
          <section className="card" aria-labelledby="transfer-title">
            <div className="card__header">
              <div>
                <h2 className="card__title" id="transfer-title">
                  {"Điều chuyển kho"}
                </h2>
                <div className="card__title-meta">
                  {"Di chuyển linh kiện giữa các kệ/ngăn trong kho"}
                </div>
              </div>
              <button type="button" className="btn btn--primary btn--sm" data-open-create-transfer="">
                {"+ Tạo phiếu điều chuyển"}
              </button>
            </div>
            <div className="request-list" data-transfer-list="">
            </div>
          </section>
        </div>
      </main>
    </div>
    <div className="drawer-overlay" data-create-stockin-drawer="" hidden={true}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="create-stockin-drawer-title">
        <div className="drawer__header">
          <div>
            <div className="drawer__title" id="create-stockin-drawer-title">
              {"Tạo phiếu nhập kho"}
            </div>
            <div className="drawer__subtitle">
              {"Phiếu sẽ ở trạng thái Chờ duyệt sau khi tạo"}
            </div>
          </div>
          <button type="button" className="modal__close" data-create-stockin-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="drawer__body">
          <div className="form-row">
            <div className="form-field" data-create-supplier-field="">
              <label htmlFor="create-supplier">
                {"Nhà cung cấp"}
                <span className="required-mark">
                  {"*"}
                </span>
              </label>
              <select id="create-supplier" data-create-supplier="">
                <option value="">
                  {"— Chọn nhà cung cấp —"}
                </option>
              </select>
              <span className="form-field__error" data-create-supplier-error="" hidden={true}>
              </span>
            </div>
            <div className="form-field">
              <label htmlFor="create-batch">
                {"Số lô"}
              </label>
              <input type="text" id="create-batch" data-create-batch="" placeholder="VD: LOT-24099" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field" data-create-date-field="" style={{"maxWidth": "220px"} as CSSProperties}>
              <label htmlFor="create-date">
                {"Ngày nhập"}
                <span className="required-mark">
                  {"*"}
                </span>
              </label>
              <input type="date" id="create-date" data-create-date="" />
              <span className="form-field__error" data-create-date-error="" hidden={true}>
              </span>
            </div>
            <div className="form-field">
              <label htmlFor="create-note">
                {"Ghi chú"}
              </label>
              <input type="text" id="create-note" data-create-note="" placeholder="VD: Nhập bổ sung theo định mức" />
            </div>
          </div>
          <hr className="section-divider" />
          <div style={{"display": "flex", "alignItems": "center", "justifyContent": "space-between"} as CSSProperties}>
            <h3 className="card__title card__title--sm">
              {"Danh sách linh kiện"}
            </h3>
            <button type="button" className="btn btn--secondary btn--sm" data-add-item-row="">
              {"+ Thêm linh kiện"}
            </button>
          </div>
          <div data-create-items="">
          </div>
          <span className="form-field__error" data-create-items-error="" hidden={true}>
          </span>
        </div>
        <div className="drawer__footer">
          <button type="button" className="btn btn--secondary" data-create-stockin-cancel="">
            {"Hủy"}
          </button>
          <button type="button" className="btn btn--primary" data-create-stockin-submit="">
            {"Tạo phiếu nhập kho"}
          </button>
        </div>
      </div>
    </div>
    <div className="drawer-overlay" data-create-transfer-drawer="" hidden={true}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="create-transfer-drawer-title">
        <div className="drawer__header">
          <div>
            <div className="drawer__title" id="create-transfer-drawer-title">
              {"Tạo phiếu điều chuyển"}
            </div>
            <div className="drawer__subtitle">
              {"Di chuyển linh kiện sang kệ/ngăn khác"}
            </div>
          </div>
          <button type="button" className="modal__close" data-create-transfer-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="drawer__body">
          <div className="form-field" data-transfer-sku-field="">
            <label htmlFor="transfer-sku">
              {"SKU / Tên linh kiện"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <select id="transfer-sku" data-transfer-sku="">
              <option value="">
                {"— Chọn linh kiện —"}
              </option>
            </select>
            <span className="form-field__error" data-transfer-sku-error="" hidden={true}>
            </span>
          </div>
          <div className="part-picker-info" data-transfer-info="" hidden={true}>
            <div>
              <span className="cell-muted">
                {"Tồn thực tế"}
              </span>
              <b data-transfer-onhand="">
                {"—"}
              </b>
            </div>
            <div>
              <span className="cell-muted">
                {"Kệ/Ngăn hiện tại"}
              </span>
              <b className="mono" data-transfer-current-bin="">
                {"—"}
              </b>
            </div>
          </div>
          <div className="form-row">
            <div className="form-field" data-transfer-qty-field="">
              <label htmlFor="transfer-qty">
                {"Số lượng"}
                <span className="required-mark">
                  {"*"}
                </span>
              </label>
              <input type="number" id="transfer-qty" min="1" data-transfer-qty="" />
              <span className="form-field__error" data-transfer-qty-error="" hidden={true}>
              </span>
            </div>
            <div className="form-field" data-transfer-to-bin-field="">
              <label htmlFor="transfer-to-bin">
                {"Kệ/Ngăn đích"}
                <span className="required-mark">
                  {"*"}
                </span>
              </label>
              <input type="text" id="transfer-to-bin" className="mono" placeholder="VD: KHO-B-01-01" data-transfer-to-bin="" />
              <span className="form-field__error" data-transfer-to-bin-error="" hidden={true}>
              </span>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="transfer-reason">
              {"Lý do"}
            </label>
            <textarea id="transfer-reason" data-transfer-reason="" placeholder="VD: Gộp hàng, sắp xếp lại khu vực…">
            </textarea>
          </div>
        </div>
        <div className="drawer__footer">
          <button type="button" className="btn btn--secondary" data-create-transfer-cancel="">
            {"Hủy"}
          </button>
          <button type="button" className="btn btn--primary" data-create-transfer-submit="">
            {"Tạo phiếu điều chuyển"}
          </button>
        </div>
      </div>
    </div>
    <div className="drawer-overlay" data-transfer-drawer="" hidden={true}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="transfer-drawer-title">
        <div className="drawer__header">
          <div>
            <div className="drawer__title" id="transfer-drawer-title">
              {"Duyệt phiếu điều chuyển"}
            </div>
            <div className="drawer__subtitle" data-transfer-drawer-subtitle="">
              {"—"}
            </div>
          </div>
          <button type="button" className="modal__close" data-transfer-drawer-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="drawer__body">
          <div className="detail-grid">
            <div className="detail-grid__item">
              <span className="kv-key">
                {"SKU / Tên linh kiện"}
              </span>
              <span data-transfer-detail-part="">
                {"—"}
              </span>
            </div>
            <div className="detail-grid__item">
              <span className="kv-key">
                {"Số lượng"}
              </span>
              <span data-transfer-detail-qty="">
                {"—"}
              </span>
            </div>
            <div className="detail-grid__item">
              <span className="kv-key">
                {"Từ kệ/ngăn"}
              </span>
              <span className="mono" data-transfer-detail-from="">
                {"—"}
              </span>
            </div>
            <div className="detail-grid__item">
              <span className="kv-key">
                {"Đến kệ/ngăn"}
              </span>
              <span className="mono" data-transfer-detail-to="">
                {"—"}
              </span>
            </div>
            <div className="detail-grid__item detail-grid__item--wide">
              <span className="kv-key">
                {"Lý do"}
              </span>
              <span data-transfer-detail-reason="">
                {"—"}
              </span>
            </div>
          </div>
        </div>
        <div className="drawer__footer modal__footer--split">
          <button type="button" className="btn btn--destructive" data-transfer-reject="">
            {"Từ chối phiếu điều chuyển"}
          </button>
          <button type="button" className="btn btn--primary" data-transfer-approve="">
            {"Duyệt & Thực hiện điều chuyển"}
          </button>
        </div>
      </div>
    </div>
    <div className="drawer-overlay" data-stockin-drawer="" hidden={true}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="stockin-drawer-title">
        <div className="drawer__header">
          <div>
            <div className="drawer__title" id="stockin-drawer-title">
              {"Duyệt phiếu nhập kho"}
            </div>
            <div className="drawer__subtitle" data-stockin-drawer-subtitle="">
              {"—"}
            </div>
          </div>
          <button type="button" className="modal__close" data-stockin-drawer-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="drawer__body">
          <div className="detail-grid">
            <div className="detail-grid__item">
              <span className="kv-key">
                {"Nhà cung cấp"}
              </span>
              <span data-stockin-supplier="">
                {"—"}
              </span>
            </div>
            <div className="detail-grid__item">
              <span className="kv-key">
                {"Số lô"}
              </span>
              <span className="mono" data-stockin-batch="">
                {"—"}
              </span>
            </div>
            <div className="detail-grid__item">
              <span className="kv-key">
                {"Ngày nhập"}
              </span>
              <span data-stockin-date="">
                {"—"}
              </span>
            </div>
            <div className="detail-grid__item">
              <span className="kv-key">
                {"Trạng thái"}
              </span>
              <span data-stockin-status="">
                {"—"}
              </span>
            </div>
          </div>
          <div className="table-scroll">
            <table className="drawer-table">
              <thead>
                <tr>
                  <th>
                    {"SKU"}
                  </th>
                  <th>
                    {"Tên linh kiện"}
                  </th>
                  <th>
                    {"Số lượng"}
                  </th>
                  <th>
                    {"Serial/Batch"}
                  </th>
                </tr>
              </thead>
              <tbody data-stockin-items="">
              </tbody>
            </table>
          </div>
        </div>
        <div className="drawer__footer modal__footer--split">
          <button type="button" className="btn btn--destructive" data-stockin-reject="">
            {"Từ chối phiếu nhập"}
          </button>
          <button type="button" className="btn btn--primary" data-stockin-approve="">
            {"Duyệt & Thực nhập kho"}
          </button>
        </div>
      </div>
    </div>
    <div className="drawer-overlay" data-stockout-drawer="" hidden={true}>
      <div className="drawer" style={{"width": "560px"} as CSSProperties} role="dialog" aria-modal="true" aria-labelledby="stockout-drawer-title">
        <div className="drawer__header">
          <div>
            <div className="drawer__title" id="stockout-drawer-title">
              {"Duyệt phiếu xuất kho"}
            </div>
            <div className="drawer__subtitle" data-stockout-drawer-subtitle="">
              {"—"}
            </div>
          </div>
          <button type="button" className="modal__close" data-stockout-drawer-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="drawer__body">
          <div className="detail-grid">
            <div className="detail-grid__item">
              <span className="kv-key">
                {"Mã phiếu sửa chữa"}
              </span>
              <span className="mono" data-stockout-ticket="">
                {"—"}
              </span>
            </div>
            <div className="detail-grid__item">
              <span className="kv-key">
                {"Kỹ thuật viên"}
              </span>
              <span data-stockout-tech="">
                {"—"}
              </span>
            </div>
            <div className="detail-grid__item">
              <span className="kv-key">
                {"Nguồn yêu cầu"}
              </span>
              <span data-stockout-source="">
                {"—"}
              </span>
            </div>
            <div className="detail-grid__item">
              <span className="kv-key">
                {"Trạng thái"}
              </span>
              <span data-stockout-status="">
                {"—"}
              </span>
            </div>
          </div>
          <div className="table-scroll">
            <table className="drawer-table">
              <thead>
                <tr>
                  <th>
                    {"SKU"}
                  </th>
                  <th>
                    {"Tên linh kiện"}
                  </th>
                  <th>
                    {"SL yêu cầu"}
                  </th>
                  <th>
                    {"Tồn thực tế / Đã giữ"}
                  </th>
                  <th>
                    {"Kệ/Ngăn xuất"}
                  </th>
                </tr>
              </thead>
              <tbody data-stockout-lines="">
              </tbody>
            </table>
          </div>
          <div className="form-field__helper" style={{"marginTop": "8px"} as CSSProperties}>
            {"Tồn kho được trừ tự động ngay khi bấm “Duyệt & Thực xuất kho”."}
          </div>
        </div>
        <div className="drawer__footer modal__footer--split">
          <button type="button" className="btn btn--destructive" data-stockout-reject="">
            {"Từ chối phiếu xuất kho"}
          </button>
          <button type="button" className="btn btn--primary" data-stockout-approve="">
            {"Duyệt & Thực xuất kho"}
          </button>
        </div>
      </div>
    </div>
  </>);
}
