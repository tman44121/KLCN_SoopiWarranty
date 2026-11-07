export const BUSINESS_HOURS_NOTE = 'Thứ Hai–thứ Bảy, 08:00–17:00 (giờ Việt Nam).';
export const businessSlots = Array.from({ length: 37 }, (_, i) => {
  const minutes = 480 + i * 15, hour = Math.floor(minutes / 60), minute = String(minutes % 60).padStart(2, '0');
  const value = `${String(hour).padStart(2, '0')}:${minute}`;
  return { value, label: value };
});
/** Chỉ giữ số và ":"; "0830" → "08:30", "8:30" → "08:30", "31231" → "31:23". */
export function normalizeTime(raw) {
  const [h = '', m] = String(raw || '').replace(/[^\d:]/g, '').split(':');
  const t = m === undefined ? (h.length > 2 ? `${h.slice(0, 2)}:${h.slice(2, 4)}` : h) : `${h.slice(0, 2)}:${m.slice(0, 2)}`;
  return /^\d:\d\d$/.test(t) ? `0${t}` : t;
}
export const businessInstant = value => new Date(`${value}+07:00`);
export const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
export function businessTimeError(value) {
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return 'Vui lòng chọn ngày và nhập giờ theo dạng HH:mm (24 giờ).';
  const [day, time] = value.split('T'), date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day || date.getUTCDay() === 0 || time < '08:00' || time > '17:00')
    return `Chỉ nhận lịch ${BUSINESS_HOURS_NOTE}`;
  return '';
}
export function appointmentEnd(value) {
  const [day, time] = value.split('T'), [h, m] = time.split(':').map(Number);
  const end = Math.min(1020, h * 60 + m + 60);
  return `${day}T${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}
