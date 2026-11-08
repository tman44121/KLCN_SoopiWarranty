import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { api, errorText, useBusy } from './customer';
import { DEFAULT_TIME_SETTINGS, setTimeSettings } from './time-settings.js';
import { normalizeTime } from './business-hours.js';
import { DEFAULT_PROTECTION_SETTINGS } from './protection-settings.js';

const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

type Settings = {
  expressSlaHours: number; prioritySlaHours: number; standardSlaHours: number; defaultSlaLevel: string;
  atRiskMinutes: number; quotationValidityHours: number; openAt: string; closeAt: string; workingDays: number[];
  protection: typeof DEFAULT_PROTECTION_SETTINGS;
};
type Protection = Settings['protection'];
type ProtectionNumber = { [K in keyof Protection]: Protection[K] extends number ? K : never }[keyof Protection];
type ProtectionLimit = Exclude<keyof Protection, ProtectionNumber>;

const DAYS = [[1, 'Thứ Hai'], [2, 'Thứ Ba'], [3, 'Thứ Tư'], [4, 'Thứ Năm'], [5, 'Thứ Sáu'], [6, 'Thứ Bảy'], [7, 'Chủ nhật']] as const;
const LEVELS = [['STANDARD_48H', 'Tiêu chuẩn'], ['PRIORITY_24H', 'Ưu tiên'], ['EXPRESS_12H', 'Nhanh']] as const;

/** Quản trị viên chỉnh SLA, ngưỡng sắp trễ, hạn báo giá và giờ làm việc (PUT /settings/time). */
export function TimeSettings() {
  const [form, setForm] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, run] = useBusy();
  const id = useId();

  useEffect(() => {
    api().settings.adminTime().then((value: Settings) => setForm(value)).catch((e: unknown) => setError(errorText(e)));
  }, []);

  if (!form) return <section className="card" aria-label="Cấu hình thời gian"><div className="card__body">
    {error ? <p className="form-field__error" role="alert">{error}</p> : <p role="status">Đang tải cấu hình…</p>}
  </div></section>;

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => { setForm({ ...form, [key]: value }); setSuccess(''); };
  const number = (key: 'expressSlaHours' | 'prioritySlaHours' | 'standardSlaHours' | 'atRiskMinutes' | 'quotationValidityHours',
    label: string, unit: string, max: number, help?: string) =>
    <div className="form-field">
      <label htmlFor={id + key}>{label} ({unit})</label>
      <input id={id + key} className="text-field" type="number" required min={1} max={max} step={1} inputMode="numeric"
        aria-describedby={help ? id + key + '-help' : undefined}
        value={Number.isNaN(form[key]) ? '' : form[key]} onChange={e => set(key, e.target.valueAsNumber)} />
      {help && <span id={id + key + '-help'} className="form-field__help">{help}</span>}
    </div>;
  const toggleDay = (day: number, on: boolean) =>
    set('workingDays', on ? [...form.workingDays, day].sort((a, b) => a - b) : form.workingDays.filter(d => d !== day));
  const protectionNumber = (key: ProtectionNumber, label: string, unit: string, max: number) =>
    <div className="form-field">
      <label htmlFor={id + key}>{label} ({unit})</label>
      <input id={id + key} className="text-field" type="number" required min={1} max={max} step={1} inputMode="numeric"
        value={Number.isNaN(form.protection[key]) ? '' : form.protection[key]}
        onChange={e => set('protection', { ...form.protection, [key]: e.target.valueAsNumber })} />
    </div>;
  const rate = (key: ProtectionLimit, label: string) => <fieldset className="time-settings__rate">
    <legend>{label}</legend>
    <div className="time-settings__grid">
      {(['limit', 'windowMinutes'] as const).map(field => <div className="form-field" key={field}>
        <label htmlFor={id + key + field}>{field === 'limit' ? 'Tối đa (lượt)' : 'Trong khoảng (phút)'}</label>
        <input id={id + key + field} className="text-field" type="number" required min={1} max={field === 'limit' ? 10000 : 1440} step={1} inputMode="numeric"
          value={Number.isNaN(form.protection[key][field]) ? '' : form.protection[key][field]}
          onChange={e => set('protection', { ...form.protection, [key]: { ...form.protection[key], [field]: e.target.valueAsNumber } })} />
      </div>)}
    </div>
  </fieldset>;

  const save = (event: FormEvent) => {
    event.preventDefault();
    setError(''); setSuccess('');
    if (form.expressSlaHours > form.prioritySlaHours || form.prioritySlaHours > form.standardSlaHours)
      return setError('Số giờ SLA phải tăng dần: Nhanh ≤ Ưu tiên ≤ Tiêu chuẩn.');
    if (!CLOCK.test(form.openAt) || !CLOCK.test(form.closeAt)) return setError('Giờ mở/đóng cửa nhập theo dạng HH:mm (24 giờ), ví dụ 08:00.');
    if (form.openAt >= form.closeAt) return setError('Giờ mở cửa phải trước giờ đóng cửa.');
    if (form.workingDays.length === 0) return setError('Chọn ít nhất một ngày làm việc.');
    const p = form.protection;
    if (p.accessTokenMinutes > p.refreshTokenHours * 60 || p.refreshTokenHours > p.rememberTokenDays * 24)
      return setError('Hạn phiên truy cập ≤ hạn đăng nhập thường ≤ hạn ghi nhớ đăng nhập.');
    void run(async () => {
      try {
        const saved = await api().settings.saveTime(form);
        setForm(saved);
        setTimeSettings(saved);
        setSuccess('Đã lưu. Cấu hình áp dụng cho các lượt xử lý tiếp theo; hạn phiên đã cấp và thời điểm hết khóa đã lưu được giữ nguyên.');
      } catch (e) {
        setError(errorText(e));
      }
    });
  };

  const section = (key: string, title: string, description: string, body: ReactNode) =>
    <section className="time-settings__section" aria-labelledby={id + key}>
      <div className="time-settings__intro">
        <h3 className="time-settings__heading" id={id + key}>{title}</h3>
        <p className="time-settings__desc">{description}</p>
      </div>
      <div className="time-settings__fields">{body}</div>
    </section>;
  const protectionSection = (title: string, description: string, body: ReactNode) =>
    <details className="time-settings__protection">
      <summary>{title}</summary>
      <p className="time-settings__desc">{description}</p>
      <div className="time-settings__fields">{body}</div>
    </details>;

  return (
    <section className="card time-settings" aria-labelledby="time-settings-title">
      <div className="card__header"><div>
        <h2 className="card__title" id="time-settings-title">Cấu hình thời gian</h2>
      </div></div>
      <form className="card__body" onSubmit={save}>
        <fieldset className="time-settings__all" disabled={busy}>
          {section('sla', 'SLA cam kết', 'Thời hạn xử lý phiếu theo từng mức. Chỉ áp dụng cho phiếu tạo sau khi lưu; phiếu cũ giữ hạn SLA đã tính.',
            <div className="time-settings__grid">
              {number('standardSlaHours', 'Tiêu chuẩn', 'giờ', 720)}
              {number('prioritySlaHours', 'Ưu tiên', 'giờ', 720)}
              {number('expressSlaHours', 'Nhanh', 'giờ', 720)}
              <div className="form-field">
                <label htmlFor={id + 'level'}>Mức mặc định khi lập phiếu</label>
                <select id={id + 'level'} className="select-field" value={form.defaultSlaLevel} onChange={e => set('defaultSlaLevel', e.target.value)}>
                  {LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>)}

          {section('alerts', 'Cảnh báo và báo giá', 'Lúc phiếu được báo “sắp trễ” và thời gian khách có để xác nhận báo giá.',
            <div className="time-settings__grid">
              {number('atRiskMinutes', 'Báo “sắp trễ” trước hạn SLA', 'phút', 1440, 'Dùng cho cảnh báo, bộ lọc và báo cáo SLA.')}
              {number('quotationValidityHours', 'Hạn khách xác nhận báo giá', 'giờ', 720,
                'Tính từ lúc duyệt khi báo giá không ghi ngày hiệu lực; áp dụng cả báo giá đang chờ.')}
            </div>)}

          {section('hours', 'Giờ làm việc', 'Áp dụng cho giờ hẹn của khách và giờ nhận máy.', <>
            <div className="time-settings__grid">
              <div className="form-field">
                <label htmlFor={id + 'open'}>Giờ mở cửa (HH:mm)</label>
                <input id={id + 'open'} className="text-field" type="text" inputMode="numeric" maxLength={5} placeholder="08:00" required
                  value={form.openAt} onChange={e => set('openAt', normalizeTime(e.target.value))} />
              </div>
              <div className="form-field">
                <label htmlFor={id + 'close'}>Giờ đóng cửa (HH:mm)</label>
                <input id={id + 'close'} className="text-field" type="text" inputMode="numeric" maxLength={5} placeholder="17:00" required
                  value={form.closeAt} onChange={e => set('closeAt', normalizeTime(e.target.value))} />
              </div>
            </div>
            <div className="form-field">
              <span className="time-settings__label" id={id + 'days'}>Ngày làm việc</span>
              <div className="time-settings__days" role="group" aria-labelledby={id + 'days'}>
                {DAYS.map(([day, label]) => <label key={day} className="time-settings__day">
                  <input type="checkbox" checked={form.workingDays.includes(day)} onChange={e => toggleDay(day, e.target.checked)} />
                  {label}
                </label>)}
              </div>
            </div>
          </>)}

          {protectionSection('Đăng nhập và khóa tài khoản', 'Sai mật khẩu đủ số lần sẽ khóa tài khoản. Giới hạn tần suất cũng áp dụng khi kiểm tra mật khẩu hiện tại.', <>
            <div className="time-settings__grid">
              {protectionNumber('loginMaxFailedAttempts', 'Sai mật khẩu trước khi khóa', 'lần', 20)}
              {protectionNumber('loginLockMinutes', 'Thời gian khóa tài khoản', 'phút', 1440)}
            </div>
            {rate('loginIp', 'Đăng nhập theo địa chỉ IP')}
            {rate('loginAccount', 'Đăng nhập theo tài khoản')}
          </>)}

          {protectionSection('Mã OTP qua email', 'Mỗi mã dùng một lần. Hạn mới áp dụng cho mã gửi sau khi lưu; số lần thử áp dụng khi kiểm tra mã.', <>
            <div className="time-settings__grid">
              {protectionNumber('otpValidityMinutes', 'Hạn mã OTP', 'phút', 30)}
              {protectionNumber('otpResendSeconds', 'Chờ gửi lại OTP', 'giây', 3600)}
              {protectionNumber('otpMaxFailedAttempts', 'Số lần sai OTP tối đa', 'lần', 10)}
            </div>
            {rate('otpIp', 'Yêu cầu OTP theo địa chỉ IP')}
            {rate('otpEmail', 'Gửi OTP theo email, chung mọi mục đích')}
          </>)}

          {protectionSection('Gửi phiếu và tra cứu', 'Vượt số lượt thì chờ hết khoảng giới hạn tính từ lượt đầu; thử gửi tiếp không kéo dài thời gian chặn.', <>
            {rate('publicRequestsIp', 'Gửi phiếu vãng lai theo địa chỉ IP')}
            {rate('customerRequests', 'Gửi phiếu theo tài khoản khách hàng')}
            {rate('warrantyCheckIp', 'Kiểm tra bảo hành theo địa chỉ IP')}
            {rate('lookupIp', 'Tra cứu phiếu theo địa chỉ IP')}
            {rate('lookupCode', 'Tra cứu theo mã phiếu hoặc Serial/IMEI')}
          </>)}

          {protectionSection('Thời hạn phiên đăng nhập', 'Áp dụng khi cấp hoặc làm mới phiên. Không thu hồi các phiên đang còn hạn.',
            <div className="time-settings__grid">
              {protectionNumber('accessTokenMinutes', 'Hạn phiên truy cập', 'phút', 1440)}
              {protectionNumber('refreshTokenHours', 'Hạn đăng nhập thường', 'giờ', 720)}
              {protectionNumber('rememberTokenDays', 'Hạn ghi nhớ đăng nhập', 'ngày', 90)}
              {protectionNumber('portalTokenMinutes', 'Hạn phiên tra cứu công khai', 'phút', 1440)}
            </div>)}
        </fieldset>

        <div className="time-settings__footer">
          <div className="time-settings__actions">
            <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu cấu hình'}</button>
            <button type="button" className="btn btn--secondary" disabled={busy}
              onClick={() => { setForm({ ...DEFAULT_TIME_SETTINGS, workingDays: [...DEFAULT_TIME_SETTINGS.workingDays], protection: structuredClone(DEFAULT_PROTECTION_SETTINGS) }); setSuccess(''); setError(''); }}>
              Điền giá trị mặc định
            </button>
          </div>
          {error && <p className="form-field__error" role="alert">{error}</p>}
          {success && <p className="time-settings__saved" role="status">{success}</p>}
        </div>
      </form>
    </section>
  );
}
