/* Phần dùng chung của giao diện khách (port từ web khách KLCN): header, footer, icon, badge.
   API, nhãn và định dạng lấy từ các module behaviors đã gắn lên window (api.js, labels.js). */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { internalRoute } from './navigation';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const w = window as unknown as { LML_API: Json; LML_LABELS: Json; LML_FMT: Json; LML_AUTH?: Json };
export const api = () => w.LML_API;
export const labels = () => w.LML_LABELS;
export const fmt = () => w.LML_FMT;

/** Lỗi API → câu tiếng Việt của máy chủ (ApiError.detail đã gồm fieldErrors). */
export const errorText = (error: Json) => error?.detail || 'Đã xảy ra lỗi. Vui lòng thử lại.';

/** Nhóm trạng thái phiếu phía khách (bộ lọc Lịch sử bảo hành, số liệu trang chủ) theo luồng của trung tâm:
    tiếp nhận → chẩn đoán → (chờ linh kiện / chờ khách xác nhận) → sửa → chờ khách nhận máy → hoàn thành.
    Sửa xong (COMPLETED) và không sửa (AWAITING_RETURN) đều là máy chờ khách nhận; trả máy xong mới hoàn thành. */
export const TICKET_GROUPS: Record<string, string[]> = {
  PROCESSING: ['RECEIVED', 'INSPECTING', 'DIAGNOSED', 'REPAIRING'],
  WAITING: ['AWAITING_PARTS', 'AWAITING_QUOTE_APPROVAL', 'AWAITING_CUSTOMER_CONFIRMATION'],
  READY: ['COMPLETED', 'AWAITING_RETURN'],
  COMPLETED: ['DELIVERED', 'RETURNED_UNREPAIRED'],
};

/** Bộ lọc Lịch sử bảo hành theo thứ tự hiển thị. */
export const TICKET_FILTERS: [string, string][] = [
  ['ALL', 'Tất cả'], ['PROCESSING', 'Đang xử lý'], ['WAITING', 'Chờ linh kiện / xác nhận'], ['READY', 'Chờ nhận máy'], ['COMPLETED', 'Hoàn thành'],
];
export const inGroup = (group: string, status: string) => group === 'ALL' || TICKET_GROUPS[group].includes(status);

/** So sánh để xếp mới nhất trước theo một trường thời gian ISO. */
export const newest = (key: string) => (a: Json, b: Json) => String(b[key] || '').localeCompare(String(a[key] || ''));

let catalogRequest: Promise<Json> | null = null;
/** Danh mục công khai (/portal/catalog), dùng chung một request cho trang và footer; lỗi thì lần sau gọi lại. */
export function portalCatalog(): Promise<Json> {
  catalogRequest ??= api().portal.catalog().catch((error: Json) => {
    catalogRequest = null;
    throw error;
  });
  return catalogRequest!;
}

/** Bước tiến độ trên cổng khách — trùng StepLabels của PortalTicketView. */
export const STEP_LABELS = ['Tiếp nhận', 'Chẩn đoán', 'Chờ linh kiện', 'Đang sửa', 'QC', 'Sẵn sàng nhận máy'];

const PATHS: Record<string, ReactNode> = {
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  key: <><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.8-9.8M17 6l3 3M15 8l2 2" /></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61" /><path d="m2 2 20 20" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>,
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  device: <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  pin: <><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  checkCircle: <><circle cx="12" cy="12" r="10" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  xCircle: <><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></>,
  arrowLeft: <path d="M19 12H5M12 19l-7-7 7-7" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8" /></>,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>,
  chat: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
  chatDots: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><circle cx="9" cy="11" r="1" /><circle cx="12" cy="11" r="1" /><circle cx="15" cy="11" r="1" /></>,
  send: <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>,
  x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  minimize: <><line x1="5" y1="12" x2="19" y2="12" /></>,
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
};

export function Icon({ glyph }: { glyph: string }) {
  return <svg className="kh-icon" viewBox="0 0 24 24" aria-hidden="true">{PATHS[glyph]}</svg>;
}

const TONE_CLASS: Record<string, string> = {
  processing: 'badge-processing',
  warning: 'badge-waiting',
  success: 'badge-completed',
  neutral: 'badge-received',
  danger: 'badge-danger',
};

/** Badge trạng thái theo bảng nhãn của labels.js (TICKET_STATUS_CUSTOMER, WARRANTY_REQUEST_STATUS, WARRANTY_STATUS). */
const TONE_ICON: Record<string, string> = { success: 'checkCircle', warning: 'clock', danger: 'xCircle' };

export function StatusBadge({ table, code }: { table: string; code: string | null | undefined }) {
  const entry = labels()[table]?.[code || ''];
  const tone = entry?.tone || 'neutral';
  const icon = TONE_ICON[tone];
  return (
    <span className={'badge ' + TONE_CLASS[tone] + (icon ? ' has-icon' : '')}>
      {icon && <Icon glyph={icon} />}{entry?.label || code || '—'}
    </span>
  );
}

export const initial = (name?: string | null) => (name || '?').trim().charAt(0).toUpperCase() || '?';

/** Khách đã đăng nhập đi vào /account; khách vãng lai bắt đầu ở trang giới thiệu /, dùng tra cứu và form yêu cầu công khai trên /portal,
    lịch sử cần đăng nhập nên dẫn qua /login rồi quay lại đúng mục. */
const NAV_SIGNED_IN = [
  { key: 'home', href: '/account', label: 'Trang chủ' },
  { key: 'request', href: '/account#yeu-cau-moi', label: 'Gửi yêu cầu bảo hành' },
  { key: 'history', href: '/account#lich-su', label: 'Lịch sử bảo hành' },
  { key: 'lookup', href: '/portal', label: 'Tra cứu tiến độ' },
];
const NAV_GUEST = [
  { key: 'home', href: '/', label: 'Trang chủ' },
  { key: 'lookup', href: '/portal', label: 'Tra cứu tiến độ' },
  { key: 'request', href: '/portal#dang-ky', label: 'Gửi yêu cầu bảo hành' },
  { key: 'history', href: '/login?next=' + encodeURIComponent('/account#lich-su'), label: 'Lịch sử bảo hành' },
];

/** Tên khách của phiên đang mở (token + thông tin phiên do api.js lưu); tài khoản nhân viên coi như khách vãng lai. */
export function useCustomerName(name?: string | null) {
  const [sessionName, setSessionName] = useState<string | null>(null);
  useEffect(() => {
    if (name || !api()?.tokens.get()) return;
    const user = api().session.user();
    if (user?.roles?.some((role: Json) => role.code === 'CUSTOMER')) setSessionName(user.displayName || user.username);
  }, [name]);
  return name || sessionName;
}

async function logout() {
  if (w.LML_AUTH) return w.LML_AUTH.logout();
  try {
    await api().auth.logout(false);
  } catch {
    /* vẫn xóa phiên phía trình duyệt */
  }
  api().tokens.clear();
  window.location.href = '/login';
}

const MENU = [
  { key: 'profile', href: '/account#ho-so', icon: 'user', label: 'Thông tin cá nhân' },
  { key: 'password', href: '/account#doi-mat-khau', icon: 'key', label: 'Đổi mật khẩu' },
  { key: 'history', href: '/account#lich-su', icon: 'list', label: 'Lịch sử bảo hành' },
];

/** Logo soopiwarranty: mascot + chữ; light = chữ trắng cho nền tối. */
export function BrandLogo({ light = false }: { light?: boolean }) {
  return (
    <>
      <img src="/images/brand/logo-mark.png" className="brand-mark" width={44} height={44} alt="" />
      <img src={`/images/brand/${light ? 'wordmark-light' : 'wordmark'}.png`} className="brand-wordmark" width={162} height={26} alt="soopiwarranty" />
    </>
  );
}

export function Brand({ href, light = false }: { href: string; light?: boolean }) {
  return <a href={href} className="nav-brand"><BrandLogo light={light} /></a>;
}

function UserMenu({ name, active }: { name: string; active: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className="user-profile-menu" ref={box}>
      <button type="button" className="user-profile-trigger" aria-label={`Tài khoản: ${name}`} aria-expanded={open} aria-haspopup="true"
        onClick={() => setOpen(!open)}>
        <span className="user-avatar-circle" aria-hidden="true">{initial(name)}</span>
        <span className="user-name-text">{name}</span>
        <Icon glyph="chevron" />
      </button>
      {open && (
        <div className="profile-dropdown-content" onClick={() => setOpen(false)}>
          <div className="profile-dropdown-header">
            <span className="user-avatar-circle" aria-hidden="true">{initial(name)}</span>
            <div>
              <div className="dropdown-user-name">{name}</div>
              <div className="dropdown-user-role">Khách hàng thành viên</div>
            </div>
          </div>
          {MENU.map((item) => (
            <a key={item.key} href={item.href} className={'profile-dropdown-item' + (active === item.key ? ' active-drop' : '')}>
              <Icon glyph={item.icon} />{item.label}
            </a>
          ))}
          <button type="button" className="profile-dropdown-item logout-item" onClick={() => void logout()}>
            <Icon glyph="logout" />Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

/** Chuông thông báo khách hàng — chỉ hiển thị khi đăng nhập; polling mỗi 60s. */
export function NotificationBell() {
  type NotifItem = { id: string; type: string; message: string; link: string | null; createdAt: string | null; read: boolean };
  const [inbox, setInbox] = useState<{ items: NotifItem[]; unreadCount: number }>({ items: [], unreadCount: 0 });
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, run] = useBusy();
  const version = useRef(0);
  const writing = useRef(false);

  const load = useCallback(async () => {
    if (writing.current) return;
    const current = ++version.current;
    try {
      const data = await api().notifications.inbox(false, { redirect: false });
      if (current === version.current) {
        setInbox(data);
        setError('');
      }
    } catch (e) {
      if (current === version.current) setError(errorText(e));
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, []);

  // Load thông báo ban đầu + polling mỗi 60 giây
  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => { clearInterval(id); version.current++; };
  }, [load]);

  // Đóng dropdown khi click bên ngoài hoặc nhấn Escape
  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); bellRef.current?.focus(); } };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onOutside); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const markRead = (item: NotifItem) => {
    const link = internalRoute(item.link);
    if (item.read) {
      if (link) window.location.href = link;
      return;
    }
    void run(async () => {
      writing.current = true;
      version.current++;
      try {
        await api().notifications.read(item.id, { redirect: false });
        setInbox(prev => ({
          items: prev.items.map(n => n.id === item.id ? { ...n, read: true } : n),
          unreadCount: Math.max(0, prev.unreadCount - (prev.items.some(n => n.id === item.id && !n.read) ? 1 : 0)),
        }));
        setError('');
        if (link) window.location.href = link;
      } catch (e) { setError(errorText(e)); }
      finally { writing.current = false; }
    });
  };

  const markAll = () => {
    void run(async () => {
      writing.current = true;
      version.current++;
      try {
        await api().notifications.readAll({ redirect: false });
        setInbox(prev => ({ items: prev.items.map(n => ({ ...n, read: true })), unreadCount: 0 }));
        setError('');
      } catch (e) { setError(errorText(e)); }
      finally { writing.current = false; }
    });
  };

  return (
    <div className="notif-bell-wrap" ref={boxRef}>
      <button
        type="button"
        ref={bellRef}
        className={'notif-bell-btn' + (open ? ' is-open' : '')}
        aria-label={`Thông báo${inbox.unreadCount > 0 ? ` (${inbox.unreadCount} chưa đọc)` : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => { setOpen(o => !o); if (!open && !busy) void load(); }}
      >
        <Icon glyph="bell" />
        {inbox.unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {inbox.unreadCount > 99 ? '99+' : inbox.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section id={panelId} className="notif-dropdown" aria-label="Danh sách thông báo">
          <div className="notif-dropdown-head">
            <span className="notif-dropdown-title">Thông báo</span>
            {inbox.unreadCount > 0 && (
              <button type="button" className="notif-mark-all-btn" disabled={busy} onClick={markAll}>
                Đọc tất cả
              </button>
            )}
          </div>
          {error && <div className="notif-error" role="alert">{error} <button type="button" disabled={busy} onClick={() => void load()}>Thử lại</button></div>}
          <ul className="notif-list" role="list">
            {loading ? <li className="notif-empty" role="status">Đang tải thông báo…</li> : inbox.items.length === 0 ? (
              <li className="notif-empty">
                <Icon glyph="bell" />
                <span>Chưa có thông báo nào</span>
              </li>
            ) : (
              inbox.items.map(n => (
                <li key={n.id} className={'notif-item' + (n.read ? '' : ' notif-item--unread')}>
                  <button type="button" className="notif-item-btn" disabled={busy} onClick={() => markRead(n)} aria-label={`${n.read ? 'Đã đọc' : 'Chưa đọc'}: ${n.message}`}>
                    <span className="notif-item-dot" aria-hidden="true" />
                    <span className="notif-item-body">
                      <span className="notif-item-msg">{n.message}</span>
                      <span className="notif-item-time">{fmt().dateTime(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          {inbox.items.length > 0 && (
            <div className="notif-dropdown-footer">
              Hiển thị tối đa 50 thông báo mới nhất
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** Header khách. Có tên → menu tài khoản; chưa đăng nhập → nút Đăng nhập/Đăng ký. */
export function CustomerHeader({ name: pageName, active }: { name?: string | null; active: string }) {
  const name = useCustomerName(pageName);
  const nav = name ? NAV_SIGNED_IN : NAV_GUEST;
  return (
    <header className="navbar-header">
      <nav className="nav-container" aria-label="Điều hướng khách hàng">
        <Brand href={name ? '/account' : '/'} />
        <ul className="nav-menu">
          {nav.map((item) => (
            <li key={item.key}>
              <a href={item.href} className={'nav-link' + (active === item.key ? ' active' : '')}
                aria-current={active === item.key ? 'page' : undefined}>{item.label}</a>
            </li>
          ))}
        </ul>
        <div className="nav-right-actions">
          {name ? (
            <>
              <a href="/account#yeu-cau-moi" className="btn-primary-teal">Gửi yêu cầu</a>
              <NotificationBell />
              <UserMenu name={name} active={active} />
            </>
          ) : (
            <>
              <a href="/login" className="btn-secondary-white">Đăng nhập</a>
              <a href="/register" className="btn-primary-teal">Đăng ký</a>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

/** Footer khách: trạm dịch vụ lấy từ danh mục công khai thay cho địa chỉ/hotline cố định của bản cũ. */
export function CustomerFooter() {
  const name = useCustomerName();
  const [stations, setStations] = useState<Json[]>([]);
  useEffect(() => {
    portalCatalog().then((catalog: Json) => setStations(catalog.stations || [])).catch(() => setStations([]));
  }, []);
  return (
    <footer className="footer-main">
      <div className="footer-container">
        <div>
          <div className="footer-brand"><BrandLogo light={true} /></div>
          <p className="footer-desc">Trung tâm bảo hành và sửa chữa thiết bị điện tử, điện máy. Theo dõi phiếu sửa chữa và gửi yêu cầu bảo hành trực tuyến.</p>
          {stations.length > 0 && (
            <ul className="footer-contact-info">
              {stations.map((station) => (
                <li key={station.code}><Icon glyph="pin" /><span>{station.name}{station.address ? ` — ${station.address}` : ''}</span></li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="footer-col-title">Dịch vụ</h4>
          <ul className="footer-links-ul">
            {(name ? NAV_SIGNED_IN : NAV_GUEST).filter((item) => item.key !== 'home').map((item) => (
              <li key={item.key}><a href={item.href}>{item.label}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="footer-col-title">Tài khoản</h4>
          <ul className="footer-links-ul">
            {name ? (
              <>
                <li><a href="/account#ho-so">Thông tin cá nhân</a></li>
                <li><a href="/account#doi-mat-khau">Đổi mật khẩu</a></li>
              </>
            ) : (
              <>
                <li><a href="/login">Đăng nhập</a></li>
                <li><a href="/register">Đăng ký tài khoản</a></li>
              </>
            )}
          </ul>
        </div>
      </div>
      <div className="footer-bottom-strip">© {new Date().getFullYear()} soopiwarranty — Soopi Service.</div>
    </footer>
  );
}

/** Nút có trạng thái đang xử lý: khóa trong lúc gọi API để không gửi trùng. */
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = async <T,>(action: () => Promise<T>) => {
    if (busy) return undefined;
    setBusy(true);
    try {
      return await action();
    } finally {
      setBusy(false);
    }
  };
  return [busy, run] as const;
}

export function PasswordInput({ id, name, value, onChange, autoComplete, placeholder, invalid, describedBy }: {
  id: string; name: string; value?: string; onChange?: (value: string) => void; autoComplete: string;
  placeholder?: string; invalid?: boolean; describedBy?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="input-wrapper">
      <span className="input-icon"><Icon glyph="lock" /></span>
      <input type={shown ? 'text' : 'password'} id={id} name={name} className="form-input form-input--with-eye"
        autoComplete={autoComplete} placeholder={placeholder} aria-invalid={invalid || undefined} aria-describedby={describedBy}
        {...(onChange ? { value: value ?? '', onChange: (event) => onChange(event.target.value) } : {})} />
      <button type="button" className="eye-btn" onClick={() => setShown(!shown)}
        aria-label={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={shown}>
        <Icon glyph={shown ? 'eyeOff' : 'eye'} />
      </button>
    </div>
  );
}

/**
 * Đăng nhập/đăng ký phóng cả bố cục theo màn hình như một khung cố định: hệ số theo chiều ngang (mốc 1366px,
 * tối đa 1,6) rồi giảm cho tới khi nội dung mỗi cột vừa chiều cao màn. Dưới 768px giữ nguyên (xếp chồng, cuộn).
 */
export function useAuthScale() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const fit = () => {
      root.style.setProperty('--auth-scale', '1');
      if (innerWidth < 768) return;
      let scale = Math.min(Math.max(innerWidth / 1366, 1), 1.6);
      root.querySelectorAll<HTMLElement>('.auth-banner, .auth-form-panel').forEach((panel) => {
        const items = Array.from(panel.children as HTMLCollectionOf<HTMLElement>).filter((item) => item.getClientRects().length > 0);
        const content = items.reduce((sum, item) => sum + item.offsetHeight, 0);
        const style = getComputedStyle(panel);
        const fixed = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + (parseFloat(style.rowGap) || 0) * Math.max(items.length - 1, 0);
        if (content > 0) scale = Math.min(scale, (panel.clientHeight - fixed) / content);
      });
      root.style.setProperty('--auth-scale', String(Math.max(1, Math.floor(scale * 100) / 100)));
    };
    fit();
    void document.fonts?.ready.then(fit);
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, []);
  return ref;
}
