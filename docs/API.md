# Hợp đồng API Soopi

Base path `/api/v1`; dev API `http://localhost:8080`. Có 114 operation theo
[ENDPOINTS](../verification/ENDPOINTS.md). Đặc tả JSON ở `/openapi/v1.json` **chỉ trong Development**,
không có Swagger UI. DTO/controller hiện có là nguồn xác định input/output từng endpoint.

Tài liệu mô tả contract đã port; không có nghĩa 114 hành vi đã nghiệm thu bằng DB thật.
Xem [MIGRATION_VERIFICATION](MIGRATION_VERIFICATION.md) cho phạm vi bằng chứng.

## Gọi API

JSON request dùng `Content-Type: application/json`; có thể gửi `X-Correlation-ID` để đối chiếu log.
Endpoint có bảo vệ cần `Authorization: Bearer <ACCESS_TOKEN>`. Không gửi bearer hỏng vào endpoint công khai:
security vẫn từ chối 401. Prefix `/api` phân biệt hoa/thường theo boundary đã port.

Hai GET công khai có thể dùng kiểm kết nối mà không đăng nhập:

```powershell
Invoke-RestMethod 'http://localhost:8080/actuator/health'
Invoke-RestMethod 'http://localhost:8080/api/v1/portal/catalog'
```

Health 200 khi DB nối được, body:

```json
{"groups":["liveness","readiness"],"status":"UP"}
```

Health trả 503/DOWN khi DB không nối được. Các sub-probe Actuator/info bị chặn 403 theo Java.

## Xác thực web

| Method / path | Input / kết quả chính |
|---|---|
| `POST /api/v1/auth/login` | `{username,password,remember}` → `{accessToken,expiresIn,user}` + cookie refresh |
| `POST /api/v1/auth/refresh` | Cookie `LML_RT` → access token/user mới, xoay refresh cookie |
| `POST /api/v1/auth/logout?all=false` | Thu hồi phiên hoặc các phiên theo tham số; 204, xóa cookie |
| `GET /api/v1/auth/me` | Bearer access token → UserView |
| `POST /api/v1/auth/change-password` | `{currentPassword,newPassword}` → AuthResponse |

Ví dụ login body (placeholder, không phải tài khoản mẫu):

```json
{"username":"<USERNAME>","password":"<PASSWORD>","remember":false}
```

UserView gồm `accountId`, `username`, `displayName`, `employeeId`, `customerId`, `roles`, `permissions`,
`landing`, `mustChangePassword`. RoleView gồm `code,label,landing`; không hardcode quyền client theo landing.

Access token RS256 mặc định 15 phút; refresh 12 giờ hoặc 30 ngày khi remember; portal token 30 phút.
Web cookie `LML_RT`: HttpOnly, Secure, SameSite=Strict, Path `/api/v1/auth`.
Gọi refresh/logout bằng `credentials: include` và **`X-Requested-With: fetch`**; Origin nếu có phải nằm
trong danh sách cho phép hoặc là chính origin API. Frontend api.js xử lý các yêu cầu này sẵn.

Tài khoản `mustChangePassword` chỉ được dùng nhóm me/đổi mật khẩu/logout cho tới khi đổi xong.
Login, refresh, logout và đổi mật khẩu ghi tài khoản/token/audit; không dùng để “thử GET” khi chưa được duyệt ghi DB.

## Mobile và portal

Mobile dùng `/api/v1/auth/mobile`: login, refresh, logout, change-password, otp, register, password-reset.
Login chỉ nhận tài khoản khách; response thêm `refreshToken,refreshExpiresIn`, refresh gửi token trong JSON body.
OTP purpose là `REGISTER` hoặc `RESET_PASSWORD`; SMS hiện chỉ `log`, không gửi thật.

`POST /api/v1/portal/lookup` nhận `{code,phone}` để cấp token phạm vi cho một ticket/request.
Portal token có `typ=portal`, không dùng refresh của nhân viên và không được quyền truy cập các phiếu khác.
Nhóm `/portal/my/*` và scope từng endpoint phải theo controller/service, không suy mọi token portal là tài khoản khách.

## JSON và phân trang

- Tên trường camelCase, tên field/enum phân biệt hoa/thường. Dùng tên enum chuẩn, ví dụ `NORMAL`, `REGISTER`.
  Để giữ Jackson cũ, các ordinal enum hợp lệ vẫn được nhận; không dùng ordinal cho client mới.
- Instant ghi UTC ISO-8601 `…Z`; ngày ghi `yyyy-MM-dd`; tiền là JSON number, không phải chuỗi định dạng tiền.
  Bool primitive thiếu/null mặc định false; trường nullable và scalar coercion theo các case oracle đã kiểm.
- Không phụ thuộc số chữ số lẻ của money sau khi đọc DB hoặc thứ tự phần tử của `fieldErrors`.
- Các endpoint dùng `PageRequestParams`: `page` bắt đầu từ 0, `size` thuộc 25/50/100,
  `sort=field,asc` hoặc `field,desc` trong allowlist của endpoint. Không phải mọi endpoint đều trả page.

PageResponse có `items,page,size,totalItems,totalPages`. Ví dụ protected GET (chỉ chạy sau khi được duyệt đăng nhập):

```http
GET /api/v1/tickets?page=0&size=25
Authorization: Bearer <ACCESS_TOKEN>
```

## Lỗi

Content-Type `application/problem+json`; body minh họa của validation:

```json
{
  "type":"https://longmanloc.vn/errors/VALIDATION_FAILED",
  "title":"Yêu cầu không hợp lệ",
  "status":400,
  "detail":"Vui lòng kiểm tra lại các trường còn thiếu hoặc chưa hợp lệ.",
  "instance":"/api/v1/auth/login",
  "code":"VALIDATION_FAILED",
  "correlationId":"<CORRELATION_ID>",
  "fieldErrors":[{"field":"password","message":"must not be blank"}]
}
```

Giữ error URI/cookie/issuer kỹ thuật của Java dù brand hiển thị là Soopi.
Form dùng `fieldErrors[].field` để nối với trường; không dựa vị trí mảng. Body hỏng/sai kiểu/`null`
trả 400 với `fieldErrors: []`. API có 86 mã lỗi; xem
[`ErrorCode.cs`](../backend-dotnet/src/Soopi.Api/Domain/Shared/ErrorCode.cs).
401 yêu cầu xác thực, 403 thiếu quyền, 404 có thể là dữ liệu không tồn tại hoặc không được phép lộ;
409 thường là xung đột nghiệp vụ. Kiểm `code` thay vì suy mọi lỗi cùng HTTP status là một nguyên nhân.

## Multipart và tệp

Portal tạo yêu cầu: `POST /portal/warranty-requests` hoặc `/portal/my/warranty-requests`:
`multipart/form-data` có part **`data`** chứa JSON và các part **`files`** chứa tệp.
`data` được nhận dưới dạng Blob/file application/json hoặc trường text. Để browser tự đặt boundary, không tự
gán Content-Type cho FormData. Cấu trúc `WarrantyRequestData`/`OwnWarrantyRequestData` xem
[`PortalServices.cs`](../backend-dotnet/src/Soopi.Api/Services/Portal/PortalServices.cs).

Backend tối đa 5 tệp: JPEG/PNG/WebP ≤5 MiB/tệp, MP4 ≤30 MiB/tệp; kiểm magic bytes, không tin đuôi tên/MIME header.
Giới hạn request/multipart chung 100 MiB. UI cũ ghi 3 tệp, chưa chốt thay đổi nghiệp vụ.
Chữ ký bàn giao PNG ≤200 KiB có contract riêng tại
[`HandoverService.cs`](../backend-dotnet/src/Soopi.Api/Services/Tickets/HandoverService.cs).

`GET /api/v1/files/{id}` kiểm quyền chủ sở hữu, trả binary với Content-Type thực, inline disposition,
`Cache-Control: private, no-store`; ngoài phạm vi trả 404. Tệp cần cả metadata DB và nội dung storage.
Upload/tạo yêu cầu/bàn giao là luồng ghi, cần DB kiểm được duyệt trước khi chạy tích hợp.

## Tra cứu theo nhóm

| Nhóm | Prefix / nguồn implementation |
|---|---|
| Nhân viên/tài khoản | `/admin/employees`, `Controllers/Identity/` |
| Danh mục/khách/thiết bị | `/catalog`, `/customers`, `/devices`, `CatalogCustomerDeviceControllers.cs` |
| Phiếu/KTV/tìm kiếm | `/tickets`, `/technicians`, `/search`, `TicketControllers.cs` |
| Báo giá/kho/thu tiền/bàn giao | `/quotations`, `/parts`, `/stock-issues`, `/stock-receipts`, `/stock-transfers`, `/tickets/*`, `QuotationInventoryBillingControllers.cs` |
| Portal/yêu cầu/tệp | `/portal`, `/warranty-requests`, `/files`, `PortalRequestFileControllers.cs` |
| Báo cáo/audit/thông báo | `/reports`, `/audit-logs`, `/notifications`, `ReportNotificationControllers.cs` |

Tên route cụ thể, cả method và URL đầy đủ, dùng [ENDPOINTS](../verification/ENDPOINTS.md);
không ghép prefix suy đoán để gọi endpoint.
