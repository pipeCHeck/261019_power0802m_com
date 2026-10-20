# Card weight and shared collisions

User request: remove the extra rounded focus outline on click; make the card feel heavier; collide with circles, hearts and stars; let the card pass above the screen. Preserve the floor, wrap, grabbed pivot, scoring and ending text. No commits, pushes or deployments.

- Remove programmatic pointer focus; preserve keyboard access without adding a second outline.
- Increase card gravity/inertia/damping and reduce throwing speed and ground restitution. Keep its material grab point attached.
- Remove the card ceiling from free motion, dragging and resizing. The existing ball game's wall rules stay unchanged.
- Introduce one shared simulation clock. Substep the card and ball together and resolve contact impulses including angular response, a heavier card mass, moving/held cards and periodic copies.
- Use the visible heart/star outlines for overlap detection, not a bounding circle. Preserve the existing difference/screen rendering layers.
- Test all shapes, rotations, fast contact, wrapped contact, held contact, score/end events, hidden-tab pausing and input isolation. Review the feature, bump once to v0.0.7 and verify local HTTP assets.

## Completed verification

- Removed pointer-triggered programmatic focus and the card's extra focus outline. Keyboard focus uses the existing border.
- Card gravity is 1350 px/s², collisions use mass 12, throws are limited to 950 px/s and rotation/ground restitution are more restrained. No card ceiling remains.
- Shared scene advances both bodies once per frame, including small collision substeps and drag-path interpolation. Heart/star outlines are cached convex decompositions; internal edges are excluded as contact normals, and support contacts are averaged.
- Independent review found a shallow star-valley separation jump. Added a failing regression, fixed local concave contacts, and passed re-review.
- 39 Node tests pass. Additional mobile/rotation/large-shape scenarios remained finite and above the floor. Browser interaction was not directly verified because browser control is unavailable.
- Local HTTP on port 5182 returns status 200 for v0.0.7 and every new module with appropriate MIME types. Package, lock and footer versions match.
- No commit, push, remote build or deployment performed.
