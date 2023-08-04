const mysql = require('mysql');
require('dotenv').config();

class DatabaseOptimizer {
    constructor() {
        // Create a database connection using environment variables
        this.connection = mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
        });
    }

    // Connect to the database
    connectToDatabase() {
        return new Promise((resolve, reject) => {
            this.connection.connect((err) => {
                if (err) {
                    reject(err);
                }
                else {
                    console.log('Connected to the database.');
                    resolve();
                }
            });
        });
    }

    // Run a database query with optional parameter values
    runQuery(query, values) {
        return new Promise((resolve, reject) => {
            this.connection.query(query, values, (err, results) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(results);
                }
            });
        });
    }

    // Get the names of all tables in the database
    getTableNames() {
        return new Promise((resolve, reject) => {
            this.connection.query('SHOW TABLES', (err, results) => {
                if (err) {
                    reject(err);
                }
                else {
                    const tableNames = results.map((row) => Object.values(row)[0]);
                    resolve(tableNames);
                }
            });
        });
    }

    // Analyze a specific table for index count, row count, column cardinality, and unused indexes
    async analyzeTable(tableName) {
        try {
            const indexQuery = 'SHOW INDEXES FROM ??';
            const rowCountQuery = 'SELECT COUNT(*) AS rowCount FROM ??';
            const columnCardinalityQuery = `
                SELECT
                    COLUMN_NAME,
                    COUNT(DISTINCT COLUMN_NAME) AS cardinality 
                FROM
                    INFORMATION_SCHEMA.COLUMNS 
                WHERE
                    TABLE_NAME = ? 
                GROUP BY
                    COLUMN_NAME 
                HAVING
                    cardinality < 10;`;
            const tableStatusQuery = 'SHOW TABLE STATUS LIKE ??';

            // Run all necessary queries in parallel
            const [indexes, rowCountResult, columnCardinalityResult, tableStatus] = await Promise.all([
                this.runQuery(indexQuery, [tableName]),
                this.runQuery(rowCountQuery, [tableName]),
                this.runQuery(columnCardinalityQuery, [tableName]),
                this.runQuery(tableStatusQuery, [tableName])
            ]);

            // Extract unused indexes from table status
            const unusedIndexes = tableStatus.reduce((acc, row) => {
                const indexes = row.Comment.split(',');
                const unused = indexes.filter((index) => index.includes('Unused'));

                if (unused.length > 0) {
                    acc.push({
                        index_name: unused.join(', '),
                        table_name: row.Name,
                        last_access_time: row.Update_time,
                    });
                }
                return acc;
            }, []);

            // Check if the table has foreign keys
            const hasForeignKeys = indexes.some((index) =>
                index.Key_name !== 'PRIMARY' && index.Index_type === 'BTREE' && index.Non_unique === 0
            );

            // Prepare the table statistics
            const tableStats = {
                indexCount: indexes.length,
                rowCount: rowCountResult[0].rowCount,
                columnCardinality: columnCardinalityResult,
                unusedIndexes,
                hasForeignKeys
            };

            console.log('Table statistics:', tableStats);
            return tableStats;
        }
        catch (err) {
            console.error('Error analyzing table: ', err);
            return {};
        }
    }

    // Analyze all tables in the database and provide optimization suggestions
    async analyzeTables() {
        try {
            // Connect to the database
            await this.connectToDatabase();

            // Get the names of all tables
            const tableNames = await this.getTableNames();
            const suggestions = [];

            for (const tableName of tableNames) {
                // Analyze each table and collect optimization suggestions
                const tableStats = await this.analyzeTable(tableName);

                // Add suggestions based on analysis results
                if (tableStats.indexCount === 0) {
                    suggestions.push({
                        tableName,
                        suggestion: 'Add an index to improve query performance.',
                    });
                }

                if (tableStats.rowCount > 100000) {
                    suggestions.push({
                        tableName,
                        suggestion: 'Consider partitioning the table to improve query performance.',
                    });
                }

                if (tableStats.columnCardinality.length > 0) {
                    suggestions.push({
                        tableName,
                        suggestion: `Consider adding an index or partitioning for columns with low cardinality: ${tableStats.columnCardinality.map(row => row.COLUMN_NAME).join(', ')}`,
                    });
                }

                if (tableStats.unusedIndexes.length > 0) {
                    suggestions.push({
                        tableName,
                        suggestion: `Remove unused indexes: ${tableStats.unusedIndexes.map(row => row.index_name).join(', ')}`,
                    });
                }

                if (!tableStats.hasForeignKeys) {
                    suggestions.push({
                        tableName,
                        suggestion: 'Add foreign keys to establish relationships between tables.',
                    });
                }
            }

            // Close the database connection
            this.connection.end();
            return suggestions;
        }
        catch (err) {
            console.error('Error analyzing tables: ', err);

            // Close the database connection if an error occurs
            if (this.connection) {
                this.connection.end();
            }

            return [];
        }
    }
}

module.exports = DatabaseOptimizer;
