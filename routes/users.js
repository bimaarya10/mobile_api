import express from 'express';
import { prismaClient } from '../src/prisma-client.js';
import z from 'zod';
import { comparePassword, hashPassword } from '../utils/hash-password.js';
import { validateBody } from '../utils/validate-body.js';
import multer from 'multer';
import { fileURLToPath } from 'url';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const router = express.Router();

const upload = multer({
    limits: { fileSize: 5 * 1024 * 1024 }
});

const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png"];
const maxProfileImageSize = 2 * 1024 * 1024;

const schemaValidation = (req) => z.object({
    name: z.coerce.string().refine((data) => data.length > 0, { message: "Field is required" }),
    username: z.coerce.string().refine((data) => data.length > 0, { message: "Field is required" }).refine(async (data) => await prismaClient.users.findUnique({ where: { username: data, NOT: { id: req.params.id } } }).then(user => !user), { message: "Username already taken" }),
    email: z.coerce.string().email({ message: "Invalid email address" }).refine((data) => data.length > 0, { message: "Field is required" }).refine(async (data) => await prismaClient.users.findUnique({ where: { email: data, NOT: { id: req.params.id } } }).then(user => !user), { message: "Email already registered" }),
    region: z.coerce.string().optional(),
    sex: z.coerce.string().optional(),
    profileImage: z.any().optional().refine(
        (image) => !image || typeof image === "string" || allowedImageTypes.includes(image.type),
        "Only .jpeg, .jpg, and .png formats are supported"
    ).refine((image) => !image || typeof image === 'string' || image.size <= maxProfileImageSize,
        "Max image size is 2MB"
    ),
})

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_PATH = path.join(__dirname, '../public/uploads');

const passwordValidation = z.object({
    oldPassword: z.coerce.string().min(8, { message: "Password must be at least 8 characters long" }).refine((data) => data.length > 0, { message: "Field is required" }),
    newPassword: z.coerce.string().min(8, { message: "Password must be at least 8 characters long" }).refine((data) => data.length > 0, { message: "Field is required" }),
})

router.get('/', async (req, res) => {
    try {
        const data = await prismaClient.users.findMany({
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                profileImage: true,
                region: true,
                sex: true,
            }
        });
        res.json(data);
    } catch (error) {
        console.error("Failed to fetch data from database:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.put('/detail/:id', upload.single('profileImage'), validateBody(schemaValidation), async (req, res) => {
    const { id } = req.params;
    try {
        const data = req.validatedBody

        const imageFile = data.getFile ? data.getFile('profileImage') : null;
        
        if (imageFile) {

            const currentUser = await prismaClient.users.findUnique({
                where: { id: id },
                select: { id: true, profileImage: true }
            });

            if(currentUser && currentUser.profileImage){
                const oldPath = path.join(__dirname, '../public', currentUser.profileImage);

                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }

            const ext = imageFile.filename.split('.').pop();
            const fileName = uuidv4() + '.' + ext;
            const targetFolder = path.join(STORAGE_PATH, 'profiles');

            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder, { recursive: true });
            }
            fs.writeFileSync(path.join(targetFolder, fileName), imageFile.data);
            data.profileImage = '/uploads/profiles/' + fileName;
        }

        const updatedUser = await prismaClient.users.update({
            where: { id: id },
            data: {
                name: data.name,
                username: data.username,
                email: data.email,
                region: data.region,
                sex: data.sex,
                profileImage: data.profileImage || undefined,
            }
        });
        res.status(200).json({message: "User updated successfully"});
    } catch (error) {
        console.error("Failed to update user:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.put('/change-password/:id',
    validateBody(passwordValidation), async (req, res) => {
    const { id } = req.params;
    const user = await prismaClient.users.findUnique({
        where: { id: id }
    });

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    try {
        const { oldPassword, newPassword } = req.validatedBody;

        if (await comparePassword(oldPassword, user.password) === false) {
            return res.status(401).json({ message: "Your password is incorrect" });
        }

        const updatedUser = await prismaClient.users.update({
            where: { id: id },
            data: {
                password: await hashPassword(newPassword),
            }
        });
        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("Failed to update user password:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/detail/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const spot = await prismaClient.users.findUnique({
            where: { id: id },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                profileImage: true,
                region: true,
                sex: true,
                ownedRooms: true,
                rooms: true,
                spotChecks: true
            }
        });
        if (spot) {
            res.json(spot);
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