#!/usr/bin/env bash
# Chạy trên VPS bằng root: backup TrungTamBaoHanhDB rồi áp dụng 14 → 15 → 16. Dừng ngay khi có lỗi.
# Trước đó chép 3 file SQL vào /tmp của VPS (xem docs/04-van-hanh/DEPLOY_CHECKLIST_2026-11-08.md).
# Không in mật khẩu: sqlcmd lấy $MSSQL_SA_PASSWORD bên trong container db.
set -euo pipefail
cd /etc/soopi
# compose.yml bắt buộc SOOPI_RELEASE; dùng release đang chạy (chỉ exec/cp vào db, không tạo lại container).
export SOOPI_RELEASE="$(basename "$(readlink -f /opt/soopi/current)")"
DC=(docker compose --env-file compose.env -f compose.yml)
sql() { "${DC[@]}" exec -T db bash -c 'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -I -b -f 65001 -d TrungTamBaoHanhDB "$@"' _ "$@"; }
counts() { sql -h -1 -W -Q "SET NOCOUNT ON; SELECT 'PhieuTiepNhan', COUNT(*) FROM PhieuTiepNhan UNION ALL SELECT 'ChiTietXuatKho', COUNT(*) FROM ChiTietXuatKho UNION ALL SELECT 'LinhKien', COUNT(*) FROM LinhKien"; }

FILES=(14_time_settings.sql 15_issue_service_price.sql 16_protection_settings.sql)
for f in "${FILES[@]}"; do [[ -s /tmp/$f ]] || { echo "Thiếu /tmp/$f"; exit 1; }; done

echo "== Hiện trạng"
df -h / | tail -1
curl -fsS -H "Host: soopiwarranty.id.vn" http://127.0.0.1:5080/actuator/health; echo
echo "== Số hàng trước"; counts | tee /tmp/soopi-counts-before.txt

echo "== Backup (COPY_ONLY, CHECKSUM) + RESTORE VERIFYONLY"
stamp=$(date +%Y%m%d-%H%M%S)
sql -h -1 -W -Q "SET NOCOUNT ON; DECLARE @p nvarchar(4000) = CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000)) + N'/TrungTamBaoHanhDB-pre-20261108-$stamp.bak';
BACKUP DATABASE TrungTamBaoHanhDB TO DISK = @p WITH COPY_ONLY, CHECKSUM, INIT;
RESTORE VERIFYONLY FROM DISK = @p WITH CHECKSUM; SELECT @p AS BackupFile;"

for f in "${FILES[@]}"; do
  echo "== Chạy $f"
  "${DC[@]}" cp "/tmp/$f" "db:/tmp/$f"
  sql -i "/tmp/$f"
done

echo "== Kiểm tra"
sql -h -1 -W -Q "SET NOCOUNT ON;
SELECT 'CauHinhThoiGian', CASE WHEN OBJECT_ID('dbo.CauHinhThoiGian') IS NULL THEN 'THIEU' ELSE 'OK' END;
SELECT 'DonGiaDichVuXuat', CASE WHEN COL_LENGTH('dbo.ChiTietXuatKho','DonGiaDichVuXuat') IS NULL THEN 'THIEU' ELSE 'OK' END;
SELECT 'Dong xuat chua co gia', COUNT(*) FROM ChiTietXuatKho WHERE DonGiaDichVuXuat IS NULL;
SELECT 'CauHinhBaoVe', CASE WHEN COL_LENGTH('dbo.CauHinhThoiGian','CauHinhBaoVe') IS NULL THEN 'THIEU' ELSE 'OK' END;"
echo "== Số hàng sau"; counts | tee /tmp/soopi-counts-after.txt
diff /tmp/soopi-counts-before.txt /tmp/soopi-counts-after.txt && echo "Số hàng không đổi"
curl -fsS -H "Host: soopiwarranty.id.vn" http://127.0.0.1:5080/actuator/health; echo
echo "Xong."
