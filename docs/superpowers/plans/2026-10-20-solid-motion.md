# Solid plate motion

User says the movement still feels balloon-like, and clarified that this includes both held drag/rotation and released motion. Preserve direct cursor response, low air drag, floor, open top, wrapping and ball/heart/star contacts. No commits, pushes or deployments.

The previous tune sped up only falling: grip gravity remained1350 while free plate/ball gravity were2000/1400. A -1400 px/s plate throw rose487px; an upper-corner grip remained10degrees from equilibrium after1.5s. These distinct time scales retained a slow hanging response.

Use one shared gravity of6000 px/s² in `physics-config.mjs` for all shapes and the held plate. Keep the grip damping ratio and exact point control, mass, air drag and release momentum. Retain ball rise height with its existing launch-speed scaling. Integrate the plate with average old/new vertical velocity so free-fall matches the ball's trajectory. Remove subpixel rocking on the floor using a flat-support condition (angle<.002rad and total kinetic energy equivalent to less than.125px of lift), plus ground-only angular contact damping of2/s.

Added behavioral checks for400px falls under.4s, held-corner stabilization by1.5s, and a common plate/ball trajectory. Existing capture, no-overshoot, floor pressure, wrap, scoring and collision tests remain. Update open-top test impulse/timing to test upward flight under the new gravity; use actual1.5s for grip-capture stabilization rather than a single capped time step.

Verify all53tests, floor settling across24 rotated drops, independent read-only review and local HTTP. Bump once to v0.0.11; leave all changes uncommitted.

Review identified short-edge residual rocking that escaped the original per-axis velocity cutoffs. Added an exact244*.101 landing regression, replaced those cutoffs with the energy threshold, and modeled contact deformation loss. The300-seed rerun fully settled; independent re-review also passed750 throws across five viewport/frame-rate combinations with finite state and no floor penetration. Browser interaction and subjective feel remain unverified directly because browser control is unavailable.
