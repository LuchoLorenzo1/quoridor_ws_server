import { TSocket } from "../types";
import { parseCookie } from "../utils/parseCookies";

const authMiddleware = async (socket: TSocket, next: any) => {
  if (!socket.handshake.headers["cookie"])
    return next(new Error("not authenticated"));

  let cookies = parseCookie(socket.handshake.headers["cookie"]);
  if (!cookies["next-auth.session-token"])
    return next(new Error("not authenticated"));

  let res = await fetch(
    `${process.env.NEXT_URL}/api/auth/session/${cookies["next-auth.session-token"]}`,
  );
  if (!res.ok) return next(new Error("not a valid session"));

  let data = await res.json();
  socket.data.user = data;

  next();
};

export default authMiddleware;
