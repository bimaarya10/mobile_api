import express from 'express';

import { prismaClient } from '../src/prisma-client.js';
import z from 'zod';
import { comparePassword } from '../utils/hash-password.js';
import { validateBody } from '../utils/validate-body.js';

const router = express.Router();

const schemaValidation = z.object({
    name: z.coerce.string().refine((data) => data.length > 0, { message: "Field is required" }),
    username: z.coerce.string().refine((data) => data.length > 0, { message: "Field is required" }),
    email: z.coerce.string().email({ message: "Invalid email address" }).refine((data) => data.length > 0, { message: "Field is required" }),
})

const passwordValidation = z.object({
    oldPassword: z.coerce.string().min(8, { message: "Password must be at least 8 characters long" }).refine((data) => data.length > 0, { message: "Field is required" }),
    newPassword: z.coerce.string().min(8, { message: "Password must be at least 8 characters long" }).refine((data) => data.length > 0, { message: "Field is required" }),
})

router.get('/', async (req, res) => {
    try {
        const data = await prismaClient.users.findMany();
        res.json(data);
    } catch (error) {
        console.error("Failed to fetch data from database:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.put('/detail/:id', async (req, res) => {
    const { id } = req.params;
    validateBody(schemaValidation)
    try {
        const data = req.validatedBody
        const updatedUser = await prismaClient.users.update({
            where: { id: id },
            data: {
                name: data.name,
                username: data.username,
                email: data.email,
            }
        });
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Failed to update user:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.put('/change-password/:id', async (req, res) => {
    const { id } = req.params;
    const user = await prismaClient.users.findUnique({
        where: { id: id }
    });

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    validateBody(passwordValidation)
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
        res.status(200).json(updatedUser);
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
            include: {
                ownedRooms: true,
                roomParticipants: true,
                spotChecks: true
            },
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