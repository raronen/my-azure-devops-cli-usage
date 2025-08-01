const fs = require('fs').promises;
const { createWorkItem, checkAuth, authenticate } = require('./create-work-items');

async function main() {
    try {
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

        // Read and parse the JSON data
        const rawData = await fs.readFile('table_data.json', 'utf8');
        const { queryPipelineData } = JSON.parse(rawData);
    
        // Process each row
        for (const row of queryPipelineData) {
            const result = await createWorkItem(row, dryRun);
            if (result) {
                console.log(result);
                console.log('-'.repeat(50));
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run the script
main();
