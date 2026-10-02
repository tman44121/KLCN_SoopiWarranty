import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { usePage } from "../usePage";
import { BrandLogo } from "../customer";

export default function ReceptionistPage() {
  usePage("receptionist", {"data-roles": "RECEPTIONIST"}, "Soopi — Tiếp nhận");
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
            <a className="sidebar-nav__item is-active" data-roles="RECEPTIONIST" href="receptionist.html">
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
            <a className="sidebar-nav__item" data-roles="WAREHOUSE_KEEPER" href="warehouse.html">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 7l7-4 7 4v9H3z">
                </path>
                <path d="M3 7l7 4 7-4">
                </path>
              </svg>
              {"\n          Tồn kho\n        "}
            </a>
            <a className="sidebar-nav__item" data-roles="WAREHOUSE_KEEPER" href="warehouse.html#stockin">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="4" y="7" width="12" height="9" rx="1">
                </rect>
                <path d="M4 7l2-3h8l2 3">
                </path>
              </svg>
              {"\n          Nhập kho\n        "}
            </a>
            <a className="sidebar-nav__item" data-roles="WAREHOUSE_KEEPER" href="warehouse.html#stockout">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="4" y="7" width="12" height="9" rx="1">
                </rect>
                <path d="M10 10v4M8 12h4">
                </path>
              </svg>
              {"\n          Xuất kho\n        "}
            </a>
            <a className="sidebar-nav__item" data-roles="WAREHOUSE_KEEPER" href="warehouse.html#transfer">
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
              {"Trần Bảo Trâm"}
            </span>
            <span className="header-user__role">
              {"Tiếp nhận & Lễ tân"}
            </span>
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">
              {"Tiếp nhận thiết bị"}
            </h1>
            <div className="page-subtitle">
              {"Tạo phiếu tiếp nhận mới cho khách hàng"}
            </div>
          </div>
        </div>
        <section className="card" aria-labelledby="yc-title" data-perm="WARRANTY_REQUEST_HANDLE">
          <div className="card__header">
            <div>
              <h2 className="card__title" id="yc-title">
                {"Yêu cầu bảo hành trực tuyến"}
              </h2>
              <div className="card__title-meta">
                {"Khách đăng ký trước trên Cổng khách hàng hoặc app. Nhập mã YC- để tự điền biểu mẫu tiếp nhận."}
              </div>
            </div>
            <div style={{"display": "flex", "gap": "8px", "alignItems": "center"} as CSSProperties}>
              <input type="text" className="text-field mono" data-yc-code="" placeholder="YC-2026-0917-00095" aria-label="Mã yêu cầu trực tuyến" style={{"width": "210px"} as CSSProperties} />
              <button type="button" className="btn btn--secondary btn--sm" data-yc-load="">
                {"Tự điền từ mã YC"}
              </button>
            </div>
          </div>
          <div className="request-filter">
            <span id="yc-status-label">
              {"Trạng thái"}
            </span>
            <div className="choice-group" data-yc-status="" role="radiogroup" aria-labelledby="yc-status-label">
            </div>
          </div>
          <div className="request-list" data-yc-list="">
          </div>
        </section>
        <form className="form-page" data-intake-form="" noValidate={true}>
          <div className="success-banner" data-yc-banner="" hidden={true}>
            <span>
              {"Đang tiếp nhận từ yêu cầu trực tuyến "}
              <span className="mono" data-yc-banner-code="">
                {"—"}
              </span>
              {". Thông tin khách tự khai đã khóa; chỉ cần chọn hãng/model và hoàn tất phần kiểm tra tại quầy."}
            </span>
            <button type="button" className="btn btn--secondary btn--sm" data-yc-clear="" style={{"marginLeft": "auto"} as CSSProperties}>
              {"Bỏ liên kết"}
            </button>
          </div>
          <section className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">
                  {"Thông tin khách hàng"}
                </h2>
                <div className="card__title-meta" data-customer-hint="">
                  {"Nhập số điện thoại để tra cứu khách hàng đã có hồ sơ"}
                </div>
              </div>
            </div>
            <div className="card__body stack">
              <div className="form-row">
                <div className="form-field" data-field="customer.newCustomer.phone">
                  <label htmlFor="phone">
                    {"Số điện thoại"}
                    <span className="required-mark">
                      {"*"}
                    </span>
                  </label>
                  <div className="inline-group">
                    <input type="text" id="phone" name="phone" placeholder="09xx xxx xxx" />
                    <button type="button" className="btn btn--secondary" data-customer-lookup="">
                      {"Tra cứu khách hàng"}
                    </button>
                  </div>
                </div>
                <div className="form-field" data-field="customer.newCustomer.fullName">
                  <label htmlFor="customerName">
                    {"Họ và tên"}
                    <span className="required-mark">
                      {"*"}
                    </span>
                  </label>
                  <input type="text" id="customerName" name="fullName" placeholder="Nguyễn Văn A" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field" data-field="customer.newCustomer.email">
                  <label htmlFor="email">
                    {"Email"}
                  </label>
                  <input type="text" id="email" name="email" placeholder="ten@email.com" />
                </div>
                <div className="form-field" data-field="customer.newCustomer.address">
                  <label htmlFor="address">
                    {"Địa chỉ"}
                  </label>
                  <input type="text" id="address" name="address" placeholder="Số nhà, đường, quận/huyện" />
                </div>
              </div>
            </div>
          </section>
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">
                {"Thông tin thiết bị"}
              </h2>
            </div>
            <div className="card__body stack">
              <div className="form-row">
                <div className="form-field" data-field="category">
                  <label id="category-label">
                    {"Nhóm thiết bị"}
                    <span className="required-mark">
                      {"*"}
                    </span>
                  </label>
                  <div className="choice-group" data-device-category="" role="radiogroup" aria-labelledby="category-label">
                  </div>
                </div>
                <div className="form-field" data-field="deviceType">
                  <label id="deviceType-label">
                    {"Loại thiết bị cụ thể"}
                    <span className="required-mark">
                      {"*"}
                    </span>
                  </label>
                  <div className="choice-group" data-device-type="" role="radiogroup" aria-labelledby="deviceType-label">
                  </div>
                </div>
              </div>
              <div className="form-field" data-field="device.newDevice.productId">
                <label htmlFor="productSearch">
                  {"Hãng/Model"}
                  <span className="required-mark">
                    {"*"}
                  </span>
                </label>
                <div className="product-picker">
                  <input type="text" id="productSearch" data-product-search="" placeholder="Gõ tên hãng hoặc model để lọc" autoComplete="off" />
                  <div className="choice-group" data-product-choices="" role="radiogroup" aria-label="Hãng/Model">
                  </div>
                </div>
                <span className="form-field__helper" data-yc-brand-model="" hidden={true}>
                </span>
              </div>
              <div className="form-row">
                <div className="form-field" data-field="device.newDevice.serialOrImei">
                  <label htmlFor="identifier" data-identifier-label="">
                    {"Serial Number"}
                    <span className="required-mark">
                      {"*"}
                    </span>
                  </label>
                  <div className="inline-group">
                    <input type="text" id="identifier" name="serialOrImei" className="mono" placeholder="Nhập số Serial" />
                    <button type="button" className="btn btn--secondary" data-warranty-check="">
                      {"Kiểm tra bảo hành"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label id="channel-label">
                    {"Kênh tiếp nhận"}
                  </label>
                  <div className="choice-group" data-channel="" role="radiogroup" aria-labelledby="channel-label">
                  </div>
                </div>
                <div className="form-field">
                  <label id="requestType-label">
                    {"Loại yêu cầu"}
                  </label>
                  <div className="choice-group" data-request-type="" role="radiogroup" aria-labelledby="requestType-label">
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label id="slaLevel-label">
                    {"Mức SLA cam kết"}
                  </label>
                  <div className="choice-group" data-sla-level="" role="radiogroup" aria-labelledby="slaLevel-label">
                  </div>
                </div>
                <div className="form-field" data-field="promisedReturnAt">
                  <label htmlFor="promisedReturnAt">
                    {"Ngày hẹn trả"}
                  </label>
                  <input type="datetime-local" id="promisedReturnAt" name="promisedReturnAt" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field" data-field="estimatedCost">
                  <label htmlFor="estimatedCost">
                    {"Chi phí dự kiến (đ)"}
                  </label>
                  <input type="number" id="estimatedCost" name="estimatedCost" min="0" step="1000" placeholder="0" />
                </div>
                <div className="form-field">
                  <label htmlFor="sealCondition">
                    {"Tình trạng tem bảo hành"}
                  </label>
                  <input type="text" id="sealCondition" placeholder="VD: Tem nguyên vẹn" />
                </div>
              </div>
            </div>
          </section>
          <section className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">
                  {"Xác nhận tình trạng bảo hành"}
                </h2>
                <div className="card__title-meta" data-warranty-hint="">
                  {"Nhập Serial/IMEI rồi bấm “Kiểm tra bảo hành” để tra thiết bị đã đăng ký"}
                </div>
              </div>
              <div data-warranty-badge="">
              </div>
            </div>
            <div className="card__body stack">
              <div className="detail-grid" data-warranty-result="" hidden={true}>
              </div>
              <div data-new-device-fields="">
                <div className="form-row">
                  <div className="form-field" data-field="device.newDevice.warrantyActivatedOn">
                    <label htmlFor="activatedAt">
                      {"Ngày kích hoạt"}
                    </label>
                    <input type="date" id="activatedAt" name="warrantyActivatedOn" />
                  </div>
                  <div className="form-field" data-field="device.newDevice.warrantyExpiresOn">
                    <label htmlFor="expiresAt">
                      {"Ngày hết hạn"}
                    </label>
                    <input type="date" id="expiresAt" name="warrantyExpiresOn" />
                    <span className="form-field__helper">
                      {"Để trống: hệ thống tính theo chính sách bảo hành của hãng/sản phẩm."}
                    </span>
                  </div>
                </div>
                <div className="form-field">
                  <label htmlFor="distributor">
                    {"Nhà phân phối"}
                  </label>
                  <input type="text" id="distributor" placeholder="VD: Samsung Việt Nam" />
                </div>
              </div>
            </div>
          </section>
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">
                {"Mô tả lỗi khách hàng"}
              </h2>
            </div>
            <div className="card__body">
              <div className="form-field" data-field="reportedIssue">
                <label htmlFor="symptom" className="visually-hidden">
                  {"Mô tả lỗi khách hàng"}
                </label>
                <textarea id="symptom" name="reportedIssue" placeholder="Khách hàng mô tả tình trạng/lỗi gặp phải…">
                </textarea>
              </div>
            </div>
          </section>
          <section className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">
                  {"Kiểm tra ngoại quan"}
                </h2>
                <div className="card__title-meta">
                  {"Thực hiện cùng khách hàng trước khi tiếp nhận"}
                </div>
              </div>
            </div>
            <div className="card__body" style={{"padding": "0"} as CSSProperties}>
              <div className="checklist" data-cosmetic-group="">
                <div className="checklist-item">
                  <span className="checklist-item__label">
                    {"Vết trầy"}
                  </span>
                  <div className="result-toggle" data-cosmetic="scratches">
                    <button type="button" className="result-toggle__btn is-active" data-value="NONE">
                      {"Không"}
                    </button>
                    <button type="button" className="result-toggle__btn" data-value="LIGHT">
                      {"Nhẹ"}
                    </button>
                    <button type="button" className="result-toggle__btn" data-value="HEAVY">
                      {"Nặng"}
                    </button>
                  </div>
                </div>
                <div className="checklist-item">
                  <span className="checklist-item__label">
                    {"Cấn móp"}
                  </span>
                  <div className="result-toggle" data-cosmetic="dents">
                    <button type="button" className="result-toggle__btn is-active" data-value="false">
                      {"Không"}
                    </button>
                    <button type="button" className="result-toggle__btn" data-value="true">
                      {"Có"}
                    </button>
                  </div>
                </div>
                <div className="checklist-item">
                  <span className="checklist-item__label">
                    {"Nứt/vỡ"}
                  </span>
                  <div className="result-toggle" data-cosmetic="cracks">
                    <button type="button" className="result-toggle__btn is-active" data-value="false">
                      {"Không"}
                    </button>
                    <button type="button" className="result-toggle__btn" data-value="true">
                      {"Có"}
                    </button>
                  </div>
                </div>
                <div className="checklist-item">
                  <span className="checklist-item__label">
                    {"Dấu hiệu ẩm nước"}
                  </span>
                  <div className="result-toggle" data-cosmetic="moisture">
                    <button type="button" className="result-toggle__btn is-active" data-value="NONE">
                      {"Không"}
                    </button>
                    <button type="button" className="result-toggle__btn" data-value="SUSPECTED">
                      {"Nghi ngờ"}
                    </button>
                    <button type="button" className="result-toggle__btn" data-value="YES">
                      {"Có"}
                    </button>
                  </div>
                </div>
                <div className="checklist-item">
                  <span className="checklist-item__label">
                    {"Phụ kiện đi kèm"}
                  </span>
                  <div className="result-toggle" data-cosmetic="accessories">
                    <button type="button" className="result-toggle__btn is-active" data-value="COMPLETE">
                      {"Đủ"}
                    </button>
                    <button type="button" className="result-toggle__btn" data-value="MISSING">
                      {"Thiếu"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="card__body stack">
                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="accessoriesNote">
                      {"Ghi chú phụ kiện"}
                    </label>
                    <input type="text" id="accessoriesNote" placeholder="VD: Sạc, cáp, túi đựng" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="cosmeticNotes">
                      {"Ghi chú ngoại quan"}
                    </label>
                    <input type="text" id="cosmeticNotes" placeholder="VD: Trầy nhẹ góc trái" />
                  </div>
                </div>
              </div>
              <div className="checkbox-row" data-field="cosmetic.customerAcknowledged">
                <input type="checkbox" id="ack" />
                <label htmlFor="ack">
                  {"Khách hàng đã xác nhận tình trạng ngoại quan"}
                </label>
              </div>
              <span className="form-field__error" data-ack-error="" hidden={true} style={{"padding": "0 14px 12px", "display": "block"} as CSSProperties}>
                {"Vui lòng xác nhận cùng khách hàng về tình trạng ngoại quan."}
              </span>
            </div>
          </section>
          <div className="action-bar">
            <button type="button" className="btn btn--secondary" data-reset-form="">
              {"Làm mới biểu mẫu"}
            </button>
            <button type="button" className="btn btn--primary" data-submit-intake="">
              {"Tiếp nhận thiết bị"}
            </button>
          </div>
          <section className="stack" data-result-section="" hidden={true}>
            <div className="success-banner" data-success-banner="">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="10" cy="10" r="8">
                </circle>
                <path d="M6.5 10.5l2.5 2.5 4.5-5.5">
                </path>
              </svg>
              <span>
                {"Đã tạo phiếu "}
                <span className="mono" data-created-ticket-id="">
                  {"—"}
                </span>
              </span>
            </div>
            <section className="card">
              <div className="card__header">
                <h2 className="card__title">
                  {"Xem trước phiếu tiếp nhận"}
                </h2>
                <button type="button" className="btn btn--primary btn--sm" data-print-receipt="">
                  {"In phiếu tiếp nhận"}
                </button>
              </div>
              <div className="card__body">
                <div className="receipt" data-receipt-preview="">
                  <div className="receipt__brand">
                    <div className="receipt__brand-name">
                      {"SOOPI"}
                    </div>
                    <div className="receipt__brand-doc">
                      {"PHIẾU TIẾP NHẬN"}
                    </div>
                  </div>
                  <div className="receipt__row">
                    <span className="kv-key">
                      {"Mã phiếu"}
                    </span>
                    <span className="mono" data-r-id="">
                      {"—"}
                    </span>
                  </div>
                  <div className="receipt__row">
                    <span className="kv-key">
                      {"Thời gian tiếp nhận"}
                    </span>
                    <span data-r-received="">
                      {"—"}
                    </span>
                  </div>
                  <div className="receipt__row">
                    <span className="kv-key">
                      {"Khách hàng"}
                    </span>
                    <span data-r-customer="">
                      {"—"}
                    </span>
                  </div>
                  <div className="receipt__row">
                    <span className="kv-key">
                      {"Thiết bị"}
                    </span>
                    <span data-r-device="">
                      {"—"}
                    </span>
                  </div>
                  <div className="receipt__row">
                    <span className="kv-key" data-r-id-label="">
                      {"Serial/IMEI"}
                    </span>
                    <span className="mono" data-r-serial="">
                      {"—"}
                    </span>
                  </div>
                  <div className="receipt__row">
                    <span className="kv-key">
                      {"Tình trạng bảo hành"}
                    </span>
                    <span data-r-warranty="">
                      {"—"}
                    </span>
                  </div>
                  <div className="receipt__row">
                    <span className="kv-key">
                      {"Tình trạng ngoại quan"}
                    </span>
                    <span data-r-cosmetic="">
                      {"—"}
                    </span>
                  </div>
                  <div className="receipt__row">
                    <span className="kv-key">
                      {"Lỗi tiếp nhận"}
                    </span>
                    <span data-r-symptom="">
                      {"—"}
                    </span>
                  </div>
                  <div className="receipt__row">
                    <span className="kv-key">
                      {"Ngày dự kiến trả"}
                    </span>
                    <span data-r-expected="">
                      {"—"}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </section>
        </form>
        <section className="card" aria-labelledby="counter-quote-title" data-perm="QUOTE_DECIDE_ON_BEHALF">
          <div className="card__header">
            <div>
              <h2 className="card__title" id="counter-quote-title">
                {"Khách xác nhận báo giá tại quầy"}
              </h2>
              <div className="card__title-meta">
                {"Dùng khi khách có mặt tại trung tâm. Báo giá phải đã được điều phối phê duyệt."}
              </div>
            </div>
            <div style={{"display": "flex", "gap": "8px", "alignItems": "center"} as CSSProperties}>
              <input type="text" className="text-field mono" data-counter-ticket="" placeholder="TN-2026-0917-00423" aria-label="Mã phiếu tiếp nhận" style={{"width": "210px"} as CSSProperties} />
              <button type="button" className="btn btn--secondary btn--sm" data-counter-load="">
                {"Tải báo giá"}
              </button>
            </div>
          </div>
          <div className="card__body" data-counter-body="">
            <div className="empty-selection-hint">
              {"Nhập mã phiếu để xem báo giá đang chờ khách xác nhận."}
            </div>
          </div>
        </section>
      </main>
    </div>
  </>);
}
