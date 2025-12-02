import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET; 

export const generateToken = (payload) => {
    return jwt.sign(payload, SECRET, { expiresIn: '30d' });
};

export const verifyToken = (token) => {
    try {
        return jwt.verify(token, SECRET);
    } catch (error) {
        return null;
    }
};