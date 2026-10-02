import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { usePage } from "../usePage";
import { BrandLogo } from "../customer";

export default function DispatchPage() {
  usePage("dispatch", {"data-roles": "DISPATCHER"}, "Soopi — Điều phối viên");
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
            <Link to="/dispatch" reloadDocument className="sidebar-nav__item is-active" data-roles="DISPATCHER">
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
            <Link to="/receptionist" reloadDocument className="sidebar-nav__item" data-roles="RECEPTIONIST">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 4h12v12H4z">
                </path>
                <path d="M8 8h4M8 11h4">
                </path>
              </svg>
              {"\n          Tiếp nhận\n        "}
            </Link>
            <Link to="/tickets" reloadDocument className="sidebar-nav__item" data-roles="DISPATCHER">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 3h5l3 3v11H6z">
                </path>
                <path d="M11 3v3h3">
                </path>
              </svg>
              {"\n          Phiếu sửa chữa\n        "}
            </Link>
            <Link to="/dispatch" reloadDocument className="sidebar-nav__item is-active" data-roles="DISPATCHER">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="10" cy="10" r="7">
                </circle>
                <path d="M10 6v4l3 2">
                </path>
              </svg>
              {"\n          Điều phối\n        "}
            </Link>
            <Link to="/technician" reloadDocument className="sidebar-nav__item" data-roles="TECHNICIAN">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M13 4l-1.5 1.5M4 16l6-6M9 6l5 5-1.5 3-5-5z">
                </path>
              </svg>
              {"\n          Kỹ thuật\n        "}
            </Link>
          </div>
          <div className="sidebar-nav__group">
            <div className="sidebar-nav__group-title">
              {"Kho vật tư"}
            </div>
            <Link to="/warehouse" reloadDocument className="sidebar-nav__item" data-roles="WAREHOUSE_KEEPER">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 7l7-4 7 4v9H3z">
                </path>
                <path d="M3 7l7 4 7-4">
                </path>
              </svg>
              {"\n          Tồn kho\n        "}
            </Link>
            <Link to="/warehouse#stockin" reloadDocument className="sidebar-nav__item" data-roles="WAREHOUSE_KEEPER">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="4" y="7" width="12" height="9" rx="1">
                </rect>
                <path d="M4 7l2-3h8l2 3">
                </path>
              </svg>
              {"\n          Nhập kho\n        "}
            </Link>
            <Link to="/warehouse#stockout" reloadDocument className="sidebar-nav__item" data-roles="WAREHOUSE_KEEPER">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="4" y="7" width="12" height="9" rx="1">
                </rect>
                <path d="M10 10v4M8 12h4">
                </path>
              </svg>
              {"\n          Xuất kho\n        "}
            </Link>
            <Link to="/warehouse#transfer" reloadDocument className="sidebar-nav__item" data-roles="WAREHOUSE_KEEPER">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 10h12M11 6l4 4-4 4">
                </path>
              </svg>
              {"\n          Điều chuyển\n        "}
            </Link>
          </div>
          <div className="sidebar-nav__group">
            <div className="sidebar-nav__group-title">
              {"Thanh toán"}
            </div>
            <Link to="/cashier" reloadDocument className="sidebar-nav__item" data-roles="CASHIER">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="5" width="14" height="10" rx="1.4">
                </rect>
                <path d="M3 8h14">
                </path>
              </svg>
              {"\n          Thu ngân\n        "}
            </Link>
            <Link to="/cashier" reloadDocument className="sidebar-nav__item" data-roles="CASHIER">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 6h8v9l-4-2-4 2z">
                </path>
              </svg>
              {"\n          Bàn giao\n        "}
            </Link>
          </div>
          <div className="sidebar-nav__group">
            <div className="sidebar-nav__group-title">
              {"Báo cáo"}
            </div>
            <Link to="/reports#sla" reloadDocument className="sidebar-nav__item" data-roles="DISPATCHER">
              {"SLA"}
            </Link>
            <Link to="/reports#performance" reloadDocument className="sidebar-nav__item" data-roles="DISPATCHER">
              {"Hiệu suất"}
            </Link>
            <Link to="/reports#audit" reloadDocument className="sidebar-nav__item" data-roles="DISPATCHER">
              {"Lịch sử thao tác"}
            </Link>
          </div>
          <div className="sidebar-nav__group" data-roles="ADMIN">
            <div className="sidebar-nav__group-title">
              {"Quản trị"}
            </div>
            <Link to="/admin" reloadDocument className="sidebar-nav__item" data-roles="ADMIN">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M10 3l6 2.5v4c0 4-2.5 6.5-6 7.5-3.5-1-6-3.5-6-7.5v-4z">
                </path>
              </svg>
              {"\n          Quản trị\n        "}
            </Link>
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
              {"Lê Minh Tâm"}
            </span>
            <span className="header-user__role">
              {"Điều phối viên"}
            </span>
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">
              {"Điều phối"}
            </h1>
            <div className="page-subtitle">
              {"Theo dõi phiếu tiếp nhận và phân công kỹ thuật viên theo thời gian thực"}
            </div>
          </div>
        </div>
        <section className="card" aria-labelledby="ticket-table-title">
          <div className="card__header">
            <div>
              <h2 className="card__title" id="ticket-table-title">
                {"Phiếu tiếp nhận đang xử lý"}
              </h2>
              <div className="card__title-meta">
                {"Mọi nhóm thiết bị, hạn SLA cập nhật theo thời gian thực"}
              </div>
            </div>
            <div className="inline-group">
              <button type="button" className="btn btn--secondary btn--sm" data-refresh-btn="">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 10a6 6 0 0110-4.2M16 10a6 6 0 01-10 4.2">
                  </path>
                  <path d="M14 3v3h-3M6 17v-3h3">
                  </path>
                </svg>
                {"\n            Làm mới\n          "}
              </button>
            </div>
          </div>
          <div className="toolbar">
            <div className="toolbar__field">
              <label htmlFor="filter-status">
                {"Trạng thái"}
              </label>
              <select id="filter-status" className="select-field" data-filter-status="">
                <option value="all">
                  {"Tất cả trạng thái"}
                </option>
              </select>
            </div>
            <div className="toolbar__field">
              <label htmlFor="filter-category">
                {"Nhóm thiết bị"}
              </label>
              <select id="filter-category" className="select-field" data-filter-category="">
                <option value="all">
                  {"Tất cả nhóm thiết bị"}
                </option>
              </select>
            </div>
            <div className="toolbar__field">
              <label htmlFor="filter-sla">
                {"Mức SLA"}
              </label>
              <select id="filter-sla" className="select-field" data-filter-sla="">
                <option value="all">
                  {"Tất cả mức SLA"}
                </option>
              </select>
            </div>
            <div className="toolbar__field toolbar__field--search">
              <input type="text" className="text-field" placeholder="Lọc theo mã phiếu, serial, khách hàng…" data-table-search="" aria-label="Lọc bảng phiếu" />
            </div>
            <div className="toolbar__spacer">
            </div>
            <div className="toolbar__count" data-result-count="">
              {"—"}
            </div>
          </div>
          <div className="table-scroll" data-table-wrap="">
            <table className="data-table data-table--fluid">
              <thead>
                <tr>
                  <th>
                    {"Mã phiếu"}
                  </th>
                  <th className="is-sortable" data-sort-key="receivedAt">
                    {"Thời gian tiếp nhận"}
                    <span className="sort-caret">
                      {"▲"}
                    </span>
                  </th>
                  <th>
                    {"Khách hàng"}
                  </th>
                  <th>
                    {"Loại thiết bị"}
                  </th>
                  <th>
                    {"Hãng/Model"}
                  </th>
                  <th>
                    {"Serial/IMEI"}
                  </th>
                  <th>
                    {"Mức SLA"}
                  </th>
                  <th className="is-sortable is-sorted-asc" data-sort-key="deadline">
                    {"Thời gian còn lại"}
                    <span className="sort-caret">
                      {"▲"}
                    </span>
                  </th>
                  <th className="is-sortable" data-sort-key="status">
                    {"Trạng thái"}
                    <span className="sort-caret">
                      {"▲"}
                    </span>
                  </th>
                  <th>
                    {"Kỹ thuật viên"}
                  </th>
                  <th>
                    {"Thao tác"}
                  </th>
                </tr>
              </thead>
              <tbody data-ticket-tbody="">
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <div className="pagination__rows">
              {"\n          Hiển thị\n          "}
              <select className="select-field" data-rows-per-page="" aria-label="Số dòng mỗi trang" style={{"height": "26px", "padding": "0 6px"} as CSSProperties}>
                <option value="25">
                  {"25"}
                </option>
                <option value="50">
                  {"50"}
                </option>
                <option value="100">
                  {"100"}
                </option>
              </select>
              {"\n          dòng / trang\n        "}
            </div>
            <div className="pagination__nav">
              <button type="button" className="pagination__nav-btn" data-page-prev="">
                {"← Trước"}
              </button>
              <span data-page-label="">
                {"Trang 1 / 1"}
              </span>
              <button type="button" className="pagination__nav-btn" data-page-next="">
                {"Sau →"}
              </button>
            </div>
          </div>
        </section>
        <section className="card" aria-labelledby="quotation-approval-title">
          <div className="card__header">
            <div>
              <h2 className="card__title" id="quotation-approval-title">
                {"Phê duyệt báo giá sửa chữa"}
              </h2>
              <div className="card__title-meta">
                {"Phiếu báo giá ngoài bảo hành do kỹ thuật viên gửi lên, đang chờ phê duyệt"}
              </div>
            </div>
          </div>
          <div className="request-list" data-quotation-approval-list="">
          </div>
        </section>
        <section className="card" aria-labelledby="workload-title">
          <div className="card__header">
            <div>
              <h2 className="card__title" id="workload-title">
                {"Tải công việc kỹ thuật viên"}
              </h2>
              <div className="card__title-meta">
                {"Số phiếu đang xử lý / năng lực tối đa được cấu hình cho mỗi kỹ thuật viên"}
              </div>
            </div>
          </div>
          <div className="card__body" data-workload-list="">
          </div>
        </section>
      </main>
    </div>
    <div className="modal-overlay" data-assign-modal="" hidden={true} role="dialog" aria-modal="true" aria-labelledby="assign-modal-title">
      <div className="modal">
        <div className="modal__header">
          <div>
            <div className="modal__title" id="assign-modal-title">
              {"Phân công kỹ thuật viên"}
            </div>
            <div className="modal__subtitle" data-assign-modal-subtitle="">
              {"—"}
            </div>
          </div>
          <button type="button" className="modal__close" data-modal-close="" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15">
              </path>
            </svg>
          </button>
        </div>
        <div className="modal__body">
          <div className="candidate-list" data-candidate-list="">
          </div>
          <div style={{"display": "grid", "gridTemplateColumns": "200px 1fr", "gap": "12px", "marginTop": "14px"} as CSSProperties}>
            <div className="form-field" data-assign-priority-field="">
              <label htmlFor="assign-priority">
                {"Mức độ ưu tiên"}
              </label>
              <select id="assign-priority" className="select-field" data-assign-priority="">
                <option value="NORMAL">
                  {"Bình thường"}
                </option>
                <option value="URGENT">
                  {"Gấp"}
                </option>
                <option value="LOW">
                  {"Thấp"}
                </option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="assign-note">
                {"Ghi chú phân công"}
              </label>
              <input type="text" id="assign-note" className="text-field" data-assign-note="" placeholder="Ví dụ: Đúng chuyên môn điện lạnh" />
            </div>
          </div>
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--secondary" data-modal-cancel="">
            {"Hủy phân công"}
          </button>
          <button type="button" className="btn btn--primary" data-confirm-assign="" disabled={true}>
            {"Xác nhận giao việc"}
          </button>
        </div>
      </div>
    </div>
    <div className="drawer-overlay" data-quotation-drawer="" hidden={true}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="quotation-drawer-title">
        <div className="drawer__header">
          <div>
            <div className="drawer__title" id="quotation-drawer-title">
              {"Xem xét báo giá sửa chữa"}
            </div>
            <div className="drawer__subtitle" data-quotation-drawer-subtitle="">
              {"—"}
            </div>
          </div>
          <button type="button" className="modal__close" data-quotation-drawer-close="" aria-label="Đóng">
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
                {"Phân loại bảo hành"}
              </span>
              <span data-quotation-drawer-reclass="">
                {"—"}
              </span>
            </div>
            <div className="detail-grid__item">
              <span className="kv-key">
                {"Kỹ thuật viên lập"}
              </span>
              <span data-quotation-drawer-tech="">
                {"—"}
              </span>
            </div>
            <div className="detail-grid__item detail-grid__item--wide">
              <span className="kv-key">
                {"Lý do phân loại lại"}
              </span>
              <span data-quotation-drawer-note="">
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
                    {"SL"}
                  </th>
                  <th>
                    {"Thành tiền"}
                  </th>
                </tr>
              </thead>
              <tbody data-quotation-drawer-items="">
              </tbody>
            </table>
          </div>
          <div className="billing-row">
            <span>
              {"Tổng linh kiện"}
            </span>
            <span data-quotation-drawer-parts-total="">
              {"—"}
            </span>
          </div>
          <div className="billing-row">
            <span>
              {"Phí dịch vụ"}
            </span>
            <span data-quotation-drawer-service-fee="">
              {"—"}
            </span>
          </div>
          <div className="billing-total-row">
            <span>
              {"Tổng tạm tính"}
            </span>
            <span data-quotation-drawer-total="">
              {"—"}
            </span>
          </div>
          <div className="form-field" style={{"marginTop": "14px"} as CSSProperties}>
            <label htmlFor="quotation-dispatch-note">
              {"Ghi chú (bắt buộc khi yêu cầu sửa lại)"}
            </label>
            <textarea id="quotation-dispatch-note" data-quotation-dispatch-note="" placeholder="Lý do yêu cầu kỹ thuật viên sửa lại báo giá…">
            </textarea>
            <span className="form-field__error" data-quotation-dispatch-note-error="" hidden={true}>
              {"Vui lòng ghi rõ lý do yêu cầu sửa lại báo giá."}
            </span>
          </div>
        </div>
        <div className="drawer__footer modal__footer--split">
          <button type="button" className="btn btn--destructive" data-quotation-request-changes="">
            {"Yêu cầu sửa lại báo giá"}
          </button>
          <button type="button" className="btn btn--primary" data-quotation-approve="">
            {"Phê duyệt báo giá"}
          </button>
        </div>
      </div>
    </div>
  </>);
}
