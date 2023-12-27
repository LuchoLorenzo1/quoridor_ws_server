import { INITIAL_WALLS, SECONDS } from "../constants";
import redis from "../redisClient";
import { TSocket } from "../types";
import { v4 as uuidv4 } from "uuid";

let playerSearching: { socket: TSocket } | null;

export default function connectGameHandler(socket: TSocket) {
  const searchGame = async () => {
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
      .set(`game:game_time:${gameId}`, SECONDS)
      .set(`game:black_time_left:${gameId}`, SECONDS)
      .set(`game:white_time_left:${gameId}`, SECONDS)
      .hSet(`game:walls_left:${gameId}`, {
        black: INITIAL_WALLS,
        white: INITIAL_WALLS,
      })
      .exec();

    playerSearching = null;
  };

  socket.on("reconnectGame", async () => {
    const gameId = await redis.get(`game:playerId:${socket.data.user.id}`);
    if (gameId) {
      socket.emit("reconnectGame", gameId);
    }
  });

  socket.on("searchGame", searchGame);
}
