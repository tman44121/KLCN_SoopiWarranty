"""Refresh the report's schema snapshot from DDL without connecting to a database."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[4]
sql = re.sub(r'--[^\n]*', '', (root / 'database/01_schema.sql').read_text(encoding='utf-8-sig'))
schema = {}

def columns(value):
    return [c.strip().strip('[]') for c in value.split(',')]

for match in re.finditer(r'CREATE\s+TABLE\s+(?:dbo\.)?(\w+)\s*\((.*?)\n\s*\);', sql, re.S | re.I):
    name, body = match.groups()
    parts, start, depth, quoted = [], 0, 0, False
    for i, ch in enumerate(body):
        if ch == "'":
            quoted = not quoted
        if quoted:
            continue
        depth += (ch == '(') - (ch == ')')
        if ch == ',' and depth == 0:
            parts.append(body[start:i].strip())
            start = i + 1
    parts.append(body[start:].strip())
    table = {'cols': [], 'pk': [], 'fks': [], 'nullable': [], 'unique': [], 'notes': {}}
    for part in parts:
        if re.match(r'^(CONSTRAINT|FOREIGN|PRIMARY|INDEX|UNIQUE|CHECK)\b', part, re.I):
            pk = re.search(r'PRIMARY KEY\s*\(([^)]*)\)', part, re.I)
            if pk:
                table['pk'] = columns(pk[1])
            fk = re.search(r'FOREIGN KEY\s*\(([^)]*)\)\s*REFERENCES\s+(\w+)\s*\(([^)]*)\)', part, re.I)
            if fk:
                table['fks'].append([columns(fk[1]), fk[2], columns(fk[3])])
            uq = re.search(r'UNIQUE\s*\(([^)]*)\)', part, re.I)
            if uq:
                table['unique'].append(columns(uq[1]))
            continue
        col = re.match(r'(\w+)\s+([\w]+(?:\s*\([^)]*\))?)(.*)', part, re.S)
        assert col, (name, part)
        key, kind, rest = col.groups()
        table['cols'].append([key, re.sub(r'\s+', '', kind)])
        notes = []
        if re.search(r'\bIDENTITY\b', rest, re.I):
            notes.append('IDENTITY')
        default = re.search(r'DEFAULT\s+([^\s,]+)', rest, re.I)
        if default:
            notes.append('DEFAULT ' + default[1])
        if notes:
            table['notes'][key] = notes
        if re.search(r'PRIMARY KEY', rest, re.I):
            table['pk'].append(key)
        if not re.search(r'NOT NULL|PRIMARY KEY', rest, re.I):
            table['nullable'].append(key)
        if re.search(r'\bUNIQUE\b', rest, re.I):
            table['unique'].append([key])
        fk = re.search(r'REFERENCES\s+(\w+)\s*\(([^)]*)\)', rest, re.I)
        if fk:
            table['fks'].append([[key], fk[1], columns(fk[2])])
    table['nullable'] = [c for c in table['nullable'] if c not in table['pk']]
    table['unique'].append(table['pk'])
    assert name not in schema, name
    schema[name] = table

for alter in re.finditer(r'ALTER TABLE\s+(\w+)\s+ADD CONSTRAINT\s+\w+\s+FOREIGN KEY\s*\(([^)]*)\)\s*REFERENCES\s+(\w+)\s*\(([^)]*)\)', sql, re.I):
    child, keys, parent, parent_keys = alter.groups()
    schema[child]['fks'].append([columns(keys), parent, columns(parent_keys)])

# A status-filtered unique index is not a global one-to-one relationship.
for index in re.finditer(r'CREATE UNIQUE INDEX\s+\w+\s+ON\s+(\w+)\s*\(([^)]*)\)([^;]*);', sql, re.I):
    name, keys, suffix = index.groups()
    cols = columns(keys)
    if not suffix.strip() or (len(cols) == 1 and re.fullmatch(
        r'\s*WHERE\s+' + re.escape(cols[0]) + r'\s+IS NOT NULL\s*', suffix, re.I)):
        schema[name]['unique'].append(cols)

assert len(schema) == len(re.findall(r'CREATE\s+TABLE\s+', sql, re.I)), 'Unparsed CREATE TABLE'
assert sum(len(t['fks']) for t in schema.values()) == len(re.findall(r'\bREFERENCES\s+', sql, re.I)), 'Unparsed foreign key'
Path(__file__).with_name('schema.json').write_text(json.dumps(schema, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(f'Synchronized {len(schema)} tables from database/01_schema.sql')
