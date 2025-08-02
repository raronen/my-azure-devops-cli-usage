const fs = require('fs').promises;
const { formatDate, parseDate } = require('./date-helpers');

// Function to generate markdown report
async function generateDateUpdateReport(updatedItems, skippedItems, outputFile) {
    const report = [
        '# Work Item Target Date Updates Report',
        '',
        `Generated on: ${new Date().toLocaleString()}`,
        '',
        '## Summary',
        `- Items to update: ${updatedItems.length}`,
        `- Items skipped (missing finish date): ${skippedItems.length}`,
        ''
    ];
    
    if (updatedItems.length > 0) {
        report.push('## Items Updated');
        report.push('');
        updatedItems.forEach(item => {
            report.push(`### #${item.id} ${item.type}: "${item.title}"`);
            report.push(`- **Finish Date**: ${item.finishDate ? formatDate(parseDate(item.finishDate)) : 'Not set'}`);
            report.push(`- **Updated Target Date**: ${formatDate(item.updatedTargetDate)}`);
            report.push(`- **Operation**: Copied finish date to target date`);
            if (item.targetDate) {
                report.push(`- **Previous Target Date**: ${formatDate(parseDate(item.targetDate))}`);
            }
            report.push('');
        });
    }
    
    if (skippedItems.length > 0) {
        report.push('## Items Skipped (Missing Finish Date)');
        report.push('');
        skippedItems.forEach(item => {
            if (item.error) {
                report.push(`- **#${item.id}** ${item.type}: "${item.title}" - Error: ${item.error}`);
            } else {
                report.push(`- **#${item.id}** ${item.type}: "${item.title}"`);
            }
        });
        report.push('');
    }
    
    await fs.writeFile(outputFile, report.join('\n'), 'utf8');
    console.log(`📄 Report generated: ${outputFile}`);
}

module.exports = {
    generateDateUpdateReport
};
