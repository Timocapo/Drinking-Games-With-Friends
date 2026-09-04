"use client";

import { useState } from "react";
import { beginFreshJoin } from "@/lib/player-session";

export default function HomePage() {
  const [roomCode, setRoomCode] = useState("");

  function createRoom() {
    const newRoomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    beginFreshJoin(newRoomId);
    window.location.href = `/rooms/${newRoomId}`;
  }

  function joinRoom() {
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) return;

    beginFreshJoin(cleanCode);
    window.location.href = `/rooms/${cleanCode}`;
  }

  return (
    <main className="app-shell flex items-center justify-center p-5 sm:p-8">
      <div className="panel relative w-full max-w-lg overflow-hidden p-7 text-center sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-amber-300/10 blur-3xl" />

        <div className="relative flex flex-col gap-7">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.32em] text-emerald-300">
              Pick a game. Gather your crew.
            </p>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl">
              Drinking Games
              <span className="block text-amber-300">With Friends</span>
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-slate-300">
              Create a private room, share the code, and play together in real time.
            </p>
          </div>

          <button
            onClick={createRoom}
            className="primary-button w-full px-6 py-4 text-lg font-extrabold"
          >
            <span aria-hidden="true">＋</span> Create a Room
          </button>

          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
            <span className="h-px flex-1 bg-white/10" />
            or join
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              joinRoom();
            }}
          >
            <label className="sr-only" htmlFor="room-code">
              Room code
            </label>
            <input
              id="room-code"
              value={roomCode}
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              className="field min-w-0 flex-1 px-4 py-3 text-center text-lg font-bold tracking-[0.18em]"
            />

            <button
              type="submit"
              disabled={!roomCode.trim()}
              className="secondary-button px-6 py-3 font-extrabold"
            >
              Join Room <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="text-xs text-slate-500">Please play responsibly.</p>
        </div>
      </div>
    </main>
  );
}
