"""Fill the "(Chưa chèn)" / "(Còn thiếu)" parts of the team's SuonWord.docx.

Usage: python fill_suon.py <SuonWord.docx> <out.docx> <KLCN source.docx> <rose png dir> <forms dir> <erd.png> <schema.sql>
Content comes from the KLCN report (texts, spec tables, screenshots, test results) and the Rose diagrams.
The App Mobile part (4.3) is left untouched: it belongs to another member.
Formatting copies SuonWord's own paragraphs: bold manual headings, unnumbered centred captions, TableGrid tables.
"""
import copy, io, os, re, sys
import docx
from docx.oxml.ns import qn
from docx.shared import Cm
from PIL import Image

import diagrams_klcn as dk

SUON, OUT, KLCN, ROSE, FORMS, ERD, SCHEMA = sys.argv[1:8]
d = docx.Document(SUON)
body = d.element.body
B = list(body.iterchildren())
src = docx.Document(KLCN)
S = list(src.element.body.iterchildren())


def txt(el):
    return ''.join(t.text or '' for t in el.iter(qn('w:t')))


def style(el):
    ps = el.find(qn('w:pPr') + '/' + qn('w:pStyle')) if el.tag == qn('w:p') else None
    return ps.get(qn('w:val')) if ps is not None else ''


def find(prefix, start=0, elements=B):
    for i in range(start, len(elements)):
        if elements[i].tag == qn('w:p') and txt(elements[i]).strip().startswith(prefix):
            return i
    raise KeyError(prefix)


BODY_START = find('CHƯƠNG 1: TỔNG QUAN', 100)  # skip cover/TOC

# ------------------------------------------------------------------ templates from SuonWord itself
T_HEAD = B[find('2.1.1. Dữ liệu đầu vào', BODY_START)]
T_BODY = B[find('Khách bắt đầu bằng mô tả', BODY_START)]
T_FIG = B[find('Sơ đồ kiến trúc tổng quát', BODY_START) - 1]
T_CAP = B[find('Sơ đồ kiến trúc tổng quát', BODY_START)]
T_TBL = B[find('Bảng các tác nhân', BODY_START) - 1]


def _set_text(p, text):
    runs = p.findall(qn('w:r'))
    keep = next((r for r in runs if r.find(qn('w:t')) is not None), runs[0] if runs else None)
    for r in runs:
        if r is not keep:
            p.remove(r)
    for c in list(p):
        if c.tag in (qn('w:bookmarkStart'), qn('w:bookmarkEnd'), qn('w:hyperlink')):
            p.remove(c)
    if keep is None:
        keep = p.makeelement(qn('w:r'), {}); p.append(keep)
    for c in list(keep):
        if c.tag != qn('w:rPr'):
            keep.remove(c)
    t = keep.makeelement(qn('w:t'), {})
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    t.text = text
    keep.append(t)
    return p


def head(text):
    return _set_text(copy.deepcopy(T_HEAD), text)


def para(text):
    return _set_text(copy.deepcopy(T_BODY), text)


def cap(text):
    return _set_text(copy.deepcopy(T_CAP), re.sub(r'^(Hình|Bảng) [\d.]+: ', '', text))


def fig_from_bytes(blob, width_cm=15.0, max_h_cm=19.0):
    w, h = Image.open(io.BytesIO(blob)).size
    width = width_cm if width_cm * h / w <= max_h_cm else max_h_cm * w / h
    tmp = d.add_paragraph()
    tmp.add_run().add_picture(io.BytesIO(blob), width=Cm(width))
    el = tmp._p
    el.getparent().remove(el)
    el.remove(el.find(qn('w:pPr'))) if el.find(qn('w:pPr')) is not None else None
    el.insert(0, copy.deepcopy(T_FIG.find(qn('w:pPr'))))
    return el


def fig(path, **kw):
    return fig_from_bytes(open(path, 'rb').read(), **kw)


def table(rows, widths, header=True):
    """rows: list of rows; each cell is a list of paragraph strings (or a str). widths in dxa."""
    tbl = copy.deepcopy(T_TBL)
    grid = tbl.find(qn('w:tblGrid'))
    for g in list(grid):
        grid.remove(g)
    for wdt in widths:
        g = grid.makeelement(qn('w:gridCol'), {qn('w:w'): str(wdt)}); grid.append(g)
    trs = tbl.findall(qn('w:tr'))
    tr_tpl, tc_tpl = trs[1], trs[1].findall(qn('w:tc'))[0]
    for tr in trs:
        tbl.remove(tr)
    for ri, row in enumerate(rows):
        tr = copy.deepcopy(tr_tpl)
        for tc in tr.findall(qn('w:tc')):
            tr.remove(tc)
        for ci, cell in enumerate(row):
            tc = copy.deepcopy(tc_tpl)
            tc.find(qn('w:tcPr') + '/' + qn('w:tcW')).set(qn('w:w'), str(widths[ci]))
            p_tpl = tc.find(qn('w:p'))
            for p in tc.findall(qn('w:p')):
                tc.remove(p)
            lines = cell if isinstance(cell, list) else [cell]
            for li, line in enumerate(lines or ['']):
                p = _set_text(copy.deepcopy(p_tpl), line)
                r = p.find(qn('w:r'))
                rpr = r.find(qn('w:rPr'))
                if rpr is None:
                    rpr = r.makeelement(qn('w:rPr'), {}); r.insert(0, rpr)
                for b in rpr.findall(qn('w:b')):
                    rpr.remove(b)
                if header and ri == 0:
                    rpr.insert(0, rpr.makeelement(qn('w:b'), {}))
                tc.append(p)
            tr.append(tc)
        tbl.append(tr)
    return tbl


def replace_at(placeholder_prefix, els, start=BODY_START):
    i = find(placeholder_prefix, start)
    anchor = B[i]
    for el in els:
        anchor.addprevious(el)
    body.remove(anchor)


def insert_after(prefix, els, start=BODY_START):
    anchor = B[find(prefix, start)]
    for el in els:
        anchor.addnext(el); anchor = el


# ------------------------------------------------------------------ source walker (KLCN report)
def src_index(prefix, sty=None, start=0):
    for i in range(start, len(S)):
        if S[i].tag == qn('w:p') and txt(S[i]).strip().startswith(prefix) and (sty is None or style(S[i]) == sty):
            return i
    raise KeyError(prefix)


SRC_BODY = next(i for i, el in enumerate(S) if style(el) == 'Heading1' and txt(el).strip() == 'MỞ ĐẦU')


def src_blob(el):
    blip = next(el.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}blip'), None)
    return src.part.related_parts[blip.get(qn('r:embed'))].blob if blip is not None else None


def cell_lines(tc):
    out = []
    for p in tc.findall(qn('w:p')):
        t = txt(p).strip()
        if t:
            numbered = p.find(qn('w:pPr') + '/' + qn('w:numPr')) is not None
            out.append(('- ' + t) if numbered and not re.match(r'^(\d+\.|-)', t) else t)
    return out


def src_table(el):
    return [[cell_lines(tc) for tc in tr.findall(qn('w:tc'))] for tr in el.findall(qn('w:tr'))]


def sentence_case(t):
    """'1. KẾT QUẢ ĐẠT ĐƯỢC' -> '1. Kết quả đạt được'; keeps text that is not all upper case."""
    if not t.isupper():
        return t
    m = re.match(r'^([\d.]+\s*)(.*)$', t)
    num, rest = (m.group(1), m.group(2)) if m else ('', t)
    return num + rest[:1] + rest[1:].lower()


def transfer(a, b, head_map=None, skip_heads=()):
    """Re-emit source elements S[a:b] in SuonWord format."""
    out, skipping = [], False
    for el in S[a:b]:
        st, t = style(el), txt(el).strip()
        if el.tag == qn('w:tbl'):
            if not skipping:
                rows = src_table(el)
                cols = max(len(r) for r in rows)
                widths = [8815] if cols == 1 else ([2200, 6615] if cols == 2 else [8815 // cols] * cols)
                out.append(table(rows, widths, header=cols > 1))
            continue
        if st.startswith('Heading'):
            skipping = any(t.startswith(s) for s in skip_heads)
            if not skipping:
                out.append(head(head_map(t) if head_map else t))
            continue
        if skipping or not t and src_blob(el) is None:
            continue
        if st == 'BCFigure':
            out.append(fig_from_bytes(src_blob(el)))
        elif st in ('BCTenhinh', 'BCTenbang'):
            out.append(cap(t))
        elif st == 'BCOpeningSection':
            out.append(head(sentence_case(t)))
        elif st == 'BCBullet1':
            out.append(para('- ' + t))
        else:
            out.append(para(t))
    return out


# ================================================================== 2.1.2 Biểu mẫu
a = src_index('1.2.3. Biểu mẫu', 'Heading3', SRC_BODY) + 1
b = src_index('1.2.4. Đánh giá hiện trạng', 'Heading3', SRC_BODY)
replace_at('(Còn thiếu bổ sung sau)', transfer(a, b))

# ================================================================== 2.3 + 2.4 (business processes)
spec23, spec24 = [], [para('Mỗi quy trình nghiệp vụ được mô hình hóa bằng sơ đồ hoạt động (có thừa tác viên và thực thể nghiệp vụ) và sơ đồ tuần tự, vẽ bằng Rational Rose.')]
for k, sd in enumerate(dk.CH2, 1):
    h = src_index('2.2.2.%d.' % k, 'Heading4', SRC_BODY)
    end = next(i for i in range(h + 1, len(S)) if style(S[i]).startswith('Heading'))
    name = re.sub(r'^2\.2\.2\.\d+\. Mô hình hóa quy trình nghiệp vụ ', '', txt(S[h]).strip())
    tcap = next(i for i in range(h, end) if style(S[i]) == 'BCTenbang')
    tbl = next(i for i in range(tcap, end) if S[i].tag == qn('w:tbl'))
    figi = next(i for i in range(tbl, end) if style(S[i]) == 'BCFigure')
    spec23 += [head('2.3.%d. Đặc tả use case nghiệp vụ %s' % (k, name)), table(src_table(S[tbl]), [8815], header=False),
               cap('Bảng đặc tả use case nghiệp vụ ' + name)]
    spec24 += [head('2.4.%d. Quy trình %s' % (k, name)),
               head('2.4.%d.1. Sơ đồ hoạt động' % k), fig_from_bytes(src_blob(S[figi])), cap('Sơ đồ hoạt động quy trình ' + name),
               head('2.4.%d.2. Sơ đồ tuần tự' % k), fig(os.path.join(ROSE, sd['name'] + '.png')), cap('Sơ đồ tuần tự quy trình ' + name)]
replace_at('(Còn thiếu)', spec23)
insert_after('2.4. Sơ đồ hoạt động và tuần tự', spec24)

# ================================================================== 3.3 system use cases (spec + activity + sequence)
UC_DIAGRAMS = {  # spec name in KLCN 2.3.2 -> diagram key
    'gửi yêu cầu bảo hành': '3.4.1.1', 'tra cứu thông tin': 'UC_TraCuuThongTin',
    'tra cứu tình trạng sửa chữa': 'UC_TraCuuTinhTrang', 'lập phiếu báo giá': '3.4.2.1', 'phê duyệt báo giá': '3.4.2.2',
    'xác nhận báo giá': '3.4.2.3', 'đăng nhập/ đăng xuất': 'UC_DangNhap', 'tiếp nhận': '3.4.1.2', 'bàn giao': '3.4.1.3',
    'thanh toán': '3.4.1.4', 'quản lý danh mục': '3.4.5.2', 'xem báo cáo thống kê': '3.4.5.3', 'lập phiếu nhập kho': '3.4.4.1',
    'xác nhận xuất kho & cập nhật tồn kho': '3.4.4.3', 'quản lý tài khoản & phân quyền': '3.4.5.1',
    'phân công xử lý thiết bị': '3.4.3.1', 'cập nhật kết quả chẩn đoán lỗi': '3.4.3.2',
    'phân loại điều kiện bảo hành': '3.4.3.3', 'lập phiếu yêu cầu xuất linh kiện': '3.4.4.2',
    'cập nhật trạng thái sửa chữa': '3.4.3.4', 'ghi nhận kết quả kiểm định KCS': '3.4.3.5'}
pairs = {k: (ad, sd) for k, _, ad, sd in dk.F + dk.EXTRA}
spec33, n = [], 0
for i in range(SRC_BODY, len(S)):
    t = txt(S[i]).strip()
    if S[i].tag == qn('w:p') and style(S[i]) == 'Heading4' and t.startswith('2.3.2.'):
        name = re.sub(r'^2\.3\.2\.\d+\. Đặc tả use case ', '', t)
        tbl = next(j for j in range(i, len(S)) if S[j].tag == qn('w:tbl'))
        n += 1
        ad, sd = pairs[UC_DIAGRAMS[name]]
        spec33 += [head('3.3.%d. Use case %s' % (n, name)),
                   head('3.3.%d.1. Đặc tả use case' % n), table(src_table(S[tbl]), [2200, 6615]), cap('Bảng đặc tả use case ' + name),
                   head('3.3.%d.2. Sơ đồ hoạt động' % n), fig(os.path.join(ROSE, ad['name'] + '.png')), cap('Sơ đồ hoạt động use case ' + name),
                   head('3.3.%d.3. Sơ đồ tuần tự' % n), fig(os.path.join(ROSE, sd['name'] + '.png')), cap('Sơ đồ tuần tự use case ' + name)]
if n == 0:  # KLCN report without numbered 2.3.2 headings: use the plain "Đặc tả UC hệ thống cho chức năng" lines
    for i in range(SRC_BODY, len(S)):
        t = txt(S[i]).strip()
        if S[i].tag == qn('w:p') and t.startswith('Đặc tả UC hệ thống cho chức năng '):
            name = t[len('Đặc tả UC hệ thống cho chức năng '):]
            tbl = next(j for j in range(i, len(S)) if S[j].tag == qn('w:tbl'))
            n += 1
            ad, sd = pairs[UC_DIAGRAMS[name]]
            spec33 += [head('3.3.%d. Use case %s' % (n, name)),
                       head('3.3.%d.1. Đặc tả use case' % n), table(src_table(S[tbl]), [2200, 6615]), cap('Bảng đặc tả use case ' + name),
                       head('3.3.%d.2. Sơ đồ hoạt động' % n), fig(os.path.join(ROSE, ad['name'] + '.png')), cap('Sơ đồ hoạt động use case ' + name),
                       head('3.3.%d.3. Sơ đồ tuần tự' % n), fig(os.path.join(ROSE, sd['name'] + '.png')), cap('Sơ đồ tuần tự use case ' + name)]
replace_at('(Chưa chèn)', spec33, find('3.3. Đặc tả cho những Use Case hệ thống', BODY_START))

# ================================================================== 3.4 class diagram + data model
cls_i = src_index('2.4. SƠ ĐỒ LỚP MỨC PHÂN TÍCH', 'Heading2', SRC_BODY)
cls_fig = next(i for i in range(cls_i, len(S)) if style(S[i]) == 'BCFigure')
p34 = find('Sơ đồ lớp mức phân tích ở đây', BODY_START)
_set_text(B[p34], 'Sơ đồ lớp mức phân tích xác định các thực thể cần lưu trữ và các phương thức nghiệp vụ dự kiến. PhieuTiepNhan là lớp trung tâm, liên kết KhachHang, ThietBi, PhanCong, PhieuKiemTra, PhieuBaoGia, PhieuSuaChua, KetQuaSuaChua, PhieuBanGiao và LichSuTrangThai_ThietBi; nhóm kho gồm LinhKien, NhaCungCap, PhieuNhapKho, PhieuXuatKho cùng các lớp chi tiết; NhanVien liên kết VaiTro và TaiKhoan để phân quyền.')
replace_at('(Chưa chèn)', [fig_from_bytes(src_blob(S[cls_fig])), cap('Sơ đồ lớp mức phân tích'),
                            para('Mô hình dữ liệu vật lý tương ứng trên SQL Server được trình bày ở mục 3.7.')], p34)

# ================================================================== 3.7 database design
a = src_index('3.2. THIẾT KẾ CSDL', 'Heading2', SRC_BODY) + 1
b = src_index('3.2.4. Sơ đồ lớp mức thiết kế', 'Heading3', SRC_BODY)
db = transfer(a, b, head_map=lambda t: t.replace('3.2.', '3.7.', 1))


def parse_schema(path):
    text = re.sub(r'--[^\n]*', '', open(path, encoding='utf-8-sig').read())
    tables = []
    for m in re.finditer(r'CREATE TABLE\s+(?:dbo\.)?(\w+)\s*\((.*?)\n\s*\);', text, re.S):
        name, bodytxt = m.group(1), m.group(2)
        parts, depth, cur = [], 0, ''
        for ch in bodytxt:
            depth += (ch == '(') - (ch == ')')
            if ch == ',' and depth == 0:
                parts.append(cur.strip()); cur = ''
            else:
                cur += ch
        parts.append(cur.strip())
        cols, pk, fk, uq = [], set(), {}, set()
        for p in parts:
            u = p.upper()
            if u.startswith(('CONSTRAINT', 'FOREIGN', 'PRIMARY', 'INDEX', 'UNIQUE', 'CHECK')):
                mm = re.search(r'PRIMARY KEY\s*(?:CLUSTERED\s*)?\(([^)]*)\)', p, re.I)
                if mm:
                    pk |= {c.strip() for c in mm.group(1).split(',')}
                for f in re.finditer(r'FOREIGN KEY\s*\(([^)]*)\)\s*REFERENCES\s+(?:dbo\.)?(\w+)', p, re.I):
                    for c in f.group(1).split(','):
                        fk[c.strip()] = f.group(2)
                mm = re.search(r'UNIQUE\s*\(([^)]*)\)', p, re.I)
                if mm and u.startswith(('CONSTRAINT', 'UNIQUE')):
                    uq |= {c.strip() for c in mm.group(1).split(',')}
                continue
            cm = re.match(r'(\w+)\s+([\w]+(?:\s*\([^)]*\))?)(.*)', p, re.S)
            if not cm:
                continue
            cname, ctype, rest = cm.group(1), cm.group(2).replace(' ', ''), cm.group(3)
            if re.search(r'PRIMARY KEY', rest, re.I):
                pk.add(cname)
            f = re.search(r'REFERENCES\s+(?:dbo\.)?(\w+)', rest, re.I)
            if f:
                fk[cname] = f.group(1)
            notes = []
            if re.search(r'IDENTITY', rest, re.I):
                notes.append('IDENTITY')
            if re.search(r'\bUNIQUE\b', rest, re.I):
                uq.add(cname)
            dm = re.search(r'DEFAULT\s+(\S+)', rest, re.I)
            if dm:
                notes.append('mặc định ' + dm.group(1).rstrip(','))
            cols.append([cname, ctype.lower(), 'NOT NULL' if re.search(r'NOT NULL|PRIMARY KEY', rest, re.I) else 'NULL', notes])
        rows = [['Tên cột', 'Kiểu dữ liệu', 'Null', 'Ràng buộc']]
        for cname, ctype, null, notes in cols:
            cons = (['PK'] if cname in pk else []) + (['FK → ' + fk[cname]] if cname in fk else []) + (['UNIQUE'] if cname in uq else []) + notes
            rows.append([cname, ctype, null, ', '.join(cons)])
        tables.append((name, rows))
    return tables


db += [head('3.7.4. Mô hình dữ liệu (ERD)'), fig(ERD), cap('Sơ đồ ERD cơ sở dữ liệu SQL Server (TrungTamBaoHanhDB)'),
       head('3.7.5. Chi tiết các bảng'),
       para('Các bảng dưới đây được trích tự động từ script database/01_schema.sql của project, gồm tên cột, kiểu dữ liệu, cho phép NULL và ràng buộc (khóa chính, khóa ngoại, duy nhất, giá trị mặc định). Các ràng buộc CHECK và chỉ mục có điều kiện được mô tả ở mục 3.7.2.')]
for name, rows in parse_schema(SCHEMA):
    db += [table(rows, [2400, 1800, 1400, 3215]), cap('Bảng ' + name)]
replace_at('(Chưa chèn bao gồm', db, find('3.7. Thiết kế cơ sở dữ liệu', BODY_START))

# ================================================================== 4.2 Web screens
def section_range(start_prefix, end_prefix):
    return src_index(start_prefix, 'Heading3', SRC_BODY), src_index(end_prefix, 'Heading3', SRC_BODY)


def sections(pairs, base):
    """Re-emit KLCN 3.3.x subsections listed as (start_prefix, end_prefix), renumbered base.1, base.2 ..."""
    out = []
    for k, (sp, ep) in enumerate(pairs, 1):
        a, b = section_range(sp, ep)
        out += transfer(a, b, head_map=lambda t, k=k: re.sub(r'^3\.3\.\d+\.', '%s.%d.' % (base, k), t))
    return out


cust = sections([('3.3.1.', '3.3.2.'), ('3.3.2.', '3.3.3.'), ('3.3.3.', '3.3.4.'), ('3.3.4.', '3.3.5.'), ('3.3.5.', '3.3.6.'),
                 ('3.3.6.', '3.3.7.'), ('3.3.7.', '3.3.8.'), ('3.3.15.', '3.3.16.')], '4.2.1')
replace_at('(Chưa chèn ảnh và có giải thích)', cust, find('4.2.1. Giao diện chức năng cho Khách hàng', BODY_START))

staff = sections([('3.3.8.', '3.3.9.'), ('3.3.9.', '3.3.10.'), ('3.3.10.', '3.3.11.'), ('3.3.11.', '3.3.12.'),
                  ('3.3.12.', '3.3.13.'), ('3.3.13.', '3.3.14.'), ('3.3.14.', '3.3.15.')], '4.2.2')
replace_at('(Tương tự)', staff, find('4.2.2. Giao diện chức năng cho nội bộ', BODY_START))
# 4.3 App Mobile: intentionally untouched (another member's part)

# ================================================================== 5.1 tests, 5.2 evaluation
c5 = src_index('CHƯƠNG 5:', 'Heading1', SRC_BODY)
kl = src_index('KẾT LUẬN', 'Heading1', c5)
tests = transfer(c5 + 1, kl, head_map=lambda t: re.sub(r'^5\.(\d+)\. (.*)$', lambda m: '5.1.%s. %s' % (m.group(1), m.group(2)[0] + m.group(2)[1:].lower()), t),
                 skip_heads=('5.7.',))
replace_at('(Chưa chèn)', tests, find('5.1. Kiểm thử dự án', BODY_START))

eval_rows = [['Yêu cầu trong đề cương', 'Kết quả', 'Ghi chú'],
             ['Đăng nhập, đăng xuất, đổi mật khẩu, phân quyền người dùng', 'Đạt', 'JWT, 7 vai trò, kiểm quyền tại API'],
             ['Quản lý khách hàng, thiết bị, sản phẩm, thông tin bảo hành', 'Đạt', 'Hồ sơ khách, thiết bị Serial/IMEI, chính sách bảo hành'],
             ['Quản lý hãng sản xuất, dòng sản phẩm, thời hạn bảo hành', 'Đạt', 'Danh mục trên trang quản trị'],
             ['Quản lý phiếu tiếp nhận thiết bị', 'Đạt', 'Chặn hai phiếu đang mở cho cùng thiết bị'],
             ['Quản lý kỹ thuật viên và phân công xử lý', 'Đạt', 'Gợi ý theo chuyên môn, tải, SLA'],
             ['Quản lý kiểm tra, bảo hành, sửa chữa; cập nhật trạng thái', 'Đạt', '11 trạng thái phiếu, lịch sử trạng thái'],
             ['Quản lý linh kiện: nhập, xuất, tồn kho; tự động trừ tồn', 'Đạt', 'Giữ tồn khi yêu cầu, trừ khi thủ kho duyệt'],
             ['Kiểm kê kho', 'Chưa đạt', 'Chưa có chức năng kiểm kê định kỳ'],
             ['Báo giá ngoài bảo hành và cơ chế duyệt trước khi sửa', 'Đạt', 'Ba bước: lập – duyệt – khách xác nhận'],
             ['Gửi thông báo tiến độ và thời gian nhận thiết bị', 'Đạt một phần', 'Thông báo trong ứng dụng; push/SMS chỉ ghi log'],
             ['Quản lý bàn giao thiết bị', 'Đạt', 'Biên bản 5 tiêu chí, chữ ký, phiếu thu'],
             ['Tra cứu bảo hành theo mã thiết bị / Serial', 'Đạt', 'Tra cứu công khai bằng mã phiếu + SĐT'],
             ['Báo cáo, thống kê', 'Đạt', 'Doanh thu, trạng thái, SLA, hiệu suất KTV, xuất Excel'],
             ['Kiểm thử và triển khai', 'Đạt', 'Unit test, kiểm thử luồng qua giao diện, triển khai VPS']]
replace_at('(Chưa chèn)', [para('Bảng dưới đối chiếu các yêu cầu chức năng trên nền tảng Web và API trong đề cương với kết quả cài đặt của project. Phần ứng dụng Mobile do thành viên phụ trách trình bày riêng.'),
                            table(eval_rows, [4100, 1400, 3315]), cap('Bảng đánh giá kết quả so với đề cương')],
           find('5.2. Đánh giá dự án so với đề cương', BODY_START))

# ================================================================== conclusion + references
tl = src_index('TÀI LIỆU THAM KHẢO', 'Heading1', kl)
replace_at('(Chưa chèn)', transfer(kl + 1, tl), find('KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN', BODY_START))
refs = [para(txt(el).strip()) for el in S[tl + 1:] if el.tag == qn('w:p') and txt(el).strip().startswith('[')]
replace_at('(Chưa chèn)', refs, find('TÀI LIỆU THAM KHẢO', BODY_START))

d.save(OUT)
print('saved', OUT, 'use cases', n)
