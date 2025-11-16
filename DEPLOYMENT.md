# Hướng dẫn Triển khai (Deployment) - Bữa Cơm Xanh

Tài liệu này hướng dẫn các bước để triển khai dự án Bữa Cơm Xanh lên một server production.

**Kiến trúc:**
- **Backend:** NodeJS / Express
- **Frontend:** React (Vite)
- **Database:** MySQL

---

## 1. Yêu cầu Môi trường (Prerequisites)

Đảm bảo server của bạn đã cài đặt các phần mềm sau:

- **Node.js:** phiên bản 18.x hoặc mới hơn.
- **NPM** hoặc **Yarn**.
- **MySQL Server:** phiên bản 8.x hoặc tương thích.
- **Web Server:** Nginx (khuyến nghị) hoặc Apache để làm reverse proxy.
- **PM2:** Process manager cho ứng dụng NodeJS. Cài đặt bằng lệnh: `npm install pm2 -g`.
- **Git**.

---

## 2. Chuẩn bị Backend

### 2.1. Clone mã nguồn

```bash
git clone <your-repository-url>
cd BuaComXanh/backend
```

### 2.2. Cài đặt Dependencies

```bash
npm install
```

### 2.3. Cấu hình Biến môi trường

Tạo một tệp `.env` trong thư mục `backend` từ tệp `.env.example` (nếu có) và điền các giá trị cho môi trường production:

```dotenv
# .env
NODE_ENV=production

# Server Port
PORT=8080

# Database Connection
DB_HOST=localhost
DB_USER=your_production_db_user
DB_PASSWORD=your_production_db_password
DB_NAME=bua_com_xanh_prod

# JWT Secret
JWT_SECRET=your_super_strong_and_long_secret_key

# API Keys (nếu có)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
MOMO_PARTNER_CODE=...
MOMO_ACCESS_KEY=...
MOMO_SECRET_KEY=...
```

### 2.4. Chuẩn bị Database

1.  **Tạo Database:** Đăng nhập vào MySQL và tạo database cho production.
    ```sql
    CREATE DATABASE bua_com_xanh_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    ```
2.  **Chạy Migrations:** (Nếu bạn có cơ chế migration) Chạy lệnh để tạo các bảng trong database.
    ```bash
    # Ví dụ nếu bạn dùng Knex.js
    # npx knex migrate:latest --env production
    ```
    Nếu không có, bạn cần import thủ công từ file `.sql`.

3.  **Chạy Seeding:** (Tùy chọn) Chạy lệnh để thêm dữ liệu ban đầu (ví dụ: tài khoản admin).
    ```bash
    # npx knex seed:run --env production
    ```

### 2.5. Khởi chạy Backend với PM2

```bash
pm2 start src/server.js --name "buacomanh-backend"
```

**Các lệnh PM2 hữu ích:**
- `pm2 list`: Xem danh sách các ứng dụng đang chạy.
- `pm2 logs buacomanh-backend`: Xem log của ứng dụng.
- `pm2 restart buacomanh-backend`: Khởi động lại ứng dụng.
- `pm2 startup` & `pm2 save`: Tự động khởi chạy ứng dụng khi server reboot.

---

## 3. Chuẩn bị Frontend

### 3.1. Cài đặt Dependencies

```bash
cd ../frontend
npm install
```

### 3.2. Cấu hình Biến môi trường

Tạo tệp `.env.production` trong thư mục `frontend` và cấu hình URL của backend API:

```dotenv
# .env.production
VITE_API_BASE_URL=https://your-domain.com/api
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### 3.3. Build mã nguồn Frontend

```bash
npm run build
```

Thao tác này sẽ tạo ra một thư mục `dist` chứa các tệp tĩnh (HTML, CSS, JS) đã được tối ưu hóa.

---

## 4. Cấu hình Web Server (Nginx)

Cấu hình Nginx để phục vụ các tệp tĩnh của frontend và làm reverse proxy cho backend.

Tạo một file cấu hình mới trong `/etc/nginx/sites-available/buacomanh`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Thư mục chứa code frontend đã build
    root /path/to/your/project/BuaComXanh/frontend/dist;
    index index.html;

    # Cấu hình cho React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse proxy cho Backend API
    location /api/ {
        proxy_pass http://localhost:8080; # Port của backend đang chạy
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Kích hoạt cấu hình và khởi động lại Nginx:**

```bash
sudo ln -s /etc/nginx/sites-available/buacomanh /etc/nginx/sites-enabled/
sudo nginx -t # Kiểm tra cú pháp
sudo systemctl restart nginx
```

---

## 5. Hoàn tất

Truy cập vào `http://your-domain.com` để kiểm tra ứng dụng. Sử dụng `pm2 logs buacomanh-backend` và log của Nginx để gỡ lỗi nếu cần.

**Lưu ý:** Để sử dụng HTTPS (khuyến nghị mạnh mẽ), bạn cần cài đặt chứng chỉ SSL (ví dụ: sử dụng Let's Encrypt) và cập nhật lại cấu hình Nginx để lắng nghe trên port 443.