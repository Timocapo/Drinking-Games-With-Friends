"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  function createRoom() {
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    router.push(`/rooms/${roomId}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-950 text-white">
      <h1 className="text-5xl font-bold">Drinking Games 🎉</h1>

      <p className="text-gray-300">
        Play with friends or create a room to start!
      </p>

      <button
        onClick={createRoom}
        className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-xl w-72"
      >
        ➕ Create Room
      </button>

      <div className="flex flex-col gap-4 mt-4">
        <Link href="/games/horse-racing">
          <button className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-xl w-72">
            🐎 Horse Racing
          </button>
        </Link>

        <Link href="/games/higher-or-lower">
          <button className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl w-72">
            🔢 Higher or Lower
          </button>
        </Link>

        <Link href="/games/ride-the-bus">
          <button className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-xl w-72">
            🚌 Ride The Bus
          </button>
        </Link>
      </div>
    </main>
  );
}