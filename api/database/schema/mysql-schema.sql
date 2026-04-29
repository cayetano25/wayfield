/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `addresses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `country_code` char(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'US' COMMENT 'ISO 3166-1 alpha-2',
  `address_line_1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_line_2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_line_3` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `locality` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `administrative_area` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dependent_locality` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postal_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sorting_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `formatted_address` text COLLATE utf8mb4_unicode_ci COMMENT 'Normalized display string, maintained by system',
  `validation_status` enum('unverified','verified','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unverified',
  `geocode_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SHA-256 of normalized address. Used as geocode cache key.',
  `geocode_attempts` tinyint unsigned NOT NULL DEFAULT '0' COMMENT 'Number of geocoding attempts. Max set in config.',
  `last_geocoded_at` timestamp NULL DEFAULT NULL COMMENT 'When coordinates were last successfully obtained.',
  `geocode_error` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Last geocoding failure reason. Null on success.',
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `addresses_country_code_index` (`country_code`),
  KEY `addresses_locality_administrative_area_index` (`locality`,`administrative_area`),
  KEY `addresses_postal_code_index` (`postal_code`),
  KEY `idx_addresses_geocode_hash` (`geocode_hash`),
  KEY `idx_addresses_needs_geocoding` (`validation_status`,`geocode_attempts`),
  KEY `idx_addresses_lat_lng` (`latitude`,`longitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `admin_login_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_login_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `admin_user_id` bigint unsigned DEFAULT NULL,
  `email_attempted` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `outcome` enum('success','failed','locked') COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_agent` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `admin_login_events_admin_user_id_index` (`admin_user_id`),
  KEY `admin_login_events_ip_address_index` (`ip_address`),
  KEY `admin_login_events_outcome_index` (`outcome`),
  KEY `admin_login_events_created_at_index` (`created_at`),
  CONSTRAINT `admin_login_events_admin_user_id_foreign` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `admin_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('super_admin','admin','support','billing','readonly') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'readonly',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `can_impersonate` tinyint(1) NOT NULL DEFAULT '0',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `admin_users_email_unique` (`email`),
  KEY `admin_users_is_active_index` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `api_clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_clients` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_secret_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scopes_json` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `last_used_at` datetime DEFAULT NULL,
  `created_by_user_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_clients_client_id_unique` (`client_id`),
  KEY `api_clients_created_by_user_id_foreign` (`created_by_user_id`),
  KEY `api_clients_organization_id_is_active_index` (`organization_id`,`is_active`),
  CONSTRAINT `api_clients_created_by_user_id_foreign` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `api_clients_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `api_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_keys` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key_prefix` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scopes` json NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `last_used_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_by_user_id` bigint unsigned NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_keys_key_hash_unique` (`key_hash`),
  KEY `api_keys_created_by_user_id_foreign` (`created_by_user_id`),
  KEY `api_keys_organization_id_index` (`organization_id`),
  KEY `api_keys_key_hash_index` (`key_hash`),
  KEY `api_keys_is_active_index` (`is_active`),
  CONSTRAINT `api_keys_created_by_user_id_foreign` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `api_keys_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `attendance_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_records` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `session_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `status` enum('not_checked_in','checked_in','no_show') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'not_checked_in',
  `check_in_method` enum('self','leader') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `checked_in_at` datetime DEFAULT NULL,
  `checked_in_by_user_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `attendance_records_session_id_user_id_unique` (`session_id`,`user_id`),
  KEY `attendance_records_checked_in_by_user_id_foreign` (`checked_in_by_user_id`),
  KEY `attendance_records_user_id_index` (`user_id`),
  KEY `attendance_records_status_index` (`status`),
  KEY `attendance_records_checked_in_at_index` (`checked_in_at`),
  CONSTRAINT `attendance_records_checked_in_by_user_id_foreign` FOREIGN KEY (`checked_in_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `attendance_records_session_id_foreign` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_records_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned DEFAULT NULL,
  `actor_user_id` bigint unsigned DEFAULT NULL,
  `entity_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` bigint unsigned DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `metadata_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_logs_organization_id_created_at_index` (`organization_id`,`created_at`),
  KEY `audit_logs_actor_user_id_created_at_index` (`actor_user_id`,`created_at`),
  KEY `audit_logs_entity_type_entity_id_index` (`entity_type`,`entity_id`),
  CONSTRAINT `audit_logs_actor_user_id_foreign` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `audit_logs_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `auth_methods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_methods` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `provider` enum('email','google','facebook','saml','oidc') COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_user_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_methods_provider_provider_user_id_unique` (`provider`,`provider_user_id`),
  KEY `auth_methods_user_id_index` (`user_id`),
  CONSTRAINT `auth_methods_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `automation_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `automation_rules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `trigger_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `conditions_json` json DEFAULT NULL,
  `action_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_config_json` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `scope` enum('platform','organization') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'platform',
  `run_interval_minutes` int unsigned NOT NULL DEFAULT '60',
  `last_evaluated_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `created_by_admin_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `automation_rules_organization_id_is_active_index` (`organization_id`,`is_active`),
  KEY `automation_rules_created_by_admin_id_foreign` (`created_by_admin_id`),
  KEY `automation_rules_trigger_type_is_active_index` (`trigger_type`,`is_active`),
  CONSTRAINT `automation_rules_created_by_admin_id_foreign` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `automation_rules_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `automation_runs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `automation_runs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `automation_rule_id` bigint unsigned NOT NULL,
  `entity_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` bigint unsigned DEFAULT NULL,
  `outcome` enum('success','failed','skipped') COLLATE utf8mb4_unicode_ci NOT NULL,
  `actions_taken_count` int unsigned NOT NULL DEFAULT '0',
  `metadata_json` json DEFAULT NULL,
  `triggered_at` datetime NOT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `automation_runs_automation_rule_id_triggered_at_index` (`automation_rule_id`,`triggered_at`),
  KEY `automation_runs_outcome_index` (`outcome`),
  CONSTRAINT `automation_runs_automation_rule_id_foreign` FOREIGN KEY (`automation_rule_id`) REFERENCES `automation_rules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `cart_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cart_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `cart_id` bigint unsigned NOT NULL,
  `item_type` enum('workshop_registration','addon_session','waitlist_upgrade') COLLATE utf8mb4_unicode_ci NOT NULL,
  `workshop_id` bigint unsigned DEFAULT NULL,
  `session_id` bigint unsigned DEFAULT NULL,
  `unit_price_cents` int unsigned NOT NULL DEFAULT '0',
  `quantity` int unsigned NOT NULL DEFAULT '1',
  `line_total_cents` int unsigned NOT NULL DEFAULT '0',
  `is_deposit` tinyint(1) NOT NULL DEFAULT '0',
  `deposit_amount_cents` int unsigned DEFAULT NULL,
  `balance_amount_cents` int unsigned DEFAULT NULL,
  `balance_due_date` date DEFAULT NULL,
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'usd',
  `metadata_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `cart_items_cart_id_index` (`cart_id`),
  KEY `cart_items_workshop_id_index` (`workshop_id`),
  KEY `cart_items_session_id_index` (`session_id`),
  KEY `cart_items_item_type_index` (`item_type`),
  CONSTRAINT `cart_items_cart_id_foreign` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cart_items_session_id_foreign` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cart_items_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `carts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `carts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `organization_id` bigint unsigned NOT NULL,
  `status` enum('active','checked_out','abandoned','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `stripe_account_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subtotal_cents` int unsigned NOT NULL DEFAULT '0',
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'usd',
  `expires_at` datetime NOT NULL,
  `last_activity_at` datetime NOT NULL,
  `checked_out_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `carts_user_org_status_unique` (`user_id`,`organization_id`,`status`),
  KEY `carts_user_id_status_index` (`user_id`,`status`),
  KEY `carts_expires_at_status_index` (`expires_at`,`status`),
  KEY `carts_organization_id_index` (`organization_id`),
  CONSTRAINT `carts_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `carts_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `crisp_conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crisp_conversations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `crisp_session_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organization_id` bigint unsigned DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `status` enum('pending','ongoing','resolved','unresolved') COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_message_at` datetime NOT NULL,
  `last_message_at` datetime DEFAULT NULL,
  `first_reply_at` datetime DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `assigned_to` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tags_json` json DEFAULT NULL,
  `message_count` int unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crisp_conversations_crisp_session_id_unique` (`crisp_session_id`),
  KEY `crisp_conversations_organization_id_index` (`organization_id`),
  KEY `crisp_conversations_user_id_index` (`user_id`),
  KEY `crisp_conversations_status_index` (`status`),
  KEY `crisp_conversations_last_message_at_index` (`last_message_at`),
  CONSTRAINT `crisp_conversations_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `crisp_conversations_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `disputes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `disputes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `stripe_dispute_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stripe_charge_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stripe_account_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_cents` int unsigned NOT NULL,
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'usd',
  `reason` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('warning_needs_response','warning_under_review','warning_closed','needs_response','under_review','charge_refunded','won','lost') COLLATE utf8mb4_unicode_ci NOT NULL,
  `evidence_due_by` datetime DEFAULT NULL,
  `evidence_submitted_at` datetime DEFAULT NULL,
  `is_charge_refundable` tinyint(1) NOT NULL DEFAULT '1',
  `network_reason_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `evidence_deadline_reminder_sent_at` datetime DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `resolution` enum('won','lost','withdrawn') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_metadata_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `disputes_stripe_dispute_id_unique` (`stripe_dispute_id`),
  KEY `disputes_order_id_index` (`order_id`),
  KEY `disputes_status_index` (`status`),
  KEY `disputes_evidence_due_by_status_index` (`evidence_due_by`,`status`),
  CONSTRAINT `disputes_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `email_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `notification_id` bigint unsigned DEFAULT NULL,
  `recipient_user_id` bigint unsigned DEFAULT NULL,
  `recipient_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notification_code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ses',
  `provider_message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('queued','sent','delivered','bounced','complained','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `sent_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `opened_at` datetime DEFAULT NULL,
  `clicked_at` datetime DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `related_entity_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `related_entity_id` bigint unsigned DEFAULT NULL,
  `metadata_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `email_logs_notification_id_foreign` (`notification_id`),
  KEY `email_logs_recipient_user_id_status_index` (`recipient_user_id`,`status`),
  KEY `email_logs_notification_code_created_at_index` (`notification_code`,`created_at`),
  KEY `email_logs_provider_message_id_index` (`provider_message_id`),
  KEY `email_logs_status_created_at_index` (`status`,`created_at`),
  KEY `email_logs_related_entity_type_related_entity_id_index` (`related_entity_type`,`related_entity_id`),
  CONSTRAINT `email_logs_notification_id_foreign` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE SET NULL,
  CONSTRAINT `email_logs_recipient_user_id_foreign` FOREIGN KEY (`recipient_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `failed_jobs_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `failed_jobs_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `job_uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `job_class` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organization_id` bigint unsigned DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` datetime NOT NULL,
  `retried_at` datetime DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_log_job_uuid_unique` (`job_uuid`),
  KEY `failed_jobs_log_job_class_index` (`job_class`),
  KEY `failed_jobs_log_queue_index` (`queue`),
  KEY `failed_jobs_log_failed_at_index` (`failed_at`),
  KEY `failed_jobs_log_resolved_at_index` (`resolved_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `feature_flags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feature_flags` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `feature_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `source` enum('plan','manual_override') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'plan',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `feature_flags_organization_id_feature_key_unique` (`organization_id`,`feature_key`),
  CONSTRAINT `feature_flags_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `geocode_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `geocode_cache` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `geocode_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SHA-256 of normalized address. Primary cache key.',
  `normalized_input` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'The normalized address string that was geocoded.',
  `provider` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'nominatim' COMMENT 'Geocoding provider: nominatim, etc.',
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `formatted_address` text COLLATE utf8mb4_unicode_ci COMMENT 'display_name from Nominatim response.',
  `status` enum('hit','miss','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'hit' COMMENT 'hit=found, miss=no results, failed=API error.',
  `confidence` tinyint unsigned DEFAULT NULL COMMENT '0-100 confidence score from provider importance field.',
  `provider_place_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nominatim place_id. For reference only.',
  `provider_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nominatim type field e.g. house, city, state.',
  `failure_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Error message or reason when status=failed or miss.',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT 'When to consider this entry stale. Null = never.',
  `last_resolved_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When this result was last obtained from the provider.',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `geocode_cache_geocode_hash_unique` (`geocode_hash`),
  KEY `idx_geocode_cache_status` (`status`),
  KEY `idx_geocode_cache_expires` (`expires_at`),
  KEY `idx_geocode_cache_lat_lng` (`latitude`,`longitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `help_articles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `help_articles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT '0',
  `published_at` datetime DEFAULT NULL,
  `created_by_user_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `help_articles_slug_unique` (`slug`),
  KEY `help_articles_created_by_user_id_foreign` (`created_by_user_id`),
  KEY `help_articles_is_published_category_index` (`is_published`,`category`),
  CONSTRAINT `help_articles_created_by_user_id_foreign` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `subscription_id` bigint unsigned DEFAULT NULL,
  `invoice_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_cents` bigint unsigned NOT NULL,
  `currency` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USD',
  `status` enum('draft','open','paid','void','uncollectible') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `billing_reason` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `period_start` datetime DEFAULT NULL,
  `period_end` datetime DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `due_at` datetime DEFAULT NULL,
  `invoice_pdf_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata_json` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoices_invoice_number_unique` (`invoice_number`),
  KEY `invoices_subscription_id_foreign` (`subscription_id`),
  KEY `invoices_organization_id_status_index` (`organization_id`,`status`),
  KEY `invoices_status_index` (`status`),
  KEY `invoices_paid_at_index` (`paid_at`),
  CONSTRAINT `invoices_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `invoices_subscription_id_foreign` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `leader_invitations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leader_invitations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `workshop_id` bigint unsigned DEFAULT NULL,
  `leader_id` bigint unsigned DEFAULT NULL,
  `invited_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invited_first_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invited_last_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','accepted','declined','expired','removed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `invitation_token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `responded_at` datetime DEFAULT NULL,
  `created_by_user_id` bigint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `leader_invitations_invitation_token_hash_unique` (`invitation_token_hash`),
  KEY `leader_invitations_leader_id_foreign` (`leader_id`),
  KEY `leader_invitations_created_by_user_id_foreign` (`created_by_user_id`),
  KEY `leader_invitations_organization_id_status_index` (`organization_id`,`status`),
  KEY `leader_invitations_workshop_id_index` (`workshop_id`),
  KEY `leader_invitations_invited_email_index` (`invited_email`),
  CONSTRAINT `leader_invitations_created_by_user_id_foreign` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `leader_invitations_leader_id_foreign` FOREIGN KEY (`leader_id`) REFERENCES `leaders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `leader_invitations_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leader_invitations_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `leaders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leaders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bio` text COLLATE utf8mb4_unicode_ci,
  `profile_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `website_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_line_1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_line_2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state_or_region` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postal_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `leaders_user_id_index` (`user_id`),
  KEY `leaders_email_index` (`email`),
  KEY `leaders_city_state_or_region_index` (`city`,`state_or_region`),
  KEY `leaders_address_id_foreign` (`address_id`),
  CONSTRAINT `leaders_address_id_foreign` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `leaders_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_line_1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_line_2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state_or_region` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postal_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_id` bigint unsigned DEFAULT NULL,
  `country_code` char(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ISO 3166-1 alpha-2, derived from country field — use address.country_code instead',
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `locations_organization_id_index` (`organization_id`),
  KEY `locations_city_state_or_region_index` (`city`,`state_or_region`),
  KEY `locations_address_id_foreign` (`address_id`),
  CONSTRAINT `locations_address_id_foreign` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `locations_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `login_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `email_attempted` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` enum('web','ios','android','unknown') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `outcome` enum('success','failed','unverified','inactive') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `login_events_user_id_created_at_index` (`user_id`,`created_at`),
  KEY `login_events_email_attempted_created_at_index` (`email_attempted`,`created_at`),
  KEY `login_events_ip_address_index` (`ip_address`),
  KEY `login_events_outcome_index` (`outcome`),
  CONSTRAINT `login_events_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `metric_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `metric_snapshots` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `metric_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `granularity` enum('daily','weekly','monthly') COLLATE utf8mb4_unicode_ci NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `value` decimal(15,4) NOT NULL,
  `organization_id` bigint unsigned DEFAULT NULL,
  `metadata_json` json DEFAULT NULL,
  `computed_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `metric_snapshots_unique` (`metric_key`,`granularity`,`period_start`,`organization_id`),
  KEY `metric_snapshots_metric_key_period_start_index` (`metric_key`,`period_start`),
  KEY `metric_snapshots_organization_id_index` (`organization_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `notification_preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_preferences` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `email_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `push_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `workshop_updates_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `reminder_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `marketing_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_preferences_user_id_unique` (`user_id`),
  CONSTRAINT `notification_preferences_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `notification_recipients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_recipients` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `notification_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `email_status` enum('pending','sent','failed','skipped') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `push_status` enum('pending','sent','failed','skipped') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `in_app_status` enum('pending','delivered','read') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `read_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_recipients_notification_id_user_id_unique` (`notification_id`,`user_id`),
  KEY `notification_recipients_user_id_read_at_index` (`user_id`,`read_at`),
  CONSTRAINT `notification_recipients_notification_id_foreign` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notification_recipients_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `workshop_id` bigint unsigned DEFAULT NULL,
  `created_by_user_id` bigint unsigned DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `notification_type` enum('informational','urgent','reminder') COLLATE utf8mb4_unicode_ci NOT NULL,
  `notification_category` enum('message','invitation','system') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'message' COMMENT 'Distinguishes system notifications from user messages.',
  `action_data` json DEFAULT NULL COMMENT 'Structured payload for actionable notifications.',
  `sender_scope` enum('organizer','leader') COLLATE utf8mb4_unicode_ci NOT NULL,
  `delivery_scope` enum('all_participants','leaders','custom','session_participants') COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_id` bigint unsigned DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_workshop_id_foreign` (`workshop_id`),
  KEY `notifications_created_by_user_id_foreign` (`created_by_user_id`),
  KEY `notifications_organization_id_workshop_id_index` (`organization_id`,`workshop_id`),
  KEY `notifications_session_id_index` (`session_id`),
  KEY `notifications_sender_scope_sent_at_index` (`sender_scope`,`sent_at`),
  KEY `idx_notifications_category` (`notification_category`),
  CONSTRAINT `notifications_created_by_user_id_foreign` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_session_id_foreign` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `notifications_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `offline_action_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `offline_action_queue` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `workshop_id` bigint unsigned DEFAULT NULL,
  `action_type` enum('self_check_in','leader_check_in','attendance_override') COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_action_uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload_json` json NOT NULL,
  `processed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `offline_action_queue_client_action_uuid_unique` (`client_action_uuid`),
  KEY `offline_action_queue_workshop_id_foreign` (`workshop_id`),
  KEY `offline_action_queue_user_id_processed_at_index` (`user_id`,`processed_at`),
  CONSTRAINT `offline_action_queue_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `offline_action_queue_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `offline_sync_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `offline_sync_snapshots` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `workshop_id` bigint unsigned NOT NULL,
  `version_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `generated_at` datetime NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `offline_sync_snapshots_workshop_id_generated_at_index` (`workshop_id`,`generated_at`),
  CONSTRAINT `offline_sync_snapshots_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `item_type` enum('workshop_registration','addon_session','waitlist_upgrade') COLLATE utf8mb4_unicode_ci NOT NULL,
  `workshop_id` bigint unsigned DEFAULT NULL,
  `session_id` bigint unsigned DEFAULT NULL,
  `registration_id` bigint unsigned DEFAULT NULL,
  `session_selection_id` bigint unsigned DEFAULT NULL,
  `unit_price_cents` int unsigned NOT NULL DEFAULT '0',
  `quantity` int unsigned NOT NULL DEFAULT '1',
  `line_total_cents` int unsigned NOT NULL DEFAULT '0',
  `is_deposit` tinyint(1) NOT NULL DEFAULT '0',
  `refunded_amount_cents` int unsigned NOT NULL DEFAULT '0',
  `refund_status` enum('none','partial','full') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none',
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'usd',
  `metadata_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_items_session_selection_id_foreign` (`session_selection_id`),
  KEY `order_items_order_id_index` (`order_id`),
  KEY `order_items_workshop_id_index` (`workshop_id`),
  KEY `order_items_session_id_index` (`session_id`),
  KEY `order_items_registration_id_index` (`registration_id`),
  KEY `order_items_refund_status_index` (`refund_status`),
  CONSTRAINT `order_items_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_items_registration_id_foreign` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `order_items_session_id_foreign` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `order_items_session_selection_id_foreign` FOREIGN KEY (`session_selection_id`) REFERENCES `session_selections` (`id`) ON DELETE SET NULL,
  CONSTRAINT `order_items_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `order_sequences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_sequences` (
  `year` smallint unsigned NOT NULL,
  `next_value` int unsigned NOT NULL DEFAULT '1',
  PRIMARY KEY (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_number` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `organization_id` bigint unsigned NOT NULL,
  `cart_id` bigint unsigned DEFAULT NULL,
  `status` enum('pending','processing','completed','failed','balance_payment_failed','partially_refunded','fully_refunded','cancelled','disputed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `payment_method` enum('stripe','free','credit') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'stripe',
  `subtotal_cents` int unsigned NOT NULL DEFAULT '0',
  `wayfield_fee_cents` int unsigned NOT NULL DEFAULT '0',
  `stripe_fee_cents` int unsigned NOT NULL DEFAULT '0',
  `total_cents` int unsigned NOT NULL DEFAULT '0',
  `organizer_payout_cents` int unsigned NOT NULL DEFAULT '0',
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'usd',
  `take_rate_pct` decimal(5,4) NOT NULL DEFAULT '0.0000',
  `stripe_payment_intent_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_charge_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_deposit_order` tinyint(1) NOT NULL DEFAULT '0',
  `deposit_paid_at` datetime DEFAULT NULL,
  `balance_due_date` date DEFAULT NULL,
  `balance_amount_cents` int unsigned DEFAULT NULL,
  `balance_auto_charge` tinyint(1) NOT NULL DEFAULT '1',
  `balance_paid_at` datetime DEFAULT NULL,
  `balance_stripe_payment_intent_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancellation_reason` text COLLATE utf8mb4_unicode_ci,
  `metadata_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `orders_order_number_unique` (`order_number`),
  KEY `orders_cart_id_foreign` (`cart_id`),
  KEY `orders_user_id_status_index` (`user_id`,`status`),
  KEY `orders_organization_id_status_index` (`organization_id`,`status`),
  KEY `orders_stripe_payment_intent_id_index` (`stripe_payment_intent_id`),
  KEY `orders_status_index` (`status`),
  KEY `orders_balance_due_date_status_index` (`balance_due_date`,`status`),
  KEY `orders_is_deposit_order_status_index` (`is_deposit_order`,`status`),
  CONSTRAINT `orders_cart_id_foreign` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `orders_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `organization_invitations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organization_invitations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `invited_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invited_first_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invited_last_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('admin','staff','billing_admin') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','accepted','declined','expired','removed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `invitation_token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SHA-256 hash of the raw token. Raw token sent in email only.',
  `expires_at` datetime NOT NULL,
  `responded_at` datetime DEFAULT NULL,
  `created_by_user_id` bigint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `organization_invitations_created_by_user_id_foreign` (`created_by_user_id`),
  KEY `organization_invitations_organization_id_status_index` (`organization_id`,`status`),
  KEY `organization_invitations_invited_email_index` (`invited_email`),
  KEY `organization_invitations_expires_at_index` (`expires_at`),
  KEY `organization_invitations_user_id_index` (`user_id`),
  CONSTRAINT `organization_invitations_created_by_user_id_foreign` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `organization_invitations_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `organization_invitations_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `organization_leaders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organization_leaders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `leader_id` bigint unsigned NOT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `organization_leaders_organization_id_leader_id_unique` (`organization_id`,`leader_id`),
  KEY `organization_leaders_leader_id_index` (`leader_id`),
  CONSTRAINT `organization_leaders_leader_id_foreign` FOREIGN KEY (`leader_id`) REFERENCES `leaders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `organization_leaders_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `organization_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organization_users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `role` enum('owner','admin','staff','billing_admin') COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `organization_users_organization_id_user_id_role_unique` (`organization_id`,`user_id`,`role`),
  KEY `1` (`user_id`),
  KEY `organization_users_organization_id_is_active_index` (`organization_id`,`is_active`),
  CONSTRAINT `1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `organization_users_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `organizations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organizations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `primary_contact_first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `primary_contact_last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `primary_contact_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `primary_contact_phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive','suspended') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `stripe_customer_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logo_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_id` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `organizations_slug_unique` (`slug`),
  KEY `organizations_status_index` (`status`),
  KEY `organizations_address_id_foreign` (`address_id`),
  KEY `organizations_stripe_customer_id_index` (`stripe_customer_id`),
  CONSTRAINT `organizations_address_id_foreign` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `payment_feature_flags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_feature_flags` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `scope` enum('platform','organization') COLLATE utf8mb4_unicode_ci NOT NULL,
  `organization_id` bigint unsigned DEFAULT NULL,
  `flag_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `enabled_at` datetime DEFAULT NULL,
  `enabled_by_user_id` bigint unsigned DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pff_scope_org_flag_unique` (`scope`,`organization_id`,`flag_key`),
  KEY `payment_feature_flags_organization_id_foreign` (`organization_id`),
  KEY `payment_feature_flags_enabled_by_user_id_foreign` (`enabled_by_user_id`),
  KEY `pff_scope_flag_enabled_idx` (`scope`,`flag_key`,`is_enabled`),
  CONSTRAINT `payment_feature_flags_enabled_by_user_id_foreign` FOREIGN KEY (`enabled_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payment_feature_flags_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `payment_intents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_intents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `intent_type` enum('full','deposit','balance') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'full',
  `stripe_payment_intent_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stripe_account_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_cents` int unsigned NOT NULL,
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'usd',
  `application_fee_cents` int unsigned NOT NULL DEFAULT '0',
  `status` enum('requires_payment_method','requires_confirmation','requires_action','processing','requires_capture','cancelled','succeeded','failed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `stripe_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_secret_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_payment_error` text COLLATE utf8mb4_unicode_ci,
  `confirmed_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `metadata_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_intents_stripe_payment_intent_id_unique` (`stripe_payment_intent_id`),
  KEY `payment_intents_order_id_intent_type_index` (`order_id`,`intent_type`),
  KEY `payment_intents_status_index` (`status`),
  CONSTRAINT `payment_intents_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenable_id` bigint unsigned NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `abilities` text COLLATE utf8mb4_unicode_ci,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `platform_admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_admins` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `role` enum('super_admin','support','finance','ops') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'support',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `platform_admins_user_id_unique` (`user_id`),
  KEY `platform_admins_user_id_is_active_index` (`user_id`,`is_active`),
  KEY `platform_admins_role_index` (`role`),
  CONSTRAINT `platform_admins_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `platform_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `admin_user_id` bigint unsigned DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` bigint unsigned DEFAULT NULL,
  `organization_id` bigint unsigned DEFAULT NULL,
  `metadata_json` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `platform_audit_logs_admin_user_id_created_at_index` (`admin_user_id`,`created_at`),
  KEY `platform_audit_logs_entity_type_entity_id_index` (`entity_type`,`entity_id`),
  KEY `platform_audit_logs_organization_id_created_at_index` (`organization_id`,`created_at`),
  KEY `platform_audit_logs_action_index` (`action`),
  CONSTRAINT `platform_audit_logs_admin_user_id_foreign` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `platform_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_config` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `config_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `config_value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `value_type` enum('string','integer','boolean','json') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'string',
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_sensitive` tinyint(1) NOT NULL DEFAULT '0',
  `updated_by_admin_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `platform_config_config_key_unique` (`config_key`),
  KEY `platform_config_updated_by_admin_id_foreign` (`updated_by_admin_id`),
  CONSTRAINT `platform_config_updated_by_admin_id_foreign` FOREIGN KEY (`updated_by_admin_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `platform_credits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_credits` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `amount_cents` int unsigned NOT NULL,
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'usd',
  `source_type` enum('refund','promotion','manual_grant') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'refund',
  `source_refund_request_id` bigint unsigned DEFAULT NULL,
  `is_used` tinyint(1) NOT NULL DEFAULT '0',
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `used_in_order_id` bigint unsigned DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `platform_credits_source_refund_request_id_foreign` (`source_refund_request_id`),
  KEY `platform_credits_used_in_order_id_foreign` (`used_in_order_id`),
  KEY `platform_credits_user_id_is_used_expires_at_index` (`user_id`,`is_used`,`expires_at`),
  KEY `platform_credits_expires_at_index` (`expires_at`),
  CONSTRAINT `platform_credits_source_refund_request_id_foreign` FOREIGN KEY (`source_refund_request_id`) REFERENCES `refund_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `platform_credits_used_in_order_id_foreign` FOREIGN KEY (`used_in_order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `platform_credits_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `platform_metrics_daily`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_metrics_daily` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `active_organizations` int unsigned NOT NULL DEFAULT '0',
  `active_workshops` int unsigned NOT NULL DEFAULT '0',
  `total_registrations` int unsigned NOT NULL DEFAULT '0',
  `total_notifications_sent` int unsigned NOT NULL DEFAULT '0',
  `new_signups` int unsigned NOT NULL DEFAULT '0',
  `revenue_cents` bigint unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `platform_metrics_daily_date_unique` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `platform_take_rates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_take_rates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `plan_code` enum('foundation','creator','studio','custom') COLLATE utf8mb4_unicode_ci NOT NULL,
  `take_rate_pct` decimal(5,4) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `platform_take_rates_plan_code_unique` (`plan_code`),
  KEY `platform_take_rates_is_active_index` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `public_pages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `public_pages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `workshop_id` bigint unsigned NOT NULL,
  `hero_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hero_subtitle` text COLLATE utf8mb4_unicode_ci,
  `body_content` longtext COLLATE utf8mb4_unicode_ci,
  `is_visible` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `public_pages_workshop_id_unique` (`workshop_id`),
  CONSTRAINT `public_pages_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `push_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `push_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `platform` enum('ios','android') COLLATE utf8mb4_unicode_ci NOT NULL,
  `push_token` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `last_registered_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `push_tokens_push_token_unique` (`push_token`),
  KEY `push_tokens_user_id_is_active_index` (`user_id`,`is_active`),
  CONSTRAINT `push_tokens_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `refund_policies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refund_policies` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `scope` enum('platform','organization','workshop') COLLATE utf8mb4_unicode_ci NOT NULL,
  `organization_id` bigint unsigned DEFAULT NULL,
  `workshop_id` bigint unsigned DEFAULT NULL,
  `full_refund_cutoff_days` int NOT NULL DEFAULT '14',
  `partial_refund_cutoff_days` int NOT NULL DEFAULT '7',
  `partial_refund_pct` decimal(5,2) NOT NULL DEFAULT '50.00',
  `no_refund_cutoff_hours` int NOT NULL DEFAULT '48',
  `wayfield_fee_refundable` tinyint(1) NOT NULL DEFAULT '0',
  `stripe_fee_refundable` tinyint(1) NOT NULL DEFAULT '0',
  `allow_credits` tinyint(1) NOT NULL DEFAULT '0',
  `credit_expiry_days` int DEFAULT '365',
  `custom_policy_text` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rp_scope_org_workshop_unique` (`scope`,`organization_id`,`workshop_id`),
  KEY `refund_policies_organization_id_foreign` (`organization_id`),
  KEY `refund_policies_workshop_id_foreign` (`workshop_id`),
  KEY `refund_policies_scope_index` (`scope`),
  CONSTRAINT `refund_policies_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `refund_policies_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `refund_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refund_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `order_item_id` bigint unsigned DEFAULT NULL,
  `requested_by_user_id` bigint unsigned NOT NULL,
  `reason_code` enum('cancellation','schedule_conflict','dissatisfied','medical','organizer_cancelled','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason_text` text COLLATE utf8mb4_unicode_ci,
  `requested_amount_cents` int unsigned NOT NULL,
  `approved_amount_cents` int unsigned DEFAULT NULL,
  `status` enum('pending','auto_approved','organizer_approved','organizer_denied','processed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `auto_eligible` tinyint(1) NOT NULL DEFAULT '0',
  `policy_applied_scope` enum('platform','organization','workshop') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_by_user_id` bigint unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `review_notes` text COLLATE utf8mb4_unicode_ci,
  `stripe_refund_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `processed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `refund_requests_order_item_id_foreign` (`order_item_id`),
  KEY `refund_requests_reviewed_by_user_id_foreign` (`reviewed_by_user_id`),
  KEY `refund_requests_order_id_index` (`order_id`),
  KEY `refund_requests_requested_by_user_id_index` (`requested_by_user_id`),
  KEY `refund_requests_status_index` (`status`),
  KEY `refund_requests_auto_eligible_status_index` (`auto_eligible`,`status`),
  CONSTRAINT `refund_requests_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `refund_requests_order_item_id_foreign` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`),
  CONSTRAINT `refund_requests_requested_by_user_id_foreign` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `refund_requests_reviewed_by_user_id_foreign` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `refund_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refund_transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `refund_request_id` bigint unsigned NOT NULL,
  `order_id` bigint unsigned NOT NULL,
  `stripe_refund_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stripe_charge_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stripe_account_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_cents` int unsigned NOT NULL,
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'usd',
  `status` enum('pending','succeeded','failed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL,
  `failure_reason` text COLLATE utf8mb4_unicode_ci,
  `stripe_created_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `refund_transactions_stripe_refund_id_unique` (`stripe_refund_id`),
  KEY `refund_transactions_refund_request_id_index` (`refund_request_id`),
  KEY `refund_transactions_order_id_index` (`order_id`),
  KEY `refund_transactions_status_index` (`status`),
  CONSTRAINT `refund_transactions_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `refund_transactions_refund_request_id_foreign` FOREIGN KEY (`refund_request_id`) REFERENCES `refund_requests` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `registrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `registrations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `workshop_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `registration_status` enum('registered','canceled','waitlisted','removed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'registered',
  `joined_via_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `registered_at` datetime NOT NULL,
  `canceled_at` datetime DEFAULT NULL,
  `removed_by_user_id` bigint unsigned DEFAULT NULL,
  `removed_at` datetime DEFAULT NULL,
  `removal_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `registrations_workshop_id_user_id_unique` (`workshop_id`,`user_id`),
  KEY `registrations_user_id_index` (`user_id`),
  KEY `registrations_workshop_id_registration_status_index` (`workshop_id`,`registration_status`),
  KEY `registrations_removed_by_user_id_foreign` (`removed_by_user_id`),
  CONSTRAINT `registrations_removed_by_user_id_foreign` FOREIGN KEY (`removed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `registrations_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `registrations_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `scheduled_payment_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scheduled_payment_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `job_type` enum('balance_charge','balance_reminder','commitment_date_reminder','commitment_date_passed','waitlist_window_expiry','waitlist_window_reminder','pre_workshop_7day','pre_workshop_24hour','pre_session_1hour','dispute_evidence_reminder','stripe_onboarding_incomplete_reminder','cart_expiry','minimum_attendance_check','payment_requires_action_reminder') COLLATE utf8mb4_unicode_ci NOT NULL,
  `notification_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `related_entity_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `related_entity_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `scheduled_for` datetime NOT NULL,
  `status` enum('pending','processing','completed','cancelled','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `attempts` int unsigned NOT NULL DEFAULT '0',
  `max_attempts` int unsigned NOT NULL DEFAULT '3',
  `last_attempted_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancellation_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `result_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `spj_status_scheduled_idx` (`status`,`scheduled_for`),
  KEY `spj_entity_type_id_idx` (`related_entity_type`,`related_entity_id`),
  KEY `spj_user_status_idx` (`user_id`,`status`),
  KEY `spj_job_type_status_idx` (`job_type`,`status`),
  KEY `spj_scheduled_for_idx` (`scheduled_for`),
  CONSTRAINT `scheduled_payment_jobs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `security_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `security_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `organization_id` bigint unsigned DEFAULT NULL,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata_json` json DEFAULT NULL,
  `is_resolved` tinyint(1) NOT NULL DEFAULT '0',
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `resolved_by_admin_id` bigint unsigned DEFAULT NULL,
  `severity` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `security_events_user_id_created_at_index` (`user_id`,`created_at`),
  KEY `security_events_organization_id_created_at_index` (`organization_id`,`created_at`),
  KEY `security_events_resolved_by_admin_id_foreign` (`resolved_by_admin_id`),
  KEY `security_events_event_type_created_at_index` (`event_type`,`created_at`),
  KEY `security_events_is_resolved_severity_index` (`is_resolved`,`severity`),
  CONSTRAINT `security_events_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `security_events_resolved_by_admin_id_foreign` FOREIGN KEY (`resolved_by_admin_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `security_events_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `session_leaders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_leaders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `session_id` bigint unsigned NOT NULL,
  `leader_id` bigint unsigned NOT NULL,
  `role_label` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role_in_session` enum('primary_leader','co_leader','panelist','moderator','assistant') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'co_leader',
  `assignment_status` enum('pending','accepted','declined','removed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'accepted',
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_leaders_session_id_leader_id_unique` (`session_id`,`leader_id`),
  KEY `session_leaders_leader_id_index` (`leader_id`),
  KEY `session_leaders_assignment_status_index` (`assignment_status`),
  CONSTRAINT `session_leaders_leader_id_foreign` FOREIGN KEY (`leader_id`) REFERENCES `leaders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `session_leaders_session_id_foreign` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `session_pricing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_pricing` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `session_id` bigint unsigned NOT NULL,
  `price_cents` int unsigned NOT NULL DEFAULT '0',
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'usd',
  `is_nonrefundable` tinyint(1) NOT NULL DEFAULT '0',
  `max_purchases` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_pricing_session_id_unique` (`session_id`),
  KEY `session_pricing_price_cents_index` (`price_cents`),
  CONSTRAINT `session_pricing_session_id_foreign` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `session_selections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_selections` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `registration_id` bigint unsigned NOT NULL,
  `session_id` bigint unsigned NOT NULL,
  `selection_status` enum('selected','canceled','waitlisted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'selected',
  `assignment_source` enum('self_selected','organizer_assigned','invite_accepted','waitlist_promoted','addon_purchase') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'self_selected',
  `assigned_by_user_id` bigint unsigned DEFAULT NULL,
  `assigned_at` datetime DEFAULT NULL,
  `assignment_notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_selections_registration_id_session_id_unique` (`registration_id`,`session_id`),
  KEY `session_selections_session_id_selection_status_index` (`session_id`,`selection_status`),
  KEY `idx_session_selections_assignment_source` (`assignment_source`),
  KEY `idx_session_selections_assigned_by` (`assigned_by_user_id`),
  CONSTRAINT `fk_session_selections_assigned_by` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `session_selections_registration_id_foreign` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `session_selections_session_id_foreign` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `workshop_id` bigint unsigned NOT NULL,
  `track_id` bigint unsigned DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `start_at` datetime NOT NULL,
  `end_at` datetime NOT NULL,
  `location_id` bigint unsigned DEFAULT NULL,
  `location_type` enum('hotel','address','coordinates') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Null means no location set. hotel=inherit workshop hotel, address=structured address, coordinates=field lat/lng',
  `location_notes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Sub-location note e.g. Conference room B, Behind the post office',
  `capacity` int DEFAULT NULL,
  `delivery_type` enum('in_person','virtual','hybrid') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'in_person',
  `virtual_participation_allowed` tinyint(1) NOT NULL DEFAULT '0',
  `meeting_platform` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meeting_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meeting_instructions` text COLLATE utf8mb4_unicode_ci,
  `meeting_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meeting_passcode` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `is_published` tinyint(1) NOT NULL DEFAULT '0',
  `session_type` enum('standard','addon','private','vip','makeup_session') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'standard',
  `publication_status` enum('draft','published','archived','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `participant_visibility` enum('visible','hidden','invite_only') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'visible',
  `enrollment_mode` enum('self_select','organizer_assign_only','invite_accept','purchase_required') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'self_select',
  `requires_separate_entitlement` tinyint(1) NOT NULL DEFAULT '0',
  `selection_opens_at` datetime DEFAULT NULL,
  `selection_closes_at` datetime DEFAULT NULL,
  `header_image_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_workshop_id_start_at_end_at_index` (`workshop_id`,`start_at`,`end_at`),
  KEY `sessions_track_id_index` (`track_id`),
  KEY `sessions_location_id_index` (`location_id`),
  KEY `sessions_is_published_index` (`is_published`),
  KEY `sessions_delivery_type_index` (`delivery_type`),
  KEY `idx_sessions_location_type` (`location_type`),
  KEY `idx_sessions_session_type` (`session_type`),
  KEY `idx_sessions_publication_status` (`publication_status`),
  KEY `idx_sessions_participant_visibility` (`participant_visibility`),
  KEY `idx_sessions_enrollment_mode` (`enrollment_mode`),
  CONSTRAINT `sessions_location_id_foreign` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sessions_track_id_foreign` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sessions_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `sessions_sync_is_published` BEFORE UPDATE ON `sessions` FOR EACH ROW BEGIN
                IF NEW.publication_status = 'published' THEN
                    SET NEW.is_published = 1;
                ELSE
                    SET NEW.is_published = 0;
                END IF;
            END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `sso_configurations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sso_configurations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `provider_type` enum('saml','oidc') COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `entity_id` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sso_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `certificate` text COLLATE utf8mb4_unicode_ci,
  `client_secret_enc` text COLLATE utf8mb4_unicode_ci,
  `attribute_mapping` json DEFAULT NULL,
  `allowed_domains` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sso_configurations_organization_id_unique` (`organization_id`),
  KEY `sso_configurations_organization_id_index` (`organization_id`),
  CONSTRAINT `sso_configurations_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `stripe_connect_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stripe_connect_accounts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `stripe_account_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `onboarding_status` enum('initiated','pending','complete','restricted','deauthorized') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'initiated',
  `charges_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `payouts_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `details_submitted` tinyint(1) NOT NULL DEFAULT '0',
  `country` char(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'US',
  `default_currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'usd',
  `onboarding_completed_at` datetime DEFAULT NULL,
  `deauthorized_at` datetime DEFAULT NULL,
  `last_webhook_received_at` datetime DEFAULT NULL,
  `capabilities_json` json DEFAULT NULL,
  `requirements_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stripe_connect_accounts_organization_id_unique` (`organization_id`),
  UNIQUE KEY `stripe_connect_accounts_stripe_account_id_unique` (`stripe_account_id`),
  KEY `stripe_connect_accounts_onboarding_status_index` (`onboarding_status`),
  KEY `stripe_connect_accounts_charges_enabled_index` (`charges_enabled`),
  CONSTRAINT `stripe_connect_accounts_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `stripe_customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stripe_customers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `stripe_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata_json` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stripe_customers_organization_id_unique` (`organization_id`),
  UNIQUE KEY `stripe_customers_stripe_id_unique` (`stripe_id`),
  KEY `stripe_customers_stripe_id_index` (`stripe_id`),
  CONSTRAINT `stripe_customers_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `stripe_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stripe_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `stripe_event_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `livemode` tinyint(1) NOT NULL DEFAULT '0',
  `payload_json` json NOT NULL,
  `processed_at` datetime DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stripe_events_stripe_event_id_unique` (`stripe_event_id`),
  KEY `stripe_events_event_type_index` (`event_type`),
  KEY `stripe_events_processed_at_index` (`processed_at`),
  KEY `stripe_events_livemode_index` (`livemode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `stripe_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stripe_invoices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `stripe_invoice_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stripe_customer_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stripe_subscription_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount_due` int NOT NULL,
  `amount_paid` int NOT NULL DEFAULT '0',
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'usd',
  `status` enum('draft','open','paid','uncollectible','void') COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_pdf_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `period_start` datetime NOT NULL,
  `period_end` datetime NOT NULL,
  `paid_at` datetime DEFAULT NULL,
  `due_date` datetime DEFAULT NULL,
  `attempt_count` tinyint unsigned NOT NULL DEFAULT '0',
  `next_payment_attempt` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stripe_invoices_stripe_invoice_id_unique` (`stripe_invoice_id`),
  KEY `stripe_invoices_organization_id_index` (`organization_id`),
  KEY `stripe_invoices_status_index` (`status`),
  KEY `stripe_invoices_paid_at_index` (`paid_at`),
  CONSTRAINT `stripe_invoices_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `stripe_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stripe_subscriptions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `stripe_customer_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stripe_subscription_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stripe_price_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `plan_code` enum('free','starter','pro','enterprise') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','trialing','past_due','canceled','incomplete','incomplete_expired','unpaid','paused') COLLATE utf8mb4_unicode_ci NOT NULL,
  `trial_ends_at` datetime DEFAULT NULL,
  `current_period_start` datetime NOT NULL,
  `current_period_end` datetime NOT NULL,
  `canceled_at` datetime DEFAULT NULL,
  `ended_at` datetime DEFAULT NULL,
  `metadata_json` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stripe_subscriptions_stripe_subscription_id_unique` (`stripe_subscription_id`),
  KEY `stripe_subscriptions_organization_id_index` (`organization_id`),
  KEY `stripe_subscriptions_status_index` (`status`),
  KEY `stripe_subscriptions_plan_code_index` (`plan_code`),
  KEY `stripe_subscriptions_current_period_end_index` (`current_period_end`),
  CONSTRAINT `stripe_subscriptions_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscriptions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `stripe_customer_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Stripe Customer ID',
  `stripe_subscription_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Stripe Subscription ID',
  `billing_cycle` enum('monthly','annual') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `current_period_end` datetime DEFAULT NULL,
  `plan_code` enum('free','starter','pro','enterprise') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','trialing','past_due','canceled','expired') COLLATE utf8mb4_unicode_ci NOT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `stripe_price_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `billing_interval` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'monthly or annual',
  `trial_ends_at` datetime DEFAULT NULL,
  `current_period_start` datetime DEFAULT NULL,
  `canceled_at` datetime DEFAULT NULL,
  `cancel_at_period_end` tinyint(1) NOT NULL DEFAULT '0',
  `default_payment_method_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `card_brand` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `card_last_four` varchar(4) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `card_exp_month` varchar(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `card_exp_year` varchar(4) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `subscriptions_organization_id_status_index` (`organization_id`,`status`),
  KEY `subscriptions_plan_code_index` (`plan_code`),
  KEY `subscriptions_stripe_customer_id_index` (`stripe_customer_id`),
  KEY `subscriptions_stripe_subscription_id_index` (`stripe_subscription_id`),
  CONSTRAINT `subscriptions_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `support_ticket_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_ticket_messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ticket_id` bigint unsigned NOT NULL,
  `sender_user_id` bigint unsigned DEFAULT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_internal` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `support_ticket_messages_sender_user_id_foreign` (`sender_user_id`),
  KEY `support_ticket_messages_ticket_id_created_at_index` (`ticket_id`,`created_at`),
  CONSTRAINT `support_ticket_messages_sender_user_id_foreign` FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `support_ticket_messages_ticket_id_foreign` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `support_tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `support_tickets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned DEFAULT NULL,
  `submitted_by_user_id` bigint unsigned DEFAULT NULL,
  `assigned_to_user_id` bigint unsigned DEFAULT NULL,
  `subject` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('open','in_progress','pending_user','resolved','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `priority` enum('low','normal','high','urgent') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` enum('api','web','email','platform_admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'web',
  `closed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `support_tickets_submitted_by_user_id_foreign` (`submitted_by_user_id`),
  KEY `support_tickets_organization_id_status_index` (`organization_id`,`status`),
  KEY `support_tickets_status_priority_index` (`status`,`priority`),
  KEY `support_tickets_assigned_to_user_id_index` (`assigned_to_user_id`),
  CONSTRAINT `support_tickets_assigned_to_user_id_foreign` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `support_tickets_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `support_tickets_submitted_by_user_id_foreign` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `system_announcements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_announcements` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `announcement_type` enum('info','warning','maintenance','outage','update') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'info',
  `severity` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'low',
  `target_audience` enum('all','organizers') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_dismissable` tinyint(1) NOT NULL DEFAULT '1',
  `starts_at` datetime NOT NULL,
  `ends_at` datetime DEFAULT NULL,
  `created_by_admin_id` bigint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `system_announcements_is_active_starts_at_ends_at_index` (`is_active`,`starts_at`,`ends_at`),
  KEY `system_announcements_announcement_type_index` (`announcement_type`),
  KEY `system_announcements_created_by_admin_id_index` (`created_by_admin_id`),
  CONSTRAINT `system_announcements_created_by_admin_id_foreign` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admin_users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `taxonomy_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `taxonomy_categories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` smallint unsigned NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `taxonomy_categories_slug_unique` (`slug`),
  KEY `taxonomy_categories_sort_order_index` (`sort_order`),
  KEY `taxonomy_categories_is_active_index` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `taxonomy_specializations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `taxonomy_specializations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `subcategory_id` bigint unsigned NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` smallint unsigned NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `taxonomy_specializations_subcategory_id_slug_unique` (`subcategory_id`,`slug`),
  KEY `taxonomy_specializations_subcategory_id_sort_order_index` (`subcategory_id`,`sort_order`),
  KEY `taxonomy_specializations_is_active_index` (`is_active`),
  CONSTRAINT `taxonomy_specializations_subcategory_id_foreign` FOREIGN KEY (`subcategory_id`) REFERENCES `taxonomy_subcategories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `taxonomy_subcategories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `taxonomy_subcategories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `category_id` bigint unsigned NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` smallint unsigned NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `taxonomy_subcategories_category_id_slug_unique` (`category_id`,`slug`),
  KEY `taxonomy_subcategories_category_id_sort_order_index` (`category_id`,`sort_order`),
  KEY `taxonomy_subcategories_is_active_index` (`is_active`),
  CONSTRAINT `taxonomy_subcategories_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `taxonomy_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `taxonomy_tag_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `taxonomy_tag_groups` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `key` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `allows_multiple` tinyint(1) NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` smallint unsigned NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `taxonomy_tag_groups_key_unique` (`key`),
  KEY `taxonomy_tag_groups_is_active_sort_order_index` (`is_active`,`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `taxonomy_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `taxonomy_tags` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tag_group_id` bigint unsigned NOT NULL,
  `value` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` smallint unsigned NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `taxonomy_tags_tag_group_id_value_unique` (`tag_group_id`,`value`),
  KEY `taxonomy_tags_tag_group_id_sort_order_index` (`tag_group_id`,`sort_order`),
  KEY `taxonomy_tags_is_active_index` (`is_active`),
  CONSTRAINT `taxonomy_tags_tag_group_id_foreign` FOREIGN KEY (`tag_group_id`) REFERENCES `taxonomy_tag_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tenant_metrics_daily`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_metrics_daily` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `date` date NOT NULL,
  `active_workshops` int unsigned NOT NULL DEFAULT '0',
  `total_participants` int unsigned NOT NULL DEFAULT '0',
  `total_sessions` int unsigned NOT NULL DEFAULT '0',
  `notifications_sent` int unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenant_metrics_daily_organization_id_date_unique` (`organization_id`,`date`),
  KEY `tenant_metrics_daily_date_index` (`date`),
  CONSTRAINT `tenant_metrics_daily_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tracks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tracks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `workshop_id` bigint unsigned NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tracks_workshop_id_sort_order_index` (`workshop_id`,`sort_order`),
  CONSTRAINT `tracks_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `usage_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usage_snapshots` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `snapshot_type` enum('monthly','daily') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'monthly',
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `metrics_json` json NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `usage_snapshots_organization_id_snapshot_type_period_start_index` (`organization_id`,`snapshot_type`,`period_start`),
  CONSTRAINT `usage_snapshots_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `user_2fa_methods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_2fa_methods` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `method_type` enum('totp','email_code') COLLATE utf8mb4_unicode_ci NOT NULL,
  `secret_encrypted` text COLLATE utf8mb4_unicode_ci,
  `is_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `last_used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_2fa_methods_user_id_is_enabled_index` (`user_id`,`is_enabled`),
  CONSTRAINT `user_2fa_methods_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `user_2fa_recovery_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_2fa_recovery_codes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `code_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_2fa_recovery_codes_user_id_index` (`user_id`),
  KEY `user_2fa_recovery_codes_used_at_index` (`used_at`),
  CONSTRAINT `user_2fa_recovery_codes_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `user_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_profiles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `phone_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Private — never exposed publicly',
  `address_id` bigint unsigned DEFAULT NULL,
  `timezone` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'User timezone preference e.g. America/Chicago',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_profiles_user_id_unique` (`user_id`),
  KEY `user_profiles_address_id_index` (`address_id`),
  CONSTRAINT `user_profiles_address_id_foreign` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `user_profiles_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sessions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `session_token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `platform` enum('web','ios','android','unknown') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `device_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_seen_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_sessions_user_id_index` (`user_id`),
  KEY `user_sessions_expires_at_index` (`expires_at`),
  CONSTRAINT `user_sessions_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pronouns` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Optional: He/him, She/her, They/them, Other, Prefer not to say',
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email_verified_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `onboarding_intent` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `onboarding_completed_at` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `profile_image_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_is_active_index` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `waitlist_promotion_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `waitlist_promotion_payments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `workshop_id` bigint unsigned NOT NULL,
  `waitlist_entry_id` bigint unsigned DEFAULT NULL,
  `promotion_order` int unsigned NOT NULL DEFAULT '1',
  `status` enum('window_open','payment_completed','window_expired','skipped') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'window_open',
  `payment_window_hours` int unsigned NOT NULL DEFAULT '48',
  `window_opened_at` datetime NOT NULL,
  `window_expires_at` datetime NOT NULL,
  `reminder_sent_at` datetime DEFAULT NULL,
  `payment_completed_at` datetime DEFAULT NULL,
  `order_id` bigint unsigned DEFAULT NULL,
  `skipped_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `waitlist_promotion_payments_waitlist_entry_id_foreign` (`waitlist_entry_id`),
  KEY `waitlist_promotion_payments_order_id_foreign` (`order_id`),
  KEY `waitlist_promotion_payments_user_id_workshop_id_index` (`user_id`,`workshop_id`),
  KEY `waitlist_promotion_payments_status_window_expires_at_index` (`status`,`window_expires_at`),
  KEY `waitlist_promotion_payments_workshop_id_status_index` (`workshop_id`,`status`),
  CONSTRAINT `waitlist_promotion_payments_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `waitlist_promotion_payments_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `waitlist_promotion_payments_waitlist_entry_id_foreign` FOREIGN KEY (`waitlist_entry_id`) REFERENCES `registrations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `waitlist_promotion_payments_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `webhook_deliveries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `webhook_deliveries` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `webhook_endpoint_id` bigint unsigned DEFAULT NULL,
  `organization_id` bigint unsigned NOT NULL,
  `webhook_url` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload_json` json NOT NULL,
  `response_status` smallint unsigned DEFAULT NULL,
  `response_body` text COLLATE utf8mb4_unicode_ci,
  `attempt_count` tinyint unsigned NOT NULL DEFAULT '0',
  `last_attempted_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `next_retry_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `webhook_deliveries_organization_id_event_type_index` (`organization_id`,`event_type`),
  KEY `webhook_deliveries_delivered_at_index` (`delivered_at`),
  KEY `webhook_deliveries_last_attempted_at_index` (`last_attempted_at`),
  KEY `webhook_deliveries_webhook_endpoint_id_created_at_index` (`webhook_endpoint_id`,`created_at`),
  KEY `webhook_deliveries_next_retry_at_index` (`next_retry_at`),
  KEY `webhook_deliveries_event_type_index` (`event_type`),
  CONSTRAINT `webhook_deliveries_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `webhook_deliveries_webhook_endpoint_id_foreign` FOREIGN KEY (`webhook_endpoint_id`) REFERENCES `webhook_endpoints` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `webhook_endpoints`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `webhook_endpoints` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `url` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `secret_encrypted` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `event_types` json NOT NULL,
  `failure_count` int unsigned NOT NULL DEFAULT '0',
  `last_success_at` datetime DEFAULT NULL,
  `last_failure_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `webhook_endpoints_organization_id_is_active_index` (`organization_id`,`is_active`),
  CONSTRAINT `webhook_endpoints_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `workshop_leaders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workshop_leaders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `workshop_id` bigint unsigned NOT NULL,
  `leader_id` bigint unsigned NOT NULL,
  `invitation_id` bigint unsigned DEFAULT NULL,
  `is_confirmed` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `workshop_leaders_workshop_id_leader_id_unique` (`workshop_id`,`leader_id`),
  KEY `workshop_leaders_invitation_id_foreign` (`invitation_id`),
  KEY `workshop_leaders_leader_id_is_confirmed_index` (`leader_id`,`is_confirmed`),
  CONSTRAINT `workshop_leaders_invitation_id_foreign` FOREIGN KEY (`invitation_id`) REFERENCES `leader_invitations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `workshop_leaders_leader_id_foreign` FOREIGN KEY (`leader_id`) REFERENCES `leaders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `workshop_leaders_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `workshop_logistics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workshop_logistics` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `workshop_id` bigint unsigned NOT NULL,
  `hotel_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hotel_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hotel_address_id` bigint unsigned DEFAULT NULL,
  `hotel_phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hotel_notes` text COLLATE utf8mb4_unicode_ci,
  `parking_details` text COLLATE utf8mb4_unicode_ci,
  `meeting_room_details` text COLLATE utf8mb4_unicode_ci,
  `meetup_instructions` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `workshop_logistics_workshop_id_unique` (`workshop_id`),
  KEY `workshop_logistics_hotel_address_id_foreign` (`hotel_address_id`),
  CONSTRAINT `workshop_logistics_hotel_address_id_foreign` FOREIGN KEY (`hotel_address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `workshop_logistics_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `workshop_pricing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workshop_pricing` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `workshop_id` bigint unsigned NOT NULL,
  `base_price_cents` int unsigned NOT NULL DEFAULT '0',
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'usd',
  `is_paid` tinyint(1) NOT NULL DEFAULT '0',
  `deposit_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `deposit_amount_cents` int unsigned DEFAULT NULL,
  `deposit_is_nonrefundable` tinyint(1) NOT NULL DEFAULT '1',
  `balance_due_date` date DEFAULT NULL,
  `balance_auto_charge` tinyint(1) NOT NULL DEFAULT '1',
  `balance_reminder_days` json DEFAULT NULL,
  `minimum_attendance` int unsigned DEFAULT NULL,
  `commitment_date` date DEFAULT NULL,
  `commitment_description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `commitment_reminder_days` json DEFAULT NULL,
  `post_commitment_refund_pct` decimal(5,2) DEFAULT '0.00',
  `post_commitment_refund_note` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `workshop_pricing_workshop_id_unique` (`workshop_id`),
  KEY `workshop_pricing_is_paid_index` (`is_paid`),
  KEY `workshop_pricing_deposit_enabled_index` (`deposit_enabled`),
  KEY `workshop_pricing_balance_due_date_index` (`balance_due_date`),
  KEY `workshop_pricing_commitment_date_index` (`commitment_date`),
  CONSTRAINT `workshop_pricing_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `workshop_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workshop_tags` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `workshop_id` bigint unsigned NOT NULL,
  `tag_id` bigint unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `workshop_tags_workshop_id_tag_id_unique` (`workshop_id`,`tag_id`),
  KEY `workshop_tags_tag_id_index` (`tag_id`),
  CONSTRAINT `workshop_tags_tag_id_foreign` FOREIGN KEY (`tag_id`) REFERENCES `taxonomy_tags` (`id`) ON DELETE CASCADE,
  CONSTRAINT `workshop_tags_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `workshop_taxonomy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workshop_taxonomy` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `workshop_id` bigint unsigned NOT NULL,
  `category_id` bigint unsigned NOT NULL,
  `subcategory_id` bigint unsigned DEFAULT NULL,
  `specialization_id` bigint unsigned DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `wt_workshop_category_sub_spec_unique` (`workshop_id`,`category_id`,`subcategory_id`,`specialization_id`),
  KEY `workshop_taxonomy_workshop_id_is_primary_index` (`workshop_id`,`is_primary`),
  KEY `workshop_taxonomy_category_id_index` (`category_id`),
  KEY `workshop_taxonomy_subcategory_id_index` (`subcategory_id`),
  KEY `workshop_taxonomy_specialization_id_index` (`specialization_id`),
  CONSTRAINT `workshop_taxonomy_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `taxonomy_categories` (`id`),
  CONSTRAINT `workshop_taxonomy_specialization_id_foreign` FOREIGN KEY (`specialization_id`) REFERENCES `taxonomy_specializations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `workshop_taxonomy_subcategory_id_foreign` FOREIGN KEY (`subcategory_id`) REFERENCES `taxonomy_subcategories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `workshop_taxonomy_workshop_id_foreign` FOREIGN KEY (`workshop_id`) REFERENCES `workshops` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `workshops`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workshops` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint unsigned NOT NULL,
  `workshop_type` enum('session_based','event_based') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('draft','published','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `timezone` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `join_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `join_code_rotated_at` datetime DEFAULT NULL,
  `join_code_rotated_by_user_id` bigint unsigned DEFAULT NULL,
  `default_location_id` bigint unsigned DEFAULT NULL,
  `public_page_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `public_slug` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `social_share_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `social_share_description` text COLLATE utf8mb4_unicode_ci,
  `social_share_image_file_id` bigint unsigned DEFAULT NULL,
  `public_page_is_indexable` tinyint(1) NOT NULL DEFAULT '0',
  `canonical_url_override` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `public_summary` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `header_image_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `workshops_join_code_unique` (`join_code`),
  UNIQUE KEY `workshops_public_slug_unique` (`public_slug`),
  KEY `workshops_default_location_id_foreign` (`default_location_id`),
  KEY `workshops_organization_id_status_index` (`organization_id`,`status`),
  KEY `workshops_start_date_end_date_index` (`start_date`,`end_date`),
  KEY `workshops_workshop_type_index` (`workshop_type`),
  KEY `workshops_join_code_rotated_by_user_id_foreign` (`join_code_rotated_by_user_id`),
  CONSTRAINT `workshops_default_location_id_foreign` FOREIGN KEY (`default_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `workshops_join_code_rotated_by_user_id_foreign` FOREIGN KEY (`join_code_rotated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `workshops_organization_id_foreign` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (1,'2026_03_31_151433_create_personal_access_tokens_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (2,'2026_03_31_200000_create_users_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (3,'2026_03_31_200001_create_auth_methods_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (4,'2026_03_31_200002_create_user_2fa_methods_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (5,'2026_03_31_200003_create_user_2fa_recovery_codes_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (6,'2026_03_31_200004_create_password_reset_tokens_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (7,'2026_03_31_200005_create_user_sessions_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (8,'2026_03_31_200006_create_organizations_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (9,'2026_03_31_200007_create_organization_users_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (10,'2026_03_31_200008_create_subscriptions_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (11,'2026_03_31_200009_create_locations_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (12,'2026_03_31_200010_create_workshops_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (13,'2026_03_31_200011_create_workshop_logistics_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (14,'2026_03_31_200012_create_public_pages_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (15,'2026_03_31_200013_create_tracks_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (16,'2026_03_31_200014_create_sessions_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (17,'2026_03_31_200015_create_registrations_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (18,'2026_03_31_200016_create_session_selections_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (19,'2026_03_31_200017_create_leaders_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (20,'2026_03_31_200018_create_organization_leaders_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (21,'2026_03_31_200019_create_leader_invitations_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (22,'2026_03_31_200020_create_workshop_leaders_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (23,'2026_03_31_200021_create_session_leaders_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (24,'2026_03_31_200022_create_audit_logs_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (25,'2026_04_01_100000_add_phone_number_to_users_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (26,'2026_04_01_100001_create_attendance_records_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (27,'2026_04_01_100002_create_notifications_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (28,'2026_04_01_100003_create_notification_recipients_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (29,'2026_04_01_200000_enhance_session_leaders_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (30,'2026_04_01_200001_create_platform_admins_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (31,'2026_04_01_200002_create_invoices_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (32,'2026_04_01_200003_create_support_tickets_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (33,'2026_04_01_200004_create_support_ticket_messages_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (34,'2026_04_01_200005_create_help_articles_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (35,'2026_04_01_200006_create_automation_rules_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (36,'2026_04_01_200007_create_automation_runs_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (37,'2026_04_01_200008_create_login_events_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (38,'2026_04_01_200009_create_security_events_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (39,'2026_04_01_200010_create_api_clients_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (40,'2026_04_01_200011_create_webhook_deliveries_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (41,'2026_04_01_200012_create_usage_snapshots_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (42,'2026_04_01_200013_create_platform_metrics_daily_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (43,'2026_04_01_200014_create_tenant_metrics_daily_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (44,'2026_04_06_000001_create_push_tokens_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (45,'2026_04_06_000002_create_notification_preferences_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (46,'2026_04_07_000001_create_offline_sync_snapshots_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (47,'2026_04_07_000002_create_offline_action_queue_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (48,'2026_04_08_000001_create_feature_flags_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (49,'2026_04_09_000001_alter_auth_methods_add_sso_providers',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (50,'2026_04_09_000002_create_sso_configurations_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (51,'2026_04_09_000003_create_webhook_endpoints_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (52,'2026_04_09_000004_add_endpoint_fields_to_webhook_deliveries_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (53,'2026_04_09_000005_create_api_keys_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (54,'2026_04_09_000006_create_system_announcements_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (55,'2026_04_10_000001_create_admin_users_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (56,'2026_04_10_000002_create_admin_login_events_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (57,'2026_04_10_000003_create_platform_audit_logs_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (58,'2026_04_10_000004_create_stripe_customers_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (59,'2026_04_10_000005_create_stripe_subscriptions_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (60,'2026_04_10_000006_create_stripe_invoices_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (61,'2026_04_10_000007_create_stripe_events_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (62,'2026_04_10_000008_alter_automation_rules_for_command_center',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (63,'2026_04_10_000009_alter_automation_runs_for_command_center',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (64,'2026_04_10_000010_create_crisp_conversations_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (65,'2026_04_10_000011_alter_login_events_add_outcome',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (66,'2026_04_10_000012_alter_security_events_for_command_center',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (67,'2026_04_10_000013_create_failed_jobs_log_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (68,'2026_04_10_000014_create_metric_snapshots_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (69,'2026_04_10_000015_create_platform_config_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (70,'2026_04_10_000016_update_system_announcements_fk_to_admin_users',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (71,'2026_04_05_000001_add_onboarding_fields_to_users_table',2);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (72,'2026_04_05_100001_add_image_columns_to_workshops_sessions_organizations_users',3);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (73,'2026_04_05_000002_backfill_onboarding_completed_at_for_existing_users',4);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (74,'2026_04_16_000001_create_addresses_table',4);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (75,'2026_04_16_000002_add_address_id_to_locations',4);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (76,'2026_04_16_000003_add_address_id_to_leaders',4);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (77,'2026_04_16_000004_add_address_id_to_organizations',4);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (78,'2026_04_16_000005_add_hotel_address_id_to_workshop_logistics',4);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (79,'2026_04_16_000006_add_location_type_to_sessions',5);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (80,'2026_04_16_000007_set_location_type_for_existing_sessions',5);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (81,'2026_04_09_100001_add_pronouns_to_users_table',6);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (82,'2026_04_09_100002_create_user_profiles_table',6);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (83,'2026_04_10_100000_add_stripe_fields_to_subscriptions',7);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (84,'2026_04_12_000001_create_organization_invitations_table',8);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (85,'2026_04_12_000001_add_token_hash_index_to_leader_invitations_table',9);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (86,'2026_04_16_000008_add_geocode_fields_to_addresses',9);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (87,'2026_04_16_000009_create_geocode_cache_table',9);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (88,'2026_04_18_173714_add_category_and_action_data_to_notifications',10);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (89,'2026_04_18_174031_make_notifications_workshop_and_creator_nullable',11);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (90,'2026_04_18_180000_add_stripe_fields_to_organizations',12);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (91,'2026_04_18_180001_add_stripe_fields_to_subscriptions',13);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (92,'2026_04_19_000001_add_social_sharing_fields_to_workshops',14);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (93,'2026_04_19_000002_add_removed_by_to_registrations',15);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (94,'2026_04_19_000003_add_join_code_rotated_at_to_workshops',15);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (95,'2026_04_20_020123_create_organization_invitations_table',16);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (108,'2026_04_20_100001_add_access_control_fields_to_sessions',17);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (109,'2026_04_20_100002_add_publication_status_sync_trigger_to_sessions',17);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (110,'2026_04_20_100003_add_assignment_fields_to_session_selections',17);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (118,'2026_04_20_200001_create_taxonomy_categories_table',18);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (119,'2026_04_20_200002_create_taxonomy_subcategories_table',18);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (120,'2026_04_20_200003_create_taxonomy_specializations_table',18);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (121,'2026_04_20_200004_create_taxonomy_tag_groups_table',18);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (122,'2026_04_20_200005_create_taxonomy_tags_table',18);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (123,'2026_04_20_200006_create_workshop_taxonomy_table',18);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (124,'2026_04_20_200007_create_workshop_tags_table',18);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (143,'2026_04_24_000001_create_platform_take_rates_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (144,'2026_04_24_000002_create_stripe_connect_accounts_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (145,'2026_04_24_000003_create_payment_feature_flags_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (146,'2026_04_24_000004_create_workshop_pricing_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (147,'2026_04_24_000005_create_session_pricing_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (148,'2026_04_24_000006_create_refund_policies_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (149,'2026_04_24_000007_create_carts_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (150,'2026_04_24_000008_create_cart_items_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (151,'2026_04_24_000009_create_orders_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (152,'2026_04_24_000010_create_order_items_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (153,'2026_04_24_000011_create_payment_intents_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (154,'2026_04_24_000012_create_refund_requests_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (155,'2026_04_24_000013_create_refund_transactions_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (156,'2026_04_24_000014_create_platform_credits_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (157,'2026_04_24_000015_create_waitlist_promotion_payments_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (158,'2026_04_24_000016_create_scheduled_payment_jobs_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (159,'2026_04_24_000017_create_email_logs_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (160,'2026_04_24_000018_create_disputes_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (161,'2026_04_24_000019_create_order_sequences_table',20);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (162,'2026_04_24_000020_add_balance_fields_to_orders',21);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (163,'2026_04_24_000021_add_balance_payment_expiry_to_scheduled_jobs',21);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (164,'2026_04_29_014109_add_requires_action_job_type_to_scheduled_payment_jobs',21);
