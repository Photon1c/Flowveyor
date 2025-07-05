#Monitor a bee colony.
import random
import time
import argparse
from rich.table import Table
from rich.live import Live
from rich.panel import Panel
from rich.console import Console

console = Console()

BEE_TASKS = [
    "Collecting Nectar",
    "Delivering Nectar",
    "Napping",
    "Greeting Neighbor",
    "Cleaning Comb",
    "Dancing Directions"
]

class Bee:
    def __init__(self, bee_id):
        self.id = f"Bee-{bee_id:06d}"
        self.energy = random.randint(50, 100)
        self.task = random.choice(BEE_TASKS)
        self.task_duration = random.randint(1, 5)
        self.time_in_task = 0

    def update(self):
        self.time_in_task += 1
        self.energy -= 1

        if self.energy <= 10:
            self.task = "Napping"
            self.task_duration = random.randint(3, 6)
            self.time_in_task = 0
            self.energy += 10  # regain energy slowly
        elif self.time_in_task >= self.task_duration:
            self.task = random.choice(BEE_TASKS)
            self.task_duration = random.randint(1, 5)
            self.time_in_task = 0

def create_bee_table(bees):
    table = Table(title="🐝 Bee Colony - Sample State")
    table.add_column("Bee ID", style="dim")
    table.add_column("Task")
    table.add_column("Energy", justify="right")
    table.add_column("Time In Task", justify="right")

    for bee in bees[:25]:  # display only a sample of bees
        table.add_row(bee.id, bee.task, str(bee.energy), str(bee.time_in_task))
    return table

def summarize_tasks(bees):
    task_counts = {}
    for bee in bees:
        task_counts[bee.task] = task_counts.get(bee.task, 0) + 1

    summary = "\\n".join([f"[cyan]{task}[/cyan]: {count}" for task, count in task_counts.items()])
    return Panel(summary, title="🌻 Task Distribution", border_style="green")

def run_simulation(num_bees, max_ticks=None):
    bees = [Bee(i) for i in range(1, num_bees + 1)]
    tick = 0

    with Live(console=console, refresh_per_second=2, screen=False) as live:
        while True:
            tick += 1
            for bee in bees:
                bee.update()

            layout = Table.grid()
            layout.add_row(f"[bold magenta]Reflexive Workflow Engine - Bee Colony[/bold magenta] | Tick: {tick}")
            live.update(Panel(create_bee_table(bees), title=f"🐝 Bee Status - Tick {tick}", border_style="blue"))
            console.print(summarize_tasks(bees))

            time.sleep(0.5)

            if max_ticks and tick >= max_ticks:
                console.print(f"[green]Simulation ended after {max_ticks} ticks.[/green]")
                break

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Bee Colony Workflow Simulation")
    parser.add_argument("--bees", type=int, default=1000, help="Number of bees in the colony (default: 1000)")
    parser.add_argument("--ticks", type=int, default=None, help="Max ticks to simulate (default: infinite)")
    args = parser.parse_args()

    try:
        run_simulation(args.bees, args.ticks)
    except KeyboardInterrupt:
        console.print("\\n[yellow]Simulation interrupted by user.[/yellow]")

