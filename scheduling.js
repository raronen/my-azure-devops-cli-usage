const { formatDate, calculateStartDate } = require('./date-helpers');

// Constants for scheduling
const MAX_PARALLEL_ITEMS = 8;
const MAX_LM_PARALLEL = 3; // Maximum LM items in parallel
const ACTIVITY_LOG_DEADLINE = new Date('2025-09-30'); // End of September
const SEARCH_DEADLINE = new Date('2025-11-30'); // End of November
const QUERY_DEADLINE = new Date('2025-12-31'); // End of December for query items

// Holiday period
const HOLIDAY_START = new Date('2025-09-22');
const HOLIDAY_END = new Date('2025-10-14');
const HOLIDAY_DAYS = 23; // ~22 working days (Sep 22 - Oct 14)

function getRandomDuration(workItemType) {
    let minWeeks, maxWeeks;
    if (workItemType === 'Feature') {
        minWeeks = 3;
        maxWeeks = 5;
    } else {
        minWeeks = 1;
        maxWeeks = 2;
    }
    
    const minDays = minWeeks * 7;
    const maxDays = maxWeeks * 7;
    return Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
}

function categorizeItems(workItems) {
    const activityLogItems = [];
    const searchItems = [];
    const queryItems = [];
    
    for (const item of workItems) {
        // Check if item has any "+" in Activity Log column
        const hasActivityLog = item.row['Activity Log (/query)'] === '+' || 
                              item.row['Activity Log (/query)'].includes('+');
        
        // Check if item has any "+" in search columns
        const hasSearch = item.row['/search from UI'] === '+' || 
                         item.row['/search from UI'].includes('+') ||
                         item.row['DGrep shim'] === '+' || 
                         item.row['DGrep shim'].includes('+');
        
        // Items with no "+" in any column go to query category
        const hasNoPlus = !hasActivityLog && !hasSearch;
        
        if (hasActivityLog) {
            activityLogItems.push(item);
        } else if (hasSearch) {
            searchItems.push(item);
        } else if (hasNoPlus) {
            queryItems.push(item);
        }
    }
    
    return { activityLogItems, searchItems, queryItems };
}

function getItemCategory(item) {
    // Check if item has any "+" in Activity Log column
    const hasActivityLog = item.row['Activity Log (/query)'] === '+' || 
                          item.row['Activity Log (/query)'].includes('+');
    
    // Check if item has any "+" in search columns
    const hasSearch = item.row['/search from UI'] === '+' || 
                     item.row['/search from UI'].includes('+') ||
                     item.row['DGrep shim'] === '+' || 
                     item.row['DGrep shim'].includes('+');
    
    // Items with no "+" in any column go to query category
    const hasNoPlus = !hasActivityLog && !hasSearch;
    
    if (hasActivityLog) {
        return 'activityLog';
    } else if (hasSearch) {
        return 'search';
    } else if (hasNoPlus) {
        return 'query';
    }
    
    return 'query'; // Default fallback
}

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

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function adjustForHoliday(startDate, duration) {
    const endDate = addDays(startDate, duration);
    
    // Check if item overlaps with holiday period
    if (startDate < HOLIDAY_END && endDate > HOLIDAY_START) {
        return {
            adjustedDuration: duration + HOLIDAY_DAYS,
            hasHolidayImpact: true
        };
    }
    
    return {
        adjustedDuration: duration,
        hasHolidayImpact: false
    };
}

function isDateInHoliday(date) {
    return date >= HOLIDAY_START && date <= HOLIDAY_END;
}

function getNextAvailableDate(date) {
    if (isDateInHoliday(date)) {
        return new Date(HOLIDAY_END.getTime() + 24 * 60 * 60 * 1000); // Day after holiday
    }
    return new Date(date);
}

function countActiveItemsOnDate(scheduledItems, checkDate) {
    // Count items that are active on the given date
    // An item is active if: startDate <= checkDate < targetDate
    return scheduledItems.filter(item => 
        item.startDate && item.targetDate &&
        item.startDate <= checkDate && item.targetDate > checkDate
    ).length;
}

function scheduleItemByState(item, state, deadline) {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    
    const duration = getRandomDuration(item.workItemType);
    
    if (state === 'Done') {
        // Done items: Target Date = last week, Start Date = Target Date - duration
        const targetDate = new Date(lastWeek);
        const startDate = new Date(targetDate);
        startDate.setDate(startDate.getDate() - duration);
        
        return {
            ...item,
            startDate: startDate,
            targetDate: targetDate,
            duration: duration,
            hasHolidayImpact: false
        };
    } else if (state === 'Active') {
        // Active items: Start Date before today, Target Date after today
        const startDate = new Date();
        startDate.setDate(today.getDate() - Math.floor(duration / 2)); // Start partway through
        
        const { adjustedDuration, hasHolidayImpact } = adjustForHoliday(startDate, Math.ceil(duration / 2));
        const targetDate = addDays(today, adjustedDuration);
        
        // Ensure we don't exceed deadline
        if (targetDate > deadline) {
            targetDate.setTime(deadline.getTime());
        }
        
        return {
            ...item,
            startDate: startDate,
            targetDate: targetDate,
            duration: adjustedDuration,
            hasHolidayImpact: hasHolidayImpact
        };
    } else {
        // New items: Use normal scheduling
        return {
            ...item,
            duration: duration,
            state: 'New',
            hasHolidayImpact: false
        };
    }
}

function countActiveLMItemsOnDate(scheduledItems, checkDate) {
    // Count LM items that are active on the given date
    return scheduledItems.filter(item => 
        item.isLM &&
        item.startDate && item.targetDate &&
        item.startDate <= checkDate && item.targetDate > checkDate
    ).length;
}

function scheduleAllItems(workItems, lmItems = []) {
    // Categorize items but schedule everything together to respect global constraint
    const { activityLogItems, searchItems, queryItems } = categorizeItems(workItems);
    
    // Identify which LM items belong to which category
    const lmActivityLogItems = lmItems.filter(lmItem => 
        lmItem.row?.ParentFeature === 'Generate LM - Activity Log' || 
        lmItem.row?.ParentFeature === 'Generate LM'
    );
    const lmSearchItems = lmItems.filter(lmItem => 
        lmItem.row?.ParentFeature === 'Generate LM - Search'
    );
    
    // Separate Generate LM parent features from regular items
    const generateLMFeatures = [];
    const regularItems = [];
    
    for (const item of [...activityLogItems, ...searchItems, ...queryItems]) {
        if (item.row?.Feature === 'Generate LM - Search' || item.row?.Feature === 'Generate LM - Activity Log') {
            generateLMFeatures.push(item);
        } else {
            regularItems.push(item);
        }
    }
    
    // Combine regular items with LM children for scheduling
    const allItems = [
        ...regularItems.map(item => ({ ...item, category: getItemCategory(item) })),
        ...lmActivityLogItems.map(item => ({ ...item, category: 'activityLog', isLM: true })),
        ...lmSearchItems.map(item => ({ ...item, category: 'search', isLM: true }))
    ];
    
    const scheduledItems = [];
    const globalScheduled = []; // Track ALL scheduled items for constraint checking
    
    // Process state-based items first
    const stateBasedItems = [];
    const newItems = [];
    
    for (const item of allItems) {
        const state = getStateFromProgress(item.row?.Progress);
        if (state === 'Done' || state === 'Active') {
            const scheduledItem = scheduleItemByState(item, state, ACTIVITY_LOG_DEADLINE);
            stateBasedItems.push(scheduledItem);
            globalScheduled.push(scheduledItem);
        } else {
            newItems.push({
                ...item,
                duration: getRandomDuration(item.workItemType),
                isLM: item.isLM || false
            });
        }
    }
    
    // Sort new items by priority (Activity Log MUST come first due to dependencies)
    newItems.sort((a, b) => {
        // Priority 1: Category - Activity Log has HIGHEST priority (Search depends on it)
        const categoryPriority = { activityLog: 0, search: 1, query: 2 };
        if (categoryPriority[a.category] !== categoryPriority[b.category]) {
            return categoryPriority[a.category] - categoryPriority[b.category];
        }
        
        // Priority 2: LM items first within same category
        if (a.isLM !== b.isLM) {
            return a.isLM ? -1 : 1; // LM items first (fix: -1 for LM to come first)
        }
        
        // Priority 3: Shorter duration first for better scheduling
        return a.duration - b.duration;
    });
    
    // Schedule new items one by one with global constraint checking
    let currentDate = getNextAvailableDate(new Date());
    
    for (const item of newItems) {
        // Find the earliest date we can start this item
        let proposedStartDate = new Date(currentDate);
        
        while (true) {
            proposedStartDate = getNextAvailableDate(proposedStartDate);
            
            // Check GLOBAL constraint - count ALL active items on this date
            const activeCount = countActiveItemsOnDate(globalScheduled, proposedStartDate);
            
            if (activeCount < MAX_PARALLEL_ITEMS) {
                // If this is an LM item, also check LM constraint
                if (item.isLM) {
                    const activeLMCount = countActiveLMItemsOnDate(globalScheduled, proposedStartDate);
                    if (activeLMCount < MAX_LM_PARALLEL) {
                        // Valid for both constraints
                        break;
                    }
                } else {
                    // Non-LM item, just needs to fit in global constraint
                    break;
                }
            }
            
            // Move to next day
            proposedStartDate = addDays(proposedStartDate, 1);
        }
        
        // Schedule the item
        const { adjustedDuration, hasHolidayImpact } = adjustForHoliday(proposedStartDate, item.duration);
        const targetDate = addDays(proposedStartDate, adjustedDuration);
        
        const scheduledItem = {
            ...item,
            startDate: new Date(proposedStartDate),
            targetDate: targetDate,
            duration: adjustedDuration,
            hasHolidayImpact: hasHolidayImpact,
            isLM: item.isLM || false
        };
        
        // Add to GLOBAL tracking
        globalScheduled.push(scheduledItem);
        
        // Only advance currentDate slightly to allow for some parallel starts
        // but not all on the same day
        const currentActiveCount = countActiveItemsOnDate(globalScheduled, proposedStartDate);
        if (currentActiveCount >= 4) { // If we're getting busy, space out more
            currentDate = addDays(proposedStartDate, 1);
        }
    }
    
    // Now schedule the Generate LM parent features based on their children
    const generateLMActivityLog = generateLMFeatures.find(item => item.row?.Feature === 'Generate LM - Activity Log');
    const generateLMSearch = generateLMFeatures.find(item => item.row?.Feature === 'Generate LM - Search');
    
    if (generateLMActivityLog) {
        const activityLogLMChildren = globalScheduled.filter(item => item.isLM && item.category === 'activityLog');
        const parentDates = calculateParentDates(activityLogLMChildren);
        
        if (parentDates.startDate && parentDates.targetDate) {
            const scheduledParent = {
                ...generateLMActivityLog,
                category: 'activityLog',
                startDate: parentDates.startDate,
                targetDate: parentDates.targetDate,
                duration: Math.ceil((parentDates.targetDate - parentDates.startDate) / (1000 * 60 * 60 * 24)),
                hasHolidayImpact: activityLogLMChildren.some(child => child.hasHolidayImpact)
            };
            globalScheduled.push(scheduledParent);
        }
    }
    
    if (generateLMSearch) {
        const searchLMChildren = globalScheduled.filter(item => item.isLM && item.category === 'search');
        const parentDates = calculateParentDates(searchLMChildren);
        
        if (parentDates.startDate && parentDates.targetDate) {
            const scheduledParent = {
                ...generateLMSearch,
                category: 'search',
                startDate: parentDates.startDate,
                targetDate: parentDates.targetDate,
                duration: Math.ceil((parentDates.targetDate - parentDates.startDate) / (1000 * 60 * 60 * 24)),
                hasHolidayImpact: searchLMChildren.some(child => child.hasHolidayImpact)
            };
            globalScheduled.push(scheduledParent);
        }
    }
    
    // Validate all items have dates
    const missingDates = globalScheduled.filter(item => !item.startDate || !item.targetDate);
    if (missingDates.length > 0) {
        console.error('❌ CRITICAL ERROR: Items missing scheduling dates:');
        missingDates.forEach(item => {
            console.error(`  - ${item.title || item.row?.Feature}: startDate=${item.startDate}, targetDate=${item.targetDate}`);
        });
        throw new Error(`${missingDates.length} items are missing scheduling dates!`);
    }
    
    // Separate scheduled items back into categories for return
    const scheduledActivityLog = globalScheduled.filter(item => item.category === 'activityLog');
    const scheduledSearch = globalScheduled.filter(item => item.category === 'search');
    const scheduledQuery = globalScheduled.filter(item => item.category === 'query');
    
    return {
        activityLog: scheduledActivityLog,
        search: scheduledSearch,
        query: scheduledQuery,
        all: globalScheduled
    };
}

function calculateParentDates(childItems) {
    if (childItems.length === 0) {
        return { startDate: null, targetDate: null };
    }
    
    const startDates = childItems.map(item => item.startDate).filter(d => d);
    const targetDates = childItems.map(item => item.targetDate).filter(d => d);
    
    const minStartDate = startDates.length > 0 ? new Date(Math.min(...startDates)) : null;
    const maxTargetDate = targetDates.length > 0 ? new Date(Math.max(...targetDates)) : null;
    
    return {
        startDate: minStartDate,
        targetDate: maxTargetDate
    };
}

function calculateEpicDates(childItems) {
    if (childItems.length === 0) {
        return { startDate: null, targetDate: null };
    }
    
    const startDates = childItems.map(item => item.startDate).filter(d => d);
    const targetDates = childItems.map(item => item.targetDate).filter(d => d);
    
    const minStartDate = startDates.length > 0 ? new Date(Math.min(...startDates)) : null;
    const maxTargetDate = targetDates.length > 0 ? new Date(Math.max(...targetDates)) : null;
    
    return {
        startDate: minStartDate,
        targetDate: maxTargetDate
    };
}

module.exports = {
    scheduleAllItems,
    calculateEpicDates,
    categorizeItems,
    MAX_PARALLEL_ITEMS,
    ACTIVITY_LOG_DEADLINE,
    SEARCH_DEADLINE
};
