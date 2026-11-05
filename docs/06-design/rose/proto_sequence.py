import win32com.client as w, os, sys, time, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rosetlb  # sinh bằng: python -m win32com.client.makepy -o docs/06-design/rose/rosetlb.py "C:/Program Files (x86)/Rational/Rose/rationalrose.tlb"
out = sys.argv[1]
r = rosetlb.IRoseApplication(w.Dispatch('Rose.Application')._oleobj_)
m = r.CurrentModel
cat = m.RootCategory.AddCategory('P%d' % int(time.time()))
for n, st in [('KhachHang', 'Actor'), ('GD_DangKy', 'boundary'), ('DieuKhien_YeuCau', 'control'), ('YeuCauBaoHanh', 'entity')]:
    c = cat.AddClass(n); c.Stereotype = st
d = cat.AddScenarioDiagram('SD4', 1)
objs = [d.AddInstance('', n) for n in ['KhachHang', 'GD_DangKy', 'DieuKhien_YeuCau', 'YeuCauBaoHanh']]
for o in objs: d.AddInstanceView(o, True)
msgs = [(0, 1, 'Nhap thong tin yeu cau', 0), (1, 2, 'GuiYeuCau()', 0), (2, 2, 'KiemTraHopLe()', 0), (2, 3, 'LuuYeuCau()', 0), (3, 2, 'Tra ve ma yeu cau', 6), (2, 1, 'Ket qua', 6), (1, 0, 'Thong bao thanh cong', 6)]
for i, (a, b, t, sy) in enumerate(msgs, 1):
    d.CreateMessage(t, objs[a], objs[b], i).Synchronization = sy
d.AutosizeAll()
iv = d.InstanceViews
for i in range(1, iv.Count + 1):
    v = iv.GetAt(i); print('inst', v.XPosition, v.YPosition, v.Width, v.Height)
d.RenderEnhanced(os.path.join(out, sys.argv[2] + '.emf'))
m.SaveAs(os.path.join(out, sys.argv[2] + '.mdl'))
