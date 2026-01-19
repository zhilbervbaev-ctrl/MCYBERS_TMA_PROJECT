# GDPR Compliance Auditor & ePrivacy Scanner

A comprehensive automated auditing system that scans websites for GDPR and ePrivacy compliance. It analyzes cookies (HTTP/Secure flags, lifespan, consent behavior) and evaluates Privacy/Cookie policies using AI to generate detailed compliance reports.

## System Components
1.  **Scanner (Java)**: Headless Chrome + Selenium automation to capture cookies and crawl policy pages. Uses Google Gemini AI for semantic analysis.
2.  **API (Node.js)**: Middleware to serve scan results from the database.
3.  **Frontend (React)**: Web dashboard for viewing audit reports.
4.  **Plugin (Chrome Extension)**: Browser extension for on-demand compliance scores.

## Prerequisites
*   **Java 17+** (Developed with Java 21)
*   **Node.js 18+**
*   **Docker** (for MySQL database)
*   **Google Chrome** & **ChromeDriver** (Must match your Chrome version)
    *   Download: [Chrome for Testing](https://googlechromelabs.github.io/chrome-for-testing/)

## Installation & Setup

### 1. Database Setup
Start the MySQL container using Docker:
```bash
# Create volume for persistence
docker volume create mysql_data

# Start MySQL
docker run --name some-mysql -p 3306:3306 -v mysql_data:/var/lib/mysql -e MYSQL_ROOT_PASSWORD=password -d mysql
```

Initialize the schema:
```bash
# Connect to DB container
docker exec -it some-mysql mysql -u root -ppassword

# Run SQL commands
CREATE DATABASE IF NOT EXISTS TMA;
USE TMA;

CREATE TABLE IF NOT EXISTS host_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hostname VARCHAR(255) NOT NULL,
    results TEXT NOT NULL, // JSON Data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
exit
```

### 2. Environment Variables
Export the following variables in your terminal (or add to `.bashrc` / `.zshrc`):

```bash
export GEMINI_API_KEY="your_google_gemini_api_key"
export CHROMEDRIVER_ABSOLUTE_PATH="/absolute/path/to/chromedriver"
export DATABASE_PASSWORD="password" 
```

### 3. Scanner Configuration
Add domains to scan in `app/domains.txt` (one URL per line):
```text
https://www.example.com
https://www.another-site.eu
```

## Running the System

### Step 1: Run the Scanner
This will process domains in `domains.txt`, automate the browser, and save results to the DB.
```bash
./gradlew :app:run
```

### Step 2: Start the API Server
The API serves the data to the Frontend and Plugin.
```bash
cd node
npm install # First run only
node server.js
```
*Server runs at http://localhost:3000*

### Step 3: Run the Frontend Dashboard
```bash
cd frontend
npm install # First run only
npm run dev
```
*Dashboard runs at http://localhost:5173*

## Browser Plugin Usage
1.  Open Chrome and navigate to `chrome://extensions/`.
2.  Enable **Developer mode** (top right).
3.  Click **Load unpacked**.
4.  Select the `plugin/` directory from this project.
5.  Visit a scanned website (e.g., `https://www.example.com`) and click the extension icon to see real-time compliance data.
