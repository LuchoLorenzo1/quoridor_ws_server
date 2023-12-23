import dotenv from "dotenv";
import { createServer } from "node:http";
import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { isValidMove } from "./game";
import { parseCookie } from "./utils";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import redis from "./redisClient";

dotenv.config();
const PORT = process.env.PORT || 8000;

const server = createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      data: "Hello World!",
    }),
  );
});

interface ServerToClientEvents {
  move: (move: string) => void;
  start: (history: string[], turn: number, player: number) => void;
  foundGame: (id: string) => void;
  reconnectGame: (id: string) => void;
  win: (player: number, reason?: string) => void;
  game: (history: string[], turn: number) => void;
}

interface ClientToServerEvents {
  move: (move: string) => void;
  reconnectGame: () => void;
  searchGame: () => void;
  start: () => void;
  resign: () => void;
}

interface InterServerEvents {
  ping: () => void;
}

interface SocketData {
  user: {
    name: string;
    mail: string;
    id: string;
  };
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

let playerSearching: {
  socket: Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    DefaultEventsMap,
    SocketData
  >;
} | null;

io.of('/game').use(async (socket, next) => {
  if (!socket.handshake.headers["cookie"]) return socket.disconnect();

  let cookies = parseCookie(socket.handshake.headers["cookie"]);
  if (!cookies["next-auth.session-token"]) return socket.disconnect();

  let res = await fetch(
    `http://localhost:3000/api/auth/session/${cookies["next-auth.session-token"]}`,
  );
  if (!res.ok) return socket.disconnect();

  let data = await res.json();
  socket.data.user = data;

  next();
});

io.use(async (socket, next) => {
  if (!socket.handshake.headers["cookie"]) return socket.disconnect();

  let cookies = parseCookie(socket.handshake.headers["cookie"]);
  if (!cookies["next-auth.session-token"]) return socket.disconnect();

  let res = await fetch(
    `http://localhost:3000/api/auth/session/${cookies["next-auth.session-token"]}`,
  );
  if (!res.ok) return socket.disconnect();

  let data = await res.json();
  socket.data.user = data;

  next();
});

io.on("connection", async (socket) => {
  socket.onAnyOutgoing((event) => {
	  console.log("sending event: ", event);
  })
  socket.onAny((event) => {
	  console.log("receiving event: ", event);
  })

  socket.on("reconnectGame", async () => {
	  const gameId = await redis.get(`game:playerId:${socket.data.user.id}`);
	  if (gameId) {
		  socket.emit("reconnectGame", gameId)
	  }
  })

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
})

io.of('/game').on("connection", (socket) => {
  console.log("game connection", socket.data.user.id);

  socket.onAnyOutgoing((event) => {
	  console.log("sending game event: ", event);
  })
  socket.onAny((event) => {
	  console.log("receiving game event: ", event);
  })

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

  socket.on("move", async (move: string) => {
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

    if (state) {
      await redis.rPush(`game:history:${gameId}`, move);
      socket.broadcast.to(`game-${gameId}`).emit("move", move);
      if (state == "win") {
        io.of("/game").to(`game-${gameId}`).emit("win", +turn);
        await deleteGame(gameId, players);
		return
      }

      await redis.set(
        `game:turn:${gameId}`,
        +turn + 1 >= players.length ? 0 : +turn + 1,
      );
    }
  });

  socket.on("start", async () => {
    const gameId = await redis.get(`game:playerId:${socket.data.user.id}`);

    let players = await redis.lRange(`game:players:${gameId}`, 0, -1);
    if (!players) return null;

    let i = players.indexOf(socket.data.user.id);
    if (i < 0) return;

    let history = await redis.lRange(`game:history:${gameId}`, 0, -1);
    let turn = await redis.get(`game:turn:${gameId}`);
    if (turn == null) return null;

    socket.emit("start", history, +turn, i);
    socket.join(`game-${gameId}`);
  });

  socket.on("resign", async () => {
    const gameId = await redis.get(`game:playerId:${socket.data.user.id}`);
    if (!gameId) return;

    let players = await redis.lRange(`game:players:${gameId}`, 0, -1);
    if (!players) return null;
    let i = players.indexOf(socket.data.user.id);
    if (i < 0) return;

    await deleteGame(gameId, players);
    io.of("/game").to(`game-${gameId}`).emit(
      "win",
      players.indexOf(socket.data.user.id),
      "by resignation",
    );
  });

  socket.on("disconnect", () => {
	  console.log("desconectado")
  })
});

console.log(`🚀 Server listening on ${PORT}`);
server.listen(PORT);
