// config.js
// Reads the admin password from the environment. If it's missing we
// print a loud warning at startup so the bug is obvious in Render's
// logs instead of silently letting every password fail.

const pwd = process.env.ADMIN_PASSWORD;

if (!pwd) {
  console.error(
    '❌ ADMIN_PASSWORD is not set!\n' +
    '   Locally: add it to backend/.env\n' +
    '   On Render: add it under Environment → Environment Variables\n' +
    '   Until this is set, the Register page will reject every password.'
  );
}

module.exports = {
  ADMIN_PASSWORD: pwd || ''
};
