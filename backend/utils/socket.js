const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

const initSocket = (server) => {
    if (io) return io;
    io = new Server(server, {
        cors: {
            origin: true,
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    // JWT Authentication middleware for Socket.IO
    io.use(async (socket, next) => {
        // Accept token from handshake auth or query param
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) {
            console.log('[Socket.IO] Connection rejected: No token provided');
            return next(new Error('Authentication error: No token provided'));
        }
        try {
            const BlacklistedToken = require('../models/BlacklistedToken');
            const isBlacklisted = await BlacklistedToken.findOne({ token });
            if (isBlacklisted) {
                console.log('[Socket.IO] Connection rejected: Token is blacklisted');
                return next(new Error('Authentication error: Token revoked'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            
            const User = require('../models/User');
            const user = await User.findByPk(decoded.id);
            
            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }
            if (user.isSuspended) {
                return next(new Error('Authentication error: Account suspended'));
            }
            
            socket.userId = decoded.id;
            socket.userRole = user.role;
            return next();
        } catch (err) {
            console.log('[Socket.IO] Connection rejected: Invalid token', err.message);
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        if (socket.userId) {
            console.log(`[Socket.IO] Authenticated client connected: ${socket.id} (user: ${socket.userId})`);
            // Join a user-specific room for targeted events
            socket.join(`user:${socket.userId}`);
        } else {
            console.log(`[Socket.IO] Public client connected: ${socket.id}`);
        }
        socket.on('disconnect', () => {
            console.log('[Socket.IO] Client disconnected:', socket.id);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io has not been initialized yet');
    }
    return io;
};

module.exports = { initSocket, getIO };