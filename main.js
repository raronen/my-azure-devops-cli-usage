const fs = require('fs').promises;
const { createWorkItem, checkAuth, authenticate, findOrCreateEpic } = require('./create-work-items');
const { generateMarkdownReport } = require('./markdown-generator');
const { getStateFromProgress, getWorkItemType } = require('./helpers');

// Helper function to extract work item ID from result string
function extractWorkItemId(resultString) {
    const match = resultString.match(/#(\d+):/);
    return match ? match[1] : null;
}

// Function to create LM Component work items with specific parent relationships
async function createLMComponentWorkItem(row, generatedLMIds, dryRun, workItems) {
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
    const tags = ['draft->laqs'];
    const tagsString = tags.join(';');
    
    // Determine parent based on ParentFeature
    let parentId = null;
    let parentInfo = '';
    
    if (row.ParentFeature === 'Generate LM - Search') {
        parentId = generatedLMIds.search;
        parentInfo = ` (child of Generate LM - Search #${parentId})`;
    } else if (row.ParentFeature === 'Generate LM - Activity Log') {
        parentId = generatedLMIds.activityLog;
        parentInfo = ` (child of Generate LM - Activity Log #${parentId})`;
    } else if (row.ParentFeature === 'Generate LM') {
        // Items that are children of both - for now, assign to Search (we could create duplicates if needed)
        parentId = generatedLMIds.search;
        parentInfo = ` (child of Generate LM - Search #${parentId})`;
    }

    // Add to workItems array for markdown report (dry run only)
    if (dryRun) {
        workItems.push({
            title: title,
            type: workItemType,
            state: state,
            tags: tags,
            areaPath: 'One\\LogAnalytics\\QueryService',
            iterationPath: 'One\\Bromine\\CY25Q3\\Monthly\\07 Jul (Jun 29 - Jul 26)',
            parentEpicId: null, // LM components are children of Features, not Epics
            parentFeatureId: parentId,
            originalFeature: featureName
        });
        
        const result = [
            `Would create ${workItemType}:`,
            `  Title: ${title}`,
            `  State: ${state}`,
            `  Area Path: One\\LogAnalytics\\QueryService`,
            `  Iteration Path: One\\Bromine\\CY25Q3\\Monthly\\07 Jul (Jun 29 - Jul 26)`,
            `  Tags: ${tagsString}`
        ];
        
        if (parentId) {
            result.push(`  Parent: Feature #${parentId}`);
        }
        
        return result.join('\n');
    }

    // Create actual work item (non-dry run logic would go here)
    // For now, just return the dry run format since we're in development
    return `Created ${workItemType}: ${title}${parentInfo}`;
}

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
        
        // Track Generate LM work item IDs for parent relationships
        const generatedLMIds = {
            search: null,
            activityLog: null
        };
    
        // Process each row
        for (const row of queryPipelineData) {
            const result = await createWorkItem(row, searchEpicResult.id, activityLogEpicResult.id, dryRun, workItems);
            if (result) {
                console.log(result);
                console.log('-'.repeat(50));
                
                // Track Generate LM work item IDs for later use
                if (row.Feature === 'Generate LM - Search') {
                    generatedLMIds.search = dryRun ? 'DRY_RUN_GENERATE_LM_SEARCH_ID' : extractWorkItemId(result);
                } else if (row.Feature === 'Generate LM - Activity Log') {
                    generatedLMIds.activityLog = dryRun ? 'DRY_RUN_GENERATE_LM_ACTIVITY_LOG_ID' : extractWorkItemId(result);
                }
            }
        }
        
        // Now process Logical Model Components that have ParentFeature
        for (const row of queryPipelineData) {
            if (row.ParentFeature) {
                const result = await createLMComponentWorkItem(row, generatedLMIds, dryRun, workItems);
                if (result) {
                    console.log(result);
                    console.log('-'.repeat(50));
                }
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
