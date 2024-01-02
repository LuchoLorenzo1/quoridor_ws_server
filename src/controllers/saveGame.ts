import sql from "../postgresClient";
import redis from "../redisClient";
import { deleteGame } from "./deleteGame";

type winningReason = "play" | "resignation" | "time";

export const saveGame = async (
  gameId: string,
  players: string[],
  winner: number,
  winningReason: winningReason = "play",
) => {
  let [history, startedAtTimestamp, gameTime] = (await redis
    .multi()
    .lRange(`game:history:${gameId}`, 0, -1)
    .get(`game:game_started_date:${gameId}`)
    .get(`game:game_time:${gameId}`)
    .exec()) as [string[], string, string];

  let finishedAt = new Date();
  const startedAt = new Date(+startedAtTimestamp);
  const h = history.join(" ");

  if (!history || !startedAt || !gameTime) return;

  await redis.set(`game:state:${gameId}`, "finished", { EX: 60 * 15 });
  console.log(
    `SAVING THIS GAME: ${gameId}, ${gameTime}, ${h}, ${players[0]}, ${
      players[1]
    }, ${winner == 0}, ${winningReason}, ${startedAt}, ${finishedAt}`,
  );

  await sql`
	INSERT INTO games
	(id, time_seconds, history, white_player_id, black_player_id, white_winner, winning_reason, started_at, finished_at)
	VALUES
	(${gameId}, ${gameTime}, ${h}, ${players[0]}, ${players[1]}, ${
    winner == 0
  }, ${winningReason}, ${startedAt}, ${finishedAt})
	`;

  await deleteGame(gameId, players);
};
