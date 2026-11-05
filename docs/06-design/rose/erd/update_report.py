"""Update the existing thesis ERD and schema descriptions while preserving other package parts.

Usage: python update_report.py source.docx output.docx diagram_directory
"""
from copy import deepcopy
from pathlib import Path
from zipfile import ZipFile
import json
import re
import sys
from lxml import etree as E

source, target, folder = map(Path, sys.argv[1:4])
assert source.resolve() != target.resolve(), 'Keep the source report unchanged'
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
N = {'w': W, 'r': R, 'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
     'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
     'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture'}
def q(n): return '{' + W + '}' + n
def text(p): return ''.join(p.xpath('.//w:t/text()', namespaces=N))
def style(p): return p.find('w:pPr/w:pStyle', N).get(q('val'), '') if p.find('w:pPr/w:pStyle', N) is not None else ''
def set_text(p, s):
    ts = p.findall('.//w:t', N)
    assert ts
    ts[0].text = s
    for t in ts[1:]: t.text = ''
    return p
def clean(p):
    for el in p.xpath('.//w:bookmarkStart|.//w:bookmarkEnd|.//w:lastRenderedPageBreak', namespaces=N):
        el.getparent().remove(el)
    for el in p.iter():
        for key in list(el.attrib):
            if key.endswith(('}paraId', '}textId', '}anchorId', '}editId')): del el.attrib[key]
    return p

with ZipFile(source) as z: files = {i.filename: z.read(i.filename) for i in z.infolist()}
root = E.fromstring(files['word/document.xml'])
rels = E.fromstring(files['word/_rels/document.xml.rels'])
body = root.find('w:body', N)
ps = root.findall('.//w:p', N)
def find(prefix, paragraph_style=None):
    return next(p for p in ps if text(p).startswith(prefix) and (paragraph_style is None or style(p) == paragraph_style))
def para(s):
    p = clean(deepcopy(find('Phụ lục này ghi nhận', 'BCNoidung')))
    return set_text(p, s)
def prop(p, name, val=None):
    pr = p.find('w:pPr', N)
    if pr is None: pr = E.SubElement(p, q('pPr'))
    el = pr.find(q(name))
    if el is None: el = E.SubElement(pr, q(name))
    if val is not None: el.set(q('val'), val)
    return el

def format_schema_table(table):
    widths = [2300, 1800, 1400, 3000]
    grid = table.find('w:tblGrid', N)
    for col, width in zip(grid, widths): col.set(q('w'), str(width))
    rows = table.findall('w:tr', N)
    for i, row in enumerate(rows):
        for height in row.findall('w:trPr/w:trHeight', N): height.getparent().remove(height)
        for j, (cell, width) in enumerate(zip(row.findall('w:tc', N), widths)):
            value = text(cell)
            tcpr = cell.find('w:tcPr', N)
            if tcpr is None: tcpr = E.SubElement(cell, q('tcPr'))
            tcw = tcpr.find(q('tcW'))
            if tcw is None: tcw = E.SubElement(tcpr, q('tcW'))
            tcw.set(q('w'), str(width)); tcw.set(q('type'), 'dxa')
            valign = tcpr.find(q('vAlign'))
            if valign is None: valign = E.SubElement(tcpr, q('vAlign'))
            valign.set(q('val'), 'center')
            for p in cell.findall('w:p', N): cell.remove(p)
            p = E.SubElement(cell, q('p'))
            pr = E.SubElement(p, q('pPr'))
            E.SubElement(pr, q('spacing'), {q('before'): '60', q('after'): '60', q('line'): '240', q('lineRule'): 'auto'})
            E.SubElement(pr, q('ind'), {q('firstLine'): '0', q('left'): '0', q('right'): '0'})
            E.SubElement(pr, q('jc'), {q('val'): 'center' if j == 2 else 'left'})
            if i == 0 or (len(rows) <= 3 and i < len(rows) - 1): E.SubElement(pr, q('keepNext'))
            r = E.SubElement(p, q('r')); rp = E.SubElement(r, q('rPr'))
            E.SubElement(rp, q('rFonts'), {q('ascii'): 'Times New Roman', q('hAnsi'): 'Times New Roman'})
            E.SubElement(rp, q('sz'), {q('val'): '24'})
            E.SubElement(rp, q('color'), {q('val'): '000000'})
            if i == 0: E.SubElement(rp, q('b'))
            E.SubElement(r, q('t')).text = value

schema = json.loads(Path(__file__).with_name('schema.json').read_text(encoding='utf-8'))
audit = json.loads((folder / 'coverage.json').read_text(encoding='utf-8'))
assert audit['tableCount'] == 55 and audit['foreignKeyCount'] == audit['drawnForeignKeyCount'] == 97
assert all(d['printedFontPt'] >= 7 for d in audit['diagrams']), 'Diagram text below 7 pt'
geometry = {d['file']: d for d in audit['diagrams']}

set_text(find('Phần mô hình và các bảng chi tiết dưới đây'),
    'Lược đồ hiện có 55 bảng, 55 khóa chính, 97 khóa ngoại và 126 ràng buộc CHECK được đối chiếu trực tiếp từ database/01_schema.sql ngày 03/11/2026. Bảng dưới chia lược đồ thành tám nhóm nghiệp vụ. Mô hình ERD ở mục 3.7.4 thể hiện đầy đủ các khóa ngoại qua tám hình theo nhóm; mục 3.7.5 bổ sung cấu trúc sáu bảng mới so với bản báo cáo trước, gồm kiểm kê, thống kê truy cập và đánh giá công khai.')
set_text(find('Sơ đồ ERD hiện minh họa nhóm 49 bảng'),
    'Mô hình ERD được cập nhật từ lược đồ 55 bảng, chia thành tám hình để giữ chữ đọc được khi in. Có 49 bảng tham gia quan hệ và đầy đủ 97 khóa ngoại được thể hiện; một bảng có thể lặp ở nhiều nhóm để làm rõ liên kết. Sáu bảng độc lập không có khóa ngoại vào hoặc ra gồm DanhMucNhan, ChuyenTrangThaiHopLe, BoDemMa, NhatKyThaoTac, MaXacThucOTP và MocThongKeTruyCap; cấu trúc của chúng có ở mục 3.7.5.')
legend = para('Khóa chính được gạch chân, khóa ngoại được thể hiện bằng đường quan hệ. Ký hiệu vòng tròn là tùy chọn, vạch là một, chân chim là nhiều; phía con là 0..1 nếu khóa ngoại đồng thời duy nhất và là 0..n nếu không duy nhất. Phía cha là 0..1 khi khóa ngoại nhận NULL, ngược lại là đúng một. Các chỉ mục duy nhất có điều kiện theo trạng thái không được diễn giải thành quan hệ một–một cho toàn bộ lịch sử. Nhãn Lap, Duyet, KTV, KH và NV phân biệt vai trò khi hai bảng có nhiều khóa ngoại liên kết.')
find('Mô hình ERD được cập nhật từ lược đồ 55 bảng').addnext(legend)
set_text(find('Các bảng dưới đây mô tả lược đồ'),
    'Các bảng dưới đây mô tả đủ 55 bảng trong database/01_schema.sql, gồm tên cột, kiểu dữ liệu, khả năng nhận NULL, khóa chính, khóa ngoại, ràng buộc duy nhất và giá trị mặc định. Các nhóm ràng buộc CHECK và chỉ mục được trình bày ở mục 3.7.2. Sáu bảng bổ sung nằm cuối mục này; các ràng buộc kiểm kê được giải thích thêm ở Phụ lục C.')
conclusion = find('- Về cơ sở dữ liệu: script tạo mới hiện có 55 bảng')
set_text(conclusion, text(conclusion).replace(
    'Mô hình 49 bảng cùng số lượng ràng buộc của bản báo cáo trước được giữ làm mốc đối chiếu tại mục 3.7; phần kiểm kê bổ sung ở Phụ lục C.',
    'Mô hình và cấu trúc đủ 55 bảng đã được cập nhật tại mục 3.7, gồm 97 khóa ngoại và 126 CHECK; phần kiểm kê được giải thích thêm ở Phụ lục C.'))
set_text(find('49 (mỗi bảng một khóa)'), '55 (mỗi bảng một khóa)')
set_text(next(p for p in ps if text(p) == '88'), '97')
set_text(next(p for p in ps if text(p) == '118'), '126')

# Update the grouped table inventory to total 55 without touching test-history counts.
inventory_table = next(t for t in body.findall('w:tbl', N) if 'Các bảng' in text(t) and 'Kho vật tư' in text(t))
rows = inventory_table.findall('w:tr', N)
stockrow = next(row for row in rows if 'Kho vật tư' in text(row))
cells = stockrow.findall('w:tc', N)
set_text(cells[2], text(cells[2]) + ', PhieuKiemKe, ChiTietKiemKe')
set_text(cells[3], '9')
newrow = clean(deepcopy(rows[-1]))
for c, s in zip(newrow.findall('w:tc', N), ['8', 'Thống kê truy cập và đánh giá công khai',
    'MocThongKeTruyCap, LuotTruyCap, TruyCapTheoNgay, DanhGiaCongKhai', '4']): set_text(c, s)
inventory_table.append(newrow)

caps = [find(f'Hình 3.{i}:', 'BCTenhinh') for i in range(45, 50)]
figs = [p.getprevious() for p in caps]
assert all(p.find('.//w:drawing', N) is not None for p in figs)
fig_template, cap_template = deepcopy(figs[-1]), deepcopy(caps[-1])
next_id = max(int(e.get('id')) for e in root.findall('.//wp:docPr', N)) + 1
replaced_media = []
def picture(fig, name, add=False, page=True):
    global next_id
    d = geometry[name]
    scale = min(1, 425 / d['widthPt'], 595 / d['heightPt'])
    cx, cy = (round(d[k] * scale * 12700) for k in ['widthPt', 'heightPt'])
    for el in fig.findall('.//wp:extent', N) + fig.findall('.//a:xfrm/a:ext', N):
        el.set('cx', str(cx)); el.set('cy', str(cy))
    prop(fig, 'keepNext')
    prop(fig, 'jc', 'center')
    if page: prop(fig, 'pageBreakBefore')
    blip = fig.find('.//a:blip', N)
    if add:
        rid = 'rIdERD' + str(next_id)
        media = 'media/' + name + '.png'
        E.SubElement(rels, '{' + rels.nsmap[None] + '}Relationship', Id=rid, Type=R + '/image', Target=media)
        blip.set('{' + R + '}embed', rid)
    else:
        rid = blip.get('{' + R + '}embed')
        media = next(r.get('Target') for r in rels if r.get('Id') == rid)
        replaced_media.append('word/' + media)
    files['word/' + media] = (folder / (name + '.png')).read_bytes()
    for el in fig.findall('.//wp:docPr', N) + fig.findall('.//pic:cNvPr', N):
        el.set('id', str(next_id)); el.set('name', name); el.set('descr', name)
        next_id += 1
    return fig
def caption(title, number):
    p = clean(deepcopy(cap_template))
    for t in p.findall('.//w:t', N):
        if t.text == '49': t.text = str(number)
        elif t.text and t.text.startswith(':'): t.text = ': ' + title
    return p
for i, fig in enumerate(figs, 1): picture(fig, list(geometry)[i - 1], page=i > 1)
for t in caps[3].findall('.//w:t', N):
    if t.text and t.text.startswith(':'): t.text = ': Sơ đồ ERD nhóm phân công, kiểm tra và sửa chữa'
def insert_picture_before(anchor, name, title, number):
    anchor.addprevious(picture(clean(deepcopy(fig_template)), name, add=True))
    anchor.addprevious(caption(title, number))
insert_picture_before(figs[4], 'erd_8_baogia_bangiao', 'Sơ đồ ERD nhóm báo giá, thanh toán và bàn giao', 49)
end_erd = find('3.7.5. Chi tiết các bảng', 'Heading3')
insert_picture_before(end_erd, 'erd_6_kiemke', 'Sơ đồ ERD nhóm kiểm kê kho', 51)
insert_picture_before(end_erd, 'erd_7_thongke_danhgia', 'Sơ đồ ERD nhóm thống kê truy cập và đánh giá công khai', 52)
note = para('Trong nhóm kiểm kê, PhieuKiemKe liên kết NhanVien theo hai vai trò riêng: MaNguoiLap bắt buộc và MaNguoiDuyet cho phép NULL khi phiếu chưa xử lý. ChiTietKiemKe tham chiếu PhieuKiemKe và LinhKien; cặp linh kiện và kệ chỉ được lặp một lần trong cùng phiếu. MaKe không có khóa ngoại tới TonKhoTheoKe trong DDL hiện tại, nên ERD không thêm quan hệ này. Quy tắc bảo vệ lượng đã giữ và điều chỉnh theo chênh lệch được xử lý ở service, không được biểu diễn thành khóa ngoại.')
end_erd.addprevious(note)

# Append the six missing table descriptions using the original report table style.
lastcap = find('Bảng 3.78:', 'BCTenbang')
table_template = next(t for t in body.findall('w:tbl', N) if 'Tên cột' in text(t) and 'Kiểu dữ liệu' in text(t) and 'Null' in text(t))
chapter4 = find('CHƯƠNG 4:', 'Heading1')
new_tables = ['PhieuKiemKe', 'ChiTietKiemKe', 'MocThongKeTruyCap', 'LuotTruyCap', 'TruyCapTheoNgay', 'DanhGiaCongKhai']
for i, name in enumerate(new_tables, 79):
    cap = clean(deepcopy(lastcap))
    for t in cap.findall('.//w:t', N):
        if t.text == '78': t.text = str(i)
        elif t.text and t.text.startswith(':'): t.text = ': Cấu trúc bảng ' + name
    prop(cap, 'keepNext')
    chapter4.addprevious(cap)
    table = clean(deepcopy(table_template))
    tr = table.findall('w:tr', N)
    header, row_template = deepcopy(tr[0]), deepcopy(tr[1])
    for row in tr: table.remove(row)
    trpr = header.find('w:trPr', N)
    if trpr is None: trpr = E.SubElement(header, q('trPr'))
    E.SubElement(trpr, q('tblHeader'))
    table.append(header)
    data = schema[name]
    for col, kind in data['cols']:
        notes = list(data['notes'].get(col, []))
        if col in data['pk']: notes.insert(0, 'PK')
        for keys, parent, pkeys in data['fks']:
            if col in keys: notes.append('FK → ' + parent + '(' + ', '.join(pkeys) + ')')
        if [col] in data['unique'] and [col] != data['pk']: notes.append('UNIQUE')
        row = deepcopy(row_template)
        for cell, s in zip(row.findall('w:tc', N), [col, kind.lower(), 'NULL' if col in data['nullable'] else 'NOT NULL', ', '.join(notes)]):
            set_text(cell, s)
        table.append(row)
    format_schema_table(table)
    chapter4.addprevious(table)
    multi = [key for key in data['unique'] if len(key) > 1 and key != data['pk']]
    if multi: chapter4.addprevious(para('Ràng buộc duy nhất của ' + name + ': ' + '; '.join('UNIQUE (' + ', '.join(key) + ')' for key in multi) + '.'))

files['word/document.xml'] = E.tostring(root, encoding='UTF-8', xml_declaration=True, standalone=True)
files['word/_rels/document.xml.rels'] = E.tostring(rels, encoding='UTF-8', xml_declaration=True, standalone=True)
with ZipFile(target, 'w') as z:
    for name, data in files.items(): z.writestr(name, data)
with ZipFile(source) as a, ZipFile(target) as b:
    assert not b.testzip()
    media = [n for n in a.namelist() if n.startswith('word/media/')]
    assert sum(a.read(n) == b.read(n) for n in media) == len(media) - 5
    assert len([n for n in b.namelist() if n.startswith('word/media/')]) == len(media) + 3
print(json.dumps({'report': str(target), 'diagrams': 8, 'tables': 55, 'foreignKeys': 97, 'checks': 126}, ensure_ascii=False))
