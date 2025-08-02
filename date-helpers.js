// Helper function to generate random number between min and max (inclusive)
function getRandomDays(minWeeks, maxWeeks) {
    const minDays = minWeeks * 7;
    const maxDays = maxWeeks * 7;
    return Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
}

// Helper function to format date for Azure DevOps
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Helper function to parse Azure DevOps date
function parseDate(dateString) {
    if (!dateString) return null;
    return new Date(dateString);
}

// Function to calculate start date based on work item type and finish date
function calculateStartDate(workItemType, finishDate) {
    if (!finishDate) return null;
    
    let randomDays;
    if (workItemType === 'Feature') {
        randomDays = getRandomDays(3, 5); // 3-5 weeks for Features
    } else {
        randomDays = getRandomDays(1, 2); // 1-2 weeks for PBIs
    }
    
    const startDate = new Date(finishDate);
    startDate.setDate(startDate.getDate() - randomDays);
    
    return {
        date: startDate,
        duration: `${Math.ceil(randomDays / 7)} weeks (${randomDays} days)`
    };
}

module.exports = {
    getRandomDays,
    formatDate,
    parseDate,
    calculateStartDate
};
