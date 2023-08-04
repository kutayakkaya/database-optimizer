const DatabaseOptimizer = require('./service/DatabaseOptimizer');

(async () => {
    const optimizer = new DatabaseOptimizer();
    const suggestions = await optimizer.analyzeTables();

    console.log('Optimization suggestions:');
    console.log(suggestions);
})();