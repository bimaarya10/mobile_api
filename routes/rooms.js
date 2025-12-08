import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { fileURLToPath } from 'url';

import { prismaClient } from '../src/prisma-client.js';
import { validateBody } from '../utils/validate-body.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_PATH = path.join(__dirname, '../public/uploads');

const upload = multer({
    limits: { fileSize: 5 * 1024 * 1024 }
});

const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png"];
const maxProfileImageSize = 2 * 1024 * 1024;

const schemaValidation = z.object({
    name: z.coerce.string().min(1, { message: "Field is required" }),
    description: z.coerce.string().min(1, { message: "Field is required" }),
    maxMember: z.coerce.number().min(2, { message: "Max member must be at least 2" }),
    profileImage: z.any().optional().refine(
        (image) => !image || typeof image === "string" || allowedImageTypes.includes(image.type),
        "Only .jpeg, .jpg, and .png formats are supported"
    ).refine((image) => !image || typeof image === 'string' || image.size <= maxProfileImageSize,
        "Max image size is 2MB"
    ),
});

router.post('/',
    upload.single('profileImage'),
    validateBody(schemaValidation),
    async (req, res) => {
        try {
            const currentUserId = req.user.id;

            const data = req.validatedBody;
            const imageFile = data.getFile ? data.getFile('profileImage') : null;

            if (imageFile) {

                const ext = imageFile.filename.split('.').pop();
                const fileName = uuidv4() + '.' + ext;
                const targetFolder = path.join(STORAGE_PATH, 'rooms');

                if (!fs.existsSync(targetFolder)) {
                    fs.mkdirSync(targetFolder, { recursive: true });
                }

                fs.writeFileSync(path.join(targetFolder, fileName), imageFile.data);
                data.profileImage = '/uploads/rooms/' + fileName;
            }

            const result = await prismaClient.$transaction(async (prisma) => {
                const newRoom = await prisma.roomChat.create({
                    data: {
                        name: data.name,
                        description: data.description,
                        profileImage: data.profileImage || null,
                        maxMember: data.maxMember,
                        createdById: currentUserId,
                    }
                });

                await prisma.roomParticipants.create({
                    data: {
                        roomId: newRoom.id,
                        userId: currentUserId,
                        role: 'ADMIN',
                        status: 'ACTIVE'
                    },
                });
                return newRoom;
            });

            res.status(201).json(result);

        } catch (error) {
            console.error("Failed to create new room:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
);

router.get('/', async (req, res) => {
    try {
        const data = await prismaClient.roomChat.findMany({
            include: {
                _count: {
                    select: { participants: true }
                },
                createdBy: {
                    select: { id: true, name: true, username: true, profileImage: true }
                },
            }
        });
        res.json(data);
    } catch (error) {
        console.error("Failed to fetch data:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


router.delete('/:roomId', async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;
    try {
        const room = await prismaClient.roomChat.findUnique({
            where: { id: roomId }
        });

        if (!room) {
            return res.status(404).json({ message: "Room not found" });
        }

        if (room.createdById !== userId) {
            return res.status(403).json({ message: "You are not authorized to delete this room" });
        }

        const transactionResult = await prismaClient.$transaction(async (prisma) => {
            await prisma.roomParticipants.deleteMany({
                where: { roomId: roomId }
            });

            await prisma.chats.deleteMany({
                where: { roomId: roomId }
            });

            return await prisma.roomChat.delete({
                where: { id: roomId }
            });
        });

        res.status(200).json({ message: "Room deleted successfully" });
    } catch (error) {
        console.error("Failed to delete room:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/requests/:roomId', async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;
    try {
        const data = await prismaClient.roomParticipants.findMany({
            where: {
                status: 'PENDING',
                    roomChat: {
                        createdById: userId,
                        id: roomId
                    }
            },
            include: {
                user: {
                    select: { id: true, name: true, username: true, profileImage: true }
                },
            }
        });
        res.json(data);
    } catch (error) {
        console.error("Failed to fetch data:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.delete('/logout/:roomId', async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;
    try {
        const participant = await prismaClient.roomParticipants.findFirst({
            where: {
                roomId: roomId,
                userId: userId,
            },
            include : {
                roomChat : true
            }
        });

        if (!participant) {
            return res.status(404).json({ message: "You are not a member of this room" });
        }

        if(participant.roomChat.createdById === userId){
            return res.status(403).json({ message: "Room creator cannot leave the room. Consider deleting the room instead." });
        }

        await prismaClient.roomParticipants.delete({
            where: { id: participant.id }
        });
        res.status(200).json({ message: "Successfully left the room" });
    } catch (error) {
        console.error("Failed to leave room:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.delete('/rooms/remove-member/:participantId', async (req, res) => {
    const { participantId } = req.params;
    try {
        const participant = await prismaClient.roomParticipants.findUnique({
            where: { id: participantId },
            include: {
                roomChat: true,
            }
        });

        if (!participant) {
            return res.status(404).json({ message: "Participant not found" });
        }

        if(participant.roomChat.createdById !== req.user.id){
            return res.status(403).json({ message: "You are not authorized to remove this member" });
        }

        await prismaClient.roomParticipants.delete({
            where: { id: participantId }
        });
        res.status(200).json({ message: "Member removed successfully" });
    } catch (error) {
        console.error("Failed to remove member:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.put('/requests/approve/:requestId', async (req, res) => {
    const { requestId } = req.params;
    try {
        const request = await prismaClient.roomParticipants.findUnique({
            where: { id: requestId },
            include: {
                roomChat: true,
            }
        });

        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        if(request.roomChat.createdById !== req.user.id){
            return res.status(403).json({ message: "You are not authorized to approve this request" });
        }

        const updatedRequest = await prismaClient.roomParticipants.update({
            where: { id: requestId },
            data: {
                status: 'ACTIVE',
            }
        });
        res.status(200).json({ message: "Request approved successfully" });
    } catch (error) {
        console.error("Failed to approve request:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


router.get('/my-rooms', async (req, res) => {
    const userId = req.user.id;
    try {
        const participants = await prismaClient.roomParticipants.findMany({
            where: { 
                userId: userId,
                status: 'ACTIVE' 
            },
            include: {
                roomChat: true, 
            }
        });

        const roomsWithUnread = await Promise.all(participants.map(async (p) => {
            
            const unreadCount = await prismaClient.chats.count({
                where: {
                    roomId: p.roomId,
                    createdAt: {
                        gt: p.lastSeenAt 
                    }
                }
            });

            const lastMessage = await prismaClient.chats.findFirst({
                where: { roomId: p.roomId },
                orderBy: { createdAt: 'desc' },
                take: 1
            });

            return {
                ...p.roomChat,   
                unreadCount: unreadCount,
                lastMessage: lastMessage ? lastMessage.message : null,
                lastMessageTime: lastMessage ? lastMessage.createdAt : null
            };
        }));

        res.json(roomsWithUnread);

    } catch (error) {
        console.error("Failed to fetch my rooms:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


router.post('/join/:roomId', async (req, res) => {
    const { roomId } = req.params;

    const userId = req.user.id;

    try {
        const existingParticipant = await prismaClient.roomParticipants.findFirst({
            where: {
                roomId: roomId,
                userId: userId,
            }
        });

        if (existingParticipant) {
            return res.status(400).json({ message: "Request already sent or already joined" });
        }

        const newParticipant = await prismaClient.roomParticipants.create({
            data: {
                roomId: roomId,
                userId: userId,
                role: 'MEMBER',    
                status: 'PENDING'  
            }
        });
        res.status(201).json({ message: "Request sent", data: newParticipant });
    } catch (error) {
        console.error("Failed to join room:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
})

router.get('/detail/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id; // Definisikan di awal biar rapi

    try {
        const isMember = await prismaClient.roomParticipants.findFirst({
            where: {
                roomId: id,
                userId: userId,
                status: 'ACTIVE'
            }
        });

        if (!isMember) {
            return res.status(403).json({ message: "You are not a member of this room" });
        }


        const [updateResult, room] = await Promise.all([
            prismaClient.roomParticipants.updateMany({
                where: { roomId: id, userId: userId },
                data: { lastSeenAt: new Date() }
            }),
            prismaClient.roomChat.findUnique({
                where: { id: id },
                include: {
                    createdBy: {
                        select: { id: true, name: true, username: true }
                    },
                    participants: {
                        where: { status: 'ACTIVE' },
                        include: {
                            user: { select: { id: true, name: true, profileImage: true } }
                        }
                    },
                },
            })
        ]);

        if (room) {
            res.json(room);
        } else {
            res.status(404).json({ message: "Data not found" });
        }
    } catch (error) {
        console.error("Failed to fetch data:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

export default router;