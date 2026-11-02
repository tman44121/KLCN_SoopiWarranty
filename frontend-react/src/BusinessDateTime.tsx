import { useEffect, useRef, useState } from 'react';
import { BUSINESS_HOURS_NOTE, businessSlots, businessTimeError, vietnamToday } from './business-hours.js';

export function BusinessDateTime({ id, name, value, onChange, required = false, className = 'text-field' }: {
  id: string; name?: string; value?: string; onChange?: (value: string) => void; required?: boolean; className?: string;
}) {
  const hidden = useRef<HTMLInputElement>(null);
  const date = useRef<HTMLInputElement>(null);
  const time = useRef<HTMLSelectElement>(null);
  const [error, setError] = useState('');
  const [dayValue, setDayValue] = useState(value?.slice(0, 10) || '');
  const [timeValue, setTimeValue] = useState(value?.slice(11) || '');
  useEffect(() => {
    if (value !== undefined) { setDayValue(value.slice(0, 10)); setTimeValue(value.slice(11)); }
  }, [value]);
  const update = () => {
    const day = date.current!.value, hour = time.current!.value;
    setDayValue(day); setTimeValue(hour);
    const next = day && hour ? `${day}T${hour}` : '';
    const problem = day && new Date(`${day}T00:00:00Z`).getUTCDay() === 0 ? 'Chủ nhật không nhận lịch. Vui lòng chọn thứ Hai–thứ Bảy.' : next ? businessTimeError(next) : '';
    setError(problem);
    date.current!.setCustomValidity(problem);
    if (hidden.current) hidden.current.value = problem ? '' : next;
    onChange?.(problem ? '' : next);
  };
  return <div className="business-date-time">
    <input ref={hidden} id={id} name={name} type="text" hidden value={value} readOnly />
    <div className="business-date-time__fields">
      <input ref={date} id={`${id}-date`} type="date" className={className} min={vietnamToday()}
        value={value === undefined ? undefined : dayValue} onInput={update} onChange={update}
        aria-label="Ngày hẹn" aria-describedby={`${id}-hours ${id}-error`} aria-required={required || undefined} aria-invalid={!!error || undefined} />
      <select ref={time} id={`${id}-time`} className={className} aria-label="Giờ hẹn AM/PM" aria-required={required || undefined} aria-describedby={`${id}-hours ${id}-error`}
        value={value === undefined ? undefined : timeValue} onChange={update} defaultValue={value === undefined ? '' : undefined}>
        <option value="">Chọn giờ</option>
        {businessSlots.map(slot => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
      </select>
    </div>
    <p id={`${id}-hours`} className="input-subnote">{BUSINESS_HOURS_NOTE}</p>
    <p id={`${id}-error`} className="form-field__error" role="alert" hidden={!error}>{error}</p>
  </div>;
}
