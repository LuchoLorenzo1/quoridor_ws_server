import createGame from "../controllers/createGame";
import { getUserById } from "../controllers/users";
import redis from "../redisClient";
import { Challenge, TIo, TSocket } from "../types";
import { v4 as uuidv4 } from "uuid";

export default async function challengeGameHandler(io: TIo, socket: TSocket) {
  const createChallenge = async (
    {
      seconds,
      color,
      rated,
    }: { seconds: number; color: string; rated: string },
    callback: (invitationCode: string) => void,
  ) => {
    console.log("createChallenge", seconds, color, rated);
    if (color !== "white" && color !== "black" && color !== "random") return;
    if (+seconds <= 0 || +seconds > 1800) return;
    if (rated !== "casual" && rated !== "rated") return;
    console.log("createChallenge", seconds, color, rated);

    const playerSearching = (await redis.hGetAll(
      `searchingGame:playerId:${socket.data.user.id}`,
    )) as { gameId: string; time: string } | null;
    let time = playerSearching?.time;

    if (time) {
      await redis
        .multi()
        .del(`searchingGame:playerId:${socket.data.user.id}`)
        .del(`playerSearchingId:${time}`)
        .exec();
    }

    const ratingChallenger = await getUserById(socket.data.user.id);
    if (!ratingChallenger) return;

    const invitationCode = Math.random().toString(36).substr(2, 8);
    const createdGame = {
      seconds: seconds.toString(),
      color,
      rated,
      challengerId: socket.data.user.id,
      challengerName: ratingChallenger.name,
      challengerImage: ratingChallenger.image || "",
      challengerRating: ratingChallenger?.rating.toString(),
      challengerRd: ratingChallenger?.rating_deviation.toFixed(5),
      challengerVol: ratingChallenger?.volatility.toFixed(5),
      gameId: uuidv4(),
    };

    console.log("createChallenge", createdGame);

    socket.join(`game-${createdGame.gameId}`);

    await redis
      .multi()
      .hSet(`challenge:code:${invitationCode}`, createdGame)
      .expire(`challenge:code:${invitationCode}`, 60 * 20)
      .exec();

    callback(invitationCode);
  };

  const acceptChallenge = async (invitationCode: string) => {
    const createdGame = (await redis.hGetAll(
      `challenge:code:${invitationCode}`,
    )) as unknown as Challenge | null;
    if (!createdGame) return;
    if (socket.data.user.id === createdGame.challengerId) return;

    const ratingUser = await getUserById(socket.data.user.id);
    if (!ratingUser) return;

    const player1 = {
      id: createdGame.challengerId,
      rating: +createdGame.challengerRating,
      rd: +createdGame.challengerRating,
      vol: +createdGame.challengerVol,
    };

    const player2 = {
      id: socket.data.user.id,
      rating: ratingUser.rating,
      rd: ratingUser.rating_deviation,
      vol: ratingUser.volatility,
    };

    socket.join(`game-${createdGame.gameId}`);
    io.to(`game-${createdGame.gameId}`).emit("foundGame", createdGame.gameId);
    io.in(`game-${createdGame.gameId}`).socketsLeave([
      "home",
      `game-${createdGame.gameId}`,
    ]);

    let isPlayer1White;
    if (createdGame.color === "white") {
      isPlayer1White = true;
    } else if (createdGame.color === "black") {
      isPlayer1White = false;
    }

    await createGame(
      createdGame.gameId,
      player1,
      player2,
      +createdGame.seconds,
      isPlayer1White,
    );
  };

  const getChallenge = async (
    invitationCode: string,
    callback: (challenge: any) => void,
  ) => {
    const challenge = (await redis.hGetAll(
      `challenge:code:${invitationCode}`,
    )) as unknown as Challenge | null;
    if (!challenge) return;

    callback({
      seconds: challenge.seconds,
      color: challenge.color,
      rated: challenge.rated,
      challenger: {
        id: challenge.challengerId,
        name: challenge.challengerName,
        image: challenge.challengerImage,
        rating: challenge.challengerRating,
        rd: challenge.challengerRd,
      },
    });
  };

  const cancelChallenge = async (
    invitationCode: string,
    callback: () => void,
  ) => {
    const createdGame = await redis.hGetAll(`challenge:code:${invitationCode}`);
    if (!createdGame) return;
    if (socket.data.user.id !== createdGame.challengerId) return;

    await redis.del(`challenge:code:${invitationCode}`);
    callback();
  };

  socket.on("createChallenge", createChallenge);
  socket.on("acceptChallenge", acceptChallenge);
  socket.on("getChallenge", getChallenge);
  socket.on("cancelChallenge", cancelChallenge);
}
