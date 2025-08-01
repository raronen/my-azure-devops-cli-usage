# Data from the first table in Query pipeline components document
# Excludes the second table (Logical Model Components)
QUERY_PIPELINE_DATA = [
    {
        "Feature": "Parse request headers (prefer, azure region,  app, etc.)",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "S",
        "Progress": "Mostly done"
    },
    {
        "Feature": "Set request options",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "Extract workspace info",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "S",
        "Progress": "Done"
    },
    {
        "Feature": "Response compression (should debate whether this is needed – can be handled by nginx – even for Draft)",
        "/search from UI": "",
        "DGrep shim": "",
        "Activity Log (/query)": "",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "Audit middleware – query audit log",
        "/search from UI": "+",
        "DGrep shim": "-",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "M",
        "Progress": "In progress"
    },
    {
        "Feature": "SLO metrics",
        "/search from UI": "+",
        "DGrep shim": "-",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "Billing aux",
        "/search from UI": "+",
        "DGrep shim": "-",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "Billing basic",
        "/search from UI": "?",
        "DGrep shim": "-",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "M",
        "Progress": ""
    },
    {
        "Feature": "Authentication strategies (AppInsightsAad / AadUser / ApiKey  / AMEAad / ARM)",
        "/search from UI": "+AadUser",
        "DGrep shim": "AadUser (for testing)\n+AMEAad",
        "Activity Log (/query)": "AadUser (for testing)\n+AMEAad",
        "Effort (S/M/L)": "S",
        "Progress": "Partial (MISE/ARM configuration exists)"
    },
    {
        "Feature": "Response cache middleware (built in ASP.NET)",
        "/search from UI": "-",
        "DGrep shim": "-",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "Concurrency middleware (defaults + overrides in runtime config)",
        "/search from UI": "+",
        "DGrep shim": "-",
        "Activity Log (/query)": "+ (run in AL service, not in DP)",
        "Effort (S/M/L)": "M",
        "Progress": "Partial (API done, no middleware or configuration)"
    },
    {
        "Feature": "Rate limiting middleware (ATS?)",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "",
        "Effort (S/M/L)": "M",
        "Progress": ""
    },
    {
        "Feature": "Extract resources (workspace info: SingleWorkspace / MultiWorkspace / MultiApp)",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "M",
        "Progress": ""
    },
    {
        "Feature": "Network access validation (private link / NSP)",
        "/search from UI": "+",
        "DGrep shim": "-",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "M",
        "Progress": "In progress"
    },
    {
        "Feature": "Query resource limits (resources / applications / workspaces)",
        "/search from UI": "",
        "DGrep shim": "-",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "",
        "Progress": ""
    },
    {
        "Feature": "Workspace access checks – determines which authz handler to use",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "Extract Kusto query info & set query options",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "Set traffic category",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "S",
        "Progress": "Done"
    },
    {
        "Feature": "Block blacklisted workspace IDs / alert rule IDs",
        "/search from UI": "-",
        "DGrep shim": "-",
        "Activity Log (/query)": "",
        "Effort (S/M/L)": "",
        "Progress": ""
    },
    {
        "Feature": "Authorize user – validate",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "Parse and validate query",
        "/search from UI": "+",
        "DGrep shim": "+/-",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "L",
        "Progress": "In progress"
    },
    {
        "Feature": "Build workspace metadata (and filter by solutions)",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "M",
        "Progress": "In progress"
    },
    {
        "Feature": "Read input metadata (system functions, resource type, etc.)",
        "/search from UI": "+",
        "DGrep shim": "-",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "S",
        "Progress": "In progress"
    },
    {
        "Feature": "Build LACP (DAS) metadata (saved searches)",
        "/search from UI": "+",
        "DGrep shim": "-",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "Read App Insights saved functions",
        "/search from UI": "-",
        "DGrep shim": "-",
        "Activity Log (/query)": "",
        "Effort (S/M/L)": "",
        "Progress": ""
    },
    {
        "Feature": "KCM placement",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "S",
        "Progress": "Done"
    },
    {
        "Feature": "BPS placement",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "S",
        "Progress": "Done"
    },
    {
        "Feature": "Process placement permissions (full table access / conditional)",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "M",
        "Progress": ""
    },
    {
        "Feature": "Remove irrelevant shards from placement result (override KCM/BPS)",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "Generate LM (see below)",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "L",
        "Progress": "In progress"
    },
    {
        "Feature": "Find optimal placement (+ noop clusters)",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "S",
        "Progress": "Done"
    },
    {
        "Feature": "Resource governor (see below)",
        "/search from UI": "+(Start with runaway query)",
        "DGrep shim": "-",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "M (S)",
        "Progress": ""
    },
    {
        "Feature": "Execute query",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "L",
        "Progress": "Mostly done"
    },
    {
        "Feature": "Query retries (weak consistency, another Noop, etc.)",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "Cancel query in Kusto (requires additional .cancel query)",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "Query forking to follower + cluster level metrics",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "",
        "Progress": ""
    },
    {
        "Feature": "Log permissions",
        "/search from UI": "-",
        "DGrep shim": "-",
        "Activity Log (/query)": "",
        "Effort (S/M/L)": "",
        "Progress": ""
    },
    {
        "Feature": "Write query results to response (+ dataSources)",
        "/search from UI": "+",
        "DGrep shim": "",
        "Activity Log (/query)": "",
        "Effort (S/M/L)": "M",
        "Progress": "Mostly done"
    },
    {
        "Feature": "Query side by side execution",
        "/search from UI": "-",
        "DGrep shim": "-",
        "Activity Log (/query)": "",
        "Effort (S/M/L)": "",
        "Progress": ""
    },
    {
        "Feature": "AGC deployment",
        "/search from UI": "",
        "DGrep shim": "",
        "Activity Log (/query)": "",
        "Effort (S/M/L)": "M",
        "Progress": ""
    },
    {
        "Feature": "Watchlist support",
        "/search from UI": "+",
        "DGrep shim": "-",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "M",
        "Progress": ""
    },
    {
        "Feature": "Handle partial Kusto errors",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "render response support",
        "/search from UI": "+",
        "DGrep shim": "-",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "enhancedStats response",
        "/search from UI": "+",
        "DGrep shim": "-",
        "Activity Log (/query)": "-",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "x-ms-app to telemetry and Kusto client",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "S",
        "Progress": ""
    },
    {
        "Feature": "Side-by-side",
        "/search from UI": "+",
        "DGrep shim": "+",
        "Activity Log (/query)": "+",
        "Effort (S/M/L)": "M",
        "Progress": ""
    }
]
