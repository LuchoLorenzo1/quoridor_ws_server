import { TSocket, TIo } from "../types";
import { deleteGame } from "../controllers/deleteGame";
import { saveGame } from "../controllers/saveGame";

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

  socket.on("resign", resign);
}
