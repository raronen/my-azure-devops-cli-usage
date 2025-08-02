const { formatDate, calculateStartDate } = require('./date-helpers');

// Constants for scheduling
const MAX_PARALLEL_ITEMS = 8;
const ACTIVITY_LOG_DEADLINE = new Date('2025-09-30'); // End of September
const SEARCH_DEADLINE = new Date('2025-11-30'); // End of November

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
    const orphanItems = [];
    
    for (const item of workItems) {
        // Check if item has any "+" in Activity Log column
        const hasActivityLog = item.row['Activity Log (/query)'] === '+' || 
                              item.row['Activity Log (/query)'].includes('+');
        
        // Check if item has any "+" in search columns
        const hasSearch = item.row['/search from UI'] === '+' || 
                         item.row['/search from UI'].includes('+') ||
                         item.row['DGrep shim'] === '+' || 
                         item.row['DGrep shim'].includes('+');
        
        // Check if item has no "+" in any column (orphan)
        const isOrphan = !hasActivityLog && !hasSearch;
        
        if (isOrphan) {
            orphanItems.push(item);
        } else if (hasActivityLog) {
            activityLogItems.push(item);
        } else if (hasSearch) {
            searchItems.push(item);
        }
    }
    
    return { activityLogItems, searchItems, orphanItems };
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

function scheduleItemsWithConstraints(allItems, lmItems = [], deadline, startDate = new Date()) {
    const scheduledItems = [];
    
    // Process state-based items first
    const stateBasedItems = [];
    const newItems = [];
    
    for (const item of allItems) {
        const state = getStateFromProgress(item.row?.Progress);
        if (state === 'Done' || state === 'Active') {
            stateBasedItems.push(scheduleItemByState(item, state, deadline));
        } else {
            newItems.push({
                ...item,
                duration: getRandomDuration(item.workItemType),
                isLM: lmItems.includes(item)
            });
        }
    }
    
    // Add state-based items
    scheduledItems.push(...stateBasedItems);
    
    // Separate LM and non-LM items
    const lmNewItems = newItems.filter(item => item.isLM);
    const nonLMNewItems = newItems.filter(item => !item.isLM);
    
    // Sort by duration (shorter first)
    lmNewItems.sort((a, b) => a.duration - b.duration);
    nonLMNewItems.sort((a, b) => a.duration - b.duration);
    
    // Schedule new items one by one, ensuring constraints
    const allNewItems = [...lmNewItems, ...nonLMNewItems];
    let currentDate = getNextAvailableDate(new Date(startDate));
    
    for (const item of allNewItems) {
        // Find the earliest date we can start this item
        let proposedStartDate = new Date(currentDate);
        
        // Keep moving forward until we find a date that doesn't violate constraints
        while (true) {
            proposedStartDate = getNextAvailableDate(proposedStartDate);
            
            // Check if starting on this date would violate the 8-item constraint
            const activeCount = countActiveItemsOnDate(scheduledItems, proposedStartDate);
            
            if (activeCount < MAX_PARALLEL_ITEMS) {
                // Check LM constraint if this is a non-LM item
                if (!item.isLM) {
                    const activeLMCount = scheduledItems.filter(scheduledItem => 
                        scheduledItem.isLM && 
                        scheduledItem.startDate <= proposedStartDate && 
                        scheduledItem.targetDate > proposedStartDate
                    ).length;
                    
                    // If no LM items are active and we still have LM items to schedule, reserve a slot
                    const remainingLMItems = lmNewItems.filter((_, index) => !scheduledItems.some(s => s.id === lmNewItems[index].id));
                    if (activeLMCount === 0 && remainingLMItems.length > 0 && activeCount >= MAX_PARALLEL_ITEMS - 1) {
                        // Move to next day
                        proposedStartDate = addDays(proposedStartDate, 1);
                        continue;
                    }
                }
                
                // We found a valid start date
                break;
            }
            
            // Move to next day
            proposedStartDate = addDays(proposedStartDate, 1);
        }
        
        // Schedule the item
        const { adjustedDuration, hasHolidayImpact } = adjustForHoliday(proposedStartDate, item.duration);
        const targetDate = addDays(proposedStartDate, adjustedDuration);
        
        scheduledItems.push({
            ...item,
            startDate: new Date(proposedStartDate),
            targetDate: targetDate,
            duration: adjustedDuration,
            hasHolidayImpact: hasHolidayImpact,
            isLM: item.isLM || false
        });
    }
    
    return scheduledItems;
}

function scheduleAllItems(workItems, lmItems = []) {
    // Categorize regular work items
    const { activityLogItems, searchItems, orphanItems } = categorizeItems(workItems);
    
    // Identify which LM items belong to which category
    const lmActivityLogItems = lmItems.filter(lmItem => 
        lmItem.row?.ParentFeature === 'Generate LM - Activity Log' || 
        lmItem.row?.ParentFeature === 'Generate LM'
    );
    const lmSearchItems = lmItems.filter(lmItem => 
        lmItem.row?.ParentFeature === 'Generate LM - Search'
    );
    
    // Combine regular and LM items for each category
    const allActivityLogItems = [...activityLogItems, ...lmActivityLogItems];
    const allSearchItems = [...searchItems, ...lmSearchItems];
    
    // Schedule Activity Log items first (with LM items included)
    const scheduledActivityLog = scheduleItemsWithConstraints(
        allActivityLogItems, 
        lmActivityLogItems, 
        ACTIVITY_LOG_DEADLINE, 
        new Date()
    );
    
    // Find when Activity Log items finish to start Search items
    const activityLogEndDate = scheduledActivityLog.length > 0 
        ? new Date(Math.max(...scheduledActivityLog.map(item => item.targetDate)))
        : new Date();
    
    // Schedule Search items (with LM items included)
    const scheduledSearch = scheduleItemsWithConstraints(
        allSearchItems, 
        lmSearchItems, 
        SEARCH_DEADLINE, 
        activityLogEndDate
    );
    
    // Schedule orphan items
    const scheduledOrphans = scheduleItemsWithConstraints(
        orphanItems, 
        [], 
        ACTIVITY_LOG_DEADLINE, 
        new Date()
    );
    
    return {
        activityLog: scheduledActivityLog,
        search: scheduledSearch,
        orphans: scheduledOrphans,
        all: [...scheduledActivityLog, ...scheduledSearch, ...scheduledOrphans]
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
