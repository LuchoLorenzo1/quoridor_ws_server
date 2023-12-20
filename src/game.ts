import { Game, PawnPos, Wall } from "./types";

const matrix = (m: number, n: number): Wall[][] => {
  let _matrix: Wall[][] = [];
  for (let i = 0; i < m; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      let c: Wall = { row: 0, col: 0 };
      row.push(c);
    }
    _matrix.push(row);
  }
  return _matrix;
};

const columns = "abcdefghi";

const stringToMove = (move: string): { pos: PawnPos; wall?: Wall } => {
  let y = columns.indexOf(move[0]);
  let x = +move[1] - 1;

  let wall;
  if (move[2] == "v") {
    wall = { col: 1, row: 0 };
  } else if (move[2] == "h") {
    wall = { col: 0, row: 1 };
  }

  return {
    pos: { x, y },
    wall,
  };
};

const getAdjacents = (x: number, y: number, walls: Wall[][]): PawnPos[] => {
  let adj = [];
  if (x <= 7 && walls[y][x].row == 0) adj.push({ x: x + 1, y });
  if (y <= 7 && walls[y][x].col == 0) adj.push({ x, y: y + 1 });
  if (y >= 1 && walls[y - 1][x].col == 0) adj.push({ x, y: y - 1 });
  if (x >= 1 && walls[y][x - 1].row == 0) adj.push({ x: x - 1, y });
  return adj;
};

const getPossibleMoves = (
  pawnPos: PawnPos,
  otherPawnPos: PawnPos,
  walls: Wall[][],
): PawnPos[] => {
  let adjs = getAdjacents(pawnPos.x, pawnPos.y, walls);

  let adjss = [];
  for (let { x, y } of adjs) {
    if (otherPawnPos.x == x && otherPawnPos.y == y) {
      x = (otherPawnPos.x - pawnPos.x) * 2;
      y = (otherPawnPos.y - pawnPos.y) * 2;
      if (x > 0) {
        // Es porque el otro esta para arriba
        if (walls[pawnPos.y][pawnPos.x + 1].row != 0 || pawnPos.x + x > 8) {
          x -= 1;
          if (walls[pawnPos.y][pawnPos.x + 1].col == 0)
            adjss.push({ x: pawnPos.x + x, y: pawnPos.y + 1 });
          if (walls[pawnPos.y - 1][pawnPos.x + 1].col == 0)
            adjss.push({ x: pawnPos.x + x, y: pawnPos.y - 1 });
        } else {
          adjss.push({ x: pawnPos.x + x, y: pawnPos.y + y });
        }
      }
      if (x < 0) {
        // Es porque el otro esta para abajo
        if (
          (pawnPos.x > 2 && walls[pawnPos.y][pawnPos.x - 2].row != 0) ||
          pawnPos.x + x < 0
        ) {
          x += 1;
          if (walls[pawnPos.y][pawnPos.x - 1].col == 0)
            adjss.push({ x: pawnPos.x + x, y: pawnPos.y + 1 });
          if (walls[pawnPos.y - 1][pawnPos.x - 1].col == 0)
            adjss.push({ x: pawnPos.x + x, y: pawnPos.y - 1 });
        } else {
          adjss.push({ x: pawnPos.x + x, y: pawnPos.y + y });
        }
      }
      if (y > 0) {
        // Es porque el otro esta para derecha
        if (walls[pawnPos.y + 1][pawnPos.x].col != 0 || pawnPos.y + y > 8) {
          y -= 1;
          if (walls[pawnPos.y + 1][pawnPos.x].row == 0)
            adjss.push({ x: pawnPos.x + 1, y: pawnPos.y + y });
          if (walls[pawnPos.y + 1][pawnPos.x - 1].row == 0)
            adjss.push({ x: pawnPos.x - 1, y: pawnPos.y + y });
        } else {
          adjss.push({ x: pawnPos.x + x, y: pawnPos.y + y });
        }
      }
      if (y < 0) {
        // Es porque el otro esta para derecha
        if (
          (pawnPos.y > 2 && walls[pawnPos.y - 2][pawnPos.x].col != 0) ||
          pawnPos.y + y < 0
        ) {
          y += 1;
          if (walls[pawnPos.y - 1][pawnPos.x].row == 0)
            adjss.push({ x: pawnPos.x + 1, y: pawnPos.y + y });
          if (walls[pawnPos.y - 1][pawnPos.x - 1].row == 0)
            adjss.push({ x: pawnPos.x - 1, y: pawnPos.y + y });
        } else {
          adjss.push({ x: pawnPos.x + x, y: pawnPos.y + y });
        }
      }
    } else {
      adjss.push({ x, y });
    }
  }
  return adjss;
};

export const dfs = (pawn: PawnPos, walls: Wall[][], end: number) => {
  const s = (x: number, y: number) => `${x}${y}`;

  const visited = new Set();
  visited.add(s(pawn.x, pawn.y));
  const stack = [pawn];
  let act;

  while (stack.length > 0) {
    act = stack.pop();
    if (!act) break;
    if (act.x == end) return true;
    getAdjacents(act.x, act.y, walls).forEach(({ x, y }) => {
      if (!visited.has(s(x, y))) {
        visited.add(s(x, y));
        stack.push({ x, y });
      }
    });
  }
  return false;
};

export const pickVerticalWall = (
  row: number,
  col: number,
  walls: Wall[][],
): boolean => {
  if (row > 7 || col > 7) return false;
  if (walls[col][row + 1].col == 1) return false;
  if (walls[col][row].col != 0) return false;
  if (walls[col][row].row == 1) return false;
  return true;
};

export const pickHorizontalWall = (
  row: number,
  col: number,
  walls: Wall[][],
): boolean => {
  if (row > 7 || col > 7) return false;
  if (walls[col + 1][row].row == 1) return false;
  if (walls[col][row].row != 0) return false;
  if (walls[col][row].col == 1) return false;
  return true;
};

export const WHITE_START = { x: 0, y: 4 };
export const BLACK_START = { x: 8, y: 4 };

export const isValidMove = (game: Game, move: string): boolean | "win" => {
  let board = matrix(9, 9);
  let blackPos: PawnPos = BLACK_START;
  let whitePos: PawnPos = WHITE_START;

  game.history.forEach((move, i) => {
    let { pos, wall } = stringToMove(move);
    if (wall) {
      if (wall.col == 1) {
        board[pos.y][pos.x].col = 1;
        board[pos.y][pos.x + 1].col = 2;
      } else {
        board[pos.y][pos.x].row = 1;
        board[pos.y + 1][pos.x].row = 2;
      }
    } else if (i % 2 == 0) {
      whitePos = pos;
    } else {
      blackPos = pos;
    }
  });

  let { pos, wall } = stringToMove(move);
  if (wall) {
    if (wall.col == 1) {
      if (pickVerticalWall(pos.x, pos.y, board)) {
        board[pos.y][pos.x] = { row: 1, col: board[pos.y][pos.x].col };
        board[pos.y + 1][pos.x] = { row: 2, col: board[pos.y + 1][pos.x].col };
      } else {
        return false;
      }
    } else {
      if (pickHorizontalWall(pos.x, pos.y, board)) {
        board[pos.y][pos.x] = { col: 1, row: board[pos.y][pos.x].row };
        board[pos.y][pos.x + 1] = { col: 2, row: board[pos.y][pos.x + 1].row };
      } else {
        return false;
      }
    }

    let whiteCanFinish = dfs(whitePos, board, 8);
    let blackCanFinish = dfs(blackPos, board, 0);
    return whiteCanFinish && blackCanFinish;
  }

  let possibleMoves: PawnPos[] = [];
  if (game.history.length % 2 == 0) {
    possibleMoves = getPossibleMoves(whitePos, blackPos, board);
  } else {
    possibleMoves = getPossibleMoves(blackPos, whitePos, board);
  }

  let end = game.history.length % 2 == 0 ? 8 : 0;

  let b = false;
  let isWinning = false;
  possibleMoves.forEach(({ x, y }) => {
    if (pos.x == x && pos.y == y) {
      b = true;
      if (x == end) isWinning = true;
    }
  });

  if (isWinning) return "win";
  return b;
};
