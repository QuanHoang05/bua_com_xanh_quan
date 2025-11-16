import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { db } from '../lib/db.js';
import { requireAuth, requireRole } from '../middlewares/auth.js'; // Import từ file middleware mới

const router = Router();

// Cấu hình multer để lưu file trong bộ nhớ (buffer)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Chỉ cho phép các file excel
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // .xlsx
      file.mimetype === 'application/vnd.ms-excel' // .xls
    ) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ cho phép file Excel (.xlsx, .xls)!'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // Giới hạn 5MB
});

/**
 * POST /api/admin/payments/import
 * Endpoint cho phép admin tải lên file Excel để import giao dịch.
 * File Excel cần có các cột: code, amount, paid_at, donor_name, campaign_id
 */
router.post(
  '/api/admin/payments/import',
  requireAuth,
  requireRole('admin'),
  upload.single('importFile'), // 'importFile' là tên của field trong form-data
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ message: 'Không có file nào được tải lên.' });
    }

    const workbook = new ExcelJS.Workbook();
    const transactionsToInsert = [];

    try {
      // Đọc dữ liệu từ buffer của file
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.getWorksheet(1); // Lấy sheet đầu tiên

      if (!worksheet) {
        throw new Error('File Excel không có sheet nào.');
      }

      // Xác thực header của file
      const expectedHeaders = ['code', 'amount', 'paid_at', 'donor_name', 'campaign_id'];
      const headerRow = worksheet.getRow(1);
      const actualHeaders = [];
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        actualHeaders[colNumber - 1] = cell.value;
      });

      // Kiểm tra xem tất cả các header cần thiết có tồn tại không
      const missingHeaders = expectedHeaders.filter(h => !actualHeaders.includes(h));
      if (missingHeaders.length > 0) {
        return res.status(400).json({ message: `File Excel thiếu các cột bắt buộc: ${missingHeaders.join(', ')}` });
      }

      // Đọc dữ liệu từ các dòng
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        // Bỏ qua dòng header
        if (rowNumber === 1) return;

        const rowData = {};
        headerRow.eachCell((cell, colNumber) => {
          rowData[cell.value] = row.getCell(colNumber).value;
        });

        // Chỉ lấy các giao dịch có đủ thông tin cơ bản
        if (rowData.code && rowData.amount > 0) {
          transactionsToInsert.push({
            code: rowData.code,
            amount: parseFloat(rowData.amount),
            paid_at: new Date(rowData.paid_at),
            donor_name: rowData.donor_name,
            campaign_id: parseInt(rowData.campaign_id, 10) || null,
            status: 'success', // Mặc định là thành công
            provider: 'import',
          });
        }
      });

      if (transactionsToInsert.length === 0) {
        return res.status(400).json({ message: 'Không tìm thấy giao dịch hợp lệ nào trong file.' });
      }

      // Chèn dữ liệu vào database (ví dụ: bảng 'donations')
      // Lưu ý: Cần có cơ chế chống chèn trùng lặp dựa trên 'code'
      const query = 'INSERT INTO donations (transaction_code, amount, paid_at, donor_name, campaign_id, status, payment_provider) VALUES ? ON DUPLICATE KEY UPDATE amount=VALUES(amount), paid_at=VALUES(paid_at)';
      const values = transactionsToInsert.map(t => [t.code, t.amount, t.paid_at, t.donor_name, t.campaign_id, t.status, t.provider]);
      
      await db.pool.query(query, [values]);

      res.status(200).json({ message: `Import thành công ${transactionsToInsert.length} giao dịch.` });

    } catch (error) {
      console.error('Lỗi xử lý file Excel:', error);
      res.status(500).json({ message: 'Không thể xử lý file Excel.' });
    }
  }
);

export default router;