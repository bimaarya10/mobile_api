import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import env from 'dotenv';
import coffeeSpotRoutes from './routes/coffee-spot.js';
import registerRoutes from './routes/register.js';
import usersRoutes from './routes/users.js';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import chatRoutes from './routes/chats.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();
env.config();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Parsing request to JSON
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/register', registerRoutes);

// Middleware untuk autentikasi
app.use(authMiddleware);

io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.token;

    if (!token) {
        return next(new Error("Authentication error: No token provided"));
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return next(new Error("Authentication error: Invalid token"));
    }

    socket.user = decoded; 
    next();
});

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.user.email} (ID: ${socket.user.id})`);

    socket.on('join_room', (roomId) => {
        if(!roomId) return;
        socket.join(roomId);
        console.log(`User ${socket.user.id} joined room: ${roomId}`);
    });

    socket.on('send_message', async (data) => {
        try {
            const { roomId, message } = data;
            const senderId = socket.user.id; 

            if (!message || !roomId) return;

            const savedChat = await prismaClient.chats.create({
                data: {
                    message: message,
                    roomId: roomId,
                    senderId: senderId
                },
                include: {
                    sender: {
                        select: { id: true, name: true, username: true, profileImage: true }
                    }
                }
            });

            io.to(roomId).emit('receive_message', savedChat);
            
            console.log(`Chat di room ${roomId}: ${message}`);

        } catch (error) {
            console.error("Socket Error:", error);
        }
    });

    socket.on('disconnect', () => {
        console.log('User Disconnected:', socket.id);
    });
});

app.use('/coffee-spot', coffeeSpotRoutes);
app.use('/users', usersRoutes)
app.use('/rooms', roomRoutes);
app.use('/chats', chatRoutes);

const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
const port = 3000;

server.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});