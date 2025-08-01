const fs = require('fs').promises;
const { createWorkItem, checkAuth, authenticate, findOrCreateEpic } = require('./create-work-items');
const { generateMarkdownReport } = require('./markdown-generator');

async function main() {
    try {
        // Parse command line arguments
        const outputIndex = process.argv.indexOf('--output');
        const outputFile = outputIndex !== -1 && process.argv[outputIndex + 1] 
            ? process.argv[outputIndex + 1] 
            : 'dry-run-report.md';

        // Check authentication
        if (!await checkAuth()) {
            await authenticate();
            if (!await checkAuth()) {
                console.error('Authentication failed. Please try again.');
                process.exit(1);
            }
        }

        // Check if --apply flag is present
        const dryRun = !process.argv.includes('--apply');

        if (dryRun) {
            console.log('DRY RUN MODE - No items will be created');
            console.log('Use --apply to create actual work items');
            console.log('-'.repeat(50));
        }

        // Create Epics first
        console.log('Creating/finding Epics...');
        
        // Create the root Epic for /search
        const searchEpicResult = await findOrCreateEpic('[Draft->LAQS] /search', null, dryRun);
        if (!searchEpicResult) {
            console.error('Failed to create/find search Epic');
            process.exit(1);
        }
        console.log(searchEpicResult.message);
        
        // Create the Activity Log Epic as child of search Epic
        const activityLogEpicResult = await findOrCreateEpic('[Draft->LAQS] Activity Log /query', searchEpicResult.id, dryRun);
        if (!activityLogEpicResult) {
            console.error('Failed to create/find Activity Log Epic');
            process.exit(1);
        }
        console.log(activityLogEpicResult.message);
        console.log('-'.repeat(50));

        // Read and parse the JSON data
        const rawData = await fs.readFile('table_data.json', 'utf8');
        const { queryPipelineData } = JSON.parse(rawData);
        
        // Collect work items for markdown report (dry run only)
        const workItems = [];
    
        // Process each row
        for (const row of queryPipelineData) {
            const result = await createWorkItem(row, searchEpicResult.id, activityLogEpicResult.id, dryRun, workItems);
            if (result) {
                console.log(result);
                console.log('-'.repeat(50));
            }
        }

        // Generate markdown report if in dry run mode
        if (dryRun && workItems.length > 0) {
            console.log(`\n📄 Generating markdown report...`);
            await generateMarkdownReport(workItems, outputFile);
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run the script
main();
