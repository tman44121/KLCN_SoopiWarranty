"""Bổ sung báo cáo KLCN ngày 08/11/2026: cấu hình thời gian và bảo vệ, sửa giá danh mục, trễ hạn SLA,
sơ đồ Rose kiểm kê, CSDL 56 bảng, CSP font, tự dọn release, số liệu kiểm thử. Không sửa chương 2 (nghiệp vụ thực tế).

python update_report_1108.py <vào.docx> <ra.docx> <thư mục Rose bổ sung> <thư mục ảnh giao diện>
"""
import copy, os, re, sys
import docx
from docx.oxml.ns import qn
sys.path.insert(0, os.environ.get('DOCLIB_DIR', os.path.dirname(os.path.abspath(__file__))))
import doclib as dl

src, dst, rose, ui = sys.argv[1:5]
doc = docx.Document(src)
body = doc.element.body


def paras():
    return doc.paragraphs


def P(prefix, style=None):
    """Paragraph whose text starts with prefix (unique); entries of the table of contents / lists of figures are ignored."""
    hits = [p for p in paras() if p.text.strip().startswith(prefix) and (style is None or p.style.name == style)
            and not p.style.name.lower().startswith(('toc', 'table of figures'))]
    assert len(hits) == 1, (prefix, len(hits))
    return hits[0]


def after(anchor, *els):
    for el in els:
        anchor.addnext(el)
        anchor = el
    return anchor


def next_tbl(p_el):
    el = p_el.getnext()
    while el is not None and el.tag != qn('w:tbl'):
        el = el.getnext()
    return el


def replace_in(p, old, new):
    t = p.text
    assert old in t, (old, t[:120])
    dl.settext(p._p, t.replace(old, new))


def cell_lines(tc, lines, bold=False):
    """Fill a cell with one paragraph per line, cloned from the cell's first paragraph."""
    dl.cell_text(tc, lines[0], bold)
    first = tc.findall(qn('w:p'))[0]
    anchor = first
    for line in lines[1:]:
        anchor = after(anchor, dl.clone_para(first, line))


def set_caption(p, prefix, num, title):
    """Caption layout here: text runs before the SEQ field, the field (cached number), then ': title' runs."""
    for pe in p.findall(qn('w:proofErr')):
        p.remove(pe)
    runs = p.findall(qn('w:r'))
    state, before, cached, tail = 'before', [], [], []
    for r in runs:
        fc = r.find(qn('w:fldChar'))
        if fc is not None:
            kind = fc.get(qn('w:fldCharType'))
            state = {'begin': 'instr', 'separate': 'result', 'end': 'after'}[kind]
            continue
        if r.find(qn('w:t')) is None:
            continue
        {'before': before, 'result': cached, 'after': tail, 'instr': []}[state].append(r)
    assert before and cached and tail, (len(before), len(cached), len(tail))
    before[0].find(qn('w:t')).text = prefix
    for r in before[1:]:
        p.remove(r)
    cached[0].find(qn('w:t')).text = str(num)
    for r in cached[1:]:
        p.remove(r)
    t = tail[0].find(qn('w:t'))
    t.text = ': ' + title
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    for r in tail[1:]:
        p.remove(r)


def clone_caption(template, prefix, num, title):
    c = copy.deepcopy(template)
    dl.strip_bookmarks(c)
    set_caption(c, prefix, num, title)
    instr = c.find('.//' + qn('w:instrText'))
    instr.text = re.sub(r'\\r \d+', '', instr.text)
    return c


_orig_cell_text = dl.cell_text


def cell_text(tc, text, bold=False):
    _orig_cell_text(tc, text, bold)


def txt(el):
    return ''.join(t.text or '' for t in el.iter(qn('w:t')))


dl.cell_text = cell_text
dl.set_caption = set_caption
dl.clone_caption = clone_caption

# ---------------------------------------------------------------- templates
T_H3 = P('3.3.12. Use case xem báo cáo thống kê', 'Heading 3')._p
T_H4 = P('3.3.12.1. Đặc tả use case', 'Heading 4')._p
T_BODY = P('Thủ kho có quyền STOCKTAKE_MANAGE lập phiếu kiểm kê')._p
cap_fig3 = P('Hình 3.23: Sơ đồ tuần tự use case quản lý danh mục')._p
fig3 = cap_fig3.getprevious()
cap_tab3 = P('Bảng 3.15: Bảng đặc tả use case quản lý tài khoản & phân quyền')._p
spec_tbl = next_tbl(cap_tab3)
cap_fig4 = P('Hình 4.18: Giao diện quản lý danh mục hệ thống')._p
fig4 = cap_fig4.getprevious()
T_DASH = P('- Nhóm & loại thiết bị kèm loại định danh')._p


def h(template, text):
    return dl.clone_para(template, text)


def body_p(text):
    return dl.clone_para(T_BODY, text)


def figure(png, prefix, title, template_fig, template_cap, max_h=20.0):
    f = dl.new_figure(doc, template_fig, png, 15.0, max_h)
    c = dl.clone_caption(template_cap, prefix, 0, title)
    return f, c


def spec_table(caption, rows):
    cap = dl.clone_caption(cap_tab3, 'Bảng 3.', 0, caption)
    tbl = copy.deepcopy(spec_tbl)
    trs = tbl.findall(qn('w:tr'))
    assert len(trs) == len(rows) == 8
    for tr, lines in zip(trs, rows):
        tc = tr.findall(qn('w:tc'))[1]
        cell_lines(tc, lines if isinstance(lines, list) else [lines])
    return cap, tbl


# ---------------------------------------------------------------- 3.1.1
after(P('Quản lý bàn giao thiết bị sau bảo hành hoặc sửa chữa')._p,
      dl.clone_para(P('Quản lý bàn giao thiết bị sau bảo hành hoặc sửa chữa')._p,
                    'Cấu hình hệ thống: quản trị viên chỉnh số giờ SLA theo từng mức, ngưỡng cảnh báo sắp trễ, hạn khách xác nhận '
                    'báo giá, giờ làm việc và các mức bảo vệ (khóa đăng nhập, OTP, giới hạn tần suất, hạn phiên); sửa giá tính khách '
                    'của linh kiện và giá dịch vụ ngay trên bảng danh mục.'))

# ---------------------------------------------------------------- 3.3.12 trễ hạn SLA
rep_tbl = next_tbl(P('Bảng 3.12: Bảng đặc tả use case xem báo cáo thống kê')._p)
after(rep_tbl, body_p(
    'Báo cáo hiệu suất kỹ thuật viên có thêm số phiếu trễ hạn SLA, gồm hai phần. Phiếu đã xong nhưng trễ là lệnh sửa hoàn tất '
    'có thời điểm đạt kiểm tra chất lượng sau HanSLA. Phiếu đang trễ là lệnh sửa chưa xong của phiếu còn mở đã quá HanSLA tại lúc '
    'xem báo cáo. Hai số này lọc theo ngày tiếp nhận như các cột khác và có trong tệp Excel; trang tổng quan có thêm ô Đang trễ '
    'hạn SLA.'))

# ---------------------------------------------------------------- 3.3.14.4 kiểm kê: thêm sơ đồ Rose
kk_last = P('Ngoại lệ: phiếu rỗng, số âm, mã kệ sai')._p
f1, c1 = figure(os.path.join(rose, 'AD_UC_KiemKe.png'), 'Hình 3.', 'Sơ đồ hoạt động use case kiểm kê kho', fig3, cap_fig3)
f2, c2 = figure(os.path.join(rose, 'SD_UC_KiemKe.png'), 'Hình 3.', 'Sơ đồ tuần tự use case kiểm kê kho', fig3, cap_fig3)
after(kk_last, f1, c1, f2, c2)

# ---------------------------------------------------------------- 3.3.22, 3.3.23
CFG = [
    'Cấu hình thời gian và bảo vệ hệ thống',
    'Quản trị viên.',
    'Thay đổi các mốc thời gian và mức bảo vệ dùng chung cho toàn hệ thống mà không phải sửa mã nguồn hay khởi động lại ứng dụng.',
    'Quản trị viên đã đăng nhập. Database đã chạy 14_time_settings.sql; phần bảo vệ cần thêm 16_protection_settings.sql.',
    'Dòng duy nhất của CauHinhThoiGian (Id = 1) được cập nhật; nhật ký ghi TIME_SETTINGS_UPDATED kèm giá trị trước và sau. '
    'Bộ nhớ đệm cấu hình được xóa để giá trị mới có hiệu lực ngay.',
    ['1. Quản trị viên mở Cấu hình thời gian; hệ thống đọc cấu hình qua GET /api/v1/settings/time/admin.',
     '2. Sửa số giờ SLA của các mức Nhanh, Ưu tiên, Tiêu chuẩn và mức mặc định khi lập phiếu.',
     '3. Sửa ngưỡng sắp trễ, hạn khách xác nhận báo giá, giờ mở cửa, giờ đóng cửa và ngày làm việc.',
     '4. Mở các nhóm bảo vệ để sửa số lần sai mật khẩu, thời gian khóa, hạn và số lần sai OTP, các giới hạn tần suất và hạn phiên.',
     '5. Bấm Lưu cấu hình; hệ thống kiểm tra giới hạn rồi lưu trong một transaction.',
     '6. Hệ thống ghi nhật ký, xóa bộ nhớ đệm và báo đã lưu.'],
    ['A1. Số giờ SLA không tăng dần từ Nhanh đến Tiêu chuẩn, giờ mở cửa không trước giờ đóng cửa hoặc không chọn ngày làm việc nào: '
     'báo lỗi 400, giữ dữ liệu đang nhập.',
     'A2. Hạn phiên truy cập lớn hơn hạn đăng nhập thường, hoặc hạn đăng nhập thường lớn hơn hạn ghi nhớ đăng nhập: báo lỗi 400.',
     'A3. Database chưa có cột CauHinhBaoVe mà biểu mẫu gửi phần bảo vệ: từ chối lưu, yêu cầu chạy 16_protection_settings.sql.',
     'A4. Người chưa đăng nhập hoặc không có vai trò ADMIN gọi API ghi hay API đọc phần bảo vệ: từ chối 401 hoặc 403.'],
    'Số giờ SLA từ 1 đến 720, ngưỡng sắp trễ từ 1 đến 1.440 phút, hạn báo giá từ 1 đến 720 giờ. Đổi số giờ SLA chỉ áp dụng cho phiếu '
    'lập sau đó vì HanSLA của phiếu cũ đã lưu; ngưỡng sắp trễ, hạn báo giá đang chờ và giờ làm việc áp dụng ngay. Mức bảo vệ áp dụng '
    'cho lượt xử lý kế tiếp, không thu hồi phiên đã cấp. GET /api/v1/settings/time công khai không trả phần bảo vệ. JSON bảo vệ trong '
    'database bị hỏng hoặc ngoài giới hạn thì hệ thống dùng giá trị mặc định, nên lỗi cấu hình không chặn đăng nhập, OTP và tra cứu.',
]
PRICE = [
    'Điều chỉnh giá trong danh mục',
    'Quản trị viên có quyền CATALOG_MANAGE.',
    'Cập nhật giá tính khách của linh kiện và giá công dịch vụ ngay trên bảng danh mục mà không làm thay đổi số tiền của các phiếu đã lập.',
    'Người dùng đã đăng nhập và có quyền CATALOG_MANAGE; linh kiện hoặc dịch vụ có trong danh mục.',
    'Giá mới được lưu vào danh mục linh kiện (LinhKien) hoặc bảng giá dịch vụ (BangGiaDichVu); nhật ký CATALOG_UPDATED ghi giá trước '
    'và sau. Báo giá, phiếu thu và giá trị miễn phí trong bảo hành của phiếu đã lập không đổi.',
    ['1. Mở Danh mục hệ thống, chọn tab Linh kiện hoặc Giá dịch vụ.',
     '2. Bấm Sửa giá trên dòng cần đổi; ô giá chuyển thành ô nhập.',
     '3. Nhập giá mới rồi nhấn Enter hoặc bấm Lưu.',
     '4. Hệ thống kiểm tra quyền và số tiền, gọi PUT /api/v1/catalog/parts/{sku} với servicePrice hoặc '
     'PUT /api/v1/catalog/service-prices/{code} với price.',
     '5. Lưu giá mới, ghi nhật ký và hiển thị giá mới trên bảng.'],
    ['A1. Số tiền âm hoặc không phải số: báo lỗi tại ô nhập, không gửi yêu cầu.',
     'A2. Máy chủ báo lỗi: giữ ô nhập để người dùng sửa lại.',
     'A3. Nhấn Esc hoặc bấm Hủy: trả về giá cũ, không gửi yêu cầu.',
     'A4. Trong lúc đang lưu, lần nhấn Enter thứ hai bị bỏ qua để không gửi trùng.'],
    'Giá tính khách không âm. Khi lập phiếu xuất kho, giá tính khách tại thời điểm đó được lưu vào ChiTietXuatKho.DonGiaDichVuXuat; '
    'giá trị Miễn phí trong bảo hành của phiếu lấy từ cột này. Các dòng xuất có trước khi nâng cấp được điền giá hiện tại lúc chạy '
    '15_issue_service_price.sql. Nhật ký không ghi giá vốn.',
]
end_33 = P('3.4. SƠ ĐỒ LỚP VÀ MÔ HÌNH DỮ LIỆU', 'Heading 2')._p.getprevious()
blocks = []
for num, title, rows, ad, sd in [
        ('3.3.22', 'cấu hình thời gian và bảo vệ hệ thống', CFG, 'AD_UC_CauHinhThoiGian', 'SD_UC_CauHinhThoiGian'),
        ('3.3.23', 'điều chỉnh giá trong danh mục', PRICE, 'AD_UC_SuaGiaDanhMuc', 'SD_UC_SuaGiaDanhMuc')]:
    cap, tbl = spec_table('Bảng đặc tả use case ' + title, [[r] if isinstance(r, str) else r for r in rows])
    fa, ca = figure(os.path.join(rose, ad + '.png'), 'Hình 3.', 'Sơ đồ hoạt động use case ' + title, fig3, cap_fig3)
    fs, cs = figure(os.path.join(rose, sd + '.png'), 'Hình 3.', 'Sơ đồ tuần tự use case ' + title, fig3, cap_fig3)
    blocks += [h(T_H3, f'{num}. Use case {title}'), h(T_H4, f'{num}.1. Đặc tả use case'), cap, tbl,
               h(T_H4, f'{num}.2. Sơ đồ hoạt động'), fa, ca, h(T_H4, f'{num}.3. Sơ đồ tuần tự'), fs, cs]
after(end_33, *blocks)

# ---------------------------------------------------------------- 3.5.1 và bảng API
p = P('Hai ứng dụng gọi chung REST API dưới tiền tố /api/v1')
replace_in(p, 'xác thực bằng JWT có thời hạn 15 phút', 'xác thực bằng JWT, mặc định có thời hạn 15 phút')
replace_in(p, 'Bảng 3.22 tóm tắt', 'Bảng 3.24 tóm tắt')
p = P('Các thao tác làm mới phiên, đổi mật khẩu và đăng nhập khóa dòng tài khoản')
replace_in(p, 'OTP email có hiệu lực năm phút, tối đa năm lượt nhập sai và chỉ được tiêu một lần.',
           'OTP email mặc định có hiệu lực năm phút, tối đa năm lượt nhập sai và chỉ được tiêu một lần; quản trị viên chỉnh các ngưỡng '
           'này cùng giới hạn tần suất và hạn phiên ở màn Cấu hình thời gian.')
api = next_tbl(P('Bảng 3.22: Các nhóm API chính của hệ thống')._p)
trs = api.findall(qn('w:tr'))
for tr in trs:
    cells = tr.findall(qn('w:tc'))
    first = txt(cells[0])
    if first == 'Danh mục':
        dl.cell_text(cells[1], '/catalog, /parts; sửa giá bằng PUT /catalog/parts/{sku} và PUT /catalog/service-prices/{code}')
    if first == 'Quản trị':
        row = copy.deepcopy(tr)
        c = row.findall(qn('w:tc'))
        dl.cell_text(c[0], 'Cấu hình hệ thống')
        dl.cell_text(c[1], '/settings/time (đọc công khai, không có phần bảo vệ), /settings/time/admin, PUT /settings/time')
        dl.cell_text(c[2], 'Quản trị viên; trang khách chỉ đọc giờ làm việc')
        tr.addnext(row)

# ---------------------------------------------------------------- 3.7 cơ sở dữ liệu
scripts = next_tbl(P('Bảng 3.23: Các script tạo và nâng cấp cơ sở dữ liệu')._p)
last = scripts.findall(qn('w:tr'))[-1]
for i, (name, text) in enumerate([
        ('07_access_statistics.sql', 'Thống kê truy cập tích lũy từ 31/10/2026'),
        ('08_public_reviews.sql', 'Bảng duyệt đánh giá hiển thị trên trang chủ'),
        ('10_legacy_review_publication.sql', 'Cho phép duyệt đánh giá cũ thiếu ngày, không điền ngày giả'),
        ('11_stocktake.sql', 'Phiếu kiểm kê, chi tiết kiểm kê và quyền STOCKTAKE_MANAGE'),
        ('13_relax_imei.sql', 'Nới ràng buộc IMEI thành 4 đến 50 ký tự chữ, số, dấu gạch ngang'),
        ('14_time_settings.sql', 'Bảng CauHinhThoiGian: SLA, sắp trễ, hạn báo giá, giờ làm việc'),
        ('15_issue_service_price.sql', 'Cột ChiTietXuatKho.DonGiaDichVuXuat, điền giá cho dòng xuất cũ'),
        ('16_protection_settings.sql', 'Cột JSON CauHinhThoiGian.CauHinhBaoVe cho mức bảo vệ')], start=7):
    row = copy.deepcopy(last)
    c = row.findall(qn('w:tc'))
    for tc, t in zip(c, [str(i), name, text]):
        dl.cell_text(tc, t)
    scripts.append(row)

p = P('Lược đồ gồm 55 bảng, 55 khóa chính, 97 khóa ngoại và 126 ràng buộc CHECK')
replace_in(p, '55 bảng, 55 khóa chính, 97 khóa ngoại và 126 ràng buộc CHECK', '56 bảng, 56 khóa chính, 97 khóa ngoại và 135 ràng buộc CHECK')
groups = next_tbl(P('Bảng 3.24: Các nhóm bảng trong cơ sở dữ liệu')._p)
for tr in groups.findall(qn('w:tr')):
    c = tr.findall(qn('w:tc'))
    if txt(c[1]) == 'Danh mục và cấu hình':
        dl.cell_text(c[2], txt(c[2]) + ', CauHinhThoiGian')
        assert txt(c[3]) == '11'
        dl.cell_text(c[3], '12')
keys = next_tbl(P('Bảng 3.26: Khóa, chỉ mục và ràng buộc')._p)
for tr in keys.findall(qn('w:tr')):
    c = tr.findall(qn('w:tc'))
    first = txt(c[0])
    if first == 'Khóa chính':
        dl.cell_text(c[1], '56 (mỗi bảng một khóa)')
    if first == 'Ràng buộc CHECK':
        dl.cell_text(c[1], '135')
otp = next_tbl(P('Bảng 3.27: Lưu trữ mã xác thực')._p)
for tr in otp.findall(qn('w:tr')):
    c = tr.findall(qn('w:tc'))
    if txt(c[0]) == 'Mã OTP':
        dl.cell_text(c[3], 'Mặc định hiệu lực 5 phút, gửi lại sau 60 giây, sai tối đa 5 lần; chỉnh tại Cấu hình thời gian')
rep = next_tbl(P('Bảng 3.29: Các báo cáo tổng hợp tại SQL Server')._p)
for tr in rep.findall(qn('w:tr')):
    c = tr.findall(qn('w:tc'))
    if txt(c[0]).startswith('Tỷ lệ bảo hành, hiệu suất kỹ thuật viên'):
        dl.cell_text(c[1], 'GROUP BY theo phân loại bảo hành và kỹ thuật viên, SUM(CASE …); số phiếu trễ hạn SLA so thời điểm đạt '
                           'kiểm tra chất lượng với HanSLA và đếm lệnh sửa chưa xong đã quá HanSLA')
p = P('Mô hình ERD được cập nhật từ lược đồ 55 bảng')
replace_in(p, 'lược đồ 55 bảng', 'lược đồ 56 bảng')
replace_in(p, 'Sáu bảng độc lập không có khóa ngoại vào hoặc ra gồm DanhMucNhan, ChuyenTrangThaiHopLe, BoDemMa, NhatKyThaoTac, '
              'MaXacThucOTP và MocThongKeTruyCap',
           'Bảy bảng độc lập không có khóa ngoại vào hoặc ra gồm DanhMucNhan, ChuyenTrangThaiHopLe, BoDemMa, NhatKyThaoTac, '
           'MaXacThucOTP, MocThongKeTruyCap và CauHinhThoiGian')
p = P('Các bảng dưới đây mô tả 55 bảng trong database/01_schema.sql')
replace_in(p, 'mô tả 55 bảng', 'mô tả 56 bảng')

# Cấu trúc bảng CauHinhThoiGian sau BoDemMa; thêm cột DonGiaDichVuXuat cho ChiTietXuatKho.
bodem_cap = P('Bảng 3.32: Cấu trúc bảng BoDemMa')._p
bodem_tbl = next_tbl(bodem_cap)
cfg_cap = dl.clone_caption(bodem_cap, 'Bảng 3.', 0, 'Cấu trúc bảng CauHinhThoiGian')
lk_tmpl = copy.deepcopy(next_tbl(P('Bảng 3.60: Cấu trúc bảng LinhKien')._p))
for tr in lk_tmpl.findall(qn('w:tr'))[1:3]:  # dòng PK có thụt lề lạ, dòng TenLK có ô trống: khuôn là dòng DonViTinh đủ 4 ô
    lk_tmpl.remove(tr)
cfg_tbl = dl.build_table(lk_tmpl, ['Tên cột', 'Kiểu dữ liệu', 'Null', 'Ràng buộc'], [
    ['Id', 'tinyint', 'NOT NULL', 'PK, chỉ nhận giá trị 1'],
    ['SlaNhanhGio', 'int', 'NOT NULL', ''],
    ['SlaUuTienGio', 'int', 'NOT NULL', ''],
    ['SlaTieuChuanGio', 'int', 'NOT NULL', ''],
    ['MucSlaMacDinh', 'nvarchar(20)', 'NOT NULL', ''],
    ['NguongSapTrePhut', 'int', 'NOT NULL', ''],
    ['HanBaoGiaGio', 'int', 'NOT NULL', ''],
    ['PhutMoCua', 'int', 'NOT NULL', ''],
    ['PhutDongCua', 'int', 'NOT NULL', ''],
    ['NgayLamViec', 'nvarchar(20)', 'NOT NULL', ''],
    ['CauHinhBaoVe', 'nvarchar(max)', 'NULL', 'JSON hợp lệ'],
    ['NguoiCapNhat', 'nvarchar(30)', 'NULL', ''],
    ['NgayCapNhat', 'datetime2(0)', 'NULL', ''],
])
after(bodem_tbl, cfg_cap, cfg_tbl)
ctxk = next_tbl(P('Bảng 3.66: Cấu trúc bảng ChiTietXuatKho')._p)
for tr in ctxk.findall(qn('w:tr')):
    c = tr.findall(qn('w:tc'))
    if txt(c[0]) == 'DonGiaXuat':
        row = copy.deepcopy(tr)
        for tc, t in zip(row.findall(qn('w:tc')), ['DonGiaDichVuXuat', 'decimal(18,2)', 'NULL', '']):
            dl.cell_text(tc, t)
        tr.addnext(row)
        break
else:
    raise SystemExit('DonGiaXuat row not found')

# ---------------------------------------------------------------- chương 4
p = P('Script 01_schema.sql tạo 55 bảng')
replace_in(p, 'tạo 55 bảng', 'tạo 56 bảng')
deploy_p = P('Môi trường triển khai thử nghiệm sử dụng VPS Ubuntu 24.04')._p
after(deploy_p,
      body_p('Chính sách bảo mật nội dung (CSP) cho phép nạp font từ chính site (font-src \'self\') vì font Inter và Plus Jakarta Sans '
             'được lưu cùng ứng dụng. Trước ngày 08/11/2026, CSP chỉ cho phép Google Fonts nên trình duyệt chặn cả bốn tệp font; tiêu đề '
             'đậm hiển thị bằng font hệ thống và dấu tiếng Việt bị lệch.'),
      body_p('Sau khi bản mới đạt health, activate.py xóa thư mục release và image cũ trên VPS. Hệ thống giữ ba bản mới nhất, bản đang '
             'chạy, bản trước đó và các bản gắn tag v*; volume, tệp sao lưu database và log không bị xóa. Lỗi khi dọn chỉ in cảnh báo, '
             'không làm hỏng lần triển khai.'),
      body_p('Ngày 08/11/2026, các script 14_time_settings.sql, 15_issue_service_price.sql, 16_protection_settings.sql và '
             '11_stocktake.sql được chạy trên database VPS sau khi sao lưu COPY_ONLY và kiểm tra RESTORE VERIFYONLY. Số phiếu tiếp '
             'nhận, dòng xuất kho và linh kiện không đổi; health trước và sau đều trả UP.'))

# Danh mục hệ thống
P('- Nhóm & loại thiết bị kèm loại định danh')
dl.settext(P('- Nhóm & loại thiết bị kèm loại định danh')._p,
           '- Năm tab Nhóm thiết bị (kèm loại định danh Serial hoặc IMEI), Hãng & model, Linh kiện, Giá dịch vụ và Bảo hành; nhãn tab '
           'ghi số mục của từng danh mục.')
dl.settext(P('- Hãng & model, nhóm thiết bị áp dụng cho từng hãng.')._p,
           '- Hãng & model: nhóm thiết bị áp dụng cho từng hãng và danh sách model; lễ tân chọn model từ danh sách này khi tiếp nhận.')
p_sku = P('- Linh kiện (SKU): tên linh kiện, nhóm thiết bị, hãng và giá tính khách')._p
after(p_sku, dl.clone_para(T_DASH,
      '- Nút Sửa giá trên từng dòng linh kiện và dịch vụ mở ô nhập ngay trong bảng: Enter lưu, Esc hủy, số âm bị chặn trước khi gửi. '
      'Giá mới không làm đổi báo giá, phiếu thu và giá trị bảo hành miễn phí của phiếu đã lập.'))
blip = fig4.find('.//' + qn('a:blip'))
dl.replace_image(doc, blip, open(os.path.join(ui, 'fig_catalog.png'), 'rb').read())
dl.set_caption(cap_fig4, 'Hình 4.', 18, 'Giao diện danh mục hệ thống và sửa giá trên bảng')
cap19 = P('Hình 4.19: Giao diện thêm linh kiện (SKU) vào danh mục')._p
dl.replace_image(doc, cap19.getprevious().find('.//' + qn('a:blip')), open(os.path.join(ui, 'fig_addpart.png'), 'rb').read())

# Cấu hình thời gian (trước Báo cáo & Thống kê)
rep_head = P('Báo cáo & Thống kê (/admin#reports):')._p
anchor = rep_head.getprevious()
ft, ct = figure(os.path.join(ui, 'fig_time.png'), 'Hình 4.', 'Giao diện cấu hình thời gian', fig4, cap_fig4)
fp, cp = figure(os.path.join(ui, 'fig_protection.png'), 'Hình 4.', 'Giao diện cấu hình bảo vệ đăng nhập, OTP và giới hạn tần suất',
                fig4, cap_fig4, max_h=17.0)
after(anchor,
      dl.clone_para(T_BODY, 'Cấu hình thời gian (/admin#time-settings):'),
      dl.clone_para(T_DASH, '- SLA cam kết: số giờ của ba mức Tiêu chuẩn, Ưu tiên, Nhanh và mức mặc định khi lập phiếu; giá trị khởi '
                            'tạo là Tiêu chuẩn 48 giờ.'),
      dl.clone_para(T_DASH, '- Cảnh báo và báo giá: ngưỡng báo sắp trễ trước hạn SLA và hạn khách xác nhận báo giá.'),
      dl.clone_para(T_DASH, '- Giờ làm việc: giờ mở và đóng cửa theo dạng HH:mm, các ngày làm việc trong tuần; dùng cho giờ hẹn của '
                            'khách và giờ nhận máy.'),
      dl.clone_para(T_DASH, '- Bốn nhóm thu gọn cho mức bảo vệ: đăng nhập và khóa tài khoản, mã OTP qua email, gửi phiếu và tra cứu, '
                            'thời hạn phiên đăng nhập. Mỗi giới hạn tần suất gồm số lượt tối đa và khoảng thời gian tính bằng phút.'),
      dl.clone_para(T_DASH, '- Nút Điền giá trị mặc định đưa biểu mẫu về giá trị khởi tạo; thay đổi chỉ được ghi khi bấm Lưu cấu hình.'),
      ft, ct, fp, cp)

# Báo cáo & Thống kê
dl.settext(P('- Thẻ chỉ số tổng hợp: doanh thu, số phiếu tiếp nhận')._p,
           '- Năm thẻ chỉ số: doanh thu, số phiếu tiếp nhận, thời gian xử lý trung bình, số phiếu đang trễ hạn SLA và tỷ lệ phiếu trong '
           'bảo hành.')
p_chart = P('- Biểu đồ doanh thu theo tháng, số phiếu theo trạng thái')._p
dl.settext(p_chart, '- Ba tab Tổng quan, Kỹ thuật viên và Đánh giá. Tab Tổng quan có biểu đồ doanh thu theo tháng, số phiếu theo trạng '
                    'thái, thời gian xử lý trung bình theo nhóm thiết bị và tỷ lệ trong/ngoài bảo hành; mỗi biểu đồ xem được dạng bảng.')
after(p_chart, dl.clone_para(T_DASH, '- Tab Kỹ thuật viên liệt kê số phiếu được giao, hoàn tất, trễ hạn SLA (tách đã xong trễ và đang '
                                     'trễ), thời gian sửa trung bình và tỷ lệ đạt kiểm tra chất lượng lần đầu.'))
cap20 = P('Hình 4.20: Giao diện báo cáo và thống kê vận hành')._p
dl.replace_image(doc, cap20.getprevious().find('.//' + qn('a:blip')), open(os.path.join(ui, 'fig_reports.png'), 'rb').read())
fr, cr = figure(os.path.join(ui, 'fig_reports_tech.png'), 'Hình 4.', 'Giao diện hiệu suất kỹ thuật viên kèm số phiếu trễ hạn SLA',
                fig4, cap_fig4)
after(cap20, fr, cr)

p = P('- Hiệu suất kỹ thuật viên: chuyên môn, số phiếu được giao, số hoàn tất')
replace_in(p, 'số phiếu được giao, số hoàn tất,', 'số phiếu được giao, số hoàn tất, số phiếu trễ hạn SLA (đã xong trễ và đang trễ),')

# Ảnh giao diện chụp lại ngày 08/11/2026 (thanh bên có Cấu hình thời gian, tab báo cáo, người gửi máy, SLA theo cấu hình).
RETAKE = {
    'Bảng đánh giá khách hàng trong báo cáo quản trị': 'f13.png',
    'Giao diện quản lý tài khoản và phân quyền nhân viên': 'f14.png',
    'Giao diện thêm nhân viên mới': 'f15.png',
    'Giao diện xem và cập nhật tài khoản nhân viên': 'f16.png',
    'Giao diện quản lý tài khoản khách hàng': 'f17.png',
    'Giao diện tiếp nhận thiết bị – thông tin khách hàng và thiết bị': 'f24.png',
    'Giao diện tiếp nhận thiết bị – kiểm tra ngoại quan và xác nhận báo giá tại quầy': 'f25.png',
    'Giao diện báo cáo phân bổ SLA': 'f31.png',
    'Giao diện báo cáo hiệu suất kỹ thuật viên': 'f32.png',
}
for title, png in RETAKE.items():
    cap = [q for q in paras() if q.style.name == 'BC Ten hinh' and q.text.split(': ', 1)[-1] == title]
    assert len(cap) == 1, title
    blip = cap[0]._p.getprevious().find('.//' + qn('a:blip'))
    dl.replace_image(doc, blip, open(os.path.join(ui, png), 'rb').read(), max_h_cm=20.0)
cap24 = [q for q in paras() if q.style.name == 'BC Ten hinh' and q.text.endswith('thông tin khách hàng và thiết bị')][0]
n24 = int(re.match(r'Hình 4\.(\d+)', cap24.text).group(1))
set_caption(cap24._p, 'Hình 4.', n24, 'Giao diện tiếp nhận thiết bị – người gửi máy và thông tin thiết bị')
dl.settext(P('- Thông tin khách hàng: nhập số điện thoại và bấm')._p,
           '- Người gửi máy lần này: nhập số điện thoại và bấm "Tra cứu khách hàng" để lấy hồ sơ có sẵn, hoặc nhập mới họ tên, email, '
           'địa chỉ. Người gửi nhận thông báo và xác nhận báo giá của phiếu này; chủ đăng ký thiết bị được giữ nguyên.')
dl.settext(P('- Thông tin thiết bị: chọn nhóm và loại thiết bị')._p,
           '- Thông tin thiết bị: chọn nhóm và loại thiết bị, gõ để lọc rồi chọn hãng/model từ danh mục, nhập Serial/IMEI và bấm '
           '"Kiểm tra bảo hành"; chọn kênh tiếp nhận, loại yêu cầu (Bảo hành / Sửa chữa dịch vụ) và mức SLA. Nhãn mức SLA ghi số giờ '
           'đang cấu hình, ví dụ Tiêu chuẩn (48h); ngày hẹn trả nhập giờ theo dạng HH:mm và chỉ nhận giờ trong khung làm việc.')

# ---------------------------------------------------------------- chương 5
p = P('Ngày 06/11/2026, backend đạt 207/207 test')
dl.settext(p._p,
           'Ngày 08/11/2026, backend đạt 240/240 test ở cấu hình Release, frontend đạt 33/33 test và script triển khai đạt 16/16 test; '
           'ứng dụng Flutter đạt 174/174 unit test, widget test ngày 06/11/2026. Không có ca thất bại hoặc bị bỏ qua. Lint Web và '
           'Flutter analyze đều đạt; workflow CI trên GitHub ngày 08/11/2026 đạt cả ba job Verify and package, SQL Server và Check '
           'Flutter. Các ca nghiệp vụ trên database ở mục 5.1.2–5.1.3 được trình bày theo kết quả ngày 30/10/2026, riêng các ca QT-04 '
           'đến QT-08 và BC-03 chạy ngày 08/11/2026. Danh mục tệp kết quả nằm tại Phụ lục B.')
auto = next_tbl(P('Bảng 5.8: Kết quả các bộ kiểm thử tự động')._p)
rows = auto.findall(qn('w:tr'))
for tr in rows[1:]:
    c = tr.findall(qn('w:tc'))
    name = txt(c[0])
    if name.startswith('Backend'):
        dl.cell_text(c[2], '240'); dl.cell_text(c[3], '240')
    if name.startswith('Frontend'):
        dl.cell_text(c[2], '33'); dl.cell_text(c[3], '33')
for vals in (['Tích hợp SQL Server (transaction, tranh chấp, giá lúc xuất kho)', 'xUnit trên SQL Server', '14', '14'],
             ['Script kích hoạt và dọn bản phát hành', 'python unittest', '16', '16']):
    row = copy.deepcopy(rows[-1])
    for tc, t in zip(row.findall(qn('w:tc')), vals):
        dl.cell_text(tc, t)
    auto.append(row)
p = P('Ngày 05/11/2026, 13 ca tích hợp SQL Server đạt')
after(p._p, body_p('Ngày 08/11/2026, bộ tích hợp có 14 ca và đều đạt. Ca mới IssueServicePriceTests lập phiếu xuất với giá tính khách '
                   '20, đổi giá danh mục thành 99 rồi kiểm tra dòng xuất vẫn giữ 20; dòng cũ chưa lưu giá thì dùng giá hiện tại.'))
p = P('Tám script giao diện Web chạy trên Edge với API giả lập')
after(p._p, body_p('Ngày 08/11/2026, toàn bộ chuỗi script giao diện chạy lại và đạt, gồm hai script mới. time-settings kiểm tra biểu mẫu '
                   'cấu hình, chặn SLA và hạn phiên sai thứ tự, lưu đúng body ở 1.440 px và 390 px. catalog-price kiểm tra tab danh '
                   'mục và sửa giá trên bảng: Esc hủy, chặn số âm, giữ ô nhập khi máy chủ báo lỗi, không gửi trùng khi nhấn Enter lần '
                   'hai.'))
qt = next_tbl(P('Bảng 5.7: Test case quản trị và báo cáo')._p)
tmpl = qt.findall(qn('w:tr'))[-1]
for vals in [
        ['QT-04', 'Lưu hạn phiên truy cập lớn hơn hạn đăng nhập thường', 'admin: accessTokenMinutes = 1000 (hạn thường 12 giờ)',
         'Từ chối 400, không lưu', 'Báo hạn phiên truy cập ≤ hạn đăng nhập thường ≤ hạn ghi nhớ (HTTP 400)', 'Đạt'],
        ['QT-05', 'Lưu cấu hình bảo vệ hợp lệ', 'admin: hạn OTP 7 phút, OTP theo IP 25 lượt/60 phút',
         'Lưu vào CauHinhBaoVe', 'Lưu thành công; database ghi hạn OTP 7 và giới hạn 25 lượt', 'Đạt'],
        ['QT-06', 'Đọc phần bảo vệ khi chưa đăng nhập', 'GET /settings/time/admin không kèm token',
         'Từ chối 401', 'Bị từ chối (HTTP 401); GET /settings/time công khai không có trường protection', 'Đạt'],
        ['QT-07', 'Cấu hình bảo vệ trong database bị sửa sai', 'CauHinhBaoVe = {"loginIp":null}, khởi động lại API',
         'Đăng nhập vẫn hoạt động, dùng mặc định', 'Đăng nhập thành công; giới hạn đăng nhập theo IP trở về 10 lượt/1 phút', 'Đạt'],
        ['QT-08', 'Đổi giá linh kiện của phiếu đã xuất kho', 'TN-2026-1019-00004, linh kiện LK-WSH-03',
         'Giá trị miễn phí trong bảo hành không đổi', 'freeWarrantyAmount giữ 220.000 đ sau khi đổi giá; đã trả giá về cũ', 'Đạt'],
        ['BC-03', 'Số phiếu trễ hạn SLA theo kỹ thuật viên', 'admin: GET /reports/technician-performance',
         'Khớp truy vấn SQL độc lập', 'Khớp cả 16 kỹ thuật viên ở hai cột đã xong trễ và đang trễ (HTTP 200)', 'Đạt']]:
    row = copy.deepcopy(tmpl)
    for tc, t in zip(row.findall(qn('w:tc')), vals):
        dl.cell_text(tc, t)
    qt.append(row)
summary = next_tbl(P('Bảng 5.10: Tổng hợp kết quả kiểm thử')._p)
srows = summary.findall(qn('w:tr'))
for tr in srows[1:]:
    c = tr.findall(qn('w:tc'))
    name = txt(c[0])
    if name.startswith('Chức năng theo nhóm'):
        dl.cell_text(c[1], '43'); dl.cell_text(c[2], '43')
    if name == 'Kiểm thử đơn vị backend':
        dl.cell_text(c[1], '240'); dl.cell_text(c[2], '240')
    if name == 'Kiểm thử đơn vị frontend':
        dl.cell_text(c[1], '33'); dl.cell_text(c[2], '33')
for vals in (['Tích hợp SQL Server', '14', '14', '0'], ['Script triển khai', '16', '16', '0']):
    row = copy.deepcopy(srows[-1])
    for tc, t in zip(row.findall(qn('w:tc')), vals):
        dl.cell_text(tc, t)
    summary.append(row)
outline = next_tbl(P('Bảng 5.11: Bảng đánh giá kết quả so với đề cương')._p)
for tr in outline.findall(qn('w:tr')):
    c = tr.findall(qn('w:tc'))
    if txt(c[0]) == 'Báo cáo, thống kê':
        dl.cell_text(c[2], 'Doanh thu, trạng thái, SLA, số phiếu trễ hạn SLA theo kỹ thuật viên, hiệu suất, đánh giá công khai, nhật ký '
                           'truy cập và xuất Excel theo bộ lọc.')

# ---------------------------------------------------------------- kết luận
p = P('- Về cơ sở dữ liệu: thiết kế 55 bảng')
replace_in(p, 'thiết kế 55 bảng, 55 khóa chính, 97 khóa ngoại và 126 CHECK', 'thiết kế 56 bảng, 56 khóa chính, 97 khóa ngoại và 135 CHECK')
p = P('- Về quản trị và báo cáo: cung cấp doanh thu')
replace_in(p, 'hiệu suất kỹ thuật viên, SLA,', 'hiệu suất kỹ thuật viên kèm số phiếu trễ hạn SLA, SLA,')
after(p._p, dl.clone_para(p._p,
      '- Về cấu hình: quản trị viên đổi số giờ SLA, ngưỡng sắp trễ, hạn báo giá, giờ làm việc và các mức bảo vệ (khóa đăng nhập, OTP, '
      'giới hạn tần suất, hạn phiên) trên giao diện, không phải sửa mã hay khởi động lại. Giá danh mục sửa được ngay trên bảng; phiếu '
      'xuất kho lưu giá tại thời điểm lập nên số tiền của phiếu cũ không đổi.'))
p = P('- Về bảo mật và vận hành: xác thực JWT RS256')
replace_in(p, 'quy trình CI trên GitHub Actions.', 'quy trình CI trên GitHub Actions; CSP chỉ cho nạp tài nguyên và font từ chính site, '
                                                  'và mỗi lần triển khai tự dọn release cũ, giữ ba bản gần nhất.')
p = P('- Ngày 06/11/2026: backend đạt 207/207 test')
dl.settext(p._p, '- Ngày 08/11/2026: backend đạt 240/240 test, frontend 33/33, script triển khai 16/16 và 14 ca SQL Server đồng thời; '
                 'workflow CI trên GitHub đạt cả ba job. Flutter đạt 174/174 ngày 06/11/2026; lint Web và phân tích Flutter đạt.')
p = P('- Chat sử dụng polling và chưa có thử nghiệm tải lớn.')
replace_in(p, 'bản thay đổi local chưa được chứng minh bằng một lần chạy mới trên GitHub.',
           'ngày 08/11/2026 các job này đã chạy trên GitHub và đạt trước khi tự triển khai lên VPS.')

# Chú thích cuối chương 4 gõ số tay (không có trường SEQ) nên không tự đổi số khi thêm hình: chuyển sang SEQ.
static = [p for p in paras() if p.style.name in ('BC Ten hinh', 'BC Ten bang') and not p._p.xpath('.//w:instrText')]
for p in static:
    m = re.match(r'(Hình|Bảng) (\d+)\.(\d+): (.*)', p.text)
    tmpl = [q for q in paras() if q.style.name == p.style.name and q._p.xpath('.//w:instrText') and q.text.startswith(f'{m.group(1)} {m.group(2)}.')][-1]
    p._p.addprevious(clone_caption(tmpl._p, f'{m.group(1)} {m.group(2)}.', 0, m.group(4)))
    p._p.getparent().remove(p._p)
print('static captions converted:', len(static))
doc.save(dst)
print('saved', dst)
