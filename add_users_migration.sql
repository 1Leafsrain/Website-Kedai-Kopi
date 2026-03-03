-- Noir Coffee: Users & Role Migration
-- Safe to run on fresh OR existing databases.

USE noir_coffee;

-- 1. Create users table (fresh installs)
CREATE TABLE IF NOT EXISTS `users` (
  `id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`       VARCHAR(255) NOT NULL,
  `email`      VARCHAR(255) NOT NULL UNIQUE,
  `password`   VARCHAR(255) NOT NULL,
  `role`       ENUM('guest','user','admin') NOT NULL DEFAULT 'user',
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Expand role enum if table already existed with old schema
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('guest','user','admin','staff') NOT NULL DEFAULT 'user';

-- 3. Migrate old staff role to user
UPDATE `users` SET `role` = 'user' WHERE `role` = 'staff';
UPDATE `users` SET `role` = 'user' WHERE `role` = '' OR `role` IS NULL;

-- 4. Ensure existing admin account has admin role
UPDATE `users` SET `role` = 'admin' WHERE `email` = 'admin@noircoffee.id';

-- 5. Link orders to users (nullable, guest orders = NULL)
ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `user_id` INT NULL DEFAULT NULL AFTER `id`,
  ADD INDEX IF NOT EXISTS `idx_orders_user_id` (`user_id`);

-- NOTE: Default admin (admin@noircoffee.id / admin123) is seeded by
--       the API server at startup if no admin exists.
