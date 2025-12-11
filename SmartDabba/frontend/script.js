// script.js
const P1_API_URL = "http://127.0.0.1:5000"; // Data API
const P2_API_URL = "http://127.0.0.1:5001"; // ML/Alerts API

// --- API Status Check ---
async function checkApiStatus(url, id) {
    try {
        const response = await fetch(url);
        const element = document.getElementById(id);

        if (response.ok) {
            element.textContent = "Running";
            element.className = "status-success";
        } else {
            element.textContent = "Error: " + response.status;
            element.className = "status-fail";
        }
    } catch (error) {
        document.getElementById(id).textContent = "Failed to Connect";
        document.getElementById(id).className = "status-fail";
    }
}

// --- Fetch Areas for the Select Box ---
async function fetchAreas() {
    try {
        const response = await fetch(`${P1_API_URL}/get_areas`);
        const areas = await response.json();
        const selectElement = document.getElementById('area-select');

        // Populate the dropdown with areas
        areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            selectElement.appendChild(option);
        });

    } catch (error) {
        console.error("Could not fetch areas:", error);
    }
}

// --- Fetch Alerts (P2 API) ---
async function fetchAlerts() {
    try {
        const response = await fetch(`${P2_API_URL}/alerts`);
        const alerts = await response.json();
        const container = document.getElementById('alerts-container');
        
        // Convert the JSON object to a nicely formatted string for display
        container.innerHTML = `<pre>${JSON.stringify(alerts, null, 2)}</pre>`;

    } catch (error) {
        document.getElementById('alerts-container').textContent = "Failed to load alerts from P2 API.";
        console.error("Could not fetch alerts:", error);
    }
}

// --- Fetch Prediction (P2 API) ---
async function fetchPrediction() {
    const area = document.getElementById('area-select').value;
    const output = document.getElementById('prediction-output');
    
    if (!area) {
        output.textContent = "Please select an area.";
        return;
    }

    output.textContent = `Fetching prediction for ${area}...`;

    try {
        const response = await fetch(`${P2_API_URL}/predict?area=${area}`);
        const prediction = await response.json();
        
        // Display the raw JSON prediction result
        output.textContent = JSON.stringify(prediction, null, 2);

    } catch (error) {
        output.textContent = `Failed to get prediction for ${area}. Ensure both APIs are running.`;
        console.error("Prediction fetch failed:", error);
    }
}


// --- RUN ON PAGE LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    // Check API status immediately
    checkApiStatus(P1_API_URL, 'status-p1');
    checkApiStatus(P2_API_URL, 'status-p2');

    // Load dynamic content
    fetchAreas();
    fetchAlerts();
});