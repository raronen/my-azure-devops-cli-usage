const fs = require('fs').promises;
const {
    runCommand,
    checkAuth,
    authenticate,
    getStateFromProgress,
    getTagsFromRow,
    getWorkItemType
} = require('./helpers');

// Constants
const ORGANIZATION = 'https://msazure.visualstudio.com';
const PROJECT = 'One';
const AREA_PATH = 'One\\LogAnalytics\\QueryService';
const ITERATION_PATH = 'One\\Bromine\\CY25Q3\\Monthly\\07 Jul (Jun 29 - Jul 26)';

async function createWorkItem(row, dryRun = true) {
    const featureName = row.Feature?.trim();
    if (!featureName) {
        return null;
    }
        
    const effort = row['Effort (S/M/L)']?.trim();
    if (!effort) {
        return null;
    }
        
    const workItemType = getWorkItemType(effort);
    const title = `[Draft->LAQS] ${featureName}`;
    const state = getStateFromProgress(row.Progress);
    const tags = getTagsFromRow(row).join(';');

    if (dryRun) {
        return [
            `Would create ${workItemType}:`,
            `  Title: ${title}`,
            `  State: ${state}`,
            `  Area Path: ${AREA_PATH}`,
            `  Iteration Path: ${ITERATION_PATH}`,
            `  Tags: ${tags}`
        ].join('\n');
    }

    // Construct the Azure CLI command
    const command = [
        'az boards work-item create',
        `--org ${ORGANIZATION}`,
        `--project "${PROJECT}"`,
        `--type "${workItemType}"`,
        `--title "${title}"`,
        '--fields',
        `System.AreaPath="${AREA_PATH}"`,
        `System.IterationPath="${ITERATION_PATH}"`,
        `System.Tags="${tags}"`,
        `System.State="${state}"`
    ].join(' ');
    
    const { code, stdout, stderr } = await runCommand(command);
    if (code !== 0) {
        console.error('Error creating work item:', stderr);
        return null;
    }
        
    const result = JSON.parse(stdout);
    return `Created ${workItemType} #${result.id}: ${title}`;
}

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
