# Mạch Nguồn — Hệ thống Blog / CMS (Đề 7)

Ứng dụng Node.js + MySQL, giao diện tiếng Việt, triển khai bằng Docker Compose.
6 bài viết ban đầu được biên soạn từ tài liệu Docker, Nginx, MySQL, Prometheus và OWASP; mỗi bài có nguồn chính thức.
Đây là cấu hình thực hành trên máy cá nhân, các cổng chỉ mở tại `127.0.0.1`.

## 1. Mở và chạy trên VS Code

Yêu cầu: Docker Desktop **đang chạy Linux containers** (Windows cần WSL2), Docker Compose v2 trở lên, VS Code, Git.
Nên cấp Docker ít nhất 4 GB RAM, máy tính 8 GB RAM trở lên và khoảng 8 GB trống. Lần đầu cần Internet để tải image.
Không cần cài Node.js hay MySQL trực tiếp trên Windows.

1. Giải nén ZIP. Trong VS Code chọn **File → Open Folder → BlogCMS-De7** (thư mục chứa `compose.yaml`).
2. Mở **Terminal → New Terminal**, dùng PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Linux/macOS dùng `sh scripts/setup.sh` thay cho lệnh PowerShell đầu tiên.
Chỉ chạy setup **một lần**. Nếu `.env` đã tồn tại, giữ nguyên vì database volume dùng mật khẩu khởi tạo ban đầu.
Setup sinh mật khẩu ngẫu nhiên 48 ký tự; không có mật khẩu chung trong mã nguồn.

3. Mở các địa chỉ:

| Thành phần | Địa chỉ | Đăng nhập |
|---|---|---|
| Blog qua Nginx | http://localhost:8080 | Không cần |
| Quản trị CMS | http://localhost:8080/quan-tri | `ADMIN_EMAIL`, `ADMIN_PASSWORD` trong `.env` |
| phpMyAdmin | http://localhost:8081 | user `cms_app`, mật khẩu `DB_PASSWORD` |
| Grafana | http://localhost:3000 | user `admin`, mật khẩu `GRAFANA_PASSWORD` |
| Prometheus | http://localhost:9090 | Chỉ cho truy cập trên máy cá nhân |

Mở `.env` trực tiếp trong VS Code để xem mật khẩu. **Không đưa `.env` vào Git, ảnh báo cáo hoặc video demo.**
Trong Grafana: **Dashboards → Blog CMS → Blog CMS • Hệ thống và vận hành**.
Chờ khoảng 1–2 phút để có mẫu dữ liệu; biểu thức rate cần ít nhất hai lần scrape.
Loki và các exporter không mở cổng ra host.

## 2. Chức năng website

- Đọc bài, xem nguồn, tìm theo tiêu đề/tóm tắt, lọc danh mục, phân trang.
- Quản trị viên: thêm/sửa/xóa bài viết, danh mục, người dùng.
- Biên tập viên: tạo bài và chỉ sửa/xóa bài của chính mình.
- Bản nháp không hiện ở trang công khai. Xuất bản để hiển thị.
- Nội dung bài viết là văn bản thuần; dùng một dòng trống để tách đoạn.
- Không xóa danh mục hoặc tác giả đang có bài viết. Xử lý bài liên quan trước.
- Thay mật khẩu người dùng tại tab Người dùng; cập nhật tài khoản làm mất hiệu lực các phiên của tài khoản đó.
- Không có đăng ký công khai; quản trị viên tạo tài khoản.

## 3. Cấu trúc

```text
app/                   Node.js API, giao diện, dữ liệu nguồn, kiểm thử
db/                    Schema MySQL và cấp quyền
nginx/                 Reverse proxy, security headers, Dockerfile non-root
monitoring/            Prometheus, alert rules, Grafana datasource/dashboard
logging/               Loki và Promtail
scripts/               Setup, smoke test, backup, kiểm tra hardening
docs/                  Báo cáo và hướng dẫn demo
evidence/              Ảnh và kết quả kiểm thử thực tế
compose.yaml           11 dịch vụ
.env.example           Tên biến cần thiết
.vscode/tasks.json     Các tác vụ trong VS Code
```

Luồng web: Trình duyệt → Nginx:8080 → web:3000 → mysql:3306.
Luồng metrics: web:9100 / cAdvisor / Nginx Exporter / MySQL Exporter → Prometheus → Grafana.
Luồng log: file JSON của web và Nginx trên volume → Promtail → Loki → Grafana Explore.

## 4. Giám sát và log

Prometheus scrape 7 target: prometheus, cms, nginx, mysql, cadvisor, loki, promtail.
Dashboard có CPU, RAM container, Nginx requests, MySQL connections/questions, HTTP theo mã phản hồi, p95 latency và log.
Kiểm tra cả `up`, `nginx_up`, `mysql_up`: exporter hoạt động không đồng nghĩa dịch vụ phía sau khỏe.
Alert rules hiện trong Prometheus; chưa cấu hình Alertmanager gửi thông báo.

Grafana → Explore → chọn **Loki**, chọn **Last 15 minutes**, chạy:

```logql
{job="nginx"}
{job="nginx"} | json | status >= 400
{job="cms"} | json | event="login_failed"
sum(count_over_time({job="nginx"} | json | status >= 400 [5m]))
```

Tạo log 404 bằng cách mở `http://localhost:8080/trang-khong-ton-tai`.
Đăng nhập sai một lần để có `login_failed`. Không spam vì có rate limit.
Nhãn `job` được khai báo cố định trong `logging/promtail.yml`; không cần đoán tên container.

**Promtail đã EOL ngày 02/03/2026.** Dự án giữ Promtail đúng yêu cầu đề bài; khi vận hành thực tế cần chuyển sang Grafana Alloy.
Nguồn: https://grafana.com/docs/loki/latest/send-data/promtail/
Log tập trung hiện gồm ứng dụng và Nginx; stdout của dịch vụ khác xem bằng `docker compose logs`.
App log tự xoay vòng tại 10 MB, giữ 1 bản cũ; Docker stdout giữ 3 file x 10 MB.
Nginx ghi file riêng nên cần xoay/xóa log theo hướng dẫn vận hành khi chạy dài ngày.
Promtail lưu positions trên tmpfs: khi container tạo lại có thể đọc lại log và sinh bản trùng. Đây là giới hạn của cấu hình thực hành.

## 5. Hardening

1. `web` chạy user node (UID 1000); Nginx chạy UID 101; Promtail UID 10001.
2. Web/Nginx/exporter/Promtail có `cap_drop: ALL`; các service thông thường có `no-new-privileges`.
3. Web/Nginx/Promtail và exporter có filesystem chỉ đọc, chỉ mở vùng ghi cần thiết.
4. MySQL không publish cổng; backend `internal: true`; phpMyAdmin/Grafana/Prometheus chỉ bind loopback.
5. User ứng dụng chỉ có SELECT/INSERT/UPDATE/DELETE trong database `blogcms`. Không chạy CRUD bằng root.
6. Mật khẩu ngẫu nhiên và secret nằm ngoài Git; mật khẩu người dùng hash bằng scrypt.
7. Cookie HttpOnly/SameSite=Strict, CSRF token, rate limit đăng nhập, SQL tham số hóa, escape nội dung.
8. Nginx có CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.

**Ngoại lệ có chủ đích:** cAdvisor cần privileged và đọc tài nguyên host để đo container. Chỉ dùng trong lab tin cậy, không mở cổng cAdvisor ra ngoài. Mount Docker socket chỉ đọc không có nghĩa quyền API là chỉ đọc.
MySQL/phpMyAdmin sử dụng entrypoint chính thức có bước chạy root; không tuyên bố mọi container đều non-root.
Exporter có quyền PROCESS, REPLICATION CLIENT, SELECT phục vụ giám sát và giới hạn 3 kết nối.
`.env` và bind-mounted secret là file văn bản trên host, không phải kho bí mật mã hóa.

**HTTP:** cấu hình đáp ứng nhánh “security headers cơ bản” của đề. Chưa có TLS. Cookie Secure=false chỉ phù hợp với lab loopback.
Khi dùng mạng công cộng: cấu hình TLS tại Nginx, bật COOKIE_SECURE=true, hạn chế công cụ quản trị, cập nhật và quét image; không chỉ đổi `127.0.0.1` thành `0.0.0.0`.

## 6. Kiểm thử và demo

```powershell
docker compose config --quiet
docker compose exec nginx nginx -t
docker compose exec prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose exec web node -e "console.log(process.getuid())"
docker run --rm --mount "type=bind,source=$((Get-Location).Path)\app,target=/app,readonly" -w /app node:22-alpine node --test test/security.test.js
docker compose exec web node scripts/smoke.mjs
```

Lệnh cuối cần file smoke trong image, được COPY bởi Dockerfile; smoke tự đọc ADMIN_PASSWORD từ môi trường container.
Smoke kiểm tra API qua Nginx, CRUD, CSRF, phân quyền và xóa dữ liệu thử do nó tạo ra. Nếu test bị ngắt, tài khoản `qa-*`/bài `QA` có thể còn lại và cần xóa trong quản trị.
`docs/DEMO.md` có trình tự thuyết trình và câu hỏi.
`evidence/verification.json` ghi kết quả tại thời điểm kiểm thử, không thay thế kiểm tra trên máy sinh viên.

## 7. Vận hành và sao lưu

```powershell
docker compose logs --tail=100 web mysql
docker compose restart web
docker compose up -d --build web
docker compose down
```

`down` giữ volume. **`down -v` xóa dữ liệu, không chạy nếu chưa sao lưu.**
Sửa `.env` không tự đổi mật khẩu đã lưu trong MySQL/Grafana hoặc tài khoản CMS đã tồn tại.
Đổi mật khẩu CMS qua quản trị, Grafana qua giao diện; thay mật khẩu DB phải ALTER USER và cập nhật cấu hình tương ứng.

Sao lưu nhất quán dùng `scripts/backup.ps1`; file SQL được ghi trong `backups/`, không đưa lên GitHub.
Sao lưu chứa hash người dùng và dữ liệu phiên, phải giữ riêng.
Khôi phục vào một môi trường thử nghiệm trước; xem `docs/OPERATIONS.md`.

## 8. Git và GitHub

Gói có lịch sử Git **3 commit** theo nhóm chức năng; file `source-history.bundle` ở ngoài thư mục mã nguồn chứa lịch sử để clone:

```powershell
git clone .\source-history.bundle BlogCMS-Git
cd BlogCMS-Git
git log --oneline
```

Nếu dùng thư mục đã giải nén và có `.git`, không cần clone lại.
Lịch sử scaffold ghi tác giả kỹ thuật `CMS Project Scaffold`, không giả danh sinh viên.
Bạn cần tự điền tên/MSSV, tạo tài khoản GitHub theo MSSV và một repository rỗng của mình.
Sau đó trong thư mục clone:

```powershell
git config user.name "HO TEN CUA BAN"
git config user.email "EMAIL GITHUB CUA BAN"
git remote add origin https://github.com/TAI_KHOAN_MSSV/BlogCMS-De7.git
git push -u origin main
```

Thay các giá trị viết hoa bằng thông tin thật. Không copy tài khoản/họ tên sinh viên trong file mẫu.
Repository GitHub chưa được tạo/push trong gói bàn giao này; URL trong báo cáo cần bạn bổ sung sau khi push.
Các ảnh không chứa mật khẩu. Kiểm tra `git status` trước mỗi commit; tuyệt đối không dùng `git add -f .env`.
