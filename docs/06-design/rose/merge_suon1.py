"""Merge the team's newer SuonWord (1) content into the KLCN report that already follows the HUIT template.

Usage: python merge_suon1.py <klcn.docx> <SuonWord (1).docx> <out.docx>

What it does (headings, captions and tables keep the KLCN/template styles):
- cover: template wording, SuonWord date and team-leader mark;
- new front section "BẢNG PHÂN CÔNG CÔNG VIỆC 12 TUẦN" (table from SuonWord);
- "MỞ ĐẦU" split into the template's 1. GIỚI THIỆU / 2. MỤC TIÊU ĐỀ TÀI / 3. ĐỐI TƯỢNG VÀ PHẠM VI ĐỀ TÀI;
- paragraphs the team rewrote in chapters 1-2;
- 2.1.2: the 11 collected forms from SuonWord;
- 2.3: business use-case specs in SuonWord's two-column layout, names aligned in 2.3/2.4;
- Heading 2 text upper-cased (template: level 1.1 is bold, 14pt, upper case).
Run Word afterwards to refresh SEQ fields, the table of contents and the lists of figures/tables.
"""
import copy, difflib, io, re, sys
import docx
from docx.oxml.ns import qn

cur_path, s1_path, out_path = sys.argv[1:4]
cur = docx.Document(cur_path)
s1 = docx.Document(s1_path)
body = cur.element.body


def text(el):
    return ''.join(t.text or '' for t in el.iter(qn('w:t')))


def style(el):
    s = el.find(qn('w:pPr') + '/' + qn('w:pStyle'))
    return s.get(qn('w:val')) if s is not None else ''


def children():
    return list(body.iterchildren())


def find(pred, start=0):
    for i, el in enumerate(children()):
        if i >= start and el.tag == qn('w:p') and pred(el):
            return el
    raise LookupError('paragraph not found')


def heading(sid, prefix):
    return find(lambda p: style(p) == sid and text(p).strip().startswith(prefix))


def strip_bookmarks(el):
    for b in list(el.iter(qn('w:bookmarkStart'))) + list(el.iter(qn('w:bookmarkEnd'))):
        b.getparent().remove(b)
    return el


def set_text(p, value):
    """Replace a paragraph's runs by one run carrying the first run's formatting."""
    runs = p.findall(qn('w:r'))
    rpr = runs[0].find(qn('w:rPr')) if runs else None
    for r in runs:
        p.remove(r)
    r = p.makeelement(qn('w:r'), {})
    if rpr is not None:
        r.append(copy.deepcopy(rpr))
    t = r.makeelement(qn('w:t'), {})
    t.text = value
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    r.append(t)
    ends = p.findall(qn('w:bookmarkEnd'))
    if ends:
        ends[0].addprevious(r)
    else:
        p.append(r)
    return p


def clone(p, value=None):
    c = strip_bookmarks(copy.deepcopy(p))
    return set_text(c, value) if value is not None else c


def insert_after(anchor, els):
    for el in els:
        anchor.addnext(el)
        anchor = el
    return anchor


# ---------- templates taken before anything changes ----------
H1 = heading('Heading1', 'BẢNG ĐÁNH GIÁ ĐÓNG GÓP')
H2 = heading('Heading2', '1.1.')
BODY = find(lambda p: style(p) == 'BCNoidung' and text(p).startswith('Một khách hàng khi gửi'))
CAP_TBL = find(lambda p: style(p) == 'BCTenbang' and text(p).startswith('Bảng 2:'))
SPEC = next(t for t in body.iter(qn('w:tbl')) if text(t).startswith('Tên Use Case'))
SPEC = copy.deepcopy(SPEC)

# ---------- cover ----------
for p in children()[:40]:
    if p.tag != qn('w:p'):
        continue
    t = text(p)
    if t.startswith('1. 2001230460') and '(NT)' not in t:
        set_text(p, t.rstrip() + ' (NT)')
    elif t.upper().startswith('TP. HỒ CHÍ MINH,'):
        set_text(p, 'TP. HỒ CHÍ MINH, tháng 10 năm 2026')


# ---------- 12-week assignment table ----------
def cell_para_template():
    tc = SPEC.find(qn('w:tr') + '/' + qn('w:tc'))
    return tc.find(qn('w:p'))


def fill_cell(tc, lines, bold=None, center=False):
    tpl = cell_para_template()
    for p in tc.findall(qn('w:p')):
        tc.remove(p)
    for line in lines or ['']:
        p = clone(tpl, line)
        r = p.find(qn('w:r'))
        rpr = r.find(qn('w:rPr'))
        b = rpr.find(qn('w:b'))
        if not bold and b is not None:
            rpr.remove(b)
        if center:
            p.find(qn('w:pPr') + '/' + qn('w:jc')).set(qn('w:val'), 'center')
        tc.append(p)


def restyle_table(tbl, widths, header_fill='EDF0F4'):
    old = tbl.find(qn('w:tblPr'))
    tbl.replace(old, copy.deepcopy(SPEC.find(qn('w:tblPr'))))
    grid = tbl.find(qn('w:tblGrid'))
    for g, w in zip(grid.findall(qn('w:gridCol')), widths):
        g.set(qn('w:w'), str(w))
    for ri, tr in enumerate(tbl.findall(qn('w:tr'))):
        trpr = tr.find(qn('w:trPr'))
        if trpr is not None:
            tr.remove(trpr)
        if ri == 0:
            trpr = tr.makeelement(qn('w:trPr'), {})
            trpr.append(trpr.makeelement(qn('w:tblHeader'), {}))
            tr.insert(0, trpr)
        col = 0
        for tc in tr.findall(qn('w:tc')):
            tcpr = tc.find(qn('w:tcPr'))
            if tcpr is None:
                tcpr = tc.makeelement(qn('w:tcPr'), {})
                tc.insert(0, tcpr)
            span = tcpr.find(qn('w:gridSpan'))
            n = int(span.get(qn('w:val'))) if span is not None else 1
            for tag in ('w:tcW', 'w:shd', 'w:vAlign', 'w:tcBorders'):
                e = tcpr.find(qn(tag))
                if e is not None:
                    tcpr.remove(e)
            w = tcpr.makeelement(qn('w:tcW'), {qn('w:w'): str(sum(widths[col:col + n])), qn('w:type'): 'dxa'})
            tcpr.insert(0, w)
            if ri == 0:
                tcpr.append(tcpr.makeelement(qn('w:shd'), {qn('w:val'): 'clear', qn('w:color'): 'auto', qn('w:fill'): header_fill}))
            tcpr.append(tcpr.makeelement(qn('w:vAlign'), {qn('w:val'): 'center'}))
            yield ri, col, tc
            col += n


week = copy.deepcopy(s1.tables[0]._tbl)
for ri, col, tc in list(restyle_table(week, [1250, 1900, 4105, 1250])):
    lines = [text(p).strip() for p in tc.findall(qn('w:p'))]
    lines = [l for l in lines if l] or ['']
    fill_cell(tc, lines, bold=(ri == 0), center=(ri == 0 or col in (0, 3)))

toc = heading('Heading1', 'MỤC LỤC')
toc.addprevious(clone(H1, 'BẢNG PHÂN CÔNG CÔNG VIỆC 12 TUẦN'))
toc.addprevious(clone(BODY, 'Bảng dưới đây tóm tắt công việc của từng thành viên trong 12 tuần thực hiện khóa luận '
                            'và mức độ hoàn thành được nhóm đánh giá.'))
cap = clone(CAP_TBL)
cap_runs = [r for r in cap.findall(qn('w:r')) if r.find(qn('w:t')) is not None]
cap_runs[-1].find(qn('w:t')).text = ': Bảng phân công công việc 12 tuần'
toc.addprevious(cap)
toc.addprevious(week)

# ---------- MỞ ĐẦU ----------
mo = heading('Heading1', 'LỜI MỞ ĐẦU')
set_text(mo, 'MỞ ĐẦU')
insert_after(mo, [clone(H2, '1. GIỚI THIỆU')])
ch1 = heading('Heading1', 'CHƯƠNG 1')
for el in [
    clone(H2, '2. MỤC TIÊU ĐỀ TÀI'),
    clone(BODY, 'Đề tài xây dựng hệ thống quản lý trung tâm bảo hành điện tử giúp theo dõi toàn bộ quá trình bảo hành, '
                'sửa chữa thiết bị, từ khi khách hàng gửi yêu cầu hoặc mang thiết bị đến trung tâm cho đến khi hoàn tất xử lý '
                'và bàn giao. Hệ thống quản lý thông tin thiết bị, phiếu tiếp nhận, kết quả kiểm tra, báo giá, linh kiện và tồn '
                'kho; đồng thời cho phép khách hàng tra cứu và theo dõi tiến độ trên Web và ứng dụng Mobile.'),
    clone(H2, '3. ĐỐI TƯỢNG VÀ PHẠM VI ĐỀ TÀI'),
    clone(BODY, 'Đối tượng của đề tài là quy trình bảo hành, sửa chữa thiết bị điện tử tại trung tâm và việc trao đổi thông '
                'tin giữa khách hàng với các bộ phận tiếp nhận, quản lý, kỹ thuật, kho và thu ngân. Phạm vi thực hiện gồm giao '
                'diện Web cho khách hàng và nhân viên, ứng dụng Mobile viết bằng Flutter dành cho khách hàng, API .NET dùng '
                'chung và cơ sở dữ liệu SQL Server. Nội dung chi tiết được trình bày ở mục 1.1.'),
]:
    ch1.addprevious(el)

# ---------- paragraphs the team rewrote ----------
s1_texts = [p.text.strip() for p in s1.paragraphs if p.text.strip()]
for start in ('Với nhân viên, việc phân quyền', 'Khách hàng bắt đầu bằng việc', 'Nhân viên quản lý không chỉ xem',
              'Từ cách phân chia đó'):
    new = next(t for t in s1_texts if t.startswith(start))
    new = re.sub(r',\.\.\.(\S)', r',... \1', new)
    cands = [p for p in body.iter(qn('w:p')) if style(p) == 'BCNoidung']
    best = max(cands, key=lambda p: difflib.SequenceMatcher(None, text(p), new).ratio())
    assert difflib.SequenceMatcher(None, text(best), new).ratio() > 0.7, start
    set_text(best, new)

# ---------- 2.1.2 forms ----------
s1_body = list(s1.element.body.iterchildren())
i0 = next(i for i, el in enumerate(s1_body) if text(el).strip().startswith('2.1.2.'))
i1 = next(i for i, el in enumerate(s1_body) if text(el).strip().startswith('2.2.'))
forms, pending = [], None
for el in s1_body[i0:i1]:
    blips = list(el.iter(qn('a:blip')))
    if blips:
        ext = el.find('.//' + qn('wp:extent'))
        pending = (s1.part.related_parts[blips[0].get(qn('r:embed'))].blob, int(ext.get('cx')), int(ext.get('cy')))
    elif pending and text(el).strip():
        name = text(el).strip().replace('sữa chữa', 'sửa chữa')
        forms.append((pending, name))
        pending = None
assert len(forms) == 11, len(forms)

kids = children()
a = kids.index(heading('Heading3', '2.1.2.'))
b = kids.index(heading('Heading3', '2.1.3.'))
figs = [el for el in kids[a:b] if el.tag == qn('w:p') and style(el) in ('BCFigure', 'BCTenhinh')]
FIG = copy.deepcopy(next(el for el in figs if style(el) == 'BCFigure'))
caps = [el for el in figs if style(el) == 'BCTenhinh']
CAP_FIRST, CAP_NEXT = copy.deepcopy(caps[0]), copy.deepcopy(caps[1])
anchor = figs[0].getprevious()
for el in figs:
    body.remove(el)
MAX_W, MAX_H = 5400000, 6840000
new = []
for k, ((blob, cx, cy), name) in enumerate(forms):
    rid, _ = cur.part.get_or_add_image(io.BytesIO(blob))
    scale = min(MAX_W / cx, MAX_H / cy)
    cx, cy = int(cx * scale), int(cy * scale)
    f = strip_bookmarks(copy.deepcopy(FIG))
    f.find('.//' + qn('a:blip')).set(qn('r:embed'), rid)
    for e in (f.find('.//' + qn('wp:extent')), f.find('.//' + qn('a:ext'))):
        e.set('cx', str(cx)), e.set('cy', str(cy))
    f.find('.//' + qn('wp:docPr')).set('id', str(9100 + k))
    c = strip_bookmarks(copy.deepcopy(CAP_FIRST if k == 0 else CAP_NEXT))
    last = [r for r in c.findall(qn('w:r')) if r.find(qn('w:t')) is not None][-1]
    last.find(qn('w:t')).text = ': ' + name
    new += [f, c]
insert_after(anchor, new)

# ---------- 2.3 business use-case specs ----------
def spec_table(rows):
    t = copy.deepcopy(SPEC)
    trs = t.findall(qn('w:tr'))
    head, row = trs[0], trs[1]
    for tr in trs:
        t.remove(tr)
    for i, (k, v) in enumerate(rows):
        tr = copy.deepcopy(head if i == 0 else row)
        tcs = tr.findall(qn('w:tc'))
        fill_cell(tcs[0], [k], bold=True)
        fill_cell(tcs[1], [l.strip() for l in v.split('\n') if l.strip()], bold=(i == 0))
        t.append(tr)
    return t


def s1_rows(tbl):
    rows = []
    for tr in tbl.rows:
        cells = list(dict.fromkeys(tr.cells))
        rows.append((cells[0].text.strip(), '\n'.join(p.text for p in cells[-1].paragraphs)))
    return rows


specs = [s1_rows(s1.tables[i]) for i in range(3, 8)]
specs[2][0] = ('Tên Use Case', 'Báo giá và Xác nhận sửa chữa')  # SuonWord repeats the 2.3.1 name here
specs.append([
    ('Tên Use Case', 'Tra cứu tiến độ'),
    ('Tác nhân', 'Khách hàng, nhân viên tiếp nhận'),
    ('Mô tả', 'Khách hàng muốn kiểm tra tình trạng xử lý thiết bị của mình. Use case cung cấp thông tin tiến độ xử lý '
              'bảo hành/sửa chữa cho khách hàng.'),
    ('Tiền điều kiện', 'Thiết bị đã có yêu cầu YC hoặc phiếu tiếp nhận TN; khách hàng có mã phiếu/mã yêu cầu và số điện '
                       'thoại đã đăng ký, hoặc nhân viên đã đăng nhập.'),
    ('Hậu điều kiện', 'Trạng thái thực tế của thiết bị được cung cấp cho khách hàng; việc tra cứu không làm thay đổi dữ '
                      'liệu của phiếu.'),
    ('Luồng chính', '1. Khách tra cứu công khai bằng đúng cặp mã phiếu TN/mã yêu cầu YC và số điện thoại. Nhân viên đã '
                    'đăng nhập có thể tìm theo mã phiếu, serial/IMEI hoặc số điện thoại trong phạm vi quyền.\n'
                    '2. Hệ thống kiểm tra thông tin hồ sơ bảo hành.\n'
                    '3. Hệ thống cung cấp trạng thái thực tế của thiết bị (Đang chẩn đoán, Đang sửa, Đã hoàn tất…) cho '
                    'khách hàng.'),
    ('Luồng phụ', 'Tại bước 2: Không tìm thấy mã hồ sơ; nhân viên yêu cầu khách hàng cung cấp lại thông tin cá nhân/số '
                  'điện thoại đăng ký để xác minh.'),
])
specs.append([
    ('Tên Use Case', 'Nhập linh kiện'),
    ('Tác nhân', 'Nhà cung cấp, thủ kho'),
    ('Mô tả', 'Nhà cung cấp giao vật tư/linh kiện theo đơn đặt hàng. Use case bổ sung linh kiện vào kho phục vụ công tác '
              'sửa chữa và bảo hành.'),
    ('Tiền điều kiện', 'Trung tâm đã đặt hàng với nhà cung cấp; linh kiện đã có trong danh mục của hệ thống.'),
    ('Hậu điều kiện', 'Linh kiện đạt yêu cầu được ghi nhận nhập kho và số lượng tồn được cập nhật; linh kiện lỗi hoặc '
                      'thiếu được lập biên bản phản hồi nhà cung cấp.'),
    ('Luồng chính', '1. Nhà cung cấp giao linh kiện đến trung tâm theo đơn hàng.\n'
                    '2. Thủ kho kiểm tra số lượng, chủng loại và chất lượng linh kiện bàn giao.\n'
                    '3. Thủ kho ghi nhận thông tin nhập kho và lưu trữ linh kiện vào kho vật tư.'),
    ('Luồng phụ', 'Tại bước 2: Linh kiện bị hỏng hoặc thiếu so với đơn hàng; thủ kho lập biên bản phản hồi và yêu cầu nhà '
                  'cung cấp đổi trả hoặc giao bổ sung.'),
])

kids = children()
a = kids.index(heading('Heading2', '2.3.'))
b = kids.index(heading('Heading2', '2.4.'))
old = [el for el in kids[a:b] if el.tag == qn('w:tbl')]
assert len(old) == 7, len(old)
for el, rows in zip(old, specs):
    body.replace(el, spec_table(rows))

# ---------- names in 2.3 / 2.4 follow SuonWord ----------
RENAME = [
    (r'Yêu cầu & Tiếp nhận(?! bảo hành)', 'Yêu cầu và Tiếp nhận bảo hành'),
    (r'Thực hiện bảo hành(?! miễn phí)', 'Thực hiện bảo hành miễn phí'),
    (r'Báo giá & Xác nhận sửa chữa', 'Báo giá và Xác nhận sửa chữa'),
    (r'Thực hiện sửa chữa(?! có phí)', 'Thực hiện sửa chữa có phí'),
]
kids = children()
a = kids.index(heading('Heading2', '2.3.'))
b = kids.index(heading('Heading1', 'CHƯƠNG 3'))
renamed = 0
for el in kids[a:b]:
    if el.tag == qn('w:p') and style(el) in ('Heading3', 'Heading4', 'BCTenbang', 'BCTenhinh'):
        for t in el.iter(qn('w:t')):
            for pat, rep in RENAME:
                t.text, n = re.subn(pat, rep, t.text or '')
                renamed += n

# ---------- Heading 2 in upper case ----------
for p in body.iter(qn('w:p')):
    if style(p) == 'Heading2':
        for t in p.iter(qn('w:t')):
            t.text = (t.text or '').upper()

cur.save(out_path)
print('saved', out_path, 'forms', len(forms), 'renamed', renamed)
