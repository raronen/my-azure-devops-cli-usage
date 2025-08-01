const fs = require('fs').promises;

function getStatusEmoji(state) {
    switch (state) {
        case 'Done': return '✅';
        case 'Active': return '🚧';
        case 'New': return '⭕';
        default: return '❓';
    }
}

function getTypeIcon(type) {
    return type === 'Feature' ? '🎯' : '📋';
}

function generateMermaidDiagram() {
    return `\`\`\`mermaid
graph TD
    E1[["[Draft->LAQS] /search"]]
    E2[["[Draft->LAQS] Activity Log /query"]]
    E1 --> E2
    
    style E1 fill:#e1f5fe
    style E2 fill:#f3e5f5
\`\`\``;
}

function generateWorkItemSection(title, items) {
    if (items.length === 0) return '';
    
    let section = `\n### 🏛️ ${title}\n\n`;
    
    items.forEach(item => {
        const statusEmoji = getStatusEmoji(item.state);
        const typeIcon = getTypeIcon(item.type);
        const typeText = item.type === 'Feature' ? 'Feature' : 'PBI';
        
        section += `${statusEmoji} ${typeIcon} **[${typeText}]** ${item.title}\n`;
        section += `  - **Tags:** ${item.tags.join(', ')}\n`;
        section += `  - **State:** ${item.state}\n`;
        section += `  - **Area Path:** ${item.areaPath}\n`;
        section += `  - **Iteration:** ${item.iterationPath}\n\n`;
    });
    
    return section;
}

function generateSummaryTable(searchItems, activityLogItems, orphanItems) {
    const totalItems = searchItems.length + activityLogItems.length + orphanItems.length;
    const doneCount = [...searchItems, ...activityLogItems, ...orphanItems].filter(item => item.state === 'Done').length;
    const activeCount = [...searchItems, ...activityLogItems, ...orphanItems].filter(item => item.state === 'Active').length;
    const newCount = [...searchItems, ...activityLogItems, ...orphanItems].filter(item => item.state === 'New').length;
    
    return `## 📊 Summary

| Epic | Work Items | Status Breakdown |
|------|------------|------------------|
| [Draft->LAQS] /search | ${searchItems.length} | ✅ ${searchItems.filter(i => i.state === 'Done').length} / 🚧 ${searchItems.filter(i => i.state === 'Active').length} / ⭕ ${searchItems.filter(i => i.state === 'New').length} |
| [Draft->LAQS] Activity Log /query | ${activityLogItems.length} | ✅ ${activityLogItems.filter(i => i.state === 'Done').length} / 🚧 ${activityLogItems.filter(i => i.state === 'Active').length} / ⭕ ${activityLogItems.filter(i => i.state === 'New').length} |
| No Epic (Orphan Items) | ${orphanItems.length} | ✅ ${orphanItems.filter(i => i.state === 'Done').length} / 🚧 ${orphanItems.filter(i => i.state === 'Active').length} / ⭕ ${orphanItems.filter(i => i.state === 'New').length} |
| **Total** | **${totalItems}** | **✅ ${doneCount} / 🚧 ${activeCount} / ⭕ ${newCount}** |`;
}

async function generateMarkdownReport(workItems, outputFile = 'dry-run-report.md') {
    // Categorize work items by their parent Epic
    const searchItems = workItems.filter(item => 
        item.parentEpicId === 'DRY_RUN_SEARCH_EPIC_ID'
    );
    
    const activityLogItems = workItems.filter(item => 
        item.parentEpicId === 'DRY_RUN_ACTIVITY_LOG_EPIC_ID'
    );
    
    const orphanItems = workItems.filter(item => 
        !item.parentEpicId || item.parentEpicId === null
    );

    const content = `# 🚀 Azure DevOps Work Items Creation Plan

*Generated on: ${new Date().toLocaleString()}*

${generateSummaryTable(searchItems, activityLogItems, orphanItems)}

## 🏗️ Epic Hierarchy

${generateMermaidDiagram()}

## 📋 Work Items by Epic

${generateWorkItemSection('[Draft->LAQS] /search', searchItems)}

${generateWorkItemSection('[Draft->LAQS] Activity Log /query', activityLogItems)}

${orphanItems.length > 0 ? generateWorkItemSection('🔗 Items without Epic Parent', orphanItems) : ''}

---

## 📝 Legend

- ✅ **Done** - Completed work items
- 🚧 **Active** - Work items in progress  
- ⭕ **New** - New work items to be created
- 🎯 **Feature** - Large work items (M/L effort)
- 📋 **PBI** - Product Backlog Items (S effort)
- 🏛️ **Epic** - Container for related work items

## 🔄 Next Steps

1. Review the work items and their Epic assignments above
2. If everything looks correct, run the script with \`--apply\` flag to create actual work items:
   \`\`\`bash
   npm run create
   \`\`\`
3. The Epics will be created first, followed by work items with their parent relationships

---
*This report was generated in dry-run mode. No actual work items were created.*
`;

    await fs.writeFile(outputFile, content, 'utf8');
    console.log(`📄 Markdown report generated: ${outputFile}`);
    return outputFile;
}

module.exports = {
    generateMarkdownReport
};
