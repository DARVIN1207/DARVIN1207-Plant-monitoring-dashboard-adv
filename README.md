# Plant Health Monitoring System

A robust, full-stack web application designed to help farmers and botanists monitor crop health in real-time. This system facilitates data-driven decision-making through sensor logs, automated alerts, and direct communication channels.

## Key Features
-   **Role-Based Dashboards**: Tailored interfaces for Farmers (monitoring) and Botanists (management & analysis).
-   **Real-Time Alerts**: Automated WhatsApp notifications for critical conditions (e.g., low moisture, high temp).
-   **Health Logging**: Track soil moisture, pH, temperature, and nutrient levels.
-   **Crop Calendar**: Plan and track farming tasks (planting, fertilizing, harvest).
-   **Reporting**: Export detailed health logs and alert history as CSV.

## Tech Stack
-   **Frontend**: HTML5, CSS3, Vanilla JavaScript.
-   **Backend**: Node.js, Express.js.
-   **Database**: SQLite.
-   **Services**: `whatsapp-web.js` for messaging.

## Quick Start
1.  **Install Dependencies**:
    ```bash
    npm install
    cd backend && npm install
    ```
2.  **Initialize Database**:
    ```bash
    npm run init-db
    ```
3.  **Run Application**:
    ```bash
    npm run dev
    ```
    Access the app at `http://localhost:3000`.
## License
MIT License.
