# MIGRATION_PLAN — LongManLoc Service Center: Spring Boot → ASP.NET Core Web API + React

Giai đoạn 1 (chỉ đọc). Nguồn: `D:\huit\nosql\Source\warranty-system\warranty-system-mysql` (nhánh `azure-sql`,
commit `b672254`, có thay đổi chưa commit ở `01_schema.sql`, README, docs). Không file nào của project gốc bị sửa.

## 0. Hiện trạng khác với giả định trong yêu cầu

| Giả định | Thực tế trong code | Hệ quả cho kế hoạch |
|---|---|---|
| Giao diện Thymeleaf render phía server | **Không có Thymeleaf.** Giao diện là 10 trang HTML tĩnh + JS thuần (`src/main/resources/static`), gọi REST API `/api/v1/**` bằng `fetch` | Backend đã là REST JSON. Giai đoạn 2 là **port API 1:1**, không phải "đổi template thành API". Giai đoạn 3 là viết lại 10 trang HTML/JS thành React |
| Đăng nhập kiểu form/session của Spring Security | JWT RS256 không trạng thái + refresh token xoay vòng (cookie HttpOnly cho web, body cho app di động) + portal token | Phương án xác thực .NET nên giữ nguyên mô hình này (mục 5) |
| Chỉ có web | Có **app di động khách hàng** dùng chung API (`docs/MOBILE_API.md`: `/auth/mobile/*`, `/portal/my/*`, push FCM, OTP SMS) | API .NET phải giữ **đúng URL, JSON, mã lỗi** để app không phải sửa |
| — | Schema SQL Server chỉ có bảng/ràng buộc/index (không procedure, trigger, view — D-077). Mọi nghiệp vụ nằm trong Java | Toàn bộ nghiệp vụ phải viết lại trong C#; DB chỉ là lưới an toàn thứ hai |

Quy mô: Java 25 / Spring Boot 4.1.1, ~19.000 dòng Java (260 file), 21 controller, **114 endpoint**, 47 bảng, 35 file
test (13 integration test). Frontend ~5.400 dòng JS + 2.900 dòng CSS. Máy: .NET SDK **10.0.302** (LTS; có cả 9.0.316),
Node **24.19.0**.

---

## 1. Entity / bảng SQL Server và quan hệ

Schema: `db/sqlserver/01_schema.sql` (47 bảng, collation `Latin1_General_100_CI_AI`, `READ_COMMITTED_SNAPSHOT ON`,
`DATETIME2(0)` lưu **giờ Việt Nam**). 21 bảng được map bằng JPA `@Entity`; 26 bảng còn lại truy cập bằng
`JdbcTemplate` (SQL viết tay).

Ký hiệu cột "Java": **E** = `@Entity` (lớp nêu kèm), **J** = JdbcTemplate.

### 1.1 Hệ thống, tài khoản, phân quyền

| Bảng | Khóa chính | Quan hệ chính | Java |
|---|---|---|---|
| DanhMucNhan | (Nhom, Ma) | — (nhãn hiển thị) | J (seed) |
| ChuyenTrangThaiHopLe | (TuTrangThai, DenTrangThai) | — (tham chiếu; luật thật trong `Ticket`) | — |
| BoDemMa | Khoa | — (bộ đếm sinh mã) | J `SqlCodeGenerator` |
| VaiTro | MaVaiTro | — | J |
| QuyenHan | MaQuyen | — | J |
| VaiTro_QuyenHan | (MaVaiTro, MaQuyen) | → VaiTro, QuyenHan | J (ma trận thật trong `RolePermissions`) |
| TaiKhoan | MaTaiKhoan (IDENTITY) | UNIQUE TenDangNhap (CI) | E `Account` |
| TaiKhoan_VaiTro | (MaTaiKhoan, MaVaiTro) | → TaiKhoan (CASCADE), VaiTro | E `@CollectionTable` trong `Account` |
| RefreshToken | MaToken (IDENTITY) | → TaiKhoan (CASCADE); UNIQUE TokenHash | E `RefreshToken` |
| TramDichVu | MaTram | — | J (danh mục) |
| NhanVien | MaNV | → TaiKhoan (0..1, filtered unique), TramDichVu | J `JdbcEmployeeRecords`, `SqlStaffDirectory` |
| KhachHang | MaKH | → TaiKhoan (0..1), → KhachHang (GopVaoMaKH); SĐT unique khi ACTIVE | E `Customer` |
| MaXacThucOTP | MaOTP (IDENTITY) | — | J `JdbcOtpStore` |
| ThietBiNhanThongBao | MaCaiDat | → TaiKhoan (CASCADE); UNIQUE PushToken | J `JdbcPushDeviceStore` |

### 1.2 Danh mục sản phẩm, thiết bị

| Bảng | Khóa chính | Quan hệ chính | Java |
|---|---|---|---|
| NhomThietBi | MaNhom | — | J `SqlCatalogStore` |
| LoaiThietBi | MaLoai | → NhomThietBi; ChecklistChanDoan JSON | J |
| HangSanXuat | MaHang | — | J |
| HangSanXuat_NhomThietBi | (MaHang, MaNhom) | n-n Hãng ↔ Nhóm | J |
| SanPham | MaSP | → HangSanXuat, LoaiThietBi | J `SqlProductCatalog` |
| ChinhSachBaoHanh | MaChinhSach | → SanPham (PRODUCT) hoặc chỉ HangSanXuat (BRAND) | J |
| BangGiaDichVu | MaDichVu | → NhomThietBi | J |
| ThietBi | MaThietBi | → SanPham, KhachHang; UNIQUE SoSerial_IMEI | E `Device` |

### 1.3 Yêu cầu online, tệp

| Bảng | Khóa chính | Quan hệ chính | Java |
|---|---|---|---|
| YeuCauBaoHanh | MaYeuCau | → NhomThietBi, LoaiThietBi, TramDichVu, NhanVien; ↔ PhieuTiepNhan (MaPhieuTN, filtered unique) | J `SqlWarrantyRequestStore` |
| TepDinhKem | MaTep (IDENTITY) | Đa hình: (LoaiChuSoHuu ∈ WARRANTY_REQUEST, HANDOVER_SIGNATURE; MaChuSoHuu) | J `DiskFileStorage` |

### 1.4 Tiếp nhận, điều phối, sửa chữa

| Bảng | Khóa chính | Quan hệ chính | Java |
|---|---|---|---|
| PhieuTiepNhan | MaPhieuTN | → TramDichVu, YeuCauBaoHanh, KhachHang, ThietBi, NhanVien, ChinhSachBaoHanh. `PhienBan` = optimistic lock; `ConMo` + filtered unique "1 phiếu mở / thiết bị" | E `TicketRow` (`@Version`) |
| LichSuTrangThai_ThietBi | MaLichSu (IDENTITY) | → PhieuTiepNhan (1-n) | E `StatusHistoryRow` |
| GhiChuPhieu | MaGhiChu (IDENTITY) | → PhieuTiepNhan, NhanVien | E `NoteRow` |
| PhanCong | MaPhanCong | → PhieuTiepNhan (1-1), NhanVien ×2 | E `AssignmentRow` |
| LichSuPhanCong | MaLichSu (IDENTITY) | → PhieuTiepNhan, NhanVien ×3 | E `AssignmentHistoryRow` |
| PhieuKiemTra | MaPhieuKT | → PhieuTiepNhan (1-1), NhanVien | E `InspectionRow` |
| PhieuSuaChua | MaPhieuSC | → PhieuTiepNhan (1-1), PhanCong (1-1), NhanVien | E `RepairOrderRow` |
| KetQuaSuaChua | MaKetQua | → PhieuSuaChua (1-n), NhanVien | E `RepairResultRow` |
| PhieuBanGiao | MaBanGiao | → PhieuTiepNhan (1-1), NhanVien, TepDinhKem (chữ ký) | E `HandoverRow` |

### 1.5 Báo giá, kho, thu tiền

| Bảng | Khóa chính | Quan hệ chính | Java |
|---|---|---|---|
| PhieuBaoGia | MaBaoGia | → PhieuTiepNhan (n-1, tối đa 1 hiệu lực: filtered unique), PhieuKiemTra, NhanVien ×2, BangGiaDichVu | E `QuotationRow` |
| ChiTietBaoGia | MaChiTietBG (IDENTITY) | → PhieuBaoGia (1-n), LinhKien; CHECK ThanhTien = SL×ĐG + công | E `QuotationLineRow` |
| NhaCungCap | MaNCC | — | J |
| LinhKien | MaLK | → NhaCungCap, NhomThietBi; tồn khả dụng = SoLuongTon − SoLuongDaGiu | J `SqlInventoryStore` |
| TonKhoTheoKe | (MaLK, MaKe) | → LinhKien; bất biến Σ = LinhKien.SoLuongTon | J |
| PhieuNhapKho / ChiTietNhapKho | MaPhieuNhap / MaChiTietNhap | → NhaCungCap, NhanVien / → PhieuNhapKho, LinhKien | E `StockReceiptRow`, `StockReceiptLineRow` |
| PhieuXuatKho / ChiTietXuatKho | MaPhieuXuat / MaChiTietXuat | → PhieuTiepNhan (1 chờ / phiếu), PhieuBaoGia, NhanVien ×3 / → LinhKien | E `StockIssueRow`, `StockIssueLineRow` |
| PhieuDieuChuyen | MaPhieuDC | → LinhKien, NhanVien ×2 | E `StockTransferRow` |
| HoaDon_PhieuThu | MaPhieuThu | → PhieuTiepNhan (UNIQUE: thu 1 lần), PhieuBaoGia, NhanVien | E `Payment` |

### 1.6 Nhật ký, thông báo

| Bảng | Khóa chính | Quan hệ chính | Java |
|---|---|---|---|
| NhatKyThaoTac | MaNhatKy (IDENTITY) | — (append-only: user app bị DENY UPDATE/DELETE) | J `AuditService` |
| ThongBao | MaThongBao (IDENTITY) | → VaiTro hoặc TaiKhoan | J `NotificationService` |
| ThongBao_DaDoc | (MaThongBao, MaTaiKhoan) | → ThongBao, TaiKhoan (CASCADE) | J |

Lưu ý cho EF Core: nhiều cột nghiệp vụ (`ConMo`, `ThanhTien`, 3 cột tổng báo giá, lịch sử trạng thái) **do ứng dụng
ghi**, có CHECK đối chiếu. Mã nghiệp vụ là chuỗi do ứng dụng sinh (`TN-2026-0917-00421`…), không phải IDENTITY.

---

## 2. Controller và endpoint

Tất cả dưới `/api/v1`. Không endpoint nào trả template. Cột **Quyền** là quyền kiểm ở tầng service (`@PreAuthorize`
`PERM_*`); "đăng nhập" = chỉ cần token. Cột **Web** là trang HTML đang gọi endpoint; "—" = web không gọi (dùng cho app
di động, gọi gián tiếp, hoặc chưa có màn hình). Lỗi luôn là `application/problem+json` (mục 4.1).

### 2.1 Xác thực — `AuthController` (`/auth`)

| Method | URL | Input | Output | Quyền | Web |
|---|---|---|---|---|---|
| POST | /auth/login | `{username, password, remember}` | `AuthResponse {accessToken, expiresIn, user: UserView}` + cookie `LML_RT` | công khai | login |
| POST | /auth/refresh | cookie `LML_RT`, header `X-Requested-With: fetch`, kiểm Origin | `AuthResponse` + cookie mới | công khai | mọi trang (api.js) |
| POST | /auth/logout?all= | cookie | 204, xóa cookie | công khai | shell |
| GET | /auth/me | — | `UserView` | đăng nhập | login, shell |
| POST | /auth/change-password | `{currentPassword, newPassword}` | `AuthResponse` | đăng nhập | login (?change=1), shell |

### 2.2 App di động — `MobileAuthController` (`/auth/mobile`)

| Method | URL | Input | Output | Quyền | Web |
|---|---|---|---|---|---|
| POST | /login | `{username, password}` (chỉ tài khoản khách) | `MobileAuthResponse {accessToken, expiresIn, refreshToken, refreshExpiresIn, user}` | công khai | — |
| POST | /refresh | `{refreshToken}` | `MobileAuthResponse` | công khai | — |
| POST | /logout | `{refreshToken, installationId, all}` | 204 (gỡ luôn thiết bị push) | công khai | — |
| POST | /change-password | `{currentPassword, newPassword}` | `MobileAuthResponse` | đăng nhập | — |
| POST | /otp | `{phone, purpose: REGISTER\|RESET_PASSWORD}` | 202 `OtpService.Issued` | công khai | — |
| POST | /register | `{phone, otp, fullName, password, email}` | 201 `MobileAuthResponse` | công khai | — |
| POST | /password-reset | `{phone, otp, newPassword}` | 204 | công khai | — |

### 2.3 Quản trị nhân viên — `AdminEmployeeController` (`/admin/employees`)

| Method | URL | Input | Output | Quyền | Web |
|---|---|---|---|---|---|
| GET | / ?q&role&status | — | `List<EmployeeAccountView>` | ACCOUNT_MANAGE | admin |
| POST | / | `{fullName, phone, email, specialty, skills[], maxActiveTickets, username, roles[]}` | 201 `CreatedEmployee` | ACCOUNT_MANAGE | admin |
| PATCH | /{code} | `{fullName, phone, email, specialty, skills, maxActiveTickets, onSite, workStatus}` | `EmployeeAccountView` | ACCOUNT_MANAGE | — |
| PUT | /{code}/roles | `{roles[]}` | `EmployeeAccountView` | ACCOUNT_MANAGE | admin |
| POST | /{code}/lock, /{code}/unlock | — | `EmployeeAccountView` | ACCOUNT_MANAGE | admin |
| POST | /{code}/reset-password | — | `{temporaryPassword}` (trả đúng 1 lần) | ACCOUNT_MANAGE | admin |

### 2.4 Khách hàng, thiết bị

| Method | URL | Input | Output | Quyền | Web |
|---|---|---|---|---|---|
| GET | /customers ?q&page&size | — | `PageResponse<CustomerView>` | CUSTOMER_READ_CONTACT | receptionist |
| POST | /customers | `{fullName, phone, email, address}` | 201 `CustomerView` | CUSTOMER_CREATE | — (web tạo qua POST /tickets) |
| GET | /customers/{code} | — | `CustomerView` | CUSTOMER_READ_CONTACT | receptionist |
| PATCH | /customers/{code}/contact | `{phone, email, address}` | `CustomerView` | CUSTOMER_UPDATE_CONTACT | — |
| POST | /customers/{code}/archive | — | `CustomerView` | CUSTOMER_ARCHIVE | — |
| POST | /customers/{code}/merge | `{targetCode}` | `CustomerView` | CUSTOMER_MERGE | — |
| GET | /customers/{code}/devices | — | `List<DeviceView>` | CUSTOMER_READ_CONTACT | — |
| GET | /customers/{code}/tickets | — | `List<TicketView>` | CUSTOMER_READ_CONTACT | — |
| GET | /customers/{code}/payments | — | `List<PaymentView>` | CUSTOMER_READ_PAYMENTS | — |
| POST | /devices | `{customerCode, productId, identifierType, serialOrImei, warrantyActivatedOn, warrantyExpiresOn, distributor}` | 201 `DeviceView` | DEVICE_REGISTER | — (web đăng ký qua POST /tickets) |
| GET | /devices/lookup ?serial | — | `DeviceView` | DEVICE_LOOKUP | receptionist |

### 2.5 Phiếu tiếp nhận — `TicketController`, `TechnicianController`

| Method | URL | Input | Output | Quyền | Web |
|---|---|---|---|---|---|
| GET | /tickets ?status&category&technician&sla&q&from&to&page&size | — | `PageResponse<TicketView>` | TICKET_READ_ALL \| READ_ASSIGNED | tickets, cashier |
| GET | /tickets/open | — | `List<TicketView>` | TICKET_READ_ALL | dispatch |
| POST | /tickets | `ReceiveTicketRequest` (customer {code \| newCustomer}, device {code \| newDevice}, warrantyRequestCode, channel, requestType, sealCondition, cosmetic{…}, reportedIssue, promisedReturnAt, estimatedCost, slaLevel) | 201 `TicketView` | TICKET_CREATE | receptionist |
| GET | /tickets/{code} | — | `TicketView` | TICKET_READ_ALL \| READ_ASSIGNED | dispatch, technician, cashier, tickets, receptionist |
| GET | /tickets/{code}/history | — | `HistoryView` | TICKET_READ_ALL \| READ_ASSIGNED | tickets |
| GET | /tickets/{code}/receipt | — | `ReceiptView` | TICKET_READ_ALL | — |
| GET | /tickets/{code}/assignment-candidates | — | `List<CandidateView>` | TICKET_ASSIGN | dispatch |
| POST | /tickets/{code}/assignment | `{technicianId, priority, note}` | `TicketView` | TICKET_ASSIGN | dispatch |
| PUT | /tickets/{code}/assignment | `{technicianId, note}` | `TicketView` | TICKET_REASSIGN | dispatch |
| POST / PUT | /tickets/{code}/inspection | `{findings, checklist[], waterDamage, classification, outOfWarrantyReason, proposedFix, reclassNote}` | `TicketView` | TICKET_DIAGNOSE | technician |
| POST | /tickets/{code}/repair/start | — | `TicketView` | TICKET_REPAIR | technician |
| POST | /tickets/{code}/repair/parts-ready | — | `TicketView` | TICKET_REPAIR \| TICKET_ASSIGN | technician |
| POST | /tickets/{code}/repair/results | `{workDone, qcSteps[6], qcResult, qcDetails}` | `TicketView` | TICKET_REPAIR | technician |
| POST | /tickets/{code}/handover | multipart: `data` (JSON `{receiverName, conditionOnReturn, returnedOldParts, newWarrantyNote, rating, recheck{5 mục}, customerConfirmed}`) + `signature` (PNG) | `TicketView` | HANDOVER_COMPLETE | cashier |
| GET | /tickets/{code}/handover-slip | — | `SlipView` | HANDOVER_COMPLETE | — |
| POST | /tickets/{code}/customer-notes, /internal-notes | `{text}` | `TicketView` | TICKET_NOTE_CUSTOMER / _INTERNAL | technician |
| GET | /technicians/workload | — | `List<WorkloadView>` | TICKET_ASSIGN | dispatch, tickets |
| GET | /technicians/me/queue | — | `List<TicketView>` | TICKET_READ_ASSIGNED | technician |

### 2.6 Báo giá — `QuotationController`

| Method | URL | Input | Output | Quyền | Web |
|---|---|---|---|---|---|
| POST | /tickets/{ticketCode}/quotations | `{validUntil, vatRate, serviceFeeCode, lines[{sku, description, quantity, unitPrice, laborFee}]}` | 201 `QuotationView` | QUOTE_CREATE | technician |
| GET | /quotations ?approvalStatus=PENDING&page&size | — | `PageResponse<QuotationView>` | QUOTE_REVIEW | dispatch |
| GET | /quotations/{code} | — | `QuotationView` | QUOTE_REVIEW \| QUOTE_CREATE \| TICKET_READ_ALL | dispatch, receptionist, technician |
| PUT | /quotations/{code}/lines | `{lines[]}` | `QuotationView` | QUOTE_CREATE | — |
| POST | /quotations/{code}/approve | `{note}` (tùy chọn) | `QuotationView` | QUOTE_REVIEW | dispatch |
| POST | /quotations/{code}/reject | `{note}` (bắt buộc) | `QuotationView` | QUOTE_REVIEW | dispatch |
| POST | /quotations/{code}/customer-decision | `{decision: ACCEPT\|DECLINE, reason}` | `QuotationView` | QUOTE_DECIDE_ON_BEHALF \| QUOTE_DECIDE_OWN | receptionist |

### 2.7 Kho — `InventoryController`

| Method | URL | Input | Output | Quyền | Web |
|---|---|---|---|---|---|
| GET | /parts ?q&category&lowStock | — | `List<PartView>` (giá vốn chỉ khi có INVENTORY_READ_COST) | INVENTORY_READ | technician, warehouse |
| GET | /parts/low-stock, /parts/{sku} | — | `List<PartView>` / `PartView` | INVENTORY_READ | — |
| POST | /stock-issues | `{ticketCode, quotationCode, lines[{sku, quantity}], reason}` | 201 `Issue` | STOCK_ISSUE_REQUEST | technician |
| GET | /stock-issues ?status | — | `List<Issue>` | STOCK_ISSUE_PROCESS | warehouse |
| GET | /stock-issues/mine ?status | — | `List<Issue>` | STOCK_ISSUE_REQUEST | technician |
| POST | /stock-issues/{code}/approve | `{lineBins[{sku, binCode}]}` (tùy chọn) | `Approval` | STOCK_ISSUE_PROCESS | warehouse |
| POST | /stock-issues/{code}/reject | `{reason}` | `Issue` | STOCK_ISSUE_PROCESS | warehouse |
| GET / POST | /stock-receipts | ?status / `{supplierId, batchNo, receivedOn, note, lines[{sku, quantity, unitCost, serialBatch, binCode}]}` | `List<Receipt>` / 201 `Receipt` | STOCK_RECEIPT_MANAGE | warehouse |
| GET | /stock-receipts/{code} | — | `Receipt` | STOCK_RECEIPT_MANAGE | — |
| PUT | /stock-receipts/{code}/lines | `{lines[]}` | `Receipt` | STOCK_RECEIPT_MANAGE | — |
| POST | /stock-receipts/{code}/approve, /reject `{reason}` | | `Receipt` | STOCK_RECEIPT_MANAGE | warehouse |
| GET / POST | /stock-transfers | ?status / `{sku, quantity, fromBin, toBin, reason}` | `List<Transfer>` / 201 `Transfer` | STOCK_TRANSFER_MANAGE | warehouse |
| POST | /stock-transfers/{code}/approve, /reject `{reason}` | | `Transfer` | STOCK_TRANSFER_MANAGE | warehouse |

### 2.8 Thu ngân — `PaymentController`, `CustomerPaymentController`

| Method | URL | Input | Output | Quyền | Web |
|---|---|---|---|---|---|
| GET | /tickets/{code}/billing | — | `BillingView` | PAYMENT_READ | cashier, tickets |
| POST | /tickets/{code}/payments | `{payerName, method: CASH\|BANK_TRANSFER\|E_WALLET\|CARD, note, expectedAmount}` | 201 `PaymentView` | PAYMENT_COLLECT | cashier |
| POST | /tickets/{code}/payments/free-warranty | `{note}` | 201 `PaymentView` | PAYMENT_COLLECT | cashier |

### 2.9 Yêu cầu online, cổng khách hàng

| Method | URL | Input | Output | Quyền | Web |
|---|---|---|---|---|---|
| GET | /warranty-requests ?status=PENDING_INTAKE&q | — | `List<Map>` | WARRANTY_REQUEST_HANDLE | receptionist |
| GET | /warranty-requests/{code} | — | `Map` | WARRANTY_REQUEST_HANDLE | receptionist |
| POST | /warranty-requests/{code}/cancel | `{reason}` | `Map` | WARRANTY_REQUEST_HANDLE | receptionist |
| GET | /portal/catalog | — | `PortalCatalog {categories[deviceTypes], identifierTypes, stations}` | công khai | portal |
| POST | /portal/lookup | `{code, phone}` (giới hạn 5/IP/phút, 10/mã/giờ) | `{accessToken (portal token 30'), expiresIn, scope, code}` | công khai | portal |
| POST | /portal/warranty-requests | multipart `data` (khách + thiết bị + mô tả ≤2000 + trạm + khung giờ) + `files` (≤5) | 201 `{code}` | công khai | portal |
| GET | /portal/warranty-requests/{code} | — | `RequestView` | PORTAL_TOKEN \| PORTAL_SELF | portal |
| GET | /portal/tickets/{code} | — | `PortalTicketView` | PORTAL_SELF \| PORTAL_TOKEN | portal |
| POST | /portal/tickets/{code}/quotation-decision | `{decision, reason}` | `PortalTicketView` | PORTAL_SELF \| PORTAL_TOKEN | portal |
| GET | /portal/my/tickets, /my/devices, /my/warranty-requests, /my/warranty-requests/{code} | — | danh sách / chi tiết | PORTAL_SELF | — (app) |
| GET / PATCH | /portal/my/profile | — / `{email, address}` | `Profile` | PORTAL_SELF | — (app) |
| POST | /portal/my/warranty-requests | multipart như trên, không có khối khách | 201 `{code}` | PORTAL_SELF | — (app) |

### 2.10 Danh mục, báo cáo, nhật ký, thông báo, tệp, tìm kiếm

| Method | URL | Input | Output | Quyền | Web |
|---|---|---|---|---|---|
| GET | /catalog/{type} | type ∈ device-categories, brands, products, warranty-policies, service-prices, suppliers, stations, parts | `List<Map>` (khóa `_id`, tên trường tiếng Anh) | CATALOG_READ | admin, receptionist, technician, warehouse, shell |
| GET | /catalog/{type}/{code} | — | `Map` | CATALOG_READ | — |
| POST | /catalog/{type} | `Map` | 201 `Map` | CATALOG_MANAGE | admin |
| PUT | /catalog/{type}/{code} | `Map` | `Map` | CATALOG_MANAGE | — |
| GET | /reports/revenue-monthly ?from&to&station | — | `List<MonthlyRevenue>` | REPORT_SYSTEM | admin |
| GET | /reports/quotation-reconciliation | — | `List<QuotationMismatch>` | REPORT_SYSTEM | — |
| GET | /reports/technician-performance, /turnaround, /warranty-ratio, /repeat-repairs, /tickets-by-status ?from&to&station | — | danh sách / tổng hợp | REPORT_OPERATIONS | admin, reports (repeat-repairs: —) |
| GET | /reports/sla-distribution | — | `List<SlaBucket>` | REPORT_OPERATIONS | reports |
| GET | /audit-logs ?entityType&entityId&actor&from&to&page&size(25\|50\|100)&sort | — | `PageResponse<AuditEntryView>` | AUDIT_READ | reports |
| GET | /notifications ?unread | — | `Inbox` | đăng nhập | shell |
| POST | /notifications/{id}/read, /read-all | — | 204 | đăng nhập | shell |
| PUT / DELETE | /notifications/devices/{installationId} | `{platform, pushToken, appVersion}` / — | 204 | đăng nhập | — (app) |
| GET | /files/{id} | — | nhị phân inline, `Cache-Control: private, no-store` | đăng nhập + chính sách sở hữu | receptionist, cashier, portal |
| GET | /search ?q | — | `SearchResult` | đăng nhập, không phải portal token | shell |

Ngoài `/api`: `GET /` → redirect `/login.html`; `GET /actuator/health`; Swagger UI chỉ ở profile `dev`.

---

## 3. Trang hiện tại → trang React

Mỗi trang HTML có `<body data-roles>`; `shell.js` dựng sidebar theo vai trò, hộp thông báo, tìm kiếm toàn cục, đổi mật
khẩu, đăng xuất. Đề xuất route React giữ tên dễ nhận (cần chốt, mục 8.3).

| Trang hiện tại (JS) | Vai trò | Route React đề xuất | Dữ liệu hiển thị | Form / thao tác |
|---|---|---|---|---|
| `/` | — | `/` → `/login` | — | — |
| `login.html` (login.js) | công khai | `/login` (+ `?next=`, `?change=1`) | — | Đăng nhập (ghi nhớ); form đổi mật khẩu bắt buộc lần đầu |
| `index.html` (dispatch.js) | DISPATCHER | `/dispatch` (+ `#quotes`, `#<mã phiếu>`) | Phiếu đang xử lý + cờ SLA; hàng chờ duyệt báo giá; tải công việc KTV | Phân công / đổi KTV (modal, ứng viên); xem, duyệt / từ chối báo giá |
| `pages/receptionist.html` (receptionist.js) | RECEPTIONIST | `/receptionist` | Hàng chờ yêu cầu online; tìm khách; tra serial; trạng thái BH; xem trước phiếu | Dùng / hủy yêu cầu online; form tiếp nhận nhiều khối (khách cũ/mới, thiết bị cũ/mới, ngoại quan, lỗi, SLA, hẹn trả, chi phí dự kiến); xác nhận báo giá thay khách tại quầy |
| `pages/technician.html` (technician.js) | TECHNICIAN | `/technician` (+ `#<mã phiếu>`) | Hàng đợi của tôi; chi tiết phiếu; tồn kho linh kiện; yêu cầu xuất của tôi | Ghi / sửa chẩn đoán (checklist, phân loại BH); lập báo giá (dòng linh kiện / công); yêu cầu xuất linh kiện; bắt đầu sửa; đủ linh kiện; kết quả sửa + QC 6 bước; ghi chú khách / nội bộ |
| `pages/warehouse.html` (warehouse.js) | WAREHOUSE_KEEPER | `/warehouse` với tab `inventory`, `stockin`, `stockout`, `transfer` | Tồn kho; phiếu nhập; phiếu xuất; điều chuyển | Tạo phiếu nhập (nhiều dòng), duyệt / từ chối; duyệt xuất (chọn kệ) / từ chối; tạo / duyệt / từ chối điều chuyển |
| `pages/cashier.html` (cashier.js) | CASHIER | `/cashier` (+ `#<mã phiếu>`) | Danh sách sẵn sàng bàn giao; chi tiết thanh toán | Thu tiền; xác nhận miễn phí; bàn giao (5 mục kiểm tra lại, chữ ký vẽ trên canvas → PNG, đánh giá) |
| `pages/tickets.html` (tickets.js) | DISPATCHER, RECEPTIONIST, CASHIER | `/tickets` | Tất cả phiếu (lọc, phân trang); chi tiết, lịch sử, thanh toán | Chỉ xem |
| `pages/reports.html` (reports.js) | DISPATCHER | `/reports` với tab `sla`, `performance`, `audit` | Phân bổ SLA; hiệu suất KTV; nhật ký thao tác (lọc, phân trang) | Lọc |
| `pages/admin.html` (admin.js + charts.js) | ADMIN | `/admin` với tab `accounts`, `catalogs`, `reports` | Tài khoản; danh mục; biểu đồ doanh thu, trạng thái, thời gian xử lý, tỉ lệ BH, hiệu suất | Tạo nhân viên; đổi vai trò; khóa / mở; đặt lại mật khẩu; thêm danh mục |
| `pages/customer-portal.html` (customer-portal.js) | công khai (portal token) | `/portal` | Tiến độ phiếu / yêu cầu sau tra cứu; báo giá | Tra cứu Mã + SĐT; khách đồng ý / từ chối báo giá; gửi yêu cầu online kèm ảnh / video (≤5 tệp) |

Thành phần dùng chung cần port: `api.js` (lớp gọi API, tự refresh 1 lần, chuyển về đăng nhập), `auth.js` (phiên,
đổi mật khẩu, cảnh báo thay đổi chưa lưu), `shell.js` (sidebar / thông báo / tìm kiếm), `ui.js` (toast, modal, định
dạng), `labels.js` (nhãn trạng thái tiếng Việt), `charts.js` (biểu đồ tự vẽ, không thư viện), `ui-errors.js`. CSS
(`tokens.css`, `base.css`, `components.css`) dùng lại nguyên văn để không đổi giao diện.

---

## 4. Service và logic nghiệp vụ quan trọng

### 4.1 Hạ tầng dùng chung (phải port trước)

- **Lỗi**: `DomainException(ErrorCode)` → `ApiErrorHandler` trả RFC 9457 Problem Details: `type =
  https://longmanloc.vn/errors/<CODE>`, `title` tiếng Việt, `detail` lấy từ `messages_vi.properties` (có tham số),
  `instance`, `code`, `correlationId`, `fieldErrors[{field, message}]`. 86 mã lỗi trong `ErrorCode`, mỗi mã gắn sẵn
  HTTP status (404/409/422/400/401/403/423/429/503/500). Lỗi validate → 400 `VALIDATION_FAILED`; JSON hỏng / sai kiểu
  → 400; vi phạm UNIQUE/CHECK/FK → dịch theo tên ràng buộc (`SqlErrors`) ra mã nghiệp vụ.
- **Mã nghiệp vụ** (`SqlCodeGenerator`): `MERGE BoDemMa WITH (HOLDLOCK) … OUTPUT` trong cùng transaction. Định dạng:
  ngày `TN|YC|BG-yyyy-MMdd-00000`; năm `PX|PN|DC|PT|PBG|PC|PKT|PSC|KQ-yyyy-00000`; toàn cục `KH-000000`, `NV-000`,
  `TB-000000`, `SP-0000`, `CS-0000`, `NCC-000`.
- **Thời gian** (`DbTime`): DB lưu giờ VN không phần lẻ giây; API trả `Instant` (UTC, `…Z`); `LocalDate` là
  `yyyy-MM-dd`. `Clock` được inject để test.
- **Transaction** (`TransactionRunner`): READ COMMITTED, tự thử lại tối đa 3 lần khi optimistic lock / deadlock /
  lock timeout, hết lượt → 409 `CONCURRENT_MODIFICATION`. Mỗi kết nối chạy `SET LOCK_TIMEOUT 10000`.
- **Truy vấn**: `SqlLike.contains` (escape LIKE), `SqlInList` (chia lô ≤2100 tham số), `ConcurrentReads` (đọc song
  song cho DB ở xa, D-075), phân trang `PageResponse {items, page, size, totalItems, totalPages}`.
- **Nhật ký** (`AuditService`): chỉ INSERT vào `NhatKyThaoTac`, mã người thao tác theo quy ước (mã NV / `KH:<mã>` /
  mã tài khoản / `SYSTEM`).
- **Thông báo** (`NotificationService`): theo vai trò / nhân viên / khách; `DuongDan` lưu đường dẫn trang cũ (ví dụ
  `index.html#TN-…`); kèm push FCM cho tài khoản khách (`PushDispatcher`).
- **Value object**: `PhoneNumber` (chuẩn hóa), `Imei` (15 số + Luhn), `SerialNumber`, `Money`.

### 4.2 Phiếu tiếp nhận — máy trạng thái (`Ticket`, 919 dòng; `JpaTicketRepository`, 816 dòng)

```
RECEIVED → INSPECTING → DIAGNOSED → { REPAIRING | AWAITING_PARTS | AWAITING_QUOTE_APPROVAL }
AWAITING_QUOTE_APPROVAL → { AWAITING_CUSTOMER_CONFIRMATION | DIAGNOSED }
AWAITING_CUSTOMER_CONFIRMATION → { AWAITING_PARTS | CANCELLED }
AWAITING_PARTS → REPAIRING → COMPLETED → DELIVERED
CANCELLED → RETURNED_UNREPAIRED          (DELIVERED, RETURNED_UNREPAIRED: kết thúc, ConMo = 0)
```

- Mọi lần chuyển ghi `LichSuTrangThai_ThietBi` cùng transaction, mô tả mặc định `Trạng thái đổi từ "<nhãn>" sang
  "<nhãn>"` (nhãn tiếng Việt của `TicketStatus`), kèm người, tên, vai trò; dòng đầu khi tạo phiếu. `ConMo` ghi cùng.
  `PhienBan` là optimistic lock; khi chỉ sửa bảng con thì tăng phiên bản (`PESSIMISTIC_FORCE_INCREMENT`).
- **Tiếp nhận** (`ReceptionService`): nhân viên phải ACTIVE + vai trò RECEPTIONIST; tạo khách / thiết bị mới nếu cần;
  một phiếu mở / thiết bị (`DEVICE_HAS_OPEN_TICKET`); yêu cầu online phải PENDING rồi chuyển CONVERTED; kênh mặc định
  COUNTER hoặc ONLINE_REQUEST; SLA mặc định 48h (12/24/48h); chụp snapshot khách / thiết bị / bảo hành; khách bắt buộc
  xác nhận ngoại quan; báo Điều phối + khách.
- **Phân công** (`AssignmentService`): chỉ ở RECEIVED; KTV hợp lệ (đang làm, có mặt, chưa vượt `SoPhieuToiDa`); đổi
  KTV ghi `LichSuPhanCong`, không cho đổi sang chính KTV cũ.
- **Chẩn đoán** (`InspectionService`): chỉ KTV phụ trách; FREE_WARRANTY cấm khi hết hạn BH hoặc vào nước; khác
  FREE_WARRANTY phải có lý do; khác với phân loại lúc nhận phải có ghi chú phân loại lại; checklist PENDING / PASS /
  FAIL / NA.
- **Sửa chữa** (`RepairService`): bắt đầu sửa chỉ cho ca miễn phí; "đủ linh kiện" chỉ khi báo giá toàn hàng đặt riêng
  (`SqlTicketWorkflowGuard`); kết quả cần đúng 6 bước QC (VISUAL, MAIN_FUNCTION, SECONDARY, POWER_CHARGING, DATA, FINAL),
  KCS PASS → COMPLETED, phải khớp kết quả từng bước.
- **Bàn giao** (`HandoverService`): chỉ từ COMPLETED hoặc CANCELLED; COMPLETED cần 5 mục kiểm tra đạt, chữ ký PNG
  ≤200 KB, khách xác nhận; CANCELLED không được ghi thời hạn BH mới; phải đã thu tiền / xác nhận miễn phí
  (`HANDOVER_UNPAID`); ghi hạn BH từng linh kiện đã xuất; chữ ký lưu đĩa + `TepDinhKem` (tệp đã lưu bị xóa nếu
  transaction lỗi).
- **Ghi chú**: khách / nội bộ, mã + vai trò người viết.

### 4.3 Báo giá (`Quotation`, `QuotationService`, `QuotationReviewService`, `CustomerDecisionService`)

- Chỉ lập khi phiếu DIAGNOSED, KTV phụ trách, phân loại không phải FREE_WARRANTY, chưa có báo giá hiệu lực.
- Tổng: dòng = SL × ĐG + công; linh kiện, công, VAT (mặc định 8%) **làm tròn HALF_UP về 0 chữ số**; tỉ lệ VAT chia với
  8 chữ số HALF_UP. Hạn hiệu lực không trước ngày lập.
- Chỉ sửa dòng khi PENDING (`QUOTE_LOCKED`); người duyệt không được là người lập (`QUOTE_SELF_REVIEW`); từ chối phải có
  ghi chú; từ chối nội bộ đưa phiếu về DIAGNOSED.
- Khách quyết định: tại quầy (RECEPTIONIST / DISPATCHER thay khách) hoặc portal; hết hạn → `QUOTE_EXPIRED`; từ chối cần
  lý do; đồng ý → AWAITING_PARTS, từ chối → CANCELLED (phiếu sửa chữa CANCELLED).

### 4.4 Kho (`StockIssueService`, `StockReceiptService`, `StockTransferService`, `SqlInventoryStore`)

- Yêu cầu xuất: theo báo giá (đã đồng ý) **hoặc** ca miễn phí với danh sách dòng (đúng một nguồn); một yêu cầu chờ /
  phiếu; **giữ hàng** nguyên tử bằng UPDATE có điều kiện (`SoLuongDaGiu`); ca miễn phí đưa phiếu sang AWAITING_PARTS.
- Duyệt xuất: chọn kệ (mặc định kệ chính), trừ tồn kệ + tồn tổng, ghi đơn giá xuất, phiếu → REPAIRING; từ chối: trả
  hàng giữ.
- Nhập kho: tạo PENDING, sửa dòng khi PENDING, duyệt → cộng tồn theo kệ (`MERGE`), từ chối cần lý do.
- Điều chuyển: kệ đích khác kệ nguồn, đủ tồn ở kệ nguồn khi duyệt.
- Bất biến: `LinhKien.SoLuongTon = Σ TonKhoTheoKe.SoLuong`; giá vốn ẩn nếu không có INVENTORY_READ_COST.

### 4.5 Thu ngân (`PaymentService`, `BillingQueryService`)

- Thu tiền: nhân viên CASHIER đang làm; phiếu COMPLETED; báo giá hiệu lực của đúng phiếu và khách đã đồng ý; số tiền
  **do server lấy** từ tổng báo giá, `expectedAmount` khác → `PAYMENT_AMOUNT_MISMATCH`; mỗi phiếu thu một lần.
- Miễn phí: phiếu COMPLETED, không có báo giá được đồng ý, ghi phiếu thu 0 đ, hình thức NONE.

### 4.6 Khách hàng, thiết bị, yêu cầu online, portal

- Khách: SĐT duy nhất khi ACTIVE; lưu trữ khi không còn phiếu mở; gộp hồ sơ chuyển thiết bị / phiếu / tài khoản.
  Hiển thị theo `CustomerDataPolicy`: FULL (Điều phối) / CONTACT / LIMITED (KTV) / NONE.
- Thiết bị: serial / IMEI duy nhất, IMEI kiểm Luhn, hạn BH lấy từ chính sách sản phẩm → hãng.
- Yêu cầu online: tệp nhận diện bằng magic bytes (JPEG / PNG / WebP ≤5 MB, MP4 ≤30 MB, tối đa 5 tệp); hủy cần lý do.
- Portal: tra cứu Mã + SĐT, sai mã hay sai SĐT cùng một lỗi; portal token chỉ thấy đúng một mã; ngoài phạm vi → 404.

### 4.7 Tài khoản, báo cáo, tìm kiếm, job định kỳ

- `EmployeeAdminService`: tạo nhân viên + tài khoản (mật khẩu tạm, buộc đổi), đổi vai trò, khóa / mở, đặt lại mật
  khẩu về `app.security.default-reset-password`; không khóa / bỏ quyền ADMIN cuối cùng (`ACCOUNT_LAST_ADMIN`), không tự
  khóa mình (`ACCOUNT_SELF_PROTECTION`); mỗi thay đổi tăng `PhienBanBaoMat` → token cũ bị thu hồi.
- `CustomerAccountService`: OTP SMS (SHA-256, dùng 1 lần, giới hạn số lần sai), đăng ký, quên mật khẩu.
- `ReportService` / `SqlReportRepository`: 8 báo cáo SQL tổng hợp theo khoảng ngày và trạm.
- `GlobalSearchService`: tìm phiếu / khách / thiết bị theo quyền.
- **Job định kỳ**: `SlaAlertJob` mỗi 5 phút báo phiếu sắp trễ SLA (ngưỡng 2h, mỗi phiếu một lần); `RefreshTokenCleanup`
  02:00 giờ VN xóa refresh token hết hạn quá 7 ngày.

---

## 5. Bảo mật hiện tại và đề xuất thay thế trong .NET

### 5.1 Hiện tại (Spring Security + OAuth2 Resource Server)

- **Stateless JWT RS256**: access token 15 phút; claim `sub` (mã tài khoản), `username`, `roles`, `principalType`,
  `displayName`, `ver` (= `TaiKhoan.PhienBanBaoMat`), `typ=access`, `employeeId` / `customerId`. Khóa RSA đọc từ PEM
  (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`); profile prod bắt buộc, ngoài prod tự sinh khóa tạm.
- **Thu hồi tức thời**: mỗi request so `ver` với DB (cache 30 giây) và trạng thái ACTIVE → 401 `AUTH_TOKEN_REVOKED`.
- **Refresh token**: chuỗi ngẫu nhiên 32 byte base64url, DB lưu SHA-256 hex; xoay vòng mỗi lần dùng, theo họ token;
  dùng lại token đã thu hồi → thu hồi cả họ (`AUTH_REFRESH_REUSED`). Hạn 12h, ghi nhớ 30 ngày. Web: cookie `LML_RT`
  (HttpOnly, Secure, SameSite=Strict, Path=`/api/v1/auth`), endpoint refresh / logout đòi `X-Requested-With: fetch` và
  Origin hợp lệ (chống CSRF). Mobile: token trong body.
- **Portal token**: JWT `typ=portal`, `scope=ticket:<mã>|request:<mã>`, 30 phút, không refresh.
- **Bắt buộc đổi mật khẩu**: filter chặn mọi API trừ `/auth/me`, `/auth/change-password`, `/auth/logout` (và bản
  mobile) → 403 `AUTH_PASSWORD_CHANGE_REQUIRED`.
- **Đăng nhập**: BCrypt cost 12, hash lưu dạng `{bcrypt}$2a$12$…` (CHECK DB đòi tiền tố `{…}`); so hash giả khi sai
  tên đăng nhập (chống dò); sai 5 lần → khóa tạm 15 phút; giới hạn tần suất 10/IP/phút + 5/tài khoản/phút (bộ nhớ).
  Chính sách mật khẩu: ≥10 ký tự, có chữ + số, không chứa tên đăng nhập, không thuộc `common-passwords.txt`.
- **Phân quyền**: 7 vai trò → 39 quyền (`RolePermissions`, ma trận trong code); kiểm ở **service** bằng
  `@PreAuthorize("hasAuthority('PERM_…')")`, cộng kiểm theo dòng (KTV chỉ phiếu được giao, dữ liệu khách theo
  projection, giá vốn, portal 404).
- **Header**: CSP chặt (`script-src 'self'`), Referrer-Policy same-origin, HSTS ở prod, CORS theo
  `APP_ALLOWED_ORIGINS` (có credentials), `X-Correlation-Id`.
- **Frontend**: access token trong bộ nhớ + `sessionStorage`; gặp 401 thì refresh đúng một lần (dùng chung Promise).

### 5.2 Đề xuất cho .NET

**Khuyến nghị: phương án A, giữ nguyên mô hình JWT + refresh token xoay vòng** (cần mình chốt):

| Thành phần | Cách làm trong .NET |
|---|---|
| Xác thực access / portal token | `Microsoft.AspNetCore.Authentication.JwtBearer` (gói cốt lõi), RS256 với cùng cặp khóa PEM; `OnTokenValidated` kiểm `typ`, `ver` + ACTIVE qua `IMemoryCache` 30 giây |
| Refresh token | Port nguyên `AuthService`: cùng thuật toán băm (SHA-256 hex) và bảng `RefreshToken` → **phiên đang mở (kể cả app di động) vẫn dùng tiếp sau khi chuyển**, nếu cấu hình cùng khóa RSA |
| Quyền | Policy cho từng `PERM_*` (đăng ký vòng lặp từ enum `Permission`) + `[Authorize(Policy = …)]` hoặc `IAuthorizationService` trong service; ma trận `RolePermissions` copy nguyên |
| Đổi mật khẩu bắt buộc, chống CSRF cookie | Middleware tương ứng hai filter Java |
| Rate limit đăng nhập / portal | `IMemoryCache` theo cửa sổ cố định như Java (giữ đúng ngưỡng); không dùng middleware RateLimiter vì khóa là username / mã phiếu |
| Băm mật khẩu | BCrypt tương thích `$2a$12$` + tiền tố `{bcrypt}` — .NET **không có BCrypt sẵn**, cần gói `BCrypt.Net-Next` (xin duyệt) |

Phương án loại: **B — cookie auth / session của ASP.NET Core** (app di động phải sửa, cần thêm chống CSRF cho mọi
API); **C — ASP.NET Core Identity** (bảng `AspNetUsers`… không khớp schema, phải đổi DB → vi phạm ràng buộc).

---

## 6. Cấu hình, thư viện, tệp, job

### 6.1 Cấu hình (`application*.yml`) → `appsettings.json` / User Secrets / biến môi trường

| Khóa Spring | .NET | Ghi chú |
|---|---|---|
| `spring.datasource.url/username/password` (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`) | `ConnectionStrings:Default` qua User Secrets / env | Placeholder trong appsettings; thêm `SET LOCK_TIMEOUT 10000` khi mở kết nối; pool 10 |
| `app.security.jwt.*` (issuer, TTL 15m / 12h / 30d / portal 30m, đường dẫn khóa) | `Security:Jwt:*` | Đường dẫn PEM qua env |
| `app.security.login.*` (5 lần, 15m) | `Security:Login:*` | |
| `app.security.allowed-origins` | `Security:AllowedOrigins` | Dev: `http://localhost:5173` (Vite) |
| `app.security.default-reset-password` (mặc định `LML@123`) | `Security:DefaultResetPassword` | Là bí mật → chỉ để placeholder (mục 8.3) |
| `app.storage.directory` (`./data/files`) | `Storage:Directory` | Dùng chung thư mục tệp với bản Java |
| `app.sms.*` (log \| esms, eSMS API key / secret / brandname / sandbox) | `Sms:*` | Gọi eSMS bằng `HttpClient` |
| `app.push.*` (log \| fcm, credentials, project id) | `Push:*` | FCM HTTP v1 |
| `app.sla.at-risk-threshold` 2h, `alerts.interval` 5m, `enabled` | `Sla:*` | |
| `app.catalog.cache-ttl` 5m | `Catalog:CacheTtl` | |
| `spring.servlet.multipart` 30 MB / 100 MB | `FormOptions` + Kestrel `MaxRequestBodySize` | |
| `spring.jackson.*` | `JsonSerializerOptions` | camelCase, enum dạng chuỗi, `Instant` → `…Z` |
| `management.endpoints` health | `MapHealthChecks("/actuator/health")` | Giữ URL cũ nếu hạ tầng đang gọi |
| `springdoc` (chỉ dev) | `Microsoft.AspNetCore.OpenApi` (có sẵn trong .NET 10) | UI Swagger cần thêm gói (xin duyệt) hoặc bỏ |
| `messages_vi.properties`, `common-passwords.txt` | Tệp tài nguyên copy nguyên văn | |

### 6.2 Thư viện bên thứ ba

| Java | Dùng cho | .NET |
|---|---|---|
| mssql-jdbc, Hibernate / JPA | DB | EF Core SQL Server (`Microsoft.EntityFrameworkCore.SqlServer`, cốt lõi) + `Microsoft.Data.SqlClient` |
| spring-security-oauth2-resource-server, Nimbus JOSE | JWT | `Microsoft.AspNetCore.Authentication.JwtBearer` (cốt lõi) |
| spring-security-crypto (BCrypt) | Mật khẩu | `BCrypt.Net-Next` (**xin duyệt**) |
| Caffeine | Cache, rate limit | `IMemoryCache` (có sẵn) |
| springdoc-openapi | Swagger | `Microsoft.AspNetCore.OpenApi` (có sẵn); UI: Swashbuckle / Scalar (**xin duyệt**, hoặc bỏ) |
| google-auth-library-oauth2-http | Token service account cho FCM | Tự ký JWT bằng `System.Security.Cryptography` + `HttpClient` (không cần gói), hoặc `Google.Apis.Auth` / `FirebaseAdmin` (**xin duyệt**) |
| Testcontainers, ArchUnit, JaCoCo, Spotless | Test / chất lượng | xUnit + `Microsoft.NET.Test.Sdk` (**xin duyệt**: gói test); không bắt buộc port ArchUnit / Spotless |

### 6.3 Upload tệp, email, job

- **Upload**: multipart có part `data` (JSON) + `files[]` / `signature`. Tệp lưu đĩa theo `Storage:Directory`, metadata
  ở `TepDinhKem`; tải xuống qua `/files/{id}` có kiểm quyền sở hữu. Kiểm MIME bằng magic bytes, không tin
  Content-Type.
- **Email**: không có chức năng gửi email (chỉ lưu trường email).
- **SMS**: OTP qua eSMS.vn hoặc ghi log (dev).
- **Push**: FCM HTTP v1 hoặc ghi log.
- **Job**: SLA (5 phút), dọn refresh token (02:00 VN) → `BackgroundService` + `PeriodicTimer` / tính giờ chạy kế
  tiếp theo giờ VN.

---

## 7. Mapping công nghệ Spring → .NET

| Spring / Java | ASP.NET Core / C# |
|---|---|
| `@RestController`, `@RequestMapping` | `[ApiController]` + `[Route]` (hoặc Minimal API) |
| `@RequestBody` / `@RequestParam` / `@PathVariable` / `@RequestPart` | `[FromBody]` / `[FromQuery]` / route / `[FromForm]` + `IFormFile` (part `data` đọc JSON thủ công) |
| `@Valid` + Bean Validation (`@NotBlank`, `@Positive`, `@Size`, `@Email`, `@DecimalMin`…) | DataAnnotations (`[Required]`, `[Range]`, `[StringLength]`, `[EmailAddress]`) + `InvalidModelStateResponseFactory` trả đúng Problem Details. Không cần FluentValidation |
| `@ControllerAdvice` | `IExceptionHandler` / middleware + `ProblemDetails` |
| Spring Data JPA, `@Entity`, `@Version` | EF Core `DbContext`, `[ConcurrencyCheck]` trên `PhienBan` (INT, không phải rowversion) |
| `JdbcTemplate` | `DbContext.Database.SqlQuery<T>` / `ExecuteSql` hoặc `SqlCommand` — giữ nguyên câu T-SQL |
| `TransactionTemplate` + retry | `IDbContextTransaction` + vòng thử lại (bắt `DbUpdateConcurrencyException`, `SqlException` 1205 / 1222) |
| `@Service` / `@Component` + DI constructor | Đăng ký DI `AddScoped` / `AddSingleton` |
| `@PreAuthorize("hasAuthority('PERM_X')")` | `[Authorize(Policy = "PERM_X")]` / `IAuthorizationService` |
| `SecurityContextHolder` / `CurrentActorProvider` | `IHttpContextAccessor` → `ClaimsPrincipal` → `AuthenticatedActor` |
| `java.time.Clock`, `Instant`, `LocalDate` | `TimeProvider`, `DateTimeOffset` / `DateTime` (UTC), `DateOnly` |
| `BigDecimal` + `RoundingMode.HALF_UP` | `decimal` + `Math.Round(x, 0, MidpointRounding.AwayFromZero)` (**mặc định .NET là banker's rounding — phải chỉ rõ**) |
| `record`, `enum` | `record`, `enum` (`JsonStringEnumConverter`) |
| `@Scheduled` | `BackgroundService` |
| `MessageSource` (`messages_vi.properties`) | Dictionary / `.resx` tiếng Việt |
| Caffeine cache | `IMemoryCache` |
| `@ConfigurationProperties` | Options pattern (`IOptions<T>`) |
| `OncePerRequestFilter` | Middleware |
| Testcontainers / JUnit / AssertJ | xUnit (+ test service với repository giả hoặc DB `_IT` nếu được phép) |
| `application-dev.yml` + `.env` | `appsettings.Development.json` + User Secrets |

---

## 8. Thứ tự chuyển đổi, rủi ro, điểm cần quyết định

### 8.1 Thứ tự đề xuất

Giai đoạn 2 (backend) chia thành các đợt nhỏ, mỗi đợt build + test + gọi thử:

1. **Khung**: solution `backend-dotnet/` (`Api`, `Tests`), cấu hình, kết nối DB, `DbContext` (scaffold DB-first chỉ đọc
   schema, hoặc map tay), JSON, Problem Details + 86 mã lỗi + thông điệp tiếng Việt, correlation id, health.
2. **Dùng chung**: `TimeProvider` / giờ VN, sinh mã `BoDemMa`, transaction + retry, `SqlErrors`, phân trang, audit,
   notification (chưa push).
3. **Identity**: JWT, refresh, portal token, policy quyền, đổi mật khẩu bắt buộc, rate limit, quản trị nhân viên,
   OTP / SMS, mobile auth.
4. **Danh mục, khách hàng, thiết bị, tìm kiếm**.
5. **Yêu cầu online + portal + tệp đính kèm**.
6. **Phiếu**: tiếp nhận, phân công, chẩn đoán, ghi chú, truy vấn (lịch sử trạng thái, `ConMo`, phiên bản).
7. **Báo giá** → **kho** → **sửa chữa** → **thu ngân + bàn giao** (theo chiều luồng nghiệp vụ).
8. **Báo cáo, nhật ký, thông báo + push FCM, job định kỳ**.

Giai đoạn 3 (frontend): khung Vite + router + lớp API + shell / đăng nhập → portal → tiếp nhận → điều phối → kỹ thuật
→ kho → thu ngân → phiếu → báo cáo → quản trị.

Giai đoạn 4: đối chiếu từng dòng mục 2 và 3. Đề xuất thêm: chạy song song bản Java và .NET trên **cùng database
`_Dev`**, gọi các endpoint GET bằng cùng tài khoản rồi so JSON (chỉ đọc, không ghi DB); dùng lại bộ `e2e/audit` cho
React nếu được duyệt.

### 8.2 Rủi ro chính

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| R1 | **Khối lượng lớn**: ~19k dòng Java, riêng `Ticket` + `JpaTicketRepository` ~1.700 dòng; dễ sót luật ẩn trong repository (lịch sử trạng thái, `ConMo`, tăng phiên bản) | Port theo đợt mục 8.1, đối chiếu `docs/MA_TRAN_NGHIEP_VU_SQL.md` và các test Java (dịch các ca test quan trọng sang xUnit) |
| R2 | **Thời gian**: DB lưu giờ VN không múi; EF Core đọc ra `DateTime Kind=Unspecified` → dễ trả sai giờ hoặc thiếu `Z` | Một bộ chuyển đổi dùng chung (tương đương `DbTime`) cho mọi cột `DATETIME2`; test đối chiếu JSON |
| R3 | **Hợp đồng JSON** phải khớp từng trường (app di động): tên trường, null, enum, `BigDecimal` (scale), `Map` có khóa `_id` | So JSON Java ↔ .NET trên cùng dữ liệu (giai đoạn 4) |
| R4 | **Làm tròn tiền**: .NET mặc định banker's rounding ≠ HALF_UP | `MidpointRounding.AwayFromZero` ở mọi chỗ; test tổng báo giá |
| R5 | **Đồng thời**: optimistic lock `PhienBan`, giữ hàng bằng UPDATE có điều kiện, `MERGE HOLDLOCK`, filtered unique index, retry deadlock | Giữ nguyên câu SQL; dịch lỗi theo tên ràng buộc như `SqlErrors` |
| R6 | `DbContext` không an toàn đa luồng → `ConcurrentReads` không port thẳng được | Mỗi luồng đọc dùng context / connection riêng, hoặc đọc tuần tự (chậm hơn với DB ở xa) |
| R7 | **Tương thích mật khẩu / phiên**: hash `{bcrypt}$2a$12$`, refresh token SHA-256, JWT RSA | Dùng BCrypt tương thích + cùng khóa RSA → người dùng không phải đăng nhập lại |
| R8 | **Cookie refresh khi frontend khác cổng** (Vite 5173 ↔ API) | Dev: Vite proxy `/api` → cùng origin (cookie SameSite=Strict, Path giữ nguyên); vẫn bật CORS cho `http://localhost:5173` theo yêu cầu |
| R9 | **Liên kết cũ trong DB**: `ThongBao.DuongDan` lưu `index.html#…`, `pages/technician.html#…` | Frontend React dịch đường dẫn cũ → route mới khi mở thông báo (không sửa DB) |
| R10 | Nhật ký append-only: user DB bị `DENY UPDATE/DELETE` trên `NhatKyThaoTac` | Chỉ INSERT; không để EF theo dõi / cập nhật bảng này |
| R11 | Collation `CI_AI`: so sánh trong SQL không phân biệt hoa thường / dấu, còn so sánh trong C# thì có | Để so sánh / tìm kiếm trong SQL như bản Java |

### 8.3 Quyết định đã chốt (2026-10-01, phiên hỏi đáp với chủ dự án)

| Chủ đề | Quyết định |
|---|---|
| Tên, vị trí | `D:\huit\nosql\Source\warranty-system\warranty-system-soopi\` gồm `backend-dotnet/`, `frontend-react/`; git riêng, chỉ commit khi được yêu cầu. Repo Java chỉ đọc và sẽ ngừng dùng |
| API | Giữ nguyên hợp đồng hiện tại (REST `/api/v1`, RFC 9457 + `code`/`fieldErrors`, `docs/MOBILE_API.md`); app di động do bên khác làm theo tài liệu. Không cần giữ phiên đăng nhập liên tục khi chuyển |
| Phạm vi | Port đủ 114 endpoint; OTP SMS và push FCM chỉ ở chế độ ghi log, tích hợp eSMS/FCM thật làm sau |
| Xác thực | Phương án A: JWT RS256 + refresh token xoay vòng (cookie web, body mobile) + portal token. Dev: tự sinh khóa tạm; prod: bắt buộc PEM qua env |
| Gói | `BCrypt.Net-Next`; `xunit`, `xunit.runner.visualstudio`, `Microsoft.NET.Test.Sdk`. Không Swagger UI (chỉ `/openapi/v1.json`), không EF Design |
| EF Core | Map tay 21 bảng JPA; 26 bảng còn lại dùng T-SQL giữ nguyên |
| Cấu trúc | .NET 10, `[ApiController]`; `Controllers/ Services/ Domain/ Data/Entities/ DTOs/` chia module bên trong |
| Test | Unit test không chạm DB ở giai đoạn 2; integration test đồng thời để giai đoạn 4 |
| Kiểm chứng | Connection string `_Dev` qua User Secrets (chủ dự án đặt). Chạy bản Java một lần (env, không `.env`) để lưu JSON mẫu vào `contract-snapshots/` |
| Triển khai | Cùng origin: .NET phục vụ bản build React; dev dùng Vite proxy + CORS cho `http://localhost:5173` |
| Route | `/login /dispatch /receptionist /technician /warehouse /cashier /tickets /reports /admin /portal` (+ hash). Thông báo mới lưu route mới; link `*.html` cũ được 301 / dịch ở React; `landing` trả route mới |
| Cấu hình | Mật khẩu đặt lại mặc định: placeholder, bắt buộc env/User Secrets |
| Frontend | React + Vite + TypeScript; CSS cũ dùng nguyên văn; khách đăng nhập web chỉ tra cứu như cũ; lễ tân vẫn 403 ở phần thanh toán |
| Nhịp | Dừng duyệt sau đợt 3 (khung, hạ tầng chung, identity), sau đó làm đợt 4–8 |
| `priority: "HIGH"` | Ví dụ Swagger sai; giữ enum `URGENT/NORMAL/LOW` (web chỉ dùng ba giá trị này) |
