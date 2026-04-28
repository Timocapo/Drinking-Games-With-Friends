"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

type Suit = "♥" | "♦" | "♠" | "♣";
type Color = "Red" | "Black";

type Card = {
  suit: Suit;
  rank: string;
  value: number;
  color: Color;
};

type Player = {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  drinks: number;
};

type RideTheBusState = {
  type: "ride-the-bus";
  deck: Card[];
  currentPlayerIndex: number;
  step: number;
  turnCards: Card[];
  message: string;
};

type Room = {
  id: string;
  hostId: string;
  players: Player[];
  game: string | null;
  gameState: RideTheBusState | null;
};

let socket: Socket;

const questions = [
  "Color?",
  "Higher or Lower?",
  "Between or Outside?",
  "Suit?",
];

const answersByStep = [
  ["Red", "Black"],
  ["Higher", "Lower"],
  ["Between", "Outside"],
  ["♥", "♦", "♠", "♣"],
];

export default function RideTheBusPage() {
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

    socket.on("room-updated", (updatedRoom: Room) => {
      setRoom(updatedRoom);
    });

    socket.on("return-to-room", ({ roomId }) => {
      window.location.href = `/rooms/${roomId}`;
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  function answerQuestion(answer: string) {
    if (!roomId || !myPlayerId) return;

    socket.emit("ride-the-bus-answer", {
      roomId,
      playerId: myPlayerId,
      answer,
    });
  }

  if (!roomId) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-6 flex items-center justify-center">
        <div className="bg-gray-900 rounded-xl p-6 text-center">
          <h1 className="text-3xl font-bold mb-2">Ride The Bus</h1>
          <p className="text-gray-300">
            This multiplayer version must be started from a room.
          </p>
        </div>
      </main>
    );
  }

  if (!room || !room.gameState) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-6 flex items-center justify-center">
        <div className="bg-gray-900 rounded-xl p-6 text-center">
          <h1 className="text-3xl font-bold mb-2">Loading Ride The Bus...</h1>
          <p className="text-gray-300">Room Code: {roomId}</p>
        </div>
      </main>
    );
  }

  const gameState = room.gameState;
  const currentPlayer = room.players[gameState.currentPlayerIndex];
  const currentCard = gameState.turnCards[gameState.turnCards.length - 1];
  const me = room.players.find((player) => player.id === myPlayerId);
  const isMyTurn = currentPlayer?.id === myPlayerId;

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-6">
        <h1 className="text-5xl font-bold">🚌 Ride The Bus</h1>

        <div className="text-center">
          <p className="text-sm text-gray-400">Room: {room.id}</p>

          <p className="text-sm text-blue-300">
            You are: {me?.name || "Unknown"}
          </p>

          <p className="text-xl mt-2">
            Current Turn:{" "}
            <span className="font-bold text-yellow-300">
              {currentPlayer?.name}
            </span>
          </p>

          <p className="text-gray-300">Question: {gameState.step + 1} / 4</p>
          <p className="text-gray-300">
            Cards left in deck: {gameState.deck.length}
          </p>

          {!isMyTurn && (
            <p className="text-red-300 mt-2">
              Waiting for {currentPlayer?.name} to answer...
            </p>
          )}

          {isMyTurn && (
            <p className="text-green-300 mt-2">Your turn — choose an answer.</p>
          )}
        </div>

        <h2 className="text-3xl font-bold">{questions[gameState.step]}</h2>

        <div className="h-52 flex items-center justify-center">
          {currentCard ? (
            <div
              className={`w-32 h-48 rounded-xl bg-white flex flex-col justify-between p-4 shadow-xl ${
                currentCard.color === "Red" ? "text-red-600" : "text-black"
              }`}
            >
              <div className="text-left font-bold text-2xl">
                {currentCard.rank}
                {currentCard.suit}
              </div>

              <div className="text-6xl text-center">{currentCard.suit}</div>

              <div className="text-right font-bold text-2xl">
                {currentCard.rank}
                {currentCard.suit}
              </div>
            </div>
          ) : (
            <div className="w-32 h-48 rounded-xl border-4 border-dashed border-gray-600 flex items-center justify-center text-gray-500">
              No Card
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {answersByStep[gameState.step].map((answer) => (
            <button
              key={answer}
              onClick={() => answerQuestion(answer)}
              disabled={!isMyTurn}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded-xl min-w-32"
            >
              {answer}
            </button>
          ))}
        </div>

        <p className="text-lg text-center min-h-8">{gameState.message}</p>

        <div className="bg-gray-900 rounded-xl p-4 w-full max-w-md">
          <h2 className="text-2xl font-bold mb-3 text-center">
            Drink Counter
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
                <span>{player.drinks}</span>
              </div>
            ))}
          </div>
        </div>

        {me?.isHost && (
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
        )}
      </div>
    </main>
  );
}

