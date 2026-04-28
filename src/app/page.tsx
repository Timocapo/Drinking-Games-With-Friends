"use client";

import { useState } from "react";

export default function HomePage() {
  const [roomCode, setRoomCode] = useState("");

  function createRoom() {
    const newRoomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    window.location.href = `/rooms/${newRoomId}`;
  }

  function joinRoom() {
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) return;

    window.location.href = `/rooms/${cleanCode}`;
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md flex flex-col gap-6 text-center">
        <h1 className="text-4xl font-bold">🍺Drinking Games🍺 🍹With Friends🍹</h1>

        <button
          onClick={createRoom}
          className="bg-green-600 hover:bg-green-700 px-6 py-4 rounded-xl font-bold text-xl"
        >
          Create Room
        </button>

        <div className="flex flex-col gap-3">
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Enter Room Code"
            className="bg-white text-black placeholder-gray-500 px-4 py-3 rounded-xl text-center text-lg"
          />

          <button
            onClick={joinRoom}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-4 rounded-xl font-bold text-xl"
          >
            Join Room
          </button>
        </div>
      </div>
    </main>
  );
}