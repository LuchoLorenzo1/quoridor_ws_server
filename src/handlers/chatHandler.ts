import redis from "../redisClient";
import { TSocket, TIo } from "../types";

export default function chatHandler(io: TIo, socket: TSocket) {
  const chatMessage = async (text: string) => {
    if (!text) return;

    if (socket.data.player != null) {
      const message = `${socket.data.user.name}:${text}`;
      redis.rPush(`game:chat:${socket.data.gameId}`, message);
      socket.broadcast.emit("chatMessage", message);
    } else {
      socket.broadcast
        .to("viewers")
        .emit("chatMessage", `${socket.data.user.name}:${text}`);
    }
  };

  socket.on("getChat", async () => {
    const chat = await redis.lRange(`game:chat:${socket.data.gameId}`, 0, -1);
    socket.emit("chat", chat);
  });

  socket.on("chatMessage", chatMessage);
}
