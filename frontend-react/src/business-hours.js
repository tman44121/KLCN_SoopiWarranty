export const BUSINESS_HOURS_NOTE = 'Thứ Hai–thứ Bảy, 08:00 AM–05:00 PM (giờ Việt Nam).';
export const businessSlots = Array.from({ length: 37 }, (_, i) => {
  const minutes = 480 + i * 15, hour = Math.floor(minutes / 60), minute = String(minutes % 60).padStart(2, '0');
  return { value: `${String(hour).padStart(2, '0')}:${minute}`, label: `${String(hour % 12 || 12).padStart(2, '0')}:${minute} ${hour < 12 ? 'AM' : 'PM'}` };
});
export const businessInstant = value => new Date(`${value}+07:00`);
export const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
export function businessTimeError(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '')) return 'Vui lòng chọn ngày và giờ hẹn.';
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
