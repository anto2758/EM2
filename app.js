const COLORS = {
  yellow: "#e6be55",
  green: "#76a98a",
  blue: "#7197bd",
  red: "#d98272",
};

const SHAPES = ["circle", "square", "triangle", "diamond"];
const COLOR_NAMES = Object.keys(COLORS);
const EVIDENCE_RATES = [80, 70, 50, 30, 20];

const state = {
  screen: "setup",
  condition: null,
  antecedent: "yellow",
  consequent: "green",
  calibrationSequence: [],
  round: 0,
  ratings: [],
  pendingConfidence: 70,
  completedSequence: false,
  startedAt: new Date().toISOString(),
};

const app = document.querySelector("#app");
let playbackTimer = null;

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, random) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function makeStimulus(color, random) {
  return { color, shape: SHAPES[Math.floor(random() * SHAPES.length)] };
}

function buildSequence(successes, seed, antecedent = "yellow", consequent = "green") {
  const random = seededRandom(seed);
  const outcomes = shuffled(
    Array.from({ length: 10 }, (_, index) => index < successes),
    random,
  );
  const alternatives = COLOR_NAMES.filter((color) => color !== consequent && color !== antecedent);
  const sequence = [];

  outcomes.forEach((success, index) => {
    if (index > 0) {
      const fillers = COLOR_NAMES.filter((color) => color !== antecedent);
      sequence.push(makeStimulus(fillers[Math.floor(random() * fillers.length)], random));
    }
    sequence.push(makeStimulus(antecedent, random));
    const nextColor = success
      ? consequent
      : alternatives[Math.floor(random() * alternatives.length)];
    sequence.push(makeStimulus(nextColor, random));
  });

  return sequence;
}

state.calibrationSequence = buildSequence(8, 1197);

function icon(type) {
  const icons = {
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m4 16.5-.7 4.2 4.2-.7L18.8 8.7a2.2 2.2 0 0 0 0-3.1l-.4-.4a2.2 2.2 0 0 0-3.1 0L4 16.5Z"/><path d="m13.8 6.7 3.5 3.5"/></svg>',
    receive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 4.5h14v15H5z"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/></svg>',
  };
  return icons[type];
}

function button(label, { id, primary = false, disabled = false } = {}) {
  return `<span class="button-wrap"><button class="button${primary ? " primary" : ""}"${id ? ` id="${id}"` : ""}${disabled ? " disabled" : ""}>${label}</button></span>`;
}

function progressFor(screen) {
  const values = { setup: 0, intro: 8, calibration: 20, hypothesis: 36, review: 48, confidence: 58, evidence: 58 + state.round * 7, results: 100 };
  return values[screen] ?? 0;
}

function shell(content, wide = false) {
  const canReset = state.screen !== "setup";
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="wordmark">EM2</div>
        <div class="study-pill">Belief updating study</div>
        ${canReset ? '<button class="reset-link" id="reset">Exit demo</button>' : '<span></span>'}
      </header>
      <section class="stage${wide ? " wide" : ""}">${content}<div class="progress-track"><div class="progress-fill" style="width:${progressFor(state.screen)}%"></div></div></section>
    </div>`;
  document.querySelector("#reset")?.addEventListener("click", reset);
}

function render() {
  window.clearInterval(playbackTimer);
  playbackTimer = null;
  const screens = { setup: renderSetup, intro: renderIntro, calibration: renderCalibration, hypothesis: renderHypothesis, review: renderReview, confidence: renderConfidence, evidence: renderEvidence, results: renderResults };
  screens[state.screen]();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderSetup() {
  shell(`
    <p class="eyebrow">Interactive prototype</p>
    <h1>Choose a participant condition</h1>
    <p class="lede">This demo lets you walk through either side of a yoked pair. Both conditions receive the same calibration sequence and the same subsequent evidence.</p>
    <div class="option-list">
      <button class="option-card${state.condition === "generated" ? " selected" : ""}" data-condition="generated" aria-pressed="${state.condition === "generated"}">
        <span class="option-icon">${icon("pencil")}</span>
        <span class="option-copy"><span class="option-title">Self-generated belief</span><span class="option-description">Discover and formulate a regularity in the sequence.</span></span>
      </button>
      <button class="option-card${state.condition === "provided" ? " selected" : ""}" data-condition="provided" aria-pressed="${state.condition === "provided"}">
        <span class="option-icon">${icon("receive")}</span>
        <span class="option-copy"><span class="option-title">Provided belief</span><span class="option-description">Evaluate a regularity supplied by the matched participant.</span></span>
      </button>
    </div>
    <div class="note">Demo mode exposes the condition selector. In a study deployment, condition and pair assignment would happen before this screen.</div>
    <div class="actions">${button("Begin", { id: "begin", primary: true, disabled: !state.condition })}</div>
  `);
  document.querySelectorAll("[data-condition]").forEach((element) => element.addEventListener("click", () => {
    state.condition = element.dataset.condition;
    renderSetup();
  }));
  document.querySelector("#begin")?.addEventListener("click", () => { state.screen = "intro"; render(); });
}

function renderIntro() {
  shell(`
    <p class="eyebrow">Before you begin</p>
    <h1>Look for patterns in what follows</h1>
    <p class="lede">You will see a sequence of colored geometric shapes, one at a time. There may be regularities in which colors or shapes tend to follow one another.</p>
    <div class="belief-card">
      <span class="belief-label">Important</span>
      <p class="belief-text">Any pattern may be probabilistic. It does not need to hold every time to be meaningful.</p>
    </div>
    <div class="actions">${button("I understand", { id: "understand", primary: true })}</div>
  `);
  document.querySelector("#understand").addEventListener("click", () => { state.screen = "calibration"; state.completedSequence = false; render(); });
}

function shapeMarkup(stimulus) {
  if (!stimulus) return '<div aria-hidden="true"></div>';
  const style = stimulus.shape === "triangle" ? `color:${COLORS[stimulus.color]}` : `background:${COLORS[stimulus.color]}`;
  return `<div class="shape ${stimulus.shape}" style="${style}" role="img" aria-label="${stimulus.color} ${stimulus.shape}"></div>`;
}

function playerMarkup(total, label) {
  return `
    <div class="stimulus-card">
      <div class="stimulus-meta"><span>${label}</span><span id="stimulus-count">Ready</span></div>
      <div class="stimulus-area" id="stimulus-area"><span style="color:#aaa;font-size:12px">Press start when you are ready</span></div>
      <div class="sequence-dots" id="sequence-dots">${Array.from({ length: Math.min(total, 12) }, (_, index) => `<i class="sequence-dot${index === 0 ? " active" : ""}"></i>`).join("")}</div>
    </div>`;
}

function playSequence(sequence, onComplete) {
  const area = document.querySelector("#stimulus-area");
  const count = document.querySelector("#stimulus-count");
  const dots = [...document.querySelectorAll(".sequence-dot")];
  let index = 0;
  const show = () => {
    area.innerHTML = shapeMarkup(sequence[index]);
    count.textContent = `${index + 1} of ${sequence.length}`;
    const dotIndex = Math.min(dots.length - 1, Math.floor((index / sequence.length) * dots.length));
    dots.forEach((dot, position) => dot.classList.toggle("active", position === dotIndex));
    index += 1;
    if (index >= sequence.length) {
      window.clearInterval(playbackTimer);
      playbackTimer = window.setTimeout(() => {
        area.innerHTML = '<span style="color:#777;font-size:12px">Sequence complete</span>';
        count.textContent = "Complete";
        onComplete();
      }, 450);
    }
  };
  show();
  playbackTimer = window.setInterval(show, 430);
}

function renderCalibration() {
  shell(`
    <p class="eyebrow">Calibration sequence</p>
    <h1>Watch closely</h1>
    <p class="lede">Try to notice a simple relationship between consecutive colors or shapes. The sequence takes about twelve seconds.</p>
    ${playerMarkup(state.calibrationSequence.length, "Observation 1")}
    <div class="actions" id="sequence-actions">${button("Start sequence", { id: "start-sequence", primary: true })}</div>
  `, true);
  document.querySelector("#start-sequence").addEventListener("click", () => {
    document.querySelector("#sequence-actions").innerHTML = button("Playing…", { disabled: true });
    playSequence(state.calibrationSequence, () => {
      state.completedSequence = true;
      document.querySelector("#sequence-actions").innerHTML = button("Continue", { id: "continue-sequence", primary: true });
      document.querySelector("#continue-sequence").addEventListener("click", () => { state.screen = "hypothesis"; render(); });
    });
  });
}

function colorOptions(selected) {
  return COLOR_NAMES.map((color) => `<option value="${color}"${color === selected ? " selected" : ""}>${color[0].toUpperCase() + color.slice(1)}</option>`).join("");
}

function hypothesisText() {
  return `When a ${state.antecedent} shape appears, a ${state.consequent} shape tends to appear next.`;
}

function renderHypothesis() {
  if (state.condition === "provided") {
    state.antecedent = "yellow";
    state.consequent = "green";
    shell(`
      <p class="eyebrow">A possible regularity</p>
      <h1>Consider this hypothesis</h1>
      <p class="lede">A participant who viewed the same calibration sequence proposed the following pattern.</p>
      <div class="belief-card"><span class="belief-label">Provided hypothesis</span><p class="belief-text">${hypothesisText()}</p></div>
      <div class="actions">${button("Continue", { id: "accept-hypothesis", primary: true })}</div>
    `);
    document.querySelector("#accept-hypothesis").addEventListener("click", () => { state.screen = "review"; render(); });
    return;
  }

  shell(`
    <p class="eyebrow">Your observation</p>
    <h1>Which pattern did you notice?</h1>
    <p class="lede">Use the sentence below to record one simple color relationship. Choose the pattern that seemed most convincing to you.</p>
    <div class="form-card">
      <label class="field-label">Your hypothesis</label>
      <div class="hypothesis-builder">
        <span>When a</span><select class="select" id="antecedent">${colorOptions(state.antecedent)}</select><span>shape appears, a</span><select class="select" id="consequent">${colorOptions(state.consequent)}</select><span>shape tends to appear next.</span>
      </div>
    </div>
    <div class="actions">${button("Save hypothesis", { id: "save-hypothesis", primary: true })}</div>
  `);
  document.querySelector("#antecedent").addEventListener("change", (event) => { state.antecedent = event.target.value; });
  document.querySelector("#consequent").addEventListener("change", (event) => { state.consequent = event.target.value; });
  document.querySelector("#save-hypothesis").addEventListener("click", () => {
    if (state.antecedent === state.consequent) {
      document.querySelector(".form-card").insertAdjacentHTML("beforeend", '<p style="margin:14px 0 0;color:#a55d55;font-size:11px">Choose two different colors.</p>');
      return;
    }
    state.screen = "review";
    render();
  });
}

function diagnosticPairs(sequence) {
  const pairs = [];
  for (let index = 0; index < sequence.length - 1; index += 1) {
    if (sequence[index].color === state.antecedent) pairs.push([sequence[index], sequence[index + 1]]);
  }
  return pairs.slice(0, 10);
}

function miniShape(item) {
  return `<i class="mini-shape ${item.shape}" style="background:${COLORS[item.color]}"></i>`;
}

function renderReview() {
  const sequence = buildSequence(8, 1197, state.antecedent, state.consequent);
  const pairs = diagnosticPairs(sequence);
  shell(`
    <p class="eyebrow">Standardized review</p>
    <h1>Review the evidence for the hypothesis</h1>
    <p class="lede">Both members of the yoked pair receive this same review. Each tile shows an occurrence of the first color and the color that immediately followed it.</p>
    <div class="belief-card"><span class="belief-label">Current hypothesis</span><p class="belief-text">${hypothesisText()}</p></div>
    <div class="review-grid">${pairs.map(([first, second]) => `<div class="review-pair${second.color === state.consequent ? " hit" : ""}">${miniShape(first)}<span class="arrow">→</span>${miniShape(second)}</div>`).join("")}</div>
    <div class="actions">${button("Rate my confidence", { id: "rate", primary: true })}</div>
  `, true);
  document.querySelector("#rate").addEventListener("click", () => { state.screen = "confidence"; state.pendingConfidence = 70; render(); });
}

function confidenceControl() {
  return `
    <div class="confidence-card">
      <div class="confidence-value"><output id="confidence-output">${state.pendingConfidence}</output><span>/ 100</span></div>
      <input class="range" id="confidence-range" type="range" min="0" max="100" step="1" value="${state.pendingConfidence}" aria-label="Confidence from 0 to 100" />
      <div class="range-labels"><span>Certain it does not</span><span>Unsure</span><span>Certain it does</span></div>
    </div>`;
}

function bindConfidence() {
  const range = document.querySelector("#confidence-range");
  range.addEventListener("input", () => {
    state.pendingConfidence = Number(range.value);
    document.querySelector("#confidence-output").value = state.pendingConfidence;
  });
}

function renderConfidence() {
  shell(`
    <p class="eyebrow">Confidence rating</p>
    <h1>How confident are you in this regularity?</h1>
    <p class="lede">How confident are you that this pattern genuinely describes the process generating the sequence?</p>
    <div class="belief-card"><span class="belief-label">Your hypothesis</span><p class="belief-text">${hypothesisText()}</p></div>
    ${confidenceControl()}
    <div class="actions">${button("Submit rating", { id: "submit-rating", primary: true })}</div>
  `);
  bindConfidence();
  document.querySelector("#submit-rating").addEventListener("click", () => {
    state.ratings = [state.pendingConfidence];
    state.round = 0;
    state.screen = "evidence";
    state.completedSequence = false;
    render();
  });
}

function renderEvidence() {
  if (state.round >= EVIDENCE_RATES.length) {
    state.screen = "results";
    render();
    return;
  }
  const rate = EVIDENCE_RATES[state.round];
  const sequence = buildSequence(rate / 10, 2400 + state.round * 73, state.antecedent, state.consequent);
  shell(`
    <span class="round-badge">Evidence block ${state.round + 1} of ${EVIDENCE_RATES.length}</span>
    <h1>Continue observing</h1>
    <p class="lede">Watch the new sequence, keeping your current hypothesis in mind. The underlying probabilities are not shown during the study.</p>
    ${playerMarkup(sequence.length, `New evidence ${state.round + 1}`)}
    <div id="rating-slot"></div>
    <div class="actions" id="sequence-actions">${button("Play evidence", { id: "play-evidence", primary: true })}</div>
  `, true);
  document.querySelector("#play-evidence").addEventListener("click", () => {
    document.querySelector("#sequence-actions").innerHTML = button("Playing…", { disabled: true });
    playSequence(sequence, () => {
      state.pendingConfidence = state.ratings.at(-1);
      document.querySelector("#rating-slot").innerHTML = `
        <div class="form-card"><label class="field-label">Update your confidence</label>${confidenceControl()}</div>`;
      bindConfidence();
      document.querySelector("#sequence-actions").innerHTML = button(state.round === EVIDENCE_RATES.length - 1 ? "Finish" : "Submit and continue", { id: "next-round", primary: true });
      document.querySelector("#next-round").addEventListener("click", () => {
        state.ratings.push(state.pendingConfidence);
        state.round += 1;
        renderEvidence();
      });
    });
  });
}

function chartMarkup() {
  const evidence = [80, ...EVIDENCE_RATES];
  const ratings = state.ratings;
  const width = 620;
  const height = 260;
  const pad = { left: 34, right: 16, top: 20, bottom: 34 };
  const x = (index) => pad.left + (index / (ratings.length - 1)) * (width - pad.left - pad.right);
  const y = (value) => pad.top + ((100 - value) / 100) * (height - pad.top - pad.bottom);
  const points = (values) => values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  return `
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Confidence and evidence across study stages">
      ${[0,25,50,75,100].map((value) => `<line class="chart-grid" x1="${pad.left}" x2="${width-pad.right}" y1="${y(value)}" y2="${y(value)}"/><text class="chart-axis" x="3" y="${y(value)+3}">${value}</text>`).join("")}
      <polyline class="chart-evidence" points="${points(evidence)}" />
      <polyline class="chart-confidence" points="${points(ratings)}" />
      ${ratings.map((value,index) => `<circle class="chart-point" cx="${x(index)}" cy="${y(value)}" r="4"/>`).join("")}
      ${ratings.map((_,index) => `<text class="chart-axis" text-anchor="middle" x="${x(index)}" y="${height-8}">${index === 0 ? "Initial" : `Block ${index}`}</text>`).join("")}
    </svg>
    <div class="legend"><span><i></i>Your confidence</span><span class="evidence"><i></i>Observed success rate</span></div>`;
}

function renderResults() {
  const change = state.ratings.at(-1) - state.ratings[0];
  shell(`
    <p class="eyebrow">Demo complete</p>
    <h1>Your belief-updating trajectory</h1>
    <p class="lede">This participant-facing summary is useful for the prototype. A production study can instead show a neutral completion screen while storing the same measurements privately.</p>
    <div class="chart-card">${chartMarkup()}</div>
    <div class="summary-row">
      <div class="summary-item"><div class="summary-value">${state.ratings[0]}</div><div class="summary-label">Initial confidence</div></div>
      <div class="summary-item"><div class="summary-value">${state.ratings.at(-1)}</div><div class="summary-label">Final confidence</div></div>
      <div class="summary-item"><div class="summary-value">${change > 0 ? "+" : ""}${change}</div><div class="summary-label">Total change</div></div>
    </div>
    <div class="actions">${button("Try other condition", { id: "restart" })}${button("Download session data", { id: "download", primary: true })}</div>
  `, true);
  document.querySelector("#restart").addEventListener("click", reset);
  document.querySelector("#download").addEventListener("click", downloadData);
}

function downloadData() {
  const payload = {
    version: "prototype-1",
    condition: state.condition,
    hypothesis: { antecedent: state.antecedent, consequent: state.consequent, text: hypothesisText() },
    ratings: state.ratings.map((confidence, index) => ({ stage: index === 0 ? "initial" : `evidence-${index}`, confidence })),
    diagnosticSuccessRates: [80, ...EVIDENCE_RATES],
    startedAt: state.startedAt,
    completedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `em2-demo-${state.condition}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function reset() {
  window.clearInterval(playbackTimer);
  Object.assign(state, {
    screen: "setup",
    condition: null,
    antecedent: "yellow",
    consequent: "green",
    round: 0,
    ratings: [],
    pendingConfidence: 70,
    completedSequence: false,
    startedAt: new Date().toISOString(),
  });
  render();
}

render();
