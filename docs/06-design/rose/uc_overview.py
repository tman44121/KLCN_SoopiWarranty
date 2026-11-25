"""Sơ đồ Use Case hệ thống tổng quát (Hình 3.1) vẽ lại trong Rose, thêm 3 use case mới ngày 08/11/2026.

python uc_overview.py <outdir>   (Rose phải đang mở; ROSETLB_DIR trỏ tới rosetlb.py; chạy tại docs/06-design/rose)
"""
import os, re, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rosedraw as rd, capture, rose_open

OUT = sys.argv[1]
NAME = 'UC_TongQuat'
FONT = 14          # cỡ chữ tác nhân và use case (mặc định 10)
LABEL_WIDTH = 470  # nhãn use case xuống dòng sớm hơn (mặc định 630) để xếp các use case sát nhau
# Rose vẽ ellipse ở góc trên trái khung nên không phóng ellipse; thu gọn lưới để hình in to hơn.
SCALE_X, SCALE_Y = 0.8, 0.87

# Lưới 700 x 600: mỗi tác nhân có cụm use case quanh mình, Đăng nhập ở giữa, bộ ba báo giá thành một hàng.
ACTORS = {  # name: (x, y)
    'NV_TiepNhan': (1050, 850), 'ThuKho': (3150, 850), 'KhachHang': (1050, 2050),
    'KyThuatVien': (3150, 2050), 'QuanTriVien': (1050, 3250), 'NV_QuanLy': (3150, 3250),
}
UC = {  # name: (x, y, [actors])
    'Dang nhap va Dang xuat': (2100, 2050, list(ACTORS)),
    'Tiep nhan thiet bi': (350, 250, ['NV_TiepNhan']),
    'Ban giao thiet bi': (1050, 250, ['NV_TiepNhan']),
    'Thanh toan': (1750, 250, ['NV_TiepNhan']),
    'Tra cuu thong tin bao hanh': (350, 1150, ['KhachHang']),
    'Tra cuu tinh trang sua chua': (1700, 1000, ['NV_TiepNhan', 'KhachHang']),
    'Dang ky yeu cau bao hanh': (350, 2050, ['KhachHang']),
    'Lap phieu nhap kho': (2450, 250, ['ThuKho']),
    'Xac nhan xuat kho va Cap nhat ton kho': (3150, 250, ['ThuKho']),
    'Tu dong tru ton kho': (3850, 250, []),
    'Kiem ke kho': (3850, 850, ['ThuKho']),
    'Ghi nhan ket qua kiem dinh KCS': (3150, 1450, ['KyThuatVien']),
    'Cap nhat trang thai sua chua': (2450, 1000, ['KyThuatVien']),
    'Lap phieu yeu cau xuat linh kien': (3850, 1450, ['KyThuatVien']),
    'Cap nhat ket qua chan doan loi': (3850, 2050, ['KyThuatVien']),
    'Phan loai dieu kien bao hanh': (3850, 2650, ['KyThuatVien']),
    'Xac nhan bao gia': (1050, 2650, ['KhachHang']),
    'Lap phieu bao gia sua chua': (2100, 2650, ['KyThuatVien']),
    'Phe duyet bao gia sua chua': (3150, 2650, ['NV_QuanLy']),
    'Phan cong xu ly thiet bi': (3850, 3250, ['NV_QuanLy']),
    'Xem phieu cho phan cong': (3150, 3850, ['NV_QuanLy']),
    'Cau hinh thoi gian va bao ve': (350, 3250, ['QuanTriVien']),
    'Quan ly Tai khoan va Phan quyen': (350, 3850, ['QuanTriVien']),
    'Quan ly danh muc': (1750, 3250, ['QuanTriVien']),
    'Xem bao cao thong ke': (1050, 3850, ['QuanTriVien']),
    'Dieu chinh gia danh muc': (1750, 3850, ['QuanTriVien']),
}
ACTORS = {k: (300 + int((x - 350) * SCALE_X), 250 + int((y - 250) * SCALE_Y)) for k, (x, y) in ACTORS.items()}
UC = {k: (300 + int((x - 350) * SCALE_X), 250 + int((y - 250) * SCALE_Y), w) for k, (x, y, w) in UC.items()}

DEPS = [  # (client, supplier, kind)
    ('Tiep nhan thiet bi', 'Tra cuu thong tin bao hanh', 'include'),
    ('Xac nhan xuat kho va Cap nhat ton kho', 'Tu dong tru ton kho', 'include'),
    ('Xac nhan bao gia', 'Lap phieu bao gia sua chua', 'extend'),
    ('Phe duyet bao gia sua chua', 'Lap phieu bao gia sua chua', 'extend'),
    ('Dieu chinh gia danh muc', 'Quan ly danh muc', 'extend'),
]


def build():
    r = rd.app()
    rd.settle(r, OUT)
    rose_open.open_model(r, os.path.join(os.path.dirname(rd.__file__), 'empty.mdl'))
    m = r.CurrentModel
    m.SaveAs(os.path.join(OUT, NAME + '_work.mdl'))
    uv = m.RootUseCaseCategory
    actors = {}
    for a in ACTORS:
        c = uv.AddClass(a); c.Stereotype = 'Actor'; actors[a] = c
    ucs, assocs = {}, []
    for name, (x, y, who) in UC.items():
        u = uv.AddUseCase(name); ucs[name] = u
        for a in who:
            assocs.append(u.AddAssociation('', a))
    d = uv.AddUseCaseDiagram(NAME); d.Activate(); time.sleep(0.5)
    def big(v, w=None, h=None):
        # Hình in khổ 15 cm: ellipse và chữ mặc định (cỡ 10) quá nhỏ.
        f = rd.rosetlb.IRoseView_Font(v.Font._oleobj_)
        f.Size = FONT
        if w:
            v.Width, v.Height = w, h
    for a, (x, y) in ACTORS.items():
        d.AddClass(actors[a]); v = d.GetViewFrom(actors[a]); v.XPosition = x; v.YPosition = y; big(v)
    for name, (x, y, _) in UC.items():
        d.AddUseCase(ucs[name]); v = d.GetViewFrom(ucs[name]); v.XPosition = x; v.YPosition = y; big(v)
    for asc in assocs:
        d.AddAssociation(asc)
    raw = os.path.join(OUT, NAME + '_raw.mdl')
    m.SaveAs(raw)
    return r, raw


def add_deps(src, dst):
    s = open(src, 'rb').read().decode('latin-1')
    nl = '\r\n' if '\r\n' in s else '\n'
    quid = dict(re.findall(r'\(object UseCase "([^"]+)"\s+quid\s+"([0-9A-F]+)"', s))
    views = dict(re.findall(r'\(object UseCaseView "Use Case View::([^"]+)" @(\d+)', s))
    mx = max(int(x) for x in re.findall(r'@(\d+)', s))
    view_text = []
    for k, (client, supplier, kind) in enumerate(DEPS):
        q = '7D0%09X' % (0x1000 + k)
        rel = (f'{nl}\t\tvisible_modules \t(list dependency_list{nl}\t\t    (object Dependency_Relationship{nl}'
               f'\t\t\tquid       \t"{q}"{nl}\t\t\tstereotype \t"{kind}"{nl}'
               f'\t\t\tsupplier   \t"Use Case View::{supplier}"{nl}\t\t\tquidu      \t"{quid[supplier]}"))')
        m = re.search(r'\(object UseCase "' + re.escape(client) + r'"\s+quid\s+"[0-9A-F]+"', s)
        s = s[:m.end()] + rel + s[m.end():]
        mx += 2
        # label in the middle of the arrow: beside a vertical arrow, above a horizontal one
        (x1, y1, _), (x2, y2, _) = UC[client], UC[supplier]
        lx, ly = (x1 + x2) // 2, (y1 + y2) // 2
        vertical = abs(x1 - x2) < abs(y1 - y2)
        if not vertical:
            ly -= 60
        lift = -170 if vertical else 40  # SegLabel height: khoảng cách từ nhãn tới đường, âm = phía phải (Rose bỏ qua location)
        view_text.append(
            f'{nl}\t\t    (object DependencyView "" @{mx - 1}{nl}\t\t\tstereotype \t(object SegLabel @{mx}{nl}'
            f'\t\t\t    Parent_View \t@{mx - 1}{nl}\t\t\t    location   \t({lx}, {ly}){nl}\t\t\t    anchor     \t10{nl}'
            f'\t\t\t    anchor_loc \t1{nl}\t\t\t    nlines     \t1{nl}\t\t\t    max_width  \t450{nl}\t\t\t    justify    \t0{nl}'
            f'\t\t\t    label      \t"<<{kind}>>"{nl}\t\t\t    pctDist    \t0.500000{nl}\t\t\t    height     \t{lift}{nl}'
            f'\t\t\t    orientation \t0){nl}\t\t\tline_color \t3342489{nl}\t\t\tquidu      \t"{q}"{nl}'
            f'\t\t\tclient     \t@{views[client]}{nl}\t\t\tsupplier   \t@{views[supplier]}{nl}\t\t\tline_style \t0)')
    s = re.sub(r'(\(object UseCaseView "Use Case View::[^"]+" @\d+[\s\S]*?max_width\s+)\d+', rf'\g<1>{LABEL_WIDTH}', s)
    s = re.sub(r'(\(object UseCaseView "Use Case View::[^"]+" @\d+[\s\S]*?nlines\s+)\d+', r'\g<1>3', s)  # tên dài không bị cắt
    # zoom 150 like the other diagrams; views appended at the end of the diagram's item list
    i = s.index(f'(object UseCaseDiagram "{NAME}"')
    j = s.index('(list diagram_item_list', i)
    depth, p = 0, j
    while True:
        c = s[p]
        if c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
            if depth == 0:
                break
        elif c == '"':
            p = s.index('"', p + 1)
        p += 1
    s = s[:p] + ''.join(view_text) + s[p:]
    s = re.sub(r'(\(object UseCaseDiagram "' + NAME + r'"[^\n]*\n(?:[^\n]*\n)*?\s*zoom\s+)\d+', r'\g<1>150', s, count=1)
    open(dst, 'wb').write(s.encode('latin-1'))


if __name__ == '__main__':
    r, raw = build()
    fixed = os.path.join(OUT, NAME + '.mdl')
    add_deps(raw, fixed)
    errs = rose_open.open_model(r, fixed)
    print('open errors:', errs)
    m = r.CurrentModel
    cds = m.RootUseCaseCategory.ClassDiagrams
    d = [cds.GetAt(i) for i in range(1, cds.Count + 1) if cds.GetAt(i).Name == NAME][0]
    png = os.path.join(OUT, NAME + '.png')
    with capture.OffscreenLarge():
        capture.capture_full(d, png)
        capture.crop_content(png)
    print('ok', png)
