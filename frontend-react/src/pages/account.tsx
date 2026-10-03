import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { usePage } from "../usePage";
import {
  CustomerFooter, CustomerHeader, Icon, PasswordInput, STEP_LABELS, StatusBadge, TICKET_FILTERS, api, errorText, fmt, inGroup,
  initial, newest, useBusy,
} from "../customer";

/* Khu tài khoản khách hàng Soopi (port các trang khách của web KLCN: trang chủ, lịch sử, chi tiết phiếu, đăng ký bảo hành,
   hồ sơ, đổi mật khẩu). Một route /account, mục con theo hash như các màn khác giữ tab bằng hash.
   Dữ liệu chỉ qua /portal/my/* và /portal/tickets/* với token tài khoản khách (PORTAL_SELF). */

type Json = any; // dữ liệu API đã được backend chiếu (POL-06)
type Route =
  | { view: "home" } | { view: "history" } | { view: "ticket"; code: string }
  | { view: "request"; serial: string } | { view: "profile" } | { view: "password" };

function parseHash(hash: string): Route {
  const [head, ...rest] = decodeURIComponent(hash.replace(/^#/, "")).split("/");
  const tail = rest.join("/");
  if (head === "lich-su") return { view: "history" };
  if (head === "phieu" && tail) return { view: "ticket", code: tail };
  if (head === "yeu-cau-moi") return { view: "request", serial: tail };
  if (head === "ho-so") return { view: "profile" };
  if (head === "doi-mat-khau") return { view: "password" };
  return { view: "home" };
}

const ACTIVE_NAV: Record<Route["view"], string> = {
  home: "home", history: "history", ticket: "history", request: "request", profile: "profile", password: "password",
};

type Data = { profile: Json; tickets: Json[]; requests: Json[]; devices: Json[] };

function useAccountData(enabled: boolean) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const [profile, tickets, requests, devices] = await Promise.all([
        api().get("/portal/my/profile"), api().get("/portal/my/tickets"),
        api().get("/portal/my/warranty-requests"), api().get("/portal/my/devices"),
      ]);
      setData({ profile, tickets: tickets.sort(newest("receivedAt")), requests: requests.sort(newest("createdAt")), devices });
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => { if (enabled) void load(); }, [enabled, load]);
  return { data, error, reload: load };
}

export default function AccountPage() {
  usePage("account", {"data-roles": "CUSTOMER"}, "Tài khoản khách hàng — Soopi");
  const [user, setUser] = useState<Json>(null);
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  const { data, error, reload } = useAccountData(Boolean(user));

  useEffect(() => {
    (window as Json).LML_AUTH?.ready(setUser);
    const onHash = () => {
      setRoute(parseHash(location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  let body: ReactNode;
  if (error) body = <div className="page-container"><LoadError message={error} retry={reload} /></div>;
  else if (!data) body = <div className="page-container"><Skeleton /></div>;
  else if (route.view === "history") body = <History data={data} />;
  else if (route.view === "ticket") body = <TicketDetail key={route.code} code={route.code} onChanged={reload} />;
  else if (route.view === "request") body = <NewRequest key={route.serial} data={data} serial={route.serial} onSubmitted={reload} />;
  else if (route.view === "profile" || route.view === "password") body = <ProfileArea data={data} view={route.view} onChanged={reload} />;
  else body = <Overview data={data} />;

  return (
    <div className="kh-app">
      <CustomerHeader name={data?.profile.fullName || user?.displayName} active={ACTIVE_NAV[route.view]} />
      <main className="kh-main">{body}</main>
      <CustomerFooter />
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải dữ liệu" style={{ display: "grid", gap: 16 }}>
      <div className="kh-skeleton" style={{ height: 40, width: "40%" }} />
      <div className="kh-skeleton" style={{ height: 140 }} />
      <div className="kh-skeleton" style={{ height: 140 }} />
    </div>
  );
}

function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="kh-alert kh-alert--error" role="alert">
      <span>{message}</span>
      <button type="button" className="btn-secondary-white btn-sm" onClick={retry}>Thử lại</button>
    </div>
  );
}

function Empty({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <Icon glyph={icon} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

function MiniSteps({ current }: { current: number }) {
  return (
    <ol className="mini-steps" aria-hidden="true">
      {STEP_LABELS.map((label, index) => (
        <li key={label} className={index < current ? "is-done" : index === current ? "is-current" : ""} />
      ))}
    </ol>
  );
}

const stepText = (ticket: Json) => ticket.stopped
  ? "Phiếu đã dừng"
  : ticket.currentStep >= STEP_LABELS.length ? "Đã bàn giao" : `Bước ${ticket.currentStep + 1}/${STEP_LABELS.length}: ${STEP_LABELS[ticket.currentStep]}`;

/* ---------------------------------------------------------------- Trang chủ */

function Overview({ data }: { data: Data }) {
  const active = data.tickets.filter((t) => !t.stopped && t.status !== "DELIVERED");
  const awaiting = data.tickets.filter((t) => t.status === "AWAITING_CUSTOMER_CONFIRMATION");
  const name = data.profile.fullName;
  return (
    <>
      <section className="hero-section">
        <div className="hero-bg-glow" />
        <div className="hero-grid-container">
          <div className="hero-left-content">
            <h1 className="hero-headline">Xin chào, {name}</h1>
            <p className="hero-description">
              Theo dõi tiến độ sửa chữa, hạn bảo hành và yêu cầu trực tuyến của bạn tại một nơi. Cần sửa thiết bị? Gửi yêu cầu
              trước khi mang máy tới trạm.
            </p>
            <div className="hero-actions">
              <a href="#yeu-cau-moi" className="btn-primary-teal"><Icon glyph="wrench" />Gửi yêu cầu bảo hành</a>
              <a href="#ho-so" className="btn-secondary-white"><Icon glyph="device" />Thiết bị của tôi</a>
            </div>
          </div>

          <div className="hero-dashboard-card">
            <div className="dash-stats-grid">
              <a href="#lich-su" className="dash-stat-box">
                <div className="dash-stat-label">Đang xử lý</div>
                <div className="dash-stat-val">{active.length}</div>
              </a>
              <a href={awaiting[0] ? `#phieu/${awaiting[0].code}` : "#lich-su"} className="dash-stat-box">
                <div className="dash-stat-label">Chờ bạn xác nhận</div>
                <div className="dash-stat-val">{awaiting.length}</div>
              </a>
              <a href="#ho-so" className="dash-stat-box">
                <div className="dash-stat-label">Thiết bị</div>
                <div className="dash-stat-val">{data.devices.length}</div>
              </a>
            </div>
            <div className="dispatch-section-header">
              <h2 className="dispatch-title">Tiến độ sửa chữa thiết bị của bạn</h2>
              {data.tickets.length > 0 && <a href="#lich-su" className="dispatch-link">Xem tất cả →</a>}
            </div>
            {data.tickets.length ? (
              <div className="dispatch-ticket-list">
                {data.tickets.slice(0, 4).map((ticket) => (
                  <a key={ticket.code} href={`#phieu/${ticket.code}`} className="ticket-item-row">
                    <div className="ticket-info-left">
                      <span className={"ticket-type-icon " + (ticket.currentStep >= 5 ? "type-ok" : "type-qr")}><Icon glyph="wrench" /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="ticket-title">{ticket.productName || "Thiết bị"}</div>
                        <div className="ticket-meta"><span className="mono">{ticket.code}</span> · Nhận {fmt().date(ticket.receivedAt)}</div>
                      </div>
                    </div>
                    <StatusBadge table="TICKET_STATUS_CUSTOMER" code={ticket.status} />
                  </a>
                ))}
              </div>
            ) : (
              <p className="ticket-meta">Chưa có phiếu sửa chữa nào. Phiếu tạo tại trạm với số điện thoại {data.profile.phone} sẽ tự hiện ở đây.</p>
            )}
          </div>
        </div>
      </section>

      <div className="page-container">
        {awaiting.map((ticket) => (
          <div key={ticket.code} className="kh-alert kh-alert--warning">
            <span>Phiếu <span className="mono">{ticket.code}</span> ({ticket.productName}) có báo giá sửa chữa đang chờ bạn xác nhận.</span>
            <a href={`#phieu/${ticket.code}`} className="btn-primary-teal btn-sm">Xem báo giá</a>
          </div>
        ))}
        <div className="detail-grid-2">
          <section className="content-panel-card">
            <div className="panel-head">
              <div>
                <h2 className="card-heading-title">Yêu cầu bảo hành trực tuyến</h2>
                <p className="card-heading-desc">Yêu cầu bạn đã gửi trước khi mang máy tới trạm.</p>
              </div>
              <a href="#yeu-cau-moi" className="btn-secondary-white btn-sm"><Icon glyph="plus" />Gửi mới</a>
            </div>
            <RequestList requests={data.requests.slice(0, 5)} />
          </section>
          <section className="content-panel-card">
            <div className="panel-head">
              <div>
                <h2 className="card-heading-title">Thiết bị của bạn</h2>
                <p className="card-heading-desc">Hạn bảo hành theo hồ sơ của trung tâm.</p>
              </div>
            </div>
            {data.devices.length ? (
              <div className="kv-list">
                {data.devices.slice(0, 5).map((device) => (
                  <div key={device.code} className="kv-row">
                    <span>{[device.brandName, device.productName].filter(Boolean).join(" ") || device.serialOrImei}</span>
                    <StatusBadge table="WARRANTY_STATUS" code={device.warrantyStatus} />
                  </div>
                ))}
              </div>
            ) : <p className="card-heading-desc">Chưa có thiết bị gắn với tài khoản.</p>}
          </section>
        </div>
      </div>
    </>
  );
}

function RequestList({ requests }: { requests: Json[] }) {
  if (!requests.length) return <p className="card-heading-desc">Bạn chưa gửi yêu cầu trực tuyến nào.</p>;
  return (
    <div className="dispatch-ticket-list">
      {requests.map((request) => (
        <div key={request.code} className="ticket-item-row">
          <div className="ticket-info-left">
            <span className="ticket-type-icon type-sr"><Icon glyph="file" /></span>
            <div style={{ minWidth: 0 }}>
              <div className="ticket-title">{request.brandModel || "Thiết bị"}</div>
              <div className="ticket-meta">
                <span className="mono">{request.code}</span> · Gửi {fmt().date(request.createdAt)}
                {request.ticketCode && <> · Phiếu <a className="dispatch-link" href={`#phieu/${request.ticketCode}`}>{request.ticketCode}</a></>}
              </div>
            </div>
          </div>
          <StatusBadge table="WARRANTY_REQUEST_STATUS" code={request.status} />
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Lịch sử */

function History({ data }: { data: Data }) {
  const [group, setGroup] = useState("ALL");
  const [query, setQuery] = useState("");
  const count = (g: string) => data.tickets.filter((t) => inGroup(g, t.status)).length;
  const needle = query.trim().toLowerCase();
  const shown = data.tickets.filter((t) => inGroup(group, t.status)
    && (!needle || [t.code, t.productName, t.serialOrImei].some((v) => String(v || "").toLowerCase().includes(needle))));
  const tone: Record<string, string> = {
    PROCESSING: "var(--kh-navy)", WAITING: "var(--kh-warn-text)", READY: "var(--kh-forest)", COMPLETED: "var(--kh-quiet)",
  };
  return (
    <div className="page-container">
      <div className="kh-page-title-row">
        <div>
          <h1 className="kh-page-title">Lịch sử bảo hành &amp; sửa chữa</h1>
          <p className="kh-page-subtitle">Theo dõi tiến độ xử lý mọi thiết bị của bạn.</p>
        </div>
        <a href="#yeu-cau-moi" className="btn-primary-teal"><Icon glyph="plus" />Gửi yêu cầu bảo hành mới</a>
      </div>

      <div className="history-stats-grid">
        {TICKET_FILTERS.map(([key, label]) => (
          <div key={key} className="history-stat">
            <div className="history-stat-label" style={{ color: tone[key] }}>{key === "ALL" ? "Tổng số phiếu" : label}</div>
            <div className="history-stat-num" style={{ color: tone[key] }}>{count(key)}</div>
          </div>
        ))}
      </div>

      <div className="history-filters-bar">
        <div className="filter-pills-row" role="group" aria-label="Lọc theo trạng thái">
          {TICKET_FILTERS.map(([key, label]) => (
            <button key={key} type="button" className="filter-pill" aria-pressed={group === key} onClick={() => setGroup(key)}>
              {label} ({count(key)})
            </button>
          ))}
        </div>
        <div className="search-box-wrap">
          <Icon glyph="search" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Tìm phiếu"
            placeholder="Tìm theo mã phiếu, Serial, tên máy…" />
        </div>
      </div>

      <div className="ticket-cards-grid">
        {shown.map((ticket) => (
          <article key={ticket.code} className="ticket-card-box">
            <div className="ticket-card-header">
              <span className="ticket-code-tag">{ticket.code}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <StatusBadge table="TICKET_STATUS_CUSTOMER" code={ticket.status} />
                <span className="ticket-date-info">Ngày nhận: {fmt().date(ticket.receivedAt)}</span>
              </div>
            </div>
            <div className="ticket-card-body">
              <div>
                <h3 className="ticket-device-title">{ticket.productName || "Thiết bị"}</h3>
                {ticket.serialOrImei && <span className="device-serial-pill">SN: {ticket.serialOrImei}</span>}
              </div>
              <div className="ticket-meta-list">
                <MiniSteps current={ticket.stopped ? -1 : ticket.currentStep} />
                <span className="ticket-meta-item"><strong>{stepText(ticket)}</strong></span>
              </div>
            </div>
            <div className="ticket-card-footer">
              <span className="ticket-date-info">Tiếp nhận lúc {fmt().dateTime(ticket.receivedAt)}</span>
              <a href={`#phieu/${ticket.code}`} className="btn-primary-teal btn-sm">Xem chi tiết tiến độ</a>
            </div>
          </article>
        ))}
        {!shown.length && (
          <Empty icon="inbox" title="Không tìm thấy phiếu bảo hành nào"
            text={data.tickets.length ? "Không có phiếu nào khớp bộ lọc hoặc từ khóa tìm kiếm." : "Bạn chưa có thiết bị nào gửi bảo hành tại trung tâm."}
            action={<a href="#yeu-cau-moi" className="btn-primary-teal">Gửi yêu cầu bảo hành</a>} />
        )}
      </div>

      <h2 className="section-heading section-gap">Yêu cầu bảo hành trực tuyến</h2>
      <div className="content-panel-card"><RequestList requests={data.requests} /></div>
    </div>
  );
}

/* ---------------------------------------------------------------- Chi tiết phiếu */

function TicketDetail({ code, onChanged }: { code: string; onChanged: () => void }) {
  const [ticket, setTicket] = useState<Json>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setError("");
    api().get(`/portal/tickets/${encodeURIComponent(code)}`).then(setTicket).catch((e: Json) => setError(errorText(e)));
  }, [code]);
  useEffect(load, [load]);

  const crumbs = (
    <div className="breadcrumb-text" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div><a href="#">Trang chủ</a> / <a href="#lich-su">Lịch sử bảo hành</a> / <span className="mono">{code}</span></div>
      <a href="#lich-su" className="btn-secondary-white btn-sm"><Icon glyph="arrowLeft" />Quay lại danh sách</a>
    </div>
  );
  if (error) return <div className="page-container">{crumbs}<LoadError message={error} retry={load} /></div>;
  if (!ticket) return <div className="page-container">{crumbs}<Skeleton /></div>;

  const costs = ticket.costs;
  return (
    <div className="page-container">
      {crumbs}
      <div className="ticket-hero-card">
        <div>
          <h1>{[ticket.brandName, ticket.productName].filter(Boolean).join(" ") || "Thiết bị"}</h1>
          <div className="ticket-hero-meta">
            <span>Mã phiếu: <strong className="mono">{ticket.code}</strong></span>
            {ticket.serialOrImei && <span>Serial/IMEI: <strong className="mono">{ticket.serialOrImei}</strong></span>}
          </div>
        </div>
        <StatusBadge table="TICKET_STATUS_CUSTOMER" code={ticket.status} />
      </div>

      <div className="detail-grid-2">
        <div className="content-stack">
          {ticket.pendingQuotation && <Quotation ticket={ticket} onDecided={(updated) => { setTicket(updated); onChanged(); }} />}
          <section className="content-panel-card">
            <h2 className="card-heading-title">Tiến độ xử lý</h2>
            <p className="card-heading-desc">
              {ticket.stopped ? "Phiếu đã dừng theo yêu cầu hoặc trả máy không sửa." : "Hành trình kiểm tra, sửa chữa và bàn giao thiết bị."}
            </p>
            <ol className="timeline-stepper">
              {ticket.steps.map((step: Json, index: number) => (
                <li key={step.key} className={"timeline-node-item" + (step.state === "DONE" ? " is-done" : step.state === "CURRENT" && !ticket.stopped ? " active" : "")}>
                  <span className="timeline-dot">{step.state === "DONE" ? <Icon glyph="check" /> : index + 1}</span>
                  <div className="timeline-title">{step.label}</div>
                  <div className="timeline-desc">
                    {step.state === "DONE" ? "Hoàn tất" : step.state === "CURRENT" && !ticket.stopped ? "Đang xử lý" : "Chưa tới"}
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="content-panel-card">
            <h2 className="card-heading-title" style={{ marginBottom: 16 }}>Ghi chú từ trung tâm</h2>
            {ticket.customerNotes.length ? (
              <ul className="note-list">
                {ticket.customerNotes.map((note: Json, index: number) => (
                  <li key={index}><time dateTime={note.at}>{fmt().dateTime(note.at)}</time>{note.text}</li>
                ))}
              </ul>
            ) : <p className="card-heading-desc">Chưa có ghi chú mới.</p>}
          </section>
        </div>

        <div className="content-stack">
          <section className="content-panel-card">
            <h2 className="card-heading-title" style={{ marginBottom: 12 }}>Thông tin phiếu</h2>
            <div className="kv-list">
              <div className="kv-row"><span>Ngày tiếp nhận</span><strong>{fmt().dateTime(ticket.receivedAt)}</strong></div>
              <div className="kv-row"><span>Hẹn trả máy</span><strong style={{ color: "var(--kh-forest)" }}>{fmt().dateTime(ticket.promisedReturnAt)}</strong></div>
              {ticket.handedOverAt && <div className="kv-row"><span>Đã bàn giao</span><strong>{fmt().dateTime(ticket.handedOverAt)}</strong></div>}
            </div>
          </section>
          <section className="content-panel-card">
            <h2 className="card-heading-title" style={{ marginBottom: 12 }}>Chi phí dự kiến</h2>
            {ticket.pendingQuotation ? (
              <p className="card-heading-desc">Chi phí được cập nhật sau khi bạn đồng ý báo giá ở trên.</p>
            ) : (
            <div className="kv-list">
              <div className="kv-row"><span>Chi phí trong bảo hành</span><span>{fmt().money(costs.inWarrantyAmount)}</span></div>
              <div className="kv-row"><span>Linh kiện ngoài bảo hành</span><span>{fmt().money(costs.outOfWarrantyParts)}</span></div>
              <div className="kv-row"><span>Phí dịch vụ</span><span>{fmt().money(costs.serviceFee)}</span></div>
              <div className="kv-row"><span>VAT</span><span>{fmt().money(costs.vat)}</span></div>
              <div className="kv-row is-total"><span>Tổng thanh toán</span><span>{fmt().money(costs.total)}</span></div>
            </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Quotation({ ticket, onDecided }: { ticket: Json; onDecided: (ticket: Json) => void }) {
  const quote = ticket.pendingQuotation;
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, run] = useBusy();
  const decide = (decision: "ACCEPT" | "DECLINE") => run(async () => {
    setError("");
    if (decision === "DECLINE" && !reason.trim()) return setError("Vui lòng nhập lý do từ chối.");
    try {
      onDecided(await api().post(`/portal/tickets/${encodeURIComponent(ticket.code)}/quotation-decision`,
        { decision, reason: decision === "DECLINE" ? reason.trim() : null }));
      (window as Json).showToast?.(decision === "ACCEPT" ? "Đã xác nhận báo giá." : "Đã từ chối báo giá.", "success");
    } catch (e) {
      setError(errorText(e));
    }
  });
  return (
    <section className="content-panel-card quote-card">
      <div className="panel-head">
        <div>
          <h2 className="card-heading-title">Xác nhận báo giá sửa chữa</h2>
          <p className="card-heading-desc">Có hiệu lực đến {fmt().date(quote.validUntil)}. Trung tâm chỉ sửa phần tính phí sau khi bạn đồng ý.</p>
        </div>
        <span className="badge badge-waiting">Chờ bạn xác nhận</span>
      </div>
      <div className="kv-list">
        {quote.lines.map((line: Json) => (
          <div key={line.lineNo} className="kv-row"><span>{line.description} × {line.quantity}</span><span>{fmt().money(line.lineTotal)}</span></div>
        ))}
        {/* Dòng hạng mục đã gồm tiền công; tách linh kiện / công / VAT để khách cộng lại được ra tổng. */}
        <div className="kv-row"><span>Linh kiện</span><span>{fmt().money(quote.partsTotal)}</span></div>
        <div className="kv-row"><span>Tiền công</span><span>{fmt().money(quote.laborTotal)}</span></div>
        <div className="kv-row"><span>VAT ({Number(quote.vatRate)}%)</span><span>{fmt().money(quote.grandTotal - quote.partsTotal - quote.laborTotal)}</span></div>
        <div className="kv-row is-total"><span>Tổng khách phải trả</span><span>{fmt().money(quote.grandTotal)}</span></div>
      </div>
      {error && <div className="field-error" role="alert">{error}</div>}
      {declining && (
        <div className="form-row-group decline-box">
          <label htmlFor="decline-reason">Lý do từ chối</label>
          <textarea id="decline-reason" className="regular-input" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: chi phí cao hơn dự kiến" />
        </div>
      )}
      <div className="quote-actions">
        {declining ? (
          <>
            <button type="button" className="btn-secondary-white" onClick={() => { setDeclining(false); setError(""); }} disabled={busy}>Quay lại</button>
            <button type="button" className="btn-secondary-white btn-danger-outline" onClick={() => decide("DECLINE")} disabled={busy}>Xác nhận từ chối</button>
          </>
        ) : (
          <>
            <button type="button" className="btn-secondary-white btn-danger-outline" onClick={() => setDeclining(true)} disabled={busy}>Từ chối báo giá</button>
            <button type="button" className="btn-primary-teal" onClick={() => decide("ACCEPT")} disabled={busy}>
              {busy ? "Đang gửi…" : "Đồng ý báo giá"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Gửi yêu cầu bảo hành */

const MAX_FILES = 3;

function NewRequest({ data, serial, onSubmitted }: { data: Data; serial: string; onSubmitted: () => void }) {
  const device = data.devices.find((d) => d.serialOrImei === serial);
  const [catalog, setCatalog] = useState<Json>(null);
  const [form, setForm] = useState({
    category: "", brandModel: device ? [device.brandName, device.productName].filter(Boolean).join(" ") : "",
    serial, symptom: "", station: "", time: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState("");
  const [created, setCreated] = useState("");
  const [busy, run] = useBusy();

  useEffect(() => {
    api().portal.catalog().then(setCatalog).catch((e: Json) => setSummary(errorText(e)));
  }, []);

  const category = catalog?.categories.find((c: Json) => c.code === form.category);
  const type = category?.deviceTypes[0];
  const idLabel = type?.identifierType === "IMEI" ? "IMEI" : "Số Serial";
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => {
    setForm({ ...form, [key]: event.target.value });
    setErrors({ ...errors, [key]: "" });
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSummary("");
    const next: Record<string, string> = {};
    if (!form.category) next.category = "Vui lòng chọn loại thiết bị.";
    if (!form.brandModel.trim()) next.brandModel = "Vui lòng nhập hãng/model.";
    if (!form.serial.trim()) next.serial = `Vui lòng nhập ${idLabel}.`;
    if (!form.symptom.trim()) next.symptom = "Vui lòng mô tả lỗi.";
    if (!form.station) next.station = "Vui lòng chọn trạm dịch vụ.";
    const from = form.time ? new Date(form.time) : null;
    if (!from || Number.isNaN(from.getTime())) next.time = "Vui lòng chọn thời gian mong muốn mang máy tới.";
    else if (from.getTime() < Date.now()) next.time = "Thời gian mong muốn phải ở tương lai.";
    if (files.length > MAX_FILES) next.files = `Chỉ đính kèm tối đa ${MAX_FILES} tệp.`;
    setErrors(next);
    if (Object.keys(next).length || !type || !from) return;
    await run(async () => {
      try {
        const body = {
          categoryCode: category.code, deviceTypeCode: type.code, brandModel: form.brandModel.trim(),
          identifierType: type.identifierType, serialOrImei: form.serial.trim(), symptom: form.symptom.trim(),
          preferredStation: form.station, preferredFrom: from.toISOString(),
          // ponytail: khung 1 giờ cố định như cổng công khai; thêm ô "đến" khi trạm cần đặt lịch theo khung giờ thật.
          preferredTo: new Date(from.getTime() + 3600000).toISOString(),
        };
        const result = await api().request("POST", "/portal/my/warranty-requests", { formData: api().multipart(body, { files }) });
        setCreated(result.code);
        setForm({ category: "", brandModel: "", serial: "", symptom: "", station: "", time: "" });
        setFiles([]);
        onSubmitted();
        window.scrollTo({ top: 0 });
      } catch (e) {
        setSummary(errorText(e));
      }
    });
  }

  const err = (key: string) => errors[key] && <div className="field-error">{errors[key]}</div>;
  const p = data.profile;
  return (
    <>
      <section className="warranty-hero-banner">
        <div className="breadcrumb-text"><a href="#">Trang chủ</a> / <span>Gửi yêu cầu bảo hành</span></div>
        <h1 className="warranty-title">Gửi yêu cầu bảo hành &amp; sửa chữa</h1>
        <p className="warranty-subtitle">Khai báo trước thông tin thiết bị và lỗi gặp phải, chọn trạm và thời gian mang máy tới. Kỹ thuật viên nắm trước tình trạng để tiếp nhận nhanh hơn.</p>
      </section>

      <div className="method-cards-section">
        <div className="method-card active-method">
          <span className="method-icon-box"><Icon glyph="wrench" /></span>
          <div>
            <h2 className="method-card-title">Gửi yêu cầu sửa chữa</h2>
            <p className="method-card-desc">Thiết bị gặp sự cố? Gửi yêu cầu để trạm dịch vụ chuẩn bị tiếp nhận.</p>
          </div>
        </div>
        <a href="/portal" className="method-card">
          <span className="method-icon-box is-amber"><Icon glyph="search" /></span>
          <div>
            <h2 className="method-card-title">Tra cứu tiến độ</h2>
            <p className="method-card-desc">Tra phiếu bằng mã phiếu và số điện thoại, không cần đăng nhập.</p>
          </div>
        </a>
      </div>

      <div className="register-main-container">
        <form className="form-card-panel" onSubmit={submit} noValidate={true}>
          {created && (
            <div className="kh-alert kh-alert--success" role="status">
              <span>Đã gửi yêu cầu — mã <span className="mono">{created}</span>. Trung tâm sẽ liên hệ với bạn sớm nhất.</span>
              <a href="#lich-su" className="btn-primary-teal btn-sm">Xem lịch sử →</a>
            </div>
          )}
          {summary && <div className="kh-alert kh-alert--error" role="alert">{summary}</div>}

          <h2 className="form-section-title"><span className="form-section-num">1</span>Thông tin thiết bị</h2>
          <div className="two-inputs-grid form-row-group">
            <div>
              <label htmlFor="req-category">Loại thiết bị *</label>
              <select id="req-category" className="regular-input" value={form.category} onChange={set("category")} aria-invalid={Boolean(errors.category) || undefined}>
                <option value="">{catalog ? "— Chọn loại thiết bị —" : "Đang tải danh mục…"}</option>
                {catalog?.categories.map((c: Json) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
              {err("category")}
            </div>
            <div>
              <label htmlFor="req-brand-model">Hãng / Model *</label>
              <input id="req-brand-model" className="regular-input" value={form.brandModel} onChange={set("brandModel")}
                placeholder="Ví dụ: Samsung Inverter RT35K5982" aria-invalid={Boolean(errors.brandModel) || undefined} />
              {err("brandModel")}
            </div>
          </div>
          <div className="form-row-group">
            <label htmlFor="req-serial">{idLabel} *</label>
            <input id="req-serial" className="regular-input mono" value={form.serial} onChange={set("serial")} list="req-devices"
              autoComplete="off" spellCheck={false} aria-invalid={Boolean(errors.serial) || undefined} aria-describedby="req-serial-note" />
            <datalist id="req-devices">
              {data.devices.map((d) => <option key={d.code} value={d.serialOrImei}>{[d.brandName, d.productName].filter(Boolean).join(" ")}</option>)}
            </datalist>
            <div className="input-subnote" id="req-serial-note">In trên thân máy, tem niêm phong hoặc vỏ hộp sản phẩm.</div>
            {err("serial")}
          </div>
          <div className="form-row-group">
            <label htmlFor="req-symptom">Mô tả lỗi *</label>
            <textarea id="req-symptom" className="regular-input" maxLength={2000} value={form.symptom} onChange={set("symptom")}
              placeholder="Mô tả hiện tượng: máy không lên nguồn, màn hình sọc, rò nước…" aria-invalid={Boolean(errors.symptom) || undefined} />
            {err("symptom")}
          </div>
          <div className="two-inputs-grid form-row-group">
            <div>
              <label htmlFor="req-station">Trạm dịch vụ *</label>
              <select id="req-station" className="regular-input" value={form.station} onChange={set("station")} aria-invalid={Boolean(errors.station) || undefined}>
                <option value="">— Chọn trạm —</option>
                {catalog?.stations.map((s: Json) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
              {err("station")}
            </div>
            <div>
              <label htmlFor="req-time">Thời gian mang máy tới *</label>
              <input id="req-time" type="datetime-local" className="regular-input" value={form.time} onChange={set("time")}
                aria-invalid={Boolean(errors.time) || undefined} />
              {err("time")}
            </div>
          </div>
          <div className="form-row-group">
            <label htmlFor="req-media">Ảnh / video lỗi (tối đa {MAX_FILES} tệp)</label>
            <input id="req-media" type="file" className="regular-input" accept="image/*,video/*" multiple={true}
              onChange={(e) => { setFiles(Array.from(e.target.files || [])); setErrors({ ...errors, files: "" }); }} />
            <div className="input-subnote">Không bắt buộc — giúp kỹ thuật viên hình dung lỗi trước khi bạn mang máy tới.</div>
            {err("files")}
          </div>

          <h2 className="form-section-title"><span className="form-section-num">2</span>Thông tin chủ sở hữu</h2>
          <div className="owner-summary">
            <div><span>Họ và tên: </span>{p.fullName}</div>
            <div><span>Số điện thoại: </span>{p.phone}</div>
            <div><span>Email: </span>{p.email || "—"}</div>
            <div><span>Địa chỉ: </span>{p.address || "—"}</div>
          </div>
          <div className="input-subnote">Lấy từ hồ sơ tài khoản. <a className="dispatch-link" href="#ho-so">Cập nhật hồ sơ</a></div>

          <button type="submit" className="btn-primary-teal" disabled={busy} style={{ width: "100%", minHeight: 50, marginTop: 24, borderRadius: 12, fontSize: 15 }}>
            {busy ? "Đang gửi yêu cầu…" : "Gửi yêu cầu sửa chữa"}
          </button>
        </form>

        <aside className="sidebar-benefits-card">
          <h2 className="sidebar-title">Sau khi gửi yêu cầu</h2>
          <div className="benefit-item-row">
            <span className="benefit-icon-box"><Icon glyph="clock" /></span>
            <div className="benefit-text"><h5>Trạm chuẩn bị tiếp nhận</h5><p>Kỹ thuật viên xem trước mô tả và ảnh lỗi bạn gửi.</p></div>
          </div>
          <div className="benefit-item-row">
            <span className="benefit-icon-box"><Icon glyph="list" /></span>
            <div className="benefit-text"><h5>Theo dõi trong tài khoản</h5><p>Yêu cầu và phiếu tiếp nhận hiện trong mục Lịch sử bảo hành.</p></div>
          </div>
          <div className="benefit-item-row">
            <span className="benefit-icon-box"><Icon glyph="shield" /></span>
            <div className="benefit-text"><h5>Xác nhận báo giá trước khi sửa</h5><p>Phần sửa chữa tính phí chỉ thực hiện sau khi bạn xác nhận báo giá.</p></div>
          </div>
          {catalog?.stations.length > 0 && (
            <div className="support-box-white">
              <h5>Trạm dịch vụ</h5>
              <ul className="station-list">
                {catalog.stations.map((s: Json) => <li key={s.code}><strong>{s.name}</strong>{s.address && <span>{s.address}</span>}</li>)}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Hồ sơ & đổi mật khẩu */

function ProfileArea({ data, view, onChanged }: { data: Data; view: "profile" | "password"; onChanged: () => void }) {
  const p = data.profile;
  const nav = [
    ["#ho-so", "user", "Hồ sơ cá nhân", "profile"], ["#doi-mat-khau", "key", "Đổi mật khẩu", "password"],
    ["#lich-su", "list", "Lịch sử bảo hành", ""], ["#yeu-cau-moi", "plus", "Gửi yêu cầu mới", ""],
  ];
  return (
    <div className="page-container">
      <div className="breadcrumb-text"><a href="#">Trang chủ</a> / <span>{view === "profile" ? "Thông tin tài khoản" : "Đổi mật khẩu"}</span></div>
      <div className="profile-layout-grid">
        <aside className="user-sidebar-card">
          <div className="user-big-avatar" aria-hidden="true">{initial(p.fullName)}</div>
          <h2 className="user-card-fullname">{p.fullName}</h2>
          <div className="user-card-phone"><Icon glyph="phone" />{p.phone}</div>
          <div><span className="user-badge-role"><Icon glyph="shield" />Khách hàng thành viên</span></div>
          <div className="sidebar-stats-row">
            <div><div className="stat-box-num">{data.devices.length}</div><div className="stat-box-label">Thiết bị</div></div>
            <div><div className="stat-box-num">{data.tickets.length}</div><div className="stat-box-label">Phiếu xử lý</div></div>
          </div>
          <nav className="sidebar-nav-links" aria-label="Tài khoản">
            {nav.map(([href, icon, label, key]) => (
              <a key={href} href={href} className={"sidebar-nav-btn" + (key === view ? " active" : "")} aria-current={key === view ? "page" : undefined}>
                <Icon glyph={icon} />{label}
              </a>
            ))}
          </nav>
        </aside>
        {view === "profile" ? <ProfileForm data={data} onChanged={onChanged} /> : <PasswordForm />}
      </div>
    </div>
  );
}

function ProfileForm({ data, onChanged }: { data: Data; onChanged: () => void }) {
  const p = data.profile;
  const [email, setEmail] = useState(p.email || "");
  const [address, setAddress] = useState(p.address || "");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, run] = useBusy();
  const dirty = email !== (p.email || "") || address !== (p.address || "");

  const save = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      try {
        await api().patch("/portal/my/profile", { email: email.trim(), address: address.trim() });
        setMessage({ ok: true, text: "Đã cập nhật thông tin liên hệ." });
        onChanged();
      } catch (e) {
        setMessage({ ok: false, text: errorText(e) });
      }
    });
  };

  const devices = data.devices;
  return (
    <div className="content-stack">
      <section className="content-panel-card">
        <h1 className="card-heading-title">Hồ sơ cá nhân</h1>
        <p className="card-heading-desc" style={{ marginBottom: 22 }}>Thông tin liên hệ để trung tâm gửi thông báo bảo hành và giao nhận thiết bị.</p>
        {message && <div className={"kh-alert " + (message.ok ? "kh-alert--success" : "kh-alert--error")} role={message.ok ? "status" : "alert"}>{message.text}</div>}
        <form onSubmit={save} noValidate={true}>
          <div className="two-inputs-grid form-row-group">
            <div>
              <label htmlFor="pf-name">Họ và tên</label>
              <input id="pf-name" className="regular-input" value={p.fullName} readOnly={true} />
            </div>
            <div>
              <label htmlFor="pf-phone">Số điện thoại (tên đăng nhập)</label>
              <input id="pf-phone" className="regular-input" value={p.phone} readOnly={true} />
            </div>
          </div>
          <div className="two-inputs-grid form-row-group">
            <div>
              <label htmlFor="pf-email">Địa chỉ email</label>
              <input id="pf-email" type="email" className="regular-input" value={email} maxLength={100} autoComplete="email"
                onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" />
            </div>
            <div>
              <label htmlFor="pf-code">Mã khách hàng</label>
              <input id="pf-code" className="regular-input mono" value={p.customerCode} readOnly={true} />
            </div>
          </div>
          <div className="form-row-group">
            <label htmlFor="pf-address">Địa chỉ nhận trả thiết bị</label>
            <input id="pf-address" className="regular-input" value={address} maxLength={255} autoComplete="street-address"
              onChange={(e) => setAddress(e.target.value)} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" />
          </div>
          <div className="input-subnote">Cần đổi họ tên hoặc số điện thoại? Vui lòng liên hệ trạm dịch vụ.</div>
          <div className="form-actions">
            <div className="form-actions-end">
              <button type="submit" className="btn-primary-teal" disabled={busy || !dirty}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button>
            </div>
          </div>
        </form>
      </section>

      <section className="content-panel-card">
        <div className="panel-head">
          <div>
            <h2 className="card-heading-title">Thiết bị của bạn</h2>
            <p className="card-heading-desc">Thiết bị đã đăng ký bảo hành gắn với tài khoản.</p>
          </div>
        </div>
        {devices.length ? (
          <div className="devices-list-grid">
            {devices.map((d) => (
              <div key={d.code} className="device-item-card">
                <div className="device-info-col">
                  <span className="device-avatar-box"><Icon glyph="device" /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="device-title-name">{d.productName || "Thiết bị"}</div>
                    <div className="device-sub">
                      <span className="device-serial-pill">{d.identifierType === "IMEI" ? "IMEI" : "SN"}: {d.serialOrImei}</span>
                      {d.brandName && <span>{d.brandName}</span>}
                      <span>Hạn bảo hành: <strong>{fmt().date(d.warrantyExpiresOn)}</strong></span>
                    </div>
                  </div>
                </div>
                <div className="device-actions">
                  <StatusBadge table="WARRANTY_STATUS" code={d.warrantyStatus} />
                  <a href={`#yeu-cau-moi/${encodeURIComponent(d.serialOrImei)}`} className="btn-secondary-white btn-sm"><Icon glyph="wrench" />Yêu cầu sửa chữa</a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty icon="device" title="Chưa có thiết bị" text="Thiết bị được trạm dịch vụ đăng ký bảo hành với số điện thoại của bạn sẽ hiện ở đây." />
        )}
      </section>
    </div>
  );
}

function PasswordForm() {
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, run] = useBusy();
  const set = (key: keyof typeof values) => (value: string) => setValues({ ...values, [key]: value });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!values.current || !values.next) return setMessage({ ok: false, text: "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới." });
    if (values.next !== values.confirm) return setMessage({ ok: false, text: "Mật khẩu xác nhận không khớp." });
    if (values.next === values.current) return setMessage({ ok: false, text: "Mật khẩu mới phải khác mật khẩu hiện tại." });
    void run(async () => {
      try {
        // Đổi mật khẩu thu hồi các phiên khác; phiên này nhận access token mới.
        const result = await api().auth.changePassword(values.current, values.next);
        api().tokens.set(result.accessToken);
        api().session.remember(result.user);
        setValues({ current: "", next: "", confirm: "" });
        setMessage({ ok: true, text: "Đổi mật khẩu thành công. Các thiết bị khác đã bị đăng xuất." });
      } catch (e) {
        setMessage({ ok: false, text: errorText(e) });
      }
    });
  };

  return (
    <section className="content-panel-card">
      <h1 className="card-heading-title">Đổi mật khẩu đăng nhập</h1>
      <p className="card-heading-desc" style={{ marginBottom: 22 }}>Dùng mật khẩu mạnh, khác với mật khẩu bạn dùng ở nơi khác.</p>
      {message && <div className={"kh-alert " + (message.ok ? "kh-alert--success" : "kh-alert--error")} role={message.ok ? "status" : "alert"}>{message.text}</div>}
      <form onSubmit={submit} noValidate={true} style={{ maxWidth: 560 }}>
        <div className="form-group">
          <label htmlFor="pw-current">Mật khẩu hiện tại *</label>
          <PasswordInput id="pw-current" name="currentPassword" autoComplete="current-password" value={values.current} onChange={set("current")} />
        </div>
        <div className="form-group">
          <label htmlFor="pw-new">Mật khẩu mới *</label>
          <PasswordInput id="pw-new" name="newPassword" autoComplete="new-password" value={values.next} onChange={set("next")} describedBy="pw-new-note" />
          <div className="input-subnote" id="pw-new-note">Tối thiểu 10 ký tự, gồm chữ và số, không chứa số điện thoại.</div>
        </div>
        <div className="form-group">
          <label htmlFor="pw-confirm">Xác nhận mật khẩu mới *</label>
          <PasswordInput id="pw-confirm" name="confirmPassword" autoComplete="new-password" value={values.confirm} onChange={set("confirm")} />
        </div>
        <div className="tip-box">
          <strong>Lưu ý an toàn tài khoản</strong>
          <ul>
            <li>Không chia sẻ mật khẩu hoặc mã OTP với bất kỳ ai, kể cả nhân viên hỗ trợ.</li>
            <li>Sau khi đổi, các thiết bị khác đang đăng nhập sẽ phải đăng nhập lại.</li>
          </ul>
        </div>
        <div className="form-actions">
          <div className="form-actions-end">
            <a href="#ho-so" className="btn-secondary-white">Hủy</a>
            <button type="submit" className="btn-primary-teal" disabled={busy}>{busy ? "Đang đổi…" : "Đổi mật khẩu"}</button>
          </div>
        </div>
      </form>
    </section>
  );
}
