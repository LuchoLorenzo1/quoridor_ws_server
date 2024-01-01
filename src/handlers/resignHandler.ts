import { TSocket, TIo } from "../types";
import { deleteGame } from "../controllers/deleteGame";
import { saveGame } from "../controllers/saveGame";
import redis from "../redisClient";

export default function resignHandler(io: TIo, socket: TSocket) {
  const resign = async () => {
    io.of(socket.nsp.name).emit(
      "win",
      socket.data.player == 0 ? 1 : 0,
      "by resignation",
    );
    await saveGame(
      socket.data.gameId,
      socket.data.players,
      socket.data.player == 0 ? 1 : 0,
      "resignation",
    );
  };

  const abort = async () => {
    const history = await redis.lRange(
      `game:history:${socket.data.gameId}`,
      0,
      -1,
    );
    if (
      (socket.data.player == 0 && history.length == 0) ||
      (socket.data.player == 1 && history.length <= 1)
    ) {
      console.log(socket.nsp.name, "aborting game", socket.data.gameId);
      io.of(socket.nsp.name).emit("abortGame");
      await deleteGame(socket.data.gameId, socket.data.players);
    }
  };

  socket.on("resign", resign);
  socket.on("abort", abort);
}
