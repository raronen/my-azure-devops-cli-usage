const { checkAuth, authenticate } = require('./create-work-items');
const { queryWorkItems, getWorkItemDetails, updateWorkItemFields } = require('./azure-query');
const { scheduleAllItems, calculateEpicDates } = require('./scheduling');
const { formatDate } = require('./date-helpers');

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
            console.log('DRY RUN MODE - No items will be updated');
            console.log('Use --apply to update actual work items');
            console.log('-'.repeat(50));
        } else {
            console.log('APPLY MODE - Work items will be updated');
            console.log('-'.repeat(50));
        }

        // Query work items with "draft->laqs" tag
        console.log('Querying work items with tag "draft->laqs"...');
        const workItems = await queryWorkItems();
        
        if (workItems.length === 0) {
            console.log('No work items found with tag "draft->laqs" in the specified area path.');
            return;
        }
        
        console.log(`Found ${workItems.length} work items to process.`);
        console.log('-'.repeat(50));
        
        // Get detailed information for all work items
        const detailedWorkItems = [];
        for (const workItem of workItems) {
            const details = await getWorkItemDetails(workItem.id);
            detailedWorkItems.push(details);
        }
        
        // Separate epics from other work items
        const epics = detailedWorkItems.filter(item => item.type === 'Epic');
        const nonEpics = detailedWorkItems.filter(item => item.type !== 'Epic');
        
        // Transform non-epic work items to match scheduling format
        const workItemsForScheduling = nonEpics.map(item => ({
            id: item.id,
            title: item.title,
            workItemType: item.type,
            row: {
                'Activity Log (/query)': item.title.includes('Activity Log') ? '+' : '',
                '/search from UI': item.title.includes('search') || item.title.includes('UI') ? '+' : '',
                'DGrep shim': ''
            }
        }));
        
        // Apply scheduling logic
        console.log('Applying scheduling logic...');
        const scheduledItems = scheduleAllItems(workItemsForScheduling);
        
        // Update non-epic work items with calculated dates
        const updatedItems = [];
        for (const scheduledItem of scheduledItems.all) {
            const startDate = formatDate(scheduledItem.startDate);
            const targetDate = formatDate(scheduledItem.targetDate);
            
            if (dryRun) {
                console.log(`Would update #${scheduledItem.id} "${scheduledItem.title}"`);
                console.log(`  Start Date: ${startDate}`);
                console.log(`  Target Date: ${targetDate}`);
            } else {
                console.log(`Updating #${scheduledItem.id} "${scheduledItem.title}"`);
                
                // Update both start date and target date
                await updateWorkItemFields(scheduledItem.id, {
                    'Microsoft.VSTS.Scheduling.StartDate': startDate,
                    'Microsoft.VSTS.Scheduling.TargetDate': targetDate
                });
                
                console.log(`✅ Updated dates - Start: ${startDate}, Target: ${targetDate}`);
            }
            
            updatedItems.push({
                ...scheduledItem,
                startDateFormatted: startDate,
                targetDateFormatted: targetDate
            });
            
            console.log('-'.repeat(50));
        }
        
        // Update epic dates based on children
        console.log('Calculating epic dates based on children...');
        
        const epicHierarchy = {
            query: epics.find(e => e.title.includes('/query') && !e.title.includes('/search')),
            search: epics.find(e => e.title.includes('/search') && !e.title.includes('Activity Log')),
            activityLog: epics.find(e => e.title.includes('Activity Log'))
        };
        
        // Calculate dates for Activity Log epic (children in activity log category)
        if (epicHierarchy.activityLog) {
            const activityLogChildren = scheduledItems.activityLog.concat(scheduledItems.orphans);
            const activityLogDates = calculateEpicDates(activityLogChildren);
            
            if (activityLogDates.startDate && activityLogDates.targetDate) {
                const startDate = formatDate(activityLogDates.startDate);
                const targetDate = formatDate(activityLogDates.targetDate);
                
                if (dryRun) {
                    console.log(`Would update Activity Log Epic #${epicHierarchy.activityLog.id}`);
                    console.log(`  Start Date: ${startDate}`);
                    console.log(`  Target Date: ${targetDate}`);
                } else {
                    console.log(`Updating Activity Log Epic #${epicHierarchy.activityLog.id}`);
                    await updateWorkItemFields(epicHierarchy.activityLog.id, {
                        'Microsoft.VSTS.Scheduling.StartDate': startDate,
                        'Microsoft.VSTS.Scheduling.TargetDate': targetDate
                    });
                    console.log(`✅ Updated epic dates - Start: ${startDate}, Target: ${targetDate}`);
                }
                console.log('-'.repeat(50));
            }
        }
        
        // Calculate dates for Search epic (children in search category + Activity Log epic)
        if (epicHierarchy.search) {
            const searchChildren = scheduledItems.search.concat(
                epicHierarchy.activityLog ? [{ 
                    startDate: epicHierarchy.activityLog.startDate, 
                    targetDate: epicHierarchy.activityLog.targetDate 
                }] : []
            );
            const searchDates = calculateEpicDates(searchChildren);
            
            if (searchDates.startDate && searchDates.targetDate) {
                const startDate = formatDate(searchDates.startDate);
                const targetDate = formatDate(searchDates.targetDate);
                
                if (dryRun) {
                    console.log(`Would update Search Epic #${epicHierarchy.search.id}`);
                    console.log(`  Start Date: ${startDate}`);
                    console.log(`  Target Date: ${targetDate}`);
                } else {
                    console.log(`Updating Search Epic #${epicHierarchy.search.id}`);
                    await updateWorkItemFields(epicHierarchy.search.id, {
                        'Microsoft.VSTS.Scheduling.StartDate': startDate,
                        'Microsoft.VSTS.Scheduling.TargetDate': targetDate
                    });
                    console.log(`✅ Updated epic dates - Start: ${startDate}, Target: ${targetDate}`);
                }
                console.log('-'.repeat(50));
            }
        }
        
        // Calculate dates for Query epic (all children)
        if (epicHierarchy.query) {
            const queryChildren = scheduledItems.all.concat(
                epicHierarchy.search ? [{ 
                    startDate: epicHierarchy.search.startDate, 
                    targetDate: epicHierarchy.search.targetDate 
                }] : []
            );
            const queryDates = calculateEpicDates(queryChildren);
            
            if (queryDates.startDate && queryDates.targetDate) {
                const startDate = formatDate(queryDates.startDate);
                const targetDate = formatDate(queryDates.targetDate);
                
                if (dryRun) {
                    console.log(`Would update Query Epic #${epicHierarchy.query.id}`);
                    console.log(`  Start Date: ${startDate}`);
                    console.log(`  Target Date: ${targetDate}`);
                } else {
                    console.log(`Updating Query Epic #${epicHierarchy.query.id}`);
                    await updateWorkItemFields(epicHierarchy.query.id, {
                        'Microsoft.VSTS.Scheduling.StartDate': startDate,
                        'Microsoft.VSTS.Scheduling.TargetDate': targetDate
                    });
                    console.log(`✅ Updated epic dates - Start: ${startDate}, Target: ${targetDate}`);
                }
                console.log('-'.repeat(50));
            }
        }
        
        // Summary
        console.log('\n📊 Summary:');
        console.log(`   Work items ${dryRun ? 'to update' : 'updated'}: ${updatedItems.length}`);
        console.log(`   Epics ${dryRun ? 'to update' : 'updated'}: ${epics.length}`);
        
        if (dryRun) {
            console.log('\n💡 Run with --apply to actually update the work items');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run the script
main();
