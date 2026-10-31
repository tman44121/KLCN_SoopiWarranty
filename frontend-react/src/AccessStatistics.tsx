import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, errorText } from './customer';

type Filters = { from: string; to: string; kind: string; role: string; q: string };
type Day = { day: string; visits: number; accounts: number; logins: number; failed: number };
type Summary = { trackingStart: string; from: string; to: string; generatedAt: string; totalVisits: number; visits: number; accounts: number; online: number; logins: number; failed: number; days: Day[] };
type Online = { accountId: string; username: string; fullName: string; kind: string; roles: string; startedAt: string; lastSeenAt: string; sessions: number };
type Log = { id: string; at: string; username: string; fullName: string; kind: string; roles: string; action: string; label: string };
type Page<T> = { items: T[]; page: number; totalItems: number; totalPages: number };
const emptyFilters: Filters = { from: '', to: '', kind: '', role: '', q: '' };
const roles = [['ADMIN', 'Quản trị viên'], ['RECEPTIONIST', 'Tiếp nhận'], ['DISPATCHER', 'Điều phối'], ['TECHNICIAN', 'Kỹ thuật viên'], ['CASHIER', 'Thu ngân'], ['WAREHOUSE_KEEPER', 'Kho'], ['CUSTOMER', 'Khách hàng']];
const date = (value: string) => new Date(value + 'T00:00:00+07:00').toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const time = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const number = (value: number) => value.toLocaleString('vi-VN');
const roleNames = (value: string) => value.split(',').map(code => roles.find(r => r[0] === code)?.[1] || code).join(', ');
const kindName = (value: string) => value === 'CUSTOMER' ? 'Khách hàng' : value === 'EMPLOYEE' ? 'Nội bộ' : 'Chưa xác định';

function Pagination({ page, totalPages, disabled, change }: { page: number; totalPages: number; disabled: boolean; change: (page: number) => void }) {
  return <div className="access-pagination"><button className="btn btn--secondary" disabled={disabled || page === 0} onClick={() => change(page - 1)}>Trước</button>
    <span>Trang {page + 1} / {Math.max(1, totalPages)}</span><button className="btn btn--secondary" disabled={disabled || page + 1 >= totalPages} onClick={() => change(page + 1)}>Sau</button></div>;
}

export function AccessStatistics() {
  const [enabled, setEnabled] = useState(false);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [online, setOnline] = useState<Page<Online> | null>(null);
  const [logs, setLogs] = useState<Page<Log> | null>(null);
  const [onlinePage, setOnlinePage] = useState(0);
  const [logPage, setLogPage] = useState(0);
  const [dailyPage, setDailyPage] = useState(0);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [exportError, setExportError] = useState('');
  const version = useRef(0);
  const chart = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false, authorized = false;
    const update = () => { if (!disposed) setEnabled(authorized && location.hash === '#access'); };
    (window as any).LML_AUTH?.ready((user: any) => { authorized = user.roles.some((r: any) => r.code === 'ADMIN'); update(); });
    document.addEventListener('lml:panel-shown', update); window.addEventListener('hashchange', update);
    return () => { disposed = true; document.removeEventListener('lml:panel-shown', update); window.removeEventListener('hashchange', update); };
  }, []);

  const load = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    try {
      const [s, o, l] = await Promise.all([api().access.summary(filters), api().access.online({ ...filters, page: onlinePage, size: 25 }),
        api().access.logs({ ...filters, action, page: logPage, size: 25 })]);
      if (current !== version.current) return;
      setSummary(s); setOnline(o); setLogs(l); setError('');
      if (onlinePage > 0 && onlinePage >= o.totalPages) setOnlinePage(Math.max(0, o.totalPages - 1));
    } catch (e) { if (current === version.current) setError(errorText(e)); }
    finally { if (current === version.current) setLoading(false); }
  }, [filters, onlinePage, logPage, action]);
  useEffect(() => {
    if (!enabled) return;
    void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 15000);
    return () => { clearInterval(timer); version.current++; };
  }, [enabled, load]);
  useEffect(() => {
    if (summary && chart.current) (window as any).LML_CHARTS?.columns(chart.current, {
      title: 'Lượt truy cập theo ngày', headers: ['Ngày', 'Lượt bắt đầu'],
      rows: summary.days.slice(-90).map(d => ({ label: date(d.day), value: d.visits, display: number(d.visits) })),
    });
  }, [summary]);

  const apply = (event: FormEvent) => {
    event.preventDefault();
    if ((draft.from && draft.to && draft.from > draft.to) || (summary && draft.from && draft.from < summary.trackingStart)) {
      setFormError('Khoảng ngày không hợp lệ. Chọn từ ngày bắt đầu lưu đến ngày kết thúc.'); return;
    }
    setFormError(''); setExportError(''); setOnlinePage(0); setLogPage(0); setDailyPage(0);
    setSummary(null); setOnline(null); setLogs(null); setFilters({ ...draft, q: draft.q.trim() });
  };
  const reset = () => { setDraft(emptyFilters); setFilters({ ...emptyFilters }); setAction(''); setOnlinePage(0); setLogPage(0); setDailyPage(0); setFormError(''); setExportError(''); };
  const download = async () => {
    if (!summary || exporting) return;
    setExporting(true); setExportError('');
    try {
      const blob = await api().access.export({ ...filters, from: summary.from, to: summary.to, action });
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = `soopi-truy-cap-${summary.from}-${summary.to}.xlsx`; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setExportError(errorText(e)); }
    finally { setExporting(false); }
  };
  const days = summary?.days.slice().reverse() || [];
  const updateDraft = (key: keyof Filters, value: string) => setDraft(old => ({ ...old, [key]: value }));

  return <section className="access-report" aria-label="Nhật ký đăng nhập và truy cập">
    <div className="card"><div className="card__header"><div><h2 className="card__title">Nhật ký đăng nhập &amp; Truy cập</h2>
      <p className="access-meta">Lưu từ {summary ? date(summary.trackingStart) : '31/10/2026'}</p></div>
      <button className="btn btn--secondary" disabled={loading} onClick={() => void load()}>Làm mới</button></div>
      <form className="access-filters" onSubmit={apply}>
        <label>Từ ngày<input aria-label="Từ ngày" type="date" min={summary?.trackingStart} value={draft.from} onChange={e => updateDraft('from', e.target.value)} /></label>
        <label>Đến ngày<input aria-label="Đến ngày" type="date" min={summary?.trackingStart} value={draft.to} onChange={e => updateDraft('to', e.target.value)} /></label>
        <label>Loại tài khoản<select aria-label="Loại tài khoản" value={draft.kind} onChange={e => updateDraft('kind', e.target.value)}><option value="">Tất cả</option><option value="CUSTOMER">Khách hàng</option><option value="EMPLOYEE">Nội bộ</option></select></label>
        <label>Vai trò<select aria-label="Vai trò" value={draft.role} onChange={e => updateDraft('role', e.target.value)}><option value="">Tất cả</option>{roles.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
        <label>Tìm tài khoản<input aria-label="Tìm tài khoản / họ tên / mã" placeholder="Tên, tài khoản hoặc mã" type="search" maxLength={100} value={draft.q} onChange={e => updateDraft('q', e.target.value)} /></label>
        <div className="access-actions"><button className="btn btn--primary" type="submit" disabled={loading}>Áp dụng</button><button className="btn btn--secondary" type="button" onClick={reset}>Toàn bộ lịch sử</button></div>
      </form>
      {formError && <p role="alert" className="field-error">{formError}</p>}
      {error && <p role="alert" className="field-error">{error} <button className="btn btn--secondary" onClick={() => void load()}>Thử lại</button></p>}
      {loading && !summary && <p role="status">Đang tải số liệu truy cập…</p>}
      {summary && <><p className="access-meta" title="Giờ Việt Nam">{date(summary.from)} – {date(summary.to)} · Cập nhật {time(summary.generatedAt)}</p>
        <div className="access-stats">{[
          ['Tổng lượt tích lũy', summary.totalVisits],
          ['Lượt trong kỳ', summary.visits],
          ['Tài khoản trong kỳ', summary.accounts],
          ['Đang online', summary.online],
          ['Đăng nhập thành công', summary.logins],
          ['Đăng nhập thất bại', summary.failed],
        ].map(([label, value]) => <div className="stat-tile" key={String(label)}><div className="stat-tile__label">{label}</div><div className="stat-tile__value">{number(Number(value))}</div></div>)}</div>
      </>}
      <details className="admin-help"><summary>Cách tính</summary><ul>
        <li>Để trống ngày: xem toàn bộ lịch sử đến hôm nay. Dữ liệu không tự xóa.</li>
        <li>Tổng tích lũy tính từ ngày bắt đầu lưu, theo bộ lọc tài khoản và vai trò.</li>
        <li>Lượt mới: phiên mới hoặc quay lại sau 30 phút. F5 không tăng lượt.</li>
        <li>Online: hoạt động trong 2 phút gần nhất, không theo bộ lọc ngày; mỗi tài khoản tính một lần.</li>
        <li>Chỉ thống kê tài khoản đã đăng nhập. Làm mới phiên không tính thêm lần đăng nhập.</li>
      </ul></details>
    </div>
    <div className="card"><div className="card__header"><h3 className="card__title">Truy cập theo ngày</h3></div>
      <div ref={chart} className="access-chart" />{summary && summary.days.length > 90 && <p className="access-meta">Biểu đồ: 90 ngày có dữ liệu gần nhất. Xem toàn bộ trong bảng.</p>}
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Ngày</th><th>Lượt bắt đầu</th><th>Tài khoản hoạt động</th><th>Đăng nhập thành công</th><th>Thất bại</th></tr></thead>
        <tbody>{days.slice(dailyPage * 25, dailyPage * 25 + 25).map(d => <tr key={d.day}><td data-label="Ngày">{date(d.day)}</td><td data-label="Lượt bắt đầu">{number(d.visits)}</td><td data-label="Tài khoản">{number(d.accounts)}</td><td data-label="Thành công">{number(d.logins)}</td><td data-label="Thất bại">{number(d.failed)}</td></tr>)}
          {!days.length && <tr><td colSpan={5}>Chưa có dữ liệu trong kỳ.</td></tr>}</tbody></table></div>
      <Pagination page={dailyPage} totalPages={Math.ceil(days.length / 25)} disabled={loading} change={setDailyPage} />
    </div>
    <div className="card"><div className="card__header"><div><h3 className="card__title">Tài khoản đang online</h3><p className="access-meta">Hoạt động trong 2 phút gần nhất.</p></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Tài khoản</th><th>Họ tên / Vai trò</th><th>Bắt đầu phiên</th><th>Hoạt động gần nhất</th><th>Số phiên</th></tr></thead><tbody>
        {online?.items.map(o => <tr key={o.accountId}><td data-label="Tài khoản"><div>{o.username}<small>{kindName(o.kind)}</small></div></td><td data-label="Họ tên"><div>{o.fullName}<small>{roleNames(o.roles)}</small></div></td><td data-label="Bắt đầu">{time(o.startedAt)}</td><td data-label="Hoạt động">{time(o.lastSeenAt)}</td><td data-label="Phiên">{o.sessions}</td></tr>)}
        {online?.items.length === 0 && <tr><td colSpan={5}>Không có tài khoản online phù hợp.</td></tr>}</tbody></table></div>
      <Pagination page={onlinePage} totalPages={online?.totalPages || 0} disabled={loading} change={setOnlinePage} />
    </div>
    <div className="card"><div className="card__header"><h3 className="card__title">Lịch sử đăng nhập</h3>{logs && <span className="access-meta">{number(logs.totalItems)} sự kiện</span>}</div>
      <div className="access-log-controls"><label>Sự kiện<select aria-label="Sự kiện nhật ký" value={action} onChange={e => { setAction(e.target.value); setLogPage(0); }}><option value="">Tất cả</option><option value="AUTH_LOGIN_SUCCESS">Đăng nhập thành công</option><option value="AUTH_LOGIN_FAILED">Đăng nhập thất bại</option><option value="AUTH_LOGOUT">Đăng xuất</option><option value="AUTH_LOGOUT_ALL">Đăng xuất mọi thiết bị</option></select></label>
        <button className="btn btn--secondary" disabled={!summary || loading || exporting || Boolean(error) || (logs?.totalItems || 0) > 10000} onClick={() => void download()}>{exporting ? 'Đang xuất…' : 'Xuất Excel'}</button></div>
      {(logs?.totalItems || 0) > 10000 && <p>Tối đa 10.000 sự kiện/file. Thu hẹp bộ lọc để xuất.</p>}
      {exportError && <p role="alert" className="field-error">{exportError}</p>}
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Thời gian</th><th>Tài khoản</th><th>Họ tên</th><th>Vai trò</th><th>Sự kiện</th></tr></thead><tbody>
        {logs?.items.map(l => <tr key={l.id}><td data-label="Thời gian">{time(l.at)}</td><td data-label="Tài khoản"><div>{l.username}<small>{kindName(l.kind)}</small></div></td><td data-label="Họ tên">{l.fullName}</td><td data-label="Vai trò">{roleNames(l.roles)}</td><td data-label="Sự kiện"><span className={`status-badge status-badge--${l.action === 'AUTH_LOGIN_FAILED' ? 'danger' : 'success'}`}>{l.label}</span></td></tr>)}
        {logs?.items.length === 0 && <tr><td colSpan={5}>Chưa có sự kiện trong kỳ.</td></tr>}</tbody></table></div>
      <Pagination page={logPage} totalPages={logs?.totalPages || 0} disabled={loading} change={setLogPage} />
    </div>
  </section>;
}
