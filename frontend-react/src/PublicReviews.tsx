import { useEffect, useState } from 'react';
import { api, Icon } from './customer';

type Review = { id: string; rating: number; comment: string | null; reviewedOn: string };
type Reviews = { reviewCount: number; averageRating: number | null; items: Review[] };
export const isReviewPreview = import.meta.env.DEV && new URLSearchParams(location.search).get('reviewPreview') === '1';

function ReviewCard({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false);
  const text = Array.from(review.comment || '');
  return <article className="home-review">
    <div className="home-review-heading"><span className="home-review-avatar" aria-hidden="true">KH</span>
      <div><strong>{isReviewPreview ? 'Khách hàng demo' : 'Khách hàng ẩn danh'}</strong><span className="home-review-verified"><Icon glyph="checkCircle" /> {isReviewPreview ? 'Dữ liệu mẫu' : 'Đã nhận thiết bị'}</span></div>
      <time dateTime={review.reviewedOn}>{new Date(review.reviewedOn + 'T00:00:00+07:00').toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })}</time>
    </div>
    <div className="home-review-stars" role="img" aria-label={`${review.rating} trên 5 sao`}>{[1, 2, 3, 4, 5].map(n => <span key={n} aria-hidden="true" className={n <= review.rating ? 'is-filled' : ''}>★</span>)}</div>
    {review.comment && <blockquote>{expanded ? review.comment : text.slice(0, 160).join('') + (text.length > 160 ? '…' : '')}</blockquote>}
    {text.length > 160 && <button className="home-review-expand" type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Thu gọn' : 'Đọc tiếp'}</button>}
  </article>;
}

export function PublicReviewsPanel() {
  const [data, setData] = useState<Reviews | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let mounted = true; setLoading(true); setError(false);
    const load = import.meta.env.DEV && isReviewPreview
      ? import('./dev/reviewPreview').then(module => module.previewReviews) : api().reviews.public();
    void load.then((value: Reviews) => { if (mounted) setData(value); })
      .catch(() => { if (mounted) setError(true); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [reload]);
  const hasReviews = Boolean(data?.reviewCount);

  return <div className="hero-dashboard-card home-reviews-card" aria-label="Đánh giá khách hàng" aria-busy={loading}>
    <div className="card-top-bar"><h2 className="dispatch-title">{hasReviews ? 'Khách hàng đánh giá Soopi' : 'An tâm bảo hành tại Soopi'}</h2><Icon glyph="shield" /></div>
    {isReviewPreview && <p className="home-review-preview" role="status">Đánh giá mẫu — chỉ để xem giao diện. <a href="/">Thoát xem thử</a></p>}
    {loading && !data && <div className="home-reviews-loading" role="status">Đang tải đánh giá…</div>}
    {hasReviews && data && <div className="home-review-summary">
      <div><strong>{data.averageRating?.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<span>/5</span></strong><span className="home-review-stars" aria-hidden="true">★</span></div>
      <p><b>{data.reviewCount.toLocaleString('vi-VN')}</b> {isReviewPreview ? 'đánh giá mẫu' : 'đánh giá sau bàn giao'}<span>{isReviewPreview ? 'Không lưu vào dữ liệu đánh giá thật.' : 'Điểm trung bình từ tất cả đánh giá xác thực.'}</span></p>
    </div>}
    {data?.items.length ? <><div className="home-review-list">{data.items.slice(0, showAll ? (isReviewPreview ? data.items.length : 6) : 2).map(review => <ReviewCard key={review.id} review={review} />)}</div>
      {data.items.length > 2 && <button className="home-review-expand" type="button" onClick={() => setShowAll(value => !value)} aria-expanded={showAll}>{showAll ? 'Thu gọn' : 'Xem thêm đánh giá'}</button>}
      <p className="home-reviews-note">Nhận xét được chọn công khai, không hiển thị thông tin hồ sơ.</p>
    </> : !loading && <ul className="home-trust-points">
      <li><Icon glyph="file" /><span><strong>Báo giá rõ ràng</strong>Bạn duyệt chi phí trước khi sửa.</span></li>
      <li><Icon glyph="search" /><span><strong>Theo dõi từng bước</strong>Tra cứu bằng mã phiếu và số điện thoại.</span></li>
      <li><Icon glyph="chatDots" /><span><strong>Trao đổi trực tiếp</strong>Nhắn với người tiếp nhận hoặc KTV phụ trách.</span></li>
    </ul>}
    {error && <p className="home-reviews-note" role="status">Chưa tải được đánh giá. <button className="home-review-expand" type="button" disabled={loading} onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}
    <a href="/portal" className="qr-scan-spark-card"><span className="card-icon-circle"><Icon glyph="search" /></span><span><span className="qr-spark-title">Tra cứu tiến độ</span><span className="qr-spark-val">Mã phiếu + số điện thoại</span></span><span aria-hidden="true">→</span></a>
  </div>;
}
