#Vanilla template for worklow terminal dashboard
import json
import random
import time
import argparse
from dataclasses import dataclass
from rich.live import Live
from rich.panel import Panel
from rich.table import Table
from rich.layout import Layout
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn
from rich import box, console

console = console.Console()

# Load parameters from JSON
PARAMS_PATH = "parameters.json"

# Fallback default parameters if file doesn't exist
default_params = {
    "total_work_minutes": 450,
    "min_task_duration": 6,
    "max_task_duration": 18,
    "task_names": ["Email", "Meeting", "Code Review", "Planning", "Break", "1:1", "Research"]
}

try:
    with open(PARAMS_PATH, "r") as f:
        params = json.load(f)
except FileNotFoundError:
    params = default_params

# Extract variables
TOTAL_WORK_MINUTES = params.get("total_work_minutes", 450)
MIN_TASK_DURATION = params.get("min_task_duration", 6)
MAX_TASK_DURATION = params.get("max_task_duration", 18)
TASK_NAMES = params.get("task_names", default_params["task_names"])


@dataclass
class Task:
    id: str
    name: str
    duration: int


@dataclass
class DaySummary:
    day_number: int
    total_tasks: int
    total_time: int
    idle_time: int


def generate_day_tasks(day_number: int) -> (list[Task], DaySummary):
    """Generate random tasks for a workday"""
    remaining_minutes = TOTAL_WORK_MINUTES
    tasks = []
    task_id = 1
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
    ) as progress:
        task_progress = progress.add_task(f"[cyan]Generating Day {day_number}", total=TOTAL_WORK_MINUTES)
        
        while remaining_minutes >= MIN_TASK_DURATION:
            max_duration = min(MAX_TASK_DURATION, remaining_minutes)
            task_duration = random.randint(MIN_TASK_DURATION, max_duration)
            task_name = random.choice(TASK_NAMES)
            
            tasks.append(Task(
                id=f"Task-{task_id}",
                name=task_name,
                duration=task_duration
            ))
            
            progress.update(task_progress, advance=task_duration)
            time.sleep(0.05)  # Animation delay
            
            task_id += 1
            remaining_minutes -= task_duration

    return tasks, DaySummary(
        day_number=day_number,
        total_tasks=len(tasks),
        total_time=TOTAL_WORK_MINUTES - remaining_minutes,
        idle_time=remaining_minutes
    )


def create_tasks_table(tasks: list[Task]) -> Table:
    """Create a table of tasks"""
    table = Table(
        title="🧠 Reflexive Workflow Engine - Active Task Stream",
        box=box.ROUNDED,
        header_style="bold magenta"
    )
    table.add_column("Task ID", style="dim", width=10)
    table.add_column("Task Name", min_width=20)
    table.add_column("Duration (min)", justify="right")
    
    for task in tasks:
        table.add_row(
            task.id,
            task.name,
            str(task.duration)
        )
    
    return table


def create_summary_panel(summary: DaySummary) -> Panel:
    """Create a summary panel for the current day"""
    return Panel(
        f"[green]Total Tasks:[/green] {summary.total_tasks}  "
        f"[cyan]Total Time Used:[/cyan] {summary.total_time} min  "
        f"[yellow]Idle Minutes:[/yellow] {summary.idle_time} min",
        title="[bold]Live Daily Summary[/bold]",
        border_style="blue"
    )


def create_historical_table(historical_data: list[DaySummary]) -> Table:
    """Create a historical performance table"""
    table = Table(
        title="📊 Simulation History",
        box=box.MINIMAL_DOUBLE_HEAD,
        header_style="bold yellow"
    )
    table.add_column("#", style="dim")
    table.add_column("Tasks")
    table.add_column("Time Used")
    table.add_column("Idle Time")
    
    for entry in historical_data:
        table.add_row(
            str(entry.day_number),
            str(entry.total_tasks),
            f"{entry.total_time} min",
            f"{entry.idle_time} min"
        )
    
    return table


def setup_layout() -> Layout:
    """Create the initial layout structure"""
    layout = Layout(name="root")
    
    layout.split(
        Layout(name="header", size=3),
        Layout(name="main", ratio=2),
        Layout(name="footer", size=10)
    )
    
    layout["main"].split_row(
        Layout(name="tasks", ratio=2),
        Layout(name="summary", ratio=1)
    )
    
    return layout


class DashboardHeader:
    """Display header with dynamic simulation info"""
    def __init__(self, total_days: int):
        self.total_days = total_days
        self.current_day = 0
        
    def __rich__(self) -> Panel:
        return Panel(
            f"[bold blue]Workflow Simulation Dashboard[/bold blue] | "
            f"[green]Running {self.total_days} Days[/green] | "
            f"[cyan]Current Day: {self.current_day}[/cyan] | "
            "[yellow]Press CTRL+C to exit[/yellow]",
            style="white on black"
        )


def run_dashboard(total_days: int):
    """Main dashboard loop"""
    layout = setup_layout()
    historical_data = []
    
    header = DashboardHeader(total_days)
    layout["header"].update(header)
    
    with Live(layout, refresh_per_second=4, screen=True):
        for day in range(1, total_days + 1):
            header.current_day = day
            
            # Generate tasks and get summary
            tasks, summary = generate_day_tasks(day)
            historical_data.append(summary)
            
            # Update dashboard components
            layout["tasks"].update(create_tasks_table(tasks))
            layout["summary"].update(create_summary_panel(summary))
            layout["footer"].update(create_historical_table(historical_data))
            
            # Refresh header
            layout["header"].update(header)
            
            # Pause between days
            if day < total_days:
                with console.status("[bold yellow]Preparing next day..."):
                    time.sleep(2)
                    

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Run workflow simulation dashboard')
    parser.add_argument('--days', '-d', type=int, default=5,
                      help='Number of days to simulate (default: 5)')
    args = parser.parse_args()
    
    try:
        run_dashboard(args.days)
        console.print("[green]✓ Simulation completed successfully[/green]")
    except KeyboardInterrupt:
        console.print("\n[yellow]⚠ Simulation interrupted by user[/yellow]")
