// Basic black-and-white ERD per subject area: entity name, primary key (underlined) and a few own attributes;
// foreign-key columns are not listed, relationships use crow's-foot ends (one -> many).
// Usage: node erd.mjs schema.json outdir [maxAttrs]
import fs from 'fs';
import path from 'path';
import { Graphviz } from '@hpcc-js/wasm-graphviz';

const [, , schemaPath, outDir, maxArg] = process.argv;
const MAX = Number(maxArg ?? 3);
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const SKIP = /^(PhienBan|ConMo|NgayTao|NgayCapNhat|NguoiTao|NguoiCapNhat|GhiChu.*|TrangThaiXoa|.*Hash|.*Token)$/;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const GROUPS = {
  erd_1_taikhoan: ['TaiKhoan', 'VaiTro', 'QuyenHan', 'TaiKhoan_VaiTro', 'VaiTro_QuyenHan', 'RefreshToken',
    'NhanVien', 'TramDichVu', 'KhachHang'],
  erd_2_thongbao: ['ThongBao', 'ThongBao_DaDoc', 'ThietBiNhanThongBao', 'HoiThoai', 'TinNhan', 'TaiKhoan', 'VaiTro',
    'PhieuTiepNhan'],
  erd_3_tiepnhan: ['NhomThietBi', 'LoaiThietBi', 'HangSanXuat', 'HangSanXuat_NhomThietBi', 'SanPham', 'ChinhSachBaoHanh',
    'ThietBi', 'KhachHang', 'YeuCauBaoHanh', 'PhieuTiepNhan', 'LichSuTrangThai_ThietBi', 'GhiChuPhieu',
    'TramDichVu'],
  erd_4_kythuat: ['PhieuTiepNhan', 'PhanCong', 'LichSuPhanCong', 'PhieuKiemTra', 'PhieuBaoGia', 'ChiTietBaoGia',
    'BangGiaDichVu', 'LinhKien', 'PhieuSuaChua', 'KetQuaSuaChua', 'HoaDon_PhieuThu', 'PhieuBanGiao', 'TepDinhKem', 'NhanVien'],
  erd_5_kho: ['LinhKien', 'NhaCungCap', 'TonKhoTheoKe', 'PhieuNhapKho', 'ChiTietNhapKho', 'PhieuXuatKho', 'ChiTietXuatKho',
    'PhieuDieuChuyen', 'PhieuBaoGia', 'PhieuTiepNhan', 'NhanVien', 'NhomThietBi'],
};

// tables without any foreign key in or out are listed in the report text instead of the pictures
const covered = new Set(Object.values(GROUPS).flat());
const missing = Object.keys(schema).filter(n => !covered.has(n));
if (missing.length) console.log('not in any group:', missing.join(', '));

const gv = await Graphviz.load();
const PAGE_W = 425, PAGE_H = 595; // 15 x 21 cm in pt
function build(names, rankdir, max) {
  const inGroup = new Set(names);
  let dot = `digraph ERD {
  graph [rankdir=${rankdir}, splines=ortho, nodesep=0.45, ranksep=0.55, bgcolor="white", pad=0.15];
  node  [shape=plain, fontname="Times New Roman", fontsize=12, color="black", fontcolor="black"];
  edge  [color="black", dir=both, arrowsize=0.8, penwidth=1];
`;
  for (const name of names) {
    const t = schema[name];
    const fkCols = new Set(t.fks.flatMap(([cols]) => cols));
    const attrs = t.cols.map(([c]) => c).filter(c => !t.pk.includes(c) && !fkCols.has(c) && !SKIP.test(c));
    const rows = [
      `<TR><TD BORDER="1" SIDES="B"><B>${esc(name)}</B></TD></TR>`,
      ...t.pk.map(c => `<TR><TD ALIGN="LEFT"><U>${esc(c)}</U></TD></TR>`),
      ...attrs.slice(0, max).map(c => `<TR><TD ALIGN="LEFT">${esc(c)}</TD></TR>`),
      ...(attrs.length > max ? ['<TR><TD ALIGN="LEFT">…</TD></TR>'] : []),
    ];
    dot += `  "${name}" [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3">${rows.join('')}</TABLE>>];\n`;
  }
  const seen = new Set();
  for (const child of names) {
    for (const [, parent] of schema[child].fks) {
      if (parent === child || !inGroup.has(parent) || seen.has(parent + '>' + child)) continue;
      seen.add(parent + '>' + child);
      dot += `  "${parent}" -> "${child}" [arrowtail=teetee, arrowhead=crowodot];\n`;
    }
  }
  dot += '}\n';
  const svg = gv.layout(dot, 'svg', 'dot');
  const [w, h] = svg.match(/width="(\d+)pt" height="(\d+)pt"/).slice(1).map(Number);
  const scale = Math.min(1, PAGE_W / w, PAGE_H / h);
  return { dot, svg, font: 12 * scale, rankdir, max, edges: seen.size };
}

for (const [file, names] of Object.entries(GROUPS)) {
  const tries = [];
  for (const rankdir of ['TB', 'LR']) for (const max of [MAX, 0]) tries.push(build(names, rankdir, max));
  // prefer showing attributes when the text still prints at 7 pt or more
  tries.sort((a, b) => ((b.font >= 7) - (a.font >= 7)) || (b.max - a.max) || (b.font - a.font));
  const best = tries[0];
  fs.writeFileSync(path.join(outDir, file + '.dot'), best.dot);
  fs.writeFileSync(path.join(outDir, file + '.svg'), best.svg);
  console.log(file, names.length, 'entities', best.edges, 'relationships', best.rankdir, 'attrs', best.max,
    'font', best.font.toFixed(1));
}
