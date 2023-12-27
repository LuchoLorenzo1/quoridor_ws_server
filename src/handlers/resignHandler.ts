import { TSocket, TIo } from "../types";
import { deleteGame } from "../controllers/deleteGame";

export default function resignHandler(io: TIo, socket: TSocket) {
  const resign = async () => {
    await deleteGame(socket.data.gameId, socket.data.players);
    io.of(socket.nsp.name)
      .to(`game-${socket.data.gameId}`)
      .emit(
        "win",
        socket.data.players.indexOf(socket.data.user.id),
        "by resignation",
      );
  };

  socket.on("resign", resign);
}
