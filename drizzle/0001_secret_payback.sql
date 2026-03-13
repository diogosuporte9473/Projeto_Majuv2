CREATE TABLE `boardMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('viewer','editor','admin') NOT NULL DEFAULT 'viewer',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `boardMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `boards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`color` varchar(7) NOT NULL DEFAULT '#4b4897',
	`ownerId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `boards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cardAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`filename` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(255) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cardAttachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`position` int NOT NULL DEFAULT 0,
	`dueDate` timestamp,
	`assignedTo` int,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mirroredCards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`originalCardId` int NOT NULL,
	`mirrorCardId` int NOT NULL,
	`originalBoardId` int NOT NULL,
	`mirrorBoardId` int NOT NULL,
	`syncStatus` enum('synced','pending','failed') NOT NULL DEFAULT 'synced',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mirroredCards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('card_assigned','card_updated','card_mirrored','due_date_alert','comment_mention') NOT NULL,
	`cardId` int,
	`title` varchar(255) NOT NULL,
	`message` text,
	`read` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`emailOnCardAssigned` int NOT NULL DEFAULT 1,
	`emailOnCardUpdated` int NOT NULL DEFAULT 1,
	`emailOnMirroredCard` int NOT NULL DEFAULT 1,
	`emailOnDueDate` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `userPreferences_userId_unique` UNIQUE(`userId`)
);
