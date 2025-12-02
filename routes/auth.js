import express from 'express';

import { prismaClient } from '../src/prisma-client.js';
import { validateBody } from '../utils/validate-body.js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/manage-token.js';

const router = express.Router();

const schemaValidation = z.object({
    username : z.coerce.string().refine((data) => data.length > 0, { message: "Field is required" }),
    password : z.coerce.string().refine((data) => data.length > 0, { message: "Field is required" }),
})

const comparePassword = async (plainPassword, hashedPassword) => {
    return await bcrypt.compare(plainPassword, hashedPassword);
}

router.post('/', 
    validateBody(schemaValidation), 
    async (req, res) => {
    try {
        const data = req.validatedBody;
        const user = await prismaClient.users.findUnique({
            where: {username: data.username}
        })
        if(!user){
            return res.status(401).json({ message: "Invalid username or password" });
        }
        const isMatch = await comparePassword(data.password, user.password);
        if(!isMatch){
            return res.status(401).json({ message: "Invalid username or password" });
        }
        const token = generateToken({ id: user.id, email: user.email});
        res.json({
            message : "Login successful",
            user : {
                id : user.id,
                token : token
            }
        });
    } catch (error) {
        console.error("Failed to fetch data from database:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

export default router;