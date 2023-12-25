import dotenv from "dotenv";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
	ClientToServerEvents,
	InterServerEvents,
	ServerToClientEvents,
	SocketData,
} from "./types";
import { authMiddleware } from "./middleware";
import connectGameHandler from "./handlers/connectGameHandler";
import gameReadyHandler from "./handlers/gameReadyHandler";
import moveHandler from "./handlers/moveHandler";
import resignHandler from "./handlers/resignHandler";

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

io.of("/game").use(authMiddleware);
io.use(authMiddleware);

io.on("connection", (socket) => connectGameHandler(socket));

const TimeoutsMap: Map<string, NodeJS.Timeout> = new Map();

io.of("/game").on("connection", (socket) => {
	gameReadyHandler(io, socket, TimeoutsMap)
	moveHandler(io, socket, TimeoutsMap)
	resignHandler(io, socket)
});

console.log(`🚀 Server listening on ${PORT}`);
server.listen(PORT);
