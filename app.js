import express from 'express';
import env from 'dotenv';
import coffeeSpotRoutes from './routes/coffee-spot.js';
import feedsRoutes from './routes/feeds.js';
import registerRoutes from './routes/register.js';
import usersRoutes from './routes/users.js';
import authRoutes from './routes/auth.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();
env.config();
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/register', registerRoutes);

// Middleware untuk autentikasi
app.use(authMiddleware);
app.use('/feeds', feedsRoutes);
app.use('/coffee-spot', coffeeSpotRoutes);
app.use('/users', usersRoutes)

const port = 3000;

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});