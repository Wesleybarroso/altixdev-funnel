CREATE TABLE `eventLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(48) NOT NULL,
	`eventType` varchar(96) NOT NULL,
	`status` enum('info','success','warning','error') NOT NULL DEFAULT 'info',
	`message` text NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `eventLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integrationConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(48) NOT NULL,
	`configCiphertext` text NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`lastCheckAt` timestamp,
	`lastStatus` int,
	`lastMessage` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrationConfigs_id` PRIMARY KEY(`id`),
	CONSTRAINT `integrationConfigs_provider_unique` UNIQUE(`provider`)
);
