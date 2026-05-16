# Gradelytics — AI Student Performance Analytics
### MERN Stack + Python ML Final Year Project

---

## 🗂 Project Structure

```
gradelytics/
├── client/          → React.js Frontend
├── server/          → Node.js + Express Backend
├── ml-service/      → Python Flask ML Microservice
└── docker-compose.yml
```

---

## ⚡ Quick Start (Manual)

### 1. Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB Atlas account (free tier) OR local MongoDB

---

### 2. Backend (Express API)

```bash
cd server
cp .env.example .env
# Edit .env — add your MONGO_URI from MongoDB Atlas

npm install
node seed.js        # Populate with sample data
npm run dev         # Starts on http://localhost:5000
```

---

### 3. ML Microservice (Flask)

```bash
cd ml-service
pip install -r requirements.txt

# Optional: download UCI dataset (student-mat.csv) to this folder
# https://archive.ics.uci.edu/ml/datasets/Student+Performance

python train_model.py   # Trains & saves models (takes ~10s)
python app.py           # Starts on http://localhost:8000
```

---

### 4. Frontend (React)

```bash
cd client
npm install
npm start           # Starts on http://localhost:3000
```

---

### 5. Login Credentials (after seed.js)

| Role    | Email                       | Password    |
|---------|-----------------------------|-------------|
| Admin   | admin@gradelytics.com        | admin123    |
| Teacher | teacher@gradelytics.com      | teacher123  |
| Student | amara@student.com           | student123  |

---

## 🐳 Docker (Run Everything at Once)

```bash
# From the root gradelytics/ folder:
docker-compose up --build

# Services:
# React Frontend  →  http://localhost:3000
# Express API     →  http://localhost:5000
# Flask ML        →  http://localhost:8000
# MongoDB         →  localhost:27017
```

---

## 🔌 API Reference

### Auth
| Method | Endpoint             | Description        |
|--------|----------------------|--------------------|
| POST   | /api/auth/register   | Register new user  |
| POST   | /api/auth/login      | Login & get token  |
| GET    | /api/auth/me         | Get current user   |

### Students
| Method | Endpoint                       | Description            |
|--------|--------------------------------|------------------------|
| GET    | /api/students                  | List all students      |
| POST   | /api/students                  | Add new student        |
| GET    | /api/students/:id              | Get student profile    |
| PUT    | /api/students/:id              | Update student         |
| PUT    | /api/students/:id/grades       | Add grade record       |
| PUT    | /api/students/:id/assignments  | Add assignment         |
| DELETE | /api/students/:id              | Remove student         |

### AI Predictions
| Method | Endpoint                         | Description              |
|--------|----------------------------------|--------------------------|
| POST   | /api/predict/:studentId          | Run new AI prediction    |
| GET    | /api/predict/:studentId/history  | Get prediction history   |

### Analytics
| Method | Endpoint                        | Description               |
|--------|---------------------------------|---------------------------|
| GET    | /api/analytics/overview         | Cohort KPIs               |
| GET    | /api/analytics/at-risk          | At-risk student list      |
| GET    | /api/analytics/attendance       | Attendance distribution   |
| GET    | /api/analytics/predictions/summary | Score summary          |

### ML Service
| Method | Endpoint      | Description                   |
|--------|---------------|-------------------------------|
| POST   | /predict      | Single student prediction     |
| POST   | /predict/batch| Batch predictions             |
| GET    | /health       | Service health check          |

---

## 🤖 ML Model

**Algorithm:** Gradient Boosting (GradientBoostingRegressor + GradientBoostingClassifier)

**Input Features:**
- Attendance rate (%)
- Assignment average score
- Midterm exam score
- Daily study hours
- Previous GPA (0–4.0)

**Outputs:**
- Predicted final exam score (0–100)
- Pass probability (%)
- Dropout risk (%)
- Model confidence (%)
- Personalised study recommendations

**Training data:** UCI Student Performance Dataset or auto-generated synthetic data

---

## 📱 Frontend Pages

| Route              | Page               | Access         |
|--------------------|--------------------|----------------|
| /login             | Login              | Public         |
| /register          | Register           | Public         |
| /dashboard         | KPI Dashboard      | All roles      |
| /students          | Student List       | All roles      |
| /students/add      | Add Student Form   | Teacher, Admin |
| /students/:id      | Student Profile    | All roles      |
| /predict/:id       | AI Prediction Run  | All roles      |
| /analytics         | Cohort Analytics   | Teacher, Admin |

---

## 🏗 Tech Stack

| Layer        | Technology                              |
|--------------|-----------------------------------------|
| Frontend     | React 18, React Router 6, Recharts      |
| Styling      | CSS Variables, DM Mono + Syne fonts     |
| Backend      | Node.js, Express 4, JWT, bcrypt         |
| Database     | MongoDB, Mongoose ODM                   |
| ML Service   | Python 3, Flask, Scikit-learn           |
| Auth         | JWT Bearer tokens, role-based guards    |
| Deployment   | Docker, Docker Compose, Nginx           |

---

## 🎓 Final Year Project Notes

This project demonstrates:
1. **Multi-service architecture** — React ↔ Express ↔ Flask ↔ MongoDB
2. **Machine learning integration** — trained Gradient Boosting model with real features
3. **Role-based access control** — student/teacher/admin permissions
4. **Data visualisation** — radar, line, bar, pie, scatter charts
5. **RESTful API design** — proper HTTP methods, status codes, validation
6. **Production-ready patterns** — JWT auth, error handling, environment config, Docker

---

*Built with Gradelytics — MERN + AI Student Performance Analytics System*
