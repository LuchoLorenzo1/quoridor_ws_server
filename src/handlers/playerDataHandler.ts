import redis from "../redisClient";
import { TSocket } from "../types";

const PlayerDataHandler = (socket: TSocket) => {
  socket.on("playerData", async (playerId: string) => {
    const gameId = await redis.get(`game:playerId:${playerId}`);
    const online = await redis.sIsMember("players:online", playerId);
    if (gameId) {
      const players = await redis.lRange(`game:players:${gameId}`, 0, -1);
      socket.emit("playerData", {
        gameId,
        online,
        opponentId: players[0] === playerId ? players[1] : players[0],
      });
      return;
    }
    socket.emit("playerData", { online });
  });
};

export default PlayerDataHandler;
