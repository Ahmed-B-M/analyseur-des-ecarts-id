# **App Name**: Logistics Insights Analyzer

## Core Features:

- Data Import & Processing: Import data from XLSX files (Tournées & Tâches), parse and normalize data types.
- Asynchronous Data Handling: Handle XLSX parsing and large datasets in a Web Worker to maintain UI responsiveness.
- Data Fusion and Aggregation: Join 'Tâches' and 'Tournées' datasets to perform complex calculations and generate aggregated logistics KPIs.
- Interactive Dashboard: Visualize key performance indicators (KPIs) with interactive charts (recharts library) and tables, enabling drill-down filtering.
- Calendar View: Display delivery schedules on a calendar with daily summaries and drill-down capabilities.
- Detailed Data Grid: Present detailed data in a sortable, filterable, and paginated table, reflecting all applied filters.
- AI-Powered Sentiment Analysis: Use Gemini to analyze customer feedback semantically, categorizing comments related to delivery timing issues (tool to label by 'Retard', 'Avance', or 'Autre').

## Style Guidelines:

- Primary color: ID Logistics Blue (#0033A0), a saturated hue, to give a professional and corporate feel that aligns with ID Logistics brand.
- Background color: Light gray (#F9FAFB), a heavily desaturated near-white similar in hue to the primary, to ensure comfortable readability.
- Accent color: ID Logistics Red (#E4002B), which is analogous in hue, but brighter and more saturated than the primary color, for highlights and important actions.
- Body and headline font: 'Inter', a sans-serif typeface for a modern, machined, objective, neutral look. The app features reports with substantial blocks of text and this font choice will perform well.
- Custom SVG icons representing key concepts (truck, box, clock, graph) for enhanced visual clarity.
- Responsive layout adaptable to both desktop and tablet screens, ensuring optimal viewing experience across devices.
- Subtle animations for loading states and data updates to enhance user engagement.