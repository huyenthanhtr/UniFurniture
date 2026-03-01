# 🛋️ Dự án U-HOME FURNI - Group 10

Hệ thống Website Nội thất cá nhân hóa (AR & Keyword) - Tham khảo mô hình MOHO.

---

## 📌 Nghiệp vụ trọng tâm
* **Web Client:** Web bán hàng phong cách MOHO. Tích hợp 2 tính năng: **AR** (Thực tế ảo) và **Keyword Search** (Cá nhân hóa phong cách).
* **Trải nghiệm:** Không bắt buộc đăng nhập vẫn có thể mua hàng.
* **Web Admin:** Quản lý toàn diện Sản phẩm, Đơn hàng và Dữ liệu cá nhân hóa từ người dùng.

---

## 📂 Cấu trúc dự án (Mono-repo)
Dự án được quản lý tập trung trong 3 thư mục chính:
* `client/` : Frontend dành cho khách hàng (**Huyền, Vân, Khải**).
* `admin/`  : Frontend dành cho quản trị viên (**Vinh, Nhất**).
* `server/` : Backend chung sử dụng **Express + MongoDB** (Dùng cho cả 2 web).

---

## ⚙️ Thống nhất về Port (Cổng chạy Web)
Để test đồng thời cả hệ thống, mọi người lưu ý set port như sau:
* **Server:** Cổng `3000`
* **Client:** Cổng `4200`
* **Admin:** Cổng `4201` *(Dùng lệnh: `ng serve --port 4201`)*

---

## 🚀 Quy trình làm việc với Git & GitHub
Tất cả làm việc trên Repo chính thức: [https://github.com/huyenthanhtr/UniFurniture](https://github.com/huyenthanhtr/UniFurniture)

### 1. Nguyên tắc nhánh (Branch)
* **CẤM** code trực tiếp trên nhánh `main`. Nhánh `main` chỉ dùng để merge bản hoàn thiện.

### 2. Luồng xử lý Task
1. **Trước khi code:** `git checkout main` -> `git pull` để lấy bản mới nhất.
2. **Tạo nhánh riêng:** `git checkout -b feature-tenchucnang`
   * *Ví dụ: `Van-feature-product-ui`, `Vinh-feature-order-api`...*
3. **Code & Commit:** * `git add .`
   * `git commit -m "Ghi rõ chức năng vừa làm (CẤM ghi 'update')"`
4. **Push & PR:** `git push origin ten-branch` -> Lên GitHub tạo **Pull Request**. Leader sẽ duyệt và Merge.



---

## ⚠️ Lưu ý quan trọng
* 🚫 **Tuyệt đối không commit `node_modules`**: Luôn đảm bảo có file `.gitignore`.
* 🤝 **Không sửa code người khác**: Trao đổi trực tiếp trước khi muốn thay đổi code của đồng đội.
* 📦 **Thống nhất Schema**: Backend nằm chung một folder nên team Client và Admin phải bám sát Schema dữ liệu đã chốt để gọi API không bị lỗi.
