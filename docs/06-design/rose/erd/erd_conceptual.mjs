// ERD mức khái niệm (không khóa ngoại, không bảng trung gian, quan hệ có tên) và mô hình dữ liệu quan hệ (có PK, FK, bảng trung gian).
// node erd2.mjs schema.json outdir
import fs from 'fs';
import path from 'path';
import { Graphviz } from '@hpcc-js/wasm-graphviz';

const [, , schemaPath, outDir] = process.argv;
const S = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const gv = await Graphviz.load();
const SKIP = /^(PhienBan|ConMo|NgayTao|NgayCapNhat|NguoiTao|NguoiCapNhat|GhiChu.*|TrangThaiXoa|.*Hash|.*Token)$/;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const GROUPS = {
  erd_1_taikhoan: ['TaiKhoan', 'VaiTro', 'QuyenHan', 'TaiKhoan_VaiTro', 'VaiTro_QuyenHan', 'RefreshToken', 'NhanVien', 'TramDichVu', 'KhachHang'],
  erd_2_thongbao: ['ThongBao', 'ThongBao_DaDoc', 'ThietBiNhanThongBao', 'HoiThoai', 'TinNhan', 'TaiKhoan', 'VaiTro', 'PhieuTiepNhan'],
  erd_3a_danhmuc: ['NhomThietBi', 'LoaiThietBi', 'HangSanXuat', 'HangSanXuat_NhomThietBi', 'SanPham', 'ChinhSachBaoHanh', 'ThietBi', 'KhachHang', 'YeuCauBaoHanh'],
  erd_3b_tiepnhan: ['ThietBi', 'KhachHang', 'YeuCauBaoHanh', 'PhieuTiepNhan', 'LichSuTrangThai_ThietBi', 'GhiChuPhieu', 'TramDichVu',
    'NhanVien', 'ChinhSachBaoHanh'],
  erd_4a_phancong: ['PhieuTiepNhan', 'PhanCong', 'LichSuPhanCong', 'NhanVien'],
  erd_4b_suachua: ['PhieuTiepNhan', 'PhanCong', 'PhieuKiemTra', 'PhieuSuaChua', 'KetQuaSuaChua', 'NhanVien'],
  erd_5a_nhapkho: ['LinhKien', 'NhaCungCap', 'NhomThietBi', 'TonKhoTheoKe', 'PhieuNhapKho', 'ChiTietNhapKho', 'PhieuDieuChuyen', 'NhanVien'],
  erd_5b_xuatkho: ['LinhKien', 'PhieuXuatKho', 'ChiTietXuatKho', 'PhieuBaoGia', 'PhieuTiepNhan', 'NhanVien'],
  erd_6_kiemke: ['NhanVien', 'PhieuKiemKe', 'ChiTietKiemKe', 'LinhKien'],
  erd_7_thongke_danhgia: ['TaiKhoan', 'LuotTruyCap', 'TruyCapTheoNgay', 'PhieuBanGiao', 'DanhGiaCongKhai'],
  erd_8a_baogia: ['PhieuTiepNhan', 'PhieuKiemTra', 'PhieuBaoGia', 'ChiTietBaoGia', 'BangGiaDichVu', 'LinhKien', 'NhanVien', 'NhomThietBi'],
  erd_8b_bangiao: ['PhieuTiepNhan', 'PhieuBaoGia', 'HoaDon_PhieuThu', 'PhieuBanGiao', 'TepDinhKem', 'NhanVien'],
};
// tên quan hệ, đọc từ bảng cha sang bảng con (khóa: Bảng con.Cột FK)
const VERB = {
  'NhanVien.MaTaiKhoan': 'dùng', 'NhanVien.MaTram': 'làm việc tại', 'KhachHang.MaTaiKhoan': 'dùng', 'KhachHang.GopVaoMaKH': 'gộp vào',
  'RefreshToken.MaTaiKhoan': 'cấp phiên', 'LoaiThietBi.MaNhom': 'gồm', 'SanPham.MaHang': 'sản xuất', 'SanPham.MaLoai': 'phân loại',
  'ChinhSachBaoHanh.MaSP': 'áp dụng cho', 'ChinhSachBaoHanh.MaHang': 'ban hành', 'BangGiaDichVu.MaNhom': 'định giá',
  'ThietBi.MaSP': 'thuộc mẫu', 'ThietBi.MaKH': 'sở hữu', 'YeuCauBaoHanh.MaKH': 'gửi', 'YeuCauBaoHanh.MaNhom': 'thuộc nhóm',
  'YeuCauBaoHanh.MaLoai': 'thuộc loại', 'YeuCauBaoHanh.MaTramMongMuon': 'chọn trạm', 'YeuCauBaoHanh.MaNVXuLy': 'xử lý',
  'YeuCauBaoHanh.MaPhieuTN': 'chuyển thành', 'PhieuTiepNhan.MaTram': 'tiếp nhận tại', 'PhieuTiepNhan.MaYeuCau': 'lập từ',
  'PhieuTiepNhan.MaKH': 'gửi máy', 'PhieuTiepNhan.MaThietBi': 'được nhận', 'PhieuTiepNhan.MaNVTiepNhan': 'lập',
  'PhieuTiepNhan.BH_MaChinhSach': 'áp dụng', 'LichSuTrangThai_ThietBi.MaPhieuTN': 'ghi lịch sử', 'GhiChuPhieu.MaPhieuTN': 'có',
  'GhiChuPhieu.NguoiViet': 'viết', 'PhanCong.MaPhieuTN': 'được giao', 'PhanCong.MaNVQuanLy': 'phân công', 'PhanCong.MaKTV': 'nhận việc',
  'LichSuPhanCong.MaPhieuTN': 'lưu vết', 'LichSuPhanCong.MaKTVCu': 'KTV cũ', 'LichSuPhanCong.MaKTVMoi': 'KTV mới',
  'LichSuPhanCong.MaNVThucHien': 'thực hiện', 'PhieuKiemTra.MaPhieuTN': 'được kiểm tra', 'PhieuKiemTra.MaKTV': 'kiểm tra',
  'PhieuBaoGia.MaPhieuTN': 'được báo giá', 'PhieuBaoGia.MaPhieuKT': 'căn cứ', 'PhieuBaoGia.MaKTVLap': 'lập',
  'PhieuBaoGia.MaNVQuanLyDuyet': 'duyệt', 'PhieuBaoGia.MaDichVu': 'tính công', 'LinhKien.MaNCC': 'cung cấp', 'LinhKien.MaNhom': 'dùng cho',
  'TonKhoTheoKe.MaLK': 'tồn tại kệ', 'ChiTietBaoGia.MaBaoGia': 'gồm', 'ChiTietBaoGia.MaLK': 'được báo giá',
  'PhieuNhapKho.MaNCC': 'giao hàng', 'PhieuNhapKho.MaNguoiLap': 'lập', 'PhieuNhapKho.MaNguoiDuyet': 'duyệt',
  'ChiTietNhapKho.MaPhieuNhap': 'gồm', 'ChiTietNhapKho.MaLK': 'được nhập', 'PhieuXuatKho.MaPhieuTN': 'xuất cho',
  'PhieuXuatKho.MaBaoGia': 'theo', 'PhieuXuatKho.MaKTVNhan': 'nhận', 'PhieuXuatKho.MaNguoiYeuCau': 'yêu cầu',
  'PhieuXuatKho.MaThuKhoXuLy': 'xử lý', 'ChiTietXuatKho.MaPhieuXuat': 'gồm', 'ChiTietXuatKho.MaLK': 'được xuất',
  'PhieuDieuChuyen.MaLK': 'điều chuyển', 'PhieuDieuChuyen.MaNguoiLap': 'lập', 'PhieuDieuChuyen.MaNguoiDuyet': 'duyệt',
  'PhieuKiemKe.MaNguoiLap': 'lập', 'PhieuKiemKe.MaNguoiDuyet': 'duyệt', 'ChiTietKiemKe.MaPhieuKK': 'gồm', 'ChiTietKiemKe.MaLK': 'được kiểm',
  'PhieuSuaChua.MaPhieuTN': 'được sửa', 'PhieuSuaChua.MaPhanCong': 'theo', 'PhieuSuaChua.MaKTV': 'sửa',
  'KetQuaSuaChua.MaPhieuSC': 'ghi kết quả', 'KetQuaSuaChua.MaKTV': 'ghi', 'HoaDon_PhieuThu.MaPhieuTN': 'thu tiền',
  'HoaDon_PhieuThu.MaBaoGia': 'thanh toán', 'HoaDon_PhieuThu.MaThuNgan': 'lập', 'PhieuBanGiao.MaPhieuTN': 'được bàn giao',
  'PhieuBanGiao.MaNVBanGiao': 'bàn giao', 'PhieuBanGiao.MaTepChuKy': 'lưu chữ ký', 'ThongBao.MaVaiTroNhan': 'nhận',
  'ThongBao.MaTaiKhoanNhan': 'nhận', 'ThietBiNhanThongBao.MaTaiKhoan': 'đăng ký', 'HoiThoai.MaPhieuTN': 'trao đổi về',
  'HoiThoai.MaTaiKhoanKhach': 'khách', 'HoiThoai.MaTaiKhoanNV': 'nhân viên', 'TinNhan.MaHoiThoai': 'gồm', 'TinNhan.MaNguoiGui': 'gửi',
  'LuotTruyCap.MaTaiKhoan': 'truy cập', 'TruyCapTheoNgay.MaTaiKhoan': 'thống kê', 'DanhGiaCongKhai.MaPhieuTN': 'được đánh giá',
  'DanhGiaCongKhai.MaNguoiDuyet': 'duyệt',
};
const M2N = { TaiKhoan_VaiTro: 'được gán', VaiTro_QuyenHan: 'gồm', HangSanXuat_NhomThietBi: 'sản xuất', ThongBao_DaDoc: 'đã đọc' };
const fkCols = t => new Set(S[t].fks.flatMap(([c]) => c));
const own = t => S[t].cols.map(([c]) => c).filter(c => !S[t].pk.includes(c) && !fkCols(t).has(c) && !SKIP.test(c));
const PAGE_W = 425, PAGE_H = 650;

function box(name, rows) {
  return `  "${name}" [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3"><TR><TD BORDER="1" SIDES="B" BGCOLOR="#EEEEEE"><B>${esc(name)}</B></TD></TR>${rows.map(r => `<TR><TD ALIGN="LEFT">${r}</TD></TR>`).join('')}</TABLE>>];\n`;
}
function ends(child, cols) {
  const optional = cols.some(c => S[child].nullable.includes(c));
  const unique = S[child].unique.some(k => k.every(c => cols.includes(c))) || S[child].pk.every(c => cols.includes(c));
  return `arrowtail=${optional ? 'teeodot' : 'teetee'}, arrowhead=${unique ? 'teeodot' : 'crowodot'}`;
}

function build(file, names, kind, rankdir, max, font, sep = [0.5, 0.7]) {
  let dot = `digraph ERD {
  graph [rankdir=${rankdir}, splines=true, nodesep=${sep[0]}, ranksep=${sep[1]}, bgcolor="white", pad=0.15, fontname="Times New Roman"];
  node  [shape=plain, fontname="Times New Roman", fontsize=${font}];
  edge  [color="black", dir=both, arrowsize=0.9, penwidth=1, fontname="Times New Roman", fontsize=${font - 1}];
`;
  const inG = new Set(names);
  const ents = kind === 'erd' ? names.filter(n => !M2N[n]) : names;
  for (const n of ents) {
    const t = S[n], fk = fkCols(n);
    let rows;
    if (kind === 'erd') {
      const a = own(n);
      rows = [...t.pk.filter(c => !fk.has(c)).map(c => `<U>${esc(c)}</U>`), ...a.slice(0, max).map(esc), ...(a.length > max ? ['…'] : [])];
    } else {
      const a = own(n);
      const fks = t.cols.map(([c]) => c).filter(c => fk.has(c) && !t.pk.includes(c));
      rows = [...t.pk.map(c => `<U>${esc(c)}</U>${fk.has(c) ? '&#160;(FK)' : ''}`), ...fks.map(c => `<I>${esc(c)}</I>&#160;(FK)`),
        ...a.slice(0, max).map(esc), ...(a.length > max ? ['…'] : [])];
    }
    dot += box(n, rows);
  }
  let rels = 0;
  for (const child of names) {
    if (kind === 'erd' && M2N[child]) {
      const [[, p1], [, p2]] = S[child].fks;
      if (inG.has(p1) && inG.has(p2)) {
        dot += `  "${p1}" -> "${p2}" [arrowtail=crowodot, arrowhead=crowodot, label=" ${M2N[child]} "];\n`; rels++;
      }
      continue;
    }
    for (const [cols, parent] of S[child].fks) {
      if (!inG.has(parent)) continue;
      const key = `${child}.${cols[0]}`;
      const label = kind === 'erd' ? ` ${VERB[key] ?? 'có'} ` : (S[child].fks.filter(([, p]) => p === parent).length > 1 ? ` ${cols.join(', ')} ` : '');
      if (kind === 'erd' && !VERB[key]) console.warn('no verb', key);
      dot += `  "${parent}" -> "${child}" [${ends(child, cols)}${label ? `, label="${label}"` : ''}];\n`; rels++;
    }
  }
  dot += '}\n';
  const svg = gv.layout(dot, 'svg', 'dot');
  const [w, h] = svg.match(/width="([\d.]+)pt" height="([\d.]+)pt"/).slice(1).map(Number);
  const scale = Math.min(1, PAGE_W / w, PAGE_H / h);
  return { dot, svg, w, h, printed: font * scale, rankdir, max, rels };
}

fs.mkdirSync(outDir, { recursive: true });
const report = [];
for (const [file, names] of Object.entries(GROUPS)) {
  for (const kind of ['erd', 'qh']) {
    const tries = [];
    for (const rankdir of ['TB', 'LR']) for (const max of (kind === 'erd' ? [4, 3, 2] : [2, 1, 0])) for (const sep of [[0.5, 0.7], [0.3, 0.45]]) tries.push(build(file, names, kind, rankdir, max, 14, sep));
    // ưu tiên chữ in ra từ 9 pt trở lên, rồi nhiều thuộc tính, rồi chữ to
    tries.sort((a, b) => ((b.printed >= 9) - (a.printed >= 9)) || (a.printed >= 9 ? b.max - a.max : 0) || (b.printed - a.printed));
    const best = tries[0];
    const out = path.join(outDir, `${kind}_${file.slice(4)}`);
    fs.writeFileSync(out + '.dot', best.dot);
    fs.writeFileSync(out + '.svg', best.svg);
    report.push(`${path.basename(out)} ${best.rankdir} attrs=${best.max} rels=${best.rels} printed=${best.printed.toFixed(1)}pt size=${best.w.toFixed(0)}x${best.h.toFixed(0)}`);
  }
}
console.log(report.join('\n'));
