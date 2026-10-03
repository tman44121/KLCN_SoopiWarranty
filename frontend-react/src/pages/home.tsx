import { useEffect, useState } from "react";
import { usePage } from "../usePage";
import { CustomerFooter, CustomerHeader, Icon, STEP_LABELS, StatusBadge, api, fmt, useCustomerName } from "../customer";

/* Trang chủ / giới thiệu của Soopi — port bố cục home/index.html + home.css của web khách KLCN theo DESIGN.md
   (class giữ tên cũ, CSS bọc trong .kh-home). Số liệu cố định của bản cũ (lượt khách, SLA, CSAT, hotline, thương hiệu)
   không có nguồn thật nên thay bằng dữ liệu thật: danh mục công khai /portal/catalog, phiếu của khách đăng nhập qua
   /portal/my/tickets. Chưa đăng nhập hoặc chưa có phiếu → danh sách mẫu như bản cũ, ghi rõ "Ví dụ minh họa". */

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
type Ticket = { code: string; productName?: string; serialOrImei?: string; receivedAt?: string; status: string; currentStep: number };

const SAMPLE_TICKETS: Ticket[] = [
  { code: "TN-2026-0908-00001", productName: "MacBook Air M2 2023", serialOrImei: "C02G789X01", receivedAt: "2026-09-08T02:00:00Z", status: "REPAIRING", currentStep: 3 },
  { code: "TN-2026-0907-00002", productName: "Máy lọc không khí Pro X", serialOrImei: "MLK-992011", receivedAt: "2026-09-07T02:00:00Z", status: "AWAITING_PARTS", currentStep: 2 },
  { code: "TN-2026-0905-00003", productName: "Smart Tivi OLED 55 inch", serialOrImei: "TV-55OLED-88", receivedAt: "2026-09-05T02:00:00Z", status: "COMPLETED", currentStep: 5 },
];

/* Nhóm theo TICKET_STATUS (labels.js). Trạng thái chưa biết tính vào "đang sửa" để tổng vẫn khớp. */
const DONE = ["COMPLETED", "DELIVERED", "RETURNED_UNREPAIRED"];
const WAITING = ["AWAITING_PARTS", "AWAITING_QUOTE_APPROVAL", "AWAITING_CUSTOMER_CONFIRMATION", "AWAITING_RETURN"];
const percent = (part: number, total: number) => (total ? Math.round((part * 100) / total) : 0);

const FEATURES = [
  {
    icon: "search", title: "Tra cứu tiến độ trực tuyến",
    text: "Nhập mã phiếu và số điện thoại để xem thiết bị đang ở bước nào, ghi chú của kỹ thuật viên và ngày hẹn trả máy.",
    checks: ["Tra cứu bằng mã phiếu TN- / YC-", "Không cần đăng nhập", "Xem ghi chú và chi phí sửa chữa"],
    link: "Tra cứu ngay", href: "/portal",
  },
  {
    icon: "file", title: "Lịch sử sửa chữa & linh kiện",
    text: "Xem chi tiết các lần sửa chữa, linh kiện được thay và báo giá từng hạng mục trên tài khoản khách hàng của bạn.",
    checks: ["Báo giá ghi rõ từng linh kiện", "Duyệt báo giá trực tuyến", "Lưu toàn bộ lịch sử theo SĐT"],
    link: "Xem lịch sử bảo hành", href: "/account#lich-su",
  },
  {
    icon: "pin", title: "Mạng lưới trạm dịch vụ",
    text: "Mang máy tới trạm dịch vụ gần nhất hoặc chọn trạm và khung giờ khi gửi yêu cầu bảo hành trực tuyến.",
    checks: ["Chọn trạm khi gửi yêu cầu", "Hẹn giờ mang máy tới", "Kỹ thuật viên tiếp nhận và chẩn đoán"],
    link: "Xem trạm dịch vụ", href: "#tram-dich-vu",
  },
];

const EXTEND = [
  { icon: "wrench", title: "Gửi yêu cầu bảo hành online", text: "Mô tả lỗi, đính kèm ảnh tình trạng máy và hẹn giờ mang tới trạm trước khi đi.", tag: "Tiếp nhận nhanh hơn tại trạm" },
  { icon: "checkCircle", title: "Xác nhận báo giá trên web", text: "Phần sửa chữa ngoài bảo hành được báo giá rõ từng dòng; kỹ thuật viên chỉ sửa khi bạn đồng ý.", tag: "Minh bạch chi phí" },
  { icon: "device", title: "Theo dõi hạn bảo hành thiết bị", text: "Danh sách thiết bị gắn với tài khoản kèm trạng thái còn hay hết hạn bảo hành theo hồ sơ trung tâm.", tag: "Theo hồ sơ của trung tâm" },
];

const STEPS = [
  { icon: "user", title: "Đăng ký / Gửi yêu cầu", text: "Tạo tài khoản bằng số điện thoại hoặc gửi yêu cầu bảo hành trực tuyến không cần đăng nhập.", tag: "Chỉ cần số điện thoại" },
  { icon: "inbox", title: "Gửi thiết bị bảo hành", text: "Mang máy tới trạm dịch vụ; lễ tân kiểm tra máy và lập phiếu tiếp nhận mã TN-.", tag: "Nhận mã phiếu để tra cứu" },
  { icon: "clock", title: "Theo dõi tiến độ online", text: "Theo dõi từng bước chẩn đoán, chờ linh kiện, sửa chữa và QC; xác nhận báo giá nếu có.", tag: "Cập nhật theo từng bước" },
  { icon: "checkCircle", title: "Nhận lại máy & nghiệm thu", text: "Khi phiếu ở bước Sẵn sàng nhận máy, tới trạm kiểm tra thiết bị và nhận lại máy.", tag: "Kiểm tra máy khi bàn giao" },
];

const FAQ = [
  {
    q: "Tôi có bắt buộc phải giữ lại hóa đơn giấy để bảo hành không?",
    a: "Không cần giữ hóa đơn giấy để theo dõi phiếu. Thông tin phiếu, thiết bị và hạn bảo hành được lưu theo số điện thoại; bạn tra cứu bằng mã phiếu và số điện thoại hoặc xem trong tài khoản.",
  },
  {
    q: "Làm sao để tôi theo dõi tiến độ sửa chữa thiết bị của mình?",
    a: "Sau khi đăng nhập, trang của bạn hiển thị bảng “Tiến độ sửa chữa thiết bị của bạn” với mã phiếu, trạng thái và bước xử lý. Chưa có tài khoản thì dùng trang Tra cứu tiến độ với mã phiếu và số điện thoại.",
  },
  {
    q: "Phiếu tạo trực tiếp tại trạm có hiện trong tài khoản của tôi không?",
    a: "Có. Phiếu được gắn theo số điện thoại; đăng ký tài khoản bằng đúng số đó thì các phiếu tại trạm tự hiện trong mục Lịch sử bảo hành.",
  },
  {
    q: "Khi nào tôi phải trả phí sửa chữa?",
    a: "Lỗi trong phạm vi bảo hành không tính phí. Với linh kiện hoặc lỗi ngoài bảo hành, trạm gửi báo giá và chỉ sửa sau khi bạn xác nhận.",
  },
];

/** Phiếu của khách đang đăng nhập (mới nhất trước); null khi chưa đăng nhập hoặc không đọc được. */
function useMyTickets(signedIn: boolean) {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    api().get("/portal/my/tickets")
      .then((rows: Ticket[]) => setTickets([...rows].sort((a, b) => String(b.receivedAt || "").localeCompare(String(a.receivedAt || "")))))
      .catch(() => setTickets(null));
  }, [signedIn]);
  return tickets;
}

export default function HomePage() {
  usePage("home", {}, "Trang chủ — Soopi");
  const name = useCustomerName();
  const [catalog, setCatalog] = useState<{ categories: Json[]; stations: Json[] }>({ categories: [], stations: [] });
  const [openFaq, setOpenFaq] = useState(0);
  // Nhãn trạng thái/định dạng ngày (labels.js, fmt) chỉ gắn lên window sau khi usePage khởi tạo trang.
  const [ready, setReady] = useState(false);
  const mine = useMyTickets(Boolean(name));
  useEffect(() => {
    setReady(true);
    api().portal.catalog()
      .then((value: Json) => setCatalog({ categories: value.categories || [], stations: value.stations || [] }))
      .catch(() => setCatalog({ categories: [], stations: [] }));
  }, []);

  const sample = !mine?.length;
  const tickets = sample ? SAMPLE_TICKETS : mine;
  const done = tickets.filter((t) => DONE.includes(t.status)).length;
  const waiting = tickets.filter((t) => WAITING.includes(t.status)).length;
  const processing = tickets.length - done - waiting;
  const sampleNote = name ? "Bạn chưa có phiếu nào — đây là ví dụ" : "Đăng nhập để xem phiếu thật của bạn";
  const historyHref = name ? "/account#lich-su" : "/login?next=" + encodeURIComponent("/account#lich-su");
  const signUp = name ? { href: "/account", label: "Vào trang của tôi" } : { href: "/register", label: "Đăng ký bảo hành ngay" };
  const request = name ? "/account#yeu-cau-moi" : "/portal#dang-ky";
  const bars = [
    { key: "delivered", label: "Đã xong", count: done },
    { key: "operating", label: "Đang sửa chữa", count: processing },
    { key: "received", label: "Đang chờ", count: waiting },
  ];

  return (
    <div className="kh-app kh-home">
      <CustomerHeader active={name ? "" : "home"} />
      <main className="kh-main">
        {/* HERO */}
        <section className="hero-section">
          <div className="hero-bg-glow" />
          <div className="hero-grid-container">
            <div className="hero-left-content">
              <div className="hero-badge-tag"><Icon glyph="shield" />Thẻ bảo hành điện tử dành cho khách hàng</div>
              <h1 className="hero-headline">Tra cứu &amp; quản lý bảo hành sản phẩm</h1>
              <p className="hero-description">
                Theo dõi thời hạn bảo hành, lịch sử sửa chữa, tiến độ thay linh kiện và báo giá cho các thiết bị của bạn ở một nơi.
              </p>
              <div className="hero-actions">
                <a href={signUp.href} className="btn-primary-teal"><Icon glyph="shield" />{signUp.label}</a>
                <a href="/portal" className="btn-secondary-white"><Icon glyph="search" />Tra cứu tiến độ</a>
              </div>
              <dl className="hero-stats-row">
                <div className="hero-stat-item"><dt>Tiến độ sửa chữa minh bạch</dt><dd>{STEP_LABELS.length} bước</dd></div>
                {catalog.stations.length > 0 && <div className="hero-stat-item"><dt>Trạm dịch vụ</dt><dd>{catalog.stations.length}</dd></div>}
                {catalog.categories.length > 0 && <div className="hero-stat-item"><dt>Nhóm thiết bị bảo hành</dt><dd>{catalog.categories.length}</dd></div>}
              </dl>
            </div>

            <div className="hero-dashboard-card" id="tracking">
              <div className="card-top-bar">
                <h2 className="dispatch-title">Tiến độ sửa chữa thiết bị của bạn</h2>
                <span className={"sla-pill-badge" + (sample ? " is-sample" : "")}>{sample ? "Ví dụ minh họa" : "Phiếu của bạn"}</span>
              </div>
              <dl className="dash-stats-grid">
                <div className="dash-stat-box"><dt className="dash-stat-label">Tổng phiếu</dt><dd className="dash-stat-val">{tickets.length}</dd></div>
                <div className="dash-stat-box"><dt className="dash-stat-label">Đang xử lý</dt><dd className="dash-stat-val">{processing + waiting}</dd></div>
                <div className="dash-stat-box"><dt className="dash-stat-label">Đã xong</dt><dd className="dash-stat-val">{done}</dd></div>
              </dl>
              <div className="dispatch-section-header">
                <p className="ticket-meta">{sample ? sampleNote : "Cập nhật theo từng bước xử lý"}</p>
                <a href={historyHref} className="dispatch-link">Xem tất cả thiết bị →</a>
              </div>
              <div className="dispatch-ticket-list">
                {ready && tickets.slice(0, 3).map((ticket, index) => (
                  <a key={ticket.code} href={sample ? "/portal" : `/account#phieu/${ticket.code}`} className="ticket-item-row">
                    <div className="ticket-info-left">
                      <span className={"ticket-type-icon " + (DONE.includes(ticket.status) ? "type-ok" : index % 2 ? "type-sr" : "type-qr")}>
                        <Icon glyph={DONE.includes(ticket.status) ? "checkCircle" : "wrench"} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="ticket-title"><span className="mono">{ticket.code}</span> – {ticket.productName || "Thiết bị"}</div>
                        <div className="ticket-meta">
                          {ticket.serialOrImei && <>SN: <span className="mono">{ticket.serialOrImei}</span> • </>}Tiếp nhận: {fmt().date(ticket.receivedAt)}
                        </div>
                      </div>
                    </div>
                    <StatusBadge table="TICKET_STATUS" code={ticket.status} />
                  </a>
                ))}
              </div>
              <a href="/portal" className="qr-scan-spark-card">
                <span className="card-icon-circle"><Icon glyph="search" /></span>
                <span>
                  <span className="qr-spark-title">Tra cứu nhanh không cần đăng nhập</span>
                  <span className="qr-spark-val">Mã phiếu + số điện thoại</span>
                </span>
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </section>

        {/* NHÓM THIẾT BỊ (dải thương hiệu của bản cũ) */}
        {catalog.categories.length > 0 && (
          <section className="brands-ribbon-section" aria-labelledby="home-categories">
            <h2 className="brands-header-text" id="home-categories">Nhóm thiết bị được tiếp nhận bảo hành tại Soopi</h2>
            <ul className="brands-flex-container">
              {catalog.categories.map((category) => <li key={category.code} className="brand-pill">{category.name}</li>)}
            </ul>
          </section>
        )}

        {/* DÀNH CHO KHÁCH HÀNG */}
        <section className="management-section" id="gioi-thieu">
          <div className="section-container">
            <h2 className="section-title">Dành cho khách hàng tra cứu &amp; bảo hành</h2>
            <p className="section-subtitle">
              Hệ thống tra cứu điện tử giúp bạn theo dõi minh bạch tiến độ sửa chữa và chính sách bảo hành của thiết bị.
            </p>
            <div className="management-grid">
              <div className="management-left-cards">
                <div className="feature-info-card">
                  <div className="card-icon-circle"><Icon glyph="file" /></div>
                  <h3 className="feature-card-heading">Ghi nhận sự cố &amp; yêu cầu bảo hành online</h3>
                  <p className="feature-card-body">
                    Ghi nhận lịch sử hỏng hóc theo số serial/IMEI của sản phẩm. Trạm đối chiếu thời hạn bảo hành và đề xuất phương án xử lý.
                  </p>
                  <div className="card-tags-flex"><span>✓ Tra cứu theo mã phiếu</span><span>✓ Nhật ký sửa chữa</span></div>
                </div>
                <div className="feature-info-card">
                  <div className="card-icon-circle"><Icon glyph="clock" /></div>
                  <h3 className="feature-card-heading">Theo dõi tiến độ &amp; chi phí rõ ràng</h3>
                  <p className="feature-card-body">
                    Cập nhật trạng thái từng bước xử lý, báo giá linh kiện rõ ràng và ngày hẹn trả máy để bạn chủ động sắp xếp.
                  </p>
                  <div className="card-tags-flex"><span>✓ Minh bạch chi phí</span><span>✓ Duyệt báo giá online</span></div>
                </div>
                <a href={signUp.href} className="btn-primary-teal management-cta">
                  <Icon glyph="shield" />{name ? "Vào trang của tôi" : "Tạo tài khoản bảo hành ngay"}
                </a>
              </div>

              <div className="dark-monitoring-panel">
                <div className="dark-panel-header">
                  <div className="dark-panel-tag">{sample ? "Ví dụ minh họa" : "Phiếu của bạn"}</div>
                  <h3 className="dark-panel-title">Tiến độ phục vụ thiết bị</h3>
                </div>
                <div className="sla-progress-box">
                  <div className="sla-progress-label">
                    <span id="home-done-rate">Tỷ lệ phiếu đã xong</span>
                    <span className="sla-progress-value">{percent(done, tickets.length)}%</span>
                  </div>
                  <div className="progress-track" role="progressbar" aria-labelledby="home-done-rate"
                    aria-valuenow={percent(done, tickets.length)} aria-valuemin={0} aria-valuemax={100}>
                    <div className="progress-fill" style={{ width: `${percent(done, tickets.length)}%` }} />
                  </div>
                </div>
                <div className="dark-metrics-grid">
                  <div className="dark-metric-card">
                    <div className="dark-metric-title">Đang sửa chữa</div>
                    <div className="dark-metric-num">{processing}</div>
                    <div className="dark-metric-sub">Tiếp nhận, chẩn đoán, sửa</div>
                  </div>
                  <div className="dark-metric-card">
                    <div className="dark-metric-title">Đang chờ</div>
                    <div className="dark-metric-num">{waiting}</div>
                    <div className="dark-metric-sub">Linh kiện, báo giá hoặc trả máy</div>
                  </div>
                </div>
                <div className="repair-breakdown-box">
                  <div className="breakdown-title">Phân luồng tình trạng thiết bị</div>
                  <div className="multi-color-bar" aria-hidden="true">
                    {bars.filter((bar) => bar.count > 0).map((bar) => (
                      <div key={bar.key} className={`bar-seg-${bar.key}`} style={{ width: `${percent(bar.count, tickets.length)}%` }}>
                        {percent(bar.count, tickets.length)}%
                      </div>
                    ))}
                  </div>
                  <ul className="breakdown-legend">
                    {bars.map((bar) => <li key={bar.key}><i className={`legend-${bar.key}`} />{bar.label}: {bar.count}</li>)}
                  </ul>
                </div>
                <p className="dark-panel-footer">{sample ? sampleNote : "Số liệu tính từ các phiếu của bạn"}</p>
              </div>
            </div>
          </div>
        </section>

        {/* TIỆN ÍCH CHÍNH */}
        <section className="features-main-section" id="features">
          <div className="section-container">
            <div className="center-header">
              <h2 className="section-title">Tiện ích bảo hành cho bạn</h2>
              <p className="section-subtitle">Theo dõi tiến độ sửa chữa, xem linh kiện đã thay và tìm trạm dịch vụ.</p>
            </div>
            <div className="three-cols-grid">
              {FEATURES.map((card) => (
                <article key={card.title} className="main-feature-card">
                  <div className="main-feature-icon"><Icon glyph={card.icon} /></div>
                  <h3 className="feature-title-h3">{card.title}</h3>
                  <p className="feature-desc-p">{card.text}</p>
                  <ul className="checklist-ul">
                    {card.checks.map((check) => <li key={check}><span className="check-mark" aria-hidden="true">✓</span>{check}</li>)}
                  </ul>
                  <a href={card.href === "/account#lich-su" ? historyHref : card.href} className="card-action-link">{card.link} →</a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* TRẢI NGHIỆM DỊCH VỤ */}
        <section className="extend-features-section">
          <div className="section-container">
            <div className="center-header">
              <h2 className="section-title">Trải nghiệm dịch vụ thông minh</h2>
              <p className="section-subtitle">Gửi yêu cầu, duyệt báo giá và quản lý thiết bị ngay trên web, mọi lúc mọi nơi.</p>
            </div>
            <div className="three-cols-grid">
              {EXTEND.map((card) => (
                <article key={card.title} className="main-feature-card">
                  <div className="main-feature-icon"><Icon glyph={card.icon} /></div>
                  <h3 className="feature-title-h3">{card.title}</h3>
                  <p className="feature-desc-p">{card.text}</p>
                  <div className="card-tags-flex"><span>✓ {card.tag}</span></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* QUY TRÌNH 4 BƯỚC */}
        <section className="process-steps-section" id="quy-trinh">
          <div className="section-container">
            <div className="center-header">
              <h2 className="section-title">Quy trình bảo hành dễ dàng 4 bước</h2>
              <p className="section-subtitle">Minh bạch từng bước từ lúc tiếp nhận tới khi nhận lại sản phẩm hoàn chỉnh.</p>
            </div>
            <ol className="steps-four-grid">
              {STEPS.map((step, index) => (
                <li key={step.title} className="step-process-card">
                  <div>
                    <div className="step-top-head">
                      <span className="step-num-big" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                      <div className="step-icon-bg"><Icon glyph={step.icon} /></div>
                    </div>
                    <h3 className="step-card-title">{step.title}</h3>
                    <p className="step-card-desc">{step.text}</p>
                  </div>
                  <div className="step-time-tag">{step.tag}</div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* TRẠM DỊCH VỤ (thay địa chỉ/hotline cố định của bản cũ) */}
        {catalog.stations.length > 0 && (
          <section className="extend-features-section" id="tram-dich-vu">
            <div className="section-container">
              <div className="center-header">
                <h2 className="section-title">Trạm dịch vụ</h2>
                <p className="section-subtitle">Mang thiết bị tới trạm hoặc chọn trạm khi gửi yêu cầu bảo hành trực tuyến.</p>
              </div>
              <ul className="three-cols-grid">
                {catalog.stations.map((station) => (
                  <li key={station.code} className="main-feature-card station-card">
                    <div className="main-feature-icon"><Icon glyph="pin" /></div>
                    <div>
                      <h3 className="feature-title-h3">{station.name}</h3>
                      {station.address && <p className="feature-desc-p">{station.address}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* HỎI ĐÁP */}
        <section className="faq-accordion-section" id="hoi-dap">
          <div className="section-container">
            <div className="center-header">
              <h2 className="section-title">Vấn đề thường gặp của khách hàng</h2>
              <p className="section-subtitle">Giải đáp các thắc mắc về tra cứu bảo hành, thời gian sửa chữa và chính sách linh kiện.</p>
            </div>
            <div className="faq-max-width">
              {FAQ.map((item, index) => (
                <div key={item.q} className={"faq-item-card" + (openFaq === index ? " active" : "")}>
                  <h3>
                    <button type="button" className="faq-question-btn" aria-expanded={openFaq === index} aria-controls={`faq-${index}`}
                      onClick={() => setOpenFaq(openFaq === index ? -1 : index)}>
                      <span>{item.q}</span>
                      <Icon glyph="chevron" />
                    </button>
                  </h3>
                  <div className="faq-answer-body" id={`faq-${index}`} hidden={openFaq !== index}>{item.a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta-banner-section">
          <div className="cta-dark-card">
            <div className="cta-tag-pill"><Icon glyph="shield" />Bảo hành điện tử Soopi</div>
            <h2 className="cta-heading">Bảo vệ quyền lợi bảo hành sản phẩm của bạn</h2>
            <p className="cta-subtitle">
              {name
                ? "Xem phiếu đang xử lý, báo giá chờ xác nhận và gửi yêu cầu mới ngay trong trang tài khoản."
                : "Tạo tài khoản bằng số điện thoại để theo dõi tiến độ sửa chữa và báo giá của mọi thiết bị ở một nơi."}
            </p>
            <div className="cta-buttons-row">
              <a href={signUp.href} className="btn-secondary-white"><Icon glyph="shield" />{signUp.label}</a>
              <a href={request} className="btn-secondary-glass"><Icon glyph="wrench" />Gửi yêu cầu bảo hành</a>
            </div>
          </div>
        </section>
      </main>
      <CustomerFooter />
    </div>
  );
}
