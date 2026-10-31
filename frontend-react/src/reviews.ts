export const MAX_REVIEW_LENGTH = 1000;
export const QUICK_TAGS = [
  'Sửa chữa nhanh chóng', 'Kỹ thuật viên nhiệt tình', 'Máy hoạt động tốt',
  'Chi phí minh bạch', 'Đóng gói cẩn thận', 'Tư vấn chu đáo',
];

export function joinReviewComment(tags: string[], comment: string): string {
  return [tags.length ? `[${tags.join(', ')}]` : '', comment.trim()].filter(Boolean).join(' ');
}

export function splitReviewComment(value: string | null | undefined): { tags: string[]; comment: string } {
  const text = value || '';
  const match = /^\[([^\]]+)\](?: (.*))?$/s.exec(text);
  const tags = match?.[1].split(', ') || [];
  return match && tags.every(tag => QUICK_TAGS.includes(tag))
    ? { tags, comment: match[2] || '' }
    : { tags: [], comment: text };
}
