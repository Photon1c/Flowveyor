# Three Js Pipeline

## A simulator for customizing different data operation flows.

### Project Description

This npm Vite app is a vanilla Three.js template for simulating a softbody pipeline (hose) with interactive, physically plausible flow and bulging effects. It is designed for future extensibility and can serve as a base for more complex data flow or visualization projects.

### Features

- **Softbody Hose with Local Bulging:**
  - The pipeline is rendered as a flexible hose that locally expands (bulges) as clusters of units (balls) move through it.
  - Bulges are sharp, elastic, and based on local density, not global count.
  - The hose smoothly returns to its original size after clusters pass.

- **Clustered Flow Units:**
  - Units are deployed in user-defined batches and automatically split into clusters for realistic local bulging.
  - Each cluster is visualized as a bundle of colored balls, moving together through the hose.
  - Clusters are less packed for clarity, and each ball is independently animated.

- **Interactive UI Controls:**
  - **Unit Count & Interval:** Set the number of units to deploy and the interval between deployments.
  - **Bulge Intensity Slider:** Adjust the strength of the bulge effect in real time.
  - **Ball Size Slider:** Adjust the size of the balls (units) from tiny to large.
  - **Play/Pause & Reset:** Pause the simulation or reset all units and controls.
  - **Expandable Stats Panel:** All controls are in a modern, collapsible overlay.

- **Funnel and Intake Pool:**
  - Units are dropped through a funnel with centripetal force and gravity, then settle in a pool before entering the hose.

- **Outtake Tray (Ball Pit):**
  - The tray at the end of the hose is much larger and lower, accommodating large numbers of balls.
  - Clusters are unbundled at the end: balls are dropped one by one (with a short delay and random offset) into the tray, with a failsafe to ensure all balls are emptied.
  - Ball-pit physics: gravity, collision, and bounce.

- **Camera & Navigation:**
  - Left mouse: pan
  - Right/middle mouse: rotate
  - WASD: move
  - Arrow keys: look around

### How to Use

1. **Set the number of units** and interval, then click "Send Units" to deploy.
2. **Adjust bulge intensity** and **ball size** with the sliders to see different physical and visual effects.
3. **Pause** or **reset** the simulation at any time.
4. Watch as units flow through the hose, causing local bulges, and drop into the tray at the end.

### Future Upgrades

- Python CLI for live control with descriptive flags.
- Configurable parameters via a parameters.json file.
- More advanced softbody and clustering logic.

---

For now, all parameters are set within the app UI. For development or extension, see `pipeline.js` and `pipeline.html`.



