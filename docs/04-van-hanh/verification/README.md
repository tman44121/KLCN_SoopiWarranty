# Kiểm chứng không ghi database

## Snapshot hành vi JSON/validation/domain

`verification/java-domain-snapshots.json` lưu 100 quan sát (46 primitive/enum/Instant, 17 nullable/date/decimal,
25 validation, 9 blank/trim và 3 Payment). `JavaContractTests` và test EF model kiểm .NET theo các quan sát này;
EF test không mở connection.

```powershell
cd backend-dotnet
dotnet test Soopi.slnx --filter FullyQualifiedName~JavaContractTests
```

Không tự suy rộng kết quả ra mọi input, nano dưới 100ns, toàn miền decimal hay Unicode IDN.

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
Browser smoke dùng toàn bộ API mock; không thay thế kiểm DB có token/luồng ghi.
Login/logout cần chủ dự án duyệt riêng vì ghi tài khoản, refresh token và audit; luồng nghiệp vụ ghi cần DB `_IT` được duyệt.
