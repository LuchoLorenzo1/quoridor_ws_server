import createGame from "../controllers/createGame";
import { getRatingByUserId } from "../controllers/ratings";
import { saveGame } from "../controllers/saveGame";
import redis from "../redisClient";
import { TIo, TSocket } from "../types";
import { v4 as uuidv4 } from "uuid";

export default async function connectGameHandler(io: TIo, socket: TSocket) {
  await redis.sAdd("players:online", socket.data.user.id);
  socket.on("disconnect", async () => {
    await redis.sRem("players:online", socket.data.user.id);
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

    const playingGameId = await redis.get(
      `game:playerId:${socket.data.user.id}`,
    );
    if (playingGameId != null) {
      const gameState = await redis.get(`game:state:${playingGameId}`);
      if (gameState != "playing") {
        await redis.del(`game:playerId:${socket.data.user.id}`);
      } else {
        const players = await redis.lRange(
          `game:players:${playingGameId}`,
          0,
          -1,
        );
        if (players != null) {
          const winner = players[0] == socket.data.user.id ? 1 : 0;
          console.log("winner", winner);
          io.of(`/game/${playingGameId}`).emit("win", winner, "by resignation");
          saveGame(playingGameId, players, winner, "resignation");
        }
      }
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

    const ratingUser = await getRatingByUserId(socket.data.user.id);
    const ratingPlayerSearching = await getRatingByUserId(playerSearchingId);
    if (!ratingUser || !ratingPlayerSearching) return;

    const player1 = {
      id: socket.data.user.id,
      rating: ratingUser.rating,
      rd: ratingUser.rating_deviation,
      vol: ratingUser.volatility,
    };

    const player2 = {
      id: playerSearchingId,
      rating: ratingPlayerSearching.rating,
      rd: ratingPlayerSearching.rating_deviation,
      vol: ratingPlayerSearching.volatility,
    };

    socket.join(`game-${gameId}`);
    io.to(`game-${gameId}`).emit("foundGame", gameId);
    io.in(`game-${gameId}`).socketsLeave(["home", `game-${gameId}`]);

    await createGame(gameId, player1, player2, time);
  };

  socket.on("home", async () => {
    socket.join("home");
    const gameId = await redis.get(`game:playerId:${socket.data.user.id}`);
    if (gameId) socket.emit("reconnectGame", gameId);
  });

  socket.on("searchGame", searchGame);
  socket.on("cancelSearchGame", cancelGameSearch);
}
