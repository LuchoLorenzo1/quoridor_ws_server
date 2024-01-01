import { INITIAL_WALLS } from "../constants";
import redis from "../redisClient";
import { TIo, TSocket } from "../types";
import { v4 as uuidv4 } from "uuid";

export default async function connectGameHandler(io: TIo, socket: TSocket) {
  await redis.hIncrBy("stats", "online", 1);
  console.log("incrementando");
  socket.on("disconnect", () => {
    console.log("decrementando");
    redis.hIncrBy("stats", "online", -1);
  });

  const cancelGameSearch = async (time: number) => {
    await redis.del(`playerSearchingId:${time}`);
    await redis.del(`searchingGame:playerId:${socket.data.user.id}`);
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
      .set(`game:game_time:${gameId}`, time)
      .set(`game:black_time_left:${gameId}`, time)
      .set(`game:white_time_left:${gameId}`, time)
      .hSet(`game:walls_left:${gameId}`, {
        black: INITIAL_WALLS,
        white: INITIAL_WALLS,
      })
      .hIncrBy("stats", "playing", 2)
      .exec();
  };

  socket.on("home", async () => {
    socket.join("home");
    const stats = (await redis.hGetAll("stats")) as { playing: string };
    if (stats) socket.emit("stats", stats);

    const gameId = await redis.get(`game:playerId:${socket.data.user.id}`);
    if (gameId) socket.emit("reconnectGame", gameId);
  });

  socket.on("searchGame", searchGame);
  socket.on("cancelSearchGame", cancelGameSearch);
}
