import express from 'express';

import { prismaClient } from '../src/prisma-client.js';
import { validateBody } from '../utils/validate-body.js';

const router = express.Router();

const upload = multer({
    limits: { fileSize: 5 * 1024 * 1024 }
});

const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png"];
const maxProfileImageSize = 2 * 1024 * 1024;

const schemaValidation = z.object({
    name: z.coerce.string().refine((data) => data.length > 0, { message: "Field is required" }),
    description: z.coerce.string().refine((data) => data.length > 0, { message: "Field is required" }),
    profileImage: z.any().optional().refine(
        (image) => !image || typeof image === "string" || allowedImageTypes.includes(image.type),
        "Only .jpeg, .jpg, and .png formats are supported"
    ).refine((image) => !image || typeof image === 'string' || image.size <= maxProfileImageSize,
        "Max image size is 2MB"
    ),
    createdById: z.coerce.string().refine((data) => data.length > 0, { message: "Field is required" }),
    maxMember: z.coerce.number().min(2, { message: "Max member must be at least 2" }).refine((data) => data > 0, { message: "Field is required" }),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_PATH = path.join(__dirname, '../public/uploads');

router.post('/', async (req, res) => {
    const { name, description, createdById } = req.body;
    upload.single('profileImage')
    validateBody(schemaValidation);
    try {
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
                    name,
                    description,
                    createdById,
                    maxMember
                },
            });

            const newParticipant = await prisma.roomParticipants.create({
                data: {
                    roomId: newRoom.id,
                    userId: createdById,
                },
            });
            return newRoom;

        });

        res.status(201).json(result);
    } catch (error) {
        console.error("Failed to create new room:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/', async (req, res) => {
    try {
        const data = await prismaClient.rooms.findMany({
            include : {
                _count: {
                    select: { participants: true}
                },
                createdBy: true,
            }
        });
        res.json(data);
    } catch (error) {
        console.error("Failed to fetch data from database:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/my-rooms/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const data = await prismaClient.roomParticipants.findMany({
            where: { userId: userId },
            include: {
                roomChats: true,
            }
        });
        const rooms = data.map(participation => participation.roomChats);
        res.json(rooms);
    } catch (error) {
        console.error("Failed to fetch data from database:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/detail/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const room = await prismaClient.rooms.findUnique({
            where: { id: id },
            include: {
                createdBy: true,
                participants: true,
            },
        });
        if (room) {
            res.json(room);
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