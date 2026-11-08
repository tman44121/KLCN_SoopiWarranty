import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { businessDayError, businessHoursNote, businessSlots, businessTimeError, normalizeTime, vietnamToday } from './business-hours.js';
import { loadTimeSettings, subscribeTimeSettings, timeSettings } from './time-settings.js';

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function BusinessDateTime({ id, name, value, onChange, required = false, className = 'text-field' }: {
  id: string; name?: string; value?: string; onChange?: (value: string) => void; required?: boolean; className?: string;
}) {
  const settings = useSyncExternalStore(subscribeTimeSettings, timeSettings);
  useEffect(() => { void loadTimeSettings(); }, []);
  const hidden = useRef<HTMLInputElement>(null);
  const date = useRef<HTMLInputElement>(null);
  const time = useRef<HTMLInputElement>(null);
  const emitted = useRef(value);
  const [error, setError] = useState('');
  const [dayValue, setDayValue] = useState(value?.slice(0, 10) || '');
  const [timeValue, setTimeValue] = useState(value?.slice(11) || '');
  useEffect(() => {
    if (value !== undefined && value !== emitted.current) { setDayValue(value.slice(0, 10)); setTimeValue(value.slice(11)); }
  }, [value]);
  // final = rời ô giờ: lúc đang gõ dở ("08:3") chưa báo lỗi định dạng.
  const update = (final = false) => {
    const day = date.current!.value, hour = normalizeTime(time.current!.value);
    setDayValue(day); setTimeValue(hour);
    const next = day && hour ? `${day}T${hour}` : '';
    const problem = hour && !TIME.test(hour)
      ? (final || hour.length >= 5 ? 'Giờ không hợp lệ. Nhập theo dạng HH:mm (00–23 giờ), ví dụ 08:30.' : '')
      : businessDayError(day) || (next ? businessTimeError(next) : '');
    const ok = !problem && TIME.test(hour) ? next : '';
    setError(problem);
    date.current!.setCustomValidity(problem);
    time.current!.setCustomValidity(problem);
    if (hidden.current) hidden.current.value = ok;
    emitted.current = ok;
    onChange?.(ok);
  };
  return <div className="business-date-time">
    <input ref={hidden} id={id} name={name} type="text" hidden value={value} readOnly />
    <div className="business-date-time__fields">
      <input ref={date} id={`${id}-date`} type="date" className={className} min={vietnamToday()}
        value={dayValue} onInput={() => update()} onChange={() => update()}
        aria-label="Ngày hẹn" aria-describedby={`${id}-hours ${id}-error`} aria-required={required || undefined} aria-invalid={!!error || undefined} />
      <input ref={time} id={`${id}-time`} type="text" list={`${id}-times`} className={className}
        placeholder="HH:mm" maxLength={5} inputMode="numeric" aria-label="Giờ hẹn (HH:mm, 24 giờ)" aria-required={required || undefined}
        aria-invalid={!!error || undefined} aria-describedby={`${id}-hours ${id}-error`}
        value={timeValue} onInput={() => update()} onChange={() => update()} onBlur={() => update(true)} />
      <datalist id={`${id}-times`}>
        {businessSlots(settings).map(slot => <option key={slot.value} value={slot.value} />)}
      </datalist>
    </div>
    <p id={`${id}-hours`} className="input-subnote">{businessHoursNote(settings)}</p>
    <p id={`${id}-error`} className="form-field__error" role="alert" hidden={!error}>{error}</p>
  </div>;
}
