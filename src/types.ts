import { Server, Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

export interface ServerToClientEvents {
  move: (move: string, timeLeft: number) => void;
  gameState: (gameData: GameData) => void;
  start: () => void;
  foundGame: (id: string) => void;
  reconnectGame: (id: string) => void;
  win: (player: number, reason?: string) => void;
  abortGame: () => void;
  chatMessage: (message: string) => void;
  rematch: (playerId: string) => void;
  rematchGame: (gameId: string) => void;
  chat: (messages: string[]) => void;
  leftChat: (messages: number) => void;
  stats: (stats: { playing: number; online: number }) => void;
  playerConnected: (playerId: string) => void;
  playerDisconnected: (playerId: string) => void;
  playerData: (playerData: {
    gameId?: string;
    opponentId?: string;
    online: boolean;
  }) => void;
}

export interface ClientToServerEvents {
  move: (move: string, callback: any) => void;
  getGame: () => void;
  home: () => void;
  searchGame: (time: number) => void;
  cancelSearchGame: (time: number) => void;
  ready: () => void;
  abort: () => void;
  resign: () => void;
  chatMessage: (message: string) => void;
  getChat: (message: string) => void;
  rematch: () => void;
  rejectRematch: () => void;
  cancelRematch: () => void;
  playerData: (player: string) => void;
  createChallenge: (
    game: { seconds: number; color: string; rated: string },
    callback: (invitationCode: string) => void,
  ) => void;
  acceptChallenge: (invitationCode: string) => void;
  getChallenge: (
    invitationCode: string,
    callback: (challenge: Challenge) => void,
  ) => void;
  cancelChallenge: (invitationCode: string, callback: () => void) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user: {
    name: string;
    mail: string;
    id: string;
  };
  gameId: string;
  players: string[];
  player: number | null;
}

export type TSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  SocketData
>;

export type TIo = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export interface GameData {
  history: string[];
  turn: number;
  player: number | null;
  players: string[];
  whiteTimeLeft: number;
  blackTimeLeft: number;
  viewers: number;
  whiteRating: { rating: number; rd: number };
  blackRating: { rating: number; rd: number };
}

export interface PawnPos {
  x: number;
  y: number;
}

export interface Wall {
  row: number;
  col: number;
}

export interface Challenge {
  seconds: string;
  color: "random" | "white" | "black";
  rated: "rated" | "casual";
  challengerId: string;
  challengerName: string;
  challengerImage: string;
  challengerRating: string;
  challengerRd: string;
  challengerVol: string;
  gameId: string;
}
