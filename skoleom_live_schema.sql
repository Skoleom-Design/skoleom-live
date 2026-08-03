CREATE DATABASE IF NOT EXISTS `skoleom_live` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `skoleom_live`;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `admin_action_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `admin_action_logs` (
  `id` varchar(36) NOT NULL,
  `action` enum('plan_change','status_change','credit','boost_grant','boost_cancel','boost_approve') NOT NULL,
  `adminId` varchar(255) NOT NULL,
  `targetUserId` varchar(255) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_0657912c965ab7658e3c1f388c4` (`adminId`),
  CONSTRAINT `FK_0657912c965ab7658e3c1f388c4` FOREIGN KEY (`adminId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `auction_bids`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auction_bids` (
  `id` varchar(36) NOT NULL,
  `liveSessionId` varchar(255) NOT NULL,
  `bidderId` varchar(255) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `FK_04440c90ed1896078c5c4162d8f` (`liveSessionId`),
  KEY `FK_8ed7f1b2b910713754a47c65721` (`bidderId`),
  CONSTRAINT `FK_04440c90ed1896078c5c4162d8f` FOREIGN KEY (`liveSessionId`) REFERENCES `live_sessions` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_8ed7f1b2b910713754a47c65721` FOREIGN KEY (`bidderId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `boosts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `boosts` (
  `id` varchar(36) NOT NULL,
  `status` enum('pending','active','completed','cancelled') NOT NULL DEFAULT 'pending',
  `objective` enum('views','sales','followers') NOT NULL DEFAULT 'views',
  `scope` enum('post','account') NOT NULL DEFAULT 'post',
  `budget` decimal(10,2) NOT NULL,
  `spent` decimal(10,2) NOT NULL DEFAULT 0.00,
  `currency` varchar(255) NOT NULL DEFAULT 'EUR',
  `stripePaymentIntentId` varchar(255) DEFAULT NULL,
  `durationDays` int(11) NOT NULL,
  `startedAt` datetime DEFAULT NULL,
  `endedAt` datetime DEFAULT NULL,
  `impressions` int(11) NOT NULL DEFAULT 0,
  `clicks` int(11) NOT NULL DEFAULT 0,
  `conversions` int(11) NOT NULL DEFAULT 0,
  `userId` varchar(255) NOT NULL,
  `postId` varchar(255) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `FK_f7460e6f5e6df9ad8b4f1266e0c` (`userId`),
  KEY `FK_082b4a23f436ffb7c57d95e2beb` (`postId`),
  CONSTRAINT `FK_082b4a23f436ffb7c57d95e2beb` FOREIGN KEY (`postId`) REFERENCES `posts` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_f7460e6f5e6df9ad8b4f1266e0c` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `capsule_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `capsule_groups` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `creatorId` varchar(255) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `capsules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `capsules` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `brand` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `currency` varchar(255) NOT NULL DEFAULT 'EUR',
  `status` enum('available','sold_out','archived') NOT NULL DEFAULT 'available',
  `imageUrl` varchar(255) DEFAULT NULL,
  `condition` enum('neuf_avec_etiquette','neuf_sans_etiquette','tres_bon_etat','bon_etat','satisfaisant') DEFAULT NULL,
  `category` enum('vetement','chaussures','accessoire','objet') DEFAULT NULL,
  `size` varchar(255) DEFAULT NULL,
  `subcategory` varchar(255) DEFAULT NULL,
  `stock` int(11) NOT NULL DEFAULT 0,
  `soldCount` int(11) NOT NULL DEFAULT 0,
  `commissionRate` decimal(5,2) NOT NULL DEFAULT 15.00,
  `groupId` varchar(255) DEFAULT NULL,
  `creatorId` varchar(255) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `colors` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `variants` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_adebf812ea363202f994499ce76` (`groupId`),
  CONSTRAINT `FK_adebf812ea363202f994499ce76` FOREIGN KEY (`groupId`) REFERENCES `capsule_groups` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `comments` (
  `id` varchar(36) NOT NULL,
  `text` text NOT NULL,
  `userId` varchar(255) NOT NULL,
  `postId` varchar(255) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `FK_7e8d7c49f218ebb14314fdb3749` (`userId`),
  KEY `FK_e44ddaaa6d058cb4092f83ad61f` (`postId`),
  CONSTRAINT `FK_7e8d7c49f218ebb14314fdb3749` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_e44ddaaa6d058cb4092f83ad61f` FOREIGN KEY (`postId`) REFERENCES `posts` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `gifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `gifts` (
  `id` varchar(36) NOT NULL,
  `giftType` varchar(255) NOT NULL,
  `senderId` varchar(255) NOT NULL,
  `receiverId` varchar(255) DEFAULT NULL,
  `liveSessionId` varchar(255) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `creatorAmount` decimal(10,2) NOT NULL,
  `platformAmount` decimal(10,2) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `FK_ee13c1c71ac6b4d5e669519d81b` (`senderId`),
  KEY `FK_7cfae3fdd59f5852b5474456b5c` (`receiverId`),
  KEY `FK_1311062aab105945666daaa648e` (`liveSessionId`),
  CONSTRAINT `FK_1311062aab105945666daaa648e` FOREIGN KEY (`liveSessionId`) REFERENCES `live_sessions` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_7cfae3fdd59f5852b5474456b5c` FOREIGN KEY (`receiverId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_ee13c1c71ac6b4d5e669519d81b` FOREIGN KEY (`senderId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `live_capsules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `live_capsules` (
  `liveSessionsId` varchar(36) NOT NULL,
  `capsulesId` varchar(36) NOT NULL,
  PRIMARY KEY (`liveSessionsId`,`capsulesId`),
  KEY `IDX_31727b5936eeab3313c2eb45ae` (`liveSessionsId`),
  KEY `IDX_b47416b182c04b0a8feddb5228` (`capsulesId`),
  CONSTRAINT `FK_31727b5936eeab3313c2eb45aef` FOREIGN KEY (`liveSessionsId`) REFERENCES `live_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_b47416b182c04b0a8feddb52289` FOREIGN KEY (`capsulesId`) REFERENCES `capsules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `live_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `live_comments` (
  `id` varchar(36) NOT NULL,
  `text` text NOT NULL,
  `userId` varchar(255) NOT NULL,
  `liveSessionId` varchar(255) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `FK_fd09538882c990ac4fa5a522f1d` (`userId`),
  KEY `FK_17a29f2f67048bbac4489408fa9` (`liveSessionId`),
  CONSTRAINT `FK_17a29f2f67048bbac4489408fa9` FOREIGN KEY (`liveSessionId`) REFERENCES `live_sessions` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_fd09538882c990ac4fa5a522f1d` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `live_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `live_sessions` (
  `id` varchar(36) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `status` enum('live','ended') NOT NULL DEFAULT 'live',
  `mode` enum('live','auction') NOT NULL DEFAULT 'live',
  `creatorId` varchar(255) NOT NULL,
  `startedAt` datetime DEFAULT NULL,
  `endedAt` datetime DEFAULT NULL,
  `auctionCapsuleId` varchar(255) DEFAULT NULL,
  `startingBid` decimal(10,2) DEFAULT NULL,
  `currentBid` decimal(10,2) DEFAULT NULL,
  `currentBidderId` varchar(255) DEFAULT NULL,
  `auctionEndsAt` datetime DEFAULT NULL,
  `auctionSettled` tinyint(4) NOT NULL DEFAULT 0,
  `auctionActive` tinyint(4) NOT NULL DEFAULT 0,
  `createdAt` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `auctionRoundsCount` int(11) NOT NULL DEFAULT 0,
  `featuredCapsuleId` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_c1c43b8eb03c6dc655b1d4f9472` (`creatorId`),
  KEY `FK_91489ca597c80e3f5580ad22b9a` (`featuredCapsuleId`),
  KEY `FK_1b9b98fea21cc0fec9a79057bc0` (`auctionCapsuleId`),
  KEY `FK_f6f9019f39694b1efa381be7465` (`currentBidderId`),
  CONSTRAINT `FK_1b9b98fea21cc0fec9a79057bc0` FOREIGN KEY (`auctionCapsuleId`) REFERENCES `capsules` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_91489ca597c80e3f5580ad22b9a` FOREIGN KEY (`featuredCapsuleId`) REFERENCES `capsules` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_c1c43b8eb03c6dc655b1d4f9472` FOREIGN KEY (`creatorId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_f6f9019f39694b1efa381be7465` FOREIGN KEY (`currentBidderId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `id` varchar(36) NOT NULL,
  `type` enum('like','comment') NOT NULL,
  `recipientId` varchar(255) NOT NULL,
  `actorId` varchar(255) NOT NULL,
  `postId` varchar(255) DEFAULT NULL,
  `read` tinyint(4) NOT NULL DEFAULT 0,
  `createdAt` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`),
  KEY `IDX_db873ba9a123711a4bff527ccd` (`recipientId`),
  KEY `FK_44412a2d6f162ff4dc1697d0db7` (`actorId`),
  KEY `FK_93c464aaf70fb0720dc500e93c8` (`postId`),
  CONSTRAINT `FK_44412a2d6f162ff4dc1697d0db7` FOREIGN KEY (`actorId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_93c464aaf70fb0720dc500e93c8` FOREIGN KEY (`postId`) REFERENCES `posts` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `orders` (
  `id` varchar(36) NOT NULL,
  `status` enum('pending','paid','delivered','refunded') NOT NULL DEFAULT 'pending',
  `amount` decimal(10,2) NOT NULL,
  `commissionAmount` decimal(10,2) NOT NULL,
  `creatorAmount` decimal(10,2) NOT NULL,
  `currency` varchar(255) NOT NULL DEFAULT 'EUR',
  `stripePaymentIntentId` varchar(255) DEFAULT NULL,
  `selectedVariant` varchar(255) DEFAULT NULL,
  `buyerId` varchar(255) NOT NULL,
  `capsuleId` varchar(255) NOT NULL,
  `creatorId` varchar(255) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `shippingAddress` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_9877ffd9a491c3e82f5b32d4f4d` (`buyerId`),
  KEY `FK_7a388b0b04800f3fd856ffb48c2` (`capsuleId`),
  KEY `FK_b40146eff5004cd1e86c15aa987` (`creatorId`),
  CONSTRAINT `FK_7a388b0b04800f3fd856ffb48c2` FOREIGN KEY (`capsuleId`) REFERENCES `capsules` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_9877ffd9a491c3e82f5b32d4f4d` FOREIGN KEY (`buyerId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_b40146eff5004cd1e86c15aa987` FOREIGN KEY (`creatorId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `post_capsules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `post_capsules` (
  `postsId` varchar(36) NOT NULL,
  `capsulesId` varchar(36) NOT NULL,
  PRIMARY KEY (`postsId`,`capsulesId`),
  KEY `IDX_035834c9937345a1c27d5f7c30` (`postsId`),
  KEY `IDX_dc163186e0f761d7a86dd13527` (`capsulesId`),
  CONSTRAINT `FK_035834c9937345a1c27d5f7c303` FOREIGN KEY (`postsId`) REFERENCES `posts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_dc163186e0f761d7a86dd135273` FOREIGN KEY (`capsulesId`) REFERENCES `capsules` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `post_likes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `post_likes` (
  `postsId` varchar(36) NOT NULL,
  `usersId` varchar(36) NOT NULL,
  PRIMARY KEY (`postsId`,`usersId`),
  KEY `IDX_e4b9fa42093474796954477662` (`postsId`),
  KEY `IDX_a2eba635b69777b11efb0ecca2` (`usersId`),
  CONSTRAINT `FK_a2eba635b69777b11efb0ecca24` FOREIGN KEY (`usersId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_e4b9fa420934747969544776626` FOREIGN KEY (`postsId`) REFERENCES `posts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `posts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `posts` (
  `id` varchar(36) NOT NULL,
  `caption` text DEFAULT NULL,
  `type` enum('video','photo') NOT NULL DEFAULT 'video',
  `status` enum('active','archived','moderated') NOT NULL DEFAULT 'active',
  `mediaUrl` varchar(255) NOT NULL,
  `thumbnailUrl` varchar(255) DEFAULT NULL,
  `viewCount` int(11) NOT NULL DEFAULT 0,
  `likeCount` int(11) NOT NULL DEFAULT 0,
  `shareCount` int(11) NOT NULL DEFAULT 0,
  `commentCount` int(11) NOT NULL DEFAULT 0,
  `boostScore` int(11) NOT NULL DEFAULT 0,
  `isBoosted` tinyint(4) NOT NULL DEFAULT 0,
  `musicName` varchar(255) DEFAULT NULL,
  `musicUrl` varchar(255) DEFAULT NULL,
  `creatorId` varchar(255) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_c07f375e63832303f0a5049b776` (`creatorId`),
  CONSTRAINT `FK_c07f375e63832303f0a5049b776` FOREIGN KEY (`creatorId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `username` varchar(255) NOT NULL,
  `displayName` varchar(255) DEFAULT NULL,
  `avatarUrl` varchar(255) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `role` enum('creator','buyer','admin') NOT NULL DEFAULT 'creator',
  `plan` enum('free','premium','ultra') NOT NULL DEFAULT 'free',
  `isVerified` tinyint(4) NOT NULL DEFAULT 0,
  `isActive` tinyint(4) NOT NULL DEFAULT 1,
  `totalEarnings` decimal(10,2) NOT NULL DEFAULT 0.00,
  `walletBalance` decimal(10,2) NOT NULL DEFAULT 0.00,
  `pendingBalance` decimal(10,2) NOT NULL DEFAULT 0.00,
  `stripeAccountId` varchar(255) DEFAULT NULL,
  `instagramUserId` varchar(255) DEFAULT NULL,
  `instagramUsername` varchar(255) DEFAULT NULL,
  `instagramAccessToken` varchar(255) DEFAULT NULL,
  `instagramTokenExpiresAt` datetime DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_97672ac88f789774dd47f7c8be` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `wallet_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wallet_transactions` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(255) NOT NULL,
  `type` enum('topup','withdrawal','capsule_purchase','capsule_sale_pending','capsule_sale_released','gift_sent','gift_received','admin_credit','boost_purchase') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `reference` varchar(255) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

