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
        const uniqueId = title.includes('/search') && !title.includes('Activity Log') 
            ? 'DRY_RUN_SEARCH_EPIC_ID' 
            : 'DRY_RUN_ACTIVITY_LOG_EPIC_ID';
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
    
    if (queryCode === 0) {
        const queryResult = JSON.parse(queryStdout);
        if (queryResult.workItems && queryResult.workItems.length > 0) {
            const epicId = queryResult.workItems[0].id;
            return {
                id: epicId,
                message: `Found existing Epic #${epicId}: ${title}`
            };
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

    const result = JSON.parse(createStdout);
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

function determineParentEpic(tags, searchEpicId, activityLogEpicId) {
    // If item has "AL" tag, it should be child of Activity Log Epic (higher priority)
    if (tags.includes('AL')) {
        return activityLogEpicId;
    }
    // If item has "UI /search" tag, it should be child of /search Epic
    if (tags.includes('UI /search')) {
        return searchEpicId;
    }
    return null;
}

async function createWorkItem(row, searchEpicId, activityLogEpicId, dryRun = true, workItems = []) {
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
    const tags = getTagsFromRow(row);
    const tagsString = tags.join(';');
    const parentEpicId = determineParentEpic(tags, searchEpicId, activityLogEpicId);

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
            originalFeature: featureName
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
    const command = [
        'az boards work-item create',
        `--org ${ORGANIZATION}`,
        `--project "${PROJECT}"`,
        `--type "${workItemType}"`,
        `--title "${title}"`,
        '--fields',
        `System.AreaPath="${AREA_PATH}"`,
        `System.IterationPath="${ITERATION_PATH}"`,
        `System.Tags="${tagsString}"`,
        `System.State="${state}"`
    ].join(' ');
    
    const { code, stdout, stderr } = await runCommand(command);
    if (code !== 0) {
        console.error('Error creating work item:', stderr);
        return null;
    }
        
    const result = JSON.parse(stdout);
    const workItemId = result.id;

    // Create parent relationship if needed
    if (parentEpicId && !parentEpicId.startsWith('DRY_RUN_')) {
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
