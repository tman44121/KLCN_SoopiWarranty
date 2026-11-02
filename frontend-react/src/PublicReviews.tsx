import { useEffect, useState } from 'react';
import { api, Icon } from './customer';

type Review = { id: string; rating: number; comment: string | null; reviewedOn: string | null };
type Reviews = { reviewCount: number; averageRating: number | null; items: Review[] };
export const isReviewPreview = import.meta.env.DEV && new URLSearchParams(location.search).get('reviewPreview') === '1';

const DATE = { month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' } as const;
const score = (value: number) => value.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Hai lớp ★: lớp màu phủ theo tỉ lệ điểm để 4,3/5 hiện đúng 4,3 sao. */
function StarMeter({ value }: { value: number }) {
  return <span className="home-star-meter" role="img" aria-label={`${score(value)} trên 5 sao`}>
    <span aria-hidden="true">★★★★★</span>
    <span className="home-star-meter-fill" aria-hidden="true" style={{ width: `${Math.max(0, Math.min(5, value)) * 20}%` }}>★★★★★</span>
  </span>;
}

function ReviewCard({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false);
  const text = Array.from(review.comment || '');
  return <article className="home-review">
    <div className="home-review-stars" role="img" aria-label={`${review.rating} trên 5 sao`}>{[1, 2, 3, 4, 5].map(n => <span key={n} aria-hidden="true" className={n <= review.rating ? 'is-filled' : ''}>★</span>)}</div>
    {review.comment && <blockquote>{expanded ? review.comment : text.slice(0, 160).join('') + (text.length > 160 ? '…' : '')}</blockquote>}
    {!review.comment && <p className="home-reviews-note">Chỉ chấm sao, không kèm nhận xét.</p>}
    {text.length > 160 && <button className="home-review-expand" type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Thu gọn' : 'Đọc tiếp'}</button>}
    <div className="home-review-heading"><span className="home-review-avatar" aria-hidden="true">KH</span>
      <div><strong>{isReviewPreview ? 'Khách hàng demo' : review.reviewedOn ? 'Khách hàng ẩn danh' : 'Phiếu bàn giao ẩn danh'}</strong><span className="home-review-verified"><Icon glyph={review.reviewedOn ? 'checkCircle' : 'file'} /> {isReviewPreview ? 'Dữ liệu mẫu' : review.reviewedOn ? 'Đã nhận thiết bị' : 'Điểm trên phiếu bàn giao'}</span>
        {!review.reviewedOn && <span className="home-reviews-note">Chưa lưu ngày đánh giá</span>}</div>
      {review.reviewedOn && <time dateTime={review.reviewedOn}>{new Date(review.reviewedOn + 'T00:00:00+07:00').toLocaleDateString('vi-VN', DATE)}</time>}
    </div>
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
  const hasReviews = Boolean(data?.items.length);
  if (!hasReviews && !error) return null;
  const shown = data ? data.items.slice(0, showAll ? (isReviewPreview ? data.items.length : 6) : 2) : [];

  return <section className="home-public-reviews" aria-labelledby="home-reviews-title"><div className="section-container">
    <div className="home-reviews-head">
      <span className="home-process-eyebrow"><Icon glyph="star" />Đánh giá sau khi nhận máy</span>
      <h2 className="section-title" id="home-reviews-title">Khách hàng nói gì về Soopi</h2>
      <p className="section-subtitle">Điểm hài lòng ghi trên phiếu bàn giao. Quản trị viên chọn những đánh giá được công khai và không hiển thị thông tin hồ sơ.</p>
    </div>
    {isReviewPreview && <p className="home-review-preview" role="status">Đánh giá mẫu — chỉ để xem giao diện. <a href="/">Thoát xem thử</a></p>}
    <div className="home-reviews-card" aria-label="Đánh giá khách hàng" aria-busy={loading}>
      <aside className="home-review-summary">
        {hasReviews && data ? <>
          <span className="home-review-summary-label">Điểm trung bình</span>
          <div className="home-review-score"><strong>{data.averageRating == null ? '—' : score(data.averageRating)}<span>/5</span></strong></div>
          {data.averageRating != null && <StarMeter value={data.averageRating} />}
          <p><b>{data.reviewCount.toLocaleString('vi-VN')}</b> {isReviewPreview ? 'đánh giá mẫu' : 'lượt chấm điểm'}</p>
          <span className="home-review-summary-note">{isReviewPreview ? 'Không lưu vào dữ liệu đánh giá thật.' : 'Từ các điểm hài lòng lưu trên phiếu bàn giao.'}</span>
        </> : <>
          <span className="home-review-summary-label">Điểm trung bình</span>
          <p className="home-review-summary-empty">Chưa có số liệu</p>
          <span className="home-review-summary-note">Điểm và số lượt chấm sẽ hiện khi tải được đánh giá.</span>
        </>}
        <a href="/portal" className="home-review-lookup"><Icon glyph="search" /><span><strong>Tra cứu tiến độ</strong><span>Mã phiếu hoặc Serial + SĐT</span></span><span aria-hidden="true">→</span></a>
      </aside>
      <div className="home-reviews-main">
        {hasReviews && <>
          <div className={'home-review-list' + (showAll ? ' is-expanded' : '')}>{shown.map(review => <ReviewCard key={review.id} review={review} />)}</div>
          {data!.items.length > 2 && <button className="home-review-more" type="button" onClick={() => setShowAll(value => !value)} aria-expanded={showAll}>{showAll ? 'Thu gọn' : 'Xem thêm đánh giá'}</button>}
        </>}
        {error && <div className="home-reviews-error" role="status">
          <span className="home-reviews-error-icon" aria-hidden="true"><Icon glyph="chatDots" /></span>
          <strong>Chưa tải được đánh giá</strong>
          <p>Kết nối tới máy chủ đang gián đoạn. Bạn vẫn tra cứu tiến độ phiếu được bình thường.</p>
          <button className="btn-secondary-white" type="button" disabled={loading} onClick={() => setReload(value => value + 1)}>{loading ? 'Đang tải lại…' : 'Thử lại'}</button>
        </div>}
      </div>
    </div>
  </div></section>;
}
