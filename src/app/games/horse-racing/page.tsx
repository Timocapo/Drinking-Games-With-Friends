"use client";

import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";

type Card = {
  suit: string;
  rank: string;
  value?: number;
  color?: "Red" | "Black";
};

type Player = {
  id: string;
  name: string;
  isHost?: boolean;
};

type Bet = {
  suit: string;
  amount: number;
};

type FinalDrinkResult = {
  total: number;
  raceLoss: number;
  from: Record<string, number>;
};

type GameState = {
  type: "horse-racing";
  phase: "betting" | "racing" | "assigning" | "results";
  bets: Record<string, Bet>;
  horses: Record<string, number>;
  finishOrder: string[];
  message: string;

  deck?: Card[];
  discard?: Card[];
  setbackCards?: Card[];
  flippedSetbacks?: number[];
  gateCard?: Card;
  currentCard?: Card | null;

  cardsSinceLastMovement?: number;
  activeDeckCycleSize?: number;
  reshuffleCount?: number;
  stalemateEnded?: boolean;

  drinkAssignments?: Record<string, Record<string, number>>;
  finishedAssigners?: string[];
  finalDrinks?: Record<string, FinalDrinkResult>;
};

type Room = {
  id: string;
  players: Player[];
  gameState: GameState | null;
};

let socket: Socket;

const SUITS = ["♥", "♦", "♠", "♣"];

const SUIT_NAMES: Record<string, string> = {
  "♥": "Hearts",
  "♦": "Diamonds",
  "♠": "Spades",
  "♣": "Clubs",
};

function CardDisplay({
  card,
  faceDown = false,
  horizontal = false,
  small = false,
  large = false,
}: {
  card?: Card | null;
  faceDown?: boolean;
  horizontal?: boolean;
  small?: boolean;
  large?: boolean;
}) {
  const color =
    card?.suit === "♥" || card?.suit === "♦" ? "text-red-600" : "text-black";

  const size = horizontal
    ? "w-20 h-12 sm:w-24 sm:h-14"
    : large
    ? "w-20 h-28 sm:w-24 sm:h-32"
    : small
    ? "w-12 h-16 sm:w-14 sm:h-20"
    : "w-11 h-16 sm:w-14 sm:h-20";

  if (faceDown || !card) {
    return (
      <div
        className={`${size} rounded-lg bg-blue-700 border-2 border-white/40 flex items-center justify-center font-bold`}
      >
        ?
      </div>
    );
  }

  if (horizontal) {
    return (
      <div
        className={`${size} rounded-lg bg-white ${color} relative shadow`}
      >
        <div className="absolute top-1 left-1 text-xs font-bold leading-none">
          {card.rank}
          {card.suit}
        </div>

        <div className="absolute inset-0 flex items-center justify-center text-2xl">
          {card.suit}
        </div>

        <div className="absolute bottom-1 right-1 text-xs font-bold leading-none">
          {card.rank}
          {card.suit}
        </div>
      </div>
    );
  }

return (
  <div
    className={`${size} rounded-lg bg-white ${color} flex flex-col justify-between p-2 shadow`}
  >
    <div className="text-xs font-bold self-start">
      {card.rank}
      {card.suit}
    </div>

    <div className="text-2xl text-center">{card.suit}</div>

    <div className="text-xs font-bold self-end">
      {card.rank}
      {card.suit}
    </div>
  </div>
);
}

export default function HorseRacingPage() {
  const [room, setRoom] = useState<Room | null>(null);
  const [roomId, setRoomId] = useState("");
  const [myPlayerId, setMyPlayerId] = useState("");

  const [selectedSuit, setSelectedSuit] = useState("♥");
  const [betAmount, setBetAmount] = useState(1);

  const [speed, setSpeed] = useState(1000);
  const [isAuto, setIsAuto] = useState(false);

  const [drinkAssignments, setDrinkAssignments] = useState<
    Record<string, Record<string, number>>
  >({});

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

      if (updatedRoom.gameState?.phase !== "racing") {
        setIsAuto(false);
      }
    });

    socket.on("return-to-room", ({ roomId }) => {
      window.location.href = `/rooms/${roomId}`;
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const game = room?.gameState;
  const me = room?.players.find((player) => player.id === myPlayerId);
  const isHost = me?.isHost;

  useEffect(() => {
    if (game?.phase === "betting") {
      setDrinkAssignments({});
    }
  }, [game?.phase]);

  const results = useMemo(() => {
    if (!room || !game || game.phase !== "assigning") return [];

    return room.players.map((player) => {
      const bet = game.bets[player.id];

      if (!bet) {
        return {
          player,
          bet: null,
          place: null,
          type: "none",
          amount: 0,
          text: "No bet placed",
        };
      }

      const finishIndex = game.finishOrder.indexOf(bet.suit);
      const place = finishIndex === -1 ? 5 : finishIndex + 1;

      if (place === 1) {
        return {
          player,
          bet,
          place,
          type: "give",
          amount: bet.amount * 2,
          text: `gives out ${bet.amount * 2} drinks`,
        };
      }

      if (place === 2) {
        return {
          player,
          bet,
          place,
          type: "give",
          amount: bet.amount,
          text: `gives out ${bet.amount} drinks`,
        };
      }

      if (place === 3) {
        return {
          player,
          bet,
          place,
          type: "take",
          amount: bet.amount,
          text: `takes ${bet.amount} penalty drinks`,
        };
      }

      if (place === 4) {
        return {
          player,
          bet,
          place,
          type: "take",
          amount: bet.amount * 2,
          text: `takes ${bet.amount * 2} penalty drinks`,
        };
      }

      return {
        player,
        bet,
        place,
        type: "take",
        amount: bet.amount * 3,
        text: `unfinished horse: takes ${bet.amount * 3} penalty drinks`,
      };
    });
  }, [game, room]);

  const myResult = results.find((result) => result.player.id === myPlayerId);
  const hasFinishedAssignments =
    game?.finishedAssigners?.includes(myPlayerId) || false;

  function placeBet() {
    socket.emit("horse-bet", {
      roomId,
      playerId: myPlayerId,
      suit: selectedSuit,
      amount: betAmount,
    });
  }

  function startRace() {
    socket.emit("horse-start", {
      roomId,
      playerId: myPlayerId,
    });
  }

  function stepRace() {
    socket.emit("horse-step", {
      roomId,
      playerId: myPlayerId,
    });
  }

  function startAutoRace() {
    socket.emit("horse-auto-start", {
      roomId,
      speed,
    });
    setIsAuto(true);
  }

  function stopAutoRace() {
    socket.emit("horse-auto-stop", {
      roomId,
    });
    setIsAuto(false);
  }

  function updateAssignment(receiverId: string, value: number) {
    setDrinkAssignments((prev) => ({
      ...prev,
      [myPlayerId]: {
        ...prev[myPlayerId],
        [receiverId]: Math.max(0, value),
      },
    }));
  }

  function totalAssigned(giverId: string) {
    return Object.values(drinkAssignments[giverId] || {}).reduce(
      (sum, value) => sum + value,
      0
    );
  }

  function submitAssignments() {
    const myGiveResult = results.find(
      (result) => result.player.id === myPlayerId && result.type === "give"
    );

    socket.emit("horse-assign-drinks", {
      roomId,
      playerId: myPlayerId,
      assignments: myGiveResult ? drinkAssignments[myPlayerId] || {} : {},
    });

    socket.emit("horse-finish-assignments", {
      roomId,
      playerId: myPlayerId,
    });
  }

  function restartGame() {
    socket.emit("horse-restart", {
      roomId,
      playerId: myPlayerId,
    });
  }

  if (!room || !game) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        Loading Horse Racing...
      </main>
    );
  }

  const deckCount = game.deck?.length ?? 0;
  const reshuffleCount = game.reshuffleCount ?? 0;

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-6 items-center">
        <h1 className="text-5xl font-bold">🐎 Horse Racing</h1>

        <div className="text-center">
          <p className="text-gray-400">Room: {room.id}</p>
        </div>

        {game.phase === "betting" && (
          <section className="bg-gray-900 p-6 rounded-xl flex flex-col gap-4 w-full max-w-md">
            <h2 className="text-2xl font-bold text-center">Place Your Bet</h2>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-gray-300">Choose your horse</span>

              <div className="grid grid-cols-4 gap-3">
                {SUITS.map((suit) => (
                  <button
                    key={suit}
                    type="button"
                    onClick={() => setSelectedSuit(suit)}
                    className={`px-4 py-3 text-2xl font-bold rounded-xl border-4 ${
                      selectedSuit === suit
                        ? "bg-yellow-500 text-black border-yellow-300"
                        : "bg-gray-800 border-gray-600 text-white"
                    }`}
                  >
                    {suit}
                  </button>
                ))}
              </div>
            </label>

            <label className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Bet amount</span>
                <span className="text-yellow-300 font-bold">{betAmount}</span>
              </div>

              <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              className="w-full"
            />

            <p className="text-xs text-gray-400 text-center">
              1 full beer = 20 drinks
            </p>
          </label>

            <button
              onClick={placeBet}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
            >
              Place Bet
            </button>

            {isHost && (
              <button
                onClick={startRace}
                className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded font-bold"
              >
                Start Race
              </button>
            )}
          </section>
        )}

        <section className="bg-gray-900 p-4 rounded-xl w-full max-w-md">
          <h2 className="text-xl font-bold mb-2">Bets</h2>

          <div className="flex flex-col gap-2">
            {room.players.map((player) => {
              const bet = game.bets[player.id];
            
              return (
                <div
                  key={player.id}
                  className="flex justify-between bg-gray-800 rounded-lg px-4 py-2"
                >
                  <span>
                    {player.name} {player.id === myPlayerId ? "(You)" : ""}{" "}
                    {player.isHost ? "👑" : ""}
                  </span>

                  <span>
                    {bet ? `${bet.suit} (${bet.amount})` : "No bet"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {(game.phase === "racing" ||
          game.phase === "assigning" ||
          game.phase === "results") && (
          <section className="bg-gray-900 p-6 rounded-xl w-full overflow-x-auto">
            <div className="grid grid-cols-[96px_1fr] sm:grid-cols-[120px_1fr] items-center gap-4 mb-3">
              <div className="text-center justify-self-start">
                <p className="text-sm text-gray-400 mb-1">Card</p>
                <CardDisplay card={game.currentCard ?? null} large />
              </div>

              <div className="text-center justify-self-center w-full px-2">
                <p className="text-blue-300">You are: {me?.name || "Unknown"}</p>
                <p className="text-yellow-300">{game.message}</p>
                <p className="text-gray-400 text-sm">
                  Deck: {deckCount} cards left | Reshuffles: {reshuffleCount}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-[64px_repeat(4,minmax(48px,1fr))] gap-1 w-full max-w-[520px] mx-auto overflow-visible">
              {Array.from({ length: 9 }, (_, rowIndex) => {
                const row = rowIndex + 1;
                const trackPosition = 9 - row;

                const setbackRows = [8, 7, 6, 5, 4, 3, 2];
                const setbackIndex = setbackRows.indexOf(row);
                const setbackCard =
                  setbackIndex >= 0 ? game.setbackCards?.[setbackIndex] : null;

                const isGate = row === 5;
                const isFlipped =
                  setbackIndex >= 0 &&
                  game.flippedSetbacks?.includes(setbackIndex);

                return (
                  <div key={row} className="contents">
                    <div className="h-16 sm:h-20 flex items-center justify-center">
                      {row === 1 ? (
                        <div className="font-bold text-yellow-300">FINISH</div>
                      ) : row === 9 ? (
                        <div className="font-bold text-gray-300">START</div>
                      ) : isGate && game.gateCard ? (
                        <CardDisplay
                          card={game.gateCard}
                          horizontal
                          faceDown={!isFlipped}
                        />
                      ) : setbackCard ? (
                        <CardDisplay
                          card={setbackCard}
                          faceDown={!isFlipped}
                        />
                      ) : null}
                    </div>

                    {SUITS.map((suit) => {
                      const position = game.horses[suit] ?? 0;
                      const isHere = position === trackPosition;
                      const finished = game.finishOrder.includes(suit);

                      return (
                        <div
                          key={`${row}-${suit}`}
                            className="h-16 sm:h-20 rounded-lg border border-white/10 bg-gray-800 flex items-center justify-center overflow-visible relative"
                        >
                          {isHere && !finished && (
                            <div
                                className={`w-16 h-24 rounded-lg bg-white flex flex-col justify-between p-2 shadow-xl relative z-10 ${
                                suit === "♥" || suit === "♦"
                                  ? "text-red-600"
                                  : "text-black"
                              }`}
                            >
                              <div className="text-xs font-bold self-start">
                                J{suit}
                              </div>

                              <div className="text-3xl text-center">{suit}</div>

                              <div className="text-xs font-bold self-end">
                                J{suit}
                              </div>
                            </div>
                          )}

                          {finished && row === 1 && (
                            <div className="text-2xl">
                              {game.finishOrder.indexOf(suit) === 0 && "🥇 "}
                              {game.finishOrder.indexOf(suit) === 1 && "🥈 "}
                              {game.finishOrder.indexOf(suit) === 2 && "🥉 "}
                              {game.finishOrder.indexOf(suit) === 3 && "🏁 "}
                              {suit}
                            </div>
                              )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {game.phase === "racing" && isHost && (
          <section className="bg-gray-900 p-4 rounded-xl flex flex-col items-center gap-4 w-full max-w-md">
            <button
              onClick={stepRace}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-bold"
            >
              Next Card Manual
            </button>

            <div className="flex flex-col items-center gap-2 w-full">
              <label className="text-sm text-gray-300">Speed: {speed} ms</label>

              <input
                type="range"
                min={200}
                max={2000}
                step={100}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {!isAuto ? (
              <button
                onClick={startAutoRace}
                className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-xl font-bold"
              >
                Start Auto
              </button>
            ) : (
              <button
                onClick={stopAutoRace}
                className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-xl font-bold"
              >
                Stop Auto
              </button>
            )}

            <p className="text-xs text-gray-400 text-center">
              Change speed, then stop/start auto again to apply new speed.
            </p>
          </section>
        )}

        {game.phase === "racing" && !isHost && (
          <p className="text-gray-400">Race is running...</p>
        )}

        {game.finishOrder.length > 0 && (
          <section className="bg-gray-900 p-4 rounded-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-2">Finish Order</h2>

            {game.finishOrder.map((suit, index) => (
              <p key={suit}>
                {index + 1}. {suit} {SUIT_NAMES[suit]}
              </p>
            ))}
          </section>
        )}

        {game.phase === "assigning" && (
          <section className="bg-gray-900 p-6 rounded-xl w-full max-w-3xl">
            <h2 className="text-2xl font-bold mb-4 text-center">
              Assign Drinks
            </h2>

            <div className="flex flex-col gap-4">
              {results.map((result) => (
                <div
                  key={result.player.id}
                  className="bg-gray-800 rounded-xl p-4"
                >
                  <h3 className="text-xl font-bold">{result.player.name}</h3>

                  {result.bet ? (
                    <>
                      <p>
                        Bet: {result.bet.amount} on {result.bet.suit}{" "}
                        {SUIT_NAMES[result.bet.suit]}
                      </p>
                      <p>Place: #{result.place}</p>
                      <p
                        className={
                          result.type === "give"
                            ? "text-green-400 font-bold"
                            : "text-red-400 font-bold"
                        }
                      >
                        {result.text}
                      </p>
                    </>
                  ) : (
                    <p>No bet placed</p>
                  )}

                  {result.player.id === myPlayerId &&
                    result.type === "give" && (
                      <div className="mt-4 bg-gray-900 rounded-lg p-3">
                        <p className="font-bold mb-2">
                          Assign drinks: {totalAssigned(myPlayerId)} /{" "}
                          {result.amount}
                        </p>

                        <div className="flex flex-col gap-2">
                          {room.players
                            .filter((p) => p.id !== myPlayerId)
                            .map((receiver) => (
                              <label
                                key={receiver.id}
                                className="flex justify-between items-center gap-3"
                              >
                                <span>{receiver.name}</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={result.amount}
                                  value={
                                    drinkAssignments[myPlayerId]?.[
                                      receiver.id
                                    ] || 0
                                  }
                                  onChange={(e) =>
                                    updateAssignment(
                                      receiver.id,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="bg-gray-800 text-white rounded px-2 py-1 w-20"
                                />
                              </label>
                            ))}
                        </div>

                        {totalAssigned(myPlayerId) > result.amount && (
                          <p className="text-red-400 mt-2">
                            Too many drinks assigned.
                          </p>
                        )}
                      </div>
                    )}
                </div>
              ))}
            </div>

            <button
              onClick={submitAssignments}
              disabled={hasFinishedAssignments}
              className="mt-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded-xl font-bold w-full"
            >
              {hasFinishedAssignments
                ? "Assignments Finished"
                : "Finish My Assignments"}
            </button>

            <p className="text-sm text-gray-400 mt-2 text-center">
              Finished players: {game.finishedAssigners?.length || 0} /{" "}
              {room.players.length}
            </p>
          </section>
        )}

        {game.phase === "results" && (
          <section className="bg-gray-900 p-6 rounded-xl w-full max-w-3xl">
            <h2 className="text-2xl font-bold mb-4 text-center">
              Final Drink Results
            </h2>

            <div className="flex flex-col gap-4">
              {room.players.map((player) => {
                const result = game.finalDrinks?.[player.id];

                return (
                  <div key={player.id} className="bg-gray-800 rounded-xl p-4">
                    <h3 className="text-xl font-bold">{player.name}</h3>

                    <p className="text-yellow-300 font-bold">
                      Total drinks: {result?.total || 0}
                    </p>

                    {!!result?.raceLoss && (
                      <p>{result.raceLoss} from loss of race</p>
                    )}

                    {Object.entries(result?.from || {}).map(
                      ([giver, amount]) => (
                        <p key={giver}>
                          {amount} from {giver}
                        </p>
                      )
                    )}
                  </div>
                );
              })}
            </div>

            {isHost && (
              <>
                <button
                  onClick={restartGame}
                  className="mt-6 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-bold w-full"
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
                  className="mt-4 bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-xl font-bold w-full"
                >
                  Change Game
                </button>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}