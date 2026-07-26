// ecosystem.config.js
// OPTIONAL - only needed if you want the server to run permanently in the
// background (like a real product) instead of in a terminal window.
// Usage (after "npm install -g pm2"):
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup      <- follow the one printed command to auto-launch on boot
module.exports = {
  apps: [
    {
      name: 'buildclub-attendance',
      script: './backend/server.js',
      watch: false,
      autorestart: true
    }
  ]
};
