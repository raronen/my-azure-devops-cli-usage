const { runCommand } = require('./helpers');

// Constants
const ORGANIZATION = 'https://msazure.visualstudio.com';
const PROJECT = 'One';
const AREA_PATH = 'One\\LogAnalytics\\QueryService';

// Function to query work items with "draft->laqs" tag
async function queryWorkItems() {
    const wiql = `SELECT [System.Id], [System.WorkItemType], [System.Title], [Microsoft.VSTS.Scheduling.FinishDate], [Microsoft.VSTS.Scheduling.TargetDate] FROM WorkItems WHERE [System.Tags] CONTAINS 'draft->laqs' AND [System.AreaPath] = '${AREA_PATH}'`;
    
    const command = [
        'az boards query',
        `--org ${ORGANIZATION}`,
        `--project "${PROJECT}"`,
        `--wiql "${wiql}"`
    ].join(' ');
    
    const { code, stdout, stderr } = await runCommand(command);
    
    if (code !== 0) {
        throw new Error(`Failed to query work items: ${stderr}`);
    }
    
    if (!stdout.trim()) {
        return [];
    }
    
    try {
        const result = JSON.parse(stdout);
        
        // Handle both array response and object with workItems property
        let workItems;
        if (Array.isArray(result)) {
            workItems = result;
        } else if (result.workItems) {
            workItems = result.workItems;
        } else {
            workItems = [];
        }
        
        return workItems;
    } catch (parseError) {
        throw new Error(`Failed to parse query result: ${stdout}`);
    }
}

// Function to get detailed work item information
async function getWorkItemDetails(workItemId) {
    const command = [
        'az boards work-item show',
        `--org ${ORGANIZATION}`,
        `--id ${workItemId}`
    ].join(' ');
    
    const { code, stdout, stderr } = await runCommand(command);
    if (code !== 0) {
        throw new Error(`Failed to get work item details for #${workItemId}: ${stderr}`);
    }
    
    if (!stdout.trim()) {
        throw new Error(`Empty response for work item #${workItemId}`);
    }
    
    try {
        const workItem = JSON.parse(stdout);
        return {
            id: workItem.id,
            type: workItem.fields['System.WorkItemType'],
            title: workItem.fields['System.Title'],
            finishDate: workItem.fields['Microsoft.VSTS.Scheduling.FinishDate'],
            startDate: workItem.fields['Microsoft.VSTS.Scheduling.StartDate'],
            targetDate: workItem.fields['Microsoft.VSTS.Scheduling.TargetDate']
        };
    } catch (parseError) {
        throw new Error(`Failed to parse work item details for #${workItemId}: ${stdout}`);
    }
}

// Function to update work item start date
async function updateWorkItemStartDate(workItemId, startDate, dryRun = true) {
    const { formatDate } = require('./date-helpers');
    
    if (dryRun) {
        return `Would update work item #${workItemId} start date to ${formatDate(startDate)}`;
    }
    
    const command = [
        'az boards work-item update',
        `--org ${ORGANIZATION}`,
        `--id ${workItemId}`,
        '--fields',
        `Microsoft.VSTS.Scheduling.StartDate="${formatDate(startDate)}"`
    ].join(' ');
    
    const { code, stdout, stderr } = await runCommand(command);
    if (code !== 0) {
        throw new Error(`Failed to update work item #${workItemId}: ${stderr}`);
    }
    
    return `Updated work item #${workItemId} start date to ${formatDate(startDate)}`;
}

// Function to update work item target date
async function updateWorkItemTargetDate(workItemId, targetDate, dryRun = true) {
    const { formatDate } = require('./date-helpers');
    
    if (dryRun) {
        return `Would update work item #${workItemId} target date to ${formatDate(targetDate)}`;
    }
    
    const command = [
        'az boards work-item update',
        `--org ${ORGANIZATION}`,
        `--id ${workItemId}`,
        '--fields',
        `Microsoft.VSTS.Scheduling.TargetDate="${formatDate(targetDate)}"`
    ].join(' ');
    
    const { code, stdout, stderr } = await runCommand(command);
    if (code !== 0) {
        throw new Error(`Failed to update work item #${workItemId}: ${stderr}`);
    }
    
    return `Updated work item #${workItemId} target date to ${formatDate(targetDate)}`;
}

// Function to update multiple work item fields
async function updateWorkItemFields(workItemId, fields, dryRun = false) {
    if (dryRun) {
        const fieldUpdates = Object.entries(fields).map(([key, value]) => `${key}="${value}"`).join(', ');
        return `Would update work item #${workItemId} fields: ${fieldUpdates}`;
    }
    
    const fieldsArgs = Object.entries(fields).map(([key, value]) => `${key}="${value}"`);
    
    const command = [
        'az boards work-item update',
        `--org ${ORGANIZATION}`,
        `--id ${workItemId}`,
        '--fields',
        ...fieldsArgs
    ].join(' ');
    
    const { code, stdout, stderr } = await runCommand(command);
    if (code !== 0) {
        throw new Error(`Failed to update work item #${workItemId}: ${stderr}`);
    }
    
    return `Updated work item #${workItemId} fields successfully`;
}

module.exports = {
    queryWorkItems,
    getWorkItemDetails,
    updateWorkItemStartDate,
    updateWorkItemTargetDate,
    updateWorkItemFields
};
