# Three Js Pipeline

## A simulator for customizing different data operation flows.

### Project Description

This is a vanilla Three.js app (no framework required) for simulating a softbody pipeline (hose) with interactive, physically plausible flow and bulging effects. It is designed for future extensibility and can serve as a base for more complex data flow or visualization projects.

### Features

- **Softbody Hose with Local Bulging:**
  - The pipeline is rendered as a flexible hose that locally expands (bulges) as clusters of units (balls) move through it.
  - Bulges are sharp, elastic, and based on local density, not global count.
  - The bulge effect is now much more visible and can be made dramatic with the slider.
  - Bulges are now more 3D and oval-shaped for realism.

- **Clustered Flow Units:**
  - Units are deployed in user-defined batches and automatically split into clusters for realistic local bulging.
  - Each cluster is visualized as a bundle of colored balls, moving together through the hose.
  - Clusters are less packed for clarity, and each ball is independently animated.

- **Interactive UI Controls:**
  - **Unit Count & Interval:** Set the number of units to deploy and the interval between deployments.
  - **Bulge Intensity Slider:** Adjust the strength of the bulge effect in real time (now much more impactful).
  - **Ball Size Slider:** Adjust the size of the balls (units) from tiny to large.
  - **Play/Pause & Reset:** Pause the simulation or reset all units and controls.
  - **Expandable Stats Panel:** All controls are in a modern, collapsible overlay.
  - **Processed Counter:** Now works entirely in the frontend—no backend required.

- **Funnel and Intake Pool:**
  - Units are dropped through a funnel with centripetal force and gravity, then settle in a pool before entering the hose.

- **Outtake Tray (Ball Pit):**
  - The tray at the end of the hose is much larger and lower, accommodating large numbers of balls.
  - Clusters are unbundled at the end: balls are dropped one by one (with a short delay) into the tray, with a failsafe to ensure all balls are emptied.
  - Ball-pit physics: gravity, collision, and bounce.
  - Ball drop is now physically realistic: balls shoot out of the hose tip with velocity and land naturally in the tray.

- **Camera & Navigation:**
  - **Left mouse:** rotate
  - **Right mouse:** pan
  - **Middle mouse:** pan
  - **WASD:** move
  - **Arrow keys:** look around

### How to Use

1. **Set the number of units** and interval, then click "Send Units" to deploy.
2. **Adjust bulge intensity** and **ball size** with the sliders to see different physical and visual effects.
3. **Pause** or **reset** the simulation at any time.
4. Watch as units flow through the hose, causing local bulges, and drop into the tray at the end.
5. The processed counter in the top right shows the number of units processed (frontend only).

### Setup Instructions

#### Local Development

1. **Install dependencies:**
   - Make sure you have [Node.js](https://nodejs.org/) installed.
   - Run `npm install` in the project root (where `package.json` is located).
2. **Run the app locally:**
   - Run `npm run dev` (if using Vite or similar dev server).
   - Open `http://localhost:5173/AGIworld/pipeline.html` (or the path shown in your terminal) in your browser.

#### Deploy to Netlify

1. **Add a `netlify.toml` file** (see below).
2. **Push your code to GitHub.**
3. **Connect your repo to Netlify** and set the publish directory to the project root or `AGIworld` if you want to serve from there.
4. **Set the build command** to `npm run build` (if using Vite) or leave blank for static.
5. **Your site will be live at your Netlify URL!**

---

For now, all parameters are set within the app UI. For development or extension, see `pipeline.js` and `pipeline.html`.

---

### Netlify Configuration Example

See `netlify.toml` below for a minimal static deployment.



