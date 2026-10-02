import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { usePage } from "../usePage";

export default function PortalPage() {
  usePage("portal", {"class": "is-fluid"}, "Soopi — Tra cứu sửa chữa");
  return (<>
    <header className="portal-header">
      <div>
        <div className="portal-header__brand-name">
          {"Soopi"}
        </div>
        <div className="portal-header__brand-sub">
          {"Tra cứu sửa chữa"}
        </div>
      </div>
    </header>
    <main className="portal-main">
      <section className="card" data-lookup-section="">
        <div className="card__header">
          <div>
            <h2 className="card__title">
              {"Tra cứu tiến độ sửa chữa"}
            </h2>
            <div className="card__title-meta">
              {"Nhập mã phiếu (TN- hoặc YC-) và số điện thoại đã đăng ký để xem tiến độ"}
            </div>
          </div>
          <button type="button" className="btn btn--secondary btn--sm" data-open-register="">
            {"Đăng ký yêu cầu bảo hành mới"}
          </button>
        </div>
        <div className="card__body stack">
          <div className="form-row">
            <div className="form-field" data-field="lookupId">
              <label htmlFor="lookupId">
                {"Mã phiếu"}
                <span className="required-mark">
                  {"*"}
                </span>
              </label>
              <input type="text" id="lookupId" className="mono" autoCapitalize="characters" autoComplete="off" spellCheck="false" placeholder="VD: TN-2026-0917-00421" />
              <span className="form-field__error" hidden={true}>
              </span>
            </div>
            <div className="form-field" data-field="lookupPhone">
              <label htmlFor="lookupPhone">
                {"Số điện thoại"}
                <span className="required-mark">
                  {"*"}
                </span>
              </label>
              <input type="tel" id="lookupPhone" inputMode="tel" autoComplete="tel" placeholder="09xx xxx xxx" />
              <span className="form-field__error" hidden={true}>
              </span>
            </div>
          </div>
          <div>
            <button type="button" className="btn btn--primary" data-lookup-submit="">
              {"Tra cứu tiến độ"}
            </button>
          </div>
          <div data-lookup-error="" hidden={true}>
          </div>
        </div>
      </section>
      <section className="card" data-register-section="" hidden={true}>
        <div className="card__header">
          <div>
            <h2 className="card__title">
              {"Đăng ký yêu cầu bảo hành trực tuyến"}
            </h2>
            <div className="card__title-meta">
              {"Khai báo trước thông tin thiết bị — mang máy tới trung tâm theo thời gian đã chọn"}
            </div>
          </div>
          <button type="button" className="btn btn--secondary btn--sm" data-close-register="">
            {"Đóng"}
          </button>
        </div>
        <div className="card__body stack">
          <div className="form-row">
            <div className="form-field" data-field="regName">
              <label htmlFor="reg-name">
                {"Họ và tên"}
                <span className="required-mark">
                  {"*"}
                </span>
              </label>
              <input type="text" id="reg-name" />
              <span className="form-field__error" hidden={true}>
              </span>
            </div>
            <div className="form-field" data-field="regPhone">
              <label htmlFor="reg-phone">
                {"Số điện thoại"}
                <span className="required-mark">
                  {"*"}
                </span>
              </label>
              <input type="tel" id="reg-phone" inputMode="tel" autoComplete="tel" placeholder="09xx xxx xxx" />
              <span className="form-field__error" hidden={true}>
              </span>
            </div>
          </div>
          <div className="form-row">
            <div className="form-field" data-field="regCategory">
              <label htmlFor="reg-category">
                {"Loại thiết bị"}
                <span className="required-mark">
                  {"*"}
                </span>
              </label>
              <select id="reg-category">
                <option value="">
                  {"— Chọn loại thiết bị —"}
                </option>
              </select>
              <span className="form-field__error" hidden={true}>
              </span>
            </div>
            <div className="form-field" data-field="regBrandModel">
              <label htmlFor="reg-brand-model">
                {"Hãng/Model"}
                <span className="required-mark">
                  {"*"}
                </span>
              </label>
              <input type="text" id="reg-brand-model" placeholder="VD: Samsung Inverter RT35K5982" />
              <span className="form-field__error" hidden={true}>
              </span>
            </div>
          </div>
          <div className="form-field" data-field="regSerial">
            <label htmlFor="reg-serial" data-reg-serial-label="">
              {"Serial Number"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <input type="text" id="reg-serial" className="mono" />
            <span className="form-field__error" hidden={true}>
            </span>
          </div>
          <div className="form-field" data-field="regSymptom">
            <label htmlFor="reg-symptom">
              {"Mô tả lỗi khách hàng"}
              <span className="required-mark">
                {"*"}
              </span>
            </label>
            <textarea id="reg-symptom" placeholder="Mô tả chi tiết hiện tượng lỗi…">
            </textarea>
            <span className="form-field__error" hidden={true}>
            </span>
          </div>
          <div className="form-field">
            <label htmlFor="reg-media">
              {"Ảnh/video lỗi (tối đa 3 tệp)"}
            </label>
            <input type="file" id="reg-media" accept="image/*,video/*" multiple={true} />
            <span className="form-field__helper">
              {"Không bắt buộc — giúp kỹ thuật viên hình dung lỗi trước khi khách mang máy tới."}
            </span>
          </div>
          <div className="form-row">
            <div className="form-field" data-field="regStation">
              <label htmlFor="reg-station">
                {"Trạm dịch vụ"}
                <span className="required-mark">
                  {"*"}
                </span>
              </label>
              <select id="reg-station">
                <option>
                  {"Trạm HCM"}
                </option>
                <option>
                  {"Trạm Hà Nội"}
                </option>
              </select>
            </div>
            <div className="form-field" data-field="regTime">
              <label htmlFor="reg-time">
                {"Thời gian mong muốn mang máy tới"}
                <span className="required-mark">
                  {"*"}
                </span>
              </label>
              <input type="text" id="reg-time" placeholder="VD: 19/09/2026 14:00 - 16:00" />
              <span className="form-field__error" hidden={true}>
              </span>
            </div>
          </div>
          <div>
            <button type="button" className="btn btn--primary" data-register-submit="">
              {"Gửi yêu cầu"}
            </button>
          </div>
          <div data-register-success="" hidden={true}>
          </div>
        </div>
      </section>
      <div className="stack stack--loose" data-lookup-result="" hidden={true}>
      </div>
    </main>
  </>);
}
