import { ABORT_SECONDS, SECONDS } from "../constants";
import redis from "../redisClient";
import { TIo, TSocket } from "../types";
import { deleteGame } from "../controllers/deleteGame";

export default function gameReadyHandler(
  io: TIo,
  socket: TSocket,
  TimeoutsMap: Map<string, NodeJS.Timeout>,
) {
  const getGame = async () => {
    let [
      history,
      turn,
      blackTimeLeft,
      whiteTimeLeft,
      whiteLastMove,
      blackLastMove,
      gameStartedDate,
    ] = (await redis
      .multi()
      .lRange(`game:history:${socket.data.gameId}`, 0, -1)
      .get(`game:turn:${socket.data.gameId}`)
      .get(`game:black_time_left:${socket.data.gameId}`)
      .get(`game:white_time_left:${socket.data.gameId}`)
      .get(`game:white_last_move:${socket.data.gameId}`)
      .get(`game:black_last_move:${socket.data.gameId}`)
      .get(`game:game_started_date:${socket.data.gameId}`)
      .exec()) as [
      string[],
      string,
      string | number,
      string | number,
      string,
      string,
      string,
      { white: string; black: string },
    ];

    let now = Date.now();
    if (turn && +turn == 0) {
      if (blackLastMove) {
        whiteTimeLeft =
          +(whiteTimeLeft || SECONDS) - (now - +blackLastMove) / 1000;
      } else if (gameStartedDate) {
        whiteTimeLeft =
          +(whiteTimeLeft || SECONDS) - (now - +gameStartedDate) / 1000;
      }
    } else if (turn && +turn == 1 && whiteLastMove) {
      blackTimeLeft =
        +(blackTimeLeft || SECONDS) - (now - +whiteLastMove) / 1000;
    } else {
      blackTimeLeft = SECONDS;
      whiteTimeLeft = SECONDS;
    }

    if (!blackTimeLeft || !whiteTimeLeft) return;

    socket.emit("gameState", {
      history: (history || []) as string[],
      turn: +(turn || -1),
      player: socket.data.player,
      whiteTimeLeft: +whiteTimeLeft,
      blackTimeLeft: +blackTimeLeft,
      players: socket.data.players,
    });
  };

  const ready = async () => {
    const ready = await redis.get(`game:playersReady:${socket.data.gameId}`);
    let turn = await redis.get(`game:turn:${socket.data.gameId}`);
    if (turn == null) return null;

    if (!ready || +ready == 0)
      return await redis.set(`game:playersReady:${socket.data.gameId}`, 1);

    if (+ready != 1) return;

    await redis.set(`game:playersReady:${socket.data.gameId}`, 2);
    await redis.set(`game:game_started_date:${socket.data.gameId}`, Date.now());

    io.of(socket.nsp.name).emit("start");

    let t = setTimeout(async () => {
      let s = await redis.get(`game:white_last_move:${socket.data.gameId}`);
      if (s == null) {
        await deleteGame(socket.data.gameId, socket.data.players);
        io.of(socket.nsp.name).emit("abortGame");
      }
    }, ABORT_SECONDS * 1000);
    TimeoutsMap.set(socket.data.gameId, t);
  };

  socket.on("getGame", getGame);
  socket.on("ready", ready);
}
