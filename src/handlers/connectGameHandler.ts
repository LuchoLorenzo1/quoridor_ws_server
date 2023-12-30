import { INITIAL_WALLS, SECONDS } from "../constants";
import redis from "../redisClient";
import { TIo, TSocket } from "../types";
import { v4 as uuidv4 } from "uuid";

export default function connectGameHandler(io: TIo, socket: TSocket) {
  const searchGame = async () => {
    const playerSearchingId = await redis.get("playerSearchingId");
    const gameId = playerSearchingId
      ? await redis.get(`game:playerId:${playerSearchingId}`)
      : null;

    if (!playerSearchingId || !gameId) {
      await redis.set("playerSearchingId", socket.data.user.id, {
        EX: 60 * 30,
      });
      const gameId = uuidv4();
      await redis.set(`game:playerId:${socket.data.user.id}`, gameId, {
        EX: 60 * 30,
      });
      socket.join(`game-${gameId}`);
      return;
    }

    await redis.del("playerSearchingId");

    socket.join(`game-${gameId}`);
    io.to(`game-${gameId}`).emit("foundGame", gameId);

    let players;
    if (Math.random() < 0.5) {
      players = [socket.data.user.id, playerSearchingId];
    } else {
      players = [playerSearchingId, socket.data.user.id];
    }

    await redis
      .multi()
      .set(`game:playerId:${socket.data.user.id}`, gameId, { EX: 60 * 30 }) // 30 minutos expire
      .set(`game:playerId:${playerSearchingId}`, gameId, {
        EX: 60 * 30,
      })
      .lPush(`game:players:${gameId}`, players)
      .set(`game:turn:${gameId}`, 0)
      .set(`game:game_time:${gameId}`, SECONDS)
      .set(`game:black_time_left:${gameId}`, SECONDS)
      .set(`game:white_time_left:${gameId}`, SECONDS)
      .hSet(`game:walls_left:${gameId}`, {
        black: INITIAL_WALLS,
        white: INITIAL_WALLS,
      })
      .exec();
  };

  socket.on("reconnectGame", async () => {
    const gameId = await redis.get(`game:playerId:${socket.data.user.id}`);
    if (gameId) {
      socket.emit("reconnectGame", gameId);
    }
  });

  socket.on("searchGame", searchGame);
}
