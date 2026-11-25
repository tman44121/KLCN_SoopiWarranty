"""SVG (graphviz) -> PNG bằng PyMuPDF; tự vẽ gạch chân cho khóa chính vì MuPDF bỏ qua text-decoration."""
import glob, os, re, sys, html
import pymupdf
from PIL import ImageFont, Image, ImageOps

FONTS = {}
def width(text, size, bold=False):
    key = (size, bold)
    if key not in FONTS:
        FONTS[key] = ImageFont.truetype('C:/Windows/Fonts/timesbd.ttf' if bold else 'C:/Windows/Fonts/times.ttf', size * 10)
    return FONTS[key].getlength(text) / 10

def underline(s):
    out = []
    for m in re.finditer(r'<text ([^>]*text-decoration="underline"[^>]*)>([^<]*)</text>', s):
        a, t = m.group(1), html.unescape(m.group(2))
        x = float(re.search(r'\bx="([-\d.]+)"', a).group(1)); y = float(re.search(r'\by="([-\d.]+)"', a).group(1))
        fs = float(re.search(r'font-size="([\d.]+)"', a).group(1))
        anchor = re.search(r'text-anchor="(\w+)"', a); anchor = anchor.group(1) if anchor else 'start'
        w = width(t, fs)
        x0 = x if anchor == 'start' else x - w / 2 if anchor == 'middle' else x - w
        out.append(f'<line x1="{x0:.2f}" y1="{y + 1.6:.2f}" x2="{x0 + w:.2f}" y2="{y + 1.6:.2f}" stroke="black" stroke-width="0.8"/>')
    i = s.rindex('</g>')
    return s[:i] + ''.join(out) + s[i:]

for svg in sorted(glob.glob(os.path.join(sys.argv[1], '*.svg'))):
    s = underline(open(svg, encoding='utf-8').read())
    tmp = svg[:-4] + '.u.svg'
    open(tmp, 'w', encoding='utf-8').write(s)
    png = svg[:-4] + '.png'
    pymupdf.open(tmp)[0].get_pixmap(dpi=220).save(png)
    os.remove(tmp)
    im = Image.open(png).convert('RGB')
    b = ImageOps.invert(im).getbbox()
    im.crop((max(0, b[0] - 10), max(0, b[1] - 10), min(im.width, b[2] + 10), min(im.height, b[3] + 10))).save(png)
    print(os.path.basename(png), Image.open(png).size)
