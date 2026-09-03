import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken } from '../../../shared/api/http';

// Namespace dedie /game, distinct de /rt (canal global) et du socket par-defaut des lives — voir
// src/shared/api/realtime.ts pour le pendant "canal global" de ce meme pattern.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export type GamePhase = 'lobby' | 'clue' | 'voting' | 'reveal' | 'mrWhiteGuess' | 'ended';
export type GameRole = 'civilian' | 'undercover' | 'mrwhite';

export interface GameSettings {
  undercoverCount: number;
  mrWhiteCount: number;
}

export interface PublicPlayer {
  userId: string;
  username: string;
  avatarUrl?: string;
  isHost: boolean;
  alive: boolean;
  connected: boolean;
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

export interface RoomState {
  code: string;
  phase: GamePhase;
  round: number;
  settings: GameSettings;
  players: PublicPlayer[];
  turnOrder: string[];
  currentTurnUserId?: string;
  clues: RoundClue[];
  votesReceived?: number;
  history: EliminationRecord[];
  mrWhiteGuessUserId?: string;
  winner?: 'civilians' | 'undercover' | 'mrwhite';
  civilianWordReveal?: string;
  undercoverWordReveal?: string;
  finalRoles?: { userId: string; username: string; role?: GameRole; word?: string }[];
}

export interface YourInfo {
  role?: GameRole;
  word?: string;
}

export interface MrWhiteResult {
  userId: string;
  guess: string;
  correct: boolean;
}

export function useGameSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [yourInfo, setYourInfo] = useState<YourInfo | null>(null);
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState<EliminationRecord | null>(null);
  const [mrWhiteResult, setMrWhiteResult] = useState<MrWhiteResult | null>(null);
  const [kicked, setKicked] = useState(false);

  useEffect(() => {
    const socket = io(`${API_URL}/game`, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('roomState', (state: RoomState) => setRoom(state));
    socket.on('yourInfo', (info: YourInfo) => setYourInfo(info));
    socket.on('roundResult', (r: EliminationRecord) => setLastResult(r));
    socket.on('mrWhiteResult', (r: MrWhiteResult) => setMrWhiteResult(r));
    socket.on('gameError', ({ message }: { message: string }) => setError(message));
    socket.on('kicked', () => setKicked(true));
    return () => {
      socket.disconnect();
    };
  }, []);

  const emit = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    socketRef.current?.emit(event, { token: getToken(), ...payload });
  }, []);

  return {
    connected,
    room,
    yourInfo,
    error,
    lastResult,
    mrWhiteResult,
    kicked,
    clearError: () => setError(''),
    joinLiveGame: (liveId: string) => emit('joinLiveGame', { liveId }),
    leaveRoom: (code: string) => emit('leaveRoom', { code }),
    updateSettings: (code: string, settings: GameSettings) => emit('updateSettings', { code, settings }),
    startGame: (code: string) => emit('startGame', { code }),
    submitClue: (code: string, clue: string) => emit('submitClue', { code, clue }),
    submitVote: (code: string, targetUserId: string) => emit('submitVote', { code, targetUserId }),
    mrWhiteGuess: (code: string, guess: string) => emit('mrWhiteGuess', { code, guess }),
    kickPlayer: (code: string, targetUserId: string) => emit('kickPlayer', { code, targetUserId }),
    newRound: (code: string) => emit('newRound', { code }),
  };
}
