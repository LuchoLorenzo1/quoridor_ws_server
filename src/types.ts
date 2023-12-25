import { Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

export interface ServerToClientEvents {
	move: (move: string, timeLeft: number) => void;
	gameState: (
		history: string[],
		turn: number,
		player: number,
		whiteSecondsLeft: number,
		blackSecondsLeft: number,
	) => void;
	start: () => void;
	foundGame: (id: string) => void;
	reconnectGame: (id: string) => void;
	win: (player: number, reason?: string) => void;
	abortGame: () => void;
}

export interface ClientToServerEvents {
	move: (move: string, callback: any) => void;
	reconnectGame: () => void;
	searchGame: () => void;
	ready: () => void;
	resign: () => void;
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
}

export type TSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>

export interface PawnPos {
  x: number;
  y: number;
}

export interface Wall {
  row: number;
  col: number;
}
