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
  chat: (messages: string[]) => void;
}

export interface ClientToServerEvents {
  move: (move: string, callback: any) => void;
  getGame: () => void;
  reconnectGame: () => void;
  searchGame: () => void;
  ready: () => void;
  resign: () => void;
  chatMessage: (message: string) => void;
  getChat: (message: string) => void;
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
  player: number;
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

interface GameData {
  history: string[];
  turn: number;
  player: number;
  players: string[];
  whiteTimeLeft: number;
  blackTimeLeft: number;
  wallsLeft: {
    white: number;
    black: number;
  };
}

export interface PawnPos {
  x: number;
  y: number;
}

export interface Wall {
  row: number;
  col: number;
}
