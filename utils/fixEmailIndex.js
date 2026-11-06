// scripts/fixEmailIndex.js
require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGO_URI); // target DB
  const users = mongoose.connection.collection("users");

  try {
    await users.dropIndex("email_1");
    console.log("Dropped email_1");
  } catch (e) {
    console.log("email_1 not dropped:", e.message);
  }

  await users.createIndex(
    { email: 1, role: 1 },
    { unique: true, name: "email_1_role_1" }
  );
  console.log("Created email_1_role_1 (one agent + one user per email)");

  console.log(await users.indexes());
  await mongoose.disconnect();
})();