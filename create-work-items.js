const {
    runCommand,
    getStateFromProgress,
    getTagsFromRow,
    getWorkItemType
} = require('./helpers');

// Constants
const ORGANIZATION = 'https://msazure.visualstudio.com';
const PROJECT = 'One';
const AREA_PATH = 'One\\LogAnalytics\\QueryService';
const ITERATION_PATH = 'One\\Bromine\\CY25Q3\\Monthly\\07 Jul (Jun 29 - Jul 26)';

async function checkAuth() {
    const { code } = await runCommand('az account show');
    return code === 0;
}

async function authenticate() {
    console.log('Not authenticated. Running az login...');
    await runCommand('az login');
}

async function findOrCreateEpic(title, parentId = null, dryRun = true) {
    if (dryRun) {
        // Generate unique IDs for dry run based on title
        let uniqueId;
        if (title.includes('/query') && !title.includes('/search') && !title.includes('Activity Log')) {
            uniqueId = 'DRY_RUN_QUERY_EPIC_ID';
        } else if (title.includes('/search') && !title.includes('Activity Log')) {
            uniqueId = 'DRY_RUN_SEARCH_EPIC_ID';
        } else {
            uniqueId = 'DRY_RUN_ACTIVITY_LOG_EPIC_ID';
        }
        return {
            id: uniqueId,
            message: `Would create/find Epic: ${title}${parentId ? ` (child of ${parentId})` : ''}`
        };
    }

    // First try to find existing Epic
    const queryCommand = [
        'az boards query',
        `--org ${ORGANIZATION}`,
        `--project "${PROJECT}"`,
        `--wiql "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Epic' AND [System.Title] = '${title}' AND [System.AreaPath] = '${AREA_PATH}'"`
    ].join(' ');

    const { code: queryCode, stdout: queryStdout } = await runCommand(queryCommand);
    
    if (queryCode === 0 && queryStdout.trim()) {
        try {
            const queryResult = JSON.parse(queryStdout);
            if (queryResult.workItems && queryResult.workItems.length > 0) {
                const epicId = queryResult.workItems[0].id;
                return {
                    id: epicId,
                    message: `Found existing Epic #${epicId}: ${title}`
                };
            }
        } catch (parseError) {
            console.log(`Query returned non-JSON output: ${queryStdout}`);
            // Continue to create new Epic
        }
    }

    // Create new Epic if not found
    const createCommand = [
        'az boards work-item create',
        `--org ${ORGANIZATION}`,
        `--project "${PROJECT}"`,
        `--type "Epic"`,
        `--title "${title}"`,
        '--fields',
        `System.AreaPath="${AREA_PATH}"`,
        `System.IterationPath="${ITERATION_PATH}"`,
        `System.Tags="draft->laqs"`
    ].join(' ');

    const { code: createCode, stdout: createStdout, stderr } = await runCommand(createCommand);
    if (createCode !== 0) {
        console.error('Error creating Epic:', stderr);
        return null;
    }

    if (!createStdout.trim()) {
        console.error('Error: Empty response from Azure CLI when creating Epic');
        return null;
    }

    let result;
    try {
        result = JSON.parse(createStdout);
    } catch (parseError) {
        console.error('Error parsing JSON response when creating Epic:', createStdout);
        return null;
    }
    
    const epicId = result.id;

    // If this Epic should have a parent, create the relationship
    if (parentId) {
        const relationCommand = [
            'az boards work-item relation add',
            `--org ${ORGANIZATION}`,
            `--id ${epicId}`,
            `--relation-type parent`,
            `--target-id ${parentId}`
        ].join(' ');

        await runCommand(relationCommand);
    }

    return {
        id: epicId,
        message: `Created Epic #${epicId}: ${title}${parentId ? ` (child of ${parentId})` : ''}`
    };
}

function determineParentEpic(row, searchEpicId, activityLogEpicId, queryEpicId) {
    // Check if item has any "+" in Activity Log column
    const hasActivityLog = row['Activity Log (/query)'] === '+' || 
                          (row['Activity Log (/query)'] && row['Activity Log (/query)'].includes('+'));
    
    // Check if item has any "+" in search columns
    const hasSearch = row['/search from UI'] === '+' || 
                     (row['/search from UI'] && row['/search from UI'].includes('+')) ||
                     row['DGrep shim'] === '+' || 
                     (row['DGrep shim'] && row['DGrep shim'].includes('+'));
    
    // Check if item has no "+" in any column (orphan)
    const isOrphan = !hasActivityLog && !hasSearch;
    
    if (isOrphan) {
        return queryEpicId; // Orphans become children of /query epic
    } else if (hasActivityLog) {
        return activityLogEpicId;
    } else if (hasSearch) {
        return searchEpicId;
    }
    
    return null;
}

function determineParentForLMComponent(parentFeature, generatedLMIds) {
    if (parentFeature === 'Generate LM - Search') {
        return generatedLMIds.search;
    }
    if (parentFeature === 'Generate LM - Activity Log') {
        return generatedLMIds.activityLog;
    }
    if (parentFeature === 'Generate LM') {
        // Items that should be children of both LM components - assign to both
        return { dual: true, search: generatedLMIds.search, activityLog: generatedLMIds.activityLog };
    }
    return null;
}

async function createWorkItem(row, searchEpicId, activityLogEpicId, queryEpicId, dryRun = true, workItems = [], rowNumber = null, schedulingInfo = null) {
    const featureName = row.Feature?.trim();
    if (!featureName) {
        return null;
    }
        
    const effort = row['Effort (S/M/L)']?.trim();
    if (!effort) {
        return null;
    }
        
    const workItemType = getWorkItemType(effort);
    // Change title prefix for non-epic items from [Draft->LAQS] to [D->L]
    const title = `[D->L] ${featureName}`;
    const state = getStateFromProgress(row.Progress);
    const hasHolidayImpact = schedulingInfo?.hasHolidayImpact || false;
    const tags = getTagsFromRow(row, hasHolidayImpact);
    const tagsString = tags.join(';');
    const parentEpicId = determineParentEpic(row, searchEpicId, activityLogEpicId, queryEpicId);

    // Add to workItems array for markdown report (dry run only)
    if (dryRun) {
        workItems.push({
            title: title,
            type: workItemType,
            state: state,
            tags: tags,
            areaPath: AREA_PATH,
            iterationPath: ITERATION_PATH,
            parentEpicId: parentEpicId,
            originalFeature: featureName,
            startDate: schedulingInfo?.startDate || null,
            targetDate: schedulingInfo?.targetDate || null,
            hasHolidayImpact: schedulingInfo?.hasHolidayImpact || false
        });
        
        const result = [
            `Would create ${workItemType}:`,
            `  Title: ${title}`,
            `  State: ${state}`,
            `  Area Path: ${AREA_PATH}`,
            `  Iteration Path: ${ITERATION_PATH}`,
            `  Tags: ${tagsString}`
        ];
        
        if (parentEpicId) {
            result.push(`  Parent: Epic #${parentEpicId}`);
        }
        
        return result.join('\n');
    }

    // Construct the Azure CLI command
    const fieldsArray = [
        `System.AreaPath="${AREA_PATH}"`,
        `System.IterationPath="${ITERATION_PATH}"`,
        `System.Tags="${tagsString}"`,
        `System.State="${state}"`
    ];
    
    if (rowNumber) {
        fieldsArray.push(`One_custom.CustomField1=${rowNumber.toString().padStart(3, '0')}`);
    }
    
    // Add scheduling dates if provided
    if (schedulingInfo) {
        if (schedulingInfo.startDate) {
            fieldsArray.push(`Microsoft.VSTS.Scheduling.StartDate="${schedulingInfo.startDate}"`);
        }
        if (schedulingInfo.targetDate) {
            fieldsArray.push(`Microsoft.VSTS.Scheduling.TargetDate="${schedulingInfo.targetDate}"`);
        }
    }
    
    const command = [
        'az boards work-item create',
        `--org ${ORGANIZATION}`,
        `--project "${PROJECT}"`,
        `--type "${workItemType}"`,
        `--title "${title}"`,
        '--fields',
        ...fieldsArray
    ].join(' ');
    
    const { code, stdout, stderr } = await runCommand(command);
    if (code !== 0) {
        console.error('Error creating work item:', stderr);
        return null;
    }

    if (!stdout.trim()) {
        console.error('Error: Empty response from Azure CLI');
        return null;
    }

    let result;
    try {
        result = JSON.parse(stdout);
    } catch (parseError) {
        console.error('Error parsing JSON response:', stdout);
        return null;
    }
    
    const workItemId = result.id;

    // Create parent relationship if needed
    if (parentEpicId && typeof parentEpicId === 'string' && !parentEpicId.startsWith('DRY_RUN_')) {
        const relationCommand = [
            'az boards work-item relation add',
            `--org ${ORGANIZATION}`,
            `--id ${workItemId}`,
            `--relation-type parent`,
            `--target-id ${parentEpicId}`
        ].join(' ');

        await runCommand(relationCommand);
    } else if (parentEpicId && typeof parentEpicId === 'number') {
        const relationCommand = [
            'az boards work-item relation add',
            `--org ${ORGANIZATION}`,
            `--id ${workItemId}`,
            `--relation-type parent`,
            `--target-id ${parentEpicId}`
        ].join(' ');

        await runCommand(relationCommand);
    }

    const parentInfo = parentEpicId ? ` (child of Epic #${parentEpicId})` : '';
    return `Created ${workItemType} #${workItemId}: ${title}${parentInfo}`;
}

module.exports = {
    createWorkItem,
    checkAuth,
    authenticate,
    findOrCreateEpic
};
