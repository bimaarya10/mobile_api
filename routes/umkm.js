import express from 'express';

import { prismaClient } from '../src/prisma-client.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const data = await prismaClient.umkm.findMany();
        res.json(data);
    } catch (error) {
        console.error("Gagal mengambil data dari database:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const deletedUmkm = await prismaClient.umkm.delete({
            where: { id: parseInt(id) },
        });
        res.json(deletedUmkm);
    } catch (error) {
        console.error("Gagal menghapus data dari database:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const updatedData = req.body;
    try {
        const updatedUmkm = await prismaClient.umkm.update({
            where: { id: parseInt(id) },
            data: updatedData,
        });
        res.json(updatedUmkm);
    } catch (error) {
        console.error("Gagal memperbarui data di database:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
});

router.post('/', async (req, res) => {
    const dataUmkm = req.body;
    try {
        const newUmkm = await prismaClient.umkm.create({
            data: dataUmkm
        }
        );
        res.status(201).json(newUmkm);
    } catch (error) {
        console.error("Gagal menambahkan data ke database:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
})

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const umkm = await prismaClient.umkm.findUnique({
            where: { id: parseInt(id) },
        });
        if (umkm) {
            res.json(umkm);
        } else {
            res.status(404).json({ message: "UMKM tidak ditemukan" });
        }
    } catch (error) {
        console.error("Gagal mengambil data dari database:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
}
);

export default router;