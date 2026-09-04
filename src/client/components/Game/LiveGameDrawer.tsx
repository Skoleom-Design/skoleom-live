import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Crown, Gamepad2, LogOut, Moon, UserX, WifiOff, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { getStoredUser } from '../../../shared/api/http';
import { useGameSocket, GameRole, GameType, PublicPlayer } from './useGameSocket';

const ROLE_STYLES: Record<GameRole, { ring: string; text: string; bg: string }> = {
  civilian: { ring: 'ring-white/20', text: 'text-white', bg: 'bg-white/[0.06]' },
  undercover: { ring: 'ring-[#00ffff]/40', text: 'text-[#00ffff]', bg: 'bg-[#00ffff]/[0.08]' },
  mrwhite: { ring: 'ring-red-400/40', text: 'text-red-400', bg: 'bg-red-400/[0.08]' },
  villager: { ring: 'ring-white/20', text: 'text-white', bg: 'bg-white/[0.06]' },
  werewolf: { ring: 'ring-purple-400/40', text: 'text-purple-300', bg: 'bg-purple-400/[0.08]' },
};

// Le jeu ne se lance que depuis l'interieur d'un live (voir le bouton "Jeu" sur src/pages/live/[id].tsx
// et src/pages/studio/live.tsx) — pas d'ecran /jeu autonome, pas de code a saisir : la room est
// retrouvee/creee a partir du liveId cote serveur (voir GameService.joinOrCreateLiveGame).
// `gameActive` indique qu'une partie tourne deja pour ce live (peu importe le type choisi a
// l'origine) — dans ce cas on rejoint direct, sans repasser par le choix du jeu (reserve au
// createur au tout premier lancement).
export function LiveGameDrawer({
  liveId,
  isLiveOwner,
  gameActive,
  onClose,
}: {
  liveId: string;
  isLiveOwner: boolean;
  gameActive: boolean;
  onClose: () => void;
}) {
  const { t, dict } = useLanguage();
  const game = useGameSocket();
  const me = useMemo(() => getStoredUser(), []);
  const [copied, setCopied] = useState(false);
  const [clueText, setClueText] = useState('');
  const [guessText, setGuessText] = useState('');
  const [revealBanner, setRevealBanner] = useState<string | null>(null);
  const [chosenGameType, setChosenGameType] = useState<GameType | null>(null);

  // Seul le createur, au tout premier lancement (pas encore de partie active), doit choisir le
  // jeu — sinon (rejoindre une partie deja en cours, ou etre simple spectateur) on rejoint direct,
  // le type de jeu ayant deja ete fixe a la creation de la room.
  const needsGameTypeChoice = isLiveOwner && !gameActive;

  useEffect(() => {
    if (!game.connected) return;
    if (needsGameTypeChoice) {
      if (chosenGameType) game.joinLiveGame(liveId, chosenGameType);
    } else {
      game.joinLiveGame(liveId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.connected, liveId, needsGameTypeChoice, chosenGameType]);

  useEffect(() => {
    if (!game.lastResult) return;
    const r = game.lastResult;
    setRevealBanner(
      r.tie ? t('game.reveal.tie') : `${t('game.reveal.eliminated', { name: r.username })} — ${t('game.reveal.wasRole', { role: t(`game.role.${r.role}`) })}`,
    );
    const timer = setTimeout(() => setRevealBanner(null), 4500);
    return () => clearTimeout(timer);
  }, [game.lastResult, t]);

  useEffect(() => {
    if (!game.mrWhiteResult) return;
    setRevealBanner(game.mrWhiteResult.correct ? t('game.mrWhite.correct') : t('game.mrWhite.incorrect'));
    const timer = setTimeout(() => setRevealBanner(null), 4500);
    return () => clearTimeout(timer);
  }, [game.mrWhiteResult, t]);

  function copyCode() {
    if (!game.room) return;
    navigator.clipboard?.writeText(game.room.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hide bg-[#0d0d0f] border border-white/10 rounded-[24px] p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center z-10">
          <X size={16} className="text-white" />
        </button>

        {revealBanner && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[10000] bg-[#0d0d0f] border border-white/10 rounded-2xl px-5 py-3 shadow-glow-lime-sm animate-fade-in max-w-[90vw]">
            <p className="text-white text-sm font-medium text-center">{revealBanner}</p>
          </div>
        )}

        {game.kicked ? (
          <CenteredMessage>
            <p className="text-white/70 text-sm mb-4">{t('game.lobby.kick')}</p>
            <button onClick={onClose} className="btn-skoleom px-6 py-2.5 rounded-full text-sm">
              {t('common.close')}
            </button>
          </CenteredMessage>
        ) : needsGameTypeChoice && !chosenGameType ? (
          <GameTypePicker t={t} onChoose={setChosenGameType} />
        ) : !game.connected || !game.room ? (
          <CenteredMessage>
            {game.error ? (
              <>
                <p className="text-white/50 text-sm mb-4">{game.error}</p>
                <button onClick={onClose} className="btn-skoleom px-6 py-2.5 rounded-full text-sm">
                  {t('common.close')}
                </button>
              </>
            ) : (
              <p className="text-white/40 text-sm">{t('common.loading')}</p>
            )}
          </CenteredMessage>
        ) : (
          <RoomBody
            room={game.room}
            game={game}
            me={me?.id}
            isHost={game.room.players.find((p) => p.userId === me?.id)?.isHost ?? false}
            onClose={onClose}
            copyCode={copyCode}
            copied={copied}
            clueText={clueText}
            setClueText={setClueText}
            guessText={guessText}
            setGuessText={setGuessText}
            t={t}
            dict={dict}
          />
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center min-h-[40vh] flex-col text-center px-6 gap-1">{children}</div>;
}

// Choix du jeu — uniquement propose au createur au tout premier lancement (voir needsGameTypeChoice).
function GameTypePicker({ t, onChoose }: { t: (key: string) => string; onChoose: (type: GameType) => void }) {
  return (
    <div className="pt-2">
      <div className="flex items-center gap-2 mb-6">
        <Gamepad2 size={18} className="text-[#a8ff35]" />
        <h1 className="text-lg font-bold text-white display-text">{t('game.gameType.choose')}</h1>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <button
          onClick={() => onChoose('undercover')}
          className="text-left glass-card p-5 hover:bg-white/[0.06] transition-colors border border-white/[0.08] hover:border-[#00ffff]/30 rounded-2xl"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Gamepad2 size={16} className="text-[#00ffff]" />
            <span className="text-white font-bold text-sm">{t('game.gameType.undercover')}</span>
          </div>
          <p className="text-white/40 text-xs leading-relaxed">{t('game.gameType.undercoverDesc')}</p>
        </button>
        <button
          onClick={() => onChoose('werewolf')}
          className="text-left glass-card p-5 hover:bg-white/[0.06] transition-colors border border-white/[0.08] hover:border-purple-400/30 rounded-2xl"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Moon size={16} className="text-purple-300" />
            <span className="text-white font-bold text-sm">{t('game.gameType.werewolf')}</span>
          </div>
          <p className="text-white/40 text-xs leading-relaxed">{t('game.gameType.werewolfDesc')}</p>
        </button>
      </div>
    </div>
  );
}

function RoomBody({ room, game, me, isHost, onClose, copyCode, copied, clueText, setClueText, guessText, setGuessText, t, dict }: any) {
  const alivePlayers = room.players.filter((p: PublicPlayer) => p.alive);
  const isWerewolf = room.gameType === 'werewolf';
  return (
    <div className="pt-2">
      <div className="flex items-center gap-2 mb-6">
        {isWerewolf ? <Moon size={18} className="text-purple-300" /> : <Gamepad2 size={18} className="text-[#a8ff35]" />}
        <h1 className="text-lg font-bold text-white display-text">{isWerewolf ? t('game.gameType.werewolf') : t('game.title')}</h1>
      </div>

      {game.error && (
        <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2.5 rounded-xl border border-red-400/20 mb-4">{game.error}</p>
      )}

      {room.phase === 'lobby' && (
        <LobbyView room={room} isHost={isHost} game={game} copyCode={copyCode} copied={copied} t={t} dict={dict} />
      )}
      {room.phase === 'clue' && <ClueView room={room} me={me} game={game} clueText={clueText} setClueText={setClueText} t={t} />}
      {room.phase === 'night' && <NightView room={room} me={me} game={game} t={t} />}
      {room.phase === 'voting' && <VotingView room={room} me={me} game={game} t={t} />}
      {room.phase === 'reveal' && (
        <CenteredMessage>
          <p className="text-white/40 text-sm">{t('common.loading')}</p>
        </CenteredMessage>
      )}
      {room.phase === 'mrWhiteGuess' && (
        <MrWhiteView room={room} me={me} game={game} guessText={guessText} setGuessText={setGuessText} t={t} />
      )}
      {room.phase === 'ended' && <EndedView room={room} isHost={isHost} game={game} onClose={onClose} t={t} />}

      {room.phase !== 'ended' && (
        <button
          onClick={() => {
            game.leaveRoom(room.code);
            onClose();
          }}
          className="mt-8 flex items-center gap-2 text-white/40 hover:text-white/70 text-xs transition-colors mx-auto"
        >
          <LogOut size={14} /> {t('game.lobby.leave')}
        </button>
      )}

      {alivePlayers.length > 0 && room.phase !== 'lobby' && room.phase !== 'ended' && (
        <PlayerStrip players={room.players} currentTurnUserId={room.currentTurnUserId} />
      )}
    </div>
  );
}

function Avatar({ player, size = 40 }: { player: Pick<PublicPlayer, 'username' | 'avatarUrl' | 'alive'>; size?: number }) {
  return (
    <div
      className={`rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-white/70 font-semibold shrink-0 ${!player.alive ? 'grayscale opacity-40' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {player.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={player.avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        player.username[0]?.toUpperCase()
      )}
    </div>
  );
}

function PlayerStrip({ players, currentTurnUserId }: { players: PublicPlayer[]; currentTurnUserId?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap mt-8 pt-6 border-t border-white/[0.06]">
      {players.map((p) => (
        <div key={p.userId} className="flex flex-col items-center gap-1">
          <div className={`rounded-full ${p.userId === currentTurnUserId ? 'ring-2 ring-[#a8ff35] shadow-glow-lime-sm' : ''}`}>
            <Avatar player={p} size={36} />
          </div>
          <span className={`text-[10px] max-w-[48px] truncate ${p.alive ? 'text-white/50' : 'text-white/25 line-through'}`}>{p.username}</span>
        </div>
      ))}
    </div>
  );
}

// ── Lobby ────────────────────────────────────────────────────────────
function LobbyView({ room, isHost, game, copyCode, copied, t, dict }: any) {
  const canStart = room.players.length >= 3;
  const isWerewolf = room.gameType === 'werewolf';
  const rules = isWerewolf ? dict.game.rulesWerewolf : dict.game.rules;
  const [rulesOpen, setRulesOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setRulesOpen((o) => !o)} className="text-white/40 hover:text-white/60 text-xs underline underline-offset-2 mb-4 transition-colors">
        {t('game.rulesTitle')}
      </button>
      {rulesOpen && (
        <ol className="space-y-2 mb-6 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          {rules.map((rule: string, i: number) => (
            <li key={i} className="flex gap-2.5 text-xs text-white/50 leading-relaxed">
              <span className="shrink-0 w-4 h-4 rounded-full bg-white/[0.06] text-white/50 text-[10px] font-semibold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {rule}
            </li>
          ))}
        </ol>
      )}
      <p className="text-white/40 text-sm mb-6">{t('game.lobby.shareCode')}</p>

      <button
        onClick={copyCode}
        className="w-full flex items-center justify-center gap-3 bg-white/[0.05] border border-white/[0.08] rounded-2xl py-4 mb-6 hover:bg-white/[0.08] transition-colors"
      >
        <span className="text-3xl font-bold text-white tracking-[0.3em]">{room.code}</span>
        {copied ? <Check size={18} className="text-[#a8ff35]" /> : <Copy size={18} className="text-white/40" />}
      </button>

      <div className="glass-card p-5 mb-4">
        <div className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">
          {t('game.lobby.players')} ({room.players.length})
        </div>
        <div className="space-y-2">
          {room.players.map((p: PublicPlayer) => (
            <div key={p.userId} className="flex items-center gap-3">
              <Avatar player={p} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-white text-sm font-medium truncate">{p.username}</span>
                  {p.isHost && <Crown size={13} className="text-[#faee21] shrink-0" />}
                  {!p.connected && <WifiOff size={12} className="text-white/30 shrink-0" />}
                </div>
              </div>
              {isHost && !p.isHost && (
                <button onClick={() => game.kickPlayer(room.code, p.userId)} className="text-white/25 hover:text-red-400 transition-colors" aria-label={t('game.lobby.kick')}>
                  <UserX size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-5 mb-6">
        {isWerewolf ? (
          <div className="flex items-center justify-between">
            <span className="text-white text-sm">{t('game.gameType.werewolf')}</span>
            <div className="flex items-center gap-3">
              <button
                disabled={!isHost || room.settings.werewolfCount <= 1}
                onClick={() => game.updateSettings(room.code, { werewolfCount: room.settings.werewolfCount - 1 })}
                className="w-7 h-7 rounded-full bg-white/[0.06] text-white disabled:opacity-30 flex items-center justify-center"
              >
                −
              </button>
              <span className="text-white font-semibold w-4 text-center">{room.settings.werewolfCount}</span>
              <button
                disabled={!isHost || room.settings.werewolfCount >= 4}
                onClick={() => game.updateSettings(room.code, { werewolfCount: room.settings.werewolfCount + 1 })}
                className="w-7 h-7 rounded-full bg-white/[0.06] text-white disabled:opacity-30 flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="text-white text-sm">{t('game.lobby.undercoverCount')}</span>
              <div className="flex items-center gap-3">
                <button
                  disabled={!isHost || room.settings.undercoverCount <= 1}
                  onClick={() => game.updateSettings(room.code, { undercoverCount: room.settings.undercoverCount - 1 })}
                  className="w-7 h-7 rounded-full bg-white/[0.06] text-white disabled:opacity-30 flex items-center justify-center"
                >
                  −
                </button>
                <span className="text-white font-semibold w-4 text-center">{room.settings.undercoverCount}</span>
                <button
                  disabled={!isHost || room.settings.undercoverCount >= 4}
                  onClick={() => game.updateSettings(room.code, { undercoverCount: room.settings.undercoverCount + 1 })}
                  className="w-7 h-7 rounded-full bg-white/[0.06] text-white disabled:opacity-30 flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">{t('game.lobby.mrWhiteCount')}</span>
              <button
                disabled={!isHost}
                onClick={() => game.updateSettings(room.code, { mrWhiteCount: room.settings.mrWhiteCount > 0 ? 0 : 1 })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
                  room.settings.mrWhiteCount > 0 ? 'bg-[#a8ff35] text-black' : 'bg-white/[0.06] text-white/50'
                }`}
              >
                {room.settings.mrWhiteCount > 0 ? t('game.lobby.mrWhiteEnabled') : t('game.lobby.mrWhiteDisabled')}
              </button>
            </div>
          </>
        )}
      </div>

      {isHost ? (
        <>
          <button
            onClick={() => game.startGame(room.code)}
            disabled={!canStart}
            className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime disabled:opacity-50"
          >
            {t('game.lobby.start')}
          </button>
          {!canStart && <p className="text-white/30 text-xs text-center mt-2">{t('game.lobby.notEnoughPlayers', { count: 3 })}</p>}
        </>
      ) : (
        <p className="text-white/40 text-sm text-center">{t('game.lobby.waitingForHost')}</p>
      )}
    </div>
  );
}

// ── Clue phase ───────────────────────────────────────────────────────
function ClueView({ room, me, game, clueText, setClueText, t }: any) {
  const isMyTurn = room.currentTurnUserId === me;
  const yourInfo = game.yourInfo;
  const roleStyle = yourInfo?.role ? ROLE_STYLES[yourInfo.role as GameRole] : ROLE_STYLES.civilian;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clueText.trim()) return;
    game.submitClue(room.code, clueText.trim());
    setClueText('');
  }

  return (
    <div>
      <h2 className="text-base font-bold text-white mb-6">{t('game.clue.title', { round: room.round })}</h2>

      {yourInfo && (
        <div className={`rounded-2xl p-5 mb-6 ring-1 ${roleStyle.ring} ${roleStyle.bg}`}>
          <div className="text-white/40 text-[11px] uppercase tracking-wider mb-1">{t('game.role.yourRole')}</div>
          <div className={`text-lg font-bold mb-2 ${roleStyle.text}`}>{t(`game.role.${yourInfo.role}`)}</div>
          {yourInfo.word ? (
            <>
              <div className="text-white/40 text-[11px] uppercase tracking-wider mb-1">{t('game.role.yourWord')}</div>
              <div className="text-2xl font-bold text-white mb-3">{yourInfo.word}</div>
            </>
          ) : null}
          <p className="text-white/40 text-xs leading-relaxed">{t(`game.role.${yourInfo.role}Explain`)}</p>
        </div>
      )}

      <div className="glass-card p-5 mb-6 space-y-3 max-h-64 overflow-y-auto">
        {room.clues.length === 0 && <p className="text-white/30 text-sm text-center py-4">…</p>}
        {room.clues.map((c: any, i: number) => (
          <div key={i} className="flex items-baseline gap-2">
            <span className="text-white/50 text-xs font-medium shrink-0">{c.username}</span>
            <span className="text-white text-sm">{c.clue}</span>
          </div>
        ))}
      </div>

      {isMyTurn ? (
        <form onSubmit={submit} className="flex gap-2">
          <input
            autoFocus
            value={clueText}
            onChange={(e) => setClueText(e.target.value)}
            placeholder={t('game.clue.placeholder')}
            maxLength={60}
            className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-1 focus:ring-[#a8ff35]/50 focus:border-[#a8ff35]/30"
          />
          <button type="submit" disabled={!clueText.trim()} className="btn-skoleom px-5 rounded-xl disabled:opacity-60 shrink-0 text-sm">
            {t('game.clue.submit')}
          </button>
        </form>
      ) : (
        <p className="text-white/40 text-sm text-center">
          {t('game.clue.waitingFor', { name: room.players.find((p: PublicPlayer) => p.userId === room.currentTurnUserId)?.username ?? '' })}
        </p>
      )}
    </div>
  );
}

// ── Night phase (Loup-Garou) ─────────────────────────────────────────
// Seuls les loups voient la grille de cible + votent ; les villageois attendent, sans savoir qui
// est loup (meme principe que le vote de jour, mais restreint et anonyme pour les non-loups).
function NightView({ room, me, game, t }: any) {
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const yourInfo = game.yourInfo;
  const isWolf = yourInfo?.role === 'werewolf';
  const alivePlayers = room.players.filter((p: PublicPlayer) => p.alive);
  const targetablePlayers = alivePlayers.filter((p: PublicPlayer) => p.userId !== me);

  function choose(targetUserId: string) {
    setVotedFor(targetUserId);
    game.submitNightKill(room.code, targetUserId);
  }

  return (
    <CenteredMessage>
      <Moon size={28} className="text-purple-300 mb-2" />
      <h2 className="text-base font-bold text-white mb-1">{t('game.night.title', { round: room.round })}</h2>
      {isWolf ? (
        <>
          <p className="text-white/50 text-sm mb-2">{t('game.night.chooseVictim')}</p>
          <p className="text-white/30 text-xs mb-5">{t('game.night.received', { count: room.nightVotesReceived ?? 0, total: room.nightWolvesCount ?? 0 })}</p>
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
            {targetablePlayers
              .filter((p: PublicPlayer) => !room.players.find((pl: any) => pl.userId === p.userId && pl.role === 'werewolf'))
              .map((p: PublicPlayer) => (
                <button
                  key={p.userId}
                  onClick={() => choose(p.userId)}
                  className={`flex flex-col items-center gap-2 py-5 rounded-2xl border transition-all ${
                    votedFor === p.userId ? 'border-purple-400 bg-purple-400/10' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <Avatar player={p} size={48} />
                  <span className="text-white text-sm font-medium">{p.username}</span>
                </button>
              ))}
          </div>
        </>
      ) : (
        <p className="text-white/40 text-sm">{t('game.night.wolvesChoosing')}</p>
      )}
    </CenteredMessage>
  );
}

// ── Voting phase ─────────────────────────────────────────────────────
function VotingView({ room, me, game, t }: any) {
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const alivePlayers = room.players.filter((p: PublicPlayer) => p.alive);

  function vote(targetUserId: string) {
    setVotedFor(targetUserId);
    game.submitVote(room.code, targetUserId);
  }

  return (
    <div>
      <h2 className="text-base font-bold text-white mb-1">{t('game.voting.title')}</h2>
      <p className="text-white/40 text-sm mb-6">{t('game.voting.received', { count: room.votesReceived ?? 0, total: alivePlayers.length })}</p>

      <div className="grid grid-cols-2 gap-3">
        {alivePlayers
          .filter((p: PublicPlayer) => p.userId !== me)
          .map((p: PublicPlayer) => (
            <button
              key={p.userId}
              onClick={() => vote(p.userId)}
              className={`flex flex-col items-center gap-2 py-5 rounded-2xl border transition-all ${
                votedFor === p.userId ? 'border-[#a8ff35] bg-[#a8ff35]/10 shadow-glow-lime-sm' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <Avatar player={p} size={48} />
              <span className="text-white text-sm font-medium">{p.username}</span>
            </button>
          ))}
      </div>
      {votedFor && <p className="text-[#a8ff35] text-xs text-center mt-4">{t('game.voting.voted')}</p>}
    </div>
  );
}

// ── Mr. White guess ──────────────────────────────────────────────────
function MrWhiteView({ room, me, game, guessText, setGuessText, t }: any) {
  const isMe = room.mrWhiteGuessUserId === me;
  const target = room.players.find((p: PublicPlayer) => p.userId === room.mrWhiteGuessUserId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!guessText.trim()) return;
    game.mrWhiteGuess(room.code, guessText.trim());
  }

  return (
    <CenteredMessage>
      <p className="text-red-400 font-semibold mb-2">{t('game.mrWhite.turn')}</p>
      {isMe ? (
        <>
          <p className="text-white/60 text-sm mb-5">{t('game.mrWhite.prompt')}</p>
          <form onSubmit={submit} className="flex gap-2 w-full max-w-xs">
            <input
              autoFocus
              value={guessText}
              onChange={(e) => setGuessText(e.target.value)}
              placeholder={t('game.mrWhite.guessPlaceholder')}
              className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm text-center focus:outline-none focus:ring-1 focus:ring-red-400/50 focus:border-red-400/30"
            />
            <button type="submit" disabled={!guessText.trim()} className="btn-skoleom px-5 rounded-xl disabled:opacity-60 text-sm">
              {t('game.mrWhite.submit')}
            </button>
          </form>
        </>
      ) : (
        <p className="text-white/40 text-sm">{t('game.mrWhite.waitingGuess', { name: target?.username ?? t('game.role.mrwhite') })}</p>
      )}
    </CenteredMessage>
  );
}

// ── Game over ────────────────────────────────────────────────────────
function EndedView({ room, isHost, game, onClose, t }: any) {
  const isWerewolf = room.gameType === 'werewolf';
  const winnerKey = isWerewolf
    ? room.winner === 'villagers' ? 'villagersWin' : 'werewolvesWin'
    : room.winner === 'civilians' ? 'civiliansWin' : room.winner === 'mrwhite' ? 'mrwhiteWin' : 'undercoverWin';
  return (
    <div className="text-center">
      <h2 className="text-xl font-bold text-white mb-2 display-text">{t(`game.over.${winnerKey}`)}</h2>
      {!isWerewolf && (
        <>
          <p className="text-white/50 text-sm mb-1">{t('game.over.wordWas', { word: room.civilianWordReveal })}</p>
          <p className="text-white/50 text-sm mb-8">{t('game.over.undercoverWordWas', { word: room.undercoverWordReveal })}</p>
        </>
      )}
      {isWerewolf && <div className="mb-8" />}

      <div className="glass-card p-5 mb-6 text-left">
        <div className="space-y-3">
          {(room.finalRoles ?? []).map((p: any) => {
            const style = ROLE_STYLES[(p.role as GameRole) ?? 'civilian'];
            return (
              <div key={p.userId} className="flex items-center justify-between">
                <span className="text-white text-sm">{p.username}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}>
                  {t(`game.role.${p.role}`)}
                  {p.word ? ` · ${p.word}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {isHost ? (
        <button onClick={() => game.newRound(room.code)} className="btn-skoleom w-full py-3.5 rounded-full text-sm shadow-glow-lime-sm hover:shadow-glow-lime">
          {t('game.over.playAgain')}
        </button>
      ) : (
        <p className="text-white/40 text-sm mb-4">{t('game.lobby.waitingForHost')}</p>
      )}
      <button onClick={onClose} className="mt-4 text-white/40 hover:text-white/70 text-xs transition-colors">
        {t('common.close')}
      </button>
    </div>
  );
}
