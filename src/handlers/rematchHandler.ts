import createGame from "../controllers/createGame";
import redis from "../redisClient";
import { TIo, TSocket } from "../types";
import { v4 as uuidv4 } from "uuid";

export default async function rematchHandler(io: TIo, socket: TSocket) {
  const rematch = async () => {
    const playerId = await redis.get(
      `matchmaking:rematch:${socket.data.gameId}`,
    );
    if (!playerId) {
      await redis.set(
        `matchmaking:rematch:${socket.data.gameId}`,
        socket.data.user.id,
        { EX: 60 * 15 },
      );
      io.of(socket.nsp.name).emit("rematch", socket.data.user.id);
      return;
    } else if (socket.data.user.id === playerId) {
      await redis.del(`matchmaking:rematch:${socket.data.gameId}`);
      io.of(socket.nsp.name).emit("rematch", "");
      return;
    }

    if (!socket.data.players.includes(playerId)) return;

    const time = await redis.get(`game:game_time:${socket.data.gameId}`);
    if (!time || !+time) {
      console.log("no time");
      return;
    }

    await redis.del(`matchmaking:rematch:${socket.data.gameId}`);

    const gameId = uuidv4();
    console.log(
      "eL que acepta el rematch esta jugando como:",
      socket.data.player,
      socket.data.player == 1,
      socket.data.user.id,
    );
    createGame(
      gameId,
      socket.data.user.id,
      playerId,
      +time,
      socket.data.player == 1,
    );

    io.of(socket.nsp.name).emit("rematchGame", gameId);
  };

  const rejectRematch = async () => {
    await redis.del(`matchmaking:rematch:${socket.data.gameId}`);
    io.of(socket.nsp.name).emit("rematch", "");
  };

  socket.on("rematch", rematch);
  socket.on("rejectRematch", rejectRematch);
}
