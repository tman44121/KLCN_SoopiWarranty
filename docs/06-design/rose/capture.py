"""Capture a Rose diagram exactly as Rose paints it (same look as a screenshot), without touching the user's screen.

PrintWindow renders only Rose's own window into a bitmap, even when it is covered or off-screen. The Rose main window is
temporarily moved off-screen and enlarged so the whole diagram fits at the chosen zoom, then restored.
"""
import ctypes, time
import win32con, win32gui, win32ui, win32process
from PIL import Image

PW_RENDERFULLCONTENT = 2
user32 = ctypes.windll.user32


def rose_main_hwnd():
    found = []
    def cb(h, _):
        if win32gui.IsWindowVisible(h) and win32gui.GetWindowText(h).startswith('Rational Rose'):
            found.append(h)
        return True
    win32gui.EnumWindows(cb, None)
    if not found:
        raise RuntimeError('Rose window not found')
    return found[0]


def _children(h):
    out = []
    win32gui.EnumChildWindows(h, lambda c, _: out.append(c) or True, None)
    return out


def diagram_view_hwnd(main):
    """The MDI child whose title names the active diagram, and its largest descendant (the drawing surface)."""
    mdi_client = next(c for c in _children(main) if win32gui.GetClassName(c) == 'MDIClient')
    active = win32gui.SendMessage(mdi_client, win32con.WM_MDIGETACTIVE, 0, 0)
    best, area = active, 0
    for c in _children(active):
        l, t, r, b = win32gui.GetClientRect(c)
        if win32gui.IsWindowVisible(c) and (r - l) * (b - t) > area:
            best, area = c, (r - l) * (b - t)
    return mdi_client, active, best


class OffscreenLarge:
    """Move/enlarge Rose off-screen for the capture, restore afterwards."""
    def __init__(self, width=3800, height=2800):
        self.size = (width, height)

    def __enter__(self):
        self.main = rose_main_hwnd()
        self.placement = win32gui.GetWindowPlacement(self.main)
        if self.placement[1] == win32con.SW_SHOWMAXIMIZED:
            win32gui.ShowWindow(self.main, win32con.SW_SHOWNOACTIVATE)
        flags = win32con.SWP_NOZORDER | win32con.SWP_NOACTIVATE
        sw = user32.GetSystemMetrics(78) + user32.GetSystemMetrics(76)  # virtual screen right edge
        win32gui.SetWindowPos(self.main, 0, sw + 50, 0, self.size[0], self.size[1], flags)
        time.sleep(0.4)
        return self

    def __exit__(self, *exc):
        win32gui.SetWindowPlacement(self.main, self.placement)


def capture_active_diagram(png_path, main=None):
    main = main or rose_main_hwnd()
    mdi_client, child, view = diagram_view_hwnd(main)
    win32gui.SendMessage(mdi_client, win32con.WM_MDIMAXIMIZE, child, 0)
    time.sleep(0.6)
    mdi_client, child, view = diagram_view_hwnd(main)
    l, t, r, b = win32gui.GetClientRect(view)
    w, h = r - l, b - t
    hwnd_dc = win32gui.GetWindowDC(view)
    mfc = win32ui.CreateDCFromHandle(hwnd_dc)
    mem = mfc.CreateCompatibleDC()
    bmp = win32ui.CreateBitmap()
    bmp.CreateCompatibleBitmap(mfc, w, h)
    mem.SelectObject(bmp)
    user32.PrintWindow(view, mem.GetSafeHdc(), PW_RENDERFULLCONTENT)
    info, bits = bmp.GetInfo(), bmp.GetBitmapBits(True)
    im = Image.frombuffer('RGB', (info['bmWidth'], info['bmHeight']), bits, 'raw', 'BGRX', 0, 1)
    win32gui.DeleteObject(bmp.GetHandle()); mem.DeleteDC(); mfc.DeleteDC(); win32gui.ReleaseDC(view, hwnd_dc)
    im.save(png_path)
    return png_path


def crop_content(png_path, margin=12, lane_tolerance=8):
    """Crop to the drawing; lifelines/swimlane lines that run to the bottom are cut just below the last element."""
    im = Image.open(png_path).convert('RGB')
    g = im.convert('L')
    w, h = g.size
    px = g.load()
    bg = px[w - 2, h - 2]
    rows = [sum(1 for x in range(0, w, 2) if abs(px[x, y] - bg) > 30) for y in range(h)]
    cols_any = Image.eval(g, lambda p: 255 if abs(p - bg) > 30 else 0).getbbox()
    if not cols_any:
        return
    base = sorted(rows)[len(rows) // 2]
    content_rows = [y for y, c in enumerate(rows) if c > base + lane_tolerance]
    bottom = min(cols_any[3], (content_rows[-1] if content_rows else cols_any[3]) + 30)
    box = (max(0, cols_any[0] - margin), max(0, cols_any[1] - margin), min(w, cols_any[2] + margin), min(h, bottom + margin))
    im.crop(box).save(png_path, dpi=(150, 150))


def crop_after_last_lane(png_path, margin=3):
    """Activity diagrams: cut the empty strip Rose paints right of the last swimlane (it looks like a lane with no actor)."""
    im = Image.open(png_path).convert('RGB')
    w, h = im.size
    px = im.load()
    def lane_px(c):
        r, g, b = c
        return r > 110 and g < 90 and b < 120 and r - g > 60
    ys = range(h // 5, h - 10, 3)
    lanes = [x for x in range(w) if sum(lane_px(px[x, y]) for y in ys) > 0.8 * len(ys)]
    if lanes and lanes[-1] + margin < w - 1:
        im.crop((0, 0, lanes[-1] + margin + 1, h)).save(png_path, dpi=(150, 150))


def _snap(hwnd):
    """PrintWindow the whole window, then keep only its client area (drops 3D borders)."""
    wl, wt, wr, wb = win32gui.GetWindowRect(hwnd)
    w, h = wr - wl, wb - wt
    cx, cy = win32gui.ClientToScreen(hwnd, (0, 0))
    _, _, cw, ch = win32gui.GetClientRect(hwnd)
    dc = win32gui.GetWindowDC(hwnd)
    mfc = win32ui.CreateDCFromHandle(dc)
    mem = mfc.CreateCompatibleDC()
    bmp = win32ui.CreateBitmap()
    bmp.CreateCompatibleBitmap(mfc, w, h)
    mem.SelectObject(bmp)
    user32.PrintWindow(hwnd, mem.GetSafeHdc(), PW_RENDERFULLCONTENT)
    im = Image.frombuffer('RGB', (w, h), bmp.GetBitmapBits(True), 'raw', 'BGRX', 0, 1).copy()
    win32gui.DeleteObject(bmp.GetHandle()); mem.DeleteDC(); mfc.DeleteDC(); win32gui.ReleaseDC(hwnd, dc)
    ox, oy = cx - wl, cy - wt
    return im.crop((ox, oy, ox + cw, oy + ch))


def _scroll_to(view, sb, msg, pos):
    """Rose ignores the position in SB_THUMBPOSITION, so step with SB_LINEDOWN/SB_LINEUP until the bar reaches pos."""
    get = lambda: win32gui.GetScrollInfo(sb, win32con.SB_CTL, win32con.SIF_ALL)[4]
    for _ in range(2000):
        cur = get()
        if cur == pos:
            break
        before = cur
        win32gui.SendMessage(view, msg, win32con.SB_LINEDOWN if cur < pos else win32con.SB_LINEUP, sb)
        if get() == before:  # reached the end of the range
            break
        if (get() > pos) != (before > pos) and get() != pos:  # stepped over the target; stay on the near side
            break
    win32gui.SendMessage(view, msg, win32con.SB_ENDSCROLL, sb)
    time.sleep(0.3)
    return get()


def _lane_columns(im, top):
    px = im.load()
    w, h = im.size
    ys = range(top + (h - top) // 5, h - 10, 3)
    def red(c):
        r, g, b = c
        return r > 110 and g < 90 and b < 120 and r - g > 60
    xs = [x for x in range(w) if sum(red(px[x, y]) for y in ys) > 0.8 * len(ys)]
    cols = []
    for x in xs:  # collapse 2-3 px wide lines
        if not cols or x - cols[-1] > 4:
            cols.append(x)
    return cols


def _repaint_header(canvas, tiles, vw, hh):
    """Each swimlane title is centred in the visible part of its column, so a stitched header repeats titles.
    Rebuild it lane by lane from a tile that shows the whole lane."""
    bounds = [0] + _lane_columns(canvas, hh)
    for left, right in zip(bounds, bounds[1:]):
        for ah, img in tiles:
            if ah <= left and right + 2 <= ah + vw:
                canvas.paste(img.crop((left - ah, 0, right + 2 - ah, hh)), (left, 0))
                break


def capture_full(diagram, png_path):
    """Activate a Rose diagram, then capture it tile by tile (Rose scroll units are pixels) with the column header bar.
    Zoom is taken from the diagram itself: fix_petal() writes it into the .mdl because the API ZoomFactor setter is ignored."""
    diagram.Activate()
    views = diagram.ItemViews
    for i in range(1, views.Count + 1):
        try:
            views.GetAt(i).SetSelected(False)
        except Exception:
            pass
    time.sleep(0.6)
    main = rose_main_hwnd()
    mdi, child, view = diagram_view_hwnd(main)
    win32gui.SendMessage(mdi, win32con.WM_MDIMAXIMIZE, child, 0)
    time.sleep(0.5)
    mdi, child, view = diagram_view_hwnd(main)
    kids = _children(child)
    sbs = {}
    for c in kids:
        if win32gui.GetClassName(c) == 'ScrollBar':
            l, t, r, b = win32gui.GetClientRect(c)
            sbs['H' if r > b else 'V'] = c
    header = next((c for c in kids if win32gui.GetClassName(c) == 'SysHeader32' and win32gui.IsWindowVisible(c)), None)
    sbs = {k: v for k, v in sbs.items() if win32gui.IsWindowVisible(v)}
    nobar = (0, 0, 0, 0, 0, 0)  # a diagram that fits has its scrollbar hidden
    hinfo = win32gui.GetScrollInfo(sbs['H'], win32con.SB_CTL, win32con.SIF_ALL) if 'H' in sbs else nobar
    vinfo = win32gui.GetScrollInfo(sbs['V'], win32con.SB_CTL, win32con.SIF_ALL) if 'V' in sbs else nobar
    vw, vh = _snap(view).size
    total_w = max(vw, hinfo[2] + 1)
    total_h = max(vh, vinfo[2] + 1)
    hh = _snap(header).size[1] if header else 0
    canvas = Image.new('RGB', (total_w, total_h + hh), 'white')
    hpos_list = list(range(0, max(1, total_w - vw + 1), vw - 20)) + [max(0, total_w - vw)]
    vpos_list = list(range(0, max(1, total_h - vh + 1), vh - 20)) + [max(0, total_h - vh)]
    header_right = 0
    header_tiles = []
    for hp in dict.fromkeys(hpos_list):
        ah = _scroll_to(view, sbs['H'], win32con.WM_HSCROLL, hp) if 'H' in sbs else 0
        if header:
            # header labels re-centre while scrolling, so only add the part not covered yet
            start = max(0, header_right - ah)
            hdr = _snap(header).crop((start, 0, vw, hh))
            canvas.paste(hdr, (ah + start, 0))
            header_right = ah + vw
            header_tiles.append((ah, _snap(header)))
        for vp in dict.fromkeys(vpos_list):
            av = _scroll_to(view, sbs['V'], win32con.WM_VSCROLL, vp) if 'V' in sbs else 0
            canvas.paste(_snap(view), (ah, av + hh))
    for k, msg in (('V', win32con.WM_VSCROLL), ('H', win32con.WM_HSCROLL)):
        if k in sbs:
            _scroll_to(view, sbs[k], msg, 0)
    if len(header_tiles) > 1:
        _repaint_header(canvas, header_tiles, vw, hh)
    canvas.save(png_path)
    return png_path, hh
