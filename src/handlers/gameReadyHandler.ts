import { ABORT_SECONDS, SECONDS } from "../constants";
import redis from "../redisClient";
import { TIo, TSocket } from "../types";
import { deleteGame } from "../utils";

export default function gameReadyHandler (io: TIo, socket: TSocket, TimeoutsMap: Map<string, NodeJS.Timeout>) {
	const ready = async () => {
		const gameId = await redis.get(`game:playerId:${socket.data.user.id}`);
		if (!gameId) return null;

		let players = await redis.lRange(`game:players:${gameId}`, 0, -1);
		if (!players) return null;

		let i = players.indexOf(socket.data.user.id);
		if (i < 0) return;

		const ready = await redis.get(`game:playersReady:${gameId}`);
		let history = await redis.lRange(`game:history:${gameId}`, 0, -1);
		let turn = await redis.get(`game:turn:${gameId}`);
		if (turn == null) return null;

		socket.join(`game-${gameId}`);

		if (!ready || +ready <= 1) {
			socket.emit("gameState", history, -1, i, SECONDS, SECONDS);
			if (!ready || +ready == 0) {
				await redis.set(`game:playersReady:${gameId}`, 1);
				return
			}

			await redis.set(`game:playersReady:${gameId}`, 2);
			await redis
				.multi()
				.set(`game:black_time_left:${gameId}`, SECONDS)
				.set(`game:white_time_left:${gameId}`, SECONDS)
				.set(`game:game_started_date:${gameId}`,(new Date()).getTime())
				.exec();

			io.of("/game").to(`game-${gameId}`).emit("start");

			let t = setTimeout(async () => {
				let s = await redis.get(`game:white_last_move:${gameId}`);
				if (s == null) {
					await deleteGame(gameId, players);
					console.log("ABORTING GAME")
					io.of("/game").to(`game-${gameId}`).emit("abortGame");
				}
			}, ABORT_SECONDS * 1000);
			TimeoutsMap.set(gameId, t);
			return
		}

		let [blackTimeLeft, whiteTimeLeft, whiteLastMove, blackLastMove, gameStartedDate] = await redis
			.multi()
			.get(`game:black_time_left:${gameId}`)
			.get(`game:white_time_left:${gameId}`)
			.get(`game:white_last_move:${gameId}`)
			.get(`game:black_last_move:${gameId}`)
			.get(`game:game_started_date:${gameId}`)
			.exec();

		let now = (new Date()).getTime()
		if (+turn == 0) {
			let m = +(blackLastMove || 0)
			if (!blackLastMove)
				m = +(gameStartedDate || 0)
			whiteTimeLeft = +(whiteTimeLeft || SECONDS) - ((now - m)/1000)
		} else if (whiteLastMove) {
			blackTimeLeft = +(blackTimeLeft || SECONDS) - ((now - +whiteLastMove)/1000)
		}

		if (!blackTimeLeft || !whiteTimeLeft) return
		socket.emit("gameState", history, +turn, i, +whiteTimeLeft, +blackTimeLeft);
	}

	socket.on("ready", ready)
}
