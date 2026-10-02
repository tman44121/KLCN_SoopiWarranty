# Kiểm chứng không ghi database

Chạy trong repo `warranty-system-soopi`; Java gốc chỉ đọc, không chạy Maven/seed/migration.

## Oracle JSON/validation/domain từ WAR

Oracle chỉ mở context Jackson auto-config, Hibernate Validator và constructor Payment.
Không khởi động Spring application hay datasource. 100 quan sát trong `java-domain-snapshots.json`
được kiểm bởi `JavaContractTests` và test EF model; EF test không mở connection.

Chuẩn bị từ WAR sẵn có (Python stdlib; chỉ ghi thư mục artifacts bị gitignore trong repo đích):

```powershell
@'
from pathlib import Path
from zipfile import ZipFile
destination = Path('verification/artifacts/java-probe')
with ZipFile('../warranty-system-mysql/target/warranty-system-0.0.1-SNAPSHOT.war') as archive:
    for entry in archive.namelist():
        for prefix, directory in [('WEB-INF/classes/', 'classes'), ('WEB-INF/lib/', 'lib')]:
            if not entry.startswith(prefix) or entry.endswith('/'):
                continue
            relative = Path(entry[len(prefix):])
            assert not relative.is_absolute() and '..' not in relative.parts
            output = destination / directory / relative
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(archive.read(entry))
'@ | python -
java --class-path 'verification/artifacts/java-probe/classes;verification/artifacts/java-probe/lib/*' verification/JavaContractProbe.java verification/java-domain-snapshots.json
cd backend-dotnet
dotnet test Soopi.slnx --artifacts-path artifacts/stage4 --filter FullyQualifiedName~JavaContractTests
```

46 primitive/enum/Instant, 17 nullable/date/decimal, 25 validation, 9 Java blank/trim và 3 Payment.
Thư viện/cấu hình lấy từ WAR, chỉ property `fail-on-null-for-primitives=false` như application.yml.
Không tự suy rộng kết quả ra mọi input, nano dưới 100ns, toàn miền BigDecimal hay Unicode IDN.

## HTTP/static parity

```powershell
python verification/compare.py
python verification/compare.py --live
```

`--live` cần Java 18081 và .NET 18080 đã chạy với cấu hình chỉ đọc nêu trong
[`MIGRATION_VERIFICATION.md`](../docs/MIGRATION_VERIFICATION.md). Không in secrets hoặc tự đăng nhập.
28 GET + 16 POST trong `validation-cases.json`: mọi POST thiếu trường bắt buộc hoặc JSON hỏng,
bị validation từ chối trước controller/service, không gửi OTP hay thực hiện login/register/reset.

Snapshots giữ nguyên response; results giữ mọi raw diff. Riêng mảng `fieldErrors` của lỗi validation 400
được đối chiếu như multiset: Java tự đổi thứ tự giữa JVM, chứng minh trong
`java-validation-order-first.json` và `java-validation-order-evidence.json` (6 case đổi thứ tự).
Không sort mảng nghiệp vụ, không bỏ trường; self-check đảm bảo thiếu/thừa lỗi, đổi message/status/trường khác vẫn fail.
Script pass không có nghĩa raw JSON luôn giống thứ tự mảng hoặc mọi nghiệp vụ đã nghiệm thu.

## Kiểm đầy đủ hiện có

```powershell
cd backend-dotnet
dotnet build Soopi.slnx --artifacts-path artifacts/stage4
dotnet test Soopi.slnx --artifacts-path artifacts/stage4 --no-build --no-restore
cd ../frontend-react
npm.cmd run build
npm.cmd run lint
npm.cmd test
```

Dừng tiến trình API kiểm tra do mình khởi động trước build để DLL không bị khóa trên Windows.
Browser smoke 49 check dùng toàn bộ API mock; không thay thế kiểm DB có token/luồng ghi.
Login/logout cần chủ dự án duyệt riêng vì ghi tài khoản, refresh token và audit; luồng nghiệp vụ ghi cần DB `_IT` được duyệt.
