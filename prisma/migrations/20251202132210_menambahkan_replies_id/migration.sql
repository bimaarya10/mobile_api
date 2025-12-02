-- DropForeignKey
ALTER TABLE `comments` DROP FOREIGN KEY `comments_replied_id_fkey`;

-- DropIndex
DROP INDEX `comments_replied_id_fkey` ON `comments`;

-- AlterTable
ALTER TABLE `comments` ADD COLUMN `parent_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
