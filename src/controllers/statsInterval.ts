import redis from "../redisClient";
import { TIo } from "../types";

const statsInterval = (io: TIo) => {
  redis.hSet("stats", { playing: 0, online: 0 });
  setInterval(async () => {
    const stats = (await redis.hGetAll("stats")) as {
      playing: string;
      online: string;
    };
    if (stats) io.to("home").emit("stats", stats);
  }, 2000);
};

export default statsInterval;
