import { getUserBoards, getDb, getAllUsers } from "./server/db.js";

async function test() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    return;
  }
  
  const users = await getAllUsers();
  console.log("Users found:", users.length);
  
  for (const user of users) {
    const boards = await getUserBoards(user.id);
    console.log(`User ${user.username} (id: ${user.id}, role: ${user.role}) has ${boards.length} boards.`);
  }
}

test();
