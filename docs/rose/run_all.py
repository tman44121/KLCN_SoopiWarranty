"""Build every KLCN diagram in the open Rose, save the model and capture PNGs.

Usage:
  python run_all.py <outdir> [name ...]        build + capture (names limit the run, e.g. SD_2_2_2_1 AD_3_4_1_1)
  python run_all.py <outdir> --only-prefix AD_    rebuild everything, capture only names starting with AD_
  python run_all.py <outdir> --capture [name]  reopen <outdir>/KLCN_SoopiWarranty.mdl and capture missing/named PNGs only
Output: <outdir>/KLCN_SoopiWarranty.mdl (editable in Rose) and <outdir>/<diagram>.png
"""
import os, sys, time
import rosedraw as rd
import capture
import diagrams_klcn as dk

CAT = 'KLCN_SoopiWarranty'
out = sys.argv[1]
args = sys.argv[2:]
if args[:1] == ['--capture']:
    names = set(args[1:])
    r = rd.app()
    rd.settle(r, out)
    fixed = os.path.join(out, CAT + '.mdl')
    if (r.CurrentModel.GetFileName() or '').lower() != fixed.lower():
        r.OpenModel(fixed)
        time.sleep(1)
    with capture.OffscreenLarge():
        for d in rd.diagrams_of(r.CurrentModel, CAT):
            png = os.path.join(out, d.Name + '.png')
            if (names and d.Name not in names) or (not names and os.path.exists(png)):
                continue
            capture.capture_full(d, png)
            capture.crop_content(png)
            if d.Name.startswith('AD_'):
                capture.crop_after_last_lane(png)
            print('ok', png)
    rd.settle(r, out)
else:
    only = None
    if args[:1] == ['--only-prefix']:  # rebuild the whole model but capture e.g. only AD_ diagrams
        only, args = tuple(args[1].split(',')), args[2:]
    specs = dk.all_specs()
    if args:
        specs = [s for s in specs if s['name'] in args]
    for png in rd.produce(specs, CAT, out, capture_only=only):
        print('ok', png)
