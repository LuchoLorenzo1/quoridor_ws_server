import dotenv from 'dotenv';
import { createServer } from 'node:http'
import {Server, Socket} from 'socket.io'
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    data: 'Hello World!',
  }));
});

const io = new Server(server, {
	cors: {
		origin: "*"
	},
})

let playerSearching: {socket: Socket} | null

type Game = {
	id: string,
	history: string[],
	player: number
	turn: number,
}

let games: Map<string, Game> = new Map()

const isValidMove = (game: Game, move: string) => {
	return true
}

io.on('connection', (socket) => {
	socket.on("move", (move: string) => {
		let game = games.get(socket.data.matchId)
		if (!game) return
		if (socket.data.player != game.turn) return

		if (isValidMove(game, move)) {
			game.history.push(move)
			game.turn = game.turn == 1 ? 0 : 1
			socket.broadcast.to(`game-${socket.data.matchId}`).emit('move', move)
		}
	})

	socket.on("search-game", () => {
		if (!!playerSearching) {
			let id = uuidv4();

			playerSearching.socket.emit('found-game', id)
			socket.emit('found-game', id)

			socket.join(`game-${id}`);
			playerSearching.socket.join(`game-${id}`);

			let new_game: Game = { id, history: [], player: 0, turn: 0 }
			games.set(id, new_game)

			socket.data.matchId = id
			playerSearching.socket.data.matchId  = id

			playerSearching = null
		} else {
			playerSearching = {socket}
		}
	})

	socket.on("start", () => {
		let game = games.get(socket.data.matchId)
		if (!game) return

		socket.data.player = game.player
		socket.emit("start", game.player)
		game.player += 1
	})
});

console.log('server listening on 8000')
server.listen(8000);
