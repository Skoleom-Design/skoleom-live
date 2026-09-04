import { Injectable } from '@nestjs/common';
import { WordPair, pickRandomPair } from './word-bank';

export type GamePhase = 'lobby' | 'clue' | 'night' | 'voting' | 'reveal' | 'mrWhiteGuess' | 'ended';
export type GameRole = 'civilian' | 'undercover' | 'mrwhite' | 'villager' | 'werewolf';
export type GameType = 'undercover' | 'werewolf';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I, ambigus a l'oral

export interface GamePlayer {
  userId: string;
  username: string;
  avatarUrl?: string;
  socketId: string | null;
  isHost: boolean;
  role?: GameRole;
  word?: string;
  alive: boolean;
  connected: boolean;
}

export interface GameSettings {
  undercoverCount: number;
  mrWhiteCount: number;
  werewolfCount: number;
}

export interface RoundClue {
  userId: string;
  username: string;
  clue: string;
}

export interface EliminationRecord {
  userId: string;
  username: string;
  role: GameRole;
  word?: string;
  votes: number;
  tie: boolean;
}

export interface GameRoom {
  code: string;
  gameType: GameType;
  players: Map<string, GamePlayer>;
  phase: GamePhase;
  settings: GameSettings;
  round: number;
  turnOrder: string[];
  turnIndex: number;
  clues: RoundClue[];
  votes: Map<string, string>;
  nightVotes: Map<string, string>; // loups-garous uniquement, phase 'night'
  civilianWord?: string;
  undercoverWord?: string;
  lastPair?: WordPair;
  history: EliminationRecord[];
  mrWhiteGuessUserId?: string;
  winner?: 'civilians' | 'undercover' | 'mrwhite' | 'villagers' | 'werewolves';
  createdAt: number;
}

export class GameError extends Error {}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Etat de partie garde entierement en memoire (rooms ephemeres, pas de persistance) — coherent
// avec un party game a code qui n'a pas vocation a survivre au redemarrage du serveur, contrairement
// aux lives/encheres qui ont leur propre historique en base (voir lives.service.ts).
@Injectable()
export class GameService {
  private rooms = new Map<string, GameRoom>();
  // Un live n'a jamais qu'une seule partie a la fois — cette table associe liveId -> code de
  // room, pour que les spectateurs rejoignent sans jamais manipuler de code (voir joinOrCreateLiveGame).
  private liveRooms = new Map<string, string>();

  private generateCode(): string {
    let code: string;
    do {
      code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  createRoom(host: { userId: string; username: string; avatarUrl?: string }, socketId: string, gameType: GameType): GameRoom {
    const code = this.generateCode();
    const room: GameRoom = {
      code,
      gameType,
      players: new Map([[host.userId, {
        userId: host.userId,
        username: host.username,
        avatarUrl: host.avatarUrl,
        socketId,
        isHost: true,
        alive: true,
        connected: true,
      }]]),
      phase: 'lobby',
      settings: { undercoverCount: 1, mrWhiteCount: 0, werewolfCount: 1 },
      round: 0,
      turnOrder: [],
      turnIndex: 0,
      clues: [],
      votes: new Map(),
      nightVotes: new Map(),
      history: [],
      createdAt: Date.now(),
    };
    this.rooms.set(code, room);
    return room;
  }

  // Rejoindre gere aussi le cas "reconnexion" (meme userId deja present, ex: refresh de page) —
  // on remet juste a jour son socket au lieu de refuser un doublon.
  joinRoom(code: string, player: { userId: string; username: string; avatarUrl?: string }, socketId: string): GameRoom {
    const room = this.mustGetRoom(code);
    const existing = room.players.get(player.userId);
    if (existing) {
      existing.socketId = socketId;
      existing.connected = true;
      return room;
    }
    if (room.phase !== 'lobby') {
      throw new GameError('La partie a déjà commencé.');
    }
    if (room.players.size >= MAX_PLAYERS) {
      throw new GameError(`Cette partie a atteint son maximum de ${MAX_PLAYERS} joueurs.`);
    }
    room.players.set(player.userId, {
      userId: player.userId,
      username: player.username,
      avatarUrl: player.avatarUrl,
      socketId,
      isHost: false,
      alive: true,
      connected: true,
    });
    return room;
  }

  // Point d'entree utilise depuis un live (voir GameGateway.handleJoinLiveGame) : pas de code a
  // saisir, la room est retrouvee/creee a partir du liveId. Seul le createur du live peut demarrer
  // une nouvelle partie ; un spectateur qui arrive avant que ce soit fait reçoit une GameError.
  joinOrCreateLiveGame(
    liveId: string,
    isLiveCreator: boolean,
    player: { userId: string; username: string; avatarUrl?: string },
    socketId: string,
    gameType: GameType,
  ): { room: GameRoom; created: boolean } {
    const existingCode = this.liveRooms.get(liveId);
    if (existingCode && this.rooms.has(existingCode)) {
      return { room: this.joinRoom(existingCode, player, socketId), created: false };
    }
    if (!isLiveCreator) {
      throw new GameError("Le créateur n'a pas encore lancé de partie.");
    }
    const room = this.createRoom(player, socketId, gameType);
    this.liveRooms.set(liveId, room.code);
    return { room, created: true };
  }

  // Depart volontaire (bouton "Quitter") — different d'une simple deconnexion reseau (voir
  // markDisconnected) : ici le joueur est retire pour de bon.
  leaveRoom(code: string, userId: string): GameRoom | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    room.players.delete(userId);
    if (room.players.size === 0) {
      this.rooms.delete(room.code);
      for (const [liveId, code] of this.liveRooms.entries()) {
        if (code === room.code) this.liveRooms.delete(liveId);
      }
      return null;
    }
    if (!room.players.has(this.hostId(room)) && room.players.size > 0) {
      // Ne devrait pas arriver (hostId provient toujours d'un joueur present) — filet de securite.
    }
    // Si l'hote part, le prochain joueur (ordre d'insertion) recupere l'hebergement.
    const stillHasHost = [...room.players.values()].some((p) => p.isHost);
    if (!stillHasHost) {
      const next = room.players.values().next().value as GamePlayer | undefined;
      if (next) next.isHost = true;
    }
    if (room.phase !== 'lobby') {
      this.reconcileAfterPlayerRemoved(room);
    }
    return room;
  }

  markDisconnected(code: string, userId: string): GameRoom | undefined {
    const room = this.rooms.get(code.toUpperCase());
    const player = room?.players.get(userId);
    if (player) player.connected = false;
    return room;
  }

  private hostId(room: GameRoom): string {
    return [...room.players.values()].find((p) => p.isHost)?.userId ?? '';
  }

  updateSettings(code: string, userId: string, settings: Partial<GameSettings>): GameRoom {
    const room = this.mustGetRoom(code);
    this.assertHost(room, userId);
    if (room.phase !== 'lobby') throw new GameError('Impossible de changer les réglages, la partie a commencé.');
    if (room.gameType === 'werewolf') {
      const werewolfCount = Math.max(1, Math.min(4, Math.floor(settings.werewolfCount ?? room.settings.werewolfCount)));
      room.settings = { ...room.settings, werewolfCount };
    } else {
      const undercoverCount = Math.max(1, Math.min(4, Math.floor(settings.undercoverCount ?? room.settings.undercoverCount)));
      const mrWhiteCount = Math.max(0, Math.min(1, Math.floor(settings.mrWhiteCount ?? room.settings.mrWhiteCount)));
      room.settings = { ...room.settings, undercoverCount, mrWhiteCount };
    }
    return room;
  }

  startGame(code: string, userId: string): GameRoom {
    const room = this.mustGetRoom(code);
    this.assertHost(room, userId);
    if (room.phase !== 'lobby') throw new GameError('La partie a déjà commencé.');

    const players = [...room.players.values()];
    if (players.length < MIN_PLAYERS) {
      throw new GameError(`Il faut au moins ${MIN_PLAYERS} joueurs pour commencer.`);
    }

    if (room.gameType === 'werewolf') {
      const werewolfCount = Math.min(room.settings.werewolfCount, Math.floor((players.length - 1) / 2) || 1);
      if (werewolfCount >= players.length) throw new GameError('Trop de loups-garous pour ce nombre de joueurs.');

      const shuffled = shuffle(players);
      const roles: GameRole[] = [
        ...Array(werewolfCount).fill('werewolf'),
        ...Array(shuffled.length - werewolfCount).fill('villager'),
      ];
      shuffled.forEach((p, i) => {
        p.role = roles[i];
        p.word = undefined;
        p.alive = true;
      });

      room.round = 1;
      room.turnOrder = [];
      room.turnIndex = 0;
      room.clues = [];
      room.votes = new Map();
      room.nightVotes = new Map();
      room.history = [];
      room.winner = undefined;
      room.mrWhiteGuessUserId = undefined;
      room.phase = 'night';
      return room;
    }

    const special = room.settings.undercoverCount + room.settings.mrWhiteCount;
    if (special >= players.length - 1) {
      throw new GameError('Trop d\'undercover/Mr. White pour ce nombre de joueurs.');
    }

    const pair = pickRandomPair(room.lastPair);
    room.lastPair = pair;
    room.civilianWord = pair.civilian;
    room.undercoverWord = pair.undercover;

    const shuffled = shuffle(players);
    const roles: GameRole[] = [
      ...Array(room.settings.undercoverCount).fill('undercover'),
      ...Array(room.settings.mrWhiteCount).fill('mrwhite'),
      ...Array(shuffled.length - special).fill('civilian'),
    ];
    shuffled.forEach((p, i) => {
      p.role = roles[i];
      p.word = roles[i] === 'civilian' ? pair.civilian : roles[i] === 'undercover' ? pair.undercover : undefined;
      p.alive = true;
    });

    room.round = 1;
    room.turnOrder = shuffle(players.map((p) => p.userId));
    room.turnIndex = 0;
    room.clues = [];
    room.votes = new Map();
    room.history = [];
    room.winner = undefined;
    room.mrWhiteGuessUserId = undefined;
    room.phase = 'clue';
    return room;
  }

  // Phase de nuit (Loup-Garou uniquement) — les loups choisissent collectivement une victime,
  // meme mecanisme de majorite que le vote de jour (submitVote/resolveVoting) mais restreint aux
  // joueurs vivants avec le role 'werewolf', et sans possibilite de s'auto-designer.
  submitNightKill(code: string, userId: string, targetUserId: string): GameRoom {
    const room = this.mustGetRoom(code);
    if (room.gameType !== 'werewolf' || room.phase !== 'night') {
      throw new GameError("Ce n'est pas la phase de nuit.");
    }
    const wolf = this.mustGetPlayer(room, userId);
    if (!wolf.alive || wolf.role !== 'werewolf') {
      throw new GameError('Seuls les loups-garous choisissent une victime.');
    }
    const target = room.players.get(targetUserId);
    if (!target || !target.alive || target.role === 'werewolf') {
      throw new GameError('Cible invalide.');
    }

    room.nightVotes.set(userId, targetUserId);
    const aliveWolves = [...room.players.values()].filter((p) => p.alive && p.role === 'werewolf').map((p) => p.userId);
    if (aliveWolves.every((id) => room.nightVotes.has(id))) {
      this.resolveNightKill(room);
    }
    return room;
  }

  private resolveNightKill(room: GameRoom) {
    const tally = new Map<string, number>();
    for (const targetId of room.nightVotes.values()) {
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    }
    let max = 0;
    for (const count of tally.values()) max = Math.max(max, count);
    const topTargets = [...tally.entries()].filter(([, count]) => count === max).map(([id]) => id);
    const victimId = topTargets[Math.floor(Math.random() * topTargets.length)];
    const victim = room.players.get(victimId)!;
    victim.alive = false;
    room.history.push({ userId: victim.userId, username: victim.username, role: victim.role!, votes: max, tie: false });
    room.nightVotes = new Map();

    const winner = this.computeWinner(room);
    if (winner) {
      room.winner = winner;
      room.phase = 'ended';
      return;
    }
    room.phase = 'voting';
    room.votes = new Map();
  }

  submitClue(code: string, userId: string, clue: string): GameRoom {
    const room = this.mustGetRoom(code);
    if (room.phase !== 'clue') throw new GameError("Ce n'est pas le moment de donner un indice.");
    const player = this.mustGetPlayer(room, userId);
    if (!player.alive) throw new GameError('Tu as été éliminé, tu ne peux plus jouer ce tour.');
    if (room.turnOrder[room.turnIndex] !== userId) throw new GameError("Ce n'est pas ton tour.");
    const text = clue.trim().slice(0, 60);
    if (!text) throw new GameError('Indice vide.');

    room.clues.push({ userId, username: player.username, clue: text });
    room.turnIndex += 1;
    if (room.turnIndex >= room.turnOrder.length) {
      room.phase = 'voting';
      room.votes = new Map();
    }
    return room;
  }

  submitVote(code: string, userId: string, targetUserId: string): GameRoom {
    const room = this.mustGetRoom(code);
    if (room.phase !== 'voting') throw new GameError("Ce n'est pas le moment de voter.");
    const voter = this.mustGetPlayer(room, userId);
    if (!voter.alive) throw new GameError('Tu as été éliminé, tu ne peux plus voter.');
    if (targetUserId === userId) throw new GameError('Tu ne peux pas voter pour toi-même.');
    const target = room.players.get(targetUserId);
    if (!target || !target.alive) throw new GameError('Cible de vote invalide.');

    room.votes.set(userId, targetUserId);
    const aliveIds = [...room.players.values()].filter((p) => p.alive).map((p) => p.userId);
    if (aliveIds.every((id) => room.votes.has(id))) {
      this.resolveVoting(room);
    }
    return room;
  }

  private resolveVoting(room: GameRoom) {
    const tally = new Map<string, number>();
    for (const targetId of room.votes.values()) {
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    }
    let max = 0;
    for (const count of tally.values()) max = Math.max(max, count);
    const topTargets = [...tally.entries()].filter(([, count]) => count === max).map(([id]) => id);
    const tie = topTargets.length !== 1;

    room.phase = 'reveal';
    if (tie) {
      room.history.push({ userId: '', username: '', role: 'civilian', votes: max, tie: true });
      this.startNextRoundOrEnd(room);
      return;
    }

    const eliminatedId = topTargets[0];
    const eliminated = room.players.get(eliminatedId)!;
    eliminated.alive = false;
    room.history.push({
      userId: eliminated.userId,
      username: eliminated.username,
      role: eliminated.role!,
      word: eliminated.word,
      votes: max,
      tie: false,
    });

    if (eliminated.role === 'mrwhite') {
      room.phase = 'mrWhiteGuess';
      room.mrWhiteGuessUserId = eliminated.userId;
      return;
    }
    this.startNextRoundOrEnd(room);
  }

  mrWhiteGuess(code: string, userId: string, guess: string): GameRoom {
    const room = this.mustGetRoom(code);
    if (room.phase !== 'mrWhiteGuess' || room.mrWhiteGuessUserId !== userId) {
      throw new GameError("Ce n'est pas à toi de deviner.");
    }
    const normalize = (s: string) => s.trim().toLowerCase();
    if (normalize(guess) === normalize(room.civilianWord ?? '')) {
      room.winner = 'mrwhite';
      room.phase = 'ended';
      return room;
    }
    room.mrWhiteGuessUserId = undefined;
    this.startNextRoundOrEnd(room);
    return room;
  }

  // Exclusion definitive d'un joueur par l'hote — a la difference d'une deconnexion reseau
  // (markDisconnected), la partie ne reste jamais bloquee a l'attendre : son tour/vote est
  // immediatement recalcule comme s'il n'avait jamais ete la.
  kickPlayer(code: string, hostUserId: string, targetUserId: string): GameRoom {
    const room = this.mustGetRoom(code);
    this.assertHost(room, hostUserId);
    if (targetUserId === hostUserId) throw new GameError("Tu ne peux pas t'exclure toi-même.");
    if (!room.players.has(targetUserId)) return room;

    if (room.phase === 'lobby') {
      room.players.delete(targetUserId);
      return room;
    }

    const target = room.players.get(targetUserId)!;
    const wasAlive = target.alive;
    target.alive = false;
    target.connected = false;

    if (room.phase === 'mrWhiteGuess' && room.mrWhiteGuessUserId === targetUserId) {
      room.mrWhiteGuessUserId = undefined;
      this.startNextRoundOrEnd(room);
      return room;
    }
    if (!wasAlive) return room;

    if (room.phase === 'clue') {
      const idx = room.turnOrder.indexOf(targetUserId);
      if (idx !== -1 && idx < room.turnIndex) {
        // deja passe, rien a faire d'autre que retirer son statut vivant
      } else if (idx === room.turnIndex) {
        room.turnOrder.splice(idx, 1);
        if (room.turnIndex >= room.turnOrder.length) {
          room.phase = 'voting';
          room.votes = new Map();
        }
      } else if (idx > room.turnIndex) {
        room.turnOrder.splice(idx, 1);
      }
    } else if (room.phase === 'voting') {
      room.votes.delete(targetUserId);
      const aliveIds = [...room.players.values()].filter((p) => p.alive).map((p) => p.userId);
      if (aliveIds.length > 0 && aliveIds.every((id) => room.votes.has(id))) {
        this.resolveVoting(room);
        return room;
      }
    } else if (room.phase === 'night') {
      room.nightVotes.delete(targetUserId);
      const aliveWolves = [...room.players.values()].filter((p) => p.alive && p.role === 'werewolf').map((p) => p.userId);
      if (aliveWolves.length > 0 && aliveWolves.every((id) => room.nightVotes.has(id))) {
        this.resolveNightKill(room);
        return room;
      }
    }
    this.checkWinConditionInPlace(room);
    return room;
  }

  private reconcileAfterPlayerRemoved(room: GameRoom) {
    this.checkWinConditionInPlace(room);
  }

  // Verifie la condition de victoire sans forcer de nouvelle manche — utilisee quand un joueur
  // part/est exclu en cours de manche (contrairement a startNextRoundOrEnd, appelee apres une
  // elimination normale par vote, qui elle doit toujours soit terminer soit relancer une manche).
  private checkWinConditionInPlace(room: GameRoom) {
    const winner = this.computeWinner(room);
    if (winner) {
      room.winner = winner;
      room.phase = 'ended';
    }
  }

  private computeWinner(room: GameRoom): GameRoom['winner'] | undefined {
    const alive = [...room.players.values()].filter((p) => p.alive);
    if (room.gameType === 'werewolf') {
      const wolves = alive.filter((p) => p.role === 'werewolf').length;
      const villagers = alive.filter((p) => p.role === 'villager').length;
      if (wolves === 0) return 'villagers';
      if (wolves >= villagers) return 'werewolves';
      return undefined;
    }
    const infiltrators = alive.filter((p) => p.role === 'undercover' || p.role === 'mrwhite').length;
    const civilians = alive.filter((p) => p.role === 'civilian').length;
    if (infiltrators === 0) return 'civilians';
    if (infiltrators >= civilians) return 'undercover';
    return undefined;
  }

  private startNextRoundOrEnd(room: GameRoom) {
    const winner = this.computeWinner(room);
    if (winner) {
      room.winner = winner;
      room.phase = 'ended';
      return;
    }
    room.round += 1;
    if (room.gameType === 'werewolf') {
      room.nightVotes = new Map();
      room.phase = 'night';
      return;
    }
    room.turnOrder = shuffle([...room.players.values()].filter((p) => p.alive).map((p) => p.userId));
    room.turnIndex = 0;
    room.clues = [];
    room.votes = new Map();
    room.phase = 'clue';
  }

  // Permet a l'hote de relancer une manche dans la meme room (memes joueurs, meme code) une fois
  // la partie terminee, plutot que d'obliger tout le monde a repartager un nouveau code.
  resetToLobby(code: string, userId: string): GameRoom {
    const room = this.mustGetRoom(code);
    this.assertHost(room, userId);
    if (room.phase !== 'ended') throw new GameError('La partie est en cours.');
    room.phase = 'lobby';
    room.round = 0;
    room.turnOrder = [];
    room.turnIndex = 0;
    room.clues = [];
    room.votes = new Map();
    room.nightVotes = new Map();
    room.history = [];
    room.winner = undefined;
    room.mrWhiteGuessUserId = undefined;
    for (const p of room.players.values()) {
      p.alive = true;
      p.role = undefined;
      p.word = undefined;
    }
    return room;
  }

  // Snapshot public envoye a tout le monde — ne contient jamais role/word d'un joueur vivant
  // (voir getPrivateInfo pour ca), seulement ce qui doit etre visible de tous.
  getPublicState(room: GameRoom) {
    return {
      code: room.code,
      gameType: room.gameType,
      phase: room.phase,
      round: room.round,
      settings: room.settings,
      players: [...room.players.values()].map((p) => ({
        userId: p.userId,
        username: p.username,
        avatarUrl: p.avatarUrl,
        isHost: p.isHost,
        alive: p.alive,
        connected: p.connected,
      })),
      turnOrder: room.turnOrder,
      currentTurnUserId: room.phase === 'clue' ? room.turnOrder[room.turnIndex] : undefined,
      clues: room.clues,
      votesReceived: room.phase === 'voting' ? room.votes.size : undefined,
      nightVotesReceived: room.phase === 'night' ? room.nightVotes.size : undefined,
      nightWolvesCount: room.phase === 'night' ? [...room.players.values()].filter((p) => p.alive && p.role === 'werewolf').length : undefined,
      history: room.history,
      mrWhiteGuessUserId: room.mrWhiteGuessUserId,
      winner: room.winner,
      civilianWordReveal: room.phase === 'ended' ? room.civilianWord : undefined,
      undercoverWordReveal: room.phase === 'ended' ? room.undercoverWord : undefined,
      finalRoles: room.phase === 'ended'
        ? [...room.players.values()].map((p) => ({ userId: p.userId, username: p.username, role: p.role, word: p.word }))
        : undefined,
    };
  }

  getPrivateInfo(room: GameRoom, userId: string) {
    const player = room.players.get(userId);
    if (!player) return null;
    return { role: player.role, word: player.word };
  }

  private mustGetRoom(code: string): GameRoom {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new GameError('Partie introuvable.');
    return room;
  }

  private mustGetPlayer(room: GameRoom, userId: string): GamePlayer {
    const player = room.players.get(userId);
    if (!player) throw new GameError("Tu ne fais pas partie de cette partie.");
    return player;
  }

  private assertHost(room: GameRoom, userId: string) {
    const player = room.players.get(userId);
    if (!player?.isHost) throw new GameError("Seul l'hôte peut faire ça.");
  }
}
