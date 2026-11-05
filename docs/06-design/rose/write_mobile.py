"""Write report section 4.3 (customer mobile app) from the Warrant_App code and real screenshots.

Usage: python write_mobile.py <in.docx> <out.docx> <paired screenshot dir>
Screenshots: Flutter Web build of Warrant_App in a 390 x 844 phone viewport, Real mode, customer kh.tuan, against the test API
on TrungTamBaoHanhDB_KiemThu (30/10/2026). Run Word afterwards to refresh fields.
"""
import copy, os, sys
import docx
from docx.oxml.ns import qn
from PIL import Image

src, out, FIG = sys.argv[1:4]
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


def first(sid, prefix):
    return next(p for p in paras(sid) if text(p).strip().startswith(prefix))


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


H3 = copy.deepcopy(first('Heading3', '4.3.1.'))
H4 = copy.deepcopy(first('Heading4', '4.2.1.1.'))
BODY = copy.deepcopy(first('BCNoidung', 'Ứng dụng Mobile nằm trong kho mã nguồn riêng'))
BULLET = copy.deepcopy(paras('BCBullet1')[0])
CAP_FIG = copy.deepcopy(first('BCTenhinh', 'Hình 4.2:'))
# chapter 4 has no other table: start from chapter 5's first caption (SEQ reset) and change the chapter prefix
CAP_TBL = copy.deepcopy(first('BCTenbang', 'Bảng 5.1:'))
for t in CAP_TBL.iter(W('t')):
    if (t.text or '').startswith('Bảng 5.'):
        t.text = t.text.replace('Bảng 5.', 'Bảng 4.', 1)
fig_cap = first('BCTenhinh', 'Hình 4.2:')
FIG_P = fig_cap.getprevious()
while FIG_P.find('.//' + qn('a:blip')) is None:
    FIG_P = FIG_P.getprevious()
FIG_P = copy.deepcopy(FIG_P)
SPEC = copy.deepcopy(next(t for t in body.iter(W('tbl')) if text(t).startswith('Tên Use Case')))
CELL_P = copy.deepcopy(SPEC.find(W('tr') + '/' + W('tc') + '/' + W('p')))


def p(value, tpl=BODY):
    return set_text(strip_bookmarks(copy.deepcopy(tpl)), value)


def caption(tpl, value):
    c = strip_bookmarks(copy.deepcopy(tpl))
    last = [r for r in c.findall(W('r')) if r.find(W('t')) is not None][-1]
    last.find(W('t')).text = ': ' + value
    return c


def figure(name, title, width_cm):
    f = strip_bookmarks(copy.deepcopy(FIG_P))
    png = os.path.join(FIG, name + '.png')
    rid, _ = doc.part.get_or_add_image(png)
    f.find('.//' + qn('a:blip')).set(qn('r:embed'), rid)
    w, h = Image.open(png).size
    cx = int(width_cm * 360000)
    for e in (f.find('.//' + qn('wp:extent')), f.find('.//' + qn('a:ext'))):
        e.set('cx', str(cx))
        e.set('cy', str(int(cx * h / w)))
    return [f, caption(CAP_FIG, title)]


def cell(value, width, bold=False):
    tc = SPEC.makeelement(W('tc'), {})
    tcpr = tc.makeelement(W('tcPr'), {})
    tcpr.append(tcpr.makeelement(W('tcW'), {W('w'): str(width), W('type'): 'dxa'}))
    tc.append(tcpr)
    para = set_text(strip_bookmarks(copy.deepcopy(CELL_P)), value)
    rpr = para.find(W('r') + '/' + W('rPr'))
    b = rpr.find(W('b'))
    if not bold and b is not None:
        rpr.remove(b)
    tc.append(para)
    return tc


def table(header, rows, widths):
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
        for v, w in zip(row, widths):
            tr.append(cell(v, w, bold=(ri == 0)))
        t.append(tr)
    return t


TWO, ONE = 13.0, 6.3  # two phone screens side by side / a single screen
new_432 = [
    p('Mục này trình bày giao diện ứng dụng di động dành cho khách hàng. Ảnh được chụp từ bản chạy thật của ứng dụng ở chế '
      'độ kết nối API (Real), khung màn hình điện thoại 390 × 844, đăng nhập bằng tài khoản khách hàng mẫu và dữ liệu của cơ '
      'sở dữ liệu kiểm thử.'),
    p('4.3.2.1. Đăng nhập, đăng ký và lấy lại mật khẩu', H4),
    p('Màn hình đăng nhập nhận số điện thoại hoặc tên đăng nhập cùng mật khẩu; chỉ tài khoản khách hàng được đăng nhập trên '
      'ứng dụng. Sau khi đăng nhập, access token và refresh token được lưu trong bộ nhớ an toàn của thiết bị; khi token hết hạn, '
      'ứng dụng tự làm mới phiên một lần rồi gọi lại yêu cầu, nên khách không phải đăng nhập lại liên tục.'),
    p('Khách chưa có tài khoản có thể tự đăng ký. Số điện thoại dùng làm tên đăng nhập, email dùng để nhận mã OTP gồm 6 chữ số; '
      'mật khẩu tối thiểu 10 ký tự, có cả chữ và số. Khi quên mật khẩu, khách nhập email đã đăng ký, nhận mã OTP qua email, '
      'xác minh mã rồi đặt mật khẩu mới.'),
    *figure('m1_dangnhap', 'Màn hình đăng nhập và đăng ký tài khoản trên ứng dụng di động', TWO),
    *figure('m2_quenmk', 'Màn hình lấy lại mật khẩu bằng mã OTP gửi qua email', ONE),
    p('4.3.2.2. Trang chủ và thông báo', H4),
    p('Trang chủ chào khách theo tên và tổng hợp số phiếu đang xử lý, số phiếu chờ khách xác nhận và số phiếu chờ nhận máy. '
      'Danh sách tiến độ sửa chữa hiển thị từng thiết bị cùng trạng thái hiện tại; phiếu có báo giá đang chờ được nhắc riêng '
      'kèm nút Xem báo giá. Hai lối tắt Gửi yêu cầu bảo hành và Thiết bị của tôi đặt ngay dưới lời chào.'),
    p('Biểu tượng chuông và tab Thông báo hiển thị số thông báo chưa đọc. Mỗi thông báo cho biết sự kiện của phiếu (đã tiếp '
      'nhận, có báo giá chờ xác nhận, đã sửa xong, đã bàn giao) và thời điểm; chạm vào thông báo sẽ mở đúng phiếu liên quan và '
      'đánh dấu đã đọc.'),
    *figure('m3_trangchu', 'Trang chủ và hộp thư thông báo của khách hàng', TWO),
    p('4.3.2.3. Thiết bị của tôi', H4),
    p('Tab Thiết bị liệt kê các thiết bị đã gắn với hồ sơ khách hàng, kèm số IMEI hoặc serial và tình trạng bảo hành: còn hạn '
      '(có ngày hết hạn) hoặc chưa kích hoạt. Màn hình chi tiết cho biết thương hiệu, mã định danh, ngày kích hoạt và có nút '
      'Gửi yêu cầu cho thiết bị này để lập yêu cầu mà không phải nhập lại thông tin máy.'),
    *figure('m4_thietbi', 'Danh sách thiết bị và chi tiết bảo hành của một thiết bị', TWO),
    p('4.3.2.4. Gửi yêu cầu bảo hành, sửa chữa', H4),
    p('Thông tin liên hệ được lấy từ hồ sơ tài khoản. Khách chọn thiết bị có sẵn hoặc nhập thiết bị mới; với thiết bị mới, kiểu '
      'định danh (IMEI hay serial) đi theo loại thiết bị trong danh mục. Khách mô tả lỗi, chọn trạm dịch vụ và thời gian mong '
      'muốn mang máy tới, có thể đính kèm tối đa 3 ảnh hoặc video (ảnh JPEG/PNG/WebP đến 5 MiB, video MP4 đến 30 MiB). '
      'Yêu cầu được gửi một lần; nếu mạng lỗi, ứng dụng không tự gửi lại để tránh tạo yêu cầu trùng.'),
    p('Sau khi gửi, yêu cầu có mã YC và trạng thái Chờ tiếp nhận. Đây chưa phải phiếu sửa chữa: phiếu tiếp nhận (mã TN) chỉ '
      'được lập khi trung tâm thực sự nhận thiết bị.'),
    *figure('m5_yeucau', 'Màn hình gửi yêu cầu bảo hành từ một thiết bị đã có', TWO),
    p('4.3.2.5. Theo dõi phiếu và xác nhận báo giá', H4),
    p('Tab Yêu cầu là lịch sử bảo hành và sửa chữa, lọc theo nhóm Tất cả, Đang xử lý, Chờ linh kiện hoặc xác nhận, Chờ nhận '
      'máy và Hoàn thành. Mỗi phiếu hiển thị mã, thiết bị, serial/IMEI, thanh tiến độ và bước hiện tại. Màn hình chi tiết phiếu '
      'trình bày báo giá chờ khách quyết định với từng dòng linh kiện, tiền công, thuế VAT và tổng tiền.'),
    p('Phần Tiến độ xử lý gồm sáu bước: Tiếp nhận, Chẩn đoán, Chờ linh kiện, Đang sửa, QC và Sẵn sàng nhận máy, lấy từ trạng '
      'thái do máy chủ trả về. Khi khách chọn Đồng ý hoặc Từ chối, ứng dụng hỏi lại trước khi gửi; quyết định chỉ được ghi '
      'một lần cho mỗi báo giá và trạng thái tiếp theo do máy chủ trả về.'),
    *figure('m6_phieu', 'Lịch sử phiếu và chi tiết phiếu có báo giá chờ khách quyết định', TWO),
    *figure('m7_baogia', 'Tiến độ xử lý của phiếu và hộp thoại xác nhận đồng ý báo giá', TWO),
    p('4.3.2.6. Tra cứu tiến độ và quản lý tài khoản', H4),
    p('Màn hình Tra cứu bảo hành cho phép nhập mã yêu cầu (YC-…) hoặc mã phiếu tiếp nhận (TN-…) của chính khách để mở nhanh '
      'chi tiết. Tab Tài khoản hiển thị họ tên, số điện thoại, email và cho phép đăng xuất. Các mục chỉnh sửa thông tin cá '
      'nhân, chi tiết liên hệ, cài đặt thông báo, đổi mật khẩu và xác thực hai yếu tố đã có trên giao diện nhưng chưa hỗ trợ '
      'thao tác trong bản hiện tại; khi chạm vào, ứng dụng báo chưa hỗ trợ. Khách đổi thông tin liên hệ qua trung tâm hoặc '
      'cổng khách hàng trên Web.'),
    *figure('m8_tracuu', 'Màn hình tra cứu tiến độ và trang tài khoản của khách hàng', TWO),
]

tech = [
    p('Các thành phần chính của ứng dụng được tóm tắt trong bảng sau.'),
    caption(CAP_TBL, 'Công nghệ sử dụng trong ứng dụng di động'),
    table(['Thành phần', 'Sử dụng'], [
        ['Flutter / Dart', 'Giao diện đa nền tảng (Android, iOS, Web)'],
        ['Provider / ChangeNotifier', 'Quản lý trạng thái theo mô hình ViewModel'],
        ['GoRouter', 'Điều hướng, chuyển về màn hình đăng nhập khi chưa có phiên'],
        ['Dio', 'Gọi API, gắn Bearer token, làm mới phiên và xử lý lỗi mạng'],
        ['flutter_secure_storage', 'Lưu access token, refresh token trên thiết bị'],
        ['shared_preferences', 'Lưu chế độ Mock/Real và Base URL khi phát triển'],
        ['file_picker', 'Chọn ảnh, video đính kèm yêu cầu bảo hành'],
    ], [3000, 5505]),
]

# 4.3.1: keep its paragraphs, append the technology table; 4.3.2: replace the bullet list by the screen descriptions
h431 = first('Heading3', '4.3.1.')
h432 = first('Heading3', '4.3.2.')
set_text(h432, '4.3.2. Giao diện chức năng cho khách hàng')
for el in tech:
    h432.addprevious(el)
kids = list(body.iterchildren())
end = next(el for el in kids[kids.index(h432) + 1:] if el.tag == W('p') and style(el) in ('Heading1', 'Heading2', 'Heading3'))
for el in kids[kids.index(h432) + 1:kids.index(end)]:
    body.remove(el)
for el in new_432:
    end.addprevious(el)

for k, dp in enumerate(body.iter(qn('wp:docPr')), 1):
    dp.set('id', str(k))
doc.save(out)
print('saved', out)
