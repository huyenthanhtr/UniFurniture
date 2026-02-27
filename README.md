# 🛋️ Dự án UniFurniture - Group 10

Dự án môn Học Web Nâng Cao: Website nội thất cá nhân hóa (AR & Keyword) dựa trên mô hình MOHO.

---

## 🎯 Nghiệp vụ trọng tâm
* **Web Client:** Chức năng tương tự MOHO.
* **Cá nhân hóa:** Tích hợp công nghệ **AR** (Xem ảnh thực tế ảo) và **Keyword Search** (Tìm kiếm theo phong cách riêng).
* **Trải nghiệm:** Không bắt buộc đăng nhập khi mua hàng.
* **Web Admin:** Quản lý sản phẩm, đơn hàng và các thông số từ tính năng cá nhân hóa.

---

## 🚀 Quy trình làm việc với GitHub (BẮT BUỘC)

### 1. Phân chia thư mục
* 📂 `/client`: Nhóm Client (**Huyền, Vân, Khải**)
* 📂 `/admin`: Nhóm Admin (**Vinh, Nhất**)

### 2. Luồng làm việc (Workflow)
Tất cả làm việc theo nguyên tắc: **Làm nháp riêng (Feature branch) -> Đợi duyệt -> Nháp chung (Develop branch).**

* **Trước code:** `git checkout develop-xxx` -> `git pull` để cập nhật code mới nhất.
* **Khi code:** Chia nhỏ Task. Xong giao diện hoặc API nào là `commit` & `push` ngay.
* **Hoàn thành:** Tạo **Pull Request (PR)**. Tuyệt đối không tự ý Merge.
    * **Huyền** duyệt PR nhóm Client.
    * **Nhất** duyệt PR nhóm Admin.

### 3. Quy định Commit
Ghi rõ nội dung thay đổi, không ghi chung chung.
* ❌ `git commit -m "update"`
* ✅ `git commit -m "Hoàn thành giao diện bộ lọc sản phẩm trang Danh mục"`

### 4. Lưu ý về Backend & Database
Vì dùng chung **MongoDB Atlas**, team Client (Khải) và team Admin (Vinh, Nhất) **phải thống nhất Schema**.
* Ví dụ: Tên sản phẩm thống nhất là `prodName`. Tránh việc mỗi người đặt một kiểu dẫn đến lỗi kết nối dữ liệu.

---

## 🛡️ Cấu trúc Nhánh (Branches)
* `main`: Nhánh nộp bài cuối kỳ (Đã khóa).
* `develop-client`: Nhánh nháp chung cho Web khách hàng.
* `develop-admin`: Nhánh nháp chung cho Web quản trị.
* `feature/tên-tính-năng`: Nhánh riêng cho từng cá nhân làm task.
