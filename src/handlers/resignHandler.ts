import redis from "../redisClient";
import { TSocket, TIo } from "../types";
import { deleteGame } from "../utils";

export default function resignHandler(io: TIo, socket: TSocket) {
	const resign = async () => {
		const gameId = await redis.get(`game:playerId:${socket.data.user.id}`);
		if (!gameId) return;

		let players = await redis.lRange(`game:players:${gameId}`, 0, -1);
		if (!players) return null;
		let i = players.indexOf(socket.data.user.id);
		if (i < 0) return;

		await deleteGame(gameId, players);
		io.of("/game")
			.to(`game-${gameId}`)
			.emit("win", players.indexOf(socket.data.user.id), "by resignation");
	};

	socket.on("resign", resign)
}
