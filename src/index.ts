import dotenv from "dotenv";
import { createServer } from "node:http";
import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { isValidMove } from "./game";
import { Game } from "./types";
import { parseCookie } from "./utils";

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
  };
  matchId: string;
  player: number;
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

let playerSearching: { socket: Socket } | null;

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
  console.log("connection")

  socket.on("move", (move: string) => {
    let game = games.get(socket.data.matchId);
    if (!game) return;
    if (socket.data.player != game.turn) return;

    const state = isValidMove(game, move);
    if (state) {
      game.history.push(move);
      socket.broadcast.to(`game-${socket.data.matchId}`).emit("move", move);
      if (state == "win") {
        io.to(`game-${game.id}`).emit("win", game.turn);
        game.winner = game.turn;
      }
      game.turn = game.turn == 1 ? 0 : 1;
    }
  });

  socket.on("searchGame", () => {
    if (!!playerSearching) {
      let id = uuidv4();

      playerSearching.socket.emit("foundGame", id);
      socket.emit("foundGame", id);

      socket.join(`game-${id}`);
      playerSearching.socket.join(`game-${id}`);

      let new_game: Game = { id, history: [], player: 0, turn: 0 };
      games.set(id, new_game);

      socket.data.matchId = id;
      playerSearching.socket.data.matchId = id;

      playerSearching = null;
    } else {
      playerSearching = { socket };
    }
  });

  socket.on("start", () => {
    let game = games.get(socket.data.matchId);
    if (!game) return;

    if (socket.data.player == undefined) {
      socket.data.player = game.player;
      socket.emit("start", game.player);
      game.player += 1;
    } else {
      socket.emit("game", game.history, socket.data.player);
    }
  });

  socket.on("resign", () => {
    let game = games.get(socket.data.matchId);
    if (!game) return;
    io.to(`game-${game.id}`).emit(
      "win",
      socket.data.player == 1 ? 0 : 1,
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
