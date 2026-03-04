CREATE TABLE `cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseNumber` varchar(12) NOT NULL,
	`status` enum('進入檔案室','擲回經辦人員','轉台北審核','轉法務追償') NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cases_id` PRIMARY KEY(`id`),
	CONSTRAINT `cases_caseNumber_unique` UNIQUE(`caseNumber`)
);
--> statement-breakpoint
CREATE TABLE `statusHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`status` enum('進入檔案室','擲回經辦人員','轉台北審核','轉法務追償') NOT NULL,
	`operatorId` int NOT NULL,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	`reason` text,
	CONSTRAINT `statusHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cases` ADD CONSTRAINT `cases_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `statusHistory` ADD CONSTRAINT `statusHistory_caseId_cases_id_fk` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `statusHistory` ADD CONSTRAINT `statusHistory_operatorId_users_id_fk` FOREIGN KEY (`operatorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;