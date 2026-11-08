/* Mốc thời gian hệ thống (GET /settings/time, công khai). Chưa tải xong hoặc lỗi mạng thì dùng mặc định giống máy chủ;
   máy chủ vẫn kiểm lại giờ hẹn và tính hạn SLA/báo giá. Ngày làm việc ISO: 1 = thứ Hai … 7 = Chủ nhật. */
export const DEFAULT_TIME_SETTINGS = Object.freeze({
  expressSlaHours: 12, prioritySlaHours: 24, standardSlaHours: 48, defaultSlaLevel: 'STANDARD_48H',
  atRiskMinutes: 120, quotationValidityHours: 72, openAt: '08:00', closeAt: '17:00', workingDays: [1, 2, 3, 4, 5, 6],
});

let current = DEFAULT_TIME_SETTINGS;
let loading = null;
const listeners = new Set();

export const timeSettings = () => current;

export function setTimeSettings(value) {
  current = Object.freeze({ ...DEFAULT_TIME_SETTINGS, ...value });
  listeners.forEach(listener => listener());
}

export function subscribeTimeSettings(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tải một lần mỗi trang; không gửi token (endpoint công khai, tránh 401 khi token cũ hết hạn). */
export function loadTimeSettings(fetcher = globalThis.fetch) {
  const base = (import.meta.env?.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
  loading ??= fetcher(`${base}/settings/time`, { headers: { Accept: 'application/json' } })
    .then(response => (response.ok ? response.json() : null))
    .then(value => { if (value && typeof value === 'object' && !Array.isArray(value)) setTimeSettings(value); return current; })
    .catch(() => current);
  return loading;
}

export const slaHours = (level, s = current) =>
  ({ EXPRESS_12H: s.expressSlaHours, PRIORITY_24H: s.prioritySlaHours }[level] ?? s.standardSlaHours);
