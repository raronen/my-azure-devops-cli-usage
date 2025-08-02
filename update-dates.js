const { checkAuth, authenticate } = require('./create-work-items');
const { parseDate } = require('./date-helpers');
const { queryWorkItems, getWorkItemDetails, updateWorkItemTargetDate } = require('./azure-query');
const { generateDateUpdateReport } = require('./date-report-generator');

async function main() {
    try {
        // Parse command line arguments
        const outputIndex = process.argv.indexOf('--output');
        const outputFile = outputIndex !== -1 && process.argv[outputIndex + 1] 
            ? process.argv[outputIndex + 1] 
            : 'date-update-report.md';

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
        
        const updatedItems = [];
        const skippedItems = [];
        
        // Process each work item
        for (const workItem of workItems) {
            try {
                console.log(`Processing work item #${workItem.id}...`);
                
                // Get detailed work item information
                const details = await getWorkItemDetails(workItem.id);
                
                // Check if finish date exists
                if (!details.finishDate) {
                    console.log(`⚠️  Skipping #${details.id} "${details.title}" - No finish date set`);
                    skippedItems.push(details);
                    continue;
                }
                
                // Use finish date as target date
                const finishDate = parseDate(details.finishDate);
                
                // Update work item target date with finish date value
                const updateResult = await updateWorkItemTargetDate(details.id, finishDate, dryRun);
                console.log(`✅ #${details.id} "${details.title}" - ${dryRun ? 'Would update' : 'Updated'} target date to ${finishDate.toISOString().split('T')[0]}`);
                console.log(`   Copied from finish date: ${finishDate.toISOString().split('T')[0]}`);
                
                updatedItems.push({
                    ...details,
                    updatedTargetDate: finishDate,
                    originalFinishDate: finishDate
                });
                
            } catch (error) {
                console.error(`❌ Error processing work item #${workItem.id}: ${error.message}`);
                skippedItems.push({
                    id: workItem.id,
                    type: 'Unknown',
                    title: 'Error retrieving details',
                    error: error.message
                });
            }
            
            console.log('-'.repeat(50));
        }
        
        // Generate report
        await generateDateUpdateReport(updatedItems, skippedItems, outputFile);
        
        // Summary
        console.log('\n📊 Summary:');
        console.log(`   Items ${dryRun ? 'to update' : 'updated'}: ${updatedItems.length}`);
        console.log(`   Items skipped: ${skippedItems.length}`);
        
        if (dryRun && updatedItems.length > 0) {
            console.log('\n💡 Run with --apply to actually update the work items');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run the script
main();
