"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  clearPlayerSession,
  consumeFreshJoin,
  loadPlayerSession,
  savePlayerSession,
} from "@/lib/player-session";

type Player = {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  drinks?: number;
  connected?: boolean;
};

type Room = {
  id: string;
  hostId: string;
  players: Player[];
  game: string | null;
};

type ActionResponse = {
  ok: boolean;
  message?: string;
};

const GAME_OPTIONS = [
  {
    id: "higher-or-lower",
    title: "Higher or Lower",
    icon: "↕",
    description: "Build a streak without hitting a bad card.",
    accent: "from-sky-500/25 to-sky-500/5 border-sky-400/40",
  },
  {
    id: "ride-the-bus",
    title: "Ride The Bus",
    icon: "🚌",
    description: "Four questions, one unforgiving deck.",
    accent: "from-rose-500/25 to-rose-500/5 border-rose-400/40",
  },
  {
    id: "horse-racing",
    title: "Horse Racing",
    icon: "♞",
    description: "Back a suit and watch the race unfold.",
    accent: "from-violet-500/25 to-violet-500/5 border-violet-400/40",
  },
];

let socket: Socket;

interface RoomPageProps {
  params: Promise<{
    roomId: string;
  }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [message, setMessage] = useState("");
  const [myPlayerId, setMyPlayerId] = useState("");
  const [readyPending, setReadyPending] = useState(false);
  const [removingPlayerId, setRemovingPlayerId] = useState("");

  useEffect(() => {
    async function loadParams() {
      const resolvedParams = await params;
      setRoomId(resolvedParams.roomId.toUpperCase());
    }

    loadParams();
  }, [params]);

  useEffect(() => {
    socket = io();

    socket.on("player-joined", ({ roomId: joinedRoomId, playerId, name }) => {
      if (joinedRoomId) {
        savePlayerSession(joinedRoomId, playerId, name);
      }

      setMyPlayerId(playerId);
      setName(name);
    });

    socket.on("room-updated", (updatedRoom: Room) => {
      setRoom(updatedRoom);
      setJoined(true);
      setReadyPending(false);
      setRemovingPlayerId("");
      setMessage("");
    });

    socket.on("room-full", () => {
      setMessage("This room is full. Max 12 players allowed.");
    });

    socket.on("join-denied", ({ message: denialMessage }) => {
      setMessage(denialMessage || "Unable to join this room.");
    });

    socket.on("rejoin-unavailable", () => {
      setJoined(false);
      setRoom(null);
    });

    socket.on("removed-from-room", ({ roomId: removedRoomId, playerId }) => {
      clearPlayerSession(removedRoomId, playerId);
      setJoined(false);
      setRoom(null);
      setMyPlayerId("");
      setName("");
      setMessage("The host removed you from this room.");
    });

    socket.on("game-started", ({ game, roomId: startedRoomId }) => {
      window.location.href = `/games/${game}?roomId=${startedRoomId}`;
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!roomId || joined || !socket) return;

    if (consumeFreshJoin(roomId)) {
      return;
    }

    const savedSession = loadPlayerSession(roomId);

    if (savedSession.playerId && savedSession.name) {
      socket.emit("rejoin-room", {
        roomId,
        name: savedSession.name,
        playerId: savedSession.playerId,
      });
    }
  }, [roomId, joined]);

  const currentPlayer = room?.players.find(
    (player) => player.id === myPlayerId
  );

  function joinRoom() {
    const playerName = name.trim();
    if (!roomId || !playerName) return;

    const playerId = crypto.randomUUID();
    setMyPlayerId(playerId);
    setMessage("");

    socket.emit("join-room", {
      roomId,
      name: playerName,
      playerId,
    });
  }

  function toggleReady() {
    if (!currentPlayer || readyPending) return;

    setReadyPending(true);
    setRoom((currentRoom) =>
      currentRoom
        ? {
            ...currentRoom,
            players: currentRoom.players.map((player) =>
              player.id === myPlayerId
                ? { ...player, ready: !player.ready }
                : player
            ),
          }
        : currentRoom
    );

    socket.timeout(3000).emit(
      "toggle-ready",
      { roomId, playerId: myPlayerId },
      (error: Error | null, response?: ActionResponse) => {
        setReadyPending(false);

        if (error || !response?.ok) {
          setMessage(response?.message || "Could not update your ready status.");
        }
      }
    );
  }

  function selectGame(game: string) {
    socket.emit("select-game", {
      roomId,
      playerId: myPlayerId,
      game,
    });
  }

  function startGame() {
    socket.emit("start-game", {
      roomId,
      playerId: myPlayerId,
    });
  }

  function removePlayer(targetPlayer: Player) {
    if (removingPlayerId) return;

    const shouldRemove = window.confirm(
      `Remove ${targetPlayer.name} from the waiting room?`
    );

    if (!shouldRemove) return;

    setRemovingPlayerId(targetPlayer.id);
    setMessage("");

    socket.timeout(3000).emit(
      "remove-player",
      {
        roomId,
        playerId: myPlayerId,
        targetPlayerId: targetPlayer.id,
      },
      (error: Error | null, response?: ActionResponse) => {
        setRemovingPlayerId("");

        if (error || !response?.ok) {
          setMessage(response?.message || "Could not remove that player.");
        }
      }
    );
  }

  const isHost = currentPlayer?.isHost;
  const readyCount = room?.players.filter((player) => player.ready).length || 0;
  const selectedGame = GAME_OPTIONS.find((game) => game.id === room?.game);

  return (
    <main className="app-shell p-5 sm:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-300">
            Waiting room
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-5xl">
            Room <span className="text-amber-300">{roomId}</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Share this code with your friends.
          </p>
        </header>

        {!joined && (
          <section className="panel mx-auto w-full max-w-lg p-6 sm:p-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
              Choose your name
            </p>
            <h2 className="text-2xl font-extrabold">Join the table</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Your previous name is never submitted automatically when you enter a room code.
            </p>

            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                joinRoom();
              }}
            >
              <label htmlFor="player-name" className="text-sm font-semibold text-slate-300">
                Display name
              </label>
              <input
                id="player-name"
                value={name}
                maxLength={24}
                autoFocus
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter a new name"
                className="field px-4 py-3 text-lg"
              />

              <button
                type="submit"
                disabled={!name.trim()}
                className="primary-button px-6 py-3 font-extrabold"
              >
                Join Room <span aria-hidden="true">→</span>
              </button>
            </form>

            {message && (
              <p role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {message}
              </p>
            )}
          </section>
        )}

        {joined && room && (
          <>
            <section className="panel p-5 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
                    Players
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold">
                    {room.players.length} / 12 joined
                  </h2>
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm font-bold text-emerald-200">
                  {readyCount} ready
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {room.players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex min-w-0 items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                      player.id === myPlayerId
                        ? "border-amber-300/40 bg-amber-300/10"
                        : "border-white/8 bg-white/[0.035]"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-bold">{player.name}</span>
                        {player.isHost && (
                          <span title="Host" aria-label="Host">👑</span>
                        )}
                        {player.id === myPlayerId && (
                          <span className="text-xs font-semibold text-amber-200">You</span>
                        )}
                      </div>
                      <p className={`mt-0.5 text-xs ${player.connected === false ? "text-slate-500" : "text-emerald-300"}`}>
                        {player.connected === false ? "Reconnecting…" : "Online"}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        player.ready
                          ? "bg-emerald-400/15 text-emerald-200"
                          : "bg-white/5 text-slate-400"
                      }`}>
                        {player.ready ? "✓ Ready" : "Not ready"}
                      </span>

                      {isHost && !player.isHost && (
                        <button
                          type="button"
                          onClick={() => removePlayer(player)}
                          disabled={Boolean(removingPlayerId)}
                          aria-label={`Remove ${player.name}`}
                          title={`Remove ${player.name}`}
                          className="danger-icon-button h-9 w-9 rounded-full font-black"
                        >
                          {removingPlayerId === player.id ? "…" : "×"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={toggleReady}
                disabled={readyPending}
                aria-pressed={Boolean(currentPlayer?.ready)}
                className={`mt-5 w-full px-6 py-3 font-extrabold ${
                  currentPlayer?.ready ? "ready-button" : "primary-button"
                }`}
              >
                {readyPending
                  ? "Updating…"
                  : currentPlayer?.ready
                    ? "✓ You’re Ready — Tap to Undo"
                    : "I’m Ready"}
              </button>

              {message && (
                <p role="alert" className="mt-4 text-center text-sm text-rose-300">
                  {message}
                </p>
              )}
            </section>

            {isHost ? (
              <section className="panel p-5 sm:p-7">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
                    Host controls
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold">Choose a game</h2>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {GAME_OPTIONS.map((game) => {
                    const isSelected = room.game === game.id;

                    return (
                      <button
                        key={game.id}
                        type="button"
                        onClick={() => selectGame(game.id)}
                        aria-pressed={isSelected}
                        className={`rounded-2xl border bg-gradient-to-br p-4 text-left ${game.accent} ${
                          isSelected
                            ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950"
                            : "opacity-80 hover:opacity-100"
                        }`}
                      >
                        <span className="text-3xl" aria-hidden="true">{game.icon}</span>
                        <span className="mt-3 block font-extrabold">{game.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-300">
                          {game.description}
                        </span>
                        {isSelected && (
                          <span className="mt-3 block text-xs font-bold text-amber-200">✓ Selected</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={startGame}
                  disabled={!room.game}
                  className="primary-button mt-6 w-full px-6 py-3 font-extrabold"
                >
                  {selectedGame ? `Start ${selectedGame.title}` : "Select a Game to Start"}
                </button>
              </section>
            ) : (
              <section className="panel p-5 text-center text-sm text-slate-300">
                {selectedGame ? (
                  <p>
                    The host selected <strong className="text-amber-200">{selectedGame.title}</strong>.
                  </p>
                ) : (
                  <p>Waiting for the host to choose a game…</p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
