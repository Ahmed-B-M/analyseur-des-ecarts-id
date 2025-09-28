# Logistics Analysis Dashboard

This is a Next.js application designed to analyze logistics data, providing insights into delivery performance, punctuality, and operational efficiency. It features a dashboard with various visualizations and tools to help identify trends, bottlenecks, and areas for improvement in the delivery process.

## Features

- **Data Upload and Parsing:** Users can upload logistics data in XLSX or CSV format. The application parses the data in a web worker to avoid blocking the main thread.
- **Interactive Dashboard:** A comprehensive dashboard displays key performance indicators (KPIs) and visualizations, including:
  - **Hot Zones Chart:** Identifies postal codes with the highest percentage of late deliveries.
  - **Depot Analysis Table:** Provides a detailed breakdown of performance metrics for each depot.
  - **Postal Code Table:** Ranks postal codes by delivery volume and punctuality.
  - **Slot Analysis Chart:** Visualizes the distribution of deliveries across different time slots.
  - **Customer Promise vs. Urbantz Plan:** Compares customer-selected delivery slots with the planned delivery times.
  - **Saturation Analysis:** Shows the gap between customer demand and delivery capacity over time.
- **Filtering and Sorting:** Data can be filtered by date, depot, city, and postal code. Tables are sortable by various metrics.
- **AI-Powered Analysis:** The application uses Genkit to provide AI-powered insights and generate reports.
- **Data Export:** Filtered data can be exported to an XLSX file for further analysis.

## Getting Started

### Prerequisites

- Node.js (v20 or later recommended)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-repository/logistics-analysis-dashboard.git
   cd logistics-analysis-dashboard
   ```
2. **Install dependencies:**
    ```bash
    npm install
    ```
### Running the Development Server
To run the application in development mode, you need to start both the Next.js server and the Genkit AI server.

1. **Start the Genkit AI server:**
    ```bash
    npm run genkit:dev
    ```
2. **Start the Next.js development server:**
    ```bash
    npm run dev
    ```
Open http://localhost:9003 in your browser to see the application.

## Project Structure
- `src/app/`: The main application pages and layouts.
- `src/components/`: Reusable React components, including UI elements and charts.
- `src/context/`: The `LogisticsContext` for state management.
- `src/hooks/`: Custom React hooks.
- `src/lib/`: Utility functions, type definitions, and data analysis logic.
- `src/workers/`: Web worker for parsing uploaded files.
- `src/ai/`: Genkit AI flows and configuration.
- `public/`: Static assets.
## Available Scripts
- `npm run dev`: Starts the Next.js development server.
- `npm run genkit:dev`: Starts the Genkit AI server.
- `npm run build`: Builds the application for production.
- `npm run start`: Starts the production server.
- `npm run lint`: Lints the code using Next.js's built-in ESLint configuration.
- `npm run typecheck`: Runs the TypeScript compiler to check for type errors.
## Technologies Used
- **Framework:** [Next.js](https://nextjs.org/)
- **UI:** [React](https://reactjs.org/), [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)
- **Charting:** [Recharts](https://recharts.org/)
- **AI:** [Genkit](https://firebase.google.com/docs/genkit)
- **File Handling:** [react-dropzone](https://react-dropzone.js.org/), [xlsx](https://github.com/SheetJS/sheetjs)
- **State Management:** React Context API
- **Forms:** [react-hook-form](https://react-hook-form.com/), [Zod](https://zod.dev/)
- **Utilities:** [date-fns](https://date-fns.org/), [clsx](https://github.com/lukeed/clsx), [tailwind-merge](https://github.com/dcastil/tailwind-merge)

## Contributing
Contributions are welcome! Please feel free to open an issue or submit a pull request.

## License
This project is licensed under the MIT License. See the `LICENSE` file for details.
