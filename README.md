# Database Optimizer

The Database Optimizer is a Node.js application that helps you analyze your MySQL database and provides optimization suggestions to improve query performance. It checks for missing indexes, tables with high row counts, columns with low cardinality, and unused indexes.

## Features

- Analyze MySQL database tables for potential optimization opportunities.
- Detect missing indexes and suggest adding them to improve query performance.
- Identify tables with a high number of rows and suggest partitioning for better performance.
- Highlight columns with low cardinality and recommend adding indexes or partitioning.
- Detect and suggest removal of unused indexes to reduce unnecessary overhead.
- Advise adding foreign keys to establish relationships between tables for data consistency and integrity.

## Getting Started

### Prerequisites

- Node.js (version 10 or above)
- MySQL database

### Installation

1. Clone the repository:

```
git clone https://github.com/kutayakkaya/database-optimizer.git
```

2. Install dependencies:

```
cd database-optimizer
npm install
```

3. Set up environment variables:

Create a `.env` file in the root directory and provide your MySQL database credentials:

```
DB_HOST=your-database-host
DB_USER=your-database-username
DB_PASSWORD=your-database-password
DB_DATABASE=your-database-name
```

### Usage

To run the Database Optimizer and get optimization suggestions for your database tables:

```
node app.js
```

The application will connect to your MySQL database and perform analysis on each table. After the analysis is complete, it will display optimization suggestions for each table.

### License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.