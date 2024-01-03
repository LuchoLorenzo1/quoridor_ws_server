import redis from "../redisClient";
import { TSocket } from "../types";

const gameMiddleware = async (socket: TSocket, next: any) => {
  let res = socket.nsp.name.split("/");
  socket.data.gameId = res.at(-1) as string;

  let players = await redis.lRange(`game:players:${socket.data.gameId}`, 0, -1);
  if (!players) return next(new Error("This game is not being played"));

  let player: number | null = players.indexOf(socket.data.user.id);
  if (player < 0) {
    player = null;
    socket.join("viewer");
  } else {
    socket.join("player");
  }

  await redis.del(
    `game:disconnected:${socket.data.user.id}:${socket.data.gameId}`,
  );
  socket.broadcast.emit("playerConnected", socket.data.user.id);

  socket.data.player = player;
  socket.data.players = players;

  next();
};

export default gameMiddleware;
