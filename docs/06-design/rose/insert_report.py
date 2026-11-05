"""Insert the Rose diagrams into the KLCN report and add the requested headings.

Usage: python insert_report.py <in.docx> <out.docx> <png_dir>
- 2.2.2.x: headings x.1 Đặc tả, x.2 Sơ đồ hoạt động (existing Rose image), x.3 Sơ đồ tuần tự (new).
- 2.3.2: every "Đặc tả UC hệ thống cho chức năng ..." line becomes heading 2.3.2.N.
- 3.4.x.y: old diagrams removed; headings .1 Sơ đồ hoạt động / .2 Sơ đồ tuần tự with the new Rose captures.
Needs doclib.py (scratchpad tools) on PYTHONPATH via DOCLIB_DIR.
"""
import copy, os, sys
import docx
from docx.oxml.ns import qn

sys.path.insert(0, os.environ['DOCLIB_DIR'])
from doclib import settext, clone_para, clone_caption, new_figure  # noqa: E402
import diagrams_klcn as dk  # noqa: E402

SRC, OUT, PNG = sys.argv[1:4]
d = docx.Document(SRC)
body = d.element.body
B = list(body.iterchildren())


def txt(el):
    return ''.join(t.text or '' for t in el.iter(qn('w:t')))


def style(el):
    ps = el.find(qn('w:pPr') + '/' + qn('w:pStyle')) if el.tag == qn('w:p') else None
    return ps.get(qn('w:val')) if ps is not None else ''


BODY0 = next(i for i, el in enumerate(B) if style(el) == 'Heading1' and txt(el).strip() == 'MỞ ĐẦU')


def find(prefix, sty=None, start=BODY0):
    for i in range(start, len(B)):
        if B[i].tag == qn('w:p') and txt(B[i]).strip().startswith(prefix) and (sty is None or style(B[i]) == sty):
            return i
    raise KeyError(prefix)


# ---- Heading 5 style (copy of Heading 4, outline level 5)
styles = d.styles.element
if styles.find(".//w:style[@w:styleId='Heading5']", namespaces={'w': styles.nsmap['w']}) is None:
    h4 = styles.find(".//w:style[@w:styleId='Heading4']", namespaces={'w': styles.nsmap['w']})
    h5 = copy.deepcopy(h4)
    h5.set(qn('w:styleId'), 'Heading5')
    h5.find(qn('w:name')).set(qn('w:val'), 'heading 5')
    lvl = h5.find('.//' + qn('w:outlineLvl'))
    if lvl is not None:
        lvl.set(qn('w:val'), '4')
    for tag in ('w:link', 'w:uiPriority'):
        e = h5.find(qn(tag))
        if e is not None and tag == 'w:link':
            h5.remove(e)
    h4.addnext(h5)

H4 = B[find('2.2.2.1.', 'Heading4')]
FIG = next(B[i] for i in range(BODY0, len(B)) if style(B[i]) == 'BCFigure')
FCAP2 = next(B[i] for i in range(BODY0, len(B)) if style(B[i]) == 'BCTenhinh' and txt(B[i]).startswith('Hình 2.'))
FCAP3 = next(B[i] for i in range(BODY0, len(B)) if style(B[i]) == 'BCTenhinh' and txt(B[i]).startswith('Hình 3.'))


def heading(level_style, text):
    p = clone_para(H4, text)
    p.find(qn('w:pPr') + '/' + qn('w:pStyle')).set(qn('w:val'), level_style)
    return p


def figure(name, cap_tpl, prefix, title):
    path = os.path.join(PNG, name + '.png')
    return [new_figure(d, FIG, path, width_cm=15.0, max_h_cm=19.5), clone_caption(cap_tpl, prefix, 1, title)]


def after(anchor, els):
    for el in els:
        anchor.addnext(el)
        anchor = el
    return anchor


def is_heading(el):
    return style(el) in ('Heading1', 'Heading2', 'Heading3', 'Heading4')


# ---- 2.2.2.x
for k, spec in enumerate(dk.CH2, 1):
    h = find('2.2.2.%d.' % k, 'Heading4')
    end = next(i for i in range(h + 1, len(B)) if is_heading(B[i]))
    tcap = next(i for i in range(h + 1, end) if style(B[i]) == 'BCTenbang')
    fig = next(i for i in range(h + 1, end) if style(B[i]) == 'BCFigure')
    fcap = next(i for i in range(fig + 1, end) if style(B[i]) == 'BCTenhinh')
    B[tcap].addprevious(heading('Heading5', '2.2.2.%d.1. Đặc tả quy trình nghiệp vụ' % k))
    B[fig].addprevious(heading('Heading5', '2.2.2.%d.2. Sơ đồ hoạt động' % k))
    after(B[fcap], [heading('Heading5', '2.2.2.%d.3. Sơ đồ tuần tự' % k)] + figure(spec['name'], FCAP2, 'Hình 2.', spec['title']))

# ---- 2.3.2 use-case specification headings
n = 0
for i in range(BODY0, len(B)):
    t = txt(B[i]).strip()
    if B[i].tag == qn('w:p') and t.startswith('Đặc tả UC hệ thống cho chức năng '):
        n += 1
        new = heading('Heading4', '2.3.2.%d. Đặc tả use case %s' % (n, t[len('Đặc tả UC hệ thống cho chức năng '):]))
        B[i].addprevious(new)
        body.remove(B[i])

# ---- 3.4.x.y
for sec, title, ad, sd in dk.F:
    h = find(sec + '.', 'Heading4')
    end = next(i for i in range(h + 1, len(B)) if is_heading(B[i]))
    for el in B[h + 1:end]:
        if el.getparent() is not None:
            body.remove(el)
    t = title[0].lower() + title[1:]
    after(B[h], [heading('Heading5', sec + '.1. Sơ đồ hoạt động')]
          + figure(ad['name'], FCAP3, 'Hình 3.', 'Sơ đồ hoạt động chức năng ' + t)
          + [heading('Heading5', sec + '.2. Sơ đồ tuần tự')]
          + figure(sd['name'], FCAP3, 'Hình 3.', 'Sơ đồ tuần tự chức năng ' + t))

d.save(OUT)
print('saved', OUT, 'uc headings', n)
