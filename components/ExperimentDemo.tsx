"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const COLORS = {
  yellow: "#e6be55",
  green: "#76a98a",
  blue: "#7197bd",
  red: "#d98272",
} as const;

const SHAPES = ["circle", "square", "triangle", "diamond"] as const;
const COLOR_NAMES = Object.keys(COLORS) as ColorName[];
const EVIDENCE_RATES = [80, 70, 50, 30, 20] as const;
const STIMULUS_INTERVAL_MS = 1400;

type ColorName = keyof typeof COLORS;
type ShapeName = (typeof SHAPES)[number];
type Condition = "generated" | "provided";
type Screen = "setup" | "intro" | "calibration" | "hypothesis" | "review" | "confidence" | "evidence" | "results";
type Stimulus = { color: ColorName; shape: ShapeName };
type IconName = "pencil" | "receive";

const DEFAULT_ANTECEDENT: Stimulus = { color: "yellow", shape: "circle" };
const DEFAULT_CONSEQUENT: Stimulus = { color: "green", shape: "triangle" };
const CALIBRATION_PATTERNS: Array<{
  antecedent: Stimulus;
  consequent: Stimulus;
  successes: number;
}> = [
  { antecedent: DEFAULT_ANTECEDENT, consequent: DEFAULT_CONSEQUENT, successes: 5 },
  { antecedent: { color: "red", shape: "square" }, consequent: { color: "blue", shape: "diamond" }, successes: 5 },
  { antecedent: { color: "green", shape: "diamond" }, consequent: { color: "yellow", shape: "square" }, successes: 4 },
];

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(values: T[], random: () => number) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function makeStimulus(color: ColorName, random: () => number): Stimulus {
  return { color, shape: SHAPES[Math.floor(random() * SHAPES.length)] };
}

function sameStimulus(left: Stimulus, right: Stimulus) {
  return left.color === right.color && left.shape === right.shape;
}

function randomStimulus(random: () => number, excluded: Stimulus[] = []): Stimulus {
  let candidate: Stimulus;
  do {
    candidate = makeStimulus(COLOR_NAMES[Math.floor(random() * COLOR_NAMES.length)], random);
  } while (excluded.some((item) => sameStimulus(item, candidate)));
  return candidate;
}

function buildSequence(
  successes: number,
  seed: number,
  antecedent: Stimulus = DEFAULT_ANTECEDENT,
  consequent: Stimulus = DEFAULT_CONSEQUENT,
) {
  const random = seededRandom(seed);
  const outcomes = shuffled(Array.from({ length: 10 }, (_, index) => index < successes), random);
  const sequence: Stimulus[] = [];

  outcomes.forEach((success, index) => {
    if (index > 0) {
      sequence.push(randomStimulus(random, [antecedent]));
    }
    sequence.push({ ...antecedent });
    sequence.push(success ? { ...consequent } : randomStimulus(random, [antecedent, consequent]));
  });

  return sequence;
}

function buildCalibrationSequence() {
  const random = seededRandom(1197);
  const trials = CALIBRATION_PATTERNS.flatMap((pattern) =>
    shuffled(
      Array.from({ length: 6 }, (_, index) => ({ pattern, success: index < pattern.successes })),
      random,
    ),
  );
  const sequence: Stimulus[] = [];
  const antecedents = CALIBRATION_PATTERNS.map((pattern) => pattern.antecedent);

  shuffled(trials, random).forEach(({ pattern, success }, index) => {
    if (index > 0) sequence.push(randomStimulus(random, antecedents));
    sequence.push({ ...pattern.antecedent });
    sequence.push(success ? { ...pattern.consequent } : randomStimulus(random, [...antecedents, pattern.consequent]));
  });

  return sequence;
}

function Icon({ name }: { name: IconName }) {
  if (name === "pencil") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="m4 16.5-.7 4.2 4.2-.7L18.8 8.7a2.2 2.2 0 0 0 0-3.1l-.4-.4a2.2 2.2 0 0 0-3.1 0L4 16.5Z" />
        <path d="m13.8 6.7 3.5 3.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M5 4.5h14v15H5z" />
      <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" />
    </svg>
  );
}

function StrokeButton({ children, onClick, primary = false, disabled = false }: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <span className="stroke-wrap">
      <button className={`button${primary ? " primary" : ""}`} onClick={onClick} disabled={disabled} type="button">
        {children}
      </button>
    </span>
  );
}

function Shape({ stimulus, mini = false }: { stimulus: Stimulus; mini?: boolean }) {
  const style = stimulus.shape === "triangle" && !mini
    ? { color: COLORS[stimulus.color] }
    : { background: COLORS[stimulus.color] };
  return (
    <span
      className={`${mini ? "mini-shape" : "shape"} ${stimulus.shape}`}
      style={style}
      role={mini ? undefined : "img"}
      aria-label={mini ? undefined : `${stimulus.color} ${stimulus.shape}`}
    />
  );
}

function SequencePlayer({ sequence, label, onComplete }: { sequence: Stimulus[]; label: string; onComplete: () => void }) {
  const [index, setIndex] = useState<number | null>(null);
  const completeRef = useRef(onComplete);

  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    if (index === null) return;
    if (index >= sequence.length) {
      const timeout = window.setTimeout(() => completeRef.current(), 450);
      return () => window.clearTimeout(timeout);
    }
    const timeout = window.setTimeout(() => setIndex((current) => (current ?? 0) + 1), STIMULUS_INTERVAL_MS);
    return () => window.clearTimeout(timeout);
  }, [index, sequence.length]);

  const started = index !== null;
  const complete = started && index >= sequence.length;
  const dotIndex = started ? Math.min(11, Math.floor(((index ?? 0) / sequence.length) * 12)) : 0;

  return (
    <>
      <div className="stimulus-card graphite-onboarding-stroke mini-soft-shadow">
        <div className="stimulus-meta">
          <span>{label}</span>
          <span>{complete ? "Complete" : started ? `${Math.min((index ?? 0) + 1, sequence.length)} of ${sequence.length}` : "Ready"}</span>
        </div>
        <div className="stimulus-area">
          {!started && <span className="player-message">Press start when you are ready</span>}
          {started && !complete && <Shape stimulus={sequence[index ?? 0]} />}
          {complete && <span className="player-message">Sequence complete</span>}
        </div>
        <div className="sequence-dots" aria-hidden="true">
          {Array.from({ length: 12 }, (_, position) => <i className={`sequence-dot${position === dotIndex ? " active" : ""}`} key={position} />)}
        </div>
      </div>
      <div className="actions">
        {!started && <StrokeButton primary onClick={() => setIndex(0)}>Start sequence</StrokeButton>}
        {started && !complete && <StrokeButton disabled>Playing…</StrokeButton>}
      </div>
    </>
  );
}

function ConfidenceControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="confidence-card">
      <div className="confidence-value"><output>{value}</output><span>/ 100</span></div>
      <input
        className="range"
        type="range"
        min="0"
        max="100"
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Confidence from 0 to 100"
      />
      <div className="range-labels"><span>Certain it does not</span><span>Unsure</span><span>Certain it does</span></div>
    </div>
  );
}

function Chart({ ratings }: { ratings: number[] }) {
  const evidence = [80, ...EVIDENCE_RATES];
  const width = 620;
  const height = 260;
  const pad = { left: 34, right: 16, top: 20, bottom: 34 };
  const x = (index: number) => pad.left + (index / (ratings.length - 1)) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + ((100 - value) / 100) * (height - pad.top - pad.bottom);
  const points = (values: readonly number[]) => values.map((value, index) => `${x(index)},${y(value)}`).join(" ");

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Confidence and evidence across study stages">
        {[0, 25, 50, 75, 100].map((value) => (
          <g key={value}>
            <line className="chart-grid" x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} />
            <text className="chart-axis" x="3" y={y(value) + 3}>{value}</text>
          </g>
        ))}
        <polyline className="chart-evidence" points={points(evidence)} />
        <polyline className="chart-confidence" points={points(ratings)} />
        {ratings.map((value, index) => <circle className="chart-point" cx={x(index)} cy={y(value)} r="4" key={`point-${index}`} />)}
        {ratings.map((_, index) => (
          <text className="chart-axis" textAnchor="middle" x={x(index)} y={height - 8} key={`label-${index}`}>
            {index === 0 ? "Initial" : `Block ${index}`}
          </text>
        ))}
      </svg>
      <div className="legend"><span><i />Your confidence</span><span className="evidence"><i />Observed success rate</span></div>
    </>
  );
}

function progressFor(screen: Screen, round: number) {
  const values: Record<Screen, number> = {
    setup: 0,
    intro: 8,
    calibration: 20,
    hypothesis: 36,
    review: 48,
    confidence: 58,
    evidence: 58 + round * 7,
    results: 100,
  };
  return values[screen];
}

export function ExperimentDemo() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [condition, setCondition] = useState<Condition | null>(null);
  const [antecedent, setAntecedent] = useState<ColorName>("yellow");
  const [antecedentShape, setAntecedentShape] = useState<ShapeName>("circle");
  const [consequent, setConsequent] = useState<ColorName>("green");
  const [consequentShape, setConsequentShape] = useState<ShapeName>("triangle");
  const [round, setRound] = useState(0);
  const [ratings, setRatings] = useState<number[]>([]);
  const [confidence, setConfidence] = useState(70);
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [sequenceComplete, setSequenceComplete] = useState(false);
  const calibrationSequence = useMemo(() => buildCalibrationSequence(), []);
  const antecedentStimulus = useMemo(() => ({ color: antecedent, shape: antecedentShape }), [antecedent, antecedentShape]);
  const consequentStimulus = useMemo(() => ({ color: consequent, shape: consequentShape }), [consequent, consequentShape]);
  const hypothesis = `After a ${antecedent} ${antecedentShape}, a ${consequent} ${consequentShape} tends to follow.`;

  const reset = useCallback(() => {
    setScreen("setup");
    setCondition(null);
    setAntecedent("yellow");
    setAntecedentShape("circle");
    setConsequent("green");
    setConsequentShape("triangle");
    setRound(0);
    setRatings([]);
    setConfidence(70);
    setStartedAt(new Date().toISOString());
    setSequenceComplete(false);
  }, []);

  const downloadData = useCallback(() => {
    const payload = {
      version: "prototype-3-compound-patterns",
      condition,
      hypothesis: { antecedent: antecedentStimulus, consequent: consequentStimulus, text: hypothesis },
      ratings: ratings.map((rating, index) => ({ stage: index === 0 ? "initial" : `evidence-${index}`, confidence: rating })),
      diagnosticSuccessRates: [80, ...EVIDENCE_RATES],
      startedAt,
      completedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `em2-demo-${condition}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [antecedentStimulus, condition, consequentStimulus, hypothesis, ratings, startedAt]);

  const diagnosticPairs = useMemo(() => {
    const sequence = buildSequence(8, 1197, antecedentStimulus, consequentStimulus);
    const pairs: [Stimulus, Stimulus][] = [];
    for (let index = 0; index < sequence.length - 1; index += 1) {
      if (sameStimulus(sequence[index], antecedentStimulus)) pairs.push([sequence[index], sequence[index + 1]]);
    }
    return pairs.slice(0, 10);
  }, [antecedentStimulus, consequentStimulus]);

  const evidenceSequence = useMemo(() => {
    if (round >= EVIDENCE_RATES.length) return [];
    return buildSequence(EVIDENCE_RATES[round] / 10, 2400 + round * 73, antecedentStimulus, consequentStimulus);
  }, [antecedentStimulus, consequentStimulus, round]);

  const submitEvidenceRating = () => {
    setRatings((current) => [...current, confidence]);
    setSequenceComplete(false);
    if (round === EVIDENCE_RATES.length - 1) setScreen("results");
    else setRound((current) => current + 1);
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="wordmark">EM2</div>
        <div className="study-pill">Belief updating study</div>
        {screen !== "setup" ? <button className="reset-link" onClick={reset}>Exit demo</button> : <span />}
      </header>

      <section className={`stage${["calibration", "hypothesis", "review", "evidence", "results"].includes(screen) ? " wide" : ""}`} key={`${screen}-${round}`}>
        {screen === "setup" && (
          <>
            <p className="eyebrow">Interactive prototype</p>
            <h1>Choose a condition</h1>
            <p className="lede">Both conditions see the same evidence.</p>
            <div className="option-list">
              {([
                ["generated", "pencil", "Self-generated", "Find and describe a pattern."],
                ["provided", "receive", "Provided", "Evaluate a matched pattern."],
              ] as const).map(([value, iconName, title, description]) => (
                <button
                  className={`option-card graphite-onboarding-stroke mini-soft-shadow${condition === value ? " selected" : ""}`}
                  onClick={() => setCondition(value)}
                  aria-pressed={condition === value}
                  type="button"
                  key={value}
                >
                  <span className="option-icon"><Icon name={iconName} /></span>
                  <span className="option-copy"><span className="option-title">{title}</span><span className="option-description">{description}</span></span>
                </button>
              ))}
            </div>
            <div className="note">Condition assignment is visible in demo mode.</div>
            <div className="actions"><StrokeButton primary disabled={!condition} onClick={() => setScreen("intro")}>Begin</StrokeButton></div>
          </>
        )}

        {screen === "intro" && (
          <>
            <p className="eyebrow">Before you begin</p>
            <h1>Find a pattern</h1>
            <p className="lede">Watch both color and shape. Look for combinations that predict what comes next.</p>
            <div className="belief-card graphite-onboarding-stroke mini-soft-shadow"><span className="belief-label">Remember</span><p className="belief-text">Patterns do not need to hold every time.</p></div>
            <div className="actions"><StrokeButton primary onClick={() => setScreen("calibration")}>I understand</StrokeButton></div>
          </>
        )}

        {screen === "calibration" && (
          <>
            <p className="eyebrow">Calibration sequence</p>
            <h1>Watch closely</h1>
            <p className="lede">Each object stays visible long enough to inspect both features. The sequence takes about a minute.</p>
            <SequencePlayer sequence={calibrationSequence} label="Observation 1" onComplete={() => setSequenceComplete(true)} />
            {sequenceComplete && <div className="actions continuation"><StrokeButton primary onClick={() => { setSequenceComplete(false); setScreen("hypothesis"); }}>Continue</StrokeButton></div>}
          </>
        )}

        {screen === "hypothesis" && condition === "provided" && (
          <>
            <p className="eyebrow">A possible regularity</p>
            <h1>Consider this pattern</h1>
            <p className="lede">Proposed by the matched participant.</p>
            <div className="belief-card graphite-onboarding-stroke mini-soft-shadow"><span className="belief-label">Provided hypothesis</span><p className="belief-text">{hypothesis}</p></div>
            <div className="actions"><StrokeButton primary onClick={() => setScreen("review")}>Continue</StrokeButton></div>
          </>
        )}

        {screen === "hypothesis" && condition === "generated" && (
          <>
            <p className="eyebrow">Your observation</p>
            <h1>What did you notice?</h1>
            <p className="lede">Build one rule using both color and shape.</p>
            <div className="form-card graphite-onboarding-stroke mini-soft-shadow">
              <label className="field-label">Your hypothesis</label>
              <div className="hypothesis-builder">
                <span>After a</span>
                <select className="select" value={antecedent} onChange={(event) => setAntecedent(event.target.value as ColorName)}>
                  {COLOR_NAMES.map((color) => <option value={color} key={color}>{color[0].toUpperCase() + color.slice(1)}</option>)}
                </select>
                <select className="select" value={antecedentShape} onChange={(event) => setAntecedentShape(event.target.value as ShapeName)}>
                  {SHAPES.map((shape) => <option value={shape} key={shape}>{shape[0].toUpperCase() + shape.slice(1)}</option>)}
                </select>
                <span>, a</span>
                <select className="select" value={consequent} onChange={(event) => setConsequent(event.target.value as ColorName)}>
                  {COLOR_NAMES.map((color) => <option value={color} key={color}>{color[0].toUpperCase() + color.slice(1)}</option>)}
                </select>
                <select className="select" value={consequentShape} onChange={(event) => setConsequentShape(event.target.value as ShapeName)}>
                  {SHAPES.map((shape) => <option value={shape} key={shape}>{shape[0].toUpperCase() + shape.slice(1)}</option>)}
                </select>
                <span>tends to follow.</span>
              </div>
              {sameStimulus(antecedentStimulus, consequentStimulus) && <p className="form-error">Choose two different objects.</p>}
            </div>
            <div className="actions"><StrokeButton primary disabled={sameStimulus(antecedentStimulus, consequentStimulus)} onClick={() => setScreen("review")}>Save pattern</StrokeButton></div>
          </>
        )}

        {screen === "review" && (
          <>
            <p className="eyebrow">Standardized review</p>
            <h1>Check the pattern</h1>
            <p className="lede">The matched pair receives the same review.</p>
            <div className="belief-card graphite-onboarding-stroke mini-soft-shadow"><span className="belief-label">Current hypothesis</span><p className="belief-text">{hypothesis}</p></div>
            <div className="review-grid">
              {diagnosticPairs.map(([first, second], index) => (
                <div className={`review-pair${sameStimulus(second, consequentStimulus) ? " hit" : ""}`} key={index}>
                  <Shape stimulus={first} mini /><span className="arrow">→</span><Shape stimulus={second} mini />
                </div>
              ))}
            </div>
            <div className="actions"><StrokeButton primary onClick={() => { setConfidence(70); setScreen("confidence"); }}>Rate my confidence</StrokeButton></div>
          </>
        )}

        {screen === "confidence" && (
          <>
            <p className="eyebrow">Confidence rating</p>
            <h1>How confident are you?</h1>
            <p className="lede">Does this pattern describe the sequence?</p>
            <div className="belief-card graphite-onboarding-stroke mini-soft-shadow"><span className="belief-label">Your hypothesis</span><p className="belief-text">{hypothesis}</p></div>
            <ConfidenceControl value={confidence} onChange={setConfidence} />
            <div className="actions"><StrokeButton primary onClick={() => { setRatings([confidence]); setRound(0); setSequenceComplete(false); setScreen("evidence"); }}>Submit rating</StrokeButton></div>
          </>
        )}

        {screen === "evidence" && (
          <>
            <span className="round-badge">Evidence block {round + 1} of {EVIDENCE_RATES.length}</span>
            <h1>Watch again</h1>
            <p className="lede">Keep your pattern in mind.</p>
            <SequencePlayer sequence={evidenceSequence} label={`New evidence ${round + 1}`} onComplete={() => { setConfidence(ratings.at(-1) ?? 70); setSequenceComplete(true); }} />
            {sequenceComplete && (
              <>
                <div className="form-card graphite-onboarding-stroke mini-soft-shadow"><label className="field-label">Update your confidence</label><ConfidenceControl value={confidence} onChange={setConfidence} /></div>
                <div className="actions continuation"><StrokeButton primary onClick={submitEvidenceRating}>{round === EVIDENCE_RATES.length - 1 ? "Finish" : "Submit and continue"}</StrokeButton></div>
              </>
            )}
          </>
        )}

        {screen === "results" && (
          <>
            <p className="eyebrow">Demo complete</p>
            <h1>Your confidence over time</h1>
            <p className="lede">Prototype summary.</p>
            <div className="chart-card graphite-onboarding-stroke mini-soft-shadow"><Chart ratings={ratings} /></div>
            <div className="summary-row">
              <div className="summary-item"><div className="summary-value">{ratings[0]}</div><div className="summary-label">Initial confidence</div></div>
              <div className="summary-item"><div className="summary-value">{ratings.at(-1)}</div><div className="summary-label">Final confidence</div></div>
              <div className="summary-item"><div className="summary-value">{(ratings.at(-1) ?? 0) - ratings[0] > 0 ? "+" : ""}{(ratings.at(-1) ?? 0) - ratings[0]}</div><div className="summary-label">Total change</div></div>
            </div>
            <div className="actions"><StrokeButton onClick={reset}>Try other condition</StrokeButton><StrokeButton primary onClick={downloadData}>Download session data</StrokeButton></div>
          </>
        )}

        <div className="progress-track"><div className="progress-fill" style={{ width: `${progressFor(screen, round)}%` }} /></div>
      </section>
    </main>
  );
}
