import pythoncom, sys
tl = pythoncom.LoadTypeLib(r"C:/Program Files (x86)/Rational/Rose/rationalrose.tlb")
out = []
for i in range(tl.GetTypeInfoCount()):
    ti = tl.GetTypeInfo(i); attr = ti.GetTypeAttr(); name = tl.GetDocumentation(i)[0]
    out.append(f"== {name} kind={attr.typekind}")
    for j in range(attr.cFuncs):
        fd = ti.GetFuncDesc(j); names = ti.GetNames(fd.memid)
        out.append(f"  F {names[0]}({', '.join(names[1:])}) inv={fd.invkind}")
    for j in range(attr.cVars):
        vd = ti.GetVarDesc(j); out.append(f"  V {ti.GetNames(vd.memid)[0]} = {vd.value}")
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(out))
