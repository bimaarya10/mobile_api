import express from 'express';

import { prismaClient } from '../src/prisma-client.js';

const router = express.Router();


router.get('/', async (req, res) => {
    try {
        const data = await prismaClient.comments.findMany({
            where: { feedId: req.query.feedId || undefined },
            include: { sender: true, replies: true, parent  }
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