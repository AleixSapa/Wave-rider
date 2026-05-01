import { io, Socket } from 'socket.io-client';

export class Network {
  socket: Socket | null = null;
  roomId: string | null = null;
  players: Record<string, any> = {};
  readyPlayers: Record<string, boolean> = {};
  hostId: string | null = null;
  isMultiplayer: boolean = false;
  socketId: string | null = null;

  onRoomState?: (state: any) => void;
  onGameStarting?: (startTime: number) => void;
  onPlayersUpdate?: (players: Record<string, any>) => void;
  onPlayerReadyUpdate?: (readyPlayers: Record<string, boolean>) => void;
  onPlayerDied?: (id: string) => void;
  onGameFinished?: (finalPlayers: Record<string, any>) => void;
  onError?: (msg: string) => void;

  connect() {
    // Per GitHub Pages, hem de poder passar la URL del servidor
    const serverUrl = import.meta.env.VITE_SERVER_URL || '';
    this.socket = io(serverUrl);
    
    this.socket.on('connect', () => {
      this.socketId = this.socket?.id || null;
    });

    this.socket.on('room_created', (id: string) => {
      this.roomId = id;
      this.isMultiplayer = true;
    });

    this.socket.on('joined_room', (id: string) => {
      this.roomId = id;
      this.isMultiplayer = true;
    });

    this.socket.on('room_state', (state: any) => {
      console.log("Network: room_state received", state);
      this.players = state.players;
      this.readyPlayers = state.readyPlayers || {};
      this.hostId = state.hostId || null;
      if (this.onRoomState) this.onRoomState(state);
    });

    this.socket.on('game_starting', (startTime: number) => {
      console.log("Network: game_starting received", startTime);
      if (this.onGameStarting) this.onGameStarting(startTime);
    });

    this.socket.on('players_update', (players: Record<string, any>) => {
      console.log("Network: players_update received", players);
      for (const id in players) {
        if (players[id]) {
          this.players[id] = players[id];
        }
      }
      console.log("Network: updated players:", this.players);
      if (this.onPlayersUpdate) this.onPlayersUpdate(this.players);
    });

    this.socket.on('player_ready_update', (data: { id: string, ready: boolean }) => {
      this.readyPlayers[data.id] = data.ready;
      if (this.onPlayerReadyUpdate) this.onPlayerReadyUpdate(this.readyPlayers);
    });

    this.socket.on('player_died_event', (id: string) => {
      if (this.players[id]) {
        this.players[id].isDead = true;
      }
      if (this.onPlayerDied) this.onPlayerDied(id);
    });

    this.socket.on('game_finished', (players: Record<string, any>) => {
      if (this.onGameFinished) this.onGameFinished(players);
    });

    this.socket.on('error', (msg: string) => {
      if (this.onError) this.onError(msg);
    });
  }

  refreshRoomState() {
    if (this.roomId) {
      this.socket?.emit('get_room_state', this.roomId);
    }
  }

  createRoom(roomId?: string, playerName?: string, bike?: string) {
    this.socket?.emit('create_room', roomId, playerName, bike);
  }

  joinRoom(id: string, playerName?: string, bike?: string) {
    this.socket?.emit('join_room', id, playerName, bike);
  }

  startGame() {
    if (this.roomId) {
      this.socket?.emit('start_game', this.roomId);
    }
  }

  setReady(ready: boolean) {
    if (this.roomId) {
      this.socket?.emit('set_ready', this.roomId, ready);
    }
  }

  updatePlayer(data: any) {
    if (this.isMultiplayer && this.roomId) {
      // Throttle this in practice, but fine for now
      this.socket?.emit('update_player', this.roomId, data);
    }
  }

  notifyDeath() {
    if (this.isMultiplayer && this.roomId) {
      this.socket?.emit('player_died', this.roomId);
    }
  }
}
