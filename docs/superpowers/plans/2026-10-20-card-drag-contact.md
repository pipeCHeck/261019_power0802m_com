# Free drag and continuous ground contact

User wants responsive motion at every grab point, without a water-like drag sensation; actual viewport-bottom contact; and no sudden tilt when pressing the top of a standing rectangle downward. Keep mass/inertia and ball collisions, preserve the open top and horizontal wrapping. Do not commit, push or deploy.

Root cause probes: airborne spin retains only .6703 after .5 s; translations retain .8395. The pinned-angle global root projection can change a standing card by -.4755 radians when pressing an upper grab down by 8 px. The floor is explicitly inset 16 px.

Implementation: remove the floor inset; use physical inertia instead of tripling it; lower drag/air damping and preserve release momentum. Clamp unreachable downward pointer motion at the current material-point floor limit before computing hand acceleration. Bound angular updates along the continuous local feasible arc, rather than searching for an unrelated feasible orientation. This lets floor contact resist pressure while lifted cards rotate freely.

Verify the exact reported standing-card press, arbitrary-angle continuity, multiple grab points, ground-stop velocities, airborne momentum, release, wrap, scoring and shape contacts. Bump once to v0.0.8 after the changes; verify tests, review and local HTTP.

## Result

- Floor equals viewport height. Card mass remains 12; gravity and ball collisions remain in place.
- Held angular damping .16/s, airborne translation .04/s and airborne spin .1/s. Removed artificial inertia multiplier and release braking. Airborne translation/spin retain about98%/95% after .5seconds.
- Unreachable downward input is stopped at the current pose's floor limit before hand acceleration is calculated. Contact follows the local feasible angle without global orientation jumps. Actual center displacement supplies collision/release velocity.
- Hand filtering runs per internal physics step. The same hand path is consistent across substeps and with an active game ball.
- 44 tests pass; independent read-only review found no remaining actionable defects, including additional floor-angle, grab-point and repeated-shake probes. Browser interaction itself remains unverified because browser control is unavailable.
- Version bumped once to v0.0.8. No commit, push, remote build or deployment.
