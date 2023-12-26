import { ABORT_SECONDS, SECONDS } from "../constants";
import redis from "../redisClient";
import { TIo, TSocket } from "../types";
import { deleteGame } from "../utils";

export default function gameReadyHandler (io: TIo, socket: TSocket, TimeoutsMap: Map<string, NodeJS.Timeout>) {
	const getGame = async () => {
		console.log("GET GAME")
		const gameId = await redis.get(`game:playerId:${socket.data.user.id}`);
		if (!gameId) return null;

		let players = await redis.lRange(`game:players:${gameId}`, 0, -1);
		if (!players) return null;

		let i = players.indexOf(socket.data.user.id);
		if (i < 0) return;

		let [history, turn, blackTimeLeft, whiteTimeLeft, whiteLastMove, blackLastMove, gameStartedDate] = await redis
			.multi()
			.lRange(`game:history:${gameId}`, 0, -1)
			.get(`game:turn:${gameId}`)
			.get(`game:black_time_left:${gameId}`)
			.get(`game:white_time_left:${gameId}`)
			.get(`game:white_last_move:${gameId}`)
			.get(`game:black_last_move:${gameId}`)
			.get(`game:game_started_date:${gameId}`)
			.exec();

		let now = Date.now()
		if (turn && +turn == 0) {
			if (blackLastMove) {
				whiteTimeLeft = +(whiteTimeLeft || SECONDS) - ((now - +blackLastMove)/1000)
			} else if (gameStartedDate) {
				whiteTimeLeft = +(whiteTimeLeft || SECONDS) - ((now - +gameStartedDate)/1000)
			}
		} else if (turn && +turn == 1 && whiteLastMove) {
			blackTimeLeft = +(blackTimeLeft || SECONDS) - ((now - +whiteLastMove)/1000)
		} else {
			blackTimeLeft = SECONDS
			whiteTimeLeft = SECONDS
		}

		if (!blackTimeLeft || !whiteTimeLeft) return

		socket.join(`game-${gameId}`);
		socket.emit("gameState", {
			history: (history||[]) as string[],
			turn: +(turn || -1),
			player: i,
			whiteTimeLeft: +whiteTimeLeft,
			blackTimeLeft: +blackTimeLeft,
			players: players,
		});
	}

	const ready = async () => {
		const gameId = await redis.get(`game:playerId:${socket.data.user.id}`);
		if (!gameId) return null;

		let players = await redis.lRange(`game:players:${gameId}`, 0, -1);
		if (!players) return null;

		let i = players.indexOf(socket.data.user.id);
		if (i < 0) return;

		const ready = await redis.get(`game:playersReady:${gameId}`);
		let turn = await redis.get(`game:turn:${gameId}`);
		if (turn == null) return null;

		if (!ready || +ready == 0)
			return await redis.set(`game:playersReady:${gameId}`, 1);

		if (+ready != 1)
			return

		await redis.set(`game:playersReady:${gameId}`, 2);
		await redis.set(`game:game_started_date:${gameId}`, Date.now())

		io.of("/game").to(`game-${gameId}`).emit("start");

		let t = setTimeout(async () => {
			let s = await redis.get(`game:white_last_move:${gameId}`);
			if (s == null) {
				await deleteGame(gameId, players);
				io.of("/game").to(`game-${gameId}`).emit("abortGame");
			}
		}, ABORT_SECONDS * 1000);
		TimeoutsMap.set(gameId, t);
	}

	socket.on("disconnect", async () => {
		const gameId = await redis.get(`game:playerId:${socket.data.user.id}`);
		if (!gameId) return null;

		socket.leave(`game-${gameId}`);
	})

	socket.on("getGame", getGame)
	socket.on("ready", ready)
}
