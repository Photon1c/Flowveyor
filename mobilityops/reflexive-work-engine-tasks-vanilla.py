#Reflexive Workflow Engine
import random
from rich.table import Table
from rich.console import Console
from rich.panel import Panel

# Constants
TOTAL_WORK_MINUTES = 450  # 8 hours - 1.5 hours (lunch + breaks)
MIN_TASK_DURATION = 6
MAX_TASK_DURATION = 18

# Generate tasks that add up to 450 minutes
remaining_minutes = TOTAL_WORK_MINUTES
tasks = []
task_id = 1

while remaining_minutes >= MIN_TASK_DURATION:
    max_duration = min(MAX_TASK_DURATION, remaining_minutes)
    task_duration = random.randint(MIN_TASK_DURATION, max_duration)
    tasks.append({
        "id": f"Task-{task_id}",
        "duration": task_duration
    })
    task_id += 1
    remaining_minutes -= task_duration

# Build output table
table = Table(title="🧠 Reflexive Workflow Engine - Day Planner")
table.add_column("Task ID", justify="center")
table.add_column("Duration (min)", justify="right")

for task in tasks:
    table.add_row(task["id"], str(task["duration"]))

# Summary
summary_panel = Panel(f"[green]Total Tasks:[/green] {len(tasks)}  "
                      f"[cyan]Total Time Used:[/cyan] {TOTAL_WORK_MINUTES - remaining_minutes} min  "
                      f"[yellow]Idle Minutes:[/yellow] {remaining_minutes} min",
                      title="[bold]Daily Summary[/bold]")

# Display
console = Console()
console.print(table)
console.print(summary_panel)
