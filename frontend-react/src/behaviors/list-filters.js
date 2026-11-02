const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const text = value => value && typeof value === 'object' ? Object.values(value).map(text).join(' ') : String(value ?? '');
export function itemDay(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
}
export function filterItems(items, filters, dateKey = 'receivedAt') {
  const q = fold(filters.q).trim();
  return items.filter(item => {
    const day = itemDay(item[dateKey]);
    return (!q || fold(text(item)).includes(q)) && (!filters.status || item.status === filters.status)
      && (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to)
      && (!filters.station || item.stationCode === filters.station)
      && (!filters.technician || item.assignment?.technicianId === filters.technician);
  }).sort((a, b) => {
    if (filters.sort === 'sla') return new Date(a.sla?.dueAt || 0) - new Date(b.sla?.dueAt || 0) || String(b.code || b._id).localeCompare(String(a.code || a._id));
    const direction = filters.sort === 'oldest' ? 1 : -1;
    return direction * ((new Date(a[dateKey] || 0).getTime() - new Date(b[dateKey] || 0).getTime()) || String(a.code || a._id).localeCompare(String(b.code || b._id)));
  });
}

// Shared controls for the lists returned in full by the existing API. Server-paged lists use values() in their query.
export function createListFilters(container, onChange, { statuses = {}, dateKey = 'receivedAt', search = true, sort = true, sla = false, assignment = false } = {}) {
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar list-filters';
  toolbar.setAttribute('aria-label', 'Tìm kiếm và lọc danh sách');
  const { html } = window;
  toolbar.innerHTML = html`
    ${search ? html`<label class="toolbar__field list-filters__search">Tìm kiếm<input type="search" class="text-field" data-list-q placeholder="Mã phiếu, khách hàng, thiết bị…"></label>` : ''}
    ${Object.keys(statuses).length ? html`<label class="toolbar__field">Trạng thái<select class="select-field" data-list-status><option value="">Tất cả trạng thái</option>${Object.entries(statuses).map(([key,label])=>html`<option value="${key}">${label.label || label}</option>`)}</select></label>` : ''}
    <label class="toolbar__field">Từ ngày<input type="date" class="text-field" data-list-from></label>
    <label class="toolbar__field">Đến ngày<input type="date" class="text-field" data-list-to></label>
    ${assignment ? html`<label class="toolbar__field">Trạm<select class="select-field" data-list-station><option value="">Tất cả trạm</option></select></label><label class="toolbar__field">Kỹ thuật viên<select class="select-field" data-list-technician><option value="">Tất cả kỹ thuật viên</option></select></label>` : ''}
    ${sort ? html`<label class="toolbar__field">Sắp xếp<select class="select-field" data-list-sort><option value="newest">Mới nhất trước</option><option value="oldest">Cũ nhất trước</option>${sla ? html`<option value="sla">Hạn SLA gần nhất</option>` : ''}</select></label>` : ''}
    <button type="button" class="btn btn--secondary" data-list-reset>${search ? 'Xóa bộ lọc' : 'Xóa lọc bổ sung'}</button>
    <span class="form-field__error" data-list-error role="status" hidden></span>`;
  container.before(toolbar);
  const values = () => Object.fromEntries(['q','status','from','to','sort','station','technician'].map(key=>[key,toolbar.querySelector(`[data-list-${key}]`)?.value || '']));
  const changed = () => {
    const v=values(), error=toolbar.querySelector('[data-list-error]');
    error.textContent = v.from && v.to && v.from > v.to ? 'Ngày kết thúc phải từ ngày bắt đầu trở đi.' : '';
    error.hidden = !error.textContent;
    onChange();
  };
  toolbar.addEventListener('input', e => { if(e.target.matches('input')) changed(); });
  toolbar.addEventListener('change', e => { if(e.target.matches('select')) changed(); });
  toolbar.querySelector('[data-list-reset]').addEventListener('click',()=> { toolbar.querySelectorAll('input,select').forEach(n=>n.value=n.matches('[data-list-sort]')?'newest':''); changed(); });
  return { toolbar, values, apply(items) {
    if (assignment) for(const key of ['station','technician']) {
      const select=toolbar.querySelector(`[data-list-${key}]`), previous=select.value;
      const options = new Map(items.map(t=>key==='station'?[t.stationCode,t.stationCode]:[t.assignment?.technicianId,t.technicianName]));
      select.innerHTML=html`<option value="">${key==='station'?'Tất cả trạm':'Tất cả kỹ thuật viên'}</option>${[...options].filter(([id])=>id).map(([id,label])=>html`<option value="${id}">${label || id}</option>`)}`;
      select.value=options.has(previous)?previous:'';
    }
    return filterItems(items,values(),dateKey);
  }};
}

export async function allPages(loader) {
  const first = await loader(0), items = [...first.items];
  for (let page=1; page < (first.totalPages || Math.ceil((first.totalItems || 0) / (first.size || 100))); page++) items.push(...(await loader(page)).items);
  return items;
}
