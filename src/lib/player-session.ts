const LEGACY_PLAYER_ID_KEY = "playerId";
const LEGACY_PLAYER_NAME_KEY = "playerName";
const SESSION_PREFIX = "drinking-games:room";
const FRESH_JOIN_KEY = "drinking-games:fresh-join";

type PlayerSession = {
  playerId: string;
  name: string;
};

function normalizedRoomId(roomId: string) {
  return roomId.trim().toUpperCase();
}

function roomKey(roomId: string, field: "playerId" | "playerName") {
  return `${SESSION_PREFIX}:${normalizedRoomId(roomId)}:${field}`;
}

export function beginFreshJoin(roomId: string) {
  sessionStorage.setItem(FRESH_JOIN_KEY, normalizedRoomId(roomId));
}

export function consumeFreshJoin(roomId: string) {
  const cleanRoomId = normalizedRoomId(roomId);
  const isFreshJoin = sessionStorage.getItem(FRESH_JOIN_KEY) === cleanRoomId;

  if (isFreshJoin) {
    sessionStorage.removeItem(FRESH_JOIN_KEY);
  }

  return isFreshJoin;
}

export function loadPlayerSession(roomId: string): PlayerSession {
  const scopedPlayerId = localStorage.getItem(roomKey(roomId, "playerId"));
  const scopedName = localStorage.getItem(roomKey(roomId, "playerName"));

  if (scopedPlayerId && scopedName) {
    return { playerId: scopedPlayerId, name: scopedName };
  }

  return {
    playerId: localStorage.getItem(LEGACY_PLAYER_ID_KEY) || "",
    name: localStorage.getItem(LEGACY_PLAYER_NAME_KEY) || "",
  };
}

export function savePlayerSession(
  roomId: string,
  playerId: string,
  name: string
) {
  localStorage.setItem(roomKey(roomId, "playerId"), playerId);
  localStorage.setItem(roomKey(roomId, "playerName"), name);

  // Keep these during migration so older game pages and existing sessions work.
  localStorage.setItem(LEGACY_PLAYER_ID_KEY, playerId);
  localStorage.setItem(LEGACY_PLAYER_NAME_KEY, name);
}

export function clearPlayerSession(roomId: string, playerId?: string) {
  localStorage.removeItem(roomKey(roomId, "playerId"));
  localStorage.removeItem(roomKey(roomId, "playerName"));

  if (!playerId || localStorage.getItem(LEGACY_PLAYER_ID_KEY) === playerId) {
    localStorage.removeItem(LEGACY_PLAYER_ID_KEY);
    localStorage.removeItem(LEGACY_PLAYER_NAME_KEY);
  }
}
