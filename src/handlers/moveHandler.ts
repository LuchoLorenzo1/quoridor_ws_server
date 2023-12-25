import { ABORT_SECONDS } from "../constants";
import { isValidMove } from "../game";
import redis from "../redisClient";
import { TSocket, TIo } from "../types";
import { deleteGame } from "../utils";

export default function moveHandler (io: TIo, socket: TSocket, TimeoutsMap: Map<string, NodeJS.Timeout>) {
 const move = async (move: string, callback: any) => {
		const gameId = await redis.get(`game:playerId:${socket.data.user.id}`);
		if (!gameId) return;

		let [players, history, turn] = (await redis
			.multi()
			.lRange(`game:players:${gameId}`, 0, -1)
			.lRange(`game:history:${gameId}`, 0, -1)
			.get(`game:turn:${gameId}`)
			.exec()) as [string[], string[], string];

		if (!players || turn == null) return null;

		let i = players.indexOf(socket.data.user.id);
		if (i < 0 || i != +turn) return;

		const state = isValidMove(history, move);
		if (!state) return;

		await redis
			.multi()
			.rPush(`game:history:${gameId}`, move)
			.set(`game:turn:${gameId}`, +turn + 1 >= players.length ? 0 : +turn + 1)
			.exec();

		if (state == "win") {
			io.of("/game").to(`game-${gameId}`).emit("win", +turn);
			await deleteGame(gameId, players);
			return;
		}

		let blackLastMove: string | null | number = await redis.get(
			`game:black_last_move:${gameId}`,
		);
		let whiteLastMove: string | null | number = await redis.get(
			`game:white_last_move:${gameId}`,
		);
		const whiteTimeLeft = await redis.get(`game:white_time_left:${gameId}`);
		const blackTimeLeft = await redis.get(`game:black_time_left:${gameId}`);
		if (!whiteTimeLeft || !blackTimeLeft) return;

		const clear = TimeoutsMap.get(gameId);
		clearTimeout(clear);
		let timeLeft: number = 0;
		const now = new Date().getTime();

		if (!whiteLastMove) whiteLastMove = now;

		if (+turn == 0) {
			let t;
			if (!blackLastMove) {
				console.log("creating timeout for black aborting")
				t = setTimeout(async () => {
					let s = await redis.get(`game:black_last_move:${gameId}`);
					if (s == null) {
						await deleteGame(gameId, players);
						console.log("ABORTING GAME")
						io.of("/game").to(`game-${gameId}`).emit("abortGame");
					}
				}, ABORT_SECONDS * 1000);
			} else {
				t = setTimeout(async () => {
					let s = await redis.get(`game:black_time_left:${gameId}`);
					if (s == null || +s == +blackTimeLeft) {
						io.of("/game").to(`game-${gameId}`).emit("win", 0, "on time");
						await deleteGame(gameId, players);
					}
				}, +blackTimeLeft * 1000);
			}
			TimeoutsMap.set(gameId, t);

			if (!blackLastMove) blackLastMove = now;
			let diff = now - +blackLastMove;
			timeLeft = +whiteTimeLeft - diff / 1000;

			await redis.set(`game:white_last_move:${gameId}`, now);
			await redis.set(`game:white_time_left:${gameId}`, timeLeft);
		} else {
			let t = setTimeout(async () => {
				let s = await redis.get(`game:white_time_left:${gameId}`);
				if (s == null || +s == +whiteTimeLeft) {
					io.of("/game").to(`game-${gameId}`).emit("win", 1, "by timeout");
					await deleteGame(gameId, players);
				}
			}, +whiteTimeLeft * 1000);
			TimeoutsMap.set(gameId, t);

			if (!whiteLastMove) whiteLastMove = now;
			let diff = now - +whiteLastMove;
			timeLeft = +blackTimeLeft - diff / 1000;

			await redis.set(`game:black_time_left:${gameId}`, timeLeft);
			await redis.set(`game:black_last_move:${gameId}`, now);
		}

		callback(timeLeft);
		socket.broadcast.to(`game-${gameId}`).emit("move", move, timeLeft);
	}

	socket.on("move", move)
}
