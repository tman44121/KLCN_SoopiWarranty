"""Read-only checks for the report ERD against the checked-in SQL schema."""
import json
import sys
from pathlib import Path

s = json.loads(Path(__file__).with_name('schema.json').read_text(encoding='utf-8'))
assert len(s) == 55, f'Expected 55 tables from 01_schema.sql, got {len(s)}'
assert s['PhieuKiemKe']['pk'] == ['MaPhieuKK']
assert s['ChiTietKiemKe']['pk'] == ['MaChiTietKK']
assert [f[:2] for f in s['PhieuKiemKe']['fks']] == [
    [['MaNguoiLap'], 'NhanVien'], [['MaNguoiDuyet'], 'NhanVien']]
assert [f[:2] for f in s['ChiTietKiemKe']['fks']] == [
    [['MaPhieuKK'], 'PhieuKiemKe'], [['MaLK'], 'LinhKien']]
assert 'MaNguoiDuyet' in s['PhieuKiemKe']['nullable']
assert 'MaNguoiLap' not in s['PhieuKiemKe']['nullable']
assert ['MaPhieuKK', 'MaLK', 'MaKe'] in s['ChiTietKiemKe']['unique']
assert not any('MaKe' in f[0] for f in s['ChiTietKiemKe']['fks'])
assert ['MaYeuCau'] in s['PhieuTiepNhan']['unique']
assert ['MaThietBi'] not in s['PhieuTiepNhan']['unique']  # only open-ticket index is unique
assert ['MaTaiKhoan'] in s['NhanVien']['unique']  # unique for non-null values
assert ['MaPhieuTN'] in s['DanhGiaCongKhai']['unique']
for name, table in s.items():
    cols = {c[0] for c in table['cols']}
    assert table['pk'] and set(table['pk']) <= cols, name
    assert not set(table['pk']) & set(table['nullable']), name
    for fk, parent, parent_cols in table['fks']:
        assert set(fk) <= cols and parent in s, (name, fk, parent)
        assert set(parent_cols) <= {c[0] for c in s[parent]['cols']}, (name, parent)
print(f"ERD schema checks passed: {len(s)} tables, {sum(len(t['fks']) for t in s.values())} foreign keys")

if len(sys.argv) > 1:
    audit = json.loads((Path(sys.argv[1]) / 'coverage.json').read_text(encoding='utf-8'))
    edges = {(e['child'], tuple(e['columns']), e['parent']): e
             for d in audit['diagrams'] for e in d['relationships']}
    expected = {(child, tuple(keys), parent) for child, t in s.items() for keys, parent, _ in t['fks']}
    assert set(edges) == expected and len(edges) == 97
    assert len(audit['standalone']) == 6
    assert all(d['printedFontPt'] >= 7 for d in audit['diagrams'])
    author = edges['PhieuKiemKe', ('MaNguoiLap',), 'NhanVien']
    approver = edges['PhieuKiemKe', ('MaNguoiDuyet',), 'NhanVien']
    assert not author['optionalParent'] and not author['uniqueChild']
    assert approver['optionalParent'] and not approver['uniqueChild']
    assert not edges['ChiTietKiemKe', ('MaPhieuKK',), 'PhieuKiemKe']['uniqueChild']
    assert not edges['PhieuTiepNhan', ('MaThietBi',), 'ThietBi']['uniqueChild']
    assert edges['PhieuKiemTra', ('MaPhieuTN',), 'PhieuTiepNhan']['uniqueChild']
    assert edges['DanhGiaCongKhai', ('MaPhieuTN',), 'PhieuBanGiao']['uniqueChild']
    print('Diagram checks passed: all 97 foreign keys, stocktake roles, cardinalities and print sizes')
