import redis from "../redisClient";
import { TSocket, TIo } from "../types";

export default function chatHandler(io: TIo, socket: TSocket) {
  const chatMessage = async (text: string) => {
    if (!text) return;
    const message = `${socket.data.player} ${text}`;

    redis.lPush(`game:chat:${socket.data.gameId}`, message);
    socket.broadcast
      .to(`game-${socket.data.gameId}`)
      .emit("chatMessage", message);
  };

  socket.on("getChat", async () => {
    const chat = await redis.lRange(`game:chat:${socket.data.gameId}`, 0, -1);
    socket.emit("chat", chat);
  });

  socket.on("chatMessage", chatMessage);
}
