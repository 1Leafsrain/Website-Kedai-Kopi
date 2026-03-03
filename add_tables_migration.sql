-- ============================================================
-- NOIR COFFEE — Migration: Add tables management
-- ============================================================

USE `noir_coffee`;

-- ─── TABLE: tables ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `tables` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `table_number` VARCHAR(10)     NOT NULL,
  `capacity`     INT             NOT NULL DEFAULT 4,
  `location`     VARCHAR(100)    DEFAULT NULL,
  `status`       ENUM('available','occupied') NOT NULL DEFAULT 'available',
  `created_at`   TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`   TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tables_number_unique` (`table_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── SEED: sample tables ────────────────────────────────────────────────────
INSERT IGNORE INTO `tables` (`table_number`, `capacity`, `location`, `status`, `created_at`, `updated_at`) VALUES
  ('A1', 2, 'Area Dalam', 'available', NOW(), NOW()),
  ('A2', 2, 'Area Dalam', 'available', NOW(), NOW()),
  ('A3', 4, 'Area Dalam', 'available', NOW(), NOW()),
  ('A4', 4, 'Area Dalam', 'available', NOW(), NOW()),
  ('B1', 4, 'Area Sofa', 'available', NOW(), NOW()),
  ('B2', 6, 'Area Sofa', 'available', NOW(), NOW()),
  ('B3', 6, 'Area Sofa', 'available', NOW(), NOW()),
  ('C1', 2, 'Area Luar', 'available', NOW(), NOW()),
  ('C2', 2, 'Area Luar', 'available', NOW(), NOW()),
  ('C3', 4, 'Area Luar', 'available', NOW(), NOW());
