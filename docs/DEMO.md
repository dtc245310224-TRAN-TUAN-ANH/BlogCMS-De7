# Kịch bản demo 8–10 phút

1. Mở VS Code: giải thích `compose.yaml`, app, Nginx, monitoring, logging; chạy `git log --oneline`.
2. `docker compose ps`: chỉ ra 11 container. Mở Blog tại localhost:8080, tìm “MySQL”, lọc danh mục, đọc nguồn bài.
3. Đăng nhập CMS bằng thông tin `.env` (không chiếu mật khẩu lên màn hình). Tạo bài nháp; tab ẩn danh không thấy bài. Xuất bản rồi kiểm tra lại; sửa/xóa bài thử.
4. Tạo một biên tập viên và chỉ ra giới hạn quyền. Danh mục đang có bài không xóa được.
5. Mở phpMyAdmin bằng cms_app, chọn blogcms, xem posts/categories/users/sessions. Không mở cột password_hash khi trình bày không cần thiết.
6. `docker compose exec nginx nginx -t`; xem response headers với DevTools. Chỉ ra Nginx proxy tới web:3000, port 9100 chỉ dành cho metrics nội bộ.
7. Mở Prometheus `/targets`: 7 target UP. Query `mysql_up`, `nginx_up`, `up`. Mở Grafana dashboard, tạo thêm HTTP traffic bằng refresh trang blog.
8. Mở URL không tồn tại; đăng nhập sai một lần. Grafana Explore → Loki, thực hiện 3 LogQL trong README; chọn Last 15 minutes.
9. `docker compose exec web id`; kiểm tra backend internal và port MySQL; chỉ ra cap_drop/read_only/CSRF. Nói rõ ngoại lệ privileged của cAdvisor.
10. Trình bày backup, giới hạn HTTP local, Promtail EOL, dự định nâng cấp Alloy.

## Câu hỏi thường gặp

- Vì sao không kết nối DB bằng localhost trong container? localhost là chính container; tên service `mysql` được DNS Docker phân giải.
- Vì sao exporter UP nhưng database có thể lỗi? `up` là kết quả scrape; `mysql_up` mới phản ánh kết nối exporter tới database.
- Metric khác log thế nào? Metric là chuỗi mẫu số để thống kê; log ghi sự kiện cụ thể để điều tra.
- Xóa container có xóa database? Volume được giữ nếu không xóa volume; vẫn cần backup trước thao tác bảo trì.
- CSP có thay HTTPS không? Không. Đề cho chọn security headers, bộ lab hiện dùng HTTP loopback; dùng Internet phải thêm TLS.
- Chỉ mount socket `:ro` có an toàn tuyệt đối không? Không, API socket vẫn có thể có thao tác ghi; vì vậy Promtail trong dự án không mount socket.
- Tại sao không cho xóa danh mục còn bài? Khóa ngoại ngăn bài viết mồ côi.
- Có gửi alert ra email chưa? Chưa; chỉ có rule đánh giá trong Prometheus, cần Alertmanager để định tuyến thông báo.
