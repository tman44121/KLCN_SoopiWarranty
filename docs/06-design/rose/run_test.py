"""Smoke test of the pipeline on function 3.4.1.1. Usage: python run_test.py <outdir>"""
import os, sys, time
import rosedraw as rd

OUT = sys.argv[1]
CAT = 'Test%d' % int(time.time())
specs = [
    {'type': 'act', 'name': 'AD_3_4_1_1', 'lanes': ['KhachHang', 'HeThong'],
     'nodes': {
         's': ('start', '', 0, 0, 0),
         'a1': ('act', 'Mo form gui yeu cau bao hanh', 0, 1, 0),
         'a2': ('act', 'Nhap thiet bi, mo ta loi, dinh kem anh/video', 0, 2, 0),
         'a3': ('act', 'Kiem tra du lieu va tep dinh kem', 1, 3, 0),
         'd1': ('dec', '', 1, 4, 0),
         'a4': ('act', 'Thong bao loi can sua', 0, 5, 0),
         'a5': ('act', 'Luu yeu cau trang thai PENDING_INTAKE', 1, 5, 0),
         'a6': ('act', 'Hien thi ma yeu cau YC-...', 1, 6, 0),
         'e': ('end', '', 1, 7, 0)},
     'edges': [('s', 'a1', ''), ('a1', 'a2', ''), ('a2', 'a3', ''), ('a3', 'd1', ''), ('d1', 'a4', '[Khong hop le]'),
               ('a4', 'a2', ''), ('d1', 'a5', '[Hop le]'), ('a5', 'a6', ''), ('a6', 'e', '')],
     'objects': [('YeuCauBaoHanh', 1, 5, 1, 'a5')]},
    {'type': 'seq', 'name': 'SD_3_4_1_1',
     'objs': [('KhachHang', 'Actor'), ('UI_GuiYeuCau', 'boundary'), ('PortalController', 'control'),
              ('TepDinhKem', 'entity'), ('YeuCauBaoHanh', 'entity')],
     'msgs': [(0, 1, 'Nhap thong tin thiet bi, mo ta loi, dinh kem tep', 0), (1, 1, 'KiemTraDuLieuNhap()', 0),
              (1, 2, 'TaoYeuCau(thongTin, tep)', 0), (2, 3, 'LuuTep(tep)', 0), (3, 2, 'maTep', 1),
              (2, 4, 'Them(yeuCau, PENDING_INTAKE)', 0), (4, 2, 'maYeuCau', 1), (2, 1, 'Ket qua thanh cong', 1),
              (1, 0, 'Hien thi ma yeu cau YC-...', 1)]},
]
for png in rd.produce(specs, CAT, OUT):
    print('ok', png)
