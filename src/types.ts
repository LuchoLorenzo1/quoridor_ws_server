export type Game = {
  id: string;
  history: string[];
  players: string[]; // ids of players
  turn: number;
  winner?: number;
};

export interface PawnPos {
  x: number;
  y: number;
}

export interface Wall {
  row: number;
  col: number;
}
