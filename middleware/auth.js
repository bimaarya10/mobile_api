import { verifyToken } from '../utils/manage-token.js'; // Sesuaikan path import

export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized: Invalid token format (Must be 'Bearer <token>')" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
    }

    req.user = decoded; 
    
    next();
};