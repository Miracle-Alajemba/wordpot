export function generateRoomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function isValidRoomCode(code = "") {
  return typeof code === "string" && code.length === 6 && /^[A-Z2-9]+$/.test(code);
}
