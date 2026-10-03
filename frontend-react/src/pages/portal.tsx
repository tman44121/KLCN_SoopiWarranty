import { usePage } from "../usePage";
import controller from "../behaviors/customer-portal.js";
import { CustomerFooter, CustomerHeader, Icon } from "../customer";

/* Tra cứu công khai theo giao diện trang Tra cứu của web khách KLCN. id và data-* giữ nguyên vì customer-portal.js gắn vào. */
export default function PortalPage() {
  usePage("portal", {}, "Soopi — Tra cứu sửa chữa", controller);
  return (
    <div className="kh-app">
      <CustomerHeader active="lookup" />
      <main className="kh-main">
        <section className="warranty-hero-banner lookup-hero" data-lookup-section="">
          <h1 className="warranty-title">Tra cứu tiến độ sửa chữa</h1>
          <p className="warranty-subtitle">Nhập mã phiếu (TN- hoặc YC-) và số điện thoại đã đăng ký để xem tiến độ, ghi chú và báo giá.</p>
          <div className="lookup-form">
            <div className="form-row-group" data-field="lookupId">
              <label htmlFor="lookupId">Mã phiếu</label>
              <input type="text" id="lookupId" className="regular-input mono" autoCapitalize="characters" autoComplete="off" spellCheck="false" placeholder="VD: TN-2026-0917-00421" />
              <span className="form-field__error" hidden={true}>
              </span>
            </div>
            <div className="form-row-group" data-field="lookupPhone">
              <label htmlFor="lookupPhone">Số điện thoại</label>
              <input type="tel" id="lookupPhone" className="regular-input" inputMode="tel" autoComplete="tel" placeholder="09xx xxx xxx" />
              <span className="form-field__error" hidden={true}>
              </span>
            </div>
            <button type="button" className="btn-primary-teal" data-lookup-submit="">
              <Icon glyph="search" />Tra cứu
            </button>
          </div>
        </section>

        <div className="page-container lookup-body">
          <div className="kh-alert kh-alert--error" data-lookup-error="" role="alert" hidden={true}>
          </div>
          <div className="content-stack" data-lookup-result="" hidden={true}>
          </div>

          <div className="lookup-cta">
            <div>
              <h2 className="card-heading-title">Gửi yêu cầu trước khi mang máy tới</h2>
              <p className="card-heading-desc">Gửi yêu cầu trước khi mang máy tới trạm. Có tài khoản? <a className="dispatch-link" href="/login">Đăng nhập</a> để theo dõi mọi phiếu của bạn.</p>
            </div>
            <button type="button" className="btn-secondary-white" data-open-register="">
              <Icon glyph="plus" />Đăng ký yêu cầu bảo hành mới
            </button>
          </div>

          <section className="content-panel-card" data-register-section="" hidden={true}>
            <div className="panel-head">
              <div>
                <h2 className="card-heading-title">Đăng ký yêu cầu bảo hành trực tuyến</h2>
                <p className="card-heading-desc">Khai báo trước thông tin thiết bị — mang máy tới trung tâm theo thời gian đã chọn.</p>
              </div>
              <button type="button" className="btn-secondary-white btn-sm" data-close-register="">Đóng</button>
            </div>
            <div data-register-success="" hidden={true}>
            </div>
            <h3 className="form-section-title"><span className="form-section-num">1</span>Thông tin liên hệ</h3>
            <div className="two-inputs-grid form-row-group">
              <div className="form-row-group" data-field="regName">
                <label htmlFor="reg-name">Họ và tên *</label>
                <input type="text" id="reg-name" className="regular-input" autoComplete="name" />
                <span className="form-field__error" hidden={true}>
                </span>
              </div>
              <div className="form-row-group" data-field="regPhone">
                <label htmlFor="reg-phone">Số điện thoại *</label>
                <input type="tel" id="reg-phone" className="regular-input" inputMode="tel" autoComplete="tel" placeholder="09xx xxx xxx" />
                <span className="form-field__error" hidden={true}>
                </span>
              </div>
            </div>
            <h3 className="form-section-title"><span className="form-section-num">2</span>Thông tin thiết bị</h3>
            <div className="two-inputs-grid form-row-group">
              <div className="form-row-group" data-field="regCategory">
                <label htmlFor="reg-category">Loại thiết bị *</label>
                <select id="reg-category" className="regular-input">
                  <option value="">
                    {"— Chọn loại thiết bị —"}
                  </option>
                </select>
                <span className="form-field__error" hidden={true}>
                </span>
              </div>
              <div className="form-row-group" data-field="regBrandModel">
                <label htmlFor="reg-brand-model">Hãng / Model *</label>
                <input type="text" id="reg-brand-model" className="regular-input" placeholder="VD: Samsung Inverter RT35K5982" />
                <span className="form-field__error" hidden={true}>
                </span>
              </div>
            </div>
            <div className="form-row-group" data-field="regSerial">
              <label htmlFor="reg-serial" data-reg-serial-label="">Serial Number<span className="required-mark">*</span></label>
              <input type="text" id="reg-serial" className="regular-input mono" />
              <span className="form-field__error" hidden={true}>
              </span>
            </div>
            <div className="form-row-group" data-field="regSymptom">
              <label htmlFor="reg-symptom">Mô tả lỗi *</label>
              <textarea id="reg-symptom" className="regular-input" placeholder="Mô tả chi tiết hiện tượng lỗi…">
              </textarea>
              <span className="form-field__error" hidden={true}>
              </span>
            </div>
            <div className="form-row-group">
              <label htmlFor="reg-media">Ảnh / video lỗi (tối đa 3 tệp)</label>
              <input type="file" id="reg-media" className="regular-input" accept="image/*,video/*" multiple={true} />
              <div className="input-subnote">Không bắt buộc — giúp kỹ thuật viên hình dung lỗi trước khi khách mang máy tới.</div>
            </div>
            <div className="two-inputs-grid form-row-group">
              <div className="form-row-group" data-field="regStation">
                <label htmlFor="reg-station">Trạm dịch vụ *</label>
                <select id="reg-station" className="regular-input">
                  <option value="">— Chọn trạm —</option>
                </select>
                <span className="form-field__error" hidden={true}>
                </span>
              </div>
              <div className="form-row-group" data-field="regTime">
                <label htmlFor="reg-time">Thời gian mong muốn mang máy tới *</label>
                <input type="text" id="reg-time" className="regular-input" placeholder="VD: 19/09/2026 14:00 - 16:00" />
                <span className="form-field__error" hidden={true}>
                </span>
              </div>
            </div>
            <button type="button" className="btn-primary-teal" data-register-submit="">Gửi yêu cầu</button>
          </section>
        </div>
      </main>
      <CustomerFooter />
    </div>
  );
}
