// Basic black-and-white ERD per subject area: entity name, primary key (underlined) and a few own attributes;
// foreign-key columns are not listed, relationships use crow's-foot ends (one -> many).
// Usage: node erd.mjs schema.json outdir [maxAttrs]
import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';

const [, , schemaPath, outDir, maxArg] = process.argv;
const MAX = Number(maxArg ?? 3);
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const SKIP = /^(PhienBan|ConMo|NgayTao|NgayCapNhat|NguoiTao|NguoiCapNhat|GhiChu.*|TrangThaiXoa|.*Hash|.*Token)$/;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ROLES = {
  MaNguoiLap: 'Lap', MaNguoiDuyet: 'Duyet', MaKTVNhan: 'KTV nhan',
  MaNguoiYeuCau: 'Yeu cau', MaThuKhoXuLy: 'Thu kho', MaKTVLap: 'KTV lap',
  MaNVQuanLyDuyet: 'QL duyet', MaTaiKhoanKhach: 'KH', MaTaiKhoanNV: 'NV',
  MaNVPhanCong: 'Phan cong', MaKTV: 'KTV',
};

const GROUPS = {
  erd_1_taikhoan: ['TaiKhoan', 'VaiTro', 'QuyenHan', 'TaiKhoan_VaiTro', 'VaiTro_QuyenHan', 'RefreshToken',
    'NhanVien', 'TramDichVu', 'KhachHang'],
  erd_2_thongbao: ['ThongBao', 'ThongBao_DaDoc', 'ThietBiNhanThongBao', 'HoiThoai', 'TinNhan', 'TaiKhoan', 'VaiTro',
    'PhieuTiepNhan'],
  erd_3_tiepnhan: ['NhomThietBi', 'LoaiThietBi', 'HangSanXuat', 'HangSanXuat_NhomThietBi', 'SanPham', 'ChinhSachBaoHanh',
    'ThietBi', 'KhachHang', 'YeuCauBaoHanh', 'PhieuTiepNhan', 'LichSuTrangThai_ThietBi', 'GhiChuPhieu',
    'TramDichVu', 'NhanVien'],
  erd_4_kythuat: ['PhieuTiepNhan', 'PhanCong', 'LichSuPhanCong', 'PhieuKiemTra',
    'PhieuSuaChua', 'KetQuaSuaChua', 'NhanVien'],
  erd_5_kho: ['LinhKien', 'NhaCungCap', 'TonKhoTheoKe', 'PhieuNhapKho', 'ChiTietNhapKho', 'PhieuXuatKho', 'ChiTietXuatKho',
    'PhieuDieuChuyen', 'PhieuBaoGia', 'PhieuTiepNhan', 'NhanVien', 'NhomThietBi'],
  erd_6_kiemke: ['NhanVien', 'PhieuKiemKe', 'ChiTietKiemKe', 'LinhKien'],
  erd_7_thongke_danhgia: ['TaiKhoan', 'LuotTruyCap', 'TruyCapTheoNgay', 'PhieuBanGiao', 'DanhGiaCongKhai'],
  erd_8_baogia_bangiao: ['PhieuTiepNhan', 'PhieuKiemTra', 'PhieuBaoGia', 'ChiTietBaoGia',
    'BangGiaDichVu', 'LinhKien', 'HoaDon_PhieuThu', 'PhieuBanGiao', 'TepDinhKem', 'NhanVien', 'NhomThietBi'],
};

// tables without any foreign key in or out are listed in the report text instead of the pictures
const covered = new Set(Object.values(GROUPS).flat());
const missing = Object.keys(schema).filter(n => !covered.has(n));
const connected = new Set(Object.entries(schema).flatMap(([name, t]) => t.fks.flatMap(([, parent]) => [name, parent])));
if (missing.some(n => connected.has(n))) throw new Error(`Missing related entities: ${missing.filter(n => connected.has(n))}`);
console.log('standalone tables documented in report:', missing.join(', '));

let render;
if (process.env.ARTIFACT_NODE_MODULES) {
  const require = createRequire(path.join(process.env.ARTIFACT_NODE_MODULES, 'package.json'));
  const gv = await require('@viz-js/viz').instance();
  render = dot => gv.renderString(dot, { format: 'svg', engine: 'dot' });
} else {
  const { Graphviz } = await import('@hpcc-js/wasm-graphviz');
  const gv = await Graphviz.load();
  render = dot => gv.layout(dot, 'svg', 'dot');
}
fs.mkdirSync(outDir, { recursive: true });
const audit = { tableCount: Object.keys(schema).length, foreignKeyCount: Object.values(schema).reduce((n, t) => n + t.fks.length, 0), standalone: missing, diagrams: [] };
const PAGE_W = 425, PAGE_H = 595; // 15 x 21 cm in pt
function build(names, rankdir, max) {
  const inGroup = new Set(names);
  let dot = `digraph ERD {
  graph [rankdir=${rankdir}, splines=polyline, nodesep=0.45, ranksep=0.55, bgcolor="white", pad=0.15];
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
  const edges = [];
  for (const child of names) {
    for (const [cols, parent] of schema[child].fks) {
      if (!inGroup.has(parent)) continue;
      const optional = cols.some(c => schema[child].nullable.includes(c));
      const unique = schema[child].unique.some(key => key.every(c => cols.includes(c)));
      const tail = optional ? 'teeodot' : 'teetee';
      const head = unique ? 'teeodot' : 'crowodot';
      const multiple = schema[child].fks.filter(([, p]) => p === parent).length > 1;
      const pad = inGroup.has('PhieuKiemKe') ? '  ' : '';
      const label = multiple ? `, label="${pad}${cols.map(c => ROLES[c] ?? c).join(', ')}${pad}", fontsize=12` : '';
      dot += `  "${parent}" -> "${child}" [arrowtail=${tail}, arrowhead=${head}${label}];\n`;
      edges.push({ child, parent, columns: cols, optionalParent: optional, uniqueChild: unique });
    }
  }
  dot += '}\n';
  const svg = render(dot);
  const [w, h] = svg.match(/width="([\d.]+)pt" height="([\d.]+)pt"/).slice(1).map(Number);
  const scale = Math.min(1, PAGE_W / w, PAGE_H / h);
  return { dot, svg, font: 12 * scale, rankdir, max, edges, widthPt: w, heightPt: h };
}

for (const [file, names] of Object.entries(GROUPS)) {
  const tries = [];
  for (const rankdir of ['TB', 'LR']) for (const max of [MAX, 0]) tries.push(build(names, rankdir, max));
  // prefer showing attributes when the text still prints at 7 pt or more
  tries.sort((a, b) => ((b.font >= 7) - (a.font >= 7)) || (b.max - a.max) || (b.font - a.font));
  const best = tries[0];
  fs.writeFileSync(path.join(outDir, file + '.dot'), best.dot);
  fs.writeFileSync(path.join(outDir, file + '.svg'), best.svg);
  console.log(file, names.length, 'entities', best.edges.length, 'relationships', best.rankdir, 'attrs', best.max,
    'font', best.font.toFixed(1));
  audit.diagrams.push({ file, entities: names, relationships: best.edges, printedFontPt: best.font, widthPt: best.widthPt, heightPt: best.heightPt });
}
const drawn = new Set(audit.diagrams.flatMap(d => d.relationships.map(e => `${e.child}:${e.columns.join(',')}:${e.parent}`)));
const omitted = Object.entries(schema).flatMap(([child, table]) => table.fks
  .filter(([cols, parent]) => !drawn.has(`${child}:${cols.join(',')}:${parent}`))
  .map(([cols, parent]) => `${child}.${cols.join(',')} -> ${parent}`));
if (omitted.length) throw new Error(`Foreign keys missing from diagrams: ${omitted.join('; ')}`);
audit.drawnForeignKeyCount = drawn.size;
fs.writeFileSync(path.join(outDir, 'coverage.json'), JSON.stringify(audit, null, 2) + '\n');
