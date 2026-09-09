CREATE TABLE `eventSettings` (
	`id` int NOT NULL,
	`currentStage` enum('ROUND_1_UPCOMING','ROUND_1_LIVE','ROUND_1_COMPLETED','ROUND_2_UPCOMING','ROUND_2_LIVE','ROUND_2_COMPLETED','FINAL_UPCOMING','FINAL_LIVE','FINAL_COMPLETED','RESULTS_LIVE') NOT NULL DEFAULT 'ROUND_1_UPCOMING',
	`round1MaxScore` int NOT NULL DEFAULT 40,
	`round2MaxScore` int NOT NULL DEFAULT 40,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `eventSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scoreAuditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamId` int NOT NULL,
	`round` enum('ROUND_1','ROUND_2') NOT NULL,
	`oldScore` int,
	`newScore` int NOT NULL,
	`changedBy` int NOT NULL,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scoreAuditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamId` int NOT NULL,
	`round1Score` int,
	`round2Score` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `scores_team_id_unique` UNIQUE(`teamId`),
	CONSTRAINT `scores_round1_non_negative` CHECK(`scores`.`round1Score` is null or `scores`.`round1Score` >= 0),
	CONSTRAINT `scores_round2_non_negative` CHECK(`scores`.`round2Score` is null or `scores`.`round2Score` >= 0)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamId` varchar(32) NOT NULL,
	`teamName` varchar(160) NOT NULL,
	`venue` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teams_id` PRIMARY KEY(`id`),
	CONSTRAINT `teams_team_id_unique` UNIQUE(`teamId`)
);
--> statement-breakpoint
CREATE TABLE `venueGroupMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`venueName` varchar(32) NOT NULL,
	CONSTRAINT `venueGroupMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `venue_group_members_unique` UNIQUE(`groupId`,`venueName`)
);
--> statement-breakpoint
CREATE TABLE `venueGroups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupName` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `venueGroups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `scoreAuditLog` ADD CONSTRAINT `scoreAuditLog_teamId_teams_id_fk` FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scoreAuditLog` ADD CONSTRAINT `scoreAuditLog_changedBy_users_id_fk` FOREIGN KEY (`changedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scores` ADD CONSTRAINT `scores_teamId_teams_id_fk` FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venueGroupMembers` ADD CONSTRAINT `venueGroupMembers_groupId_venueGroups_id_fk` FOREIGN KEY (`groupId`) REFERENCES `venueGroups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `score_audit_team_idx` ON `scoreAuditLog` (`teamId`,`changedAt`);--> statement-breakpoint
CREATE INDEX `teams_venue_idx` ON `teams` (`venue`);