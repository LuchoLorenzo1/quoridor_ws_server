import dotenv from "dotenv";
import { createServer } from "node:http";
import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { isValidMove } from "./game";
import { Game } from "./types";
import { parseCookie } from "./utils";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

dotenv.config();
const PORT = process.env.PORT || 8000;

const server = createServer((req, res) => {
	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(
		JSON.stringify({
			data: "Hello World!",
		}),
	);
});

interface ServerToClientEvents {
	move: (move: string) => void;
	start: (player: number) => void;
	foundGame: (id: string) => void;
	win: (player: number, reason?: string) => void;
	game: (history: string[], player: number) => void;
}

interface ClientToServerEvents {
	move: (move: string) => void;
	searchGame: () => void;
	start: () => void;
	resign: () => void;
	getGame: (gameId: string) => void;
}

interface InterServerEvents {
	ping: () => void;
}

interface SocketData {
	user: {
		name: string,
		mail: string,
		id: string,
	};
	matchId: string | null;
}

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

let playerSearching: { socket: Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData> } | null;

let games: Map<string, Game> = new Map();

io.use(async (socket, next) => {
	if (!socket.handshake.headers["cookie"])
		return socket.disconnect()

	let cookies = parseCookie(socket.handshake.headers["cookie"])
	if (!cookies["next-auth.session-token"])
		return socket.disconnect()

	let res = await fetch(`http://localhost:3000/api/auth/session/${cookies["next-auth.session-token"]}`)
	if (!res.ok)
		return socket.disconnect()

	let data = await res.json()
	socket.data.user = data

	next()
})

io.on("connection", (socket) => {
	console.log("connection", socket.data.user.id)

	socket.on("move", (move: string) => {
		if (!socket.data.matchId) return

		let game = games.get(socket.data.matchId);
		if (!game) return;

		let player = game.players.indexOf(socket.data.user.id)
		if (player != game.turn) return;

		const state = isValidMove(game, move);
		if (state) {
			game.history.push(move);
			socket.broadcast.to(`game-${socket.data.matchId}`).emit("move", move);
			if (state == "win") {
				io.to(`game-${game.id}`).emit("win", game.turn);
				game.winner = game.turn;
			}
			game.turn = game.turn + 1 >= game.players.length ? 0 : game.turn + 1;
		}
	});

	socket.on("searchGame", () => {
		if (!playerSearching)
			return playerSearching = { socket };

		let id = uuidv4();

		playerSearching.socket.emit("foundGame", id);
		socket.emit("foundGame", id);

		socket.join(`game-${id}`);
		playerSearching.socket.join(`game-${id}`);

		let players
		if (Math.random() < 0.5) {
			players = [socket.data.user.id, playerSearching.socket.data.user.id]
		} else {
			players = [playerSearching.socket.data.user.id, socket.data.user.id]
		}

		let new_game: Game = { id, history: [], players, turn: 0 };
		games.set(id, new_game);

		socket.data.matchId = id;
		playerSearching.socket.data.matchId = id;

		playerSearching = null;
	});

	socket.on("start", () => {
		if (!socket.data.matchId) return

		let game = games.get(socket.data.matchId);
		if (!game) return;

		let i = game.players.indexOf(socket.data.user.id)
		if (i < 0) return

		socket.emit("start", i);
	});

	socket.on("resign", () => {
		if (!socket.data.matchId) return

		let game = games.get(socket.data.matchId);
		if (!game) return;
		io.to(`game-${game.id}`).emit(
			"win",
			game.players.indexOf(socket.data.user.id),
			"by resignation",
		);
	});

	socket.on("getGame", (gameId: string) => {
		let game = games.get(gameId);
		if (!game) return;
	});
});

console.log(`🚀 Server listening on ${PORT}`);
server.listen(PORT);
