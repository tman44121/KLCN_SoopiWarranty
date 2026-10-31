# Deploy Soopi bằng Caddy + Docker

VPS mới đã kiểm tra ngày 22/10/2026: Ubuntu 24.04 x64, Docker 29.9.2, Compose 5.6.1,
**3916 MiB RAM vật lý và 4096 MiB swap**, ổ 30 GB còn 20 GB. aaPanel có sẵn; Nginx chưa chạy,
cổng 80/443 đang trống, UFW đã cho phép 80/443. Domain `soopiwarranty.id.vn` phân giải về
`180.93.114.36`. Khóa SSH của VPS mới đã xác minh bằng fingerprint từ console.

GitHub build/test/audit rồi tạo image .NET chứa cả React. Image được nén thành artifact và chuyển
qua SSH; không cần registry hay build trên VPS. Caddy trong Docker nhận traffic công khai, tự cấp/
gia hạn HTTPS và reverse proxy tới `app:8080`; aaPanel vẫn quản lý host ở cổng riêng.
Compose giữ API tại `127.0.0.1:5080` để kiểm health cục bộ và SQL chỉ
bind `127.0.0.1:1433`. Không cài thêm Nginx hoặc .NET service bằng apt.

Đã cài Caddy qua Compose; Let’s Encrypt cấp chứng thư thành công, HTTP trả 308 sang HTTPS.
Ứng dụng đang chạy với release `063acbba7d7d64c7608fd96558e3968703a6140c-0-2`;
health công khai trả `UP`, trang chủ trả HTTP 200 với TLS hợp lệ. Release đầu được build từ gói
publish local vì Docker Desktop chưa chạy. Tài khoản `soopi-deploy`, public key CI và sudo rule chỉ
cho script activation đã được cài; private key nằm trong `artifacts/ssh` (gitignore). GitHub secrets/
variables chưa cấu hình, nên auto deploy chưa bật.

SQL Server 2025 Express đang healthy trên VPS; database `TrungTamBaoHanhDB` đã restore từ nguồn
`TrungTamBaoHanhDB_Dev` đã được chủ dự án chọn. DB online, compatibility 170, recovery SIMPLE,
17.469 hàng; login `soopi_app` đã được cấp role `warranty_app_role`. Backup mới có checksum được
giữ trong `artifacts/soopi-db-backup/` trên máy quản trị và bản tạm ở `/root/soopi-db-migration/`.
Ba tệp thật được khôi phục dưới `/var/lib/soopi/files`; 428 bản ghi khác trỏ tới
`seed/signatures/blank.png`, nhưng blob mẫu chưa tìm thấy trong các thư mục ứng dụng.
Để các lần push `main` tự deploy, cần thêm GitHub environment secrets `VPS_SSH_KEY`,
`VPS_KNOWN_HOSTS` và repository variables `VPS_HOST`, `PUBLIC_URL`, `DEPLOY_ENABLED`; sau đó commit
và push các thay đổi trong repo. Release đang chạy là bản khởi tạo thủ công, không phải lần chạy GitHub Actions.

## 1. Chuẩn bị quyền deploy

Các lệnh một lần dưới đây chạy trong phiên quản trị root, sau khi upload thư mục `deploy/`
từ repo vào `/root/soopi-deploy/` trên VPS mới:

```bash
docker --version
docker compose version
free -h
df -h /
adduser --disabled-password --gecos '' soopi-deploy
install -d -o root -g root -m 0755 /opt/soopi /usr/local/lib/soopi
install -d -o soopi-deploy -g soopi-deploy -m 0755 /opt/soopi/releases
install -d -o root -g root -m 0700 /etc/soopi
install -d -o root -g 1654 -m 0750 /etc/soopi/keys
install -d -o 1654 -g 1654 -m 0750 /var/lib/soopi/files
install -d -o soopi-deploy -g soopi-deploy -m 0700 /home/soopi-deploy/.ssh
install -o root -g root -m 0644 /root/soopi-deploy/compose.yml /etc/soopi/compose.yml
install -o root -g root -m 0644 /root/soopi-deploy/Caddyfile /etc/soopi/Caddyfile
install -o root -g root -m 0644 /root/soopi-deploy/activate.py /usr/local/lib/soopi/activate.py
printf '%s\n' 'soopi-deploy ALL=(root) NOPASSWD: /usr/bin/python3 -I /usr/local/lib/soopi/activate.py *' > /etc/sudoers.d/soopi-deploy
chmod 0440 /etc/sudoers.d/soopi-deploy
visudo -cf /etc/sudoers.d/soopi-deploy
```

Không thêm `soopi-deploy` vào group Docker vì group này có quyền tương đương root. CI chỉ được
sudo chạy script cố định do root sở hữu. Script kiểm release ID, đường dẫn và HTTPS origin;
Compose và script không nằm trong thư mục CI được ghi. Khi sửa hai file này, quản trị cập nhật
bản đã review trong `/etc/soopi` và `/usr/local/lib/soopi` riêng, không tự chạy script vừa upload bằng root.

## 2. Cấu hình SQL, ứng dụng và RSA key

```bash
install -o root -g root -m 0600 /root/soopi-deploy/compose.env.example /etc/soopi/compose.env
install -o root -g root -m 0600 /root/soopi-deploy/soopi.env.example /etc/soopi/soopi.env
nano /etc/soopi/compose.env
nano /etc/soopi/soopi.env
```

Trong `compose.env`, cấu hình dùng SQL Server 2025 Express và password quản trị mạnh.
Nguồn `_Dev` hiện có file dữ liệu 72 MB, không dùng các tính năng đã kiểm tra bị giới hạn;
Express miễn phí, giới hạn 50 GB/database, tối đa 4 lõi và 1.410 MB buffer pool. Nâng edition
nếu dữ liệu hoặc nhu cầu tính năng vượt giới hạn. `Developer` chỉ dành cho dev/test.
Đây là biến Compose: password có thể dùng chuỗi hex + ký tự chữ/số/ký hiệu để tránh lỗi nội suy.
Không để password `CHANGE_ME`.

`soopi.env` dùng **raw env_file**, giữ nguyên ký tự `$` và `#` trong giá trị; không bao toàn bộ
connection string bằng dấu nháy như EnvironmentFile của systemd. SQL host là `db`, không phải
localhost bên trong container app. Đặt login `soopi_app` riêng, không dùng `sa` cho nghiệp vụ.
Origin/AllowedHosts trong mẫu đã đặt cho `soopiwarranty.id.vn`; không gửi các file env thật vào chat hoặc Git.

Với môi trường mới, tạo cặp RSA một lần; nếu cần giữ token cũ, dùng cặp key hiện có qua kênh riêng:

```bash
umask 077
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out /etc/soopi/keys/private.pem
openssl pkey -in /etc/soopi/keys/private.pem -pubout -out /etc/soopi/keys/public.pem
chown root:1654 /etc/soopi/keys/private.pem /etc/soopi/keys/public.pem
chmod 0640 /etc/soopi/keys/private.pem /etc/soopi/keys/public.pem
```

App chạy UID 1654, keys mount chỉ đọc vào `/run/soopi-keys`, upload mount vào `/data/files`.
DB dùng named volume `soopi_sql_data`. Giữ DB + upload + key/env tương ứng khi backup/restore.
Không tạo lại key hoặc ghi đè cấu hình thật mỗi deploy.

Sau khi đã xác nhận RAM vật lý và edition/password, khởi động **chỉ DB**:

```bash
SOOPI_RELEASE=initial docker compose --env-file /etc/soopi/compose.env -f /etc/soopi/compose.yml up -d db
SOOPI_RELEASE=initial docker compose --env-file /etc/soopi/compose.env -f /etc/soopi/compose.yml ps
```

App có limit 768 MB, SQL 2 GB; đây là điểm khởi đầu cho máy ít nhất 4 GB RAM, cần đo khi có tải.
SQL healthcheck dùng `SELECT 1`; app health còn yêu cầu DB nghiệp vụ đúng và truy cập được.
Database `TrungTamBaoHanhDB` đã restore từ `_Dev`, và login riêng `soopi_app` đã vào role
`warranty_app_role`. CI/CD **không chạy DDL, seed hoặc migration**.
Trước khi phát hành bản có thống kê truy cập, quản trị DB phải chạy `database/07_access_statistics.sql`
trên DB đích (sau các nâng cấp 05/06 nếu chưa có). Ba bảng thống kê lưu tích lũy từ 31/10/2026;
không drop/reset khi nâng cấp. Xem [ACCESS_STATISTICS.md](ACCESS_STATISTICS.md).
Trước bản có đánh giá trên trang chủ, chạy thêm `database/08_public_reviews.sql`. Bảng duyệt ban đầu trống;
admin tự chọn nhận xét sau khi kiểm tra thông tin riêng. Xem [PUBLIC_REVIEWS.md](PUBLIC_REVIEWS.md).
Không chạy `docker compose down -v` vì sẽ xóa volume dữ liệu.

## 3. Domain và HTTPS trong Caddy

Trong ZoneDNS của Nhân Hòa, cấu hình cho `soopiwarranty.id.vn`:

| Loại | Tên/host | Giá trị | TTL |
|---|---|---|---|
| A | `@` | `180.93.114.36` | 300 giây hoặc mặc định |

Nameserver đang là `ns1.zonedns.vn` đến `ns4.zonedns.vn`, không cần đổi nameserver.
Giữ một A record cho `@` trỏ `180.93.114.36`; chỉ thêm AAAA nếu IPv6 thực sự hoạt động.
Caddyfile dùng domain này và reverse proxy qua mạng Compose tới `app:8080`. Caddy tự chuyển HTTP
sang HTTPS, xin và gia hạn chứng thư; phải giữ volume `caddy_data` qua các lần deploy.
UFW hiện đã cho phép 80/443. Giữ aaPanel ở cổng riêng hiện có; không chuyển panel ra cổng web.
SQL publish ở `127.0.0.1:1433`,
app ở `127.0.0.1:5080`; không đổi hai mapping này thành `0.0.0.0` hay mở ra Internet.
`TrustServerCertificate=True` trong env mẫu dành cho SQL trên mạng Docker cùng host;
khi đưa DB ra máy khác phải cấu hình TLS/chứng thư phù hợp.

## 4. SSH key và GitHub

Tạo một cặp Ed25519 riêng cho CI bằng `ssh-keygen -t ed25519`, lưu vào tên file riêng.
Key CI không có passphrase vì chạy không tương tác. Public key đặt vào
`/home/soopi-deploy/.ssh/authorized_keys` (owner `soopi-deploy`, mode `0600`);
private key đưa vào GitHub Environment Secret, không gửi vào chat hoặc commit.
Key root dùng cho phiên setup hiện tại tách khỏi key CI; gỡ đúng dòng key setup khi hoàn tất bàn giao.

Host public key đã đối chiếu qua phiên SSH của chủ dự án. Để lấy lại qua console đã xác thực:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_rsa_key.pub
cat /etc/ssh/ssh_host_rsa_key.pub
```

Ghép thành dòng `<IP_VPS> ssh-rsa <public-key>` cho known_hosts. Nếu cài lại VPS, đối chiếu
fingerprint trước khi thay pin; không tự tin key do `ssh-keyscan` trả về trong workflow.

Tạo GitHub Environment `production`, chỉ cho phép branch `main` và tag `v*`:

| Loại | Tên | Giá trị |
|---|---|---|
| Environment secret | `VPS_SSH_KEY` | Private key CI riêng |
| Environment secret | `VPS_KNOWN_HOSTS` | Dòng host key đã xác thực |
| Repository variable | `VPS_HOST` | IP VPS |
| Repository variable | `PUBLIC_URL` | `https://soopiwarranty.id.vn` không có `/` cuối |
| Repository variable | `DEPLOY_ENABLED` | `true` sau khi DB/schema, secrets và HTTPS sẵn sàng |

`DEPLOY_ENABLED` phải là repository variable vì được xét trước khi job vào environment.
Khi chưa bật, CI vẫn chạy. Khi bật, push/merge `main` tự deploy sau mọi check; PR không deploy.
**Actions → CI → Run workflow → main** tạo một bản build/deploy mới. Artifact và image tag có
SHA + run ID + attempt; rerun riêng job deploy dùng lại đúng artifact của job verify đã đạt.

### Version và phát hành

Push `main` tiếp tục deploy snapshot theo SHA. Khi muốn phát hành một version cho khách hàng,
tạo tag SemVer ổn định trên commit mới nhất của `main`, ví dụ `v1.2.0` (tính năng tương thích),
`v1.2.1` (sửa lỗi), hoặc `v2.0.0` (thay đổi không tương thích), rồi push tag:

```powershell
git switch main
git pull --ff-only
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0
```

CI xác thực định dạng tag, chạy đầy đủ quality gates, deploy và health-check. Khi deploy thành
công, GitHub tự tạo Release notes. Mã release/image trên VPS có dạng
`v1.2.0-<commit-sha>-<run-id>-<attempt>`; tag cho người dùng biết phiên bản, còn SHA/run giữ
artifact bất biến và cho rollback. Không sửa hoặc tái sử dụng tag đã phát hành. Nếu deploy tag lỗi,
VPS tự rollback và GitHub Release không được tạo. Tag cũng cần `DEPLOY_ENABLED=true` cùng secrets
đã cấu hình; tạo tag trước khi bật deploy chỉ chạy CI, không tạo GitHub Release.

## 5. Deploy, rollback và dung lượng

CI build image từ thư mục publish đã kiểm, chạy `dotnet --info` trong image và kiểm user không phải
root. Artifact `soopi-<SHA>-<run>-<attempt>` chứa `soopi-image.tar.gz`, được giữ 14 ngày.
VPS load image trước khi đổi `current`, sau đó chỉ recreate `app` bằng `--no-deps`;
không restart/recreate DB trong mỗi deploy. Root script khóa các lần kích hoạt để tránh chạy đồng thời.

Health phải HTTP 200 và JSON `status=UP`, cả loopback lẫn HTTPS công khai. Nếu app khởi động hoặc
health fail, quay lại image trước và kiểm lại. Lần đầu fail thì dừng app. Workflow vẫn báo đỏ sau
rollback. Có gián đoạn ngắn khi recreate app, chưa phải zero downtime; rollback code không hoàn tác DB.

Kiểm tra từ phiên quản trị:

```bash
docker ps
docker stats --no-stream
curl -fsS http://127.0.0.1:5080/actuator/health
df -h /
docker system df
```

Không chia sẻ `docker inspect` hoặc `docker compose config` đầy đủ vì có thể in secret.
Rollback từ phiên `soopi-deploy`:
`sudo /usr/bin/python3 -I /usr/local/lib/soopi/activate.py <release-cũ> https://soopiwarranty.id.vn`.
Giữ archive/image đang chạy và bản trước; chưa tự xóa image/release/backup. SSD 30 GB cần theo dõi
DB/log/upload và image cũ; không chạy blanket prune có thể xóa dữ liệu hoặc bản cần rollback.

Test local: `python -m unittest discover -s deploy -p 'test_*.py'`.
10/10 test deploy đạt; workflow qua actionlint. Compose đã được Docker trên VPS kiểm bằng
`config --quiet` với giá trị giả, không tạo container. Chưa build/run image thật trong phiên này;
test rollback giả lập Docker/health, chưa thay thế nghiệm thu deploy thực tế.
SLA mặc định tắt trong env mẫu; job dọn refresh token 02:00 vẫn chạy như app hiện có.

Tham chiếu: [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https),
[ASP.NET Docker](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/docker/building-net-docker-images?view=aspnetcore-10.0),
[Compose](https://docs.docker.com/reference/compose-file/services/),
[SQL containers](https://learn.microsoft.com/en-us/sql/linux/install-upgrade/quickstart-install-docker?view=sql-server-ver17),
[quyền Docker group](https://docs.docker.com/engine/install/linux-postinstall/).
