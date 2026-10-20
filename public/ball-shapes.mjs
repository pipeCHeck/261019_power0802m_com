const starPoints = Array.from({ length: 10 }, (_, index) => {
  const radius = index % 2 === 0 ? 49 : 22;
  const angle = -Math.PI / 2 + index * Math.PI / 5;
  return `${index === 0 ? "M" : "L"} ${50 + Math.cos(angle) * radius} ${50 + Math.sin(angle) * radius}`;
}).join(" ");

const paths = Object.freeze({
  circle: "M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z",
  heart: "M 50 88.4 C 32.72 78.8 5.84 61.52 5.84 37.52 C 5.84 12.56 33.68 3.92 50 26 C 66.32 3.92 94.16 12.56 94.16 37.52 C 94.16 61.52 67.28 78.8 50 88.4 Z",
  star: `${starPoints} Z`,
});

export function selectBallShape(roll = Math.random()) {
  if (roll < .1) return "heart";
  if (roll < .2) return "star";
  return "circle";
}

export function getBallShapePath(shape) {
  return paths[Object.hasOwn(paths, shape) ? shape : "circle"];
}

function sampleOutline(path) {
  const tokens = path.match(/[MLCZ]|-?\d+(?:\.\d+)?/g);
  const points = [];
  let start;
  while (tokens.length) {
    const command = tokens.shift();
    if (command === "M" || command === "L") {
      start = { x: Number(tokens.shift()), y: Number(tokens.shift()) };
      points.push(start);
    } else if (command === "C") {
      const control = Array.from({ length: 3 }, () => ({ x: Number(tokens.shift()), y: Number(tokens.shift()) }));
      for (let i = 1; i <= 12; i++) {
        const t = i / 12, u = 1 - t;
        points.push(Object.fromEntries(["x", "y"].map(axis => [axis,
          u ** 3 * start[axis] + 3 * u * u * t * control[0][axis] +
          3 * u * t * t * control[1][axis] + t ** 3 * control[2][axis]])));
      }
      start = control[2];
    }
  }
  if (Math.hypot(points[0].x - points.at(-1).x, points[0].y - points.at(-1).y) < .001) points.pop();
  return points.map(p => ({ x: (p.x - 50) / 50, y: (p.y - 50) / 50 }));
}

const outlines = { heart: sampleOutline(paths.heart), star: sampleOutline(paths.star) };
const turn = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

function triangulate(points) {
  const winding = Math.sign(points.reduce((area, p, i) => {
    const next = points[(i + 1) % points.length];
    return area + p.x * next.y - next.x * p.y;
  }, 0));
  const remaining = points.map((_, index) => index), triangles = [];
  while (remaining.length > 3) {
    let clipped = false;
    for (let i = 0; i < remaining.length; i++) {
      const triangle = [remaining[(i + remaining.length - 1) % remaining.length], remaining[i], remaining[(i + 1) % remaining.length]];
      const [a, b, c] = triangle.map(index => points[index]);
      if (turn(a, b, c) * winding <= .000000001) continue;
      const occupied = remaining.some(index => !triangle.includes(index) &&
        turn(a, b, points[index]) * winding >= -.000000001 &&
        turn(b, c, points[index]) * winding >= -.000000001 &&
        turn(c, a, points[index]) * winding >= -.000000001);
      if (occupied) continue;
      triangles.push(triangle);
      remaining.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) throw new Error("Invalid ball outline: cannot triangulate");
  }
  triangles.push(remaining);
  return triangles.map(indices => ({ indices, externalEdges: indices.map((index, i) => {
    const next = indices[(i + 1) % 3], distance = Math.abs(index - next);
    return distance === 1 || distance === points.length - 1;
  }) }));
}

const pieces = Object.fromEntries(Object.entries(outlines).map(([shape, outline]) => [shape, triangulate(outline)]));
export function getBallOutline(ball) {
  const c = Math.cos(ball.angle), s = Math.sin(ball.angle);
  return (outlines[ball.shape] ?? []).map(p => ({
    x: ball.x + (c * p.x - s * p.y) * ball.radius,
    y: ball.y + (s * p.x + c * p.y) * ball.radius,
  }));
}

export function getBallConvexPieces(ball) {
  const outline = getBallOutline(ball);
  return (pieces[ball.shape] ?? []).map(piece => ({
    points: piece.indices.map(index => outline[index]), externalEdges: piece.externalEdges,
  }));
}
