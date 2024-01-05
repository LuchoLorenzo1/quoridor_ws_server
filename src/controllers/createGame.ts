import redis from "../redisClient";
import { calculateNewRatings } from "../utils/ratings";

const createGame = async (
  gameId: string,
  player1: { id: string; rating: number; rd: number; vol: number },
  player2: { id: string; rating: number; rd: number; vol: number },
  time: number,
  isPlayer1White?: boolean,
) => {
  let players: string[];
  if (isPlayer1White != undefined) {
    if (isPlayer1White) {
      players = [player1.id, player2.id];
    } else {
      players = [player2.id, player1.id];
    }
  } else if (Math.random() < 0.5) {
    players = [player1.id, player2.id];
  } else {
    players = [player2.id, player1.id];
  }
  await redis
    .multi()
    .set(`game:playerId:${player1.id}`, gameId, { EX: 60 * 15 })
    .set(`game:playerId:${player2.id}`, gameId, { EX: 60 * 15 })
    .rPush(`game:players:${gameId}`, players)
    .set(`game:turn:${gameId}`, 0)
    .set(`game:game_time:${gameId}`, time, { EX: 60 * 15 })
    .set(`game:state:${gameId}`, "playing", { EX: 60 * 15 })
    .set(`game:black_time_left:${gameId}`, time)
    .set(`game:white_time_left:${gameId}`, time)
    .hSet(`game:white_rating:${gameId}`, {
      rating: player1.rating,
      rd: player1.rd,
      vol: player1.vol,
    })
    .hSet(`game:black_rating:${gameId}`, {
      rating: player2.rating,
      rd: player2.rd,
      vol: player2.vol,
    })
    .hIncrBy("stats", "playing", 2)
    .exec();
};

export default createGame;
