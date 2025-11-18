﻿﻿﻿import { db, migrate } from "./lib/db.js";
import bcrypt from "bcryptjs"; 
import crypto from "crypto";

// Helper to stringify JSON
function j(x){ return JSON.stringify(x); }

const now = new Date().toISOString();

async function clean() {
  // Delete data from tables in reverse order of dependency
  db.exec(`
    DROP TABLE IF EXISTS food_items;
    DROP TABLE IF EXISTS bookings;
    DROP TABLE IF EXISTS donations;
    DROP TABLE IF EXISTS pickup_points;
    DROP TABLE IF EXISTS campaigns;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS tags;
    DROP TABLE IF EXISTS metrics_daily;
  `);
}

async function seed() {

  // Luôn chạy migrate để đảm bảo các bảng đã được tạo trước khi seed
  migrate();

  // tags cơ bản
  const baseTags = [
    ["chay","Đồ chay"],
    ["khong-lactose","Không lactose"],
    ["khong-gluten","Không gluten"],
    ["an-toan","An toàn kiểm định"]
  ];
  for (const [slug,name] of baseTags) {
    db.prepare("INSERT OR IGNORE INTO tags(slug,name) VALUES (?,?)").run(slug,name);
  }

  // users mẫu
  const adminId = crypto.randomUUID();
  const donorId = crypto.randomUUID();
  const donor2Id = crypto.randomUUID();
  const recvId  = crypto.randomUUID();
  const shipperId = crypto.randomUUID();
  const shipper2Id = crypto.randomUUID();
  const bannedId = crypto.randomUUID();

  const adminPass = await bcrypt.hash("admin123", 10);
  const donorPass = await bcrypt.hash("donor123", 10);
  const donor2Pass = await bcrypt.hash("donor456", 10);
  const recvPass  = await bcrypt.hash("recv123", 10);
  const shipperPass = await bcrypt.hash("shipper123", 10);
  const shipper2Pass = await bcrypt.hash("shipper456", 10);
  const bannedPass = await bcrypt.hash("banned123", 10);

  db.prepare("INSERT OR IGNORE INTO users(id,email,password_hash,name,role) VALUES (?,?,?,?,?)")
    .run(adminId,"admin@bua.com",adminPass,"Admin","admin");
  db.prepare("INSERT OR IGNORE INTO users(id,email,password_hash,name,role) VALUES (?,?,?,?,?)")
    .run(donorId,"donor@bua.com",donorPass,"Chị Lan","donor");
  db.prepare("INSERT OR IGNORE INTO users(id,email,password_hash,name,role) VALUES (?,?,?,?,?)")
    .run(donor2Id,"donor2@bua.com",donor2Pass,"Anh Hùng","donor");
  db.prepare("INSERT OR IGNORE INTO users(id,email,password_hash,name,role) VALUES (?,?,?,?,?)")
    .run(recvId,"receiver@bua.com",recvPass,"Anh Minh","recipient"); // Role is 'recipient'
  db.prepare("INSERT OR IGNORE INTO users(id,email,password_hash,name,role) VALUES (?,?,?,?,?)")
    .run(shipperId,"shipper@bua.com",shipperPass,"Chú Ba Giao Hàng","shipper");
  db.prepare("INSERT OR IGNORE INTO users(id,email,password_hash,name,role) VALUES (?,?,?,?,?)")
    .run(shipper2Id,"shipper2@bua.com",shipper2Pass,"Cô Tư Giao Nhanh","shipper");
  db.prepare("INSERT OR IGNORE INTO users(id,email,password_hash,name,role,status) VALUES (?,?,?,?,?,?)")
    .run(bannedId,"banned@bua.com",bannedPass,"Tài Khoản Bị Cấm","donor","banned");

  // pickup point
  const ppId = crypto.randomUUID();
  db.prepare(`INSERT OR IGNORE INTO pickup_points(id,name,address,lat,lng,opening,status)
  VALUES (?,?,?,?,?,?,?)`).run(
    ppId,"Nhà văn hoá phường 5","Q.5, TP.HCM",10.754,106.667,j({mon_fri:"08:00-18:00"}),"active"
  );

  // món mẫu (2 món)
  const item1 = crypto.randomUUID();
  const item2 = crypto.randomUUID();
  db.prepare(`INSERT OR IGNORE INTO food_items
  (id, owner_id, title, description, qty, unit, expire_at, location_addr, lat, lng, tags, images, status, visibility)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    item1, donorId, "Cơm chay thập cẩm", "Suất cơm chay, bảo quản mát", 20,"suất",
    new Date(Date.now()+36e5*12).toISOString(), "P.5, Q.5, TP.HCM",10.755,106.665,
    j(["chay","an-toan"]), j([]), "available","public"
  );
  db.prepare(`INSERT OR IGNORE INTO food_items
  (id, owner_id, title, description, qty, unit, expire_at, location_addr, lat, lng, tags, images, status, visibility)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    item2, donorId, "Bánh mì không lactose", "Phù hợp người dị ứng sữa", 15,"ổ",
    new Date(Date.now()+36e5*24).toISOString(), "P.4, Q.10, TP.HCM",10.766,106.664,
    j(["khong-lactose"]), j([]), "available","public"
  );

  // --- Dữ liệu tương thích DB ---
  const useMySQL = (process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql";

  // campaign mẫu (SQLite dùng số để dễ test)
  const campaignId1 = 11111;
  const campaignId2 = 22222;
  const campaignId3 = 33333;
  const campaignId4 = 44444;

  const campaigns = [
    { id: campaignId1, title: 'Chiến dịch test (active)', description: 'Mô tả', status: 'active', type: 'money', meta: j({goal: 1000000}) },
    { id: campaignId2, title: 'Chiến dịch của Admin 2', description: 'Mô tả', status: 'active', type: 'money', meta: j({goal: 500000}) },
    { id: campaignId3, title: 'Chiến dịch đã đóng', description: 'Mô tả', status: 'closed', type: 'money', meta: j({goal: 200000}) },
    { id: campaignId4, title: 'Chiến dịch sắp diễn ra', description: 'Mô tả', status: 'pending', type: 'money', meta: j({goal: 300000}) },
  ];

  const campaignStmt = db.prepare(`INSERT OR IGNORE INTO campaigns (id, title, description, status, type, meta) VALUES (?, ?, ?, ?, ?, ?)`);
  for (const c of campaigns) {
    campaignStmt.run(c.id, c.title, c.description, c.status, c.type, c.meta);
  }

  // booking mẫu
  const bookings = [
    { id: 1, campaign_id: campaignId1, user_id: recvId, status: 'pending', qty: 2, notes: 'Booking for delivery test' },
    { id: 2, campaign_id: campaignId1, user_id: recvId, status: 'completed', qty: 1, notes: 'Booking đã hoàn thành' },
  ];
  const bookingStmt = db.prepare(`INSERT OR IGNORE INTO bookings (id, campaign_id, user_id, status, qty, notes) VALUES (?, ?, ?, ?, ?, ?)`);
  for (const b of bookings) {
    bookingStmt.run(b.id, b.campaign_id, b.user_id, b.status, b.qty, b.notes);
  }

  // Thêm donation mẫu cho campaign ở trên để các câu query tổng hợp không bị lỗi
  // Dựa theo schema trong db.sqlite.js, bảng donations không có cột `id` tự tăng
  // mà là INTEGER PRIMARY KEY, nên ta có thể tự định nghĩa.
  db.prepare(
    `INSERT OR IGNORE INTO donations (id, campaign_id, user_id, type, amount, qty, currency, status, donor_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    99999, // ID donation mẫu
    campaignId1, // Liên kết với campaign đã tạo ở trên
    donorId,    // Liên kết với user donor
    'money',    // Loại ủng hộ
    100000,     // Số tiền
    0,          // Số lượng (cho hiện vật)
    'VND',      // Tiền tệ
    'success',  // Trạng thái
    'Người ủng hộ Test' // Tên
  );

  // metric ngày
  db.prepare("INSERT OR IGNORE INTO metrics_daily(day,items,bookings,deliveries,rescued_meals,fee_revenue) VALUES (date('now'),0,0,0,0,0)").run();
  
  if (process.env.NODE_ENV !== 'test') {
    console.log("Seeded full data for testing.");
  }
}

export default { seed, clean };
