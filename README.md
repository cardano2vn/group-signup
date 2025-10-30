# Student Group Registration App

Ứng dụng đăng ký nhóm học viên với tích hợp Google Sheets API. Ứng dụng cho phép học viên đăng ký vào các nhóm và tự động cập nhật dữ liệu vào Google Sheets.

## Tính năng

- ✅ Giao diện web đơn giản và thân thiện
- ✅ Kết nối với Google Sheets API để lưu trữ dữ liệu
- ✅ Tự động vô hiệu hóa nhóm khi đủ 5 người
- ✅ Hiển thị real-time tình trạng các nhóm
- ✅ Validation dữ liệu đầu vào
- ✅ Responsive design cho mobile và desktop

## Yêu cầu hệ thống

- Node.js (v16 trở lên)
- npm hoặc yarn
- Google Cloud account với Google Sheets API được kích hoạt

## Cài đặt

### 1. Clone repository

```bash
cd /home/tienna/group_app
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Thiết lập Google Sheets API

#### Bước 1: Tạo Google Cloud Project

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo một project mới hoặc chọn project có sẵn
3. Kích hoạt Google Sheets API:
   - Vào "APIs & Services" > "Library"
   - Tìm "Google Sheets API"
   - Click "Enable"

#### Bước 2: Tạo Service Account

1. Vào "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Điền tên service account và click "Create"
4. Skip các bước optional và click "Done"

#### Bước 3: Tạo và tải credentials

1. Click vào service account vừa tạo
2. Vào tab "Keys"
3. Click "Add Key" > "Create new key"
4. Chọn JSON format và click "Create"
5. File JSON sẽ được tải về máy
6. Đổi tên file thành `credentials.json` và copy vào thư mục gốc của project

#### Bước 4: Tạo Google Sheet và chia sẻ

1. Tạo một Google Sheet mới tại [Google Sheets](https://sheets.google.com)
2. Copy Sheet ID từ URL:
   ```
   https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
   ```
3. Chia sẻ sheet với service account email (tìm trong file `credentials.json` với key `client_email`)
   - Click "Share" button
   - Paste service account email
   - Cho quyền "Editor"
   - Click "Send"

### 4. Cấu hình môi trường

1. Copy file `.env.example` thành `.env`:

```bash
cp .env.example .env
```

2. Chỉnh sửa file `.env`:

```env
PORT=3000
GOOGLE_SHEET_ID=your_google_sheet_id_here
GOOGLE_CREDENTIALS_PATH=./credentials.json
GROUP_NAMES=Group A,Group B,Group C,Group D,Group E
MAX_STUDENTS_PER_GROUP=5
```

**Lưu ý:**
- `GOOGLE_SHEET_ID`: ID của Google Sheet (lấy từ URL)
- `GOOGLE_CREDENTIALS_PATH`: Đường dẫn đến file credentials.json
- `GROUP_NAMES`: Danh sách các nhóm, phân tách bằng dấu phẩy
- `MAX_STUDENTS_PER_GROUP`: Số lượng học viên tối đa mỗi nhóm

### 5. Build và chạy ứng dụng

#### Development mode (với ts-node):

```bash
npm run dev
```

#### Production mode:

```bash
# Build TypeScript code
npm run build

# Start server
npm start
```

Ứng dụng sẽ chạy tại `http://localhost:3000`

## Cấu trúc thư mục

```
group_app/
├── src/
│   ├── server.ts           # Express server và API endpoints
│   └── googleSheet.ts      # Module kết nối Google Sheets API
├── public/
│   ├── index.html          # Giao diện HTML
│   ├── styles.css          # CSS styling
│   └── app.js              # Client-side JavaScript
├── dist/                   # Compiled JavaScript (sau khi build)
├── .env                    # Environment variables (không commit)
├── .env.example            # Template cho .env
├── credentials.json        # Google service account credentials (không commit)
├── package.json
├── tsconfig.json
└── README.md
```

## API Endpoints

### GET /api/groups
Lấy danh sách tất cả các nhóm với thông tin trạng thái

**Response:**
```json
{
  "success": true,
  "groups": [
    {
      "name": "Group A",
      "count": 3,
      "isFull": false,
      "maxStudents": 5
    }
  ]
}
```

### GET /api/students
Lấy danh sách tất cả học viên đã đăng ký

**Response:**
```json
{
  "success": true,
  "students": [
    {
      "name": "Nguyễn Văn A",
      "email": "example@email.com",
      "phone": "0123456789",
      "school": "THPT ABC",
      "group": "Group A"
    }
  ]
}
```

### POST /api/register
Đăng ký học viên mới

**Request Body:**
```json
{
  "name": "Nguyễn Văn A",
  "email": "example@email.com",
  "phone": "0123456789",
  "school": "THPT ABC",
  "group": "Group A"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful!"
}
```

## Validation

Ứng dụng thực hiện các validation sau:

- **Họ tên**: Bắt buộc
- **Email**: Bắt buộc, định dạng email hợp lệ
- **Số điện thoại**: Bắt buộc, 10-11 số
- **Trường học**: Bắt buộc
- **Nhóm**: Bắt buộc, phải là nhóm còn chỗ trống

## Xử lý lỗi

- Nếu nhóm đã đầy, người dùng không thể chọn nhóm đó
- Nếu có lỗi kết nối Google Sheets, server sẽ trả về lỗi 500
- Form validation được thực hiện ở cả client và server

## Security Notes

⚠️ **Quan trọng:**

1. **KHÔNG commit** file `.env` và `credentials.json` lên git
2. File `.gitignore` nên bao gồm:
   ```
   node_modules/
   dist/
   .env
   credentials.json
   ```
3. Giữ service account credentials an toàn
4. Chỉ chia sẻ Google Sheet với service account cần thiết

## Troubleshooting

### Lỗi "Failed to initialize Google Sheet"

- Kiểm tra `GOOGLE_SHEET_ID` có đúng không
- Kiểm tra file `credentials.json` có tồn tại không
- Kiểm tra đã chia sẻ sheet với service account email chưa
- Kiểm tra Google Sheets API đã được kích hoạt chưa

### Lỗi "Permission denied"

- Đảm bảo đã chia sẻ sheet với service account email (trong `credentials.json`)
- Cấp quyền "Editor" cho service account

### Port đã được sử dụng

- Thay đổi `PORT` trong file `.env`
- Hoặc kill process đang sử dụng port 3000:
  ```bash
  lsof -ti:3000 | xargs kill -9
  ```

## License

MIT

## Author

Student Group Registration System - 2025
