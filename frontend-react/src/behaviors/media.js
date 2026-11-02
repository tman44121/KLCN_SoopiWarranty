/* Ảnh/video khách gửi kèm yêu cầu bảo hành trực tuyến — dùng ở màn Tiếp nhận, Kỹ thuật viên và chi tiết phiếu.
   /files cần Bearer token nên không gắn thẳng vào <img src>: tải thành blob rồi dùng object URL. URL được nhớ theo mã tệp
   để vẽ lại chi tiết phiếu (sau mỗi thao tác) không tải lại; chỉ giữ tối đa MAX_CACHED tệp gần nhất. */
const MAX_CACHED = 40;
const cache = new Map();

function objectUrl(fileId) {
  if (cache.has(fileId)) return cache.get(fileId);
  const pending = window.LML_API.get(`/files/${encodeURIComponent(fileId)}`).then((blob) => URL.createObjectURL(blob));
  pending.catch(() => cache.delete(fileId));
  cache.set(fileId, pending);
  while (cache.size > MAX_CACHED) {
    const [oldest, url] = cache.entries().next().value;
    cache.delete(oldest);
    url.then((value) => URL.revokeObjectURL(value), () => undefined);
  }
  return pending;
}

/** "2 ảnh, 1 video". */
export function attachmentLabel(files) {
  const images = files.filter((file) => String(file.contentType).startsWith("image/")).length;
  const videos = files.length - images;
  return [images && `${images} ảnh`, videos && `${videos} video`].filter(Boolean).join(", ");
}

/** Lưới ảnh/video trong container; ô lỗi nói rõ tệp nào không tải được thay vì làm hỏng cả khối. */
export async function renderMedia(container, files) {
  const html = window.html;
  container.innerHTML = html`<div class="request-media-grid">${files.map((file) => html`
    <figure class="request-media-item" data-media-id="${file.fileId}"><div class="request-media-frame is-loading" aria-hidden="true"></div>
      <figcaption title="${file.fileName}">${file.fileName}</figcaption></figure>`)}</div>`;
  await Promise.all(files.map(async (file) => {
    const frame = () => container.querySelector(`[data-media-id="${file.fileId}"] .request-media-frame`);
    try {
      const url = await objectUrl(file.fileId);
      if (!frame()) return;
      frame().outerHTML = String(file.contentType).startsWith("video/")
        ? html`<video class="request-media-frame" src="${url}" controls preload="metadata"></video>`
        : html`<a class="request-media-frame" href="${url}" target="_blank" rel="noopener" title="Mở ảnh cỡ lớn"><img src="${url}" alt="Ảnh khách gửi: ${file.fileName}" /></a>`;
    } catch (error) {
      if (frame()) frame().outerHTML = html`<div class="request-media-frame is-error" role="status">Không tải được tệp${error.detail ? html` — ${error.detail}` : ""}</div>`;
    }
  }));
}

/** Khối "Ảnh / video khách gửi kèm" của một phiếu lập từ yêu cầu trực tuyến; phiếu tại quầy thì để trống. */
export async function renderTicketMedia(container, ticket) {
  const html = window.html;
  if (!container || !ticket.warrantyRequestCode) return;
  container.innerHTML = html`<div class="request-media-grid"><div class="request-media-frame is-loading" aria-hidden="true"></div></div>`;
  try {
    const files = await window.LML_API.get(`/tickets/${encodeURIComponent(ticket.code)}/attachments`);
    if (!container.isConnected) return;
    if (!files.length) {
      container.innerHTML = html`<p class="cell-muted" style="margin:0;">Yêu cầu <span class="mono">${ticket.warrantyRequestCode}</span> không có ảnh hoặc video đính kèm.</p>`;
      return;
    }
    container.innerHTML = html`<p class="cell-muted" style="margin:0 0 10px;">${attachmentLabel(files)} khách gửi kèm yêu cầu <span class="mono">${ticket.warrantyRequestCode}</span>.</p><div data-media-grid></div>`;
    await renderMedia(container.querySelector("[data-media-grid]"), files);
  } catch (error) {
    if (container.isConnected) container.innerHTML = html`<p class="cell-muted" role="status" style="margin:0;">Không tải được ảnh khách gửi${error.detail ? ` — ${error.detail}` : ""}.</p>`;
  }
}
