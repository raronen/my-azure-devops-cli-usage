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
    E0["[Draft->LAQS] /query"]
    E1["[Draft->LAQS] /search"]
    E2["[Draft->LAQS] Activity Log /query"]
    E0 --> E1
    E1 --> E2
    
    style E0 fill:#fff3e0
    style E1 fill:#e1f5fe
    style E2 fill:#f3e5f5
\`\`\``;
}

function generateDetailedHierarchyDiagram(searchItems, activityLogItems) {
    const searchFeatures = searchItems.filter(item => item.type === 'Feature').slice(0, 8); // Limit for readability
    const activityLogFeatures = activityLogItems.filter(item => item.type === 'Feature').slice(0, 8);
    
    let diagram = `\`\`\`mermaid
graph TD
    E1["🏛️ [Draft->LAQS] /search<br/>Epic"]
    E2["🏛️ [Draft->LAQS] Activity Log /query<br/>Epic"]
    
    E1 --> E2
`;

    // Add some key Features under /search Epic
    searchFeatures.forEach((item, index) => {
        const nodeId = `SF${index + 1}`;
        const shortTitle = item.originalFeature.length > 40 
            ? item.originalFeature.substring(0, 40) + '...' 
            : item.originalFeature;
        const icon = item.state === 'Done' ? '✅' : item.state === 'Active' ? '🚧' : '⭕';
        diagram += `    ${nodeId}["${icon} 🎯 ${shortTitle}"]
    E1 --> ${nodeId}
`;
    });

    // Add some key Features under Activity Log Epic
    activityLogFeatures.forEach((item, index) => {
        const nodeId = `AF${index + 1}`;
        const shortTitle = item.originalFeature.length > 40 
            ? item.originalFeature.substring(0, 40) + '...' 
            : item.originalFeature;
        const icon = item.state === 'Done' ? '✅' : item.state === 'Active' ? '🚧' : '⭕';
        diagram += `    ${nodeId}["${icon} 🎯 ${shortTitle}"]
    E2 --> ${nodeId}
`;
    });

    // Add Generate LM Features and their children
    const generateLMSearch = searchItems.find(item => item.originalFeature === 'Generate LM - Search');
    const generateLMActivityLog = activityLogItems.find(item => item.originalFeature === 'Generate LM - Activity Log');
    
    if (generateLMSearch) {
        diagram += `    GLS["🚧 🎯 Generate LM - Search"]
    E1 --> GLS
    LM1["⭕ 📋 Multiple tables"]
    LM2["⭕ 📋 Hidden columns"] 
    LM3["⭕ 🎯 ABAC & TLR v1\\v2"]
    LM4["⭕ 📋 System functions"]
    GLS --> LM1
    GLS --> LM2
    GLS --> LM3
    GLS --> LM4
`;
    }

    if (generateLMActivityLog) {
        diagram += `    GLA["🚧 🎯 Generate LM - Activity Log"]
    E2 --> GLA
    LMA1["⭕ 📋 Hard-coded columns"]
    LMA2["⭕ 📋 Include / exclude tags"]
    LMA3["⭕ 📋 empty datatable"]
    GLA --> LMA1
    GLA --> LMA2
    GLA --> LMA3
`;
    }

    diagram += `
    style E1 fill:#e1f5fe
    style E2 fill:#f3e5f5
    style GLS fill:#fff3e0
    style GLA fill:#fff3e0
\`\`\``;

    return diagram;
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

function generateSummaryTable(queryItems, searchItems, activityLogItems, orphanItems) {
    const totalItems = queryItems.length + searchItems.length + activityLogItems.length + orphanItems.length;
    const doneCount = [...queryItems, ...searchItems, ...activityLogItems, ...orphanItems].filter(item => item.state === 'Done').length;
    const activeCount = [...queryItems, ...searchItems, ...activityLogItems, ...orphanItems].filter(item => item.state === 'Active').length;
    const newCount = [...queryItems, ...searchItems, ...activityLogItems, ...orphanItems].filter(item => item.state === 'New').length;
    
    return `## 📊 Summary

| Epic | Work Items | Status Breakdown |
|------|------------|------------------|
| [Draft->LAQS] /query | ${queryItems.length} | ✅ ${queryItems.filter(i => i.state === 'Done').length} / 🚧 ${queryItems.filter(i => i.state === 'Active').length} / ⭕ ${queryItems.filter(i => i.state === 'New').length} |
| [Draft->LAQS] /search | ${searchItems.length} | ✅ ${searchItems.filter(i => i.state === 'Done').length} / 🚧 ${searchItems.filter(i => i.state === 'Active').length} / ⭕ ${searchItems.filter(i => i.state === 'New').length} |
| [Draft->LAQS] Activity Log /query | ${activityLogItems.length} | ✅ ${activityLogItems.filter(i => i.state === 'Done').length} / 🚧 ${activityLogItems.filter(i => i.state === 'Active').length} / ⭕ ${activityLogItems.filter(i => i.state === 'New').length} |
| No Epic (Orphan Items) | ${orphanItems.length} | ✅ ${orphanItems.filter(i => i.state === 'Done').length} / 🚧 ${orphanItems.filter(i => i.state === 'Active').length} / ⭕ ${orphanItems.filter(i => i.state === 'New').length} |
| **Total** | **${totalItems}** | **✅ ${doneCount} / 🚧 ${activeCount} / ⭕ ${newCount}** |`;
}

async function generateMarkdownReport(workItems, outputFile = 'dry-run-report.md') {
    // Categorize work items by their parent Epic
    const queryItems = workItems.filter(item => 
        item.parentEpicId === 'DRY_RUN_QUERY_EPIC_ID'
    );
    
    const searchItems = workItems.filter(item => 
        item.parentEpicId === 'DRY_RUN_SEARCH_EPIC_ID'
    );
    
    const activityLogItems = workItems.filter(item => 
        item.parentEpicId === 'DRY_RUN_ACTIVITY_LOG_EPIC_ID'
    );
    
    const orphanItems = workItems.filter(item => 
        !item.parentEpicId || (
            item.parentEpicId !== 'DRY_RUN_QUERY_EPIC_ID' && 
            item.parentEpicId !== 'DRY_RUN_SEARCH_EPIC_ID' && 
            item.parentEpicId !== 'DRY_RUN_ACTIVITY_LOG_EPIC_ID'
        )
    );

    const content = `# 🚀 Azure DevOps Work Items Creation Plan

*Generated on: ${new Date().toLocaleString()}*

${generateSummaryTable(queryItems, searchItems, activityLogItems, orphanItems)}

## 🏗️ Epic Hierarchy

${generateMermaidDiagram()}

## 🔗 Detailed Work Items Hierarchy

${generateDetailedHierarchyDiagram(queryItems, searchItems, activityLogItems)}

## 📋 Work Items by Epic

${generateWorkItemSection('[Draft->LAQS] /query', queryItems)}

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
