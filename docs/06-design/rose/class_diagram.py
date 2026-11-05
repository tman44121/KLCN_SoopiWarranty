"""Draw the analysis class diagram (report 3.4) in the open Rose model and capture it.

Usage: python class_diagram.py <workdir>
Adds category "LopPhanTich" with diagram "CD_LopPhanTich" to <workdir>/KLCN_SoopiWarranty.mdl (replacing an older one),
saves the model and writes <workdir>/CD_LopPhanTich.png.
"""
import os, sys, time
import rosedraw as rd
import capture

S = 'String'
CLASSES = {  # name: (column, row, [(attribute, type)])
    'ChinhSachBaoHanh': (0, 0, [('maChinhSach', S), ('tenChinhSach', S), ('soThangBaoHanh', 'int'), ('phamVi', S)]),
    'SanPham': (1, 0, [('maSP', S), ('tenSP', S), ('dongSanPham', S), ('hangSanXuat', S)]),
    'ThietBi': (2, 0, [('maThietBi', S), ('soSerialIMEI', S), ('ngayMua', 'Date'), ('ngayKichHoatBH', 'Date')]),
    'KhachHang': (3, 0, [('maKH', S), ('hoTen', S), ('soDienThoai', S), ('email', S)]),
    'YeuCauBaoHanh': (4, 0.5, [('maYeuCau', S), ('moTaLoi', S), ('ngayGui', 'Date'), ('trangThai', S)]),
    'PhanCong': (1, 1, [('maPhanCong', S), ('ngayPhanCong', 'Date'), ('mucDoUuTien', S)]),
    'PhieuTiepNhan': (2, 1, [('maPhieuTN', S), ('ngayTiepNhan', 'Date'), ('tinhTrangNgoaiQuan', S),
                             ('trangThaiXuLy', S), ('hanSLA', 'Date')]),
    'PhieuKiemTra': (3, 1, [('maPhieuKT', S), ('ngayKiemTra', 'Date'), ('ketQuaChanDoan', S), ('phanLoaiBaoHanh', S)]),
    'NhanVien': (0, 2, [('maNV', S), ('hoTen', S), ('vaiTro', S), ('soDienThoai', S)]),
    'PhieuSuaChua': (1, 2, [('maPhieuSC', S), ('ngayBatDau', 'Date'), ('trangThai', S)]),
    'PhieuBaoGia': (2, 2, [('maBaoGia', S), ('ngayLap', 'Date'), ('tongTien', 'Decimal'), ('trangThai', S)]),
    'PhieuBanGiao': (3, 2, [('maBanGiao', S), ('ngayBanGiao', 'Date'), ('nguoiNhan', S), ('loaiBanGiao', S)]),
    'HoaDon_PhieuThu': (4, 2, [('maPhieuThu', S), ('loaiThu', S), ('soTien', 'Decimal'), ('ngayThu', 'Date')]),
    'KetQuaSuaChua': (1, 3, [('maKetQua', S), ('noiDungSuaChua', S), ('ketQuaKCS', S)]),
    'ChiTietBaoGia': (2, 3, [('soThuTu', 'int'), ('noiDung', S), ('soLuong', 'int'), ('donGia', 'Decimal')]),
    'PhieuXuatKho': (3, 3, [('maPhieuXuat', S), ('ngayXuat', 'Date'), ('trangThai', S)]),
    'LinhKien': (2, 4, [('maLK', S), ('tenLK', S), ('donViTinh', S), ('donGia', 'Decimal')]),
    'PhieuNhapKho': (3, 4, [('maPhieuNhap', S), ('ngayNhap', 'Date'), ('trangThai', S)]),
    'NhaCungCap': (4, 4, [('maNCC', S), ('tenNCC', S), ('soDienThoai', S)]),
}
ASSOCS = [  # (class A, multiplicity at A, class B, multiplicity at B)
    ('ChinhSachBaoHanh', '1', 'SanPham', '0..n'),
    ('SanPham', '1', 'ThietBi', '0..n'),
    ('KhachHang', '1', 'ThietBi', '0..n'),
    ('KhachHang', '1', 'YeuCauBaoHanh', '0..n'),
    ('KhachHang', '1', 'PhieuTiepNhan', '0..n'),
    ('YeuCauBaoHanh', '0..1', 'PhieuTiepNhan', '0..1'),
    ('ThietBi', '1', 'PhieuTiepNhan', '0..n'),
    ('NhanVien', '1', 'PhieuTiepNhan', '0..n'),
    ('NhanVien', '1', 'PhanCong', '0..n'),
    ('PhieuTiepNhan', '1', 'PhanCong', '0..n'),
    ('PhieuTiepNhan', '1', 'PhieuKiemTra', '0..n'),
    ('PhieuTiepNhan', '1', 'PhieuSuaChua', '0..1'),
    ('PhieuTiepNhan', '1', 'PhieuBaoGia', '0..n'),
    ('PhieuTiepNhan', '1', 'PhieuBanGiao', '0..1'),
    ('PhieuTiepNhan', '1', 'HoaDon_PhieuThu', '0..n'),
    ('PhieuTiepNhan', '1', 'PhieuXuatKho', '0..n'),
    ('PhieuSuaChua', '1', 'KetQuaSuaChua', '0..n'),
    ('PhieuBaoGia', '1', 'ChiTietBaoGia', '1..n'),
    ('LinhKien', '0..1', 'ChiTietBaoGia', '0..n'),
    ('PhieuXuatKho', '0..n', 'LinhKien', '1..n'),
    ('PhieuNhapKho', '0..n', 'LinhKien', '1..n'),
    ('NhaCungCap', '1', 'PhieuNhapKho', '0..n'),
]
COL_W, ROW_H, X0, Y0 = 1000, 760, 450, 330
NAME, CAT = 'CD_LopPhanTich', 'LopPhanTich'


def main(workdir):
    r = rd.app()
    rd.settle(r, workdir)
    model_path = os.path.join(workdir, 'KLCN_SoopiWarranty.mdl')
    if (r.CurrentModel.GetFileName() or '').lower() != model_path.lower():
        r.OpenModel(model_path)
        time.sleep(1)
    m = r.CurrentModel
    root = m.RootCategory
    cats = root.Categories
    for i in range(cats.Count, 0, -1):
        if cats.GetAt(i).Name == CAT:
            root.DeleteCategory(cats.GetAt(i))
    cat = root.AddCategory(CAT)
    cls = {}
    for name, (_, _, attrs) in CLASSES.items():
        c = cat.AddClass(name)
        c.Stereotype = 'entity'
        for a, t in attrs:
            c.AddAttribute(a, t, '')
        cls[name] = c
    d = cat.AddClassDiagram(NAME)
    d.Activate()
    for c in cls.values():
        d.AddClass(c)
    views = {name: d.GetClassView(c) for name, c in cls.items()}
    for a, ma, b, mb in ASSOCS:
        assoc = cls[a].AddAssociation('', cls[b].GetQualifiedName())  # sequence diagrams reuse these class names
        for role, mult in ((assoc.GetCorrespondingRole(cls[a]), ma), (assoc.GetOtherRole(cls[a]), mb)):
            role.Cardinality = mult
            role.Navigable = False  # analysis level: plain association line
        d.AddAssociation(assoc)
    for name, (col, row, _) in CLASSES.items():
        v = views[name]
        v.StereotypeDisplay = 1  # label: <<entity>> text, keeps the attribute compartment
        v.Font.Size = 12  # the 19-class diagram is scaled down to the page width
        v.XPosition = X0 + col * COL_W
        v.YPosition = int(Y0 + row * ROW_H)
    d.AutosizeAll()
    m.Save()
    # the API zoom setter is ignored and Rose locks the open .mdl: write zoom 150 into a copy, open the copy,
    # then save it back over the model
    text = open(model_path, encoding='latin-1').read()
    k = text.index('(object ClassDiagram "%s"' % NAME)
    z = text.index('zoom', k)
    end = text.index('\n', z)
    text = text[:z] + 'zoom       \t%d' % rd.ZOOM + text[end:]
    zoomed = os.path.join(workdir, 'KLCN_SoopiWarranty_cd.mdl')
    open(zoomed, 'w', encoding='latin-1').write(text)
    r.OpenModel(zoomed)
    time.sleep(1)
    m = r.CurrentModel
    d = next(m.RootCategory.Categories.GetAt(i) for i in range(1, m.RootCategory.Categories.Count + 1)
             if m.RootCategory.Categories.GetAt(i).Name == CAT).ClassDiagrams.GetAt(1)
    with capture.OffscreenLarge():
        png = os.path.join(workdir, NAME + '.png')
        capture.capture_full(d, png)
        capture.crop_content(png)
    m.SaveAs(model_path)
    print('ok', png)


if __name__ == '__main__':
    main(sys.argv[1])
