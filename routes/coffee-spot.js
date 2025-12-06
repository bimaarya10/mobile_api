import express from 'express';
import z from 'zod';
import { prismaClient } from '../src/prisma-client.js';
import { validateBody } from '../utils/validate-body.js';

const router = express.Router();



const schemaValidation = z.object({
    spotId: z.coerce.string().refine((data) => data.length > 0, { message: "Field is required" }),
    userId: z.coerce.string().refine((data) => data.length > 0, { message: "Field is required" }),
    lastVisit: z.coerce.date().optional(),
    visitCount: z.coerce.number().min(1).optional(),
})

const updateFavValidation = z.object({
    lastVisit: z.coerce.date(),
    visitCount: z.coerce.number().min(1),
})


router.get('/', async (req, res) => {
    try {
        const data = await prismaClient.coffeeSpot.findMany();
        res.json(data);
    } catch (error) {
        console.error("Failed to fetch data from database:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/favorite/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const data = await prismaClient.spotCheck.findMany({
            where: {
                userId : id
            },
            include: {
                spot: true,
            }
        });
        res.json(data);
    } catch (error) {
        console.error("Failed to fetch data from database:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
})

router.delete('/favorite/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const data = await prismaClient.spotCheck.delete({
            where: {
                id : id
            }
        });
        res.status(200).json({ message: "Data removed successfully" });
    } catch (error) {
        console.error("Failed to fetch data from database:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
})

router.post('/favorite', validateBody(schemaValidation), async (req, res) => {
    const data = req.validatedBody;
    try {
        const newSpot = await prismaClient.spotCheck.create({
            data: {
                spotId: data.spotId,
                userId: data.userId
            }
        });
        res.status(201).json(newSpot);
    } catch (error) {
        console.error("Failed to create coffee spot:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.put('/favorite/:id', validateBody(updateFavValidation), async (req, res) => {
    const { id } = req.params;
    const data = req.validatedBody;
    try {
        const updatedSpot = await prismaClient.spotCheck.update({
            where: {
                id : id
            },
            data: {
                lastVisit: data.lastVisit,
                visitCount: data.visitCount
            }
        });
        res.status(200).json(updatedSpot);
    } catch (error) {
        console.error("Failed to update coffee spot:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const spot = await prismaClient.coffeeSpot.findUnique({
            where: { id: id },
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