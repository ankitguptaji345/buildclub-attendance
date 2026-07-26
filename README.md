# Build Club Vision Challenge — Smart Attendance System

A face-recognition attendance system for the makerspace. Register a member's
face once, then a live webcam automatically checks members in and out and
tracks their hours on a dashboard.

## Folder structure

```
buildclub-attendance/
├── backend/          <- Member B: server, database, face-matching logic
│   ├── server.js
│   ├── db.js
│   ├── package.json
│   └── routes/
│       ├── members.js
│       └── attendance.js
└── frontend/         <- Member A: pages the user sees
    ├── index.html
    ├── register.html
    ├── camera.html
    ├── dashboard.html
    ├── css/style.css
    ├── js/ (register.js, camera.js, dashboard.js)
    ├── lib/ (face-api.min.js, chart.umd.js)
    └── models/ (face recognition model weights)
```

## How to run

```
cd backend
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

Full step-by-step setup instructions (including GitHub) are in the chat
where this project was generated.
