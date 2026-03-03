-- ============================================================
-- NOIR COFFEE — Database MySQL
-- Dibuat untuk aplikasi kedai kopi Laravel
-- ============================================================

CREATE DATABASE IF NOT EXISTS `noir_coffee`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `noir_coffee`;

-- ============================================================
-- TABLE: categories
-- ============================================================
CREATE TABLE `categories` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(100)    NOT NULL,
  `slug`       VARCHAR(100)    NOT NULL,
  `created_at` TIMESTAMP       NULL DEFAULT NULL,
  `updated_at` TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: products
-- ============================================================
CREATE TABLE `products` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id`  BIGINT UNSIGNED NOT NULL,
  `name`         VARCHAR(150)    NOT NULL,
  `slug`         VARCHAR(150)    NOT NULL,
  `description`  TEXT            DEFAULT NULL,
  `price`        DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `image`        VARCHAR(255)    DEFAULT NULL,
  `is_available` TINYINT(1)      NOT NULL DEFAULT 1,
  `is_featured`  TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`   TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`   TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_slug_unique` (`slug`),
  KEY `products_category_id_foreign` (`category_id`),
  CONSTRAINT `products_category_id_foreign`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: orders
-- ============================================================
CREATE TABLE `orders` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_number`   VARCHAR(20)     NOT NULL,
  `customer_name`  VARCHAR(100)    NOT NULL,
  `customer_email` VARCHAR(150)    DEFAULT NULL,
  `customer_phone` VARCHAR(20)     DEFAULT NULL,
  `type`           ENUM('dine_in','takeaway') NOT NULL DEFAULT 'dine_in',
  `table_number`   VARCHAR(10)     DEFAULT NULL,
  `status`         ENUM('pending','confirmed','preparing','ready','completed','cancelled')
                   NOT NULL DEFAULT 'pending',
  `payment_status` ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid',
  `payment_method` ENUM('cash','transfer','qris') NOT NULL DEFAULT 'cash',
  `subtotal`       DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `tax`            DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `total`          DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `notes`          TEXT            DEFAULT NULL,
  `created_at`     TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`     TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `orders_order_number_unique` (`order_number`),
  KEY `orders_status_index` (`status`),
  KEY `orders_created_at_index` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: order_items
-- ============================================================
CREATE TABLE `order_items` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id`     BIGINT UNSIGNED NOT NULL,
  `product_id`   BIGINT UNSIGNED NOT NULL,
  `product_name` VARCHAR(150)    NOT NULL,
  `price`        DECIMAL(10,2)   NOT NULL,
  `quantity`     INT             NOT NULL DEFAULT 1,
  `subtotal`     DECIMAL(10,2)   NOT NULL,
  `notes`        TEXT            DEFAULT NULL,
  `created_at`   TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`   TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `order_items_order_id_foreign` (`order_id`),
  KEY `order_items_product_id_foreign` (`product_id`),
  CONSTRAINT `order_items_order_id_foreign`
    FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `order_items_product_id_foreign`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: users (Laravel default auth)
-- ============================================================
CREATE TABLE `users` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`              VARCHAR(255)    NOT NULL,
  `email`             VARCHAR(255)    NOT NULL,
  `email_verified_at` TIMESTAMP       NULL DEFAULT NULL,
  `password`          VARCHAR(255)    NOT NULL,
  `role`              ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  `remember_token`    VARCHAR(100)    DEFAULT NULL,
  `created_at`        TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`        TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: password_reset_tokens
-- ============================================================
CREATE TABLE `password_reset_tokens` (
  `email`      VARCHAR(255) NOT NULL,
  `token`      VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: sessions
-- ============================================================
CREATE TABLE `sessions` (
  `id`            VARCHAR(255)    NOT NULL,
  `user_id`       BIGINT UNSIGNED DEFAULT NULL,
  `ip_address`    VARCHAR(45)     DEFAULT NULL,
  `user_agent`    TEXT            DEFAULT NULL,
  `payload`       LONGTEXT        NOT NULL,
  `last_activity` INT             NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: cache
-- ============================================================
CREATE TABLE `cache` (
  `key`        VARCHAR(255) NOT NULL,
  `value`      MEDIUMTEXT   NOT NULL,
  `expiration` INT          NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: jobs (Laravel Queue)
-- ============================================================
CREATE TABLE `jobs` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `queue`        VARCHAR(255)    NOT NULL,
  `payload`      LONGTEXT        NOT NULL,
  `attempts`     TINYINT UNSIGNED NOT NULL,
  `reserved_at`  INT UNSIGNED    DEFAULT NULL,
  `available_at` INT UNSIGNED    NOT NULL,
  `created_at`   INT UNSIGNED    NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: migrations (Laravel internal)
-- ============================================================
CREATE TABLE `migrations` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `migration` VARCHAR(255) NOT NULL,
  `batch`     INT          NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEEDER: categories
-- ============================================================
INSERT INTO `categories` (`id`, `name`, `slug`, `created_at`, `updated_at`) VALUES
(1, 'Espresso Based', 'espresso-based', NOW(), NOW()),
(2, 'Manual Brew',    'manual-brew',    NOW(), NOW()),
(3, 'Non Coffee',     'non-coffee',     NOW(), NOW()),
(4, 'Pastry',         'pastry',         NOW(), NOW());

-- ============================================================
-- SEEDER: products
-- ============================================================
INSERT INTO `products` (`category_id`, `name`, `slug`, `description`, `price`, `is_available`, `is_featured`, `created_at`, `updated_at`) VALUES
-- Espresso Based
(1, 'Espresso',    'espresso',    'Shot murni biji kopi pilihan, bold dan intens',                    22000, 1, 0, NOW(), NOW()),
(1, 'Americano',   'americano',   'Espresso dilarutkan dengan air panas, bersih dan tajam',           28000, 1, 0, NOW(), NOW()),
(1, 'Cappuccino',  'cappuccino',  'Espresso, susu panas, dan busa susu yang lembut',                  35000, 1, 1, NOW(), NOW()),
(1, 'Flat White',  'flat-white',  'Double ristretto dengan microfoam susu premium',                   38000, 1, 1, NOW(), NOW()),
(1, 'Caffe Latte', 'caffe-latte', 'Espresso lembut berpadu susu segar steamed',                      35000, 1, 0, NOW(), NOW()),
(1, 'Cortado',     'cortado',     'Espresso dipotong dengan susu hangat, seimbang sempurna',          32000, 1, 0, NOW(), NOW()),
-- Manual Brew
(2, 'V60 Pour Over', 'v60-pour-over', 'Seduhan manual dengan filter kertas, jernih dan floral',      38000, 1, 1, NOW(), NOW()),
(2, 'Chemex',        'chemex',        'Penyeduhan lambat untuk karakter kopi yang clean',             42000, 1, 0, NOW(), NOW()),
(2, 'Aeropress',     'aeropress',     'Tekanan udara menghasilkan rasa yang concentrated',            35000, 1, 0, NOW(), NOW()),
(2, 'Cold Brew',     'cold-brew',     'Diseduh dingin 18 jam, smooth dan rendah asam',               45000, 1, 1, NOW(), NOW()),
-- Non Coffee
(3, 'Matcha Latte',    'matcha-latte',    'Matcha ceremonial grade Jepang dengan susu oat',           38000, 1, 1, NOW(), NOW()),
(3, 'Chocolate Noir',  'chocolate-noir',  'Dark chocolate 70% dengan susu hangat yang kaya',          35000, 1, 0, NOW(), NOW()),
(3, 'Chamomile Tea',   'chamomile-tea',   'Teh bunga chamomile organik, menenangkan jiwa',            28000, 1, 0, NOW(), NOW()),
-- Pastry
(4, 'Croissant Butter',    'croissant-butter',    'Croissant klasik dengan mentega premium, renyah berlapis', 32000, 1, 0, NOW(), NOW()),
(4, 'Banana Bread',        'banana-bread',        'Roti pisang rumahan dengan walnuts panggang',              28000, 1, 0, NOW(), NOW()),
(4, 'Dark Chocolate Tart', 'dark-chocolate-tart', 'Tart cokelat gelap dengan ganache yang intens',           35000, 1, 1, NOW(), NOW());

-- ============================================================
-- SEEDER: admin user (password: admin123)
-- ============================================================
INSERT INTO `users` (`name`, `email`, `password`, `role`, `created_at`, `updated_at`) VALUES
('Admin Noir', 'admin@noircoffee.id',
 '$2y$12$eImiTXuWVxfM37uY4JANjQ==eImiTXuWVxfM37uY4JANjQ==',
 'admin', NOW(), NOW());

-- ============================================================
-- SEEDER: contoh orders (demo data)
-- ============================================================
INSERT INTO `orders` (`order_number`, `customer_name`, `customer_phone`, `type`, `table_number`, `status`, `payment_status`, `payment_method`, `subtotal`, `tax`, `total`, `created_at`, `updated_at`) VALUES
('KK2603010001', 'Budi Santoso', '081234567890', 'dine_in',  'A3', 'completed', 'paid',   'cash',     108000, 10800, 118800, NOW(), NOW()),
('KK2603010002', 'Sari Dewi',    '089876543210', 'takeaway', NULL, 'ready',     'unpaid', 'qris',      45000,  4500,  49500, NOW(), NOW()),
('KK2603010003', 'Andi Wijaya',  NULL,           'dine_in',  'B1', 'preparing', 'unpaid', 'cash',      73000,  7300,  80300, NOW(), NOW());

-- ============================================================
-- SEEDER: order_items untuk demo orders
-- ============================================================
INSERT INTO `order_items` (`order_id`, `product_id`, `product_name`, `price`, `quantity`, `subtotal`, `created_at`, `updated_at`) VALUES
-- Order 1: Budi
(1, 4, 'Flat White',       38000, 2, 76000, NOW(), NOW()),
(1, 14,'Croissant Butter', 32000, 1, 32000, NOW(), NOW()),
-- Order 2: Sari
(2, 10,'Cold Brew',        45000, 1, 45000, NOW(), NOW()),
-- Order 3: Andi
(3, 3, 'Cappuccino',       35000, 1, 35000, NOW(), NOW()),
(3, 11,'Matcha Latte',     38000, 1, 38000, NOW(), NOW());

-- ============================================================
-- VIEWS (opsional - untuk laporan)
-- ============================================================

-- View: Ringkasan pesanan harian
CREATE OR REPLACE VIEW `v_daily_summary` AS
SELECT
  DATE(`created_at`)                                          AS tanggal,
  COUNT(*)                                                    AS total_pesanan,
  COUNT(CASE WHEN `payment_status` = 'paid' THEN 1 END)      AS pesanan_lunas,
  SUM(CASE WHEN `payment_status` = 'paid' THEN `total` END)  AS pendapatan,
  COUNT(CASE WHEN `status` = 'cancelled' THEN 1 END)         AS dibatalkan
FROM `orders`
GROUP BY DATE(`created_at`)
ORDER BY tanggal DESC;

-- View: Produk terlaris
CREATE OR REPLACE VIEW `v_top_products` AS
SELECT
  p.`name`                     AS produk,
  c.`name`                     AS kategori,
  SUM(oi.`quantity`)           AS total_terjual,
  SUM(oi.`subtotal`)           AS total_pendapatan,
  COUNT(DISTINCT oi.`order_id`) AS jumlah_order
FROM `order_items` oi
JOIN `products` p  ON oi.`product_id` = p.`id`
JOIN `categories` c ON p.`category_id` = c.`id`
GROUP BY p.`id`, p.`name`, c.`name`
ORDER BY total_terjual DESC;

-- ============================================================
-- STORED PROCEDURE: generate order number
-- ============================================================
DELIMITER $$
CREATE PROCEDURE `sp_generate_order_number`(OUT order_num VARCHAR(20))
BEGIN
  DECLARE today_count INT;
  SELECT COUNT(*) INTO today_count
  FROM `orders`
  WHERE DATE(`created_at`) = CURDATE();
  SET order_num = CONCAT(
    'KK',
    DATE_FORMAT(NOW(), '%y%m%d'),
    LPAD(today_count + 1, 3, '0')
  );
END$$
DELIMITER ;

-- ============================================================
-- INDEXES tambahan untuk performa
-- ============================================================
CREATE INDEX `idx_products_category_available`
  ON `products` (`category_id`, `is_available`);

CREATE INDEX `idx_orders_customer`
  ON `orders` (`customer_name`, `created_at`);

CREATE INDEX `idx_order_items_product`
  ON `order_items` (`product_id`);

-- ============================================================
-- SELESAI
-- Untuk import: mysql -u root -p < noir_coffee.sql
-- ============================================================
