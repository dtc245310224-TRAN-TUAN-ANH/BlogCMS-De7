# Cập nhật báo cáo trước khi nộp

Sinh viên: **Trần Tuấn Anh**, MSSV **DTC245310224**.
Repository: https://github.com/dtc245310224-TRAN-TUAN-ANH/BlogCMS-De7

## Các đoạn thay vào báo cáo đang chỉnh trên Google Docs

### Quản lý mã nguồn GitHub

Mã nguồn và cấu hình được lưu tại repository công khai https://github.com/dtc245310224-TRAN-TUAN-ANH/BlogCMS-De7. Lịch sử có ba commit triển khai chính: ứng dụng và Nginx; hệ thống giám sát; Loki, Promtail và hardening. Các commit tiếp theo ghi nhận sửa giao diện và hoàn thiện tài liệu. README hướng dẫn clone, tạo cấu hình cục bộ và khởi động bằng Docker Compose. Ba commit ban đầu giữ thông tin tác giả kỹ thuật của bộ mã nguồn khởi tạo; các thay đổi tiếp theo được lưu bằng tài khoản sinh viên.

### Đăng nhập phpMyAdmin và hardening

phpMyAdmin truy cập tại http://localhost:8081. Tài khoản admin có quyền quản lý database blogcms và dùng mật khẩu ngẫu nhiên mạnh, lưu riêng trong secrets/phpmyadmin-admin.txt ngoài Git. Tài khoản cms_app dùng cho ứng dụng chỉ có SELECT, INSERT, UPDATE và DELETE trên blogcms. Người cài mới chạy scripts/setup-db-admin.ps1 sau khi MySQL healthy để tạo tài khoản quản trị riêng; mỗi lần chạy lại script sẽ đổi mật khẩu tài khoản này. Tài khoản quản trị website nằm trong bảng users và độc lập với tài khoản MySQL.

Xóa nhận xét cũ rằng admin vẫn dùng mật khẩu đơn giản; nhận xét đó mô tả trạng thái trước lần cập nhật này. Không chụp file chứa mật khẩu trong báo cáo.

### Truy cập Grafana và datasource

Người dùng mở Grafana tại http://localhost:3000 để xem dashboard và truy vấn log. Grafana kết nối Prometheus tại http://prometheus:9090 và Loki tại http://loki:3100 bên trong mạng Docker. Hai địa chỉ nội bộ này không dùng để mở trực tiếp trên trình duyệt Windows.

### Kết quả giám sát và truy vấn log cập nhật

Lần kiểm tra ngày 21/10/2026 xác nhận 7 target Prometheus UP; mysql_up và nginx_up đều bằng 1. Ba truy vấn LogQL lấy log Nginx, lọc HTTP status từ 400 trở lên và lọc sự kiện login_failed đều trả dữ liệu. Log lỗi được tạo bằng một request đến /api/khong-ton-tai và một lần đăng nhập sai có chủ đích. Kết quả chi tiết có thời gian kiểm tra trong evidence/verification-final.json. Kết quả API 30/30 và unit test 3/3 thuộc bộ kiểm thử ngày 20/10/2026; không diễn giải rằng toàn bộ đã chạy lại trong lần cập nhật này.

## Hình minh chứng mới

- `evidence/logql-final-1.png`: LogQL lấy nhật ký Nginx, `{job="nginx"}`.
- `evidence/logql-final-2.png`: LogQL lọc mã phản hồi từ 400 trở lên.
- `evidence/logql-final-3.png`: LogQL lọc sự kiện đăng nhập thất bại.
- `evidence/phpmyadmin-admin-final.png`: phpMyAdmin truy cập blogcms bằng tài khoản admin sau khi đổi mật khẩu.

Chèn ba ảnh LogQL vào phần Loki và Promtail, trước phần Hardening. Giữ một ảnh dashboard tổng quan; xóa ảnh Grafana bị lặp. Nếu cần ảnh riêng cho database, chụp các panel MySQL ở phần dưới dashboard.

## Hoàn tất bản nộp

Điền lớp và giảng viên theo thông tin thật; không dùng danh tính của sinh viên trong mẫu. Thêm ảnh trang repository và lịch sử commit. Xuất báo cáo Google Docs cuối cùng thành DOCX/PDF, kiểm tra tối thiểu 10 trang và cập nhật mục lục sau khi thay hình. Bản Google Docs đang chỉnh không tự đồng bộ từ các file trong repository.

PDF, HTML và report-content.json ban đầu trong docs là bản tham khảo lịch sử; không dùng chúng làm bản nộp cuối khi còn thông tin mẫu hoặc nội dung đã cũ. Bản Word theo mẫu đã bàn giao trước đó cũng cần áp dụng các cập nhật trong tài liệu này nếu chưa sửa trên Google Docs.
