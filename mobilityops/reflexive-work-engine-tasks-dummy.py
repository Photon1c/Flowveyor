import json
import random
from rich.table import Table
from rich.console import Console
from rich.panel import Panel
from pathlib import Path

# Load parameters from JSON
PARAMS_PATH = Path("parameters.json")

# Fallback default parameters if file doesn't exist
default_params = {
    "total_work_minutes": 450,
    "min_task_duration": 6,
    "max_task_duration": 18,
    "task_names": ["Email", "Meeting", "Code Review", "Planning", "Break", "1:1", "Research"]
}

if PARAMS_PATH.exists():
    with open(PARAMS_PATH, "r") as f:
        params = json.load(f)
else:
    params = default_params

# Extract variables
TOTAL_WORK_MINUTES = params.get("total_work_minutes", 450)
MIN_TASK_DURATION = params.get("min_task_duration", 6)
MAX_TASK_DURATION = params.get("max_task_duration", 18)
TASK_NAMES = params.get("task_names", default_params["task_names"])

# Generate tasks
remaining_minutes = TOTAL_WORK_MINUTES
tasks = []
task_id = 1

while remaining_minutes >= MIN_TASK_DURATION:
    max_duration = min(MAX_TASK_DURATION, remaining_minutes)
    task_duration = random.randint(MIN_TASK_DURATION, max_duration)
    task_name = random.choice(TASK_NAMES)
    tasks.append({
        "id": f"Task-{task_id}",
        "name": task_name,
        "duration": task_duration
    })
    task_id += 1
    remaining_minutes -= task_duration

# Build output table
table = Table(title="🧠 Reflexive Workflow Engine - Configurable Day Planner")
table.add_column("Task ID", justify="center")
table.add_column("Task Name", justify="left")
table.add_column("Duration (min)", justify="right")

for task in tasks:
    table.add_row(task["id"], task["name"], str(task["duration"]))

# Summary
summary_panel = Panel(f"[green]Total Tasks:[/green] {len(tasks)}  "
                      f"[cyan]Total Time Used:[/cyan] {TOTAL_WORK_MINUTES - remaining_minutes} min  "
                      f"[yellow]Idle Minutes:[/yellow] {remaining_minutes} min",
                      title="[bold]Daily Summary[/bold]")

# Display
console = Console()
console.print(table)
console.print(summary_panel)
