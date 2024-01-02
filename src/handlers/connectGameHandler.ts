import createGame from "../controllers/createGame";
import redis from "../redisClient";
import { TIo, TSocket } from "../types";
import { v4 as uuidv4 } from "uuid";

export default async function connectGameHandler(io: TIo, socket: TSocket) {
  await redis.hIncrBy("stats", "online", 1);
  socket.on("disconnect", async () => {
    redis.hIncrBy("stats", "online", -1);
    cancelGameSearch();
  });

  const cancelGameSearch = async (time?: number | string) => {
    if (!time) {
      const playerSearching = (await redis.hGetAll(
        `searchingGame:playerId:${socket.data.user.id}`,
      )) as { gameId: string; time: string } | null;
      time = playerSearching?.time;
    }

    if (time) {
      await redis.del(`searchingGame:playerId:${socket.data.user.id}`);
      await redis.del(`playerSearchingId:${time}`);
    }
  };

  const searchGame = async (time: number) => {
    if (!time) return;

    const playerSearchingId = await redis.get(`playerSearchingId:${time}`);
    const playerSearching = (await redis.hGetAll(
      `searchingGame:playerId:${socket.data.user.id}`,
    )) as { gameId: string; time: string } | null;

    if (playerSearching && +playerSearching.time != time) {
      cancelGameSearch(+playerSearching.time);
    }

    let gameId;
    if (playerSearching) {
      const searchingGame = (await redis.hGetAll(
        `searchingGame:playerId:${playerSearchingId}`,
      )) as { gameId: string; time: string } | null;
      gameId = searchingGame?.gameId;
    }

    if (!playerSearchingId || !gameId) {
      await redis.set(`playerSearchingId:${time}`, socket.data.user.id, {
        EX: 60 * 30,
      });
      const gameId = uuidv4();
      await redis.hSet(`searchingGame:playerId:${socket.data.user.id}`, {
        gameId,
        time,
      });
      socket.join(`game-${gameId}`);
      return;
    }

    if (playerSearchingId === socket.data.user.id) return;

    await redis.del(`playerSearchingId:${time}`);
    await redis.del(`searchingGame:playerId:${playerSearchingId}`);

    socket.join(`game-${gameId}`);
    io.to(`game-${gameId}`).emit("foundGame", gameId);
    io.in(`game-${gameId}`).socketsLeave(["home", `game-${gameId}`]);

    await createGame(gameId, playerSearchingId, socket.data.user.id, time);
  };

  socket.on("home", async () => {
    socket.join("home");
    const stats = (await redis.hGetAll("stats")) as {
      playing: string;
      online: string;
    };
    if (stats) socket.emit("stats", stats);

    const gameId = await redis.get(`game:playerId:${socket.data.user.id}`);
    if (gameId) socket.emit("reconnectGame", gameId);
  });

  socket.on("searchGame", searchGame);
  socket.on("cancelSearchGame", cancelGameSearch);
}
