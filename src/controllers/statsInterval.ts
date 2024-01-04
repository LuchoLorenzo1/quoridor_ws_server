import redis from "../redisClient";
import { TIo } from "../types";

const statsInterval = (io: TIo) => {
  redis.hSet("stats", { playing: 0, online: 0 });
  setInterval(async () => {
    const [online, playing] = await redis
      .multi()
      .sCard("players:online")
      .hGet("stats", "playing")
      .exec();
    const stats = { online: +(online || 0), playing: +(playing || 0) };
    if (stats) io.to("home").emit("stats", stats);
  }, 2000);
};

export default statsInterval;
