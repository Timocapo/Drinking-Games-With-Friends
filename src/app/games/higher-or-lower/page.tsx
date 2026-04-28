"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

type Card = {
  suit: string;
  rank: string;
  value: number;
  color: "Red" | "Black";
};

type Player = {
  id: string;
  name: string;
  isHost?: boolean;
  penalties: number;
};

type HigherOrLowerState = {
  type: "higher-or-lower";
  deck: Card[];
  grid: Card[][];

  // OLD, keep optional for now
  currentPlayerIndex?: number;

  // NEW turn system
  turnOrder?: string[];
  currentTurnOrderIndex?: number;

  streak: number;
  selectedStackIndex: number | null;
  gameOver: boolean;
  message: string;
};


type Room = {
  id: string;
  players: Player[];
  gameState: HigherOrLowerState | null;
};

let socket: Socket;

export default function HigherOrLowerPage() {
  const [room, setRoom] = useState<Room | null>(null);
  const [roomId, setRoomId] = useState("");
  const [myPlayerId, setMyPlayerId] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoomId = params.get("roomId")?.toUpperCase() || "";
    const savedPlayerId = localStorage.getItem("playerId") || "";

    setRoomId(urlRoomId);
    setMyPlayerId(savedPlayerId);

    socket = io();

    socket.on("connect", () => {
      if (urlRoomId) {
        socket.emit("request-room-state", { roomId: urlRoomId });
      }
    });

    socket.on("return-to-room", ({ roomId }) => {
      window.location.href = `/rooms/${roomId}`;
    });

    socket.on("room-updated", (updatedRoom: Room) => {
      setRoom(updatedRoom);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (!room || !room.gameState) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        Loading Higher or Lower...
      </main>
    );
  }

  const game = room.gameState;
  const currentPlayerId =
    game.turnOrder?.[game.currentTurnOrderIndex ?? 0];

  const currentPlayer = room.players.find(
    (player) => player.id === currentPlayerId
  );
  const me = room.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost;
  const isMyTurn = currentPlayer?.id === myPlayerId;

  function selectStack(index: number) {
    if (!isMyTurn) return;

    socket.emit("higher-or-lower-select-stack", {
      roomId,
      playerId: myPlayerId,
      stackIndex: index,
    });
  }

  function guess(choice: "higher" | "lower") {
    if (!isMyTurn) return;

    socket.emit("higher-or-lower-guess", {
      roomId,
      playerId: myPlayerId,
      choice,
    });
  }

  function restart() {
    socket.emit("higher-or-lower-restart", {
      roomId,
      playerId: myPlayerId,
    });
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-6">
        <h1 className="text-5xl font-bold">🔢 Higher or Lower</h1>

        <div className="text-center">
          <p className="text-sm text-gray-400">Room: {room.id}</p>
          <p className="text-sm text-blue-300">You are: {me?.name || "Unknown"}</p>

          <p className="text-xl mt-2">
            Current Turn:{" "}
            <span className="font-bold text-yellow-300">
              {currentPlayer?.name}
            </span>
          </p>

          <p className="text-gray-300">Streak: {game.streak} / 3</p>
          <p className="text-gray-300">Cards left: {game.deck.length}</p>

          {!isMyTurn && (
            <p className="text-red-300 mt-2">
              Waiting for {currentPlayer?.name}...
            </p>
          )}

          {isMyTurn && (
            <p className="text-green-300 mt-2">
              Your turn — select a stack.
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {game.grid.map((stack: Card[], index: number) => {
            const topCard = stack[stack.length - 1];
            const isSelected = game.selectedStackIndex === index;

            return (
              <button
                key={index}
                onClick={() => selectStack(index)}
                disabled={!isMyTurn || game.gameOver}
                className={`relative w-28 h-40 rounded-xl border-4 transition disabled:opacity-60 ${
                  isSelected
                    ? "border-yellow-300 scale-105"
                    : "border-white/20"
                }`}
              >
                <div
                  className={`w-full h-full rounded-lg bg-white flex flex-col justify-between p-3 shadow-xl ${
                    topCard.color === "Red" ? "text-red-600" : "text-black"
                  }`}
                >
                  <div className="text-left font-bold text-2xl">
                    {topCard.rank}
                    {topCard.suit}
                  </div>

                  <div className="text-5xl">{topCard.suit}</div>

                  <div className="text-right font-bold text-2xl">
                    {topCard.rank}
                    {topCard.suit}
                  </div>
                </div>

                <div className="absolute -top-3 -right-3 bg-yellow-400 text-black rounded-full w-8 h-8 flex items-center justify-center font-bold">
                  {stack.length}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => guess("higher")}
            disabled={!isMyTurn || game.selectedStackIndex === null || game.gameOver}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded-xl"
          >
            Higher
          </button>

          <button
            onClick={() => guess("lower")}
            disabled={!isMyTurn || game.selectedStackIndex === null || game.gameOver}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-6 py-3 rounded-xl"
          >
            Lower
          </button>
        </div>

        <p className="text-lg text-center min-h-8">{game.message}</p>

        <div className="bg-gray-900 rounded-xl p-4 w-full max-w-md">
          <h2 className="text-2xl font-bold mb-3 text-center">
            Penalty Drinks
          </h2>

          <div className="flex flex-col gap-2">
            {room.players.map((player) => (
              <div
                key={player.id}
                className={`flex justify-between rounded-lg px-4 py-2 ${
                  player.id === currentPlayer?.id
                    ? "bg-yellow-700"
                    : "bg-gray-800"
                }`}
              >
                <span>
                  {player.name} {player.isHost ? "👑" : ""}
                </span>
                <span>{player.penalties}</span>
              </div>
            ))}
          </div>
        </div>

        {game.gameOver && isHost && (
          <div className="flex flex-col gap-3 w-full max-w-md">
            <button
              onClick={restart}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-bold"
            >
              Restart Game
            </button>

            <button
              onClick={() => {
                socket.emit("change-game", {
                  roomId,
                  playerId: myPlayerId,
                });
              }}
              className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-xl font-bold"
            >
              Change Game
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
