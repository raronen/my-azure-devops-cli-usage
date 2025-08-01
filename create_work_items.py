import subprocess
import json
import sys
from typing import Dict, List, Optional

# Constants
ORGANIZATION = "https://msazure.visualstudio.com"
PROJECT = "One"
AREA_PATH = "One\\LogAnalytics\\QueryService"
ITERATION_PATH = "One\\Bromine\\CY25Q3\\Monthly\\07 Jul (Jun 29 - Jul 26)"

def run_command(command: str) -> tuple[int, str, str]:
    """Run a shell command and return (return_code, stdout, stderr)"""
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=True,
        text=True
    )
    stdout, stderr = process.communicate()
    return process.returncode, stdout, stderr

def check_auth() -> bool:
    """Check if user is authenticated with Azure CLI"""
    code, stdout, _ = run_command("az account show")
    return code == 0

def authenticate():
    """Authenticate with Azure CLI"""
    print("Not authenticated. Running az login...")
    run_command("az login")

def get_state_from_progress(progress: str) -> str:
    """Convert progress string to work item state"""
    if not progress:
        return "New"
    
    progress = progress.lower()
    if progress == "done" or progress == "mostly done":
        return "Done"
    if any(x in progress for x in ["in progress", "not done", "partial"]):
        return "Active"
    return "New"

def get_tags_from_row(row: Dict[str, str]) -> List[str]:
    """Generate tags based on row values"""
    tags = ["draft->laqs"]
    
    if row.get("/search from UI", "").strip() == "+":
        tags.append("UI /search")
    if row.get("DGrep shim", "").strip() == "+":
        tags.append("shim")
    if row.get("Activity Log (/query)", "").strip() == "+":
        tags.append("AL")
        
    return tags

def get_work_item_type(effort: str) -> str:
    """Determine work item type based on effort"""
    if effort.upper() == "S":
        return "Product Backlog Item"
    return "Feature"

def create_work_item(row: Dict[str, str], dry_run: bool = True) -> Optional[str]:
    """Create or simulate creation of a work item"""
    feature_name = row.get("Feature", "").strip()
    if not feature_name:
        return None
        
    effort = row.get("Effort (S/M/L)", "").strip()
    if not effort:
        return None
        
    work_item_type = get_work_item_type(effort)
    title = f"[Draft->LAQS] {feature_name}"
    state = get_state_from_progress(row.get("Progress", ""))
    tags = ";".join(get_tags_from_row(row))

    if dry_run:
        return (f"Would create {work_item_type}:\n"
                f"  Title: {title}\n"
                f"  State: {state}\n"
                f"  Area Path: {AREA_PATH}\n"
                f"  Iteration Path: {ITERATION_PATH}\n"
                f"  Tags: {tags}")

    # Construct the Azure CLI command
    command = [
        f"az boards work-item create",
        f"--org {ORGANIZATION}",
        f"--project '{PROJECT}'",
        f"--type '{work_item_type}'",
        f"--title '{title}'",
        f"--fields",
        f"System.AreaPath='{AREA_PATH}'",
        f"System.IterationPath='{ITERATION_PATH}'",
        f"System.Tags='{tags}'",
        f"System.State='{state}'"
    ]
    
    code, stdout, stderr = run_command(" ".join(command))
    if code != 0:
        print(f"Error creating work item: {stderr}", file=sys.stderr)
        return None
        
    result = json.loads(stdout)
    return f"Created {work_item_type} #{result['id']}: {title}"

from table_data import QUERY_PIPELINE_DATA

def process_table_data():
    """Process the table data and create work items"""
    return QUERY_PIPELINE_DATA

def main():
    """Main script execution"""
    if not check_auth():
        authenticate()
        if not check_auth():
            print("Authentication failed. Please try again.", file=sys.stderr)
            sys.exit(1)

    # Check if --apply flag is present
    dry_run = "--apply" not in sys.argv

    if dry_run:
        print("DRY RUN MODE - No items will be created")
        print("Use --apply to create actual work items")
        print("-" * 50)

    table_data = process_table_data()
    
    for row in table_data:
        result = create_work_item(row, dry_run)
        if result:
            print(result)
            print("-" * 50)

if __name__ == "__main__":
    main()
