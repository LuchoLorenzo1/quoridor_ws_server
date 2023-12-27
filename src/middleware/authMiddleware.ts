import { TSocket } from "../types";
import { parseCookie } from "../utils";

const authMiddleware = async (socket: TSocket, next: any) => {
  if (!socket.handshake.headers["cookie"]) return socket.disconnect();

  let cookies = parseCookie(socket.handshake.headers["cookie"]);
  if (!cookies["next-auth.session-token"]) return socket.disconnect();

  let res = await fetch(
    `http://localhost:3000/api/auth/session/${cookies["next-auth.session-token"]}`,
  );
  if (!res.ok) return socket.disconnect();

  let data = await res.json();
  socket.data.user = data;

  next();
};

export default authMiddleware;
