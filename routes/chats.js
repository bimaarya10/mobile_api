import express from 'express';
import { prismaClient } from '../src/prisma-client.js';
import { validateBody } from '../utils/validate-body.js';

const router = express.Router();

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const deletedChat = await prismaClient.chats.delete({
            where: { id: id },
        });
        res.json(deletedChat);
    } catch (error) {
        console.error("Failed to delete chat:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/room/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const chats = await prismaClient.chats.findMany({
            where: { roomId: id },
            orderBy: { createdAt: 'asc' },
            include: { sender: true },
        });
        if (chats) {
            res.json(chats);
        } else {
            res.status(404).json({ message: "Data not found" });
        }
    } catch (error) {
        console.error("Failed to fetch data from database:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}
);
export default router;