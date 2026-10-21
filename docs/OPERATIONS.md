# Vận hành và xử lý sự cố

## Không mở được website
Chạy `docker version` để chắc chắn có cả Client và Server. Docker Desktop cần Linux engine, WSL2 và virtualization. Không chạy các lệnh xóa WSL để “sửa nhanh”.
Chạy `docker compose ps -a` và `docker compose logs --tail=100 mysql web nginx`.
MySQL khởi tạo lần đầu có thể cần 1–2 phút. Cổng 8080/8081/3000/9090 trùng dịch vụ khác thì sửa bên trái dấu hai chấm trong ports; nếu đổi cổng web phải cập nhật BASE_URL khi smoke.

## Sai mật khẩu sau khi sửa env
Init SQL chỉ chạy lúc volume MySQL còn trống. Giữ lại `.env` cũ nếu chưa chủ động đổi password trong DB.
Đừng xóa volume khi có dữ liệu cần giữ. Đổi mật khẩu bằng lệnh quản trị có kế hoạch và cập nhật secret; backup trước.

## Grafana không có dữ liệu
Chờ 2 phút. Kiểm tra target, `mysql_up`, `nginx_up`. Dashboard cần chọn đúng khoảng thời gian.
Nếu CPU/RAM trống trên Docker Desktop: xem log cAdvisor; cgroup và Docker API thay đổi giữa các phiên bản.
Không suy ra mọi thành phần khỏe chỉ từ một panel UP.

## Không có log Loki
Tạo request mới; kiểm tra `docker compose logs --tail=100 promtail loki`.
App/Nginx ghi file vào volume chia sẻ. Promtail dùng nhãn `job="cms"` và `job="nginx"`.
Các lỗi 404 ở Nginx vẫn xuất hiện trong access.log dưới dạng JSON. Chọn đúng time range.
Loki không publish port; truy vấn qua Grafana.

## Backup và restore
Windows: `powershell -ExecutionPolicy Bypass -File .\scripts\backup.ps1`.
Backup dùng `--single-transaction` cho các bảng InnoDB và không thực hiện DDL đồng thời.
Script dump vào file bên trong container rồi `docker compose cp` ra host, tránh PowerShell 5 chuyển encoding khi redirect.
Để restore, dùng một stack thử nghiệm riêng với volume mới, backup đầy đủ và kiểm tra đúng database mục tiêu:

```powershell
docker compose cp .\backups\TEN_FILE.sql mysql:/tmp/restore.sql
docker compose exec mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot blogcms < /tmp/restore.sql'
docker compose exec mysql rm /tmp/restore.sql
```

Restore ghi vào database hiện tại; không chạy vào dữ liệu quan trọng nếu chưa xem nội dung file SQL và có backup.
Sau restore, kiểm tra `/healthz`, đăng nhập, bài viết và số lượng dữ liệu.

## Log dài ngày
Docker json-file có giới hạn riêng; file Nginx trong volume không tự xoay.
Có thể sao lưu file rồi truncate chủ động trong kỳ bảo trì. Khi vận hành lâu dài hãy triển khai logrotate sidecar với cơ chế reopen Nginx phù hợp.
Promtail positions nằm trong tmpfs, có thể đọc lại file sau recreate. Đưa positions vào volume với quyền phù hợp khi cần tránh trùng sau restart.
Loki giữ log 7 ngày; Prometheus giữ metrics 7 ngày.
