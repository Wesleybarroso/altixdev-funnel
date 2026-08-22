CREATE TABLE `webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`urlCiphertext` text NOT NULL,
	`authHeaderName` varchar(100),
	`secretCiphertext` text,
	`enabled` boolean NOT NULL DEFAULT true,
	`lastTestAt` timestamp,
	`lastStatus` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhooks_id` PRIMARY KEY(`id`)
);
