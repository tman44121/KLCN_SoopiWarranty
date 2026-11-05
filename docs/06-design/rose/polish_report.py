"""Second pass on the KLCN report after review (docs/06-design/ROSE_DIAGRAMS.md section 9).

Usage: python polish_report.py <in.docx> <out.docx> <rose png dir> <erd png dir>
- every table: black single borders, no cell shading;
- use-case spec tables: use-case name starts with a capital letter, row labels bold;
- 2.4 and 3.3 activity/sequence pictures replaced by the current Rose captures (2.4 uses the new AD_2_2_2_x);
- 3.4 analysis class diagram from Rose (CD_LopPhanTich.png);
- 3.7.1-3.7.3 prose turned into tables, 3.7.4 ERD replaced by the black-and-white ERD per subject area.
Run Word afterwards to refresh SEQ fields and the lists of figures/tables.
"""
import copy, io, os, re, sys
import docx
from docx.oxml.ns import qn
from PIL import Image
import diagrams_klcn as dk

src, out, ROSE, ERD = sys.argv[1:5]
doc = docx.Document(src)
body = doc.element.body
W = lambda tag: qn('w:' + tag)


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


# ------------------------------------------------------------------ 1. tables: black borders, no fill
def black_borders(tbl):
    tblpr = tbl.find(W('tblPr'))
    old = tblpr.find(W('tblBorders'))
    new = tblpr.makeelement(W('tblBorders'), {})
    for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        new.append(new.makeelement(W(side), {W('val'): 'single', W('sz'): '4', W('space'): '0', W('color'): '000000'}))
    if old is not None:
        tblpr.replace(old, new)
    else:
        # schema order: tblStyle, tblpPr, tblOverlap, bidiVisual, tblStyleRowBandSize, tblStyleColBandSize, tblW, jc,
        # tblCellSpacing, tblInd, tblBorders, ...
        after = None
        for tag in ('tblInd', 'tblCellSpacing', 'jc', 'tblW', 'tblStyle'):
            after = tblpr.find(W(tag))
            if after is not None:
                break
        if after is not None:
            after.addnext(new)
        else:
            tblpr.insert(0, new)
    for e in list(tbl.iter(W('shd'))) + list(tbl.iter(W('tcBorders'))):
        e.getparent().remove(e)


for tbl in body.iter(W('tbl')):
    black_borders(tbl)

# ------------------------------------------------------------------ 2. use-case tables
for tbl in body.iter(W('tbl')):
    rows = tbl.findall(W('tr'))
    if not rows or text(rows[0]).strip()[:12] != 'Tên Use Case':
        continue
    name_cell = rows[0].findall(W('tc'))[-1]
    first_t = next((t for t in name_cell.iter(W('t')) if (t.text or '').strip()), None)
    if first_t is not None:
        s = first_t.text
        i = len(s) - len(s.lstrip())
        first_t.text = s[:i] + s[i:i + 1].upper() + s[i + 1:]
    for tr in rows:
        label = tr.findall(W('tc'))[0]
        for r in label.iter(W('r')):
            rpr = r.find(W('rPr'))
            if rpr is None:
                rpr = r.makeelement(W('rPr'), {})
                r.insert(0, rpr)
            if rpr.find(W('b')) is None:
                rpr.insert(0, rpr.makeelement(W('b'), {}))


# ------------------------------------------------------------------ 3. pictures
MAX_W, MAX_H = 5400000, 7560000  # 15 x 21 cm


def put_picture(fig_p, png):
    blip = fig_p.find('.//' + qn('a:blip'))
    rid, _ = doc.part.get_or_add_image(png)
    blip.set(qn('r:embed'), rid)
    w, h = Image.open(png).size
    scale = min(MAX_W / w, MAX_H / h)
    cx, cy = int(w * scale), int(h * scale)
    for e in (fig_p.find('.//' + qn('wp:extent')), fig_p.find('.//' + qn('a:ext'))):
        e.set('cx', str(cx))
        e.set('cy', str(cy))


def figure_before(cap):
    p = cap.getprevious()
    while p is not None and p.find('.//' + qn('a:blip')) is None:
        p = p.getprevious()
    return p


UC_DIAGRAMS = {
    'gửi yêu cầu bảo hành': '3.4.1.1', 'tra cứu thông tin': 'UC_TraCuuThongTin',
    'tra cứu tình trạng sửa chữa': 'UC_TraCuuTinhTrang', 'lập phiếu báo giá': '3.4.2.1', 'phê duyệt báo giá': '3.4.2.2',
    'xác nhận báo giá': '3.4.2.3', 'đăng nhập/ đăng xuất': 'UC_DangNhap', 'tiếp nhận': '3.4.1.2', 'bàn giao': '3.4.1.3',
    'thanh toán': '3.4.1.4', 'quản lý danh mục': '3.4.5.2', 'xem báo cáo thống kê': '3.4.5.3', 'lập phiếu nhập kho': '3.4.4.1',
    'xác nhận xuất kho & cập nhật tồn kho': '3.4.4.3', 'quản lý tài khoản & phân quyền': '3.4.5.1',
    'phân công xử lý thiết bị': '3.4.3.1', 'cập nhật kết quả chẩn đoán lỗi': '3.4.3.2',
    'phân loại điều kiện bảo hành': '3.4.3.3', 'lập phiếu yêu cầu xuất linh kiện': '3.4.4.2',
    'cập nhật trạng thái sửa chữa': '3.4.3.4', 'ghi nhận kết quả kiểm định KCS': '3.4.3.5'}
pairs = {k: (ad['name'], sd['name']) for k, _, ad, sd in dk.F + dk.EXTRA}
replaced = {'ad24': 0, 'sd24': 0, 'uc': 0, 'class': 0}
for cap in paras('BCTenhinh'):
    t = re.sub(r'^Hình [\d.]+:\s*', '', text(cap)).strip()
    if t.startswith('Sơ đồ hoạt động quy trình') or t.startswith('Sơ đồ tuần tự quy trình'):
        kind = 'ad24' if 'hoạt động' in t else 'sd24'
        replaced[kind] += 1
        name = '%s_2_2_2_%d.png' % ('AD' if kind == 'ad24' else 'SD', replaced[kind])
        put_picture(figure_before(cap), os.path.join(ROSE, name))
    elif t.startswith('Sơ đồ hoạt động use case ') or t.startswith('Sơ đồ tuần tự use case '):
        uc = t.split('use case ', 1)[1]
        ad, sd = pairs[UC_DIAGRAMS[uc]]
        put_picture(figure_before(cap), os.path.join(ROSE, (ad if 'hoạt động' in t else sd) + '.png'))
        replaced['uc'] += 1
    elif t.startswith('Sơ đồ lớp mức phân tích'):
        put_picture(figure_before(cap), os.path.join(ROSE, 'CD_LopPhanTich.png'))
        replaced['class'] += 1

# ------------------------------------------------------------------ 4. section 3.7 as tables
BODY_TPL = next(p for p in paras('BCNoidung') if text(p).startswith('Hệ thống sử dụng Microsoft SQL Server'))
BODY_TPL = copy.deepcopy(BODY_TPL)
CAP_TBL = copy.deepcopy(next(p for p in paras('BCTenbang') if text(p).startswith('Bảng 3.22')))
CAP_FIG = copy.deepcopy(next(p for p in paras('BCTenhinh') if 'ERD' in text(p)))
FIG_TPL = copy.deepcopy(figure_before(next(p for p in paras('BCTenhinh') if 'ERD' in text(p))))
SPEC = copy.deepcopy(next(t for t in body.iter(W('tbl')) if text(t).startswith('Tên Use Case')))
CELL_P = copy.deepcopy(SPEC.find(W('tr') + '/' + W('tc') + '/' + W('p')))


def para(value):
    return set_text(strip_bookmarks(copy.deepcopy(BODY_TPL)), value)


def caption(tpl, value):
    c = strip_bookmarks(copy.deepcopy(tpl))
    last = [r for r in c.findall(W('r')) if r.find(W('t')) is not None][-1]
    last.find(W('t')).text = ': ' + value
    return c


def cell(value, width, bold=False, center=False):
    tc = SPEC.makeelement(W('tc'), {})
    tcpr = tc.makeelement(W('tcPr'), {})
    tcpr.append(tcpr.makeelement(W('tcW'), {W('w'): str(width), W('type'): 'dxa'}))
    tcpr.append(tcpr.makeelement(W('vAlign'), {W('val'): 'center'}))
    tc.append(tcpr)
    for line in str(value).split('\n'):
        p = set_text(strip_bookmarks(copy.deepcopy(CELL_P)), line)
        rpr = p.find(W('r') + '/' + W('rPr'))
        b = rpr.find(W('b')) if rpr is not None else None
        if not bold and b is not None:
            rpr.remove(b)
        if center:
            p.find(W('pPr') + '/' + W('jc')).set(W('val'), 'center')
        tc.append(p)
    return tc


def table(header, rows, widths, center_cols=()):
    t = copy.deepcopy(SPEC)
    for tr in t.findall(W('tr')):
        t.remove(tr)
    grid = t.find(W('tblGrid'))
    for g in list(grid):
        grid.remove(g)
    for w in widths:
        grid.append(grid.makeelement(W('gridCol'), {W('w'): str(w)}))
    t.find(W('tblPr') + '/' + W('tblW')).set(W('w'), str(sum(widths)))
    for ri, row in enumerate([header] + rows):
        tr = t.makeelement(W('tr'), {})
        if ri == 0:
            trpr = tr.makeelement(W('trPr'), {})
            trpr.append(trpr.makeelement(W('tblHeader'), {}))
            tr.append(trpr)
        for ci, (v, w) in enumerate(zip(row, widths)):
            tr.append(cell(v, w, bold=(ri == 0), center=(ri == 0 or ci in center_cols)))
        t.append(tr)
    black_borders(t)
    return t


def replace_para(start, new_elements):
    p = next(p for p in paras('BCNoidung') if text(p).startswith(start))
    for el in new_elements:
        p.addprevious(el)
    p.getparent().remove(p)


replace_para('Hệ thống sử dụng Microsoft SQL Server', [
    para('Hệ thống sử dụng Microsoft SQL Server. Database TrungTamBaoHanhDB dùng collation Latin1_General_100_CI_AI '
         '(so sánh không phân biệt hoa thường và dấu). Lược đồ do các script trong thư mục database quản lý; backend '
         'không dùng EF migration hay tự tạo schema. Các script được liệt kê trong bảng sau.'),
    caption(CAP_TBL, 'Các script tạo và nâng cấp cơ sở dữ liệu'),
    table(['STT', 'Script', 'Nội dung'], [
        ['1', '01_schema.sql', 'Tạo bảng, khóa, chỉ mục và ràng buộc'],
        ['2', '02_reference_data.sql', 'Dữ liệu danh mục, vai trò và quyền'],
        ['3', '03_demo_data.sql', 'Dữ liệu mẫu phục vụ chạy thử'],
        ['4', '04_app_user.sql', 'Tài khoản ứng dụng cho môi trường production'],
        ['5', '05_upgrade_existing_db.sql', 'Nâng cấp database đã có, không xóa dữ liệu'],
        ['6', '06_chat.sql', 'Bổ sung bảng chat cho database đã có, không xóa dữ liệu']],
        [700, 2900, 4905], center_cols=(0,)),
])

GROUPS = [
    ('Tài khoản và phân quyền', 'TaiKhoan, VaiTro, QuyenHan, TaiKhoan_VaiTro, VaiTro_QuyenHan, RefreshToken, '
                                'MaXacThucOTP, NhanVien, TramDichVu'),
    ('Danh mục và cấu hình', 'NhomThietBi, LoaiThietBi, HangSanXuat, HangSanXuat_NhomThietBi, SanPham, ChinhSachBaoHanh, '
                             'BangGiaDichVu, NhaCungCap, DanhMucNhan, ChuyenTrangThaiHopLe, BoDemMa'),
    ('Khách hàng và tiếp nhận', 'KhachHang, ThietBi, YeuCauBaoHanh, PhieuTiepNhan, LichSuTrangThai_ThietBi, GhiChuPhieu, '
                                'TepDinhKem'),
    ('Kỹ thuật và báo giá', 'PhanCong, LichSuPhanCong, PhieuKiemTra, PhieuBaoGia, ChiTietBaoGia, PhieuSuaChua, '
                            'KetQuaSuaChua'),
    ('Kho vật tư', 'LinhKien, TonKhoTheoKe, PhieuNhapKho, ChiTietNhapKho, PhieuXuatKho, ChiTietXuatKho, PhieuDieuChuyen'),
    ('Thu ngân và bàn giao', 'HoaDon_PhieuThu, PhieuBanGiao'),
    ('Thông báo, chat và nhật ký', 'ThongBao, ThongBao_DaDoc, ThietBiNhanThongBao, HoiThoai, TinNhan, NhatKyThaoTac'),
]
assert sum(len(t.split(', ')) for _, t in GROUPS) == 49
replace_para('Lược đồ gồm 49 bảng và 88 khóa ngoại', [
    para('Lược đồ gồm 49 bảng và 88 khóa ngoại, chia thành bảy nhóm theo nghiệp vụ. Quan hệ nhiều–nhiều như tài khoản–vai '
         'trò, vai trò–quyền, hãng–nhóm thiết bị được tách thành bảng nối.'),
    caption(CAP_TBL, 'Các nhóm bảng trong cơ sở dữ liệu'),
    table(['STT', 'Nhóm', 'Các bảng', 'Số bảng'],
          [[str(i), g, t, str(len(t.split(', ')))] for i, (g, t) in enumerate(GROUPS, 1)],
          [650, 2000, 4955, 900], center_cols=(0, 3)),
])
replace_para('Mã nghiệp vụ dạng TN/KH/BG/PX/PN', [
    para('Các quy ước kiểu dữ liệu dùng chung cho toàn bộ lược đồ được tóm tắt trong bảng sau.'),
    caption(CAP_TBL, 'Quy ước kiểu dữ liệu'),
    table(['Thành phần', 'Kiểu dữ liệu', 'Ghi chú'], [
        ['Mã nghiệp vụ (TN, KH, BG, PX, PN…)', 'NVARCHAR, khóa chính', 'Cấp từ bảng bộ đếm BoDemMa'],
        ['Bảng phát sinh nhiều dòng (tài khoản, thông báo, hội thoại, tin nhắn)', 'BIGINT IDENTITY', 'Tự tăng'],
        ['Thời điểm', 'DATETIME2(0)', 'Lưu theo giờ Việt Nam (+07:00); API trả về dạng UTC'],
        ['Số tiền', 'DECIMAL(18,2)', 'Không âm, kiểm tra bằng CHECK'],
        ['Chuỗi tiếng Việt', 'NVARCHAR', 'Lưu Unicode']],
        [3300, 2100, 3105]),
    para('Đoạn rút gọn dưới đây trích định nghĩa bảng PhieuTiepNhan, không thay thế toàn bộ script:'),
])
replace_para('Ngoài khóa chính và 88 khóa ngoại', [
    para('Bảng sau tổng hợp các loại khóa, chỉ mục và ràng buộc được khai báo trong script 01_schema.sql.'),
    caption(CAP_TBL, 'Khóa, chỉ mục và ràng buộc'),
    table(['Loại', 'Số lượng / ví dụ', 'Mục đích'], [
        ['Khóa chính', '49 (mỗi bảng một khóa)', 'Định danh duy nhất từng dòng'],
        ['Khóa ngoại', '88', 'Bảo đảm tham chiếu giữa các bảng'],
        ['Ràng buộc CHECK', '118', 'Miền giá trị trạng thái, phân loại bảo hành, mức SLA; số lượng và số tiền không âm'],
        ['Chỉ mục duy nhất có điều kiện', 'WHERE ConMo = 1, WHERE TrangThai = …',
         'Số điện thoại khách ACTIVE không trùng; mỗi thiết bị một phiếu đang mở; mỗi phiếu một báo giá chưa bị từ chối '
         'và một phiếu xuất PENDING; mỗi yêu cầu trực tuyến chỉ sinh một phiếu'],
        ['Chỉ mục phụ', 'IX_PhieuTiepNhan_TrangThai (TrangThaiXuLy, HanSLA)', 'Hàng đợi điều phối và báo cáo SLA']],
        [2200, 2700, 3605]),
])
replace_para('Mã OTP chỉ lưu dạng băm', [
    para('Mã xác thực được lưu theo cách sau; việc chấp nhận token hoặc OTP luôn kiểm tra hạn tại API.'),
    caption(CAP_TBL, 'Lưu trữ mã xác thực'),
    table(['Dữ liệu', 'Bảng', 'Cách lưu', 'Hiệu lực và xử lý'], [
        ['Mã OTP', 'MaXacThucOTP', 'Chỉ lưu dạng băm', 'Hiệu lực 5 phút, gửi lại sau 60 giây, đếm số lần nhập sai'],
        ['Refresh token', 'RefreshToken', 'Băm SHA-256, xoay vòng theo họ token',
         'Job nền xóa token hết hạn quá 7 ngày lúc 02:00 giờ Việt Nam']],
        [1500, 1800, 2400, 2805]),
])
replace_para('Nghiệp vụ ghi nhiều bảng chạy qua TransactionRunner', [
    para('Các cơ chế giữ dữ liệu nhất quán khi nhiều người dùng cùng thao tác được trình bày trong bảng sau.'),
    caption(CAP_TBL, 'Cơ chế transaction và chống ghi đè'),
    table(['Cơ chế', 'Cách thực hiện'], [
        ['Transaction', 'TransactionRunner với mức cô lập READ COMMITTED; thao tác lồng tham gia transaction bên ngoài'],
        ['Cập nhật có điều kiện', 'Bảng phiếu có cột PhienBan; câu UPDATE kèm điều kiện phiên bản để phát hiện ghi đè'],
        ['Thực hiện lại', 'Khi xung đột phiên bản, deadlock hoặc hết thời gian chờ khóa (10 giây): thực hiện lại tối đa 3 lần'],
        ['Trừ tồn kho', 'UPDATE TonKhoTheoKe … WHERE SoLuong >= số lượng xuất, trong cùng transaction với chứng từ nên '
                        'không xuất vượt tồn'],
        ['Truy cập dữ liệu', 'EF Core ánh xạ 7 bảng định danh (TaiKhoan, TaiKhoan_VaiTro, RefreshToken, KhachHang, ThietBi, '
                             'HoaDon_PhieuThu, NhanVien); các module khác dùng T-SQL tham số hóa trên cùng connection và '
                             'transaction']],
        [2300, 6205]),
])
replace_para('Ví dụ truy vấn doanh thu có phí theo tháng', [
    para('Các báo cáo được tính ngay tại SQL Server bằng GROUP BY và SUM(CASE …), ứng dụng ghép thêm điều kiện ngày và '
         'trạm theo bộ lọc.'),
    caption(CAP_TBL, 'Các báo cáo tổng hợp tại SQL Server'),
    table(['Báo cáo', 'Cách tính'], [
        ['Doanh thu có phí theo tháng', 'Lọc phiếu thu LoaiThu = \'CHARGED\', gom theo tháng của NgayThu, đếm số phiếu và '
                                        'cộng tiền'],
        ['Số phiếu theo trạng thái', 'GROUP BY TrangThaiXuLy trên PhieuTiepNhan'],
        ['Tỷ lệ bảo hành, hiệu suất kỹ thuật viên', 'GROUP BY theo phân loại bảo hành và kỹ thuật viên, SUM(CASE …)'],
        ['Sửa lặp, đối soát báo giá, phân bố SLA', 'GROUP BY theo thiết bị, báo giá và mức SLA']],
        [3300, 5205]),
    para('Ví dụ truy vấn doanh thu có phí theo tháng (trích ReportService):'),
])

# 3.7.4: five black-and-white ERD pictures
erd_cap = next(p for p in paras('BCTenhinh') if 'ERD' in text(p))
erd_fig = figure_before(erd_cap)
ERDS = [('erd_1_taikhoan', 'Sơ đồ ERD nhóm tài khoản, phân quyền và nhân viên'),
        ('erd_2_thongbao', 'Sơ đồ ERD nhóm thông báo và chat'),
        ('erd_3_tiepnhan', 'Sơ đồ ERD nhóm danh mục, thiết bị và tiếp nhận'),
        ('erd_4_kythuat', 'Sơ đồ ERD nhóm kỹ thuật, báo giá, thanh toán và bàn giao'),
        ('erd_5_kho', 'Sơ đồ ERD nhóm kho vật tư')]
new = [para('Do lược đồ có 49 bảng, sơ đồ ERD được chia theo nhóm nghiệp vụ. Mỗi thực thể ghi tên bảng, khóa chính (gạch '
            'chân) và một số thuộc tính chính; các cột khóa ngoại không ghi trong thực thể mà thể hiện bằng đường quan hệ '
            'theo ký hiệu chân chim (một – nhiều). Một bảng có thể xuất hiện ở nhiều nhóm để thấy liên kết giữa các nhóm. Năm bảng '
            'không có quan hệ khóa ngoại (DanhMucNhan, ChuyenTrangThaiHopLe, BoDemMa, NhatKyThaoTac, MaXacThucOTP) không '
            'vẽ trong ERD; cấu trúc của chúng có ở mục 3.7.5.')]
for fname, title in ERDS:
    f = strip_bookmarks(copy.deepcopy(FIG_TPL))
    put_picture(f, os.path.join(ERD, fname + '.png'))
    new += [f, caption(CAP_FIG, title)]
for el in new:
    erd_fig.addprevious(el)
erd_fig.getparent().remove(erd_fig)
erd_cap.getparent().remove(erd_cap)

# unique drawing ids after copying figures
for k, dp in enumerate(body.iter(qn('wp:docPr')), 1):
    dp.set('id', str(k))

doc.save(out)
print('saved', out, replaced)
