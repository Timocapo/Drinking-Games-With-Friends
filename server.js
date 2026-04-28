const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

const rooms = new Map();
const raceIntervals = new Map();

const SUITS = ["♥", "♦", "♠", "♣"];

function createPlayer(id, name, isHost = false) {
  return {
    id,
    name: name?.trim() || "Guest",
    isHost,
    ready: false,
    drinks: 0,
    penalties: 0,
  };
}

function createDeck() {
  const ranks = [
    { rank: "A", value: 14 },
    { rank: "2", value: 2 },
    { rank: "3", value: 3 },
    { rank: "4", value: 4 },
    { rank: "5", value: 5 },
    { rank: "6", value: 6 },
    { rank: "7", value: 7 },
    { rank: "8", value: 8 },
    { rank: "9", value: 9 },
    { rank: "10", value: 10 },
    { rank: "J", value: 11 },
    { rank: "Q", value: 12 },
    { rank: "K", value: 13 },
  ];

  return SUITS.flatMap((suit) =>
    ranks.map((card) => ({
      suit,
      rank: card.rank,
      value: card.value,
      color: suit === "♥" || suit === "♦" ? "Red" : "Black",
    }))
  );
}

function shuffleDeck(deck) {
  return [...deck].sort(() => Math.random() - 0.5);
}

/* -----------------------------
   RIDE THE BUS
----------------------------- */

function createRideTheBusState(players) {
  const randomPlayerIndex = Math.floor(Math.random() * players.length);

  return {
    type: "ride-the-bus",
    deck: shuffleDeck(createDeck()),
    currentPlayerIndex: randomPlayerIndex,
    step: 0,
    turnCards: [],
    message: `${players[randomPlayerIndex].name} goes first!`,
  };
}

function drawRideTheBusCard(gameState) {
  if (gameState.deck.length === 0) {
    gameState.deck = shuffleDeck(createDeck());
  }

  return gameState.deck.shift();
}

function handleRideTheBusAnswer(room, playerId, answer) {
  const gameState = room.gameState;
  if (!gameState || gameState.type !== "ride-the-bus") return;

  const currentPlayer = room.players[gameState.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.id !== playerId) return;

  const card = drawRideTheBusCard(gameState);
  let correct = false;

  if (gameState.step === 0) {
    correct = answer === card.color;
  }

  if (gameState.step === 1) {
    const previousCard = gameState.turnCards[gameState.turnCards.length - 1];

    if (previousCard) {
      if (answer === "Higher") correct = card.value > previousCard.value;
      if (answer === "Lower") correct = card.value < previousCard.value;
    }
  }

  if (gameState.step === 2) {
    const previousTwoCards = gameState.turnCards.slice(-2);
    const firstCard = previousTwoCards[0];
    const secondCard = previousTwoCards[1];

    if (firstCard && secondCard) {
      const low = Math.min(firstCard.value, secondCard.value);
      const high = Math.max(firstCard.value, secondCard.value);

      const isTie =
        card.value === firstCard.value || card.value === secondCard.value;

      const isBetween = card.value > low && card.value < high;
      const isOutside = card.value < low || card.value > high;

      if (isTie) correct = false;
      else if (answer === "Between") correct = isBetween;
      else if (answer === "Outside") correct = isOutside;
    }
  }

  if (gameState.step === 3) {
    correct = answer === card.suit;
  }

  if (!correct) {
    currentPlayer.drinks += 1;
    gameState.step = 0;
    gameState.turnCards = [card];
    gameState.message = `Wrong! ${currentPlayer.name} gets 1 drink and restarts at Color.`;
    return;
  }

  gameState.turnCards.push(card);

  if (gameState.step === 3) {
    const nextPlayerIndex =
      (gameState.currentPlayerIndex + 1) % room.players.length;

    gameState.currentPlayerIndex = nextPlayerIndex;
    gameState.step = 0;
    gameState.turnCards = [];
    gameState.message = `${currentPlayer.name} completed all 4! ${room.players[nextPlayerIndex].name}'s turn.`;
    return;
  }

  gameState.step += 1;
  gameState.message = "Correct! Next question.";
}

/* -----------------------------
   HIGHER OR LOWER
----------------------------- */

function createHigherOrLowerState(players) {
  const shuffled = shuffleDeck(createDeck());

  const grid = [];
  for (let i = 0; i < 9; i++) {
    grid.push([shuffled[i]]);
  }

  const randomPlayerIndex = Math.floor(Math.random() * players.length);

  return {
    type: "higher-or-lower",
    deck: shuffled.slice(9),
    grid,
    currentPlayerIndex: randomPlayerIndex,
    streak: 0,
    selectedStackIndex: null,
    gameOver: false,
    message: `${players[randomPlayerIndex].name} goes first!`,
  };
}

function handleHigherOrLowerSelectStack(room, playerId, stackIndex) {
  const gameState = room.gameState;
  if (!gameState || gameState.type !== "higher-or-lower") return;

  const currentPlayer = room.players[gameState.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.id !== playerId) return;

  if (gameState.gameOver) return;
  if (stackIndex < 0 || stackIndex > 8) return;

  gameState.selectedStackIndex = stackIndex;
}

function handleHigherOrLowerGuess(room, playerId, choice) {
  const gameState = room.gameState;
  if (!gameState || gameState.type !== "higher-or-lower") return;

  const currentPlayer = room.players[gameState.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.id !== playerId) return;

  if (gameState.gameOver) return;
  if (gameState.selectedStackIndex === null) return;

  if (gameState.deck.length === 0) {
    gameState.gameOver = true;
    gameState.message = "The deck is empty. Game over!";
    return;
  }

  const stackIndex = gameState.selectedStackIndex;
  const selectedStack = gameState.grid[stackIndex];
  const currentCard = selectedStack[selectedStack.length - 1];
  const nextCard = gameState.deck.shift();

  let correct = false;
  let tie = false;

  if (nextCard.value === currentCard.value) {
    tie = true;
  } else if (choice === "higher" && nextCard.value > currentCard.value) {
    correct = true;
  } else if (choice === "lower" && nextCard.value < currentCard.value) {
    correct = true;
  }

  selectedStack.push(nextCard);

  if (tie) {
    const penalty = selectedStack.length * 2;
    currentPlayer.penalties += penalty;
    gameState.streak = 0;
    gameState.message = `Same card! ${currentPlayer.name} gets ${penalty} penalty drinks.`;
  } else if (correct) {
    gameState.streak += 1;

    if (gameState.streak >= 3) {
      const nextPlayerIndex =
        (gameState.currentPlayerIndex + 1) % room.players.length;

      const oldPlayerName = currentPlayer.name;
      const nextPlayerName = room.players[nextPlayerIndex].name;

      gameState.currentPlayerIndex = nextPlayerIndex;
      gameState.streak = 0;
      gameState.message = `${oldPlayerName} got 3 in a row! ${nextPlayerName}'s turn.`;
    } else {
      gameState.message = `Correct! ${currentPlayer.name} needs ${
        3 - gameState.streak
      } more.`;
    }
  } else {
    const penalty = selectedStack.length;
    currentPlayer.penalties += penalty;
    gameState.streak = 0;
    gameState.message = `Wrong! ${currentPlayer.name} gets ${penalty} penalty drinks. Keep going until 3 in a row.`;
  }

  gameState.selectedStackIndex = null;

  if (gameState.deck.length === 0) {
    gameState.gameOver = true;
    gameState.message = "The deck is empty. Game over!";
  }
}

function restartHigherOrLower(room, playerId) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player?.isHost) return;

  room.players = room.players.map((p) => ({
    ...p,
    penalties: 0,
  }));

  room.gameState = createHigherOrLowerState(room.players);
}

/* -----------------------------
   HORSE RACING
----------------------------- */

function createHorseRacingState() {
  let deck = shuffleDeck(createDeck());

  deck = deck.filter((card) => card.rank !== "J");

  const setbackCards = deck.splice(0, 7);
  const gateCard = setbackCards[3];

  return {
    type: "horse-racing",
    phase: "betting",

    deck,
    discard: [],

    setbackCards,
    flippedSetbacks: [],
    gateCard,

    bets: {},

    horses: {
      "♥": 0,
      "♦": 0,
      "♠": 0,
      "♣": 0,
    },

    finishOrder: [],
    currentCard: null,
    message: "Place your bets!",

    cardsSinceLastMovement: 0,
    activeDeckCycleSize: deck.length,
    reshuffleCount: 0,
    stalemateEnded: false,

    drinkAssignments: {},
    finishedAssigners: [],
    finalDrinks: {},
  };
}

function handleHorseBet(room, playerId, suit, amount) {
  const game = room.gameState;
  if (!game || game.type !== "horse-racing") return;
  if (game.phase !== "betting") return;

  game.bets[playerId] = {
    suit,
    amount: Math.max(1, Math.min(20, Number(amount))),
  };
}

function startHorseRace(room, playerId) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player?.isHost) return;

  const game = room.gameState;
  if (!game || game.type !== "horse-racing") return;

  game.phase = "racing";
  game.message = "Race started!";
}

function stepHorseRace(room) {
  const game = room.gameState;
  if (!game || game.type !== "horse-racing") return;
  if (game.phase !== "racing") return;

  let horseMovedThisStep = false;

  if (game.deck.length === 0) {
    game.deck = shuffleDeck(game.discard);
    game.discard = [];
    game.reshuffleCount += 1;
    game.activeDeckCycleSize = game.deck.length;
    game.cardsSinceLastMovement = 0;
    game.message = `Deck reshuffled. Reshuffle #${game.reshuffleCount}`;
  }

  if (game.deck.length === 0) {
    game.phase = "assigning";
    game.stalemateEnded = true;
    game.message = "Race ended. No cards left. Assign drinks!";
    return;
  }

  const card = game.deck.shift();
  game.discard.push(card);
  game.currentCard = card;

  const suit = card.suit;

  if (!game.finishOrder.includes(suit)) {
    if (game.horses[suit] === 3) {
      const canPassGate =
        card.suit === suit &&
        (card.rank === "A" || card.rank === "Q" || card.rank === "K");

      if (canPassGate) {
        game.horses[suit] += 1;
        horseMovedThisStep = true;
        game.message = `${card.rank}${card.suit} drawn. ${suit} passed the gate!`;
      } else {
        game.message = `${card.rank}${card.suit} drawn. ${suit} is stuck at the gate.`;
      }
    } else {
      game.horses[suit] += 1;
      horseMovedThisStep = true;
      game.message = `${card.rank}${card.suit} drawn. ${suit} moves forward.`;
    }
  } else {
    game.message = `${card.rank}${card.suit} drawn. ${suit} already finished.`;
  }

  const setbackRows = [1, 2, 3, 4, 5, 6, 7];

  for (let i = 0; i < setbackRows.length; i++) {
    const rowRequirement = setbackRows[i];

    const allReached = SUITS.every(
      (horseSuit) =>
        game.finishOrder.includes(horseSuit) ||
        game.horses[horseSuit] >= rowRequirement
    );

    if (allReached && !game.flippedSetbacks.includes(i)) {
      const setbackCard = game.setbackCards[i];
      const setbackSuit = setbackCard.suit;

      game.flippedSetbacks.push(i);

      if (!game.finishOrder.includes(setbackSuit)) {
        const oldPosition = game.horses[setbackSuit];

        game.horses[setbackSuit] = Math.max(
          0,
          game.horses[setbackSuit] - 1
        );

        if (game.horses[setbackSuit] !== oldPosition) {
          horseMovedThisStep = true;
        }
      }

      game.message += ` Setback flipped: ${setbackCard.rank}${setbackSuit}. ${setbackSuit} moves back.`;
    }
  }

  for (const horseSuit of SUITS) {
    if (game.horses[horseSuit] >= 8 && !game.finishOrder.includes(horseSuit)) {
      game.finishOrder.push(horseSuit);
      game.message += ` ${horseSuit} finished!`;
    }
  }

  if (horseMovedThisStep) {
    game.cardsSinceLastMovement = 0;
  } else {
    game.cardsSinceLastMovement += 1;
  }

  if (
    game.activeDeckCycleSize > 0 &&
    game.cardsSinceLastMovement >= game.activeDeckCycleSize
  ) {
    game.phase = "assigning";
    game.stalemateEnded = true;
    game.message =
      "Race ended by stalemate. A full deck cycle passed with no horse movement.";
    return;
  }

  if (game.finishOrder.length === 4) {
    game.phase = "assigning";
    game.message = "Race finished! Assign drinks!";
  }
}

function calculateHorseResults(room) {
  const game = room.gameState;
  const results = {};

  room.players.forEach((player) => {
    results[player.id] = {
      total: 0,
      raceLoss: 0,
      from: {},
    };
  });

  room.players.forEach((player) => {
    const bet = game.bets[player.id];
    if (!bet) return;

    const finishIndex = game.finishOrder.indexOf(bet.suit);
    const place = finishIndex === -1 ? 5 : finishIndex + 1;

    if (place === 3) {
      results[player.id].raceLoss += bet.amount;
      results[player.id].total += bet.amount;
    }

    if (place === 4) {
      results[player.id].raceLoss += bet.amount * 2;
      results[player.id].total += bet.amount * 2;
    }

    if (place === 5) {
      results[player.id].raceLoss += bet.amount * 3;
      results[player.id].total += bet.amount * 3;
    }
  });

  Object.entries(game.drinkAssignments).forEach(([giverId, targets]) => {
    const giver = room.players.find((p) => p.id === giverId);
    if (!giver) return;

    Object.entries(targets).forEach(([targetId, amount]) => {
      const drinkAmount = Number(amount) || 0;

      if (!results[targetId]) return;

      results[targetId].total += drinkAmount;
      results[targetId].from[giver.name] =
        (results[targetId].from[giver.name] || 0) + drinkAmount;
    });
  });

  game.finalDrinks = results;
}

function startAutoRace(room, speed = 1000, io) {
  if (raceIntervals.has(room.id)) {
    clearInterval(raceIntervals.get(room.id));
  }

  const interval = setInterval(() => {
    if (!room.gameState || room.gameState.phase !== "racing") {
      clearInterval(interval);
      raceIntervals.delete(room.id);
      return;
    }

    stepHorseRace(room);
    io.to(room.id).emit("room-updated", room);

    if (room.gameState.phase !== "racing") {
      clearInterval(interval);
      raceIntervals.delete(room.id);
    }
  }, speed);

  raceIntervals.set(room.id, interval);
}

function stopAutoRace(room) {
  if (raceIntervals.has(room.id)) {
    clearInterval(raceIntervals.get(room.id));
    raceIntervals.delete(room.id);
  }
}

/* -----------------------------
   SOCKET SERVER
----------------------------- */

app.prepare().then(() => {
  const httpServer = createServer(handler);

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", ({ roomId, name, playerId }) => {
      if (!roomId) return;

      const normalizedRoomId = roomId.toUpperCase();

      if (!rooms.has(normalizedRoomId)) {
        rooms.set(normalizedRoomId, {
          id: normalizedRoomId,
          hostId: playerId || socket.id,
          players: [],
          game: null,
          gameState: null,
        });
      }

      const room = rooms.get(normalizedRoomId);

      if (room.players.length >= 12) {
        socket.emit("room-full");
        return;
      }

      const savedPlayerId = playerId || socket.id;
      const existingPlayer = room.players.find(
        (player) => player.id === savedPlayerId
      );

      if (!existingPlayer) {
        const isHost = room.players.length === 0;
        const player = createPlayer(savedPlayerId, name, isHost);
        room.players.push(player);

        if (isHost) {
          room.hostId = savedPlayerId;
        }
      }

      socket.join(normalizedRoomId);
      io.to(normalizedRoomId).emit("room-updated", room);
    });

    socket.on("toggle-ready", ({ roomId, playerId }) => {
      const room = rooms.get(roomId?.toUpperCase());
      if (!room) return;

      room.players = room.players.map((player) =>
        player.id === playerId
          ? { ...player, ready: !player.ready }
          : player
      );

      io.to(room.id).emit("room-updated", room);
    });

    socket.on("select-game", ({ roomId, playerId, game }) => {
      const room = rooms.get(roomId?.toUpperCase());
      if (!room) return;

      const player = room.players.find((p) => p.id === playerId);
      if (!player?.isHost) return;

      stopAutoRace(room);

      room.game = game;
      room.gameState = null;

      io.to(room.id).emit("room-updated", room);
    });

    socket.on("start-game", ({ roomId, playerId }) => {
      const room = rooms.get(roomId?.toUpperCase());
      if (!room) return;

      const player = room.players.find((p) => p.id === playerId);
      if (!player?.isHost) return;
      if (!room.game) return;

      stopAutoRace(room);

      room.players = room.players.map((player) => ({
        ...player,
        drinks: 0,
        penalties: 0,
      }));

      if (room.game === "ride-the-bus") {
        room.gameState = createRideTheBusState(room.players);
      }

      if (room.game === "higher-or-lower") {
        room.gameState = createHigherOrLowerState(room.players);
      }

      if (room.game === "horse-racing") {
        room.gameState = createHorseRacingState();
      }

      io.to(room.id).emit("game-started", {
        game: room.game,
        roomId: room.id,
      });

      io.to(room.id).emit("room-updated", room);
    });

    socket.on("request-room-state", ({ roomId }) => {
      const room = rooms.get(roomId?.toUpperCase());
      if (!room) return;

      socket.join(room.id);
      socket.emit("room-updated", room);
    });

    socket.on("ride-the-bus-answer", ({ roomId, playerId, answer }) => {
      const room = rooms.get(roomId?.toUpperCase());
      if (!room) return;

      handleRideTheBusAnswer(room, playerId, answer);

      io.to(room.id).emit("room-updated", room);
    });

    socket.on(
      "higher-or-lower-select-stack",
      ({ roomId, playerId, stackIndex }) => {
        const room = rooms.get(roomId?.toUpperCase());
        if (!room) return;

        handleHigherOrLowerSelectStack(room, playerId, stackIndex);

        io.to(room.id).emit("room-updated", room);
      }
    );

    socket.on("higher-or-lower-guess", ({ roomId, playerId, choice }) => {
      const room = rooms.get(roomId?.toUpperCase());
      if (!room) return;

      handleHigherOrLowerGuess(room, playerId, choice);

      io.to(room.id).emit("room-updated", room);
    });

    socket.on("higher-or-lower-restart", ({ roomId, playerId }) => {
      const room = rooms.get(roomId?.toUpperCase());
      if (!room) return;

      restartHigherOrLower(room, playerId);

      io.to(room.id).emit("room-updated", room);
    });

    socket.on("horse-bet", ({ roomId, playerId, suit, amount }) => {
      const room = rooms.get(roomId?.toUpperCase());
      if (!room) return;

      handleHorseBet(room, playerId, suit, amount);

      io.to(room.id).emit("room-updated", room);
    });

    socket.on("horse-start", ({ roomId, playerId }) => {
      const room = rooms.get(roomId?.toUpperCase());
      if (!room) return;

      startHorseRace(room, playerId);

      io.to(room.id).emit("room-updated", room);
    });

    socket.on("horse-step", ({ roomId }) => {
      const room = rooms.get(roomId?.toUpperCase());
      if (!room) return;

      stepHorseRace(room);

      io.to(room.id).emit("room-updated", room);
    });

    socket.on("horse-auto-start", ({ roomId, speed }) => {
      const room = rooms.get(roomId?.toUpperCase());
      if (!room) return;

      startAutoRace(room, speed, io);
    });

    socket.on("horse-auto-stop", ({ roomId }) => {
      const room = rooms.get(roomId?.toUpperCase());
      if (!room) return;

      stopAutoRace(room);
    });

    socket.on("horse-assign-drinks", ({ roomId, playerId, assignments }) => {
      const room = rooms.get(roomId?.toUpperCase());
      if (!room) return;

      const game = room.gameState;
      if (!game || game.type !== "horse-racing") return;
      if (game.phase !== "assigning") return;

      game.drinkAssignments[playerId] = assignments || {};

      io.to(room.id).emit("room-updated", room);
    });

    socket.on("horse-finish-assignments", ({ roomId, playerId }) => {
      const room = rooms.get(roomId?.toUpperCase());
      if (!room) return;

      const game = room.gameState;
      if (!game || game.type !== "horse-racing") return;
      if (game.phase !== "assigning") return;

      if (!game.finishedAssigners.includes(playerId)) {
        game.finishedAssigners.push(playerId);
      }

      if (game.finishedAssigners.length >= room.players.length) {
        calculateHorseResults(room);
        game.phase = "results";
        game.message = "Results ready!";
      }

      io.to(room.id).emit("room-updated", room);
    });

    socket.on("horse-restart", ({ roomId, playerId }) => {
      const room = rooms.get(roomId?.toUpperCase());
      if (!room) return;

      const player = room.players.find((p) => p.id === playerId);
      if (!player?.isHost) return;

      stopAutoRace(room);
      room.gameState = createHorseRacingState();

      io.to(room.id).emit("room-updated", room);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(`🚀 Server ready at http://${hostname}:${port}`);
  });
});