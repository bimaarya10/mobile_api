import express from 'express';
import { prismaClient } from '../src/prisma-client.js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { validateBody } from '../utils/validate-body.js';
import path from 'path';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();
const upload = multer({
    limits: { fileSize: 5 * 1024 * 1024 }
});

const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png"];
const maxProfileImageSize = 2 * 1024 * 1024;

const schemaValidation = z.object({
    name: z.coerce.string().refine((data) => data.length > 0, { message: "Field is required" }),
    username: z.coerce.string().refine((data) => data.length > 0, { message: "Field is required" }),
    email: z.coerce.string().email({ message: "Invalid email address" }).refine((data) => data.length > 0, { message: "Field is required" }),
    password: z.coerce.string().min(8, { message: "Password must be at least 8 characters long" }).refine((data) => data.length > 0, { message: "Field is required" }),
    profileImage: z.any().optional().refine(
        (image) => !image || typeof image === "string" || allowedImageTypes.includes(image.type),
        "Only .jpeg, .jpg, and .png formats are supported"
    ).refine((image) => !image || typeof image === 'string' || image.size <= maxProfileImageSize,
        "Max image size is 2MB"
    ),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_PATH = path.join(__dirname, '../public/uploads');

const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

router.post('/',
    upload.single('profileImage'),
    validateBody(schemaValidation),
    async (req, res) => {
        try {
            const data = req.validatedBody
            const imageFile = data.getFile ? data.getFile('profileImage') : null;

            if (imageFile) {
                const ext = imageFile.filename.split('.').pop();
                const fileName = uuidv4() + '.' + ext;
                const targetFolder = path.join(STORAGE_PATH, 'profiles');

                if (!fs.existsSync(targetFolder)) {
                    fs.mkdirSync(targetFolder, { recursive: true });
                }

                fs.writeFileSync(path.join(targetFolder, fileName), imageFile.data);
                data.profileImage = '/uploads/profiles/' + fileName;
            }
            data.password = await hashPassword(data.password);

            const newUser = await prismaClient.users.create({
                data : {
                    name: data.name,
                    email: data.email,
                    username: data.username,
                    password: data.password,
                    profileImage: data.profileImage || null,
                }
            })
            res.status(201).json(newUser);
        }catch(error){
            console.error("Failed to register user:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
)

export default router;