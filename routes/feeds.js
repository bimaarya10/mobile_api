import express from 'express';
import { prismaClient } from '../src/prisma-client.js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { validateBody } from '../utils/validate-body.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();
const upload = multer({
    limits: { fileSize: 5 * 1024 * 1024 }
});

const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png"];
const maxProfileImageSize = 2 * 1024 * 1024;

const schemaValidation = z.object({
    description: z.coerce.string().refine((data) => data.length > 0, { message: "Field is required" }),
    userId: z.string(),
    imageContent: z.any().optional().refine(
        (image) => !image || typeof image === "string" || allowedImageTypes.includes(image.type),
        "Only .jpeg, .jpg, and .png formats are supported"
    ).refine((image) => !image || typeof image === 'string' || image.size <= maxProfileImageSize,
        "Max image size is 2MB"
    ),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_PATH = path.join(__dirname, '../public/uploads');

router.get('/', async (req, res) => {
    try {
        const data = await prismaClient.feeds.findMany({ include: { comments: true, feedsLikes: true, user: true } });
        res.json(data);
    } catch (error) {
        console.error("Failed to fetch data from database:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const feed = await prismaClient.feeds.findUnique({
            where: { id: id },
            include: { comments: true, feedsLikes: true, user: true }
        });
        if (feed) {
            res.json(feed);
        } else {
            res.status(404).json({ message: "Data not found" });
        }
    } catch (error) {
        console.error("Failed to fetch data from database:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.post('/',
    upload.single('imageContent'),
    validateBody(schemaValidation),
    async (req, res) => {
        try {
            const data = req.validatedBody;
            const imageFile = data.getFile ? data.getFile('imageContent') : null;

            if (imageFile) {
                const ext = imageFile.filename.split('.').pop();
                const fileName = uuidv4() + '.' + ext;
                const targetFolder = path.join(STORAGE_PATH, 'feeds');

                if (!fs.existsSync(targetFolder)) {
                    fs.mkdirSync(targetFolder, { recursive: true });
                }

                fs.writeFileSync(path.join(targetFolder, fileName), imageFile.data);
                data.imageContent = '/uploads/feeds/' + fileName;
            }

            const newFeed = await prismaClient.feeds.create({
                data: {
                    description: data.description,
                    imageContent: data.imageContent,
                    userId: data.userId,
                },
            });

            res.status(201).json(newFeed);
        } catch (error) {
            console.error("Failed to add data to database:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
);

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prismaClient.comments.deleteMany({
            where: { feedId: id },
        });
        await prismaClient.feedsLikes.deleteMany({
            where: { feedId: id },
        });
        const deletedFeed = await prismaClient.feeds.delete({
            where: { id: id },
        });
        res.json(deletedFeed);
    } catch (error) {
        console.error("Failed to delete data from database:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
export default router;