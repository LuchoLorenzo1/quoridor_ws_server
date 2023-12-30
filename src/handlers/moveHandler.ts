import { ABORT_SECONDS } from "../constants";
import { isValidMove, stringToMove } from "../game";
import redis from "../redisClient";
import { TSocket, TIo } from "../types";
import { deleteGame } from "../controllers/deleteGame";
import { saveGame } from "../controllers/saveGame";

export default function moveHandler(
  io: TIo,
  socket: TSocket,
  TimeoutsMap: Map<string, NodeJS.Timeout>,
) {
  const move = async (move: string, callback: any) => {
    let [history, turn] = (await redis
      .multi()
      .lRange(`game:history:${socket.data.gameId}`, 0, -1)
      .get(`game:turn:${socket.data.gameId}`)
      .exec()) as [string[], string, string];

    if (turn == null) return null;
    if (socket.data.player != +turn) return;

    const state = isValidMove(history, move);
    if (!state) return console.log("INVALID MOVE");

    if (stringToMove(move).wall)
      await redis.hIncrBy(
        `game:walls_left:${socket.data.gameId}`,
        +turn == 0 ? "white" : "black",
        -1,
      );

    await redis
      .multi()
      .rPush(`game:history:${socket.data.gameId}`, move)
      .set(
        `game:turn:${socket.data.gameId}`,
        +turn + 1 >= socket.data.players.length ? 0 : +turn + 1,
      )
      .exec();

    let blackLastMove: string | null | number = await redis.get(
      `game:black_last_move:${socket.data.gameId}`,
    );
    let whiteLastMove: string | null | number = await redis.get(
      `game:white_last_move:${socket.data.gameId}`,
    );
    const whiteTimeLeft = await redis.get(
      `game:white_time_left:${socket.data.gameId}`,
    );
    const blackTimeLeft = await redis.get(
      `game:black_time_left:${socket.data.gameId}`,
    );
    if (!whiteTimeLeft || !blackTimeLeft) return;

    const clear = TimeoutsMap.get(socket.data.gameId);
    clearTimeout(clear);
    let timeLeft: number = 0;
    const now = new Date().getTime();

    if (!whiteLastMove) whiteLastMove = now;

    if (+turn == 0) {
      if (state != "win") {
        let t;
        if (!blackLastMove) {
          t = setTimeout(async () => {
            let s = await redis.get(
              `game:black_last_move:${socket.data.gameId}`,
            );
            if (s == null) {
              await deleteGame(socket.data.gameId, socket.data.players);
              io.of(socket.nsp.name)
                .to(`game-${socket.data.gameId}`)
                .emit("abortGame");
            }
          }, ABORT_SECONDS * 1000);
        } else {
          t = setTimeout(async () => {
            let s = await redis.get(
              `game:black_time_left:${socket.data.gameId}`,
            );
            if (s == null || +s == +blackTimeLeft) {
              io.of(socket.nsp.name)
                .to(`game-${socket.data.gameId}`)
                .emit("win", 0, "on time");
              await saveGame(
                socket.data.gameId,
                socket.data.players,
                0,
                "time",
              );
              await deleteGame(socket.data.gameId, socket.data.players);
            }
          }, +blackTimeLeft * 1000);
        }
        TimeoutsMap.set(socket.data.gameId, t);
      }

      if (!blackLastMove) blackLastMove = now;
      let diff = now - +blackLastMove;
      timeLeft = +whiteTimeLeft - diff / 1000;

      await redis.set(`game:white_last_move:${socket.data.gameId}`, now);
      await redis.set(`game:white_time_left:${socket.data.gameId}`, timeLeft);
    } else {
      if (state != "win") {
        let t = setTimeout(async () => {
          let s = await redis.get(`game:white_time_left:${socket.data.gameId}`);
          if (s == null || +s == +whiteTimeLeft) {
            io.of(socket.nsp.name)
              .to(`game-${socket.data.gameId}`)
              .emit("win", 1, "by timeout");
            await saveGame(socket.data.gameId, socket.data.players, 1, "time");
            await deleteGame(socket.data.gameId, socket.data.players);
          }
        }, +whiteTimeLeft * 1000);
        TimeoutsMap.set(socket.data.gameId, t);
      }

      if (!whiteLastMove) whiteLastMove = now;
      let diff = now - +whiteLastMove;
      timeLeft = +blackTimeLeft - diff / 1000;

      await redis.set(`game:black_time_left:${socket.data.gameId}`, timeLeft);
      await redis.set(`game:black_last_move:${socket.data.gameId}`, now);
    }

    callback(timeLeft);
    socket.broadcast
      .to(`game-${socket.data.gameId}`)
      .emit("move", move, timeLeft);

    if (state == "win") {
      io.of(socket.nsp.name)
        .to(`game-${socket.data.gameId}`)
        .emit("win", +turn);
      await saveGame(socket.data.gameId, socket.data.players, +turn);
      return await deleteGame(socket.data.gameId, socket.data.players);
    }
  };

  socket.on("move", move);
}
