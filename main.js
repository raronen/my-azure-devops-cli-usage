const fs = require('fs').promises;
const { createWorkItem, checkAuth, authenticate, findOrCreateEpic } = require('./create-work-items');
const { generateMarkdownReport } = require('./markdown-generator');
const { getStateFromProgress, getWorkItemType } = require('./helpers');
const { scheduleAllItems, calculateEpicDates } = require('./scheduling');
const { formatDate } = require('./date-helpers');

// Helper function to extract work item ID from result string
function extractWorkItemId(resultString) {
    const match = resultString.match(/#(\d+):/);
    return match ? match[1] : null;
}

// Function to create LM Component work items with specific parent relationships
async function createLMComponentWorkItem(row, generatedLMIds, dryRun, workItems, forceParent = null, rowNumber = null) {
    const featureName = row.Feature?.trim();
    if (!featureName) {
        return null;
    }
        
    const effort = row['Effort (S/M/L)']?.trim();
    if (!effort) {
        return null;
    }
    
    const workItemType = getWorkItemType(effort);
    const title = `[D->L] [LM] ${featureName}`;
    const state = getStateFromProgress(row.Progress);
    const tags = ['draft->laqs'];
    const tagsString = tags.join(';');
    
    // Determine parent based on ParentFeature
    let parentId = null;
    let parentInfo = '';
    
    if (forceParent === 'search') {
        parentId = generatedLMIds.search;
        parentInfo = ` (child of Generate LM - Search #${parentId})`;
    } else if (forceParent === 'activityLog') {
        parentId = generatedLMIds.activityLog;
        parentInfo = ` (child of Generate LM - Activity Log #${parentId})`;
    } else if (row.ParentFeature === 'Generate LM - Search') {
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

    // Create actual work item
    const { createWorkItem: createActualWorkItem } = require('./create-work-items');
    
    // Create a mock row object for the createWorkItem function
    const mockRow = {
        Feature: featureName,
        'Effort (S/M/L)': effort,
        Progress: row.Progress,
        '/search from UI': '',
        'DGrep shim': '',
        'Activity Log (/query)': ''
    };
    
    // Use the existing createWorkItem function but with no Epic parent (since these are Feature children)
    const command = [
        'az boards work-item create',
        `--org https://msazure.visualstudio.com`,
        `--project "One"`,
        `--type "${workItemType}"`,
        `--title "${title}"`,
        '--fields',
        `System.AreaPath="One\\LogAnalytics\\QueryService"`,
        `System.IterationPath="One\\Bromine\\CY25Q3\\Monthly\\07 Jul (Jun 29 - Jul 26)"`,
        `System.Tags="${tagsString}"`,
        `System.State="${state}"`,
        rowNumber ? `One_custom.CustomField1=${rowNumber.toString().padStart(3, '0')}` : ''
    ].filter(Boolean).join(' ');
    
    const { runCommand } = require('./helpers');
    const { code, stdout, stderr } = await runCommand(command);
    if (code !== 0) {
        console.error('Error creating LM component work item:', stderr);
        return null;
    }

    if (!stdout.trim()) {
        console.error('Error: Empty response from Azure CLI when creating LM component');
        return null;
    }

    let result;
    try {
        result = JSON.parse(stdout);
    } catch (parseError) {
        console.error('Error parsing JSON response when creating LM component:', stdout);
        return null;
    }
    
    const workItemId = result.id;

    // Create parent relationship with the Generate LM Feature
    if (parentId && !parentId.toString().startsWith('DRY_RUN_')) {
        const relationCommand = [
            'az boards work-item relation add',
            `--org https://msazure.visualstudio.com`,
            `--id ${workItemId}`,
            `--relation-type parent`,
            `--target-id ${parentId}`
        ].join(' ');

        await runCommand(relationCommand);
    }

    return `Created ${workItemType} #${workItemId}: ${title}${parentInfo}`;
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
        
        // Create the root Epic for /query
        const queryEpicResult = await findOrCreateEpic('[Draft->LAQS] /query', null, dryRun);
        if (!queryEpicResult) {
            console.error('Failed to create/find query Epic');
            process.exit(1);
        }
        console.log(queryEpicResult.message);
        
        // Create the /search Epic as child of /query Epic
        const searchEpicResult = await findOrCreateEpic('[Draft->LAQS] /search', queryEpicResult.id, dryRun);
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
        
        // Prepare work items for scheduling (regular items)
        const workItemsForScheduling = [];
        const lmItemsForScheduling = [];
        
        for (let i = 0; i < queryPipelineData.length; i++) {
            const row = queryPipelineData[i];
            
            if (!row['Effort (S/M/L)']?.trim()) {
                continue;
            }
            
            const workItemType = getWorkItemType(row['Effort (S/M/L)'].trim());
            const itemData = {
                id: `row_${i}`, // Temporary ID for scheduling
                title: `[D->L] ${row.Feature}`,
                workItemType: workItemType,
                row: row,
                rowIndex: i
            };
            
            if (row.ParentFeature) {
                // LM items
                lmItemsForScheduling.push(itemData);
            } else {
                // Regular items
                workItemsForScheduling.push(itemData);
            }
        }
        
        // Apply scheduling logic to get dates
        console.log('Calculating schedules with parallel work constraints and LM items...');
        const scheduledItems = scheduleAllItems(workItemsForScheduling, lmItemsForScheduling);
        console.log(`Scheduled ${scheduledItems.all.length} items with dates`);
        console.log('-'.repeat(50));
        
        // Create a mapping from row index to scheduling info
        const schedulingMap = {};
        for (const scheduledItem of scheduledItems.all) {
            const rowIndex = scheduledItem.rowIndex;
            schedulingMap[rowIndex] = {
                startDate: formatDate(scheduledItem.startDate),
                targetDate: formatDate(scheduledItem.targetDate),
                hasHolidayImpact: scheduledItem.hasHolidayImpact || false
            };
        }
        
        // Track Generate LM work item IDs for parent relationships
        const generatedLMIds = {
            search: null,
            activityLog: null
        };
    
        // Process each row (skip items with ParentFeature as they'll be processed separately)
        for (let i = 0; i < queryPipelineData.length; i++) {
            const row = queryPipelineData[i];
            const rowNumber = i + 1; // Start from row 1 instead of 0
            
            // Skip items that have ParentFeature - they'll be processed in the LM component section
            if (row.ParentFeature) {
                continue;
            }
            
            // Get scheduling info for this row
            const schedulingInfo = schedulingMap[i] || null;
            
            const result = await createWorkItem(row, searchEpicResult.id, activityLogEpicResult.id, queryEpicResult.id, dryRun, workItems, rowNumber, schedulingInfo);
            if (result) {
                console.log(result);
                if (schedulingInfo) {
                    console.log(`  Start Date: ${schedulingInfo.startDate}`);
                    console.log(`  Target Date: ${schedulingInfo.targetDate}`);
                }
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
        for (let i = 0; i < queryPipelineData.length; i++) {
            const row = queryPipelineData[i];
            const rowNumber = i + 1; // Start from row 1 instead of 0
            
            if (row.ParentFeature) {
                if (row.ParentFeature === 'Generate LM') {
                    // Create work item as child of Generate LM - Activity Log (higher priority)
                    const activityLogResult = await createLMComponentWorkItem(row, generatedLMIds, dryRun, workItems, 'activityLog', rowNumber);
                    if (activityLogResult) {
                        console.log(activityLogResult);
                        console.log('-'.repeat(50));
                    }
                } else {
                    // Single parent case
                    const result = await createLMComponentWorkItem(row, generatedLMIds, dryRun, workItems, null, rowNumber);
                    if (result) {
                        console.log(result);
                        console.log('-'.repeat(50));
                    }
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
