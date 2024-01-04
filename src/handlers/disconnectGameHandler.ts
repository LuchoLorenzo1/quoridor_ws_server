import redis from "../redisClient";
import { DISCONNECT_SECONDS } from "../constants";
import { saveGame } from "../controllers/saveGame";
import { TIo, TSocket } from "../types";

const disconnectGameHandler = (io: TIo, socket: TSocket) => {
  socket.on("disconnect", async () => {
    const gameState = await redis.get(`game:state:${socket.data.gameId}`);

    if (gameState != "playing") {
      await redis.del(`matchmaking:rematch:${socket.data.gameId}`);
      io.of(socket.nsp.name).emit("rematch", "");
      if (socket.data.player)
        io.of(socket.nsp.name).emit("leftChat", socket.data.player);
      return;
    }

    socket.broadcast.emit("playerDisconnected", socket.data.user.id);

    const now = Date.now();
    const playerId = socket.data.user.id;
    const player = socket.data.player == 0 ? 1 : 0;
    const gameId = socket.data.gameId;
    await redis.set(`game:disconnected:${playerId}:${gameId}`, now, {
      EX: DISCONNECT_SECONDS + 20,
    });

    setTimeout(async () => {
      const timestamp = await redis.get(
        `game:disconnected:${playerId}:${gameId}`,
      );
      const gameState = await redis.get(`game:state:${gameId}`);

      if (gameState != "playing") return;
      if (timestamp != null && +timestamp == now) {
        io.of(socket.nsp.name).emit("win", player, "by disconnection");
        await saveGame(gameId, socket.data.players, 1, "resignation");
      }
    }, DISCONNECT_SECONDS * 1000);
  });
};

export default disconnectGameHandler;
