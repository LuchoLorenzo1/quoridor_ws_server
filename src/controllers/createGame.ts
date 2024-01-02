import redis from "../redisClient";

const createGame = async (
  gameId: string,
  player1: string,
  player2: string,
  time: number,
) => {
  let players;
  if (Math.random() < 0.5) {
    players = [player1, player2];
  } else {
    players = [player2, player1];
  }

  await redis
    .multi()
    .set(`game:playerId:${player1}`, gameId, { EX: 60 * 15 })
    .set(`game:playerId:${player2}`, gameId, { EX: 60 * 15 })
    .lPush(`game:players:${gameId}`, players)
    .set(`game:turn:${gameId}`, 0)
    .set(`game:game_time:${gameId}`, time, { EX: 60 * 15 })
    .set(`game:state:${gameId}`, "playing", { EX: 60 * 15 })
    .set(`game:black_time_left:${gameId}`, time)
    .set(`game:white_time_left:${gameId}`, time)
    .hIncrBy("stats", "playing", 2)
    .exec();
};

export default createGame;
