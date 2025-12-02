import express from 'express';

import { prismaClient } from '../src/prisma-client.js';

const router = express.Router();


router.get('/', async (req, res) => {
    try {
        const data = await prismaClient.users.findMany();
        res.json(data);
    } catch (error) {
        console.error("Failed to fetch data from database:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const spot = await prismaClient.users.findUnique({
            where: { id: id },
            include: {
                feeds: true,
                spotChecks : true
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