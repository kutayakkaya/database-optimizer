const mysql = require('mysql');
require('dotenv').config();

class DatabaseOptimizer {
    constructor() {
        this.connection = null;
    }

    async connectToDatabase() {
        // Create a database connection using environment variables
        if (!this.connection || this.connection.state === 'disconnected') {
            this.connection = mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_DATABASE,
            });
        }

        // Connect to the database
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
    async runQuery(query, values) {
        if (!this.connection || this.connection.state === 'disconnected') {
            await this.connectToDatabase();
        }

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

    // Method to close the database connection
    async closeConnection() {
        if (this.connection && this.connection.state !== 'disconnected') {
            await new Promise((resolve) => this.connection.end(resolve));
            console.log('Connection closed.');
        }
    }

    // Get the names of all tables in the database
    async getTableNames() {
        try {
            const results = await this.runQuery('SHOW TABLES');
            return results.map((row) => Object.values(row)[0]);
        }
        catch (err) {
            console.error('Error getting table names: ', err);
            return [];
        }
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
            const tableStatusQuery = 'SHOW TABLE STATUS LIKE ?';
            const columnDataTypesQuery = `
                SELECT
                COLUMN_NAME,
                COLUMN_TYPE
                FROM
                INFORMATION_SCHEMA.COLUMNS 
                WHERE
                TABLE_NAME = ?;`;

            // Run all necessary queries in parallel
            const [indexes, rowCountResult, columnCardinalityResult, tableStatus, columnDataTypesResult] = await Promise.all([
                this.runQuery(indexQuery, [tableName]),
                this.runQuery(rowCountQuery, [tableName]),
                this.runQuery(columnCardinalityQuery, [tableName]),
                this.runQuery(tableStatusQuery, [tableName]),
                this.runQuery(columnDataTypesQuery, [tableName])
            ]);

            // Extract unused indexes from table status
            const unusedIndexes = tableStatus.reduce((acc, row) => {
                const indexes = row.Comment.split(',');
                const unused = indexes.filter((index) => index.includes('Unused'));

                if (unused.length > 0) {
                    acc.push({
                        index_name: unused.join(', '),
                        table_name: row.Name
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
                hasForeignKeys,
                columnDataTypes: columnDataTypesResult
            };
            return tableStats;
        }
        catch (err) {
            console.error('Error analyzing table: ', err);
            return {};
        }
    }

    // Method to identify potential data type optimizations
    getDataTypeOptimizations(tableName, columnDataTypes) {
        const suggestions = [];
        const dataTypeMap = {
            int: 'smallint',
            bigint: 'int',
            float: 'decimal',
            double: 'decimal',
            char: 'varchar',
            text: 'varchar',
            longtext: 'text',
            date: 'datetime',
        };

        for (const column of columnDataTypes) {
            const columnName = column.COLUMN_NAME;
            const currentDataType = column.COLUMN_TYPE.toLowerCase();
            const optimizedDataType = dataTypeMap[currentDataType];

            if (optimizedDataType && currentDataType !== optimizedDataType) {
                suggestions.push({
                    tableName: tableName,
                    suggestion: `Consider optimizing data type of column "${columnName}" from "${currentDataType}" to "${optimizedDataType}" to save storage space.`,
                });
            }
        }

        return suggestions;
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

                // Perform data type optimizations
                const dataTypeOptimizations = this.getDataTypeOptimizations(tableName, tableStats.columnDataTypes);

                if (dataTypeOptimizations.length > 0) {
                    suggestions.push(...dataTypeOptimizations);
                }
            }

            // Close the database connection
            this.closeConnection();
            return suggestions;
        }
        catch (err) {
            console.error('Error analyzing tables: ', err);

            // Close the database connection if an error occurs
            this.closeConnection();
            return [];
        }
    }
}

module.exports = DatabaseOptimizer;