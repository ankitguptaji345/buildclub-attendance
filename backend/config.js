// config.js — reads the admin password from env, warns loudly if missing.

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
