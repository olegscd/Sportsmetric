import { randomBytes, scryptSync } from "node:crypto";

// Read from stdin to avoid placing a password in shell history or arguments.
let password = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) password += chunk;
password = password.replace(/\r?\n$/, "");
if (password.length < 12) throw new Error("Use at least 12 characters.");
const salt = randomBytes(16).toString("hex");
console.error("For .env.local, escape each $ in the hash as \\$. Deployment secret settings use the raw value.");
console.log(`scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`);
