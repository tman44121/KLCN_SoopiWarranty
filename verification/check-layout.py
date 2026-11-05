"""Check the shared repo layout and local documentation links without starting apps or a database."""
import json
from pathlib import Path
import re
from urllib.parse import unquote

root = Path(__file__).resolve().parents[1]
errors = []

for path in [
    "AGENTS.md", "CLAUDE.md", "docs/README.md", "run.bat", ".gitignore",
    "backend-dotnet/Soopi.slnx", "frontend-react/package.json", "Warrant_App/pubspec.yaml",
    "Warrant_App/lib/main.dart", "Warrant_App/test", "database/01_schema.sql", "deploy/compose.yml",
]:
    if not (root / path).exists():
        errors.append(f"Missing: {path}")

groups = ["01-tong-quan", "02-ky-thuat", "03-san-pham", "04-van-hanh", "05-mau", "06-design", "99-ghi-chu", "handoff"]
for group in groups:
    if not (root / "docs" / group).is_dir():
        errors.append(f"Missing docs group: {group}")
for path in root.iterdir():
    if path.is_file() and path.name not in {"AGENTS.md", "CLAUDE.md", ".gitignore", "run.bat"}:
        errors.append(f"Unexpected root file: {path.name}")
if (root / "Warrant_App/.git").exists():
    errors.append("Mobile must use the repository's Git, not a nested repository")
pubspec = (root / "Warrant_App/pubspec.yaml").read_text(encoding="utf-8")
if not re.search(r"^name:\s*warrant_safe\s*$", pubspec, re.M):
    errors.append("Dart package name must remain warrant_safe")
if json.loads((root / "frontend-react/package.json").read_text(encoding="utf-8"))["name"] != "soopi-frontend":
    errors.append("Frontend package name changed")

links = 0
for path in (root / "docs").rglob("*.md"):
    text = path.read_text(encoding="utf-8-sig")
    for match in re.finditer(r"!?\[[^\]\n]*\]\((<[^>]+>|[^)\s]+)", text):
        target = match[1].strip("<>")
        if target.startswith(("#", "/")) or re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", target):
            continue
        relative = unquote(re.split(r"[?#]", target, maxsplit=1)[0])
        if relative:
            links += 1
            if not (path.parent / relative).exists():
                errors.append(f"Broken link: {path.relative_to(root)} -> {target}")
if errors:
    raise SystemExit("\n".join(errors))
print(f"Layout OK: 3 applications, {len(groups)} documentation groups, {links} local links; original package names retained.")
