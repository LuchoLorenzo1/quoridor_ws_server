import redis from "../redisClient";
import { TSocket } from "../types";

const gameMiddleware = async (socket: TSocket, next: any) => {
  let res = socket.nsp.name.split("/");
  socket.data.gameId = res.at(-1) as string;

  let players = await redis.lRange(`game:players:${socket.data.gameId}`, 0, -1);
  if (!players) return next(new Error("This game is not being played"));

  let player = players.indexOf(socket.data.user.id);
  if (player < 0) return next(new Error("This user is not playing this game"));

  socket.data.player = player;
  socket.data.players = players;

  console.log("pasa el middleware", socket.data.user.id);

  next();
};

export default gameMiddleware;