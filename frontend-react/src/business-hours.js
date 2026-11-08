import { timeSettings } from './time-settings.js';

const DAY_NAMES = ['', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy', 'Chủ nhật'];
const toMinutes = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
const toTime = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
/** Ngày ISO (1 = thứ Hai … 7 = Chủ nhật) của chuỗi YYYY-MM-DD, không phụ thuộc múi giờ máy khách. */
const isoDay = day => new Date(`${day}T00:00:00Z`).getUTCDay() || 7;

/** VD "thứ Hai–thứ Bảy" hoặc "thứ Hai, thứ Tư" (cùng cách ghép với máy chủ). */
export function workingDaysText(s = timeSettings()) {
  const days = [...s.workingDays].sort((a, b) => a - b);
  return days.length > 2 && days.at(-1) - days[0] === days.length - 1
    ? `${DAY_NAMES[days[0]]}–${DAY_NAMES[days.at(-1)]}`
    : days.map(day => DAY_NAMES[day]).join(', ');
}

export function businessHoursNote(s = timeSettings()) {
  const days = workingDaysText(s);
  return `${days.charAt(0).toUpperCase()}${days.slice(1)}, ${s.openAt}–${s.closeAt} (giờ Việt Nam).`;
}

/** Gợi ý mỗi 15 phút từ giờ mở cửa tới giờ đóng cửa (gồm cả giờ đóng cửa). */
export function businessSlots(s = timeSettings()) {
  const open = toMinutes(s.openAt), close = toMinutes(s.closeAt), slots = [];
  for (let minutes = open; minutes <= close; minutes += 15) slots.push({ value: toTime(minutes), label: toTime(minutes) });
  if (slots.at(-1)?.value !== s.closeAt) slots.push({ value: s.closeAt, label: s.closeAt });
  return slots;
}

/** Chỉ giữ số và ":"; "0830" → "08:30", "8:30" → "08:30", "31231" → "31:23". */
export function normalizeTime(raw) {
  const [h = '', m] = String(raw || '').replace(/[^\d:]/g, '').split(':');
  const t = m === undefined ? (h.length > 2 ? `${h.slice(0, 2)}:${h.slice(2, 4)}` : h) : `${h.slice(0, 2)}:${m.slice(0, 2)}`;
  return /^\d:\d\d$/.test(t) ? `0${t}` : t;
}
export const businessInstant = value => new Date(`${value}+07:00`);
export const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

/** Lỗi ngày nghỉ (chuỗi rỗng nếu ngày YYYY-MM-DD là ngày làm việc). */
export function businessDayError(day, s = timeSettings()) {
  if (!day || s.workingDays.includes(isoDay(day))) return '';
  const name = DAY_NAMES[isoDay(day)];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} không nhận lịch. Vui lòng chọn ${workingDaysText(s)}.`;
}

export function businessTimeError(value, s = timeSettings()) {
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return 'Vui lòng chọn ngày và nhập giờ theo dạng HH:mm (24 giờ).';
  const [day, time] = value.split('T'), date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day || !s.workingDays.includes(isoDay(day))
    || time < s.openAt || time > s.closeAt)
    return `Chỉ nhận lịch ${businessHoursNote(s)}`;
  return '';
}

/** Hẹn kéo dài 60 phút nhưng không quá giờ đóng cửa. */
export function appointmentEnd(value, s = timeSettings()) {
  const [day, time] = value.split('T');
  return `${day}T${toTime(Math.min(toMinutes(s.closeAt), toMinutes(time) + 60))}`;
}
