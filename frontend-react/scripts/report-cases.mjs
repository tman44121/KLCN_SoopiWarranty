// Test case chức năng cho báo cáo (chương 5): ca hợp lệ, ca sai dữ liệu, ca thiếu quyền, gửi thẳng tới API.
// GHI DỮ LIỆU vào database API đang dùng — chạy trên database kiểm thử riêng (cấu hình api-kiemthu trong .claude/launch.json).
// Chạy sau `node scripts/lifecycle.mjs ...` (đọc test-results/lifecycle/state.json). Tài khoản mẫu: docs/04-van-hanh/TAI_KHOAN_DEMO.md.
//   node scripts/report-cases.mjs      → test-results/report-cases.json
import fs from 'node:fs';

const API = 'http://localhost:8080/api/v1';
const state = JSON.parse(fs.readFileSync(new URL('../test-results/lifecycle/state.json', import.meta.url), 'utf8'));
const results = [];

async function call(method, path, { token, body, raw } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get('content-type') || '';
  let data = null;
  if (!raw && /json/.test(type)) data = await res.json().catch(() => null);
  return { status: res.status, type, data };
}
const stamps = [];
async function pace() {  // server allows 10 logins per IP per minute (RateLimiter.CheckLogin)
  const now = Date.now();
  while (stamps.length && now - stamps[0] > 61000) stamps.shift();
  if (stamps.length >= 8) { await new Promise((r) => setTimeout(r, 61000 - (now - stamps[0]) + 500)); stamps.length = 0; }
  stamps.push(Date.now());
}
async function loginCall(u, p) { await pace(); return call('POST', '/auth/login', { body: { username: u, password: p, remember: false } }); }
const login = async (u, p) => (await loginCall(u, p)).data?.accessToken;
const describe = (r) => `HTTP ${r.status}${r.data?.code ? ' – ' + r.data.code : ''}`;

async function tc(id, group, name, input, expected, run) {
  try {
    const { pass, actual } = await run();
    results.push({ id, group, name, input, expected, actual, pass });
    console.log(`${pass ? '✓' : '✗'} ${id} ${name} — ${actual}`);
  } catch (e) {
    results.push({ id, group, name, input, expected, actual: 'Lỗi khi chạy: ' + e.message, pass: false });
    console.log(`✗ ${id} ${name} — ${e.message}`);
  }
}

await new Promise((r) => setTimeout(r, 65000)); // previous run may have used the per-minute login quota
const admin = await login('admin', 'admin123');
const reception = await login('letan', '1234');
const dispatcher = await login('dieuphoi', '1234');
const techChinh = await login('ktv.chinh', '1234');
const techOther = await login('kythuat', '1234');
const warehouse = await login('khovattu', '1234');
const cashier = await login('thungan.nhu', '1234');
const customer = await login('kh.tuan', '1234');

// ---------------------------------------------------------------- Đăng nhập và tài khoản
await tc('DN-01', 'Đăng nhập', 'Đăng nhập đúng tên và mật khẩu', 'admin / admin123', 'Cấp access token, vai trò Quản trị viên', async () => {
  const r = await loginCall('admin', 'admin123');
  return { pass: r.status === 200 && !!r.data?.accessToken && r.data.user.roles.some((x) => (x.code || x) === 'ADMIN'),
    actual: `${describe(r)}, có token, vai trò ${r.data?.user?.roles?.map((x) => x.code || x).join(', ')}` };
});
await tc('DN-02', 'Đăng nhập', 'Đăng nhập sai mật khẩu', 'thungan.nhu / sai-mat-khau', 'Từ chối 401, không cấp token', async () => {
  const r = await loginCall('thungan.nhu', 'sai-mat-khau');
  return { pass: r.status === 401 && !r.data?.accessToken, actual: describe(r) };
});
await tc('DN-03', 'Đăng nhập', 'Bỏ trống mật khẩu', 'admin / (trống)', 'Báo lỗi 400 tại trường mật khẩu', async () => {
  const r = await loginCall('admin', '');
  return { pass: r.status === 400 && r.data?.fieldErrors?.some((f) => f.field === 'password'), actual: `${describe(r)}, trường ${r.data?.fieldErrors?.map((f) => f.field).join(', ')}` };
});
await tc('DN-04', 'Đăng nhập', 'Đăng nhập tài khoản đã bị khóa', 'kythuat_khoa / 1234', 'Từ chối, không cấp token', async () => {
  const r = await loginCall('kythuat_khoa', '1234');
  return { pass: r.status >= 400 && !r.data?.accessToken, actual: describe(r) };
});
await tc('DN-05', 'Đăng nhập', 'Gọi API cần đăng nhập khi chưa có token', 'GET /auth/me không kèm token', 'Từ chối 401', async () => {
  const r = await call('GET', '/auth/me');
  return { pass: r.status === 401, actual: describe(r) };
});
await tc('DN-06', 'Đăng nhập', 'Đổi mật khẩu mới không đạt chính sách', 'thungan.nhu: mật khẩu mới "abc"', 'Từ chối, mật khẩu cũ vẫn dùng được', async () => {
  await pace();
  const r = await call('POST', '/auth/change-password', { token: cashier, body: { currentPassword: '1234', newPassword: 'abc' } });
  const still = await login('thungan.nhu', '1234');
  return { pass: r.status >= 400 && r.status < 500 && !!still, actual: `${describe(r)}; đăng nhập lại bằng mật khẩu cũ ${still ? 'được' : 'không được'}` };
});

// ---------------------------------------------------------------- Phân quyền
await tc('PQ-01', 'Phân quyền', 'Kỹ thuật viên mở danh sách nhân viên', 'ktv.chinh: GET /admin/employees', 'Từ chối 403', async () => {
  const r = await call('GET', '/admin/employees', { token: techChinh });
  return { pass: r.status === 403, actual: describe(r) };
});
await tc('PQ-02', 'Phân quyền', 'Thu ngân xuất báo cáo Excel', 'thungan.nhu: GET /reports/export', 'Từ chối 403', async () => {
  const r = await call('GET', '/reports/export?from=2026-10-01&to=2026-10-31', { token: cashier, raw: true });
  return { pass: r.status === 403, actual: describe(r) };
});
await tc('PQ-03', 'Phân quyền', 'Khách hàng gọi API danh sách phiếu nội bộ', 'kh.tuan: GET /tickets', 'Từ chối 403', async () => {
  const r = await call('GET', '/tickets?page=0&size=25', { token: customer });
  return { pass: r.status === 403, actual: describe(r) };
});
await tc('PQ-04', 'Phân quyền', 'Quản trị viên xuất báo cáo Excel', 'admin: kỳ 01/10–31/10/2026', 'Trả tệp .xlsx', async () => {
  const r = await call('GET', '/reports/export?from=2026-10-01&to=2026-10-31', { token: admin, raw: true });
  return { pass: r.status === 200 && /spreadsheetml/.test(r.type), actual: `HTTP ${r.status}, ${r.type.split(';')[0]}` };
});

// ---------------------------------------------------------------- Tra cứu
await new Promise((r) => setTimeout(r, 62000)); // public lookup allows 5 requests per IP per minute
await tc('TC-01', 'Tra cứu', 'Tra cứu công khai đúng mã phiếu và SĐT', 'TN-2026-0907-00001 + 0912223002', 'Cấp token xem riêng phiếu đó', async () => {
  const r = await call('POST', '/portal/lookup', { body: { code: 'TN-2026-0907-00001', phone: '0912223002' } });
  return { pass: r.status === 200 && !!(r.data?.token || r.data?.accessToken), actual: `${describe(r)}, có token` };
});
await tc('TC-02', 'Tra cứu', 'Tra cứu công khai đúng mã nhưng sai SĐT', 'TN-2026-0907-00001 + 0900000000', 'Không cấp token', async () => {
  const r = await call('POST', '/portal/lookup', { body: { code: 'TN-2026-0907-00001', phone: '0900000000' } });
  return { pass: r.status >= 400 && r.status < 500 && !(r.data?.token || r.data?.accessToken), actual: describe(r) };
});
await tc('TC-03', 'Tra cứu', 'Nhân viên tìm phiếu theo serial', `letan: tìm "${state.serial}"`, 'Kết quả có đúng phiếu', async () => {
  const r = await call('GET', `/search?q=${encodeURIComponent(state.serial)}`, { token: reception });
  const text = JSON.stringify(r.data || '');
  return { pass: r.status === 200 && text.includes(state.ticket), actual: `${describe(r)}, ${text.includes(state.ticket) ? 'có' : 'không có'} ${state.ticket}` };
});

// ---------------------------------------------------------------- Tiếp nhận
const cosmetic = { scratches: 'NONE', dents: false, cracks: false, moisture: 'NONE', accessories: 'COMPLETE', accessoriesNote: null, notes: null, customerAcknowledged: true };
await tc('TN-01', 'Tiếp nhận', 'Lập phiếu cho thiết bị đang có phiếu mở', 'TB-000004 (đang có TN-2026-0914-00001)', 'Từ chối 409, không tạo phiếu thứ hai', async () => {
  const r = await call('POST', '/tickets', { token: reception, body: { customer: { code: 'KH-000004' }, device: { code: 'TB-000004' }, cosmetic, reportedIssue: 'Máy không lên nguồn' } });
  return { pass: r.status === 409, actual: describe(r) };
});
await tc('TN-02', 'Tiếp nhận', 'Lập phiếu bỏ trống mô tả lỗi', 'Khách KH-000002, mô tả lỗi trống', 'Báo lỗi 400 tại trường mô tả lỗi', async () => {
  const r = await call('POST', '/tickets', { token: reception, body: { customer: { code: 'KH-000002' }, device: { code: 'TB-000002' }, cosmetic, reportedIssue: '' } });
  return { pass: r.status === 400, actual: `${describe(r)}, trường ${r.data?.fieldErrors?.map((f) => f.field).join(', ')}` };
});
let newTicket;
const newSerial = 'KT' + String(Date.now()).slice(-10);
await tc('TN-03', 'Tiếp nhận', 'Lập phiếu hợp lệ cho thiết bị mới', `KH-000002, MacBook Air M2 serial ${newSerial}`, 'Tạo phiếu mã TN-…, trạng thái RECEIVED', async () => {
  const r = await call('POST', '/tickets', { token: reception, body: {
    customer: { code: 'KH-000002' }, device: { newDevice: { productId: 'SP-0002', identifierType: 'SERIAL', serialOrImei: newSerial } },
    cosmetic, reportedIssue: 'Màn hình chập chờn khi mở ứng dụng camera' } });
  newTicket = r.data?.code;
  if (r.status === 400) console.log('    fieldErrors', JSON.stringify(r.data?.fieldErrors), r.data?.detail);
  return { pass: (r.status === 201 || r.status === 200) && r.data?.status === 'RECEIVED', actual: `${describe(r)}, ${newTicket}, ${r.data?.status}` };
});

await tc('TN-04', 'Tiếp nhận', 'Khai báo điện thoại bằng serial thay vì IMEI', 'iPhone 14 (định danh IMEI) nhập kiểu SERIAL', 'Báo lỗi 400, không tạo phiếu', async () => {
  const r = await call('POST', '/tickets', { token: reception, body: {
    customer: { code: 'KH-000003' }, device: { newDevice: { productId: 'SP-0001', identifierType: 'SERIAL', serialOrImei: 'SAI' + String(Date.now()).slice(-8) } },
    cosmetic, reportedIssue: 'Không nhận sạc' } });
  return { pass: r.status === 400, actual: describe(r) };
});

// ---------------------------------------------------------------- Phân công và chẩn đoán
await tc('PC-01', 'Phân công', 'Điều phối phân công kỹ thuật viên', `${newTicket} → NV-104`, 'Phiếu chuyển INSPECTING', async () => {
  const r = await call('POST', `/tickets/${newTicket}/assignment`, { token: dispatcher, body: { technicianId: 'NV-104', priority: 'NORMAL' } });
  const t = await call('GET', `/tickets/${newTicket}`, { token: dispatcher });
  return { pass: r.status < 300 && t.data?.status === 'INSPECTING', actual: `${describe(r)}, trạng thái ${t.data?.status}` };
});
await tc('PC-02', 'Phân công', 'Phân công lại cho chính kỹ thuật viên đang giữ phiếu', `${newTicket} → NV-104 lần nữa`, 'Từ chối, giữ nguyên kỹ thuật viên', async () => {
  const r = await call('PUT', `/tickets/${newTicket}/assignment`, { token: dispatcher, body: { technicianId: 'NV-104', note: 'Thử phân công trùng' } });
  const t = await call('GET', `/tickets/${newTicket}`, { token: dispatcher });
  const tech = t.data?.assignment?.technicianId;
  return { pass: r.status >= 400 && r.status < 500 && tech === 'NV-104', actual: `${describe(r)}, kỹ thuật viên vẫn là ${tech}` };
});
await tc('CD-01', 'Chẩn đoán', 'Kỹ thuật viên không được giao ghi chẩn đoán', `kythuat (NV-002) ghi chẩn đoán ${newTicket}`, 'Từ chối, phiếu giữ nguyên INSPECTING', async () => {
  const r = await call('POST', `/tickets/${newTicket}/inspection`, { token: techOther, body: { findings: 'Lỗi cáp màn hình', waterDamage: false, classification: 'OUT_OF_WARRANTY', outOfWarrantyReason: 'Hết hạn bảo hành' } });
  const t = await call('GET', `/tickets/${newTicket}`, { token: dispatcher });
  return { pass: r.status >= 400 && r.status < 500 && t.data?.status === 'INSPECTING', actual: `${describe(r)}, trạng thái ${t.data?.status}` };
});
await tc('CD-02', 'Chẩn đoán', 'Bàn giao phiếu đang kiểm tra', `${newTicket} (INSPECTING)`, 'Từ chối 409, chưa đủ điều kiện bàn giao', async () => {
  const form = new FormData();
  form.append('data', new Blob([JSON.stringify({ receiverName: 'Trần Thu Mai', conditionOnReturn: 'Bình thường', returnedOldParts: false, customerConfirmed: true })], { type: 'application/json' }));
  const res = await fetch(API + `/tickets/${newTicket}/handover`, { method: 'POST', headers: { Authorization: 'Bearer ' + cashier }, body: form });
  const r = { status: res.status, data: await res.json().catch(() => null) };
  return { pass: r.status === 409, actual: describe(r) };
});

// ---------------------------------------------------------------- Báo giá
await tc('BG-01', 'Báo giá', 'Duyệt lại báo giá đã duyệt', state.quotation, 'Từ chối 409', async () => {
  const r = await call('POST', `/quotations/${state.quotation}/approve`, { token: dispatcher, body: { note: null } });
  return { pass: r.status === 409, actual: describe(r) };
});
await tc('BG-02', 'Báo giá', 'Từ chối báo giá không ghi lý do', `${state.quotation}, lý do trống`, 'Báo lỗi 400 tại trường lý do', async () => {
  const r = await call('POST', `/quotations/${state.quotation}/reject`, { token: dispatcher, body: { note: '' } });
  return { pass: r.status === 400, actual: describe(r) };
});
await tc('BG-03', 'Báo giá', 'Khách quyết định lại báo giá đã đồng ý', `${state.quotation}: gửi "Từ chối"`, 'Từ chối 409, giữ quyết định cũ', async () => {
  const r = await call('POST', `/portal/tickets/${state.ticket}/quotation-decision`, { token: customer, body: { decision: 'DECLINE', reason: 'Đổi ý' } });
  return { pass: r.status === 409 || r.status === 422, actual: describe(r) };
});

// ---------------------------------------------------------------- Kho
await tc('KHO-01', 'Kho', 'Duyệt phiếu điều chuyển vượt tồn của kệ', 'LK-BOARD-RT01: 99 cái từ KHO-C-03-02 (tồn 2)', 'Không cho duyệt, tồn không đổi', async () => {
  const p0 = (await call('GET', '/parts/LK-BOARD-RT01', { token: warehouse })).data?.onHand;
  const r = await call('POST', '/stock-transfers', { token: warehouse, body: { sku: 'LK-BOARD-RT01', quantity: 99, fromBin: 'KHO-C-03-02', toBin: 'KHO-A-01-01', reason: 'Kiểm thử vượt tồn' } });
  const a = await call('POST', `/stock-transfers/${r.data?.code}/approve`, { token: warehouse, body: { note: null } });
  const p1 = (await call('GET', '/parts/LK-BOARD-RT01', { token: warehouse })).data?.onHand;
  return { pass: a.status >= 400 && a.status < 500 && p0 === p1, actual: `lập ${describe(r)}; duyệt ${describe(a)}; tồn ${p0} → ${p1}` };
});
await tc('KHO-02', 'Kho', 'Lập phiếu nhập với số lượng 0', 'NCC-001, LK002 × 0', 'Báo lỗi 400 tại số lượng', async () => {
  const r = await call('POST', '/stock-receipts', { token: warehouse, body: { supplierId: 'NCC-001', lines: [{ sku: 'LK002', quantity: 0, unitCost: 100000, binCode: 'KHO-A-02-01' }] } });
  return { pass: r.status === 400, actual: `${describe(r)}, trường ${r.data?.fieldErrors?.map((f) => f.field).join(', ')}` };
});
let receipt, before;
await tc('KHO-03', 'Kho', 'Lập và duyệt phiếu nhập hợp lệ', 'NCC-001, LK002 × 3, đơn giá 100.000 đ', 'Phiếu nhập được duyệt, tồn LK002 tăng 3', async () => {
  before = (await call('GET', '/parts/LK002', { token: warehouse })).data?.onHand;
  const r = await call('POST', '/stock-receipts', { token: warehouse, body: { supplierId: 'NCC-001', note: 'Kiểm thử nhập kho', lines: [{ sku: 'LK002', quantity: 3, unitCost: 100000, binCode: 'KHO-A-02-01' }] } });
  receipt = r.data?.code;
  const a = await call('POST', `/stock-receipts/${receipt}/approve`, { token: warehouse, body: { note: null } });
  const after = (await call('GET', '/parts/LK002', { token: warehouse })).data?.onHand;
  return { pass: a.status < 300 && after === before + 3, actual: `${receipt}: tạo ${describe(r)}, duyệt ${describe(a)}, tồn ${before} → ${after}` };
});

// ---------------------------------------------------------------- Thanh toán, bàn giao, đánh giá
await tc('TT-01', 'Thanh toán', 'Thu tiền lần hai cho phiếu đã thanh toán', state.ticket, 'Từ chối 409', async () => {
  const r = await call('POST', `/tickets/${state.ticket}/payments`, { token: cashier, body: { payerName: 'Nguyễn Minh Tuấn', method: 'CASH' } });
  return { pass: r.status === 409, actual: describe(r) };
});
await tc('TT-02', 'Đánh giá', 'Khách đánh giá điểm ngoài khoảng 1–5', `${state.ticket}: 6 sao`, 'Báo lỗi 400', async () => {
  const r = await call('POST', `/portal/tickets/${state.ticket}/rating`, { token: customer, body: { rating: 6, comment: 'Rất tốt' } });
  return { pass: r.status === 400, actual: describe(r) };
});
await tc('TT-03', 'Đánh giá', 'Khách đánh giá phiếu đã bàn giao', `${state.ticket}: 5 sao`, 'Lưu đánh giá', async () => {
  const r = await call('POST', `/portal/tickets/${state.ticket}/rating`, { token: customer, body: { rating: 5, comment: 'Sửa nhanh, nhân viên tư vấn rõ ràng' } });
  return { pass: r.status < 300, actual: describe(r) };
});
await tc('TB-01', 'Thông báo', 'Khách nhận thông báo tiến độ của phiếu', 'kh.tuan: GET /notifications', 'Có thông báo cho phiếu vừa bàn giao', async () => {
  const r = await call('GET', '/notifications', { token: customer });
  const items = Array.isArray(r.data) ? r.data : (r.data?.items || []);
  const mine = items.filter((n) => JSON.stringify(n).includes(state.ticket));
  return { pass: r.status === 200 && mine.length > 0, actual: `${describe(r)}, ${mine.length} thông báo của ${state.ticket}` };
});

// ---------------------------------------------------------------- Quản trị
await tc('QT-01', 'Quản trị', 'Tạo nhân viên với tên đăng nhập đã tồn tại', 'username "kythuat"', 'Từ chối 409', async () => {
  const r = await call('POST', '/admin/employees', { token: admin, body: { fullName: 'Nhân viên trùng', phone: '0987000111', username: 'kythuat', roles: ['TECHNICIAN'] } });
  return { pass: r.status === 409, actual: describe(r) };
});
let tempUser = 'ktv.kiemthu' + String(Date.now()).slice(-4), tempPass;
await tc('QT-02', 'Quản trị', 'Tạo nhân viên mới', `username "${tempUser}", vai trò Kỹ thuật viên`, 'Tạo tài khoản, cấp mật khẩu tạm', async () => {
  const r = await call('POST', '/admin/employees', { token: admin, body: { fullName: 'Kỹ thuật viên kiểm thử', phone: '09870' + String(Date.now()).slice(-5), username: tempUser, roles: ['TECHNICIAN'] } });
  tempPass = r.data?.temporaryPassword;
  globalThis.tempEmployee = r.data?.employee?.code || r.data?.employee?.employeeId || r.data?.code || r.data?.employeeId;
  if (!globalThis.tempEmployee) console.log('    keys', JSON.stringify(r.data).slice(0, 300));
  return { pass: r.status < 300 && !!tempPass, actual: `${describe(r)}, mã ${globalThis.tempEmployee}, có mật khẩu tạm` };
});
await tc('QT-03', 'Quản trị', 'Khóa nhân viên rồi đăng nhập bằng tài khoản đó', `${tempUser} bị khóa`, 'Đăng nhập bị từ chối', async () => {
  const k = await call('POST', `/admin/employees/${globalThis.tempEmployee}/lock`, { token: admin, body: { reason: 'Kiểm thử khóa tài khoản' } });
  const r = await loginCall(tempUser, tempPass);
  return { pass: k.status < 300 && r.status >= 400 && !r.data?.accessToken, actual: `khóa ${describe(k)}; đăng nhập ${describe(r)}` };
});
await tc('BC-01', 'Báo cáo', 'Xem báo cáo số phiếu theo trạng thái', 'admin: GET /reports/tickets-by-status', 'Trả số liệu có phiếu DELIVERED', async () => {
  const r = await call('GET', '/reports/tickets-by-status', { token: admin });
  return { pass: r.status === 200 && JSON.stringify(r.data).includes('DELIVERED'), actual: `${describe(r)}, ${JSON.stringify(r.data).slice(0, 80)}` };
});
await tc('BC-02', 'Báo cáo', 'Xuất báo cáo với ngày bắt đầu sau ngày kết thúc', 'from 31/10/2026, to 01/10/2026', 'Báo lỗi 400', async () => {
  const r = await call('GET', '/reports/export?from=2026-10-31&to=2026-10-01', { token: admin });
  return { pass: r.status === 400, actual: describe(r) };
});

await tc('DN-07', 'Đăng nhập', 'Đăng nhập liên tiếp quá 10 lần trong một phút', '11 lần đăng nhập sai liên tiếp từ cùng máy', 'Từ lần thứ 11 bị chặn 429', async () => {
  await new Promise((r) => setTimeout(r, 62000));
  const codes = [];
  for (let i = 0; i < 11; i++) codes.push((await call('POST', '/auth/login', { body: { username: 'gioi.han' + i, password: 'sai', remember: false } })).status);
  return { pass: codes.slice(0, 10).every((c) => c === 401) && codes[10] === 429, actual: `10 lần đầu ${[...new Set(codes.slice(0, 10))].join('/')}, lần 11: ${codes[10]}` };
});

fs.writeFileSync(new URL('../test-results/report-cases.json', import.meta.url), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} đạt`);
