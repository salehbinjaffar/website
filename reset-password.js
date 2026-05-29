/**
 * Reset admin password (Node + PHP hosting use same hash).
 * Usage: node reset-password.js
 *        node reset-password.js myNewPassword
 */
const { resetPassword } = require("./lib/auth");

const newPass = process.argv[2] || "admin123";
const { username, password } = resetPassword(newPass);

console.log("Password reset OK.");
console.log("  Username:", username);
console.log("  Password:", password);
console.log("Login at /admin");
