import { Server } from 'socket.io';

let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*', // Adjust this for production security
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Clients can join rooms (e.g., an order room 'order_123' or 'store_456')
    socket.on('join', (room) => {
      socket.join(room);
    });

    socket.on('leave', (room) => {
      socket.leave(room);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}

/**
 * Fire-and-forget broadcast. A live-update push is never worth failing the request that
 * triggered it — before this, an order status change would 500 if socket.io wasn't
 * initialized (which is also what made the API untestable without a real HTTP server).
 */
export function emit(event, payload) {
  if (!io) return;
  io.emit(event, payload);
}
