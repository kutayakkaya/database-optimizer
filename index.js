const fs = require('fs');
const DatabaseOptimizer = require('./service/DatabaseOptimizer');

(async () => {
    const optimizer = new DatabaseOptimizer();
    const suggestions = await optimizer.analyzeTables();
    const htmlContent = generateHtml(suggestions);

    fs.writeFile('index.html', htmlContent, (err) => {
        if (err) {
            throw err;
        }

        console.log('The index.html file has been created.');
    });
})();

function generateHtml(suggestions) {
    let html = '<!DOCTYPE html>\n';
    html += '<html>\n';
    html += '<head>\n';
    html += '<title>Database Optimization Suggestions</title>\n';
    html += '</head>\n';
    html += '<body>\n';
    html += '<h1>Database Optimization Suggestions</h1>\n';
    html += '<ul id="suggestions">\n';

    for (const suggestion of suggestions) {
        html += `<li style="background-color: #f0f0f0; padding: 10px;">
                    <div style="background-color: #ccc; padding: 5px; margin-bottom: 5px;">
                        Table: ${suggestion.tableName}
                    </div>
                    ${suggestion.suggestion}
                </li>\n`;
    }

    html += '</ul>\n';
    html += '</body>\n';
    html += '</html>';
    return html;
}
