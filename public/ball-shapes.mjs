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
