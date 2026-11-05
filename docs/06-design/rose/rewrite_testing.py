"""Rewrite report section 5.1 as test-case tables from the 30/10/2026 runs on the test database TrungTamBaoHanhDB_KiemThu.

Usage: python rewrite_testing.py <in.docx> <out.docx> <api_results.json> <figure dir>
Inputs come from real runs: frontend-react/scripts/lifecycle.mjs (UI flow, 96 checks), api_cases.mjs (37 API cases),
dotnet test (102), npm test (19) and flutter test in Warrant_App (128). Run Word afterwards to refresh fields.
"""
import copy, json, os, sys
import docx
from docx.oxml.ns import qn
from PIL import Image

src, out, api_json, FIG = sys.argv[1:5]
doc = docx.Document(src)
body = doc.element.body
W = lambda tag: qn('w:' + tag)
API = {r['id']: r for r in json.load(open(api_json, encoding='utf-8'))}


def text(el):
    return ''.join(t.text or '' for t in el.iter(W('t')))


def style(el):
    s = el.find(W('pPr') + '/' + W('pStyle'))
    return s.get(W('val')) if s is not None else ''


def paras(sid=None):
    return [p for p in body.iter(W('p')) if sid is None or style(p) == sid]


def strip_bookmarks(el):
    for b in list(el.iter(W('bookmarkStart'))) + list(el.iter(W('bookmarkEnd'))):
        b.getparent().remove(b)
    return el


def set_text(p, value):
    runs = p.findall(W('r'))
    rpr = runs[0].find(W('rPr')) if runs else None
    for r in runs:
        p.remove(r)
    r = p.makeelement(W('r'), {})
    if rpr is not None:
        r.append(copy.deepcopy(rpr))
    t = r.makeelement(W('t'), {})
    t.text = value
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    r.append(t)
    p.append(r)
    return p


def first(sid, prefix):
    return next(p for p in paras(sid) if text(p).strip().startswith(prefix))


# ------------------------------------------------------------------ templates
H2 = copy.deepcopy(first('Heading2', '5.1.'))
H3 = copy.deepcopy(first('Heading3', '5.1.1.'))
BODY = copy.deepcopy(next(p for p in paras('BCNoidung') if text(p).startswith('Mục tiêu là kiểm chứng luồng')))
CAP_TBL = copy.deepcopy(first('BCTenbang', 'Bảng 5.2'))
CAP_FIG = copy.deepcopy(first('BCTenhinh', 'Hình 5.2'))
# the first caption of the chapter carries the SEQ reset switch; later ones continue the count
CAP_TBL_FIRST = copy.deepcopy(first('BCTenbang', 'Bảng 5.1'))
CAP_FIG_FIRST = copy.deepcopy(first('BCTenhinh', 'Hình 5.1'))
fig_cap = first('BCTenhinh', 'Hình 5.2')
FIG_P = fig_cap.getprevious()
while FIG_P.find('.//' + qn('a:blip')) is None:
    FIG_P = FIG_P.getprevious()
FIG_P = copy.deepcopy(FIG_P)
SPEC = copy.deepcopy(next(t for t in body.iter(W('tbl')) if text(t).startswith('Tên Use Case')))
CELL_P = copy.deepcopy(SPEC.find(W('tr') + '/' + W('tc') + '/' + W('p')))


def para(value, tpl=BODY):
    return set_text(strip_bookmarks(copy.deepcopy(tpl)), value)


def caption(tpl, value):
    c = strip_bookmarks(copy.deepcopy(tpl))
    last = [r for r in c.findall(W('r')) if r.find(W('t')) is not None][-1]
    last.find(W('t')).text = ': ' + value
    return c


def cell(value, width, bold=False, center=False, size=22):
    tc = SPEC.makeelement(W('tc'), {})
    tcpr = tc.makeelement(W('tcPr'), {})
    tcpr.append(tcpr.makeelement(W('tcW'), {W('w'): str(width), W('type'): 'dxa'}))
    tcpr.append(tcpr.makeelement(W('vAlign'), {W('val'): 'center'}))
    tc.append(tcpr)
    for line in str(value).split('\n'):
        p = set_text(strip_bookmarks(copy.deepcopy(CELL_P)), line)
        rpr = p.find(W('r') + '/' + W('rPr'))
        b = rpr.find(W('b'))
        if not bold and b is not None:
            rpr.remove(b)
        sz = rpr.find(W('sz'))
        if sz is not None:
            sz.set(W('val'), str(size))
        if center:
            p.find(W('pPr') + '/' + W('jc')).set(W('val'), 'center')
        tc.append(p)
    return tc


def table(header, rows, widths, center_cols=(), size=22):
    t = copy.deepcopy(SPEC)
    for tr in t.findall(W('tr')):
        t.remove(tr)
    grid = t.find(W('tblGrid'))
    for g in list(grid):
        grid.remove(g)
    for w in widths:
        grid.append(grid.makeelement(W('gridCol'), {W('w'): str(w)}))
    tblpr = t.find(W('tblPr'))
    tblpr.find(W('tblW')).set(W('w'), str(sum(widths)))
    if tblpr.find(W('tblLayout')) is None:  # keep the given column widths instead of Word autofit
        lay = tblpr.makeelement(W('tblLayout'), {W('type'): 'fixed'})
        before = next((tblpr.find(W(x)) for x in ('tblCellMar', 'tblLook') if tblpr.find(W(x)) is not None), None)
        before.addprevious(lay) if before is not None else tblpr.append(lay)
    for ri, row in enumerate([header] + rows):
        tr = t.makeelement(W('tr'), {})
        if ri == 0:
            trpr = tr.makeelement(W('trPr'), {})
            trpr.append(trpr.makeelement(W('tblHeader'), {}))
            tr.append(trpr)
        for ci, (v, w) in enumerate(zip(row, widths)):
            tr.append(cell(v, w, bold=(ri == 0), center=(ri == 0 or ci in center_cols), size=size))
        t.append(tr)
    return t


_figs = []


def figure(png, title, max_w_cm=15.0, max_h_cm=17.0):
    f = strip_bookmarks(copy.deepcopy(FIG_P))
    rid, _ = doc.part.get_or_add_image(png)
    f.find('.//' + qn('a:blip')).set(qn('r:embed'), rid)
    w, h = Image.open(png).size
    emu = 360000
    scale = min(max_w_cm * emu / w, max_h_cm * emu / h)
    for e in (f.find('.//' + qn('wp:extent')), f.find('.//' + qn('a:ext'))):
        e.set('cx', str(int(w * scale)))
        e.set('cy', str(int(h * scale)))
    _figs.append(png)
    return [f, caption(CAP_FIG_FIRST if len(_figs) == 1 else CAP_FIG, title)]


def h2(value):
    return para(value, H2)


def h3(value):
    return para(value, H3)


# ------------------------------------------------------------------ content
TC_HEAD = ['Mã', 'Test case', 'Dữ liệu vào', 'Kết quả mong đợi', 'Kết quả thực tế', 'Đánh giá']
TC_W = [800, 1750, 1650, 1700, 1905, 700]

ACTUAL = {  # plain-language wording of api_results.json; the HTTP code is what the API returned
    'DN-01': 'Đăng nhập thành công, cấp access token, vai trò Quản trị viên (HTTP 200)',
    'DN-02': 'Bị từ chối, báo sai thông tin đăng nhập (HTTP 401)',
    'DN-03': 'Báo lỗi tại trường mật khẩu (HTTP 400)',
    'DN-04': 'Bị từ chối, báo tài khoản đang bị khóa (HTTP 403)',
    'DN-05': 'Bị từ chối, yêu cầu đăng nhập (HTTP 401)',
    'DN-06': 'Báo mật khẩu không đạt chính sách (HTTP 422); mật khẩu cũ vẫn đăng nhập được',
    'DN-07': '10 lần đầu báo sai thông tin (HTTP 401), lần thứ 11 bị chặn (HTTP 429)',
    'PQ-01': 'Bị từ chối do thiếu quyền (HTTP 403)',
    'PQ-02': 'Bị từ chối do thiếu quyền (HTTP 403)',
    'PQ-03': 'Bị từ chối do thiếu quyền (HTTP 403)',
    'PQ-04': 'Tải về tệp báo cáo .xlsx (HTTP 200)',
    'TC-01': 'Cấp quyền xem riêng phiếu TN-2026-0907-00001 (HTTP 200)',
    'TC-02': 'Báo không tìm thấy, không cấp quyền xem (HTTP 404)',
    'TC-03': 'Kết quả tìm kiếm có phiếu TN-2026-1030-00001',
    'TN-01': 'Bị từ chối: thiết bị đang có phiếu mở (HTTP 409)',
    'TN-02': 'Báo lỗi tại trường mô tả lỗi (HTTP 400)',
    'TN-03': None,  # filled from the run (ticket code)
    'TN-04': 'Bị từ chối, không tạo phiếu (HTTP 400)',
    'PC-01': 'Phiếu chuyển sang Đang kiểm tra, giao cho NV-104',
    'PC-02': 'Bị từ chối (HTTP 400); kỹ thuật viên vẫn là NV-104',
    'CD-01': 'Bị từ chối: không phải kỹ thuật viên được giao (HTTP 403); phiếu giữ nguyên trạng thái',
    'CD-02': 'Bị từ chối: phiếu chưa đủ điều kiện bàn giao (HTTP 409)',
    'BG-01': 'Bị từ chối: báo giá đã được xem xét (HTTP 409)',
    'BG-02': 'Báo lỗi tại trường lý do (HTTP 400)',
    'BG-03': 'Bị từ chối: báo giá đã có quyết định của khách (HTTP 409)',
    'KHO-01': 'Phiếu điều chuyển được lập nhưng không duyệt được do kệ không đủ tồn (HTTP 409); tồn giữ nguyên 2',
    'KHO-02': 'Báo lỗi tại số lượng của dòng nhập (HTTP 400)',
    'KHO-03': None,
    'TT-01': 'Bị từ chối: phiếu không còn ở trạng thái chờ thu tiền (HTTP 409)',
    'TT-02': 'Báo lỗi điểm đánh giá (HTTP 400)',
    'TT-03': 'Lưu đánh giá 5 sao (HTTP 200)',
    'TB-01': None,
    'QT-01': 'Bị từ chối: tên đăng nhập đã tồn tại (HTTP 409)',
    'QT-02': None,
    'QT-03': 'Khóa thành công; đăng nhập bị từ chối do tài khoản bị khóa (HTTP 403)',
    'BC-01': 'Trả số phiếu theo từng trạng thái, có nhóm Đã bàn giao (HTTP 200)',
    'BC-02': 'Báo lỗi khoảng ngày (HTTP 400)',
}
a = API
ACTUAL['TN-03'] = 'Tạo phiếu %s, trạng thái Đã tiếp nhận (HTTP 201)' % a['TN-03']['actual'].split(' – ')[1].split(',')[0]
ACTUAL['KHO-03'] = 'Phiếu %s được duyệt; tồn LK002 %s' % (a['KHO-03']['actual'].split(':')[0],
                                                           a['KHO-03']['actual'].split('tồn ')[1].replace('→', 'tăng lên'))
ACTUAL['TB-01'] = 'Hộp thư có %s thông báo của phiếu TN-2026-1030-00001' % a['TB-01']['actual'].split(', ')[1].split(' ')[0]
ACTUAL['QT-02'] = 'Tạo nhân viên %s, cấp mật khẩu tạm (HTTP 201)' % a['QT-02']['actual'].split('mã ')[1].split(',')[0]
assert all(r['pass'] for r in a.values()), 'chỉ ghi vào báo cáo khi mọi ca đã chạy đạt'


def api_rows(ids):
    return [[i, a[i]['name'], a[i]['input'], a[i]['expected'], ACTUAL[i], 'Đạt'] for i in ids]


LC = [
    ['LC-01', 'Khách gửi yêu cầu bảo hành trực tuyến (điện thoại 390px)',
     'Đăng nhập kh.tuan → Gửi yêu cầu: Laptop Dell Inspiron 15, serial, mô tả lỗi, trạm, thời gian → Gửi',
     'Sinh mã YC, trạng thái Chờ tiếp nhận, hiện trong lịch sử của khách',
     'Tạo YC-2026-1030-00001, trạng thái Chờ tiếp nhận, có trong lịch sử (6/6 kiểm tra)'],
    ['LC-02', 'Lễ tân tiếp nhận thiết bị từ yêu cầu trực tuyến',
     'Chọn yêu cầu trong hàng chờ → kiểm tra thông tin tự điền, ngoại quan → Tiếp nhận',
     'Phiếu TN trạng thái Đã tiếp nhận, kênh trực tuyến, gắn mã YC; yêu cầu chuyển Đã tiếp nhận',
     'Tạo TN-2026-1030-00001 đúng khách, sản phẩm, serial; yêu cầu chuyển CONVERTED (14/14)'],
    ['LC-03', 'Điều phối phân công kỹ thuật viên',
     'Mở phiếu → chọn kỹ thuật viên Phạm Minh Chinh trong danh sách đề xuất → Phân công',
     'Phiếu giao cho NV-104, chuyển Đang kiểm tra', 'Phiếu giao NV-104, trạng thái INSPECTING (8/8)'],
    ['LC-04', 'Kỹ thuật viên chẩn đoán và lập báo giá (máy tính bảng 820px)',
     'Nhập kết quả: ngoài bảo hành, vào nước → lập báo giá bàn phím LK004 × 1, tiền công → Gửi duyệt',
     'Phiếu chờ duyệt báo giá; tổng = (600.000 + 250.000) × 1,08',
     'BG-2026-1030-00001, tổng 918.000 đ, giao diện khớp CSDL (9/9)'],
    ['LC-05', 'Điều phối duyệt báo giá', 'Mở hàng chờ duyệt → xem chi tiết → Phê duyệt',
     'Báo giá Đã phê duyệt, phiếu chờ khách xác nhận', 'APPROVED; phiếu AWAITING_CUSTOMER_CONFIRMATION (7/7)'],
    ['LC-06', 'Khách xác nhận báo giá (điện thoại)', 'Mở phiếu → Kiểm tra & Xác nhận giá → tích cam kết → Xác nhận duyệt giá',
     'Không còn báo giá chờ khách, phiếu chuyển Chờ linh kiện', 'Phiếu AWAITING_PARTS, chi phí khách thấy 918.000 đ (9/9)'],
    ['LC-07', 'Kỹ thuật viên yêu cầu xuất linh kiện', 'Mở phiếu → Yêu cầu linh kiện theo báo giá',
     'Phiếu xuất Chờ duyệt theo báo giá, giữ chỗ tồn tăng 1', 'PX-2026-00003, dòng LK004 × 1, giữ chỗ 1 → 2 (9/9)'],
    ['LC-08', 'Thủ kho duyệt phiếu xuất', 'Mở danh sách xuất kho → xem phiếu → Duyệt và xuất',
     'Phiếu Đã xuất kho, tồn thực tế giảm 1', 'ISSUED, tồn 6 → 5, giữ chỗ trả về như trước (8/8)'],
    ['LC-09', 'Kỹ thuật viên sửa chữa và kiểm định QC', 'Bắt đầu sửa → nhập công việc, 6 bước QC đạt → Hoàn tất',
     'Phiếu Đang sửa rồi Đã hoàn thành, QC đạt đủ 6 bước', 'REPAIRING → COMPLETED, QC PASS (6/6)'],
    ['LC-10', 'Thu ngân thu tiền và bàn giao', 'Chọn phiếu → thu 918.000 đ → kiểm tra lại máy, khách ký → Bàn giao',
     'Đã thanh toán, phiếu Đã bàn giao, có biên bản bàn giao', 'PAID, DELIVERED, biên bản PBG-2026-00004 (7/7)'],
    ['LC-11', 'Xem lại lịch sử sau bàn giao (kỹ thuật viên, khách)', 'Mở Lịch sử phiếu của kỹ thuật viên và lịch sử của khách',
     'Chi tiết có báo giá, phiếu xuất, QC; khách thấy Đã bàn giao', 'Hiển thị đủ; khách thấy DELIVERED (13/13)'],
]
for r in LC:
    r.append('Đạt')

new = [
    h2('5.1. KIỂM THỬ DỰ ÁN'),
    para('Mục này trình bày kế hoạch và kết quả kiểm thử hệ thống. Các test case được chạy ngày 30/10/2026 trên một cơ sở dữ '
         'liệu kiểm thử riêng, tạo mới từ script của dự án, để không ảnh hưởng dữ liệu phát triển. Kết quả thực tế ghi trong '
         'các bảng là kết quả hệ thống trả về ở lần chạy đó.'),
    h3('5.1.1. Kế hoạch kiểm thử'),
    para('Kiểm thử theo phương pháp hộp đen, xuất phát từ các use case ở chương 2 và chương 3. Có bốn nhóm: (1) chạy trọn luồng '
         'nghiệp vụ qua giao diện theo từng vai trò; (2) kiểm thử từng chức năng với dữ liệu hợp lệ, dữ liệu sai và người dùng '
         'không đủ quyền; (3) kiểm thử đơn vị của backend và frontend; (4) kiểm thử ứng dụng di động. Một test case được đánh '
         'giá Đạt khi kết quả thực tế trùng kết quả mong đợi và dữ liệu lưu trong cơ sở dữ liệu đúng như mô tả.'),
    caption(CAP_TBL_FIRST, 'Môi trường kiểm thử'),
    table(['Thành phần', 'Mô tả'], [
        ['Máy kiểm thử', 'Windows 11, chạy toàn bộ hệ thống tại máy cục bộ'],
        ['Backend', 'ASP.NET Core .NET 10, API tại http://localhost:8080'],
        ['Frontend', 'React 19, Vite tại http://localhost:5173'],
        ['Cơ sở dữ liệu', 'SQL Server cục bộ, database TrungTamBaoHanhDB_KiemThu tạo mới bằng script 01_schema.sql, '
                          '02_reference_data.sql, 03_demo_data.sql (49 bảng)'],
        ['Trình duyệt', 'Microsoft Edge điều khiển bằng Playwright; khách hàng dùng khung điện thoại 390px, kỹ thuật viên '
                        'máy tính bảng 820px, các vai trò khác màn hình 1440px'],
        ['Ứng dụng di động', 'Flutter, chạy bộ unit test và widget test của kho mã nguồn Warrant_App'],
        ['Tài khoản kiểm thử', 'Tài khoản mẫu của dự án theo từng vai trò: quản trị, lễ tân, điều phối, kỹ thuật viên, thủ '
                               'kho, thu ngân, khách hàng; một tài khoản kỹ thuật viên bị khóa sẵn'],
    ], [2300, 6205], size=24),
    h3('5.1.2. Kiểm thử luồng nghiệp vụ chính qua giao diện'),
    para('Một thiết bị đi trọn vòng đời từ khi khách gửi yêu cầu đến khi bàn giao. Mỗi bước được thao tác trên giao diện bằng '
         'tài khoản của vai trò tương ứng, sau đó đối chiếu dữ liệu qua API và kiểm tra giao diện không bị cuộn ngang, không '
         'có lỗi JavaScript. Toàn luồng có 96 điểm kiểm tra, tất cả đạt.'),
    caption(CAP_TBL, 'Test case luồng nghiệp vụ chính'),
    table(TC_HEAD[:1] + ['Chức năng', 'Các bước thực hiện', 'Kết quả mong đợi', 'Kết quả thực tế', 'Đánh giá'], LC, TC_W,
          center_cols=(0, 5)),
    para('Một số màn hình trong quá trình chạy luồng nghiệp vụ được trình bày dưới đây.'),
    *figure(os.path.join(FIG, '01-khach-dien-yeu-cau.png'), 'Khách hàng gửi yêu cầu bảo hành trên điện thoại', 6.5, 17),
    *figure(os.path.join(FIG, '12-le-tan-phieu-tu-dien.png'), 'Lễ tân lập phiếu tiếp nhận từ yêu cầu trực tuyến'),
    *figure(os.path.join(FIG, '34-ky-thuat-lap-bao-gia.png'), 'Kỹ thuật viên chẩn đoán và lập báo giá trên máy tính bảng', 11, 17),
    *figure(os.path.join(FIG, '52-khach-xac-nhan-chi-phi.png'), 'Khách hàng xác nhận chi phí sửa chữa', 6.5, 17),
    *figure(os.path.join(FIG, '73-kho-da-duyet.png'), 'Thủ kho duyệt phiếu xuất linh kiện'),
    *figure(os.path.join(FIG, '92-thu-ngan-da-thu-tien.png'), 'Thu ngân ghi nhận thanh toán trước khi bàn giao'),
    h3('5.1.3. Kiểm thử chức năng theo nhóm'),
    para('Mỗi nhóm chức năng gồm ca dữ liệu hợp lệ, ca dữ liệu sai và ca người dùng không đủ quyền. Các ca được gửi trực tiếp '
         'tới API, cùng đường mà giao diện Web và ứng dụng di động sử dụng, để kiểm tra quy tắc nghiệp vụ được chặn ở máy chủ '
         'chứ không chỉ ở giao diện.'),
    caption(CAP_TBL, 'Test case đăng nhập và phân quyền'),
    table(TC_HEAD, api_rows(['DN-01', 'DN-02', 'DN-03', 'DN-04', 'DN-05', 'DN-06', 'DN-07', 'PQ-01', 'PQ-02', 'PQ-03', 'PQ-04']),
          TC_W, center_cols=(0, 5)),
    caption(CAP_TBL, 'Test case tra cứu và tiếp nhận thiết bị'),
    table(TC_HEAD, api_rows(['TC-01', 'TC-02', 'TC-03', 'TN-01', 'TN-02', 'TN-03', 'TN-04']), TC_W, center_cols=(0, 5)),
    caption(CAP_TBL, 'Test case phân công, chẩn đoán và báo giá'),
    table(TC_HEAD, api_rows(['PC-01', 'PC-02', 'CD-01', 'CD-02', 'BG-01', 'BG-02', 'BG-03']), TC_W, center_cols=(0, 5)),
    caption(CAP_TBL, 'Test case kho, thanh toán, đánh giá và thông báo'),
    table(TC_HEAD, api_rows(['KHO-01', 'KHO-02', 'KHO-03', 'TT-01', 'TT-02', 'TT-03', 'TB-01']), TC_W, center_cols=(0, 5)),
    caption(CAP_TBL, 'Test case quản trị và báo cáo'),
    table(TC_HEAD, api_rows(['QT-01', 'QT-02', 'QT-03', 'BC-01', 'BC-02']), TC_W, center_cols=(0, 5)),
    h3('5.1.4. Kiểm thử đơn vị và ứng dụng di động'),
    para('Ngoài kiểm thử hộp đen, mã nguồn có các bộ kiểm thử tự động. Backend kiểm tra quy tắc nghiệp vụ của phiếu, báo giá, '
         'kho, xác thực, thông báo và báo cáo Excel; frontend kiểm tra lớp gọi API và độ tương phản màu; ứng dụng di động kiểm '
         'tra hợp đồng API, luồng màn hình và khả năng hiển thị trên màn hình hẹp.'),
    caption(CAP_TBL, 'Kết quả các bộ kiểm thử tự động'),
    table(['Bộ kiểm thử', 'Công cụ', 'Số ca', 'Đạt'], [
        ['Backend (quy tắc nghiệp vụ, xác thực, phân quyền, báo cáo)', 'xUnit, dotnet test', '102', '102'],
        ['Frontend (gọi API, độ tương phản giao diện)', 'node:test', '19', '19'],
        ['Ứng dụng di động (unit test và widget test)', 'flutter test', '128', '128'],
    ], [4300, 2005, 1100, 1100], center_cols=(2, 3), size=24),
    caption(CAP_TBL, 'Kiểm thử ứng dụng di động theo nhóm chức năng'),
    table(['Nhóm chức năng', 'Nội dung kiểm tra', 'Số ca', 'Đạt'], [
        ['Đăng nhập, đăng ký, OTP email', 'Đăng ký và đặt lại mật khẩu bằng OTP gửi qua email, kiểm tra dữ liệu nhập, lưu '
                                          'và khôi phục phiên', '17', '17'],
        ['Làm mới phiên', 'Token hết hạn chỉ làm mới một lần, gọi lại đúng một lần, đăng xuất không dùng lại token', '13', '13'],
        ['Gửi yêu cầu bảo hành', 'Kiểu định danh theo loại thiết bị, giới hạn tệp đính kèm, gửi multipart một lần', '16', '16'],
        ['Tra cứu và quyết định báo giá', 'Chỉ đọc đúng phiếu được cấp quyền, xử lý lỗi 404/429, gửi quyết định một lần; '
                                          'màn hình 320–375px với cỡ chữ 1,0–2,0', '29', '29'],
        ['Theo dõi tiến độ', 'Trạng thái, các bước, chi phí và báo giá chờ khách; lịch sử nhiều phiếu', '13', '13'],
        ['Thông báo trong ứng dụng', 'Số chưa đọc, mở đúng phiếu liên quan, đánh dấu đã đọc', '8', '8'],
        ['Đọc dữ liệu và chế độ Mock', 'Đọc phản hồi API thật; luồng mẫu đồng ý/từ chối báo giá', '11', '11'],
        ['Khả năng tiếp cận', 'Độ tương phản chữ, cỡ chữ lớn, không tràn màn hình', '21', '21'],
    ], [2400, 4305, 900, 900], center_cols=(2, 3)),
    h3('5.1.5. Tổng hợp kết quả'),
    caption(CAP_TBL, 'Tổng hợp kết quả kiểm thử'),
    table(['Nhóm kiểm thử', 'Số test case', 'Đạt', 'Không đạt'], [
        ['Luồng nghiệp vụ qua giao diện', '11 (96 điểm kiểm tra)', '11', '0'],
        ['Chức năng theo nhóm (hợp lệ, sai dữ liệu, phân quyền)', str(len(a)), str(sum(r['pass'] for r in a.values())), '0'],
        ['Kiểm thử đơn vị backend', '102', '102', '0'],
        ['Kiểm thử đơn vị frontend', '19', '19', '0'],
        ['Ứng dụng di động', '128', '128', '0'],
    ], [4100, 2000, 1200, 1205], center_cols=(1, 2, 3), size=24),
    para('Hệ thống chặn đúng các thao tác sai quy trình như lập phiếu thứ hai cho thiết bị đang mở, duyệt lại báo giá, thu tiền '
         'hai lần, xuất vượt tồn kho, và chặn người dùng không đủ quyền ngay tại API. Cơ chế giới hạn tần suất cũng hoạt động: '
         'đăng nhập quá 10 lần mỗi phút từ cùng một máy, hoặc tra cứu một mã phiếu quá 10 lần mỗi giờ, đều bị từ chối.'),
    para('Phạm vi chưa kiểm thử gồm: tải đồng thời nhiều người dùng, gửi OTP qua email thật và thông báo đẩy thật trên môi '
         'trường production, thanh toán ngân hàng thật (giao diện thanh toán trực tuyến chỉ là mô phỏng), và chạy ứng dụng '
         'di động trên điện thoại Android thật.'),
]

# replace everything from the 5.1 heading up to the 5.2 heading
start = first('Heading2', '5.1.')
stop = first('Heading2', '5.2.')
kids = list(body.iterchildren())
for el in kids[kids.index(start):kids.index(stop)]:
    body.remove(el)
for el in new:
    stop.addprevious(el)

# other places that quoted the old numbers
FIX = [
    ('87/87 unit test và widget test ngày 30/10/2026', '128/128 unit test và widget test ngày 30/10/2026'),
    ('- Ngày 02/10/2026: phiếu TN-2026-1002-00001 đi đủ 8 bước từ tiếp nhận đến bàn giao qua giao diện trên database thật; '
     'lỗi ghi sai cột khi tạo báo giá được phát hiện và sửa.',
     '- Luồng nghiệp vụ chính chạy trọn 11 bước qua giao diện, từ khách gửi yêu cầu đến bàn giao, với 96 điểm kiểm tra đều đạt; '
     '37 test case chức năng gồm ca hợp lệ, ca sai dữ liệu và ca thiếu quyền đều đạt.'),
    ('- Ngày 30/10/2026: backend đạt 101/102 test (ca còn lại đối chiếu với bản Java, đã loại khỏi phạm vi), frontend đạt '
     '19/19; 26 màn hình theo vai trò mở được, không lỗi JavaScript.',
     '- Kiểm thử tự động: backend đạt 102/102, frontend đạt 19/19, ứng dụng di động đạt 128/128.'),
    ('bộ ảnh luồng nghiệp vụ docs/screenshots (02/10/2026) và kết quả kiểm thử ngày 30/10/2026',
     'kết quả kiểm thử ngày 30/10/2026'),
]
done = 0
for p in body.iter(W('p')):
    ts = list(p.iter(W('t')))
    s = ''.join(t.text or '' for t in ts)
    n = s
    for old, repl in FIX:
        if old in n:
            n = n.replace(old, repl)
            done += 1
    if n != s:
        ts[0].text = n
        ts[0].set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        for t in ts[1:]:
            t.text = ''

for k, dp in enumerate(body.iter(qn('wp:docPr')), 1):
    dp.set('id', str(k))
doc.save(out)
print('saved', out, 'api cases', len(a), 'replacements', done)
