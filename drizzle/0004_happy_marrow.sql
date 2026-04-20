CREATE TABLE `auditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`targetUserId` int NOT NULL,
	`oldRole` enum('user','admin') NOT NULL,
	`newRole` enum('user','admin') NOT NULL,
	`reason` text,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `auditLog` ADD CONSTRAINT `auditLog_adminId_users_id_fk` FOREIGN KEY (`adminId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLog` ADD CONSTRAINT `auditLog_targetUserId_users_id_fk` FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;