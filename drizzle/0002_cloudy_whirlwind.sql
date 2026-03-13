CREATE TABLE `cardChecklists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`completed` int NOT NULL DEFAULT 0,
	`position` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cardChecklists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cardCustomFields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`fieldName` varchar(255) NOT NULL,
	`fieldValue` text,
	`fieldType` enum('text','select','date','number') NOT NULL DEFAULT 'text',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cardCustomFields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cardLabels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`label` varchar(50) NOT NULL,
	`color` varchar(7) NOT NULL DEFAULT '#4b4897',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cardLabels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectDates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`projectStartDate` timestamp,
	`projectEndDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectDates_id` PRIMARY KEY(`id`),
	CONSTRAINT `projectDates_cardId_unique` UNIQUE(`cardId`)
);
