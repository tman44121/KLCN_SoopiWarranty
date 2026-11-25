"""Open a .mdl in the running Rose; click OK on any "Error" dialog Rose shows meanwhile and report it."""
import threading, time, win32gui, win32con, win32process


def _rose_error_dialogs():
    found = []
    def cb(h, _):
        if win32gui.IsWindowVisible(h) and win32gui.GetWindowText(h) in ('Error', 'Rational Rose') and win32gui.GetClassName(h) == '#32770':
            found.append(h)
        return True
    win32gui.EnumWindows(cb, None)
    return found


def open_model(r, path, timeout=60):
    errors, stop = [], threading.Event()

    def watch():
        while not stop.is_set():
            for h in _rose_error_dialogs():
                kids = []
                win32gui.EnumChildWindows(h, lambda c, _: kids.append(c) or True, None)
                msg = ' '.join(win32gui.GetWindowText(c) for c in kids if win32gui.GetClassName(c) == 'Static')
                errors.append(msg)
                for c in kids:
                    if win32gui.GetWindowText(c) in ('OK', '&OK', 'Yes', '&Yes', 'No', '&No'):
                        win32gui.PostMessage(c, win32con.BM_CLICK, 0, 0)
                        break
            time.sleep(0.3)

    t = threading.Thread(target=watch, daemon=True)
    t.start()
    try:
        r.OpenModel(path)
        time.sleep(1)
    finally:
        stop.set()
        t.join(2)
    return errors
