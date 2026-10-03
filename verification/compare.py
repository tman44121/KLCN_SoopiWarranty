"""Read-only migration checks. Stdlib only; no successful login or DB writes.

POST probes always fail JSON/Bean Validation before controller/service execution.

Run from any directory: python verification/compare.py [--live]
Java 18081 and .NET 18080 must already be running for --live.
The parser covers this repository's literal controller attributes, not arbitrary Java/C#.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import zipfile

ROOT = Path(__file__).resolve().parents[1]
JAVA = ROOT.parent / "warranty-system-mysql"
API = ROOT / "backend-dotnet/src/Soopi.Api"


def read(path):
    return path.read_text(encoding="utf-8-sig")


def route(base, suffix):
    return "/" + (base.strip("/") + "/" + suffix.strip("/")).strip("/")


def normalized(path):
    return re.sub(r"\{[^}]+\}", "{}", path)


# Endpoint chỉ có ở Soopi, không có trong bản Java (DECISIONS D-047). Ngoài các endpoint này, route phải khớp Java 1:1.
SOOPI_ONLY = {("POST", "/api/v1/auth/mobile/password-reset/verify")}


def endpoints():
    java, dotnet = [], []
    for file in sorted((JAVA / "src/main/java").rglob("*Controller.java")):
        source = read(file)
        bases = re.findall(r'@RequestMapping\("([^"]+)"\)', source)
        assert len(bases) == 1, file
        mappings = list(re.finditer(r'@(Get|Post|Put|Patch|Delete)Mapping\b(?:\(([^\n]*)\))?', source))
        for match in mappings:
            strings = re.findall(r'"([^"]*)"', match[2] or "")
            java.append({"method": match[1].upper(), "path": route(bases[0], strings[0] if strings else ""),
                         "controller": file.stem, "source": str(file.relative_to(JAVA)).replace("\\", "/")})
    for file in sorted((API / "Controllers").rglob("*.cs")):
        source = read(file)
        classes = list(re.finditer(r'public sealed class (\w+Controller)\b', source))
        start = 0
        for index, cls in enumerate(classes):
            bases = re.findall(r'\[Route\("([^"]+)"\)\]', source[start:cls.start()])
            assert len(bases) == 1, (file, cls[1], bases)
            end = classes[index + 1].start() if index + 1 < len(classes) else len(source)
            for match in re.finditer(r'\[Http(Get|Post|Put|Patch|Delete)(?:\("([^"]*)"\))?\]', source[cls.end():end]):
                dotnet.append({"method": match[1].upper(), "path": route(bases[0], match[2] or ""),
                               "controller": cls[1], "source": str(file.relative_to(ROOT)).replace("\\", "/")})
            start = cls.end()
    extras = {(row["method"], normalized(row["path"])) for row in dotnet} & SOOPI_ONLY
    assert extras == SOOPI_ONLY, ("Soopi-only endpoint missing", SOOPI_ONLY - extras)
    parity = [row for row in dotnet if (row["method"], normalized(row["path"])) not in SOOPI_ONLY]
    assert len(java) == len(parity) == 114, (len(java), len(parity))
    keys = lambda rows: Counter((row["method"], normalized(row["path"])) for row in rows)
    assert keys(java) == keys(parity), {"missing": list((keys(java) - keys(parity)).elements()),
                                      "extra": list((keys(parity) - keys(java)).elements())}
    assert all(count == 1 for count in keys(java).values()), "Duplicate route"
    return java, dotnet


def security():
    shared = JAVA / "src/main/java/com/example/warranty_system/shared"
    source = read(API / "Domain/Identity/Roles.cs")
    roles = re.findall(r'public enum Role\s*\{([^}]+)\}', source)[0]
    permissions = re.findall(r'public enum Permission\s*\{([^}]+)\}', source)[0]
    enum_names = lambda body: re.findall(r'\b[A-Z][A-Z_]+\b', body)
    for name, body, count in [("Role", roles, 7), ("Permission", permissions, 39)]:
        original = read(shared / f"security/{name}.java")
        java_body = re.findall(rf'public enum {name}\s*\{{(.*)', original, re.S)[0].split(";")[0]
        # Role includes labels/URLs in constructors; count only constants starting a line.
        java_names = re.findall(r'^\s*([A-Z][A-Z_]+)\s*(?:\(|,|\})', java_body, re.M)
        assert enum_names(body) == java_names and len(java_names) == count, name
    java_matrix = {role: set(enum_names(body)) for role, body in
                   re.findall(r'result\.put\(\s*Role\.(\w+),\s*set\((.*?)\)\)', read(shared / "security/RolePermissions.java"), re.S)}
    matrix_source = source.split("private static readonly Dictionary<Role, HashSet<Permission>> Matrix")[1]
    net_matrix = {role: set(re.findall(r'Permission\.(\w+)', body)) for role, body in
                  re.findall(r'\[Role\.(\w+)\]\s*=\s*\[(.*?)\]', matrix_source, re.S)}
    assert len(java_matrix) == 7 and java_matrix == net_matrix, "Permission matrix mismatch"
    statuses = {"BAD_REQUEST": 400, "UNAUTHORIZED": 401, "FORBIDDEN": 403, "NOT_FOUND": 404,
                "CONFLICT": 409, "UNPROCESSABLE_CONTENT": 422, "TOO_MANY_REQUESTS": 429,
                "INTERNAL_SERVER_ERROR": 500, "SERVICE_UNAVAILABLE": 503, "LOCKED": 423}
    java_errors = {name: statuses[status] for name, status in
                   re.findall(r'(\w+)\(HttpStatus\.(\w+)\)', read(shared / "domain/ErrorCode.java"))}
    net_errors = {name: int(status) for name, status in
                  re.findall(r'\[ErrorCode\.(\w+)\]\s*=\s*(\d+)', read(API / "Domain/Shared/ErrorCode.cs"))}
    assert len(java_errors) == 86 and java_errors == net_errors, "Error code/status mismatch"
    return {"roles": 7, "permissions": 39, "role_matrix_equal": True, "error_codes_and_statuses": 86}


def tables():
    schema = read(JAVA / "db/sqlserver/01_schema.sql")
    names = sorted(set(re.findall(r'CREATE TABLE\s+(?:dbo\.)?\[?(\w+)', schema, re.I)))
    assert len(names) == 47, len(names)
    sources = [(str(file.relative_to(ROOT)).replace("\\", "/"), read(file)) for file in API.rglob("*.cs")
               if "obj" not in file.parts and "bin" not in file.parts]
    return [{"table": name, "references": [file for file, content in sources if re.search(rf'\b{re.escape(name)}\b', content)]}
            for name in names]


def artifact():
    war = JAVA / "target/warranty-system-0.0.1-SNAPSHOT.war"
    assert war.is_file(), war
    checked = 0
    with zipfile.ZipFile(war) as archive:
        for file in (JAVA / "src/main/resources").rglob("*"):
            if file.is_file():
                entry = "WEB-INF/classes/" + file.relative_to(JAVA / "src/main/resources").as_posix()
                assert archive.read(entry) == file.read_bytes(), f"WAR resource differs: {entry}"
                checked += 1
    newer = [str(file.relative_to(JAVA)) for file in (JAVA / "src/main/java").rglob("*.java") if file.stat().st_mtime > war.stat().st_mtime]
    assert not newer, "WAR predates source changes"
    return {"sha256": hashlib.sha256(war.read_bytes()).hexdigest(), "matching_resources": checked,
            "sources_newer_than_war": newer,
            "limitation": "Resource equality and timestamps do not prove class bytecode matches every source."}


def get(base, path, authorization=None, rejected_json=None):
    headers = {"Accept": "application/json", "X-Correlation-ID": "stage4-readonly"}
    if authorization is not None:
        headers["Authorization"] = authorization
    data = None
    if rejected_json is not None:
        headers["Content-Type"] = "application/json"
        data = rejected_json.encode("utf-8")
    request = Request(base + path, data=data, headers=headers)
    try:
        response = urlopen(request, timeout=30)
    except HTTPError as error:
        response = error
    with response:
        content = response.read()
        return {"status": response.code, "body": json.loads(content) if content else None,
                "content_type": response.headers.get("Content-Type", "").split(";")[0]}


def differences(left, right, path="$"):
    if type(left) is not type(right):
        return [path + ": type/value differs"]
    if isinstance(left, dict):
        result = [path + "." + key + ": missing" for key in sorted(left.keys() ^ right.keys())]
        for key in sorted(left.keys() & right.keys()):
            result += differences(left[key], right[key], path + "." + key)
        return result
    if isinstance(left, list):
        if len(left) != len(right):
            return [path + ": length differs"]
        return [item for index, (a, b) in enumerate(zip(left, right)) for item in differences(a, b, f"{path}[{index}]")]
    return [] if left == right else [path + ": value differs"]


def validation_order_only(left, right):
    """Java fieldErrors order changes between JVM launches; preserve raw differences/snapshots.

    Compare ONLY this error list as a multiset, including duplicate entries. Never sort business data.
    Evidence: java-validation-order-first.json + java-validation-order-evidence.json.
    """
    if not all(row["status"] == 400 and isinstance(row["body"], dict)
               and row["body"].get("code") == "VALIDATION_FAILED" for row in [left, right]):
        return False
    def ordered(row):
        return {**row, "body": {**row["body"], "fieldErrors": sorted(row["body"].get("fieldErrors", []),
                    key=lambda error: (error["field"], error["message"]))}}
    return left != right and not differences(ordered(left), ordered(right))


def check_validation_comparison():
    # A reorder may pass; missing/duplicate errors, messages, status or business fields must fail.
    errors = [{"field": "phone", "message": "blank"}, {"field": "purpose", "message": "null"}]
    response = lambda fields, **extra: {"status": 400, "body": {"code": "VALIDATION_FAILED", "fieldErrors": fields, **extra}}
    original = response(errors)
    assert validation_order_only(original, response(errors[::-1]))
    assert not validation_order_only(original, response(errors[:1]))
    assert not validation_order_only(original, response(errors + errors[:1]))
    assert not validation_order_only(original, response([errors[0], {"field": "purpose", "message": "changed"}]))
    assert not validation_order_only(original, {**response(errors[::-1]), "status": 401})
    assert not validation_order_only(original, response(errors[::-1], extra="changed"))


def main():
    check_validation_comparison()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true")
    args = parser.parse_args()
    java, dotnet = endpoints()
    result = {"endpoint_count": 114, "routes_equal_after_parameter_normalization": True,
              "security": security(), "tables": tables(), "java_artifact": artifact()}
    net_index = {(row["method"], normalized(row["path"])): row for row in dotnet}
    appendix = ["# Endpoint parity — generated by `python verification/compare.py`", "",
                "114 method/URL có implementation; chưa đồng nghĩa 114 hành vi đã được kiểm DB.", "",
                "| Method | Java URL | .NET URL | Java controller | .NET controller |", "|---|---|---|---|---|"]
    for row in java:
        net = net_index[(row["method"], normalized(row["path"]))]
        appendix.append(f'| {row["method"]} | `{row["path"]}` | `{net["path"]}` | {row["controller"]} | {net["controller"]} |')
    appendix += ["", "## Chỉ có ở Soopi (D-047)", "", "| Method | .NET URL | .NET controller |", "|---|---|---|"]
    for row in dotnet:
        if (row["method"], normalized(row["path"])) in SOOPI_ONLY:
            appendix.append(f'| {row["method"]} | `{row["path"]}` | {row["controller"]} |')
    (ROOT / "verification/ENDPOINTS.md").write_text("\n".join(appendix) + "\n", encoding="utf-8")
    if args.live:
        paths = ["/actuator/health", "/api/v1/portal/catalog", "/api/v1/auth/me", "/api/v1/customers",
                 "/api/v1/portal/my/profile", "/api/v1/tickets", "/api/v1/files/1", "/api/v1/migration-not-found",
                 "/actuator/info", "/actuator/health/liveness", "/actuator/health/readiness",
                 "/api/v1/auth/login", "/api/v1/portal/lookup", "/api/v1/portal/warranty-requests",
                 "/api/v1/auth/mobile/otp", "/migration-not-found", "/js/migration-not-found.js",
                 "/API/v1/portal/catalog", "/JS/migration-not-found.js"]
        cases = [(path, None) for path in paths] + [(path, "Bearer stage4-invalid") for path in
                 ["/actuator/health", "/actuator/info", "/api/v1/portal/catalog", "/api/v1/migration-not-found"]]
        cases += [("/api/v1/portal/catalog", authorization) for authorization in
                  ["Bearer", "Bearer ", "BearerWrong", "Basic stage4-invalid", "bearer stage4-invalid"]]
        authorization_labels = {None: "", "Bearer stage4-invalid": " [invalid bearer]", "Bearer": " [bare bearer]",
                                "Bearer ": " [empty bearer]", "BearerWrong": " [malformed bearer]",
                                "Basic stage4-invalid": " [non-bearer]", "bearer stage4-invalid": " [lowercase bearer]"}
        label = lambda path, authorization: path + authorization_labels[authorization]
        snapshots = {name: {label(path, authorization): get(base, path, authorization) for path, authorization in cases}
                     for name, base in [("java", "http://127.0.0.1:18081"), ("dotnet", "http://127.0.0.1:18080")]}
        assert all(len(snapshot) == len(cases) for snapshot in snapshots.values()), "Duplicate case labels"
        rejected = json.loads(read(ROOT / "verification/validation-cases.json"))
        for name, base in [("java", "http://127.0.0.1:18081"), ("dotnet", "http://127.0.0.1:18080")]:
            for case in rejected:
                response = get(base, case["path"], rejected_json=case["json"])
                # Every case lacks required credentials/phone/OTP. Never enter auth/OTP services.
                assert response["status"] == 400, (name, case["name"], response)
                snapshots[name]["POST " + case["name"]] = response
        directory = ROOT / "contract-snapshots"
        directory.mkdir(exist_ok=True)
        for name, snapshot in snapshots.items():
            (directory / f"{name}.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        result["live"] = [{"path": path, "java_status": snapshots["java"][path]["status"],
                           "dotnet_status": snapshots["dotnet"][path]["status"],
                           "differences": differences(snapshots["java"][path], snapshots["dotnet"][path]),
                           "field_error_order_only": path.startswith("POST ") and validation_order_only(snapshots["java"][path], snapshots["dotnet"][path])}
                          for path in snapshots["java"]]
        spec = get("http://127.0.0.1:18080", "/openapi/v1.json")
        actual = Counter((method.upper(), normalized(path)) for path, operations in spec["body"]["paths"].items()
                         for method in operations if path.startswith("/api/v1/")
                         and method.lower() in {"get", "post", "put", "patch", "delete"})
        result["openapi_routes_equal"] = actual == Counter((row["method"], normalized(row["path"])) for row in dotnet)
        result["openapi_operations"] = sum(actual.values())
    (ROOT / "verification/results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key not in {"tables", "java_artifact"}}, ensure_ascii=False, indent=2))
    if args.live:
        assert result["openapi_routes_equal"], "OpenAPI differs from API controllers"
        assert all(snapshots[name][path]["status"] == 200 for name in snapshots for path in paths[:2]), "Public read failed"
        assert not any(row["differences"] and not row["field_error_order_only"] for row in result["live"]), "Live Java/.NET contracts differ; see results.json"
        print(f"PASS HTTP: {len(result['live'])} cases; "
              f"{sum(bool(row['differences']) for row in result['live'])} retain raw fieldErrors-order differences")
    print(f"PASS: 114 routes, 7 roles/39 permissions, 86 errors; {len(result['tables'])} table reference records")


if __name__ == "__main__":
    main()
