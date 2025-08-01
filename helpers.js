const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

// Command execution helpers
async function runCommand(command) {
    try {
        const { stdout, stderr } = await execPromise(command);
        return { code: 0, stdout, stderr };
    } catch (error) {
        return { code: 1, stdout: '', stderr: error.message };
    }
}

// Authentication helpers
async function checkAuth() {
    const { code } = await runCommand('az account show');
    return code === 0;
}

async function authenticate() {
    console.log('Not authenticated. Running az login...');
    await runCommand('az login');
}

// Work item helpers
function getStateFromProgress(progress) {
    if (!progress) {
        return 'New';
    }
    
    progress = progress.toLowerCase();
    if (progress === 'done' || progress === 'complete' || progress === 'closed') {
        return 'Done';
    }
    if (['in progress', 'not done', 'partial'].some(x => progress.includes(x))) {
        return 'Active';
    }
    return 'New';
}

function getTagsFromRow(row) {
    const tags = ['draft->laqs'];
    
    if (row['/search from UI']?.trim() === '+') {
        tags.push('UI /search');
    }
    if (row['DGrep shim']?.trim() === '+') {
        tags.push('shim');
    }
    if (row['Activity Log (/query)']?.trim() === '+') {
        tags.push('AL');
    }
        
    return tags;
}

function getWorkItemType(effort) {
    return effort.toUpperCase() === 'S' ? 'Product Backlog Item' : 'Feature';
}

module.exports = {
    runCommand,
    checkAuth,
    authenticate,
    getStateFromProgress,
    getTagsFromRow,
    getWorkItemType
};
