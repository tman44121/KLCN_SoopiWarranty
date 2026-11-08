# Deploy bản 08/11/2026 — file cần chạy và prompt cho ChatGPT

Bản này gồm: cấu hình thời gian cho quản trị viên (SLA mặc định Tiêu chuẩn 48h), cột “Trễ hẹn SLA” trong báo cáo
kỹ thuật viên, trang Báo cáo & thống kê dạng tab, Danh mục hệ thống dạng tab và sửa giá ngay trên bảng, giữ giá
“Miễn phí trong bảo hành” theo lúc xuất kho, dropdown model từ danh mục và người gửi theo từng lần tiếp nhận, cấu hình bảo vệ
(khóa đăng nhập, OTP, chống spam, hạn phiên) cho quản trị viên.
Quy trình chung, quyền và rollback xem [DEPLOY_VPS](DEPLOY_VPS.md); tài liệu này chỉ liệt kê việc riêng của bản này.

## 1. Điều kiện

- PR `tman44121/KLCN_SoopiWarranty#17` đã merge vào `main`, workflow CI trên `main` xanh.
- Lấy `RELEASE_ID` (`<sha-40-ký-tự>-<run-id>-<attempt>`) và artifact `soopi-<RELEASE_ID>` chứa `soopi-image.tar.gz`
  từ GitHub Actions run đó. Auto-deploy chưa bật nên đưa image lên VPS thủ công (mục 4).

## 2. File SQL phải chạy — đúng thứ tự, TRƯỚC khi kích hoạt release

Chạy trên database `TrungTamBaoHanhDB` của VPS, sau khi backup (`COPY_ONLY, CHECKSUM` + `RESTORE VERIFYONLY`).
Cả ba file chạy lại nhiều lần được, chỉ thêm bảng/cột, không xóa hay sửa dữ liệu nghiệp vụ.

| Thứ tự | File | Tác dụng | Kiểm tra sau khi chạy |
| --- | --- | --- | --- |
| 1 | [database/14_time_settings.sql](../../database/14_time_settings.sql) | Tạo bảng `CauHinhThoiGian` (SLA, ngưỡng sắp trễ, hạn báo giá, giờ làm việc). Bảng trống = dùng mặc định SLA 48h. | `SELECT OBJECT_ID('dbo.CauHinhThoiGian')` khác `NULL` |
| 2 | [database/15_issue_service_price.sql](../../database/15_issue_service_price.sql) | Thêm cột `ChiTietXuatKho.DonGiaDichVuXuat`, điền giá tính khách hiện tại cho các dòng xuất cũ. | `SELECT COL_LENGTH('dbo.ChiTietXuatKho','DonGiaDichVuXuat')` khác `NULL`; `SELECT COUNT(*) FROM ChiTietXuatKho WHERE DonGiaDichVuXuat IS NULL` = 0 |
| 3 | [database/16_protection_settings.sql](../../database/16_protection_settings.sql) | Thêm cột JSON `CauHinhThoiGian.CauHinhBaoVe` (khóa đăng nhập, OTP, chống spam, hạn phiên). Cột trống = giữ giá trị cũ. Cần file 14 chạy trước. | `SELECT COL_LENGTH('dbo.CauHinhThoiGian','CauHinhBaoVe')` khác `NULL` |

Không chạy lại: `13_relax_imei.sql` (đã áp dụng 07/11/2026). Không chạy: `12_demo_catalog.sql`, `09_sample_public_reviews.sql`,
script trong `database/test-data/` (dữ liệu mẫu/reset). CI/CD không tự chạy migration.

Nếu quên chạy: thiếu file 14 thì hệ thống dùng mặc định nhưng không lưu được cấu hình thời gian; thiếu file 15 thì xuất kho
vẫn chạy nhưng giá trị bảo hành miễn phí của phiếu cũ đổi theo giá mới khi sửa giá danh mục; thiếu file 16 thì dùng mức bảo vệ cũ
nhưng lưu cấu hình bảo vệ báo lỗi.

Cách nhanh: chép 3 file SQL và [database/run_migrations_2026-11-08.sh](../../database/run_migrations_2026-11-08.sh) vào `/tmp`
của VPS rồi chạy `bash /tmp/run_migrations_2026-11-08.sh` bằng root. Script backup (`COPY_ONLY, CHECKSUM` + `RESTORE VERIFYONLY`),
chạy 14 → 15 → 16, in các câu kiểm tra, so số hàng trước/sau và gọi health; lỗi ở bước nào thì dừng ở bước đó.

Đã áp dụng trên `TrungTamBaoHanhDB` của VPS ngày 08/11/2026 sau khi deploy `4e98200`: cả 3 kiểm tra `OK`, không còn dòng xuất thiếu giá,
số hàng không đổi (637 phiếu, 319 dòng xuất, 5122 linh kiện), health `UP`. Backup trước khi chạy:
`/var/opt/mssql/data/TrungTamBaoHanhDB-pre-20261108-20261108-055416.bak`.

Lệnh thủ công (mật khẩu lấy từ biến trong container `db`, không in ra). `compose.yml` bắt buộc `SOOPI_RELEASE`, lấy theo bản đang chạy;
health loopback phải gửi `Host: soopiwarranty.id.vn` vì `AllowedHosts`:

```bash
cd /etc/soopi
export SOOPI_RELEASE="$(basename "$(readlink -f /opt/soopi/current)")"
docker compose --env-file compose.env -f compose.yml cp /tmp/14_time_settings.sql db:/tmp/14_time_settings.sql
docker compose --env-file compose.env -f compose.yml exec db bash -c \
  'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -I -b -f 65001 -d TrungTamBaoHanhDB -i /tmp/14_time_settings.sql'
```

Lặp lại với `15_issue_service_price.sql` rồi `16_protection_settings.sql`.

## 3. Cấu hình

Không có biến môi trường mới. Khóa `Sla:AtRiskThreshold` trong appsettings đã bỏ (ngưỡng nằm trong bảng cấu hình);
nếu `/etc/soopi/soopi.env` có `Sla__AtRiskThreshold` thì để nguyên cũng không ảnh hưởng.

## 4. Đưa release lên và kiểm tra

```bash
# user soopi-deploy
mkdir -p /opt/soopi/releases/<RELEASE_ID>
# scp soopi-image.tar.gz từ máy mình vào thư mục trên
sudo /usr/bin/python3 -I /usr/local/lib/soopi/activate.py <RELEASE_ID> https://soopiwarranty.id.vn
```

Sau khi kích hoạt:

- `curl -fsS https://soopiwarranty.id.vn/actuator/health` trả `{"status":"UP"}`.
- `curl -fsS https://soopiwarranty.id.vn/api/v1/settings/time` có `"standardSlaHours":48` và `"defaultSlaLevel":"STANDARD_48H"`.
- `curl -fsS https://soopiwarranty.id.vn/api/v1/settings/time` không chứa `protection` (ngưỡng chống spam không công khai).
- Đăng nhập admin: Cấu hình thời gian lưu được và có 4 khối bảo vệ (Đăng nhập, OTP, Gửi phiếu và tra cứu, Thời hạn phiên); Báo cáo có 3 tab và ô “Đang trễ hạn SLA”; Danh mục có 5 tab và nút “Sửa giá”.
- Lễ tân lập phiếu: mức “Tiêu chuẩn (48h)” được chọn sẵn.

Rollback code: chạy lại `activate.py` với `RELEASE_ID` cũ. Ba migration chỉ thêm bảng/cột nên bản cũ vẫn chạy; không xóa chúng.

## 5. Prompt cho ChatGPT

Dán nguyên khối dưới đây. Không dán mật khẩu, private key hay nội dung file `.env` vào chat.

````text
Bạn là kỹ sư DevOps hỗ trợ mình deploy dự án Soopi lên VPS. Đọc trước hai tài liệu trong repo
tman44121/KLCN_SoopiWarranty (nhánh main): docs/04-van-hanh/DEPLOY_VPS.md và
docs/04-van-hanh/DEPLOY_CHECKLIST_2026-11-08.md. Làm từng bước, dừng báo kết quả sau mỗi bước, và HỎI MÌNH
XÁC NHẬN trước mọi thao tác ghi (backup, chạy SQL, kích hoạt release, rollback). Nếu bạn không tự chạy lệnh được,
đưa từng lệnh để mình chạy rồi chờ mình dán kết quả. Trả lời bằng tiếng Việt.

Bối cảnh: VPS Ubuntu 24.04 (180.93.114.36), domain https://soopiwarranty.id.vn. Docker Compose ở /etc/soopi
(compose.yml, compose.env, soopi.env); service proxy (Caddy), app (soopi:<RELEASE_ID>, health
http://127.0.0.1:5080/actuator/health), db (SQL Server, database TrungTamBaoHanhDB). Release ở
/opt/soopi/releases/<RELEASE_ID>/soopi-image.tar.gz; kích hoạt bằng
sudo /usr/bin/python3 -I /usr/local/lib/soopi/activate.py <RELEASE_ID> https://soopiwarranty.id.vn (user soopi-deploy).

Quy tắc: không xin mật khẩu/khóa/.env; không chạy docker compose down -v, docker system prune, docker volume rm,
docker inspect hay docker compose config đầy đủ; không restart db; mật khẩu SQL chỉ lấy từ $MSSQL_SA_PASSWORD
trong container db và không in ra; lệnh lỗi thì dừng và giải thích.

Các bước:
0. Xác nhận PR #17 đã merge vào main và CI xanh; hướng dẫn mình lấy RELEASE_ID và tải artifact soopi-image.tar.gz.
1. Kiểm tra hiện trạng (chỉ đọc): docker ps, df -h /, free -h, health loopback + HTTPS, readlink /opt/soopi/current
   (ghi lại release cũ để rollback). Ổ trống < 3 GB thì dừng hỏi mình.
2. Backup TrungTamBaoHanhDB (COPY_ONLY, CHECKSUM) rồi RESTORE VERIFYONLY; ghi số hàng PhieuTiepNhan, ChiTietXuatKho, LinhKien.
3. Chạy đúng thứ tự database/14_time_settings.sql, database/15_issue_service_price.sql rồi
   database/16_protection_settings.sql (theo mục 2 của
   DEPLOY_CHECKLIST_2026-11-08.md), chạy các câu kiểm tra trong bảng đó, đối chiếu số hàng không đổi.
   Không chạy 13_relax_imei.sql, 12_demo_catalog.sql, 09_sample_public_reviews.sql hay database/test-data/.
4. Upload soopi-image.tar.gz vào /opt/soopi/releases/<RELEASE_ID>/, kiểm tra kích thước, rồi chạy activate.py.
   Nếu script tự rollback, lấy log: docker compose --env-file /etc/soopi/compose.env -f /etc/soopi/compose.yml logs --tail=200 app
5. Kiểm tra theo mục 4 của DEPLOY_CHECKLIST_2026-11-08.md và nhắc mình tự kiểm tra các màn trên trình duyệt.
Rollback chỉ khi mình yêu cầu: activate.py với release cũ; không hoàn tác migration; chỉ restore backup khi mình
yêu cầu rõ ràng sau khi bạn giải thích sẽ mất dữ liệu phát sinh sau lúc backup.

Cuối cùng tóm tắt: release cũ → mới, file backup, kết quả từng migration, kết quả health/kiểm tra, việc mình cần làm tay.
````
