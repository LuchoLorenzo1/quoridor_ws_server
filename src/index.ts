import dotenv from "dotenv";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { isValidMove } from "./game";
import redis from "./redisClient";
import {
	ClientToServerEvents,
	InterServerEvents,
	ServerToClientEvents,
	SocketData,
	TSocket,
} from "./types";
import { authMiddleware } from "./middleware";

dotenv.config();
const PORT = process.env.PORT || 8000;

const SECONDS = 50;
const ABORT_SECONDS = 10;

const server = createServer((_, res) => {
	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(
		JSON.stringify({
			data: "Hello World!",
		}),
	);
});

const io = new Server<
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData
>(server, {
	cors: {
		origin: "http://localhost:3000",
		credentials: true,
	},
});

let playerSearching: { socket: TSocket } | null;

io.of("/game").use(authMiddleware);
io.use(authMiddleware);

io.on("connection", async (socket) => {
	socket.onAnyOutgoing((event) => {
		console.log("sending event: ", event);
	});
	socket.onAny((event) => {
		console.log("receiving event: ", event);
	});

	socket.on("reconnectGame", async () => {
		const gameId = await redis.get(`game:playerId:${socket.data.user.id}`);
		if (gameId) {
			socket.emit("reconnectGame", gameId);
		}
	});

	socket.on("searchGame", async () => {
		if (!playerSearching) return (playerSearching = { socket });

		let gameId = uuidv4();

		playerSearching.socket.emit("foundGame", gameId);
		socket.emit("foundGame", gameId);

		socket.join(`game-${gameId}`);
		playerSearching.socket.join(`game-${gameId}`);

		let players;
		if (Math.random() < 0.5) {
			players = [socket.data.user.id, playerSearching.socket.data.user.id];
		} else {
			players = [playerSearching.socket.data.user.id, socket.data.user.id];
		}

		await redis
			.multi()
			.set(`game:playerId:${socket.data.user.id}`, gameId, { EX: 60 * 30 }) // 30 minutos expire
			.set(`game:playerId:${playerSearching.socket.data.user.id}`, gameId, {
				EX: 60 * 30,
			})
			.lPush(`game:players:${gameId}`, players)
			.set(`game:turn:${gameId}`, 0)
			.exec();

		playerSearching = null;
	});
});

const TimeoutsMap: Map<string, NodeJS.Timeout> = new Map();

io.of("/game").on("connection", async (socket) => {
	console.log("game connection", socket.data.user.id);

	const deleteGame = async (gameId: string, players: string[]) => {
		return await redis
			.multi()
			.del(`game:playerId:${players[0]}`)
			.del(`game:playerId:${players[1]}`)
			.del(`game:history:${gameId}`)
			.del(`game:players:${gameId}`)
			.del(`game:turn:${gameId}`)
			.exec();
	};

	socket.on("move", async (move: string, callback: any) => {
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
		if (!blackLastMove) blackLastMove = now;

		if (+turn == 0) {
			let t;
			if (!blackLastMove) {
				t = setTimeout(async () => {
					let s = await redis.get(`game:black_last_move:${gameId}`);
					if (s == null) {
						await deleteGame(gameId, players);
						io.of("/game").to(`game-${gameId}`).emit("abortGame");
					}
				}, ABORT_SECONDS * 1000);
			} else {
				t = setTimeout(async () => {
					let s = await redis.get(`game:black_time_left:${gameId}`);
					if (s == null || +s == +blackTimeLeft) {
						io.of("/game").to(`game-${gameId}`).emit("win", 0, "by timeout");
						await deleteGame(gameId, players);
					}
				}, +blackTimeLeft * 1000);
			}
			TimeoutsMap.set(gameId, t);

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
	});

	socket.on("ready", async () => {
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

		socket.emit("gameState", history, +turn, i, SECONDS);
		socket.join(`game-${gameId}`);

		if (!ready || +ready == 0) {
			await redis.set(`game:playersReady:${gameId}`, 1);
		} else if (+ready == 1) {
			await redis.set(`game:playersReady:${gameId}`, 2);
			await redis
				.multi()
				.set(`game:black_time_left:${gameId}`, SECONDS)
				.set(`game:white_time_left:${gameId}`, SECONDS)
				.exec();

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
	});

	socket.on("resign", async () => {
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
	});

	socket.on("disconnect", () => {
		console.log("desconectado");
	});
});

console.log(`🚀 Server listening on ${PORT}`);
server.listen(PORT);
