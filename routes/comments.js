import express from 'express';

import { prismaClient } from '../src/prisma-client.js';

const router = express.Router();

import { z } from 'zod';
import { validateBody } from '../utils/validate-body.js';

const schemaValidation = z.object({
    feedId: z.string().refine((data) => data.length > 0, { message: "Feed ID is required" }),
    description: z.coerce.string().refine((data) => data.length > 0, { message: "Field is required" }),
    senderId: z.string().refine((data) => data.length > 0, { message: "Sender ID is required" }),
});

router.post('/', async (req, res) => {
    validateBody(schemaValidation)
    try {
        const data = req.validatedBody;
        const comment = await prismaClient.comments.create({
            data: {
                feedId: data.feedId,
                description: data.description,
                senderId: data.senderId,
            },
            include: { sender: true },
        });
        res.status(201).json(comment);
    } catch (error) {
        console.error("Failed to create comment:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const data = await prismaClient.comments.findMany({
            where: { AND: [{ feedId: id }, { parentId: null }] },
            include: { sender: true, replies: true}
        });
        res.json(data);
    } catch (error) {
        console.error("Failed to fetch data from database:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prismaClient.comments.deleteMany({
            where: { parentId: id },
        });
        await prismaClient.comments.delete({
            where: { id: id },
        });
        res.status(204).send();
    } catch (error) {
        console.error("Failed to delete comment from database:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

export default router;