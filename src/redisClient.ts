import { createClient } from "redis";

const redis = createClient();

redis.on("error", (err) => console.log("Redis Client Error", err));

const connect = async () => await redis.connect();

connect()
  .then(() => console.log("connected to redis"))
  .catch((err) => console.log("error connecting to redis", err));

export default redis;
