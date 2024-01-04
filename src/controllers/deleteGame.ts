import redis from "../redisClient";

export const deleteGame = async (gameId: string, players: string[]) => {
  console.log("deleting game", gameId);
  return await redis
    .multi()
    .del(`game:playerId:${players[0]}`)
    .del(`game:playerId:${players[1]}`)
    .del(`game:history:${gameId}`)
    .del(`game:players:${gameId}`)
    .del(`game:turn:${gameId}`)
    .del(`game:black_time_left:${gameId}`)
    .del(`game:white_time_left:${gameId}`)
    .del(`game:black_last_move:${gameId}`)
    .del(`game:white_last_move:${gameId}`)
    .del(`game:playersReady:${gameId}`)
    .del(`game:game_started_date:${gameId}`)
    .del(`game:walls_left:${gameId}`)
    .del(`game:chat:${gameId}`)
    .del(`game:viewers:${gameId}`)
    .hIncrBy("stats", "playing", -2)
    .exec();
};
