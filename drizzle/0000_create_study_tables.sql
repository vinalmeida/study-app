CREATE TABLE `subjects` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `name` text NOT NULL,
  `color` text NOT NULL,
  `deleted_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_entries` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `subject_id` integer NOT NULL,
  `study_date` text NOT NULL,
  `duration_minutes` integer NOT NULL,
  `study_type` text NOT NULL,
  `notes` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `duration_range` CHECK (`duration_minutes` BETWEEN 1 AND 1439),
  CONSTRAINT `study_type_valid` CHECK (`study_type` IN ('theory', 'exercises'))
);
--> statement-breakpoint
CREATE INDEX `idx_subjects_user_active` ON `subjects` (`user_id`, `deleted_at`);
--> statement-breakpoint
CREATE INDEX `idx_entries_user_date` ON `study_entries` (`user_id`, `study_date`);
--> statement-breakpoint
PRAGMA optimize;
