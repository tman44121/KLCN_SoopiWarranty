import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, errorText, Icon } from './customer';

type Contact = { ticketCode: string; staffAccountId: string; conversationId: string | null; name: string; role: string;
  productName: string; serial: string; canSend: boolean; unreadCount: number };
type Message = { id: string; mine: boolean; text: string; createdAt: string };
type History = { items: Message[]; hasMore: boolean; canSend: boolean };
const merge = (old: Message[], incoming: Message[]) => [...new Map([...old, ...incoming].map(m => [m.id, m])).values()]
  .sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);

export default function ChatBubble({ customer, launcherTarget, ticketRequest }: {
  customer: boolean; launcherTarget: HTMLElement; ticketRequest: { ticketCode: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [ticketContext, setTicketContext] = useState<string | null>(null);
  const [moreContacts, setMoreContacts] = useState(false);
  const [unread, setUnread] = useState(0);
  const [directoryError, setDirectoryError] = useState('');
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [moreMessages, setMoreMessages] = useState(false);
  const [canSend, setCanSend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const directoryVersion = useRef(0);
  const selectionVersion = useRef(0);
  const sendingRef = useRef(false);
  const nonces = useRef<Record<string, { text: string; id: string }>>({});
  const end = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const launcher = useRef<HTMLButtonElement>(null);
  const miniLauncher = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLElement>(null);
  const conversation = selected?.conversationId;
  const draft = conversation ? drafts[conversation] || '' : '';

  useEffect(() => { const timer = setTimeout(() => { setPage(0); setQuery(q.trim()); }, 250); return () => clearTimeout(timer); }, [q]);
  const loadContacts = useCallback(async () => {
    const version = ++directoryVersion.current;
    try {
      const data = await api().chat.contacts(ticketContext || query, page);
      if (version !== directoryVersion.current) return;
      setContacts(ticketContext ? data.items.filter((contact: Contact) => contact.ticketCode === ticketContext) : data.items);
      setMoreContacts(data.hasMore); setUnread(data.unreadCount); setDirectoryError('');
    } catch (e) { if (version === directoryVersion.current) setDirectoryError(errorText(e)); }
    finally { if (version === directoryVersion.current) setDirectoryLoading(false); }
  }, [query, page, ticketContext]);
  useEffect(() => {
    setDirectoryLoading(true);
    void loadContacts();
    // shortcut: REST polling; use a push transport only when concurrent chat traffic requires it.
    const timer = setInterval(() => { if (!document.hidden) void loadContacts(); }, open ? 5000 : 15000);
    return () => { clearInterval(timer); directoryVersion.current++; };
  }, [loadContacts, open]);
  useEffect(() => () => { selectionVersion.current++; }, []);
  useEffect(() => {
    if (!customer || !ticketRequest) return;
    returnFocus.current = document.activeElement as HTMLElement;
    selectionVersion.current++;
    setSelected(null); setMessages([]); setContacts([]); setDirectoryError(''); setError(''); setHistoryError(''); setLoading(false);
    setPage(0); setQ(''); setQuery(''); setTicketContext(ticketRequest.ticketCode); setMinimized(false); setOpen(true);
  }, [ticketRequest, customer]);

  useEffect(() => {
    if (!open || !conversation) return;
    let disposed = false, busy = false, cursor: string | undefined;
    const version = selectionVersion.current;
    const load = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        let more: boolean;
        do {
          const data: History = await api().chat.messages(conversation, undefined, cursor);
          if (disposed || version !== selectionVersion.current) return;
          setMessages(old => merge(old, data.items)); setCanSend(data.canSend); setHistoryError('');
          if (cursor === undefined) setMoreMessages(data.hasMore);
          more = cursor !== undefined && data.hasMore;
          const last = data.items.at(-1);
          cursor = last?.id || cursor || '0';
          if (stick.current && cursor !== '0') await api().chat.read(conversation, cursor);
        } while (more && !disposed);
        if (!disposed && version === selectionVersion.current) void loadContacts();
      } catch (e) { if (!disposed && version === selectionVersion.current) setHistoryError(errorText(e)); }
      finally { busy = false; if (!disposed && version === selectionVersion.current) setLoading(false); }
    };
    setLoading(true);
    setMessages([]); setMoreMessages(false); stick.current = true;
    void load();
    const timer = setInterval(() => { void load(); }, 3000);
    const visible = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [conversation, open, loadContacts]);
  const lastId = messages.at(-1)?.id;
  useEffect(() => { if (open && stick.current) end.current?.scrollIntoView({ block: 'nearest' }); }, [lastId, open]);
  useEffect(() => {
    if (!open) return;
    return () => {
      if (document.activeElement === document.body || panel.current?.contains(document.activeElement))
        (miniLauncher.current || (returnFocus.current?.isConnected ? returnFocus.current : launcher.current))?.focus();
    };
  }, [open]);
  useEffect(() => {
    if (open) (panel.current?.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled)') || panel.current?.querySelector<HTMLElement>('button:not(:disabled)'))?.focus();
  }, [open, conversation]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (panel.current?.contains(document.activeElement) || document.activeElement === document.body)) {
        setMinimized(true); setOpen(false);
      }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  useEffect(() => {
    if (open && (document.activeElement === document.body || document.activeElement?.matches(':disabled'))) panel.current?.querySelector<HTMLButtonElement>('[aria-label="Đóng chat"]')?.focus();
  }, [open, canSend, loading]);

  const choose = async (contact: Contact) => {
    const version = ++selectionVersion.current;
    setLoading(true); setError(''); setHistoryError(''); setMessages([]); setMoreMessages(false); stick.current = true;
    try {
      const id = contact.conversationId || (await api().chat.start(contact.ticketCode, contact.staffAccountId)).id;
      if (version !== selectionVersion.current) return;
      setSelected({ ...contact, conversationId: id }); setCanSend(contact.canSend);
    } catch (e) { if (version === selectionVersion.current) { setError(errorText(e)); setLoading(false); } }
  };
  const older = async () => {
    if (!conversation || !messages.length) return;
    const version = selectionVersion.current;
    setLoading(true);
    try {
      const data: History = await api().chat.messages(conversation, messages[0].id);
      if (version !== selectionVersion.current) return;
      setMessages(old => merge(old, data.items)); setMoreMessages(data.hasMore); setCanSend(data.canSend); setError('');
    } catch (e) { if (version === selectionVersion.current) setError(errorText(e)); }
    finally { if (version === selectionVersion.current) setLoading(false); }
  };
  const send = async () => {
    const text = draft.trim();
    if (!conversation || !text || !canSend || sendingRef.current || draft.length > 2000) return;
    const version = selectionVersion.current;
    if (nonces.current[conversation]?.text !== text)
      nonces.current[conversation] = { text, id: crypto.randomUUID() };
    sendingRef.current = true; setSending(true); setError('');
    try {
      const message: Message = await api().chat.send(conversation, text, nonces.current[conversation].id);
      delete nonces.current[conversation];
      setDrafts(old => ({ ...old, [conversation]: '' }));
      if (version !== selectionVersion.current) return;
      stick.current = true; setMessages(old => merge(old, [message])); void loadContacts();
    } catch (e) { if (version === selectionVersion.current) setError(errorText(e)); }
    finally { sendingRef.current = false; setSending(false); }
  };
  const back = () => { selectionVersion.current++; setSelected(null); setMessages([]); setError(''); setHistoryError(''); setLoading(false); void loadContacts(); };
  const expand = () => {
    returnFocus.current = document.activeElement as HTMLElement;
    setMinimized(false); setOpen(true);
    panel.current?.querySelector<HTMLElement>('textarea:not(:disabled), input:not(:disabled)')?.focus();
  };

  return <>
    {createPortal(<button ref={launcher} type="button" className="icon-button chat-header-launcher" data-chat-open="" title="Tin nhắn"
      aria-label="Mở chat hỗ trợ" aria-expanded={open} aria-controls="support-chat" aria-haspopup="dialog" onClick={expand}>
      <Icon glyph="chatDots" />{unread > 0 && <span className="chat-fab-badge" aria-label={`${unread} tin nhắn chưa đọc`}>{unread > 99 ? '99+' : unread}</span>}
    </button>, launcherTarget)}
    {minimized && !open && createPortal(<div className="chat-mini">
      <button ref={miniLauncher} type="button" className="chat-mini-restore" onClick={expand} title={selected?.name || 'Chat hỗ trợ'}
        aria-label={selected ? `Mở lại chat với ${selected.name}` : 'Mở lại chat hỗ trợ'} aria-haspopup="dialog" aria-controls="support-chat">
        {selected ? <span aria-hidden="true">{selected.name.trim().split(/\s+/).slice(-2).map(word => word[0]).join('').toLocaleUpperCase('vi-VN')}</span> : <Icon glyph="chatDots" />}
        {unread > 0 && <span className="chat-fab-badge" aria-label={`${unread} tin nhắn chưa đọc`}>{unread > 99 ? '99+' : unread}</span>}
      </button>
      <button type="button" className="chat-mini-dismiss" aria-label="Đóng chat thu gọn" onClick={() => { setMinimized(false); launcher.current?.focus(); }}><Icon glyph="x" /></button>
    </div>, document.body)}
    {open && createPortal(<section ref={panel} id="support-chat" className="chat-window chat-popover" role="dialog" aria-modal="false" aria-label="Chat hỗ trợ">
      <div className="chat-window-header">
        {selected && <button type="button" className="chat-icon-btn" disabled={sending} onClick={back} aria-label="Danh sách người liên hệ">←</button>}
        <div className="chat-header-text"><div className="chat-header-title">{selected?.name || 'Chat hỗ trợ'}</div>
          <div className="chat-header-sub">{selected ? `${selected.role} · ${selected.ticketCode}` : customer ? 'Người tiếp nhận và KTV phụ trách phiếu' : 'Khách hàng trong phiếu bạn phụ trách'}</div></div>
        <button type="button" className="chat-icon-btn" onClick={() => { setMinimized(true); setOpen(false); }} aria-label="Thu gọn chat" title="Thu gọn thành nút tròn">−</button>
        <button type="button" className="chat-icon-btn" onClick={() => { setMinimized(false); setOpen(false); }} aria-label="Đóng chat" title="Đóng chat"><Icon glyph="x" /></button>
      </div>
      {!selected ? <>
        {ticketContext && <div className="chat-ticket-filter"><span>Phiếu <strong>{ticketContext}</strong></span><button type="button" onClick={() => { setTicketContext(null); setPage(0); }}>Tất cả liên hệ</button></div>}
        {!ticketContext && <label className="chat-search">{customer ? 'Tìm người phụ trách / phiếu / thiết bị' : 'Tìm tên khách / mã khách / phiếu / thiết bị'}
          <input type="search" value={q} maxLength={100} onChange={e => setQ(e.target.value)} /></label>
        }
        {directoryError && <p className="chat-error" role="alert">{directoryError} <button onClick={() => void loadContacts()}>Thử lại</button></p>}
        {error && <p className="chat-error" role="alert">{error}</p>}
        <div className="chat-contact-list" aria-busy={directoryLoading || loading}>
          {contacts.map(c => <button type="button" className="chat-contact" key={`${c.ticketCode}:${c.staffAccountId}`} disabled={loading || directoryLoading} onClick={() => void choose(c)}>
            <strong>{c.name}{c.unreadCount > 0 && <span className="chat-contact-badge">{c.unreadCount}</span>}</strong>
            <span>{c.role} · {c.ticketCode}</span><span>{c.productName} · {c.serial}</span>
            {!c.canSend && <span>Chỉ xem lịch sử — không còn phụ trách hoặc tài khoản ngừng hoạt động</span>}
          </button>)}
          {!contacts.length && !directoryLoading && !directoryError && <p className="chat-system-msg">{query ? 'Không tìm thấy người liên hệ phù hợp.' : customer ? 'Chưa có người phụ trách có tài khoản chat cho phiếu của bạn.' : 'Chưa có khách hàng có tài khoản chat trong phiếu bạn phụ trách.'}</p>}
          {(directoryLoading || loading) && <p role="status" className="chat-system-msg">Đang tải…</p>}
        </div>
        <div className="chat-directory-pages"><button disabled={page === 0 || directoryLoading} onClick={() => setPage(n => n - 1)}>Trước</button>
          <span>Trang {page + 1}</span><button disabled={!moreContacts || directoryLoading} onClick={() => setPage(n => n + 1)}>Sau</button></div>
      </> : <>
        <div className="chat-ticket-context">{selected.productName} · {selected.serial}</div>
        {historyError && <p className="chat-error" role="alert">{historyError} Đang thử kết nối lại…</p>}
        <div className="chat-messages" ref={list} role="log" aria-live="polite" aria-label="Lịch sử tin nhắn"
          onScroll={() => { const el = list.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
          {moreMessages && <button type="button" disabled={loading} onClick={() => void older()}>Tải tin nhắn cũ hơn</button>}
          {loading && !messages.length && <p role="status">Đang tải tin nhắn…</p>}
          {!loading && !messages.length && !historyError && <p className="chat-system-msg">Chưa có tin nhắn. Hãy bắt đầu trao đổi về phiếu này.</p>}
          {messages.map(m => <div key={m.id} className={`chat-msg-row chat-msg-row--${m.mine ? 'me' : 'them'}`}>
            <div className="chat-bubble-wrap"><div className={`chat-bubble-msg chat-bubble-msg--${m.mine ? 'me' : 'them'}`}>{m.text}</div>
              <time className="chat-msg-time" dateTime={m.createdAt}>{m.mine ? 'Bạn' : selected.name} · {new Date(m.createdAt).toLocaleString('vi-VN')}</time></div>
          </div>)}<div ref={end} />
        </div>
        {error && <p className="chat-error" role="alert">{error}</p>}
        {!canSend && !loading && <p className="chat-system-msg">Cuộc trò chuyện chỉ xem lịch sử. Chọn người đang phụ trách phiếu để gửi tin.</p>}
        <form className="chat-input-area" onSubmit={e => { e.preventDefault(); void send(); }}>
          <textarea className="chat-input-field" aria-label="Nhập tin nhắn" placeholder="Nhập tin nhắn…" rows={2} value={draft} maxLength={2000}
            disabled={!canSend || loading} readOnly={sending} onChange={e => { if (conversation) setDrafts(old => ({ ...old, [conversation]: e.target.value })); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
          <button type="submit" className="chat-send-btn chat-send-btn--active" aria-label="Gửi tin nhắn" disabled={!canSend || !draft.trim() || sending || loading}><Icon glyph="send" /></button>
        </form><div className="chat-input-hint">{sending ? 'Đang gửi…' : `${draft.length}/2000 · Enter gửi · Shift+Enter xuống dòng`}</div>
      </>}
    </section>, document.body)}
  </>;
}
