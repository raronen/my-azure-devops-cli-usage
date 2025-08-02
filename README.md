# Azure DevOps Work Items Creator

A Node.js tool to bulk create Azure DevOps work items from JSON data. This tool helps automate the creation of Product Backlog Items and Features in Azure DevOps, with support for setting titles, states, tags, and more.

## Prerequisites

- Node.js >= 14.0.0
- Azure CLI installed and configured
- Access to Azure DevOps

## Installation

1. Clone this repository:
```bash
git clone [your-repository-url]
cd azure-devops-work-items-creator
```

2. Install dependencies (if any are added in the future):
```bash
npm install
```

## Configuration

The tool uses the following configuration (found in `create-work-items.js`):

- Organization: `https://msazure.visualstudio.com`
- Project: `One`
- Area Path: `One\LogAnalytics\QueryService`
- Iteration Path: `One\Bromine\CY25Q3\Monthly\07 Jul (Jun 29 - Jul 26)`

Update these constants in the script if needed.

## Usage

### Work Items Creation

The tool provides two ways to run:

1. **Dry Run Mode** (default) - Preview what work items would be created:
```bash
npm start
# or
node main.js
```

2. **Create Mode** - Actually create the work items:
```bash
npm run create
# or
node main.js --apply
```

### Date Updates

#### Start Date Updates

Update start dates for existing work items with "draft->laqs" tag:

1. **Dry Run Mode** (default) - Preview what dates would be updated:
```bash
npm run update-dates
# or
node update-dates.js
```

2. **Apply Mode** - Actually update the work item dates:
```bash
npm run update-dates-apply
# or
node update-dates.js --apply
```

**Date Update Logic:**
- **Features**: Random 3-5 week duration (start date calculated from finish date)
- **PBIs**: Random 1-2 week duration (start date calculated from finish date)
- Work items without finish dates are skipped and reported

**Custom report filename for date updates:**
```bash
node update-dates.js --output my-date-report.md
```

#### Target Date Updates

Update target dates for existing work items with "draft->laqs" tag by copying their finish date:

1. **Dry Run Mode** (default) - Preview what target dates would be updated:
```bash
node update-target-dates.js
```

2. **Apply Mode** - Actually update the work item target dates:
```bash
node update-target-dates.js --apply
```

**Target Date Update Logic:**
- Copies the Finish Date value to the Target Date field
- Work items without finish dates are skipped and reported
- All work item types are processed the same way

**Custom report filename for target date updates:**
```bash
node update-target-dates.js --output my-target-date-report.md
```

### Markdown Report Generation

In dry run mode, the tool automatically generates a comprehensive markdown report showing:
- Epic hierarchy with Mermaid diagram
- Work items organized by Epic
- Status breakdown with emojis (✅ Done, 🚧 Active, ⭕ New)
- Summary statistics

**Default output:** `dry-run-report.md`

**Custom output filename:**
```bash
node main.js --output my-report.md
```

## Epic Hierarchy

The tool automatically creates an Epic hierarchy:

```
[Draft->LAQS] /search (Root Epic)
└── [Draft->LAQS] Activity Log /query (Child Epic)
    └── Work items with "AL" tag
└── Work items with "UI /search" tag (if they don't have "AL" tag)
```

**Parent Assignment Rules:**
- Items with "AL" tag → Parent is "[Draft->LAQS] Activity Log /query" Epic
- Items with only "UI /search" tag → Parent is "[Draft->LAQS] /search" Epic  
- Items with both tags → Parent is "[Draft->LAQS] Activity Log /query" Epic (higher priority)
- Items with neither tag → No parent Epic

## Data Format

Work items are created based on data in `table_data.json`. The file should contain an array of objects with the following structure:

```json
{
  "queryPipelineData": [
    {
      "Feature": "Feature name",
      "/search from UI": "+",
      "DGrep shim": "+",
      "Activity Log (/query)": "+",
      "Effort (S/M/L)": "S",
      "Progress": "In progress"
    }
  ]
}
```

### Fields:

- **Feature**: Name of the work item (required)
- **Effort (S/M/L)**: Size of the work item (required)
  - "S" creates a Product Backlog Item
  - "M" or "L" creates a Feature
- **Progress**: Current state of the work item
  - Empty → "New"
  - "Done" or "Mostly done" → "Done"
  - "In progress", "Not done", "Partial" → "Active"
- Other fields are used for tag generation:
  - "+` in "/search from UI" adds "UI /search" tag
  - "+" in "DGrep shim" adds "shim" tag
  - "+" in "Activity Log (/query)" adds "AL" tag

## Project Structure

### Work Items Creation
- `main.js` - Entry point and execution logic for creating work items
- `create-work-items.js` - Business logic for work item creation
- `helpers.js` - Utility functions
- `markdown-generator.js` - Report generation for work item creation
- `table_data.json` - Work items data

### Date Updates
- `update-dates.js` - Entry point for updating work item start dates
- `update-target-dates.js` - Entry point for updating work item target dates
- `azure-query.js` - Azure DevOps query and update operations
- `date-helpers.js` - Date calculation and formatting utilities
- `date-report-generator.js` - Report generation for date updates

### Configuration
- `package.json` - Project configuration and scripts

## License

MIT
