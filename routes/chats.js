import express from 'express';
import { prismaClient } from '../src/prisma-client.js';
import { validateBody } from '../utils/validate-body.js';

const router = express.Router();

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const chat = await prismaClient.chats.findUnique({
            where: { id: id }
        });

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        if (chat.senderId !== userId) {
            return res.status(403).json({ message: "You can only delete your own messages" });
        }

        const deletedChat = await prismaClient.chats.delete({
            where: { id: id },            
        });
        
        res.json({ message: "Chat deleted successfully" });

    } catch (error) {
        console.error("Failed to delete chat:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


router.get('/room/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    try {
        const participant = await prismaClient.roomParticipants.findFirst({
            where: {
                roomId: id,
                userId: userId,
                status: 'ACTIVE'
            }
        });

        if (!participant) {
            return res.status(403).json({ message: "You are not a member of this room" });
        }

        if (page === 1) {
            await prismaClient.roomParticipants.updateMany({
                where: { roomId: id, userId: userId },
                data: { lastSeenAt: new Date() }
            });
        }

        const totalChats = await prismaClient.chats.count({
            where: { roomId: id }
        });

        const chats = await prismaClient.chats.findMany({
            where: { roomId: id },
            take: limit,
            skip: skip,
            orderBy: { createdAt: 'desc' }, 
            include: { 
                sender: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        profileImage: true
                    }
                } 
            },
        });

        const chronologicalChats = chats.reverse();

        res.json({
            meta: {
                roomId: id,
                lastSeenAt: participant.lastSeenAt,
                pagination: {
                    page: page,
                    limit: limit,
                    totalChats: totalChats,
                    totalPages: Math.ceil(totalChats / limit),
                    hasMore: (page * limit) < totalChats 
                }
            },
            data: chronologicalChats,
        });

    } catch (error) {
        console.error("Failed to fetch chats:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

export default router;