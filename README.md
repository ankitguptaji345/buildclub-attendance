# 🎯 Build Club Attendance

<div align="center">

**Smart Face Recognition Attendance System for Makerspaces**

[![GitHub](https://img.shields.io/badge/GitHub-ankitguptaji345%2Fbuildclub--attendance-blue?logo=github)](https://github.com/ankitguptaji345/buildclub-attendance)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-buildclub--attendance.onrender.com-green?logo=render)](https://buildclub-attendance.onrender.com)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green?logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-lightgrey?logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue?logo=postgresql)](https://www.postgresql.org/)

</div>

---

## 📋 Overview

**Build Club Attendance** is an intelligent face recognition system designed for makerspaces and community centers. Members register their face once, and the system automatically tracks check-ins, check-outs, and engagement metrics through a live webcam feed. No badges. No manual entry. Pure facial recognition magic.

Perfect for:
- 🏢 Makerspaces & Community Labs
- 🎓 Educational Institutions  
- 💼 Corporate Training Centers
- 🏃 Fitness & Recreation Facilities

---

## ✨ Key Features

### 🔐 **Smart Recognition**
- One-time face registration per member
- Real-time face detection with confidence scoring
- Multi-pose recognition (side angles supported)
- Live webcam feed with instant feedback

### 📊 **Advanced Analytics Dashboard**
- **Live Activity Stream** - See who's checking in/out in real-time
- **GitHub-style Heatmap Calendar** - Visualize member engagement over time
- **Leaderboard with Badges** - Gamified engagement tracking
- **Attendance Search** - Quick lookup by date and member name
- **CSV Export** - Download all attendance records instantly

### 🏅 **Engagement Badges**
Automatically earned by members:
- 🌱 **First Visit** - Join the community
- 🔥 **Streak Master** - Consecutive days visited
- 💯 **10-Hour Club** - Logged 10+ hours
- 🌅 **Early Bird** - Morning champion
- 🦉 **Night Owl** - After-hours maker
- 🏆 **Top Maker** - Member of the month

### 🎯 **User Experience**
- ✅ One-click startup (`start.bat` / `start.sh`)
- 🖥️ Fullscreen Kiosk Mode
- 🔔 Toast notifications + sound alerts
- ⏰ Auto-checkout after 12 hours (safety net)
- 🔇 Mute toggle for notifications
- 📱 Responsive design for all devices

### ⚙️ **Admin Features**
- 🔒 Password-protected member registration
- 📈 Real-time attendance statistics
- 🎛️ System configuration dashboard
- 🗂️ Complete member database management

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+
- **PostgreSQL** (local or cloud: Neon, Supabase, etc.)
- Modern web browser with camera access

### Installation & Setup

#### **Windows Users** 🪟
```bash
# Just double-click!
start.bat
```

#### **Mac/Linux Users** 🍎🐧
```bash
# First time only: make script executable
chmod +x start.sh

# Then double-click or run:
./start.sh
```

**That's it!** The scripts will:
1. ✅ Install dependencies
2. ✅ Start the backend server
3. ✅ Open the app in your browser
4. ✅ Keep running in the background

### Manual Setup
```bash
# Navigate to backend
cd backend
npm install
npm start

# In another terminal, navigate to frontend
cd frontend
python -m http.server 3001
# Or use any static server pointing to frontend/
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Vanilla JavaScript, HTML5, CSS3 | Responsive UI |
| **Face Recognition** | face-api.js | Real-time detection & matching |
| **Charting** | Chart.js | Heatmaps & analytics |
| **Backend** | Express.js | RESTful API server |
| **Database** | PostgreSQL | Attendance & member storage |
| **Hosting** | Render.com | Live deployment |

---

## 📁 Project Structure

```
buildclub-attendance/
├── backend/
│   ├── server.js              ← Main Express server
│   ├── db.js                  ← Database configuration
│   ├── config.js              ← Admin password & settings
│   ├── package.json
│   └── routes/
│       ├── members.js         ← Registration endpoints
│       ├── attendance.js       ← Check-in/out logic
│       ├── analytics.js        ← Dashboard data
│       └── export.js           ← CSV export
│
├── frontend/
│   ├── index.html             ← Home page
│   ├── register.html          ← Face registration
│   ├── camera.html            ← Live check-in/out
│   ├── dashboard.html         ← Analytics dashboard
│   ├── css/
│   │   └── style.css          ← Styling
│   ├── js/
│   │   ├── register.js        ← Registration logic
│   │   ├── camera.js          ← Face detection
│   │   ├── dashboard.js       ← Analytics rendering
│   │   └── utils.js           ← Helper functions
│   ├── lib/
│   │   ├── face-api.min.js    ← Face recognition library
│   │   └── chart.umd.js       ← Charting library
│   └── models/
│       └── [face recognition weights]
│
├── start.sh                   ← Mac/Linux starter
├── start.bat                  ← Windows starter
├── ecosystem.config.js        ← PM2 configuration (optional)
└── README.md
```

---

## 🎬 Demo & Documentation

### 📹 **Project Video**
*(Add your demo video link here)*

<div align="center">

**[➡️ CLICK HERE TO OPEN VIDEO DEMO](https://youtu.be/ZwZii33tusM)**

</div>

> Coming soon! Replace the link above with your YouTube or Loom video showcasing:
> - Live face registration
> - Real-time check-in/out
> - Dashboard analytics
> - Badge achievements

### 📸 **Feature Highlights**
- **Home Page** - Sleek landing with project overview
- **Registration Portal** - Intuitive face capture & member setup
- **Kiosk Mode** - Full-screen check-in station
- **Live Analytics** - Real-time activity feed + heatmap
- **Member Dashboard** - Personal stats and badges

---

## 🔧 Configuration

Edit `backend/config.js` to customize:

```javascript
// Admin password for registration
ADMIN_PASSWORD: "change-me-123"

// Auto-checkout timeout (hours)
AUTO_LOGOUT_HOURS: 12

// Confidence threshold for recognition
CONFIDENCE_THRESHOLD: 0.6

// Toast notification duration (ms)
TOAST_DURATION: 3000
```

---

## 📦 Environment Setup

Create a `.env` file in the `backend/` directory:

```env
# Database
DATABASE_URL=postgres://user:password@localhost:5432/buildclub
DB_HOST=localhost
DB_PORT=5432
DB_USER=<postgres>
DB_PASSWORD=<your_password>
DB_NAME=buildclub

# Server
PORT=3000
NODE_ENV=production

# Face Recognition
CONFIDENCE_THRESHOLD=0.6
```

---

## 🚢 Deployment

### Deploy to Render
1. Push code to GitHub
2. Connect repository to Render
3. Set environment variables
4. Deploy!

```bash
# Build command
npm run build

# Start command (backend)
cd backend && npm start
```

### Deploy to Heroku
```bash
heroku create your-app-name
heroku config:set DATABASE_URL=your_postgres_url
git push heroku main
```

### Self-Hosted (PM2)
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 👥 Team

<div align="center">

| **Shreya Deb** | **Ankit Gupta** |
|:-:|:-:|
| Frontend & UI/UX | Backend & Database |
| Face Registration Flow | API Architecture |
| Dashboard Design | Recognition Engine |
| GitHub: [@ShreyaDeb2006](https://github.com/ShreyaDeb2006) | GitHub: [@ankitguptaji345](https://github.com/ankitguptaji345) |

</div>

---

## 🐛 Troubleshooting

### "Face not recognized"
- Ensure good lighting
- Face should be clearly visible (no masks/sunglasses)
- Try registering with multiple angles
- Increase confidence threshold in config

### Camera permission denied
- Check browser settings → Site permissions → Camera
- Make sure HTTPS is enabled for production
- Try a different browser

### Database connection error
- Verify PostgreSQL is running
- Check `.env` file database URL
- Ensure database exists: `createdb buildclub`

### Port already in use
- Change PORT in `.env`
- Or kill existing process: `lsof -ti:3000 | xargs kill -9`

---

## 📈 Future Enhancements

- 🤖 ML-based anomaly detection
- 👥 Multi-person simultaneous recognition
- 📧 Email notifications & reports
- 🔐 Two-factor authentication
- 🌍 Multi-language support
- 📱 Mobile app (React Native)
- 📊 Advanced BI & predictive analytics
- 🎤 Voice-based check-in

---

## 📄 License

This project is licensed under the **MIT License** - see the LICENSE file for details.

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Code Guidelines
- Follow existing code style
- Add comments for complex logic
- Test features before submitting
- Update documentation

---

## 📞 Support & Contact

- 📧 **Email:** [quentra643@gmail.com]
- 🐛 **Issues:** [GitHub Issues](https://github.com/ankitguptaji345/buildclub-attendance/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/ankitguptaji345/buildclub-attendance/discussions)

---

## 🌟 Acknowledgments

Built with ❤️ for makers and communities

- **face-api.js** - Face detection & recognition
- **Chart.js** - Beautiful data visualizations
- **Express.js** - Powerful backend framework
- **PostgreSQL** - Reliable data storage
- **Render** - Seamless deployment

---

<div align="center">

**Made for the [Build FOR BUILDClub Vision Challenge]** 🏆

⭐ If you find this project helpful, please consider giving it a star! ⭐

</div>
