import express from 'express';
import env from 'dotenv';
import umkmRoutes from './routes/umkm.js';

const app = express();
env.config();
app.use(express.json());


app.use('/umkm', umkmRoutes);

const port = 3000;

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});