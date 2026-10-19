(() => {
  const message = document.getElementById("message");
  const lines = Array.from(document.querySelectorAll(".message-line"));
  const dots = document.querySelectorAll(".dots");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const holdDuration = 2400;
  const transitionDuration = 650;
  const dotInterval = 550 / 1.5;
  let dotsTimer;
  let messageTimer;
  let transitionTimer;
  let index = 0;
  let dotCount = 1;

  function setDots(value) {
    dots.forEach((element) => { element.textContent = value; });
  }

  function settleMessage() {
    lines.forEach((line, lineIndex) => {
      line.className = lineIndex === index ? "message-line is-current" : "message-line";
    });
    message.textContent = lines[index].querySelector(".message-text").textContent;
  }

  function nextMessage() {
    const previous = index;
    index = (index + 1) % lines.length;
    lines[previous].className = "message-line is-leaving";
    lines[index].className = "message-line is-entering";
    message.textContent = lines[index].querySelector(".message-text").textContent;
    transitionTimer = window.setTimeout(() => {
      settleMessage();
      messageTimer = window.setTimeout(nextMessage, holdDuration);
    }, transitionDuration);
  }

  function updateMotion() {
    window.clearInterval(dotsTimer);
    window.clearTimeout(messageTimer);
    window.clearTimeout(transitionTimer);
    settleMessage();
    const paused = reducedMotion.matches;
    document.documentElement.dataset.motion = paused ? "paused" : "playing";
    if (paused) {
      setDots("...");
      return;
    }
    dotCount = 1;
    setDots(".");
    dotsTimer = window.setInterval(() => {
      dotCount = (dotCount % 3) + 1;
      setDots(".".repeat(dotCount));
    }, dotInterval);
    messageTimer = window.setTimeout(nextMessage, holdDuration);
  }

  reducedMotion.addEventListener("change", updateMotion);
  updateMotion();
})();
