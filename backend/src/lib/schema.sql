/* ===========================================
   BỮA CƠM XANH – CLEAN SCHEMA (MySQL 8+)
   Đồng bộ BE/FE (campaigns & donations)
   =========================================== */

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

/* ============= CÁC BẢNG CỐT LÕI ============= */

/* ---- campaigns ----
   - type: 'money' | 'meal'
   - meal_price: giá 1 phần (đ) dùng để quy đổi khi type='meal'
   - meal_received_qty: chỉ để lưu thủ công nếu cần (KHÔNG dùng cộng vào thống kê, đã có view/tính toán realtime)
*/
DROP TABLE IF EXISTS campaigns;
CREATE TABLE campaigns (
  id                CHAR(36)        NOT NULL,
  title             VARCHAR(255)    NOT NULL,
  type              ENUM('money','meal') NOT NULL DEFAULT 'money',
  description       TEXT DEFAULT NULL,
  location          VARCHAR(255) DEFAULT '',
  cover_url         VARCHAR(512) DEFAULT NULL,
  cover             VARCHAR(512) DEFAULT '',
  status            ENUM('draft','active','archived') NOT NULL DEFAULT 'draft',
  tags              TEXT NOT NULL DEFAULT '[]',       -- JSON array
  target_amount     BIGINT          NOT NULL DEFAULT 0,
  raised_amount     BIGINT          NOT NULL DEFAULT 0, -- có cũng được; BE vẫn tính realtime
  supporters        INT             NOT NULL DEFAULT 0, -- như trên
  meal_price        INT             NOT NULL DEFAULT 10000,
  meal_received_qty INT             NOT NULL DEFAULT 0, -- số ghi chú, KHÔNG cộng vào tính realtime
  goal              INT             NOT NULL DEFAULT 0, -- giữ tương thích FE cũ
  raised            INT             NOT NULL DEFAULT 0, -- giữ tương thích FE cũ
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME        NULL,
  deadline          DATETIME        NULL,
  PRIMARY KEY (id),
  KEY idx_campaigns_status(status),
  KEY idx_campaigns_deadline(deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---- donations ----
   - type: 'money' hoặc 'meal' (KHÔNG dùng 'food' hay rỗng)
   - qty: số khẩu phần hiện vật
   - amount: số tiền (đ)
   - chỉ record status='success' mới được tính
*/
DROP TABLE IF EXISTS donations;
CREATE TABLE donations (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  campaign_id CHAR(36) NOT NULL,
  type        ENUM('money','meal') NOT NULL DEFAULT 'money',
  amount      BIGINT   NOT NULL DEFAULT 0,
  qty         INT      NOT NULL DEFAULT 0,
  currency    VARCHAR(10) NOT NULL DEFAULT 'VND',
  donor_name  VARCHAR(255),
  donor_note  VARCHAR(255),
  memo        VARCHAR(255),
  bank_txn_id VARCHAR(64),
  status      ENUM('pending','success','failed','refunded') NOT NULL DEFAULT 'pending',
  paid_at     DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_donations_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE UNIQUE INDEX ux_donations_bank_txn ON donations(bank_txn_id);
CREATE INDEX idx_donations_campaign ON donations(campaign_id, status);
CREATE INDEX idx_donations_type     ON donations(type);

/* ============= VIEW TỔNG HỢP (tiện cho BE) ============= */
/* Có thể JOIN thay vì subquery nếu muốn. */
DROP VIEW IF EXISTS campaign_agg;
CREATE VIEW campaign_agg AS
SELECT
  c.id,
  /* Tổng tiền từ donations success */
  (SELECT COALESCE(SUM(d.amount),0)
     FROM donations d
     WHERE d.campaign_id=c.id AND d.status='success') AS raised_calc,
  /* Tổng lượt ủng hộ success */
  (SELECT COUNT(*)
     FROM donations d
     WHERE d.campaign_id=c.id AND d.status='success') AS supporters_calc,
  /* Tổng khẩu phần hiện vật (qty) từ donations success */
  (SELECT COALESCE(SUM(CASE WHEN d.status='success' AND d.qty>0 THEN d.qty ELSE 0 END),0)
     FROM donations d
     WHERE d.campaign_id=c.id) AS meal_qty_calc,
  /* Tổng tiền thuần (để quy đổi bữa khi type='meal') */
  (SELECT COALESCE(SUM(CASE WHEN d.status='success' AND d.amount>0 THEN d.amount ELSE 0 END),0)
     FROM donations d
     WHERE d.campaign_id=c.id) AS raised_money_calc
FROM campaigns c;

/* ============= TRIGGER (tùy chọn) ============= */
/* Nếu muốn cập nhật cột raised_amount/supporters ngay khi có donation. */
DROP PROCEDURE IF EXISTS recalc_campaign;
DELIMITER $$
CREATE PROCEDURE recalc_campaign (IN p_campaign_id CHAR(36))
BEGIN
  DECLARE v_amount BIGINT DEFAULT 0;
  DECLARE v_cnt    INT    DEFAULT 0;

  SELECT COALESCE(SUM(amount),0), COUNT(*)
    INTO v_amount, v_cnt
  FROM donations
  WHERE campaign_id = p_campaign_id AND status='success';

  UPDATE campaigns
  SET raised_amount = v_amount,
      supporters   = v_cnt
  WHERE id = p_campaign_id;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS donations_ai;
DROP TRIGGER IF EXISTS donations_au;

DELIMITER $$
CREATE TRIGGER donations_ai AFTER INSERT ON donations
FOR EACH ROW
BEGIN
  IF NEW.status='success' THEN
    CALL recalc_campaign(NEW.campaign_id);
  END IF;
END$$

CREATE TRIGGER donations_au AFTER UPDATE ON donations
FOR EACH ROW
BEGIN
  IF (OLD.status <> NEW.status) OR (OLD.amount <> NEW.amount) OR (OLD.qty <> NEW.qty) THEN
    CALL recalc_campaign(NEW.campaign_id);
  END IF;
END$$
DELIMITER ;

/* ============= CÁC BẢNG PHỤ (giữ nguyên cho module khác) ============= */
/* Bạn có thể giữ/loại bỏ tuỳ nhu cầu. Mình giữ cấu trúc chuẩn, không ảnh hưởng campaigns/donations. */

DROP TABLE IF EXISTS announcements;
CREATE TABLE announcements (
  id         INT(11) NOT NULL AUTO_INCREMENT,
  title      VARCHAR(255) NOT NULL,
  content    TEXT NOT NULL,
  level      VARCHAR(50) NOT NULL DEFAULT 'info',
  active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS app_settings;
CREATE TABLE app_settings (
  `key`   VARCHAR(100) NOT NULL,
  `value` LONGTEXT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS audit_logs;
CREATE TABLE audit_logs (
  id         CHAR(36) NOT NULL,
  user_id    CHAR(36) DEFAULT NULL,
  action     VARCHAR(100) NOT NULL,
  entity     VARCHAR(50) DEFAULT NULL,
  entity_id  CHAR(36) DEFAULT NULL,
  ip         VARCHAR(45) DEFAULT NULL,
  ua         VARCHAR(255) DEFAULT NULL,
  meta       LONGTEXT NOT NULL DEFAULT (JSON_OBJECT()),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_id   VARCHAR(255) DEFAULT NULL,
  target_id  VARCHAR(255) DEFAULT NULL,
  detail     TEXT DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_audit_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id            CHAR(36) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          VARCHAR(255) DEFAULT '',
  phone         VARCHAR(20) DEFAULT NULL,
  address       VARCHAR(255) DEFAULT NULL,
  avatar_url    TEXT DEFAULT NULL,
  role          ENUM('user','donor','receiver','shipper','admin') NOT NULL DEFAULT 'user',
  status        ENUM('active','locked','deleted','banned') NOT NULL DEFAULT 'active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS user_roles;
CREATE TABLE user_roles (
  user_id CHAR(36) NOT NULL,
  role    VARCHAR(50) NOT NULL,
  PRIMARY KEY (user_id, role),
  CONSTRAINT fk_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS tags;
CREATE TABLE tags (
  id   BIGINT(20) NOT NULL AUTO_INCREMENT,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS user_preferences;
CREATE TABLE user_preferences (
  user_id   CHAR(36) NOT NULL,
  diet_tags TEXT  DEFAULT '[]',
  radius_km FLOAT DEFAULT 10,
  notif_email TINYINT(1) DEFAULT 1,
  notif_push  TINYINT(1) DEFAULT 1,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_pref_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS pickup_points;
CREATE TABLE pickup_points (
  id         CHAR(36) NOT NULL,
  name       VARCHAR(255) NOT NULL,
  address    TEXT DEFAULT NULL,
  lat        DECIMAL(10,8) DEFAULT NULL,
  lng        DECIMAL(11,8) DEFAULT NULL,
  opening    TEXT DEFAULT NULL,
  status     ENUM('active','inactive') DEFAULT 'active',
  active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS food_items;
CREATE TABLE food_items (
  id            CHAR(36) NOT NULL,
  owner_id      CHAR(36) NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  qty           INT NOT NULL DEFAULT 1,
  quantity      INT NOT NULL DEFAULT 1,
  unit          VARCHAR(50) DEFAULT 'suat',
  expire_at     DATETIME DEFAULT NULL,
  expires_at    DATETIME DEFAULT NULL,
  location_addr TEXT DEFAULT NULL,
  lat           DECIMAL(10,8) DEFAULT NULL,
  lng           DECIMAL(11,8) DEFAULT NULL,
  tags          TEXT DEFAULT '[]',
  images        TEXT DEFAULT '[]',
  status        ENUM('available','reserved','given','expired','hidden') NOT NULL DEFAULT 'available',
  visibility    ENUM('public','private') NOT NULL DEFAULT 'public',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_food_owner (owner_id),
  CONSTRAINT fk_food_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS bundles;
CREATE TABLE bundles (
  id          CHAR(36) NOT NULL,
  owner_id    CHAR(36) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  cover       TEXT,
  tags        TEXT DEFAULT '[]',
  status      ENUM('active','closed') DEFAULT 'active',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_bundle_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS bundle_items;
CREATE TABLE bundle_items (
  bundle_id CHAR(36) NOT NULL,
  item_id   CHAR(36) NOT NULL,
  PRIMARY KEY (bundle_id, item_id),
  CONSTRAINT fk_bundleitem_bundle FOREIGN KEY (bundle_id) REFERENCES bundles(id)   ON DELETE CASCADE,
  CONSTRAINT fk_bundleitem_item   FOREIGN KEY (item_id)   REFERENCES food_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS bookings;
CREATE TABLE bookings (
  id           CHAR(36) NOT NULL,
  item_id      CHAR(36) DEFAULT NULL,
  bundle_id    CHAR(36) DEFAULT NULL,
  receiver_id  CHAR(36) NOT NULL,
  qty          INT NOT NULL DEFAULT 1,
  note         TEXT,
  method       ENUM('pickup','meet','delivery') DEFAULT 'pickup',
  pickup_point CHAR(36) DEFAULT NULL,
  status       ENUM('pending','accepted','rejected','cancelled','completed','expired','requested','new') NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT NULL,
  expires_at   DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_booking_receiver (receiver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS payments;
CREATE TABLE payments (
  id            CHAR(36) NOT NULL,
  booking_id    CHAR(36) NOT NULL,
  payer_id      CHAR(36) NOT NULL,
  amount        INT NOT NULL,
  provider      ENUM('momo','vnpay','zalopay'),
  provider_txn  VARCHAR(255) DEFAULT NULL,
  status        ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
  meta          TEXT DEFAULT '{}',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS deliveries;
CREATE TABLE deliveries (
  id           CHAR(36) NOT NULL,
  booking_id   CHAR(36) NOT NULL,
  shipper_id   CHAR(36) NOT NULL,
  status       ENUM('assigned','picking','delivering','delivered','failed','cancelled','done','completed') DEFAULT 'assigned',
  qty          INT NOT NULL DEFAULT 0,
  otp_code     VARCHAR(10) DEFAULT NULL,
  proof_images TEXT DEFAULT '[]',
  route_geojson TEXT DEFAULT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS reports;
CREATE TABLE reports (
  id             CHAR(36) NOT NULL,
  reporter_id    CHAR(36) NOT NULL,
  target_type    ENUM('item','user','booking','bundle') NOT NULL,
  target_id      CHAR(36) NOT NULL,
  target_user_id CHAR(36) DEFAULT NULL,
  target_item_id CHAR(36) DEFAULT NULL,
  reason         TEXT NOT NULL,
  notes          TEXT DEFAULT NULL,
  status         ENUM('open','reviewing','resolved','rejected','closed','dismissed') DEFAULT 'open',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at    DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_reporter (reporter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS notifications;
CREATE TABLE notifications (
  id         CHAR(36) NOT NULL,
  user_id    CHAR(36) NOT NULL,
  type       ENUM('booking_update','delivery_update','system','payment_update') NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT DEFAULT NULL,
  seen       TINYINT(1) DEFAULT 0,
  data       TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS metrics_daily;
CREATE TABLE metrics_daily (
  day           DATE NOT NULL,
  items         INT  DEFAULT 0,
  bookings      INT  DEFAULT 0,
  deliveries    INT  DEFAULT 0,
  rescued_meals INT  DEFAULT 0,
  fee_revenue   INT  DEFAULT 0,
  PRIMARY KEY (day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS migrations;
CREATE TABLE migrations (
  id        INT(11) NOT NULL AUTO_INCREMENT,
  migration VARCHAR(255) NOT NULL,
  batch     INT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS otp_codes;
CREATE TABLE otp_codes (
  id        CHAR(36) NOT NULL,
  user_id   CHAR(36) NOT NULL,
  code      VARCHAR(10) NOT NULL,
  expire_at DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS password_resets;
CREATE TABLE password_resets (
  id         BIGINT(20) NOT NULL AUTO_INCREMENT,
  email      VARCHAR(255) NOT NULL,
  token      VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS site_settings;
CREATE TABLE site_settings (
  k          VARCHAR(128) NOT NULL,
  v          TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* (Tuỳ nhu cầu) các bảng orders/shipment/delivery_proofs – không bắt buộc cho module campaigns */
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
  id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  title               VARCHAR(255),
  donor_id            VARCHAR(64),
  receiver_id         VARCHAR(64),
  pickup_address      VARCHAR(255),
  pickup_lat          DECIMAL(10,6) NULL,
  pickup_lng          DECIMAL(10,6) NULL,
  drop_address        VARCHAR(255),
  drop_lat            DECIMAL(10,6) NULL,
  drop_lng            DECIMAL(10,6) NULL,
  area_code           VARCHAR(32),
  assigned_shipper_id VARCHAR(64) NULL,
  status              ENUM('pending','assigned','picked_up','delivering','delivered','canceled') NOT NULL DEFAULT 'pending',
  otp_code            VARCHAR(16),
  qr_payload          TEXT,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status(status),
  INDEX idx_area(area_code),
  INDEX idx_shipper(assigned_shipper_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS shipment_events;
CREATE TABLE shipment_events (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id   BIGINT UNSIGNED NOT NULL,
  actor_id   VARCHAR(64) NULL,
  event      VARCHAR(64) NOT NULL,
  meta_json  JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order(order_id),
  CONSTRAINT fk_events_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS delivery_proofs;
CREATE TABLE delivery_proofs (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id   BIGINT UNSIGNED NOT NULL,
  shipper_id VARCHAR(64) NULL,
  url        VARCHAR(255) NOT NULL,
  note       VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order(order_id),
  CONSTRAINT fk_proofs_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

/* ============================================================
   LEAN MIGRATE cho DB ĐANG CHẠY (CHẠY SAU KHI BACKUP):
   - Chuẩn hoá donations.type và dữ liệu success
   ============================================================

-- 1) Nếu donations.type còn rỗng hoặc 'food' ⇒ chuyển về 'meal'/'money'
UPDATE donations
SET type = CASE
  WHEN (type IS NULL OR type='') AND qty > 0 THEN 'meal'
  WHEN (type IS NULL OR type='') AND (qty IS NULL OR qty=0) THEN 'money'
  ELSE type
END;

UPDATE donations SET type='meal' WHERE type='food';

-- 2) (không bắt buộc) cập nhật lại tổng ở campaigns cho khớp
-- (BE đã tính realtime; bước này chỉ để có số tổng trong bảng)
CALL recalc_campaign('<ID_CAMPAIGN>');  -- gọi cho từng campaign hoặc viết vòng lặp ngoài
*/
