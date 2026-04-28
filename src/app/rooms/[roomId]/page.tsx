"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

type Player = {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  drinks?: number;
};

type Room = {
  id: string;
  hostId: string;
  players: Player[];
  game: string | null;
};

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

  useEffect(() => {
    async function loadParams() {
      const resolvedParams = await params;
      setRoomId(resolvedParams.roomId.toUpperCase());
    }

    loadParams();
  }, [params]);

  useEffect(() => {
    socket = io();

    const savedPlayerId = localStorage.getItem("playerId") || "";
    const savedName = localStorage.getItem("playerName") || "";

    setMyPlayerId(savedPlayerId);
    setName(savedName);

    socket.on("room-updated", (updatedRoom: Room) => {
      setRoom(updatedRoom);
      setJoined(true);
      setMessage("");
    });

    socket.on("room-full", () => {
      setMessage("This room is full. Max 12 players allowed.");
    });

    socket.on("game-started", ({ game, roomId }) => {
      window.location.href = `/games/${game}?roomId=${roomId}`;
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  function getOrCreatePlayerId() {
    let playerId = localStorage.getItem("playerId");

    if (!playerId) {
      playerId = crypto.randomUUID();
      localStorage.setItem("playerId", playerId);
    }

    setMyPlayerId(playerId);
    return playerId;
  }

  function joinRoom() {
    if (!roomId) return;

    const playerId = getOrCreatePlayerId();
    const playerName = name.trim() || "Guest";

    localStorage.setItem("playerName", playerName);

    socket.emit("join-room", {
      roomId,
      name: playerName,
      playerId,
    });
  }

  function toggleReady() {
    socket.emit("toggle-ready", {
      roomId,
      playerId: myPlayerId,
    });
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

  const currentPlayer = room?.players.find(
    (player) => player.id === myPlayerId
  );
  const isHost = currentPlayer?.isHost;

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <h1 className="text-4xl font-bold text-center">Room Code: {roomId}</h1>

        {!joined && (
          <section className="bg-gray-900 rounded-xl p-6 flex flex-col gap-4">
            <h2 className="text-2xl font-bold">Join Room</h2>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="bg-white text-black placeholder-gray-500 px-4 py-3 rounded-xl text-center text-lg"
            />

            <button
              onClick={joinRoom}
              className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-xl font-bold"
            >
              Join Room
            </button>

            {message && <p className="text-red-400">{message}</p>}
          </section>
        )}

        {joined && room && (
          <>
            <section className="bg-gray-900 rounded-xl p-6">
              <h2 className="text-2xl font-bold mb-4">
                Players ({room.players.length}/12)
              </h2>

              <p className="text-sm text-blue-300 mb-4">
                You are: {currentPlayer?.name || "Unknown"}
              </p>

              <div className="flex flex-col gap-3">
                {room.players.map((player) => (
                  <div
                    key={player.id}
                    className="bg-gray-800 rounded-lg px-4 py-3 flex justify-between"
                  >
                    <span>
                      {player.name} {player.isHost ? "👑" : ""}
                    </span>

                    <span>{player.ready ? "Ready ✅" : "Not Ready"}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={toggleReady}
                className="mt-4 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-xl"
              >
                Toggle Ready
              </button>
            </section>

            {isHost && (
              <section className="bg-gray-900 rounded-xl p-6">
                <h2 className="text-2xl font-bold mb-4">Choose Game</h2>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => selectGame("higher-or-lower")}
                    className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl"
                  >
                    Higher or Lower
                  </button>

                  <button
                    onClick={() => selectGame("ride-the-bus")}
                    className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-xl"
                  >
                    Ride The Bus
                  </button>

                  <button
                    onClick={() => selectGame("horse-racing")}
                    className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-xl"
                  >
                    Horse Racing
                  </button>
                </div>

                <button
                  onClick={startGame}
                  disabled={!room.game}
                  className="mt-6 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black px-6 py-3 rounded-xl font-bold w-full"
                >
                  Start Selected Game
                </button>
              </section>
            )}

            {room.game && (
              <section className="bg-gray-900 rounded-xl p-6 text-center">
                <p className="text-xl">
                  Selected Game:{" "}
                  <span className="font-bold text-yellow-300">
                    {room.game}
                  </span>
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}