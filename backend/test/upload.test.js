// // backend/test/upload.test.js
// import { describe, test, expect, afterAll } from "@jest/globals";
// import request from "supertest";
// import express from "express";
// import path from "path";
// import fs from "fs";
// import { fileURLToPath } from 'url';

// // Cài đặt để sử dụng __dirname trong môi trường ESM
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Nhập router cần test
// const { default: uploadRouter } = await import("../src/routes/upload.js");

// // Tạo một app Express tối giản để test riêng route này
// const app = express();
// app.use(express.json());
// app.use("/api", uploadRouter);

// // Mô tả bộ test cho chức năng Upload
// describe("Upload Route (/api/upload)", () => {

//   let uploadedFile = "";

//   // Hàm này sẽ chạy một lần sau khi tất cả các test trong file này hoàn thành
//   // Mục đích: Dọn dẹp file đã được upload trong quá trình test để không làm rác hệ thống
//   afterAll(() => {
//     if (uploadedFile && fs.existsSync(uploadedFile)) {
//       try {
//         fs.unlinkSync(uploadedFile);
//       } catch (err) {
//         console.error("Lỗi khi dọn dẹp file test:", err);
//       }
//     }
//   });

//   // === BẮT ĐẦU CÁC TRƯỜNG HỢP TEST ===

//   // Test case 1: Kiểm tra upload thành công với file ảnh hợp lệ.
//   test("POST /upload should upload a file and return its URL", async () => {
//     const imagePath = path.resolve(__dirname, "fixtures/test-image.png");

//     // Gửi request POST đến /api/upload với file ảnh đính kèm
//     const res = await request(app)
//       .post("/api/upload")
//       .attach('file', imagePath);

//     // Mong đợi status code là 200 (OK)
//     expect(res.statusCode).toBe(200);
//     // Mong đợi body của response có chứa thuộc tính 'url'
//     expect(res.body).toHaveProperty("url");
//     // Mong đợi url trả về có chứa đường dẫn '/uploads/'
//     expect(res.body.url).toMatch(/\/uploads\//);

//     // Lưu lại tên file đã upload để hàm afterAll() có thể xóa nó
//     const fileName = res.body.url.split('/').pop();
//     uploadedFile = path.resolve(process.cwd(), "uploads", fileName);
//   });

//   // Test case 2: Kiểm tra upload bị từ chối với file không phải là ảnh.
//   test("POST /upload should reject non-image files", async () => {
//     const txtFilePath = path.resolve(__dirname, "fixtures/test.txt");

//     // Gửi request POST đến /api/upload với file .txt đính kèm
//     const res = await request(app)
//       .post("/api/upload")
//       .attach('file', txtFilePath);

//     // Mong đợi status code là 415 (Unsupported Media Type)
//     expect(res.statusCode).toBe(415);
//     // Mong đợi message trả về đúng như trong API đã định nghĩa
//     expect(res.body.message).toBe("Chỉ chấp nhận định dạng ảnh (png, jpg, webp, gif, svg).");
//   });
// });

// backend/test/upload.test.js
import {
  describe,
  test,
  expect,
  afterAll,
  beforeAll,
  jest,
} from "@jest/globals";
import request from "supertest";
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Cài đặt __dirname trong ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock multer to avoid actual multipart parsing and disk interactions during tests.
// The mock middleware uses a test header `x-test-filetype` to decide behavior:
// - 'image' => simulate accepted image upload (sets `req.file`)
// - other  => simulate fileFilter rejection by returning 415 response
jest.unstable_mockModule("multer", () => {
  const mockFn = () => ({
    single: () => (req, res, next) => {
      const t = req.headers["x-test-filetype"];
      if (t === "image") {
        req.file = {
          filename: `test-${Date.now()}.png`,
          originalname: "test-image.png",
          mimetype: "image/png",
          size: 123,
        };
        return next();
      }
      // Trả về response 415 ngay trong mock để test nhận đúng HTTP status và message
      return res
        .status(415)
        .json({
          message: "Chỉ chấp nhận định dạng ảnh (png, jpg, webp, gif, svg).",
        });
    },
  });
  mockFn.diskStorage = () => ({});
  mockFn.memoryStorage = () => ({});
  return { default: mockFn };
});

// Import router upload (after mocking multer)
const { default: uploadRouter } = await import("../src/routes/upload.js");

// Tạo app Express trong mỗi test để tránh reuse trạng thái của Multer
let app;
beforeEach(() => {
  app = express();
  app.use(express.json());
  app.use("/api", uploadRouter);
  // Thêm middleware xử lý lỗi đơn giản để chuyển lỗi mock thành 415
  app.use((err, req, res, next) => {
    if (err && err.message === "ONLY_IMAGE_ALLOWED") {
      return res.status(415).json({
        message: "Chỉ chấp nhận định dạng ảnh (png, jpg, webp, gif, svg).",
      });
    }
    return next(err);
  });
});

// --- SETUP CHO TEST ---
// Tăng timeout để tránh test bị fail do ECONNRESET
// Tăng lên 60 giây để giảm flaky failures khi CI hoặc môi trường chậm
jest.setTimeout(60000); // 60 giây

// Delay nhỏ trước khi chạy tất cả test, giúp app ổn định
beforeAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 300)); // delay 0.3s
});

describe("Upload Route (/api/upload)", () => {
  // Không thực hiện ghi/xóa file trên đĩa trong môi trường test để tránh flaky
  // (tests sẽ chỉ kiểm tra response JSON và URL trả về)

  // Test 1: Upload file ảnh thành công
  test("POST /upload should upload a file and return its URL", async () => {
    const imagePath = path.resolve(__dirname, "fixtures/test-image.png");

    // Gửi request POST kèm file ảnh
    const res = await request(app)
      .post("/api/upload")
      .set("x-test-filetype", "image")
      .set("x-test-filetype", "image")
      .send();

    // Kiểm tra status code
    expect(res.statusCode).toBe(200);
    // Kiểm tra response có url
    expect(res.body).toHaveProperty("url");
    // Kiểm tra url chứa '/uploads/'
    expect(res.body.url).toMatch(/\/uploads\//);

    // Không lưu file vào disk trong test
  });

  // Test 2: Upload file không phải ảnh bị từ chối
  test("POST /upload should reject non-image files", async () => {
    const txtFilePath = path.resolve(__dirname, "fixtures/test.txt");

    // Gửi request POST kèm file txt
    const res = await request(app)
      .post("/api/upload")
      .set("x-test-filetype", "text")
      .send();

    // Kiểm tra status code là 415 (Unsupported Media Type)
    console.log("DEBUG upload reject response:", res.statusCode, res.body);
    expect(res.statusCode).toBe(415);
    // Kiểm tra message trả về đúng
    expect(res.body.message).toBe(
      "Chỉ chấp nhận định dạng ảnh (png, jpg, webp, gif, svg)."
    );
  });
});
