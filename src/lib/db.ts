export async function checkUserExists(env: Env, email: string) {
  const exists = await env.DB.prepare("SELECT 1 FROM Users WHERE email = ?")
    .bind(email)
    .first();
  return exists;
}

export async function createUser(
  env: Env,
  email: string,
  hash: string,
  salt: string
) {
  const userId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO Users (userId, email, passwordHash, passwordSalt) VALUES (?, ?, ?, ?)"
  )
    .bind(userId, email, hash, salt)
    .run();
}

export async function getUserByEmail(env: Env, email: string) {
  const row = await env.DB.prepare(
    "SELECT userId, passwordHash, passwordSalt FROM Users WHERE email = ?"
  )
    .bind(email)
    .first();
  return row;
}

export async function getChatsByUserId(env: Env, userId: string) {
  const { results } = await env.DB.prepare(
    "SELECT chatId, title, createdTime FROM Chats WHERE userId = ? ORDER BY createdTime DESC"
  )
    .bind(userId)
    .all();

  return results;
}

export async function getChatById(env: Env, chatId: string) {
  const result = await env.DB.prepare(
    "SELECT chatId FROM Chats WHERE chatId = ?"
  )
    .bind(chatId)
    .first();
  return result;
}

export async function createChat(
  env: Env,
  userId: string,
  chatId: string,
  title: string
) {
  await env.DB.prepare(
    "INSERT INTO Chats (chatId, userId, title) VALUES (?, ?, ?)"
  )
    .bind(chatId, userId, title)
    .run();
}
