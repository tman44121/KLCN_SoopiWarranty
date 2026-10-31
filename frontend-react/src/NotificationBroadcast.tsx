import { useEffect, useId, useState, type FormEvent } from 'react';
import { api, errorText, useBusy } from './customer';
import { internalRoute } from './navigation';

type Customer = { code: string; fullName: string; phone: string; hasAccount: boolean };

export function NotificationBroadcast() {
  const targetGroup = useId();
  const [target, setTarget] = useState('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, run] = useBusy();

  useEffect(() => {
    let cancelled = false;
    setResults([]);
    setSearchError('');
    setSearching(target === 'specific' && Boolean(query.trim()));
    if (target !== 'specific' || !query.trim()) return;
    const timer = setTimeout(async () => {
      try {
        const page = await api().customers.search(query.trim(), 0, 25);
        if (!cancelled) setResults(page.items.filter((c: Customer) => c.hasAccount));
      } catch (e) {
        if (!cancelled) setSearchError(errorText(e));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, target]);

  const send = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!message.trim()) return setError('Vui lòng nhập nội dung thông báo.');
    if (target === 'specific' && selected.length === 0) return setError('Vui lòng chọn ít nhất một khách hàng.');
    const route = link.trim() ? internalRoute(link.trim()) : null;
    if (link.trim() && !route) return setError('Đường dẫn không hợp lệ. Ví dụ: /account#lich-su.');
    void run(async () => {
      try {
        await api().notifications.broadcast(message.trim(), route, target === 'all' ? null : selected.map(c => c.code).join(','));
        setSuccess(target === 'all' ? 'Đã gửi đến tất cả khách có tài khoản hoạt động.' : `Đã gửi đến ${selected.length} khách hàng.`);
        setMessage('');
        setLink('');
      } catch (e) {
        setError(errorText(e));
      }
    });
  };

  return (
    <section className="card notification-broadcast" aria-label="Gửi thông báo khách hàng">
      <div className="card__header"><div>
        <h2 className="card__title">Gửi thông báo khách hàng</h2>
      </div></div>
      <form className="card__body stack" onSubmit={send}>
        <fieldset className="broadcast-fields stack" disabled={busy}>
          <legend>Người nhận</legend>
          <label><input type="radio" name={targetGroup} checked={target === 'all'} onChange={() => setTarget('all')} /> Tất cả khách hàng đang hoạt động</label>
          <label><input type="radio" name={targetGroup} checked={target === 'specific'} onChange={() => setTarget('specific')} /> Chọn khách cụ thể</label>
          {target === 'specific' && <div className="stack">
            <label className="form-field">Tìm khách hàng
              <input className="text-field" aria-label="Tìm theo tên, số điện thoại hoặc mã khách" placeholder="Tên, SĐT hoặc mã khách" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" />
            </label>
            {searching && <p role="status">Đang tìm khách hàng…</p>}
            {searchError && <p className="form-field__error" role="alert">{searchError}</p>}
            {!searching && query.trim() && !searchError && results.length === 0 && <p>Không tìm thấy khách hàng có tài khoản.</p>}
            <ul className="broadcast-customers" aria-label="Kết quả tìm khách hàng">
              {results.map(c => <li key={c.code}>
                <button type="button" className="btn btn--secondary btn--sm" disabled={selected.some(s => s.code === c.code)}
                  onClick={() => { setSelected(prev => [...prev, c]); setQuery(''); }}>
                  {c.fullName} · {c.phone} · {c.code}
                </button>
              </li>)}
            </ul>
            <ul className="broadcast-customers" aria-label="Khách hàng đã chọn">
              {selected.map(c => <li key={c.code}>
                <button type="button" className="btn btn--secondary btn--sm" aria-label={`Bỏ chọn ${c.fullName}`}
                  onClick={() => setSelected(prev => prev.filter(s => s.code !== c.code))}>{c.fullName} · {c.code} ×</button>
              </li>)}
            </ul>
          </div>}
          <label className="form-field">Nội dung thông báo
            <textarea className="text-field" required maxLength={255} rows={4} value={message} onChange={e => setMessage(e.target.value)} />
            <span className="form-field__help">{message.length} / 255 ký tự</span>
          </label>
          <label className="form-field">Đường dẫn (tùy chọn)
            <input className="text-field" maxLength={255} placeholder="/account#lich-su" value={link} onChange={e => setLink(e.target.value)} />
          </label>
          <button type="submit" className="btn btn--primary">{busy ? 'Đang gửi…' : 'Gửi thông báo'}</button>
        </fieldset>
        {error && <p className="form-field__error" role="alert">{error}</p>}
        {success && <p role="status">{success}</p>}
      </form>
    </section>
  );
}
