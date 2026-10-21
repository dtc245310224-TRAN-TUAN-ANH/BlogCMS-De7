# Mạch Nguồn — Hệ thống Blog / CMS (Đề 7)

- Sinh viên: **Trần Tuấn Anh** — MSSV: **DTC245310224**.
- Repository: https://github.com/dtc245310224-TRAN-TUAN-ANH/BlogCMS-De7

Ứng dụng Node.js + MySQL, giao diện tiếng Việt, triển khai bằng Docker Compose.
6 bài viết ban đầu được biên soạn từ tài liệu Docker, Nginx, MySQL, Prometheus và OWASP; mỗi bài có nguồn chính thức.
Đây là cấu hình thực hành trên máy cá nhân, các cổng chỉ mở tại `127.0.0.1`.

## 1. Mở và chạy trên VS Code

Yêu cầu: Docker Desktop **đang chạy Linux containers** (Windows cần WSL2), Docker Compose v2 trở lên, VS Code, Git.
Nên cấp Docker ít nhất 4 GB RAM, máy tính 8 GB RAM trở lên và khoảng 8 GB trống. Lần đầu cần Internet để tải image.
Không cần cài Node.js hay MySQL trực tiếp trên Windows.

1. Clone repository rồi mở thư mục chứa `compose.yaml` trong VS Code:

```powershell
git clone https://github.com/dtc245310224-TRAN-TUAN-ANH/BlogCMS-De7.git
cd BlogCMS-De7
code .
```

Nếu đã có dự án trên máy thì mở thư mục hiện tại; không clone thêm bên trong nó.
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

**Tài khoản quản trị database riêng (tùy chọn):** sau khi MySQL healthy, chạy:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-db-admin.ps1
```

Script tạo hoặc đổi mật khẩu user `admin`, cấp quyền trên `blogcms` và lưu mật khẩu ngẫu nhiên trong `secrets/phpmyadmin-admin.txt` (bị Git bỏ qua). Dùng tài khoản này để quản lý cấu trúc database qua phpMyAdmin. Mỗi lần chạy script sẽ đổi mật khẩu; không cần chạy khi chỉ build lại web. Cài mới chưa chạy script này vẫn đăng nhập bằng `cms_app` nhưng chỉ có quyền CRUD dữ liệu. Tài khoản phpMyAdmin độc lập với tài khoản website. Bản demo ngày 21/10 đã đổi mật khẩu đơn giản sang mật khẩu mạnh.

Các địa chỉ `http://prometheus:9090` và `http://loki:3100` trong datasource chỉ dùng giữa container. Người dùng mở Grafana tại `http://localhost:3000`, Prometheus tại `http://localhost:9090`; xem Loki qua **Grafana → Explore → Loki**.

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

Tạo log 404 bằng cách mở `http://localhost:8080/api/khong-ton-tai`.
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

Mã nguồn đã được đẩy lên repository công khai của sinh viên. Ba commit triển khai ban đầu:

- `599786d`: CMS, MySQL, phpMyAdmin và Nginx reverse proxy.
- `5ced0bd`: Prometheus, Grafana và giám sát container/web/database.
- `7c1683d`: Loki, Promtail, hardening và tài liệu.
- `e72d5fa`: cập nhật giao diện và sửa font tiếng Việt.

Các commit sau ghi nhận thay đổi thực tế khi hoàn thiện. Ba commit ban đầu giữ tác giả `CMS Project Scaffold`; không sửa lịch sử để thay tác giả. Xem lịch sử tại:
https://github.com/dtc245310224-TRAN-TUAN-ANH/BlogCMS-De7/commits/main/

```powershell
git log --oneline
git status
```

Không cần `source-history.bundle` khi clone trực tiếp từ GitHub. Không đưa `.env`, `secrets/`, backup hoặc ảnh chứa mật khẩu lên repository. Kiểm tra `git status` trước mỗi commit; tuyệt đối không dùng `git add -f .env`.

## 9. Báo cáo và minh chứng nộp bài

Đọc `docs/HUONG-DAN-BAO-CAO.md` và `docs/CAP-NHAT-NOP-BAI.md` trước khi xuất bản báo cáo. PDF/HTML ban đầu trong docs là tài liệu tham khảo lịch sử, chưa phải báo cáo cá nhân cuối cùng. Báo cáo đang chỉnh trên Google Docs cần xuất lại sau khi cập nhật thông tin, ảnh và mục lục.
