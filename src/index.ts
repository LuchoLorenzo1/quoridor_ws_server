import dotenv from "dotenv";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./types";
import authMiddleware from "./middleware/authMiddleware";
import gameMiddleware from "./middleware/gameMiddleware";
import connectGameHandler from "./handlers/connectGameHandler";
import gameReadyHandler from "./handlers/gameReadyHandler";
import moveHandler from "./handlers/moveHandler";
import resignHandler from "./handlers/resignHandler";

dotenv.config();
const PORT = process.env.PORT || 8000;

const server = createServer();

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

io.use(authMiddleware);
io.on("connection", (socket) => connectGameHandler(socket));

const gameNamespace = io.of(
  /^\/game\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
);
gameNamespace.use(authMiddleware);
gameNamespace.use(gameMiddleware);

const TimeoutsMap: Map<string, NodeJS.Timeout> = new Map();
gameNamespace.on("connection", (socket) => {
  gameReadyHandler(io, socket, TimeoutsMap);
  moveHandler(io, socket, TimeoutsMap);
  resignHandler(io, socket);
});

console.log(`🚀 Server listening on ${PORT}`);
server.listen(PORT);
