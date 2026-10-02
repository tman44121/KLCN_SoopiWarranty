import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { usePage } from "../usePage";
import { BrandLogo } from "../customer";

export default function CashierPage() {
  usePage("cashier", {"data-roles": "CASHIER"}, "Soopi — Thu ngân &amp; Bàn giao");
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
            <a className="sidebar-nav__item is-active" data-roles="CASHIER" href="cashier.html">
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
              {"Hồ Quỳnh Như"}
            </span>
            <span className="header-user__role">
              {"Thu ngân & Bàn giao"}
            </span>
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">
              {"Thu ngân & Bàn giao"}
            </h1>
            <div className="page-subtitle">
              {"Thu tiền, kiểm tra lại thiết bị và hoàn tất bàn giao cho khách hàng"}
            </div>
          </div>
        </div>
        <div style={{"display": "grid", "gridTemplateColumns": "340px minmax(0, 1fr)", "gap": "20px", "alignItems": "start"} as CSSProperties}>
          <section className="card" aria-labelledby="handover-queue-title">
            <div className="card__header">
              <div>
                <h2 className="card__title" id="handover-queue-title">
                  {"Sẵn sàng bàn giao"}
                </h2>
                <div className="card__title-meta">
                  {"Phiếu đã hoàn tất sửa chữa & QC"}
                </div>
              </div>
            </div>
            <div className="queue-list" data-handover-queue="">
            </div>
          </section>
          <div className="stack stack--loose" data-handover-detail="">
            <div className="card">
              <div className="card__body empty-selection-hint">
                {"\n            Chọn một phiếu trong danh sách bên trái để thu ngân và bàn giao.\n          "}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </>);
}
