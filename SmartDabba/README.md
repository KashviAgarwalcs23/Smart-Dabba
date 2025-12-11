# Smart Hard Water Monitoring - IoT Data Simulator & API (Person 1)

This project provides the core water quality data infrastructure for Smart Hard Water Monitoring in Bengaluru through a secure and reliable REST API, with realistic simulated readings for key areas.

## 🚀 Quick Start

### 1. Clone and Setup

```bash
git clone [YOUR GITHUB REPO URL]
cd smart-water-project
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Firebase

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Realtime Database
3. Download the Service Account Key JSON file
4. Copy `.env.example` to `.env` and update:
   ```bash
   cp .env.example .env
   ```
5. Edit `.env` with your Firebase credentials:
   ```
   FIREBASE_DATABASE_URL="https://your-project-id-default-rtdb.firebaseio.com"
   FIREBASE_CREDENTIALS_PATH="path/to/your/firebase-key.json"
   SECRET_KEY="your_long_random_secret_key"
   ```

### 3. Generate Initial Data

```bash
python simulator.py
```

### 4. Start API Server

```bash
python app.py
```

Your API will be available at `http://localhost:5000`

## 📊 Data Sources & Realism

Our simulation is based on **real water quality studies** from Bengaluru:

### Hard Water Areas (Borewell/Groundwater)
- **Whitefield**: TDS 192-1002 PPM, Hardness 96-492 PPM
- **Electronics City**: TDS 68-1236 PPM, Hardness 8-580 PPM  
- **Sarjapur**: TDS 200-1100 PPM, Hardness 85-450 PPM

### Soft Water Areas (Cauvery/Municipal)
- **Jayanagar**: TDS 150-400 PPM, Hardness 60-180 PPM
- **HSR Layout**: TDS 142-646 PPM, Hardness 68-276 PPM
- **MG Road**: TDS 120-350 PPM, Hardness 40-150 PPM

*Source: DrinkPrime water quality study, BWSSB reports, CGWB Karnataka*

## 🔗 API Endpoints

Base URL: `https://your-app-name.render.com` (after deployment)

### 1. Health Check
```http
GET /
```

**Response:**
```json
{
  "message": "Smart Hard Water Monitoring API",
  "version": "1.0",
  "status": "active",
  "endpoints": ["/get_latest", "/get_history?area=AreaName"]
}
```

### 2. Get Latest Readings

```http
GET /get_latest
```

**Response:**
```json
{
  "Whitefield": {
    "Ca": 185.2,
    "Mg": 62.1,
    "TDS": 920.5,
    "area": "Whitefield",
    "chlorine": 0.04,
    "pH": 7.35,
    "timestamp": "2025-09-28 23:30:00",
    "turbidity": 3.4,
    "hardness": 387.5,
    "water_classification": {
      "tds_class": "Poor",
      "hardness_class": "Very Hard",
      "overall_quality": "Needs Treatment"
    }
  },
  "Jayanagar": {
    "Ca": 35.2,
    "Mg": 15.1,
    "TDS": 285.5,
    "area": "Jayanagar",
    "chlorine": 0.35,
    "pH": 7.1,
    "timestamp": "2025-09-28 23:25:00",
    "turbidity": 1.2,
    "hardness": 125.0,
    "water_classification": {
      "tds_class": "Excellent",
      "hardness_class": "Moderately Hard",
      "overall_quality": "Good"
    }
  }
}
```

### 3. Get Historical Data

```http
GET /get_history?area=Whitefield&hours=24
```

**Parameters:**
- `area` (required): Area name (e.g., "Whitefield", "Jayanagar")
- `hours` (optional): Number of hours to fetch (default: 24)

**Response:**
```json
{
  "area": "Whitefield",
  "hours_requested": 24,
  "record_count": 18,
  "data": [
    {
      "Ca": 178.8,
      "Mg": 58.2,
      "TDS": 895.2,
      "area": "Whitefield",
      "chlorine": 0.02,
      "pH": 7.28,
      "timestamp": "2025-09-27 23:30:00",
      "turbidity": 3.1,
      "hardness": 365.4,
      "water_classification": {
        "tds_class": "Fair",
        "hardness_class": "Very Hard",
        "overall_quality": "Needs Treatment"
      }
    }
  ]
}
```

### 4. Get Available Areas

```http
GET /get_areas
```

**Response:**
```json
{
  "areas": ["Whitefield", "Electronics City", "Sarjapur", "Jayanagar", "HSR Layout", "MG Road"]
}
```

## 🚀 Deployment

### Deploy to Render (Recommended - Free Tier)

1. Push your code to GitHub
2. Connect your GitHub repo to [Render](https://render.com)
3. Create a new Web Service
4. Set environment variables in Render dashboard:
   - `FIREBASE_DATABASE_URL`
   - `FIREBASE_CREDENTIALS_PATH` 
   - `SECRET_KEY`
5. Deploy!

### Deploy to Heroku

```bash
heroku create your-app-name
heroku config:set FIREBASE_DATABASE_URL="your-url"
heroku config:set SECRET_KEY="your-secret"
git push heroku main
```

## 📋 Water Quality Classifications

### TDS (Total Dissolved Solids) Levels:
- **Excellent**: < 300 PPM
- **Good**: 300-600 PPM  
- **Fair**: 600-900 PPM
- **Poor**: 900-1200 PPM
- **Unacceptable**: > 1200 PPM

### Hardness Levels:
- **Soft**: < 60 PPM (as CaCO₃)
- **Moderately Hard**: 60-120 PPM
- **Hard**: 120-180 PPM  
- **Very Hard**: > 180 PPM

## 🔧 Troubleshooting

### Common Issues:

1. **Firebase Connection Error**: 
   - Verify your `.env` file paths
   - Check Firebase project permissions
   - Ensure Realtime Database is enabled

2. **No Data Available**:
   - Run `python simulator.py` first
   - Check Firebase console for data

3. **CORS Issues**:
   - CORS is enabled by default
   - For custom domains, update CORS settings in `app.py`

## 📝 For Teammates

### Integration Guide:

**Person 2 (AI/ML)**: Use these endpoints to fetch data:
```python
import requests

# Get latest data for ML processing
response = requests.get("https://your-api.render.com/get_latest")
data = response.json()

# Get historical data for time series
response = requests.get("https://your-api.render.com/get_history?area=Whitefield&hours=168")  # 1 week
history = response.json()
```

**Person 3 (Dashboard)**: Use these endpoints for visualization:
```javascript
// Fetch latest data for dashboard
fetch('https://your-api.render.com/get_latest')
  .then(response => response.json())
  .then(data => {
    // Update dashboard with latest readings
  });

// Fetch historical data for charts
fetch('https://your-api.render.com/get_history?area=Whitefield')
  .then(response => response.json())
  .then(data => {
    // Create time series charts
  });
```

## 📊 Sample Data Statistics

Generated dataset includes:
- **1,200 total records** across 6 areas
- **200 records per area** spanning 2 weeks
- **Realistic correlations** between TDS, hardness, Ca, and Mg
- **Area-specific patterns** based on water source types
- **Water quality classifications** for each record

## 🔒 Security

- Environment variables for sensitive data
- CORS enabled for frontend integration
- Input validation on all endpoints
- Error handling for database connection issues

---

**Contact**: [Your Name] - [Your Email]  
**Project**: Smart Hard Water Monitoring for Bengaluru  
**Version**: 1.0.0