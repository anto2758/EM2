"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const COLORS = {
  yellow: "#e6be55",
  green: "#76a98a",
  blue: "#7197bd",
  red: "#d98272",
} as const;

const SHAPES = ["circle", "triangle", "square", "pentagon"] as const;
const COLOR_NAMES = Object.keys(COLORS) as ColorName[];
const EVIDENCE_RATES = [80, 70, 50, 30, 20] as const;
const STIMULUS_INTERVAL_MS = 1400;

type ColorName = keyof typeof COLORS;
type ShapeName = (typeof SHAPES)[number];
type Condition = "generated" | "provided";
type Screen = "setup" | "intro" | "calibration" | "hypothesis" | "review" | "confidence" | "evidence" | "results";
type Stimulus = { color: ColorName; shape: ShapeName };
type StimulusPattern = { color?: ColorName; shape?: ShapeName };
type IconName = "pencil" | "receive";

const DEFAULT_ANTECEDENT: StimulusPattern = { shape: "circle" };
const DEFAULT_CONSEQUENT: StimulusPattern = { shape: "triangle" };
const PROVIDED_HYPOTHESIS = "A circle tends to be followed by a triangle, regardless of color.";
const MINI_SOFT_SHADOW = "shadow-[0_5px_10px_rgba(0,0,0,0.03),0_0.25px_0.5px_rgba(0,0,0,0.05),0_1px_1.5px_rgba(0,0,0,0.04),0_2.5px_5px_rgba(0,0,0,0.04),0_0.5px_1px_rgba(0,0,0,0.02)]";
const GRAPHITE_CARD = `border-[0.5px] border-black/[0.08] ${MINI_SOFT_SHADOW}`;
const HEADING = "m-0 text-[clamp(26px,4vw,34px)] font-semibold leading-[1.18] text-[#2c2c2b]";
const LEDE = "mt-3.5 max-w-[520px] text-sm leading-[1.7] text-[#777673]";
const EYEBROW = "mb-3 text-[11px] font-semibold text-[#715d82]";
const ACTIONS = "mt-8 flex justify-end gap-2.5";
const BELIEF_CARD = `mt-[30px] rounded-[13px] bg-linear-to-br from-white to-[#faf8fb] p-7 ${GRAPHITE_CARD}`;
const FORM_CARD = `mt-8 rounded-xl bg-white p-6 ${GRAPHITE_CARD}`;
const FIELD_LABEL = "mb-[9px] block text-[11px] font-semibold text-[#777673]";
const CALIBRATION_PATTERNS: Array<{
  antecedent: StimulusPattern;
  consequent: StimulusPattern;
  successes: number;
}> = [
  { antecedent: DEFAULT_ANTECEDENT, consequent: DEFAULT_CONSEQUENT, successes: 5 },
  { antecedent: { color: "red" }, consequent: { color: "blue" }, successes: 5 },
  { antecedent: { color: "green", shape: "pentagon" }, consequent: { color: "yellow", shape: "square" }, successes: 4 },
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

function matchesPattern(stimulus: Stimulus, pattern: StimulusPattern) {
  return (!pattern.color || stimulus.color === pattern.color) && (!pattern.shape || stimulus.shape === pattern.shape);
}

function randomStimulus(random: () => number, excluded: StimulusPattern[] = []): Stimulus {
  let candidate: Stimulus;
  do {
    candidate = makeStimulus(COLOR_NAMES[Math.floor(random() * COLOR_NAMES.length)], random);
  } while (excluded.some((pattern) => matchesPattern(candidate, pattern)));
  return candidate;
}

function matchingStimulus(pattern: StimulusPattern, random: () => number): Stimulus {
  return {
    color: pattern.color ?? COLOR_NAMES[Math.floor(random() * COLOR_NAMES.length)],
    shape: pattern.shape ?? SHAPES[Math.floor(random() * SHAPES.length)],
  };
}

function buildSequence(
  successes: number,
  seed: number,
  antecedent: StimulusPattern = DEFAULT_ANTECEDENT,
  consequent: StimulusPattern = DEFAULT_CONSEQUENT,
) {
  const random = seededRandom(seed);
  const outcomes = shuffled(Array.from({ length: 10 }, (_, index) => index < successes), random);
  const sequence: Stimulus[] = [];

  outcomes.forEach((success, index) => {
    if (index > 0) {
      sequence.push(randomStimulus(random, [antecedent]));
    }
    sequence.push(matchingStimulus(antecedent, random));
    sequence.push(success ? matchingStimulus(consequent, random) : randomStimulus(random, [antecedent, consequent]));
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
    sequence.push(matchingStimulus(pattern.antecedent, random));
    sequence.push(success ? matchingStimulus(pattern.consequent, random) : randomStimulus(random, [...antecedents, pattern.consequent]));
  });

  return sequence;
}

function Icon({ name }: { name: IconName }) {
  if (name === "pencil") {
    return (
      <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="m4 16.5-.7 4.2 4.2-.7L18.8 8.7a2.2 2.2 0 0 0 0-3.1l-.4-.4a2.2 2.2 0 0 0-3.1 0L4 16.5Z" />
        <path d="m13.8 6.7 3.5 3.5" />
      </svg>
    );
  }
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
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
    <span className="inline-flex rounded-[10px] bg-linear-to-b from-[#f3f3f3] via-[#f3f3f3] to-[#eaeaea] p-px has-[button:disabled]:bg-[#e5e4e1]">
      <button
        className={`min-h-9 cursor-pointer rounded-[9px] border-0 px-3.5 py-2.5 text-xs font-medium shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:bg-[#f4f4f2] disabled:text-[#adaca8] disabled:shadow-none motion-reduce:transition-none ${primary ? "bg-[#37352f] text-white enabled:hover:bg-[#24231f]" : "bg-white text-[#2c2c2b] enabled:hover:bg-[#f5f5f3]"}`}
        onClick={onClick}
        disabled={disabled}
        type="button"
      >
        {children}
      </button>
    </span>
  );
}

function Shape({ stimulus, mini = false }: { stimulus: Stimulus; mini?: boolean }) {
  const color = COLORS[stimulus.color];
  const polygonPoints: Partial<Record<ShapeName, string>> = {
    triangle: "60,17 105,99 15,99",
    square: "20,20 100,20 100,100 20,100",
    pentagon: "60,14 104,46 87,100 33,100 16,46",
  };

  return (
    <svg
      className={mini ? "h-[18px] w-[18px] overflow-visible" : "h-[132px] w-[132px] overflow-visible drop-shadow-[0_8px_14px_rgba(28,27,24,0.09)]"}
      viewBox="0 0 120 120"
      role={mini ? undefined : "img"}
      aria-label={mini ? undefined : `${stimulus.color} ${stimulus.shape}`}
      aria-hidden={mini ? true : undefined}
    >
      {stimulus.shape === "circle" ? (
        <circle cx="60" cy="60" r="44" fill={color} />
      ) : (
        <polygon
          points={polygonPoints[stimulus.shape]}
          fill={color}
          stroke={color}
          strokeWidth="10"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </svg>
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
  const playing = started && !complete;
  const progress = playing ? (((index ?? 0) + 1) / sequence.length) * 100 : 0;

  return (
    <>
      {playing && (
        <div className="fixed inset-0 z-100 grid place-items-center bg-[#fbfbfa]">
          <Shape stimulus={sequence[index ?? 0]} />
          <div
            className="absolute right-[clamp(24px,7vw,96px)] bottom-[clamp(28px,6vh,64px)] left-[clamp(24px,7vw,96px)] h-[3px] overflow-hidden rounded-full bg-black/[0.07]"
            role="progressbar"
            aria-label="Sequence progress"
            aria-valuemin={0}
            aria-valuemax={sequence.length}
            aria-valuenow={(index ?? 0) + 1}
          >
            <span
              className="block h-full rounded-[inherit] bg-[#917aa4] transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      {!playing && (
        <div className={`mt-[30px] grid min-h-[320px] grid-rows-[auto_1fr] rounded-2xl bg-white/90 p-[22px] sm:min-h-[350px] ${GRAPHITE_CARD}`}>
          <div className="flex items-center justify-between text-[11px] text-[#a09f9c]">
            <span>{label}</span>
            <span>{complete ? "Complete" : "Ready"}</span>
          </div>
          <div className="grid min-h-60 place-items-center">
            <span className="text-xs text-[#aaa8a4]">{complete ? "Sequence complete" : "Press start when you are ready"}</span>
          </div>
        </div>
      )}
      {!started && <div className="mt-8 flex justify-end gap-2.5"><StrokeButton primary onClick={() => setIndex(0)}>Start sequence</StrokeButton></div>}
    </>
  );
}

function ConfidenceControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="mt-[34px]">
      <div className="mb-5 text-5xl font-medium text-[#2c2c2b]"><output>{value}</output><span className="ml-[5px] text-[15px] text-[#a09f9c]">/ 100</span></div>
      <input
        className="w-full cursor-pointer accent-[#7e668f]"
        type="range"
        min="0"
        max="100"
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Confidence from 0 to 100"
      />
      <div className="mt-2.5 flex justify-between text-[10px] text-[#a09f9c]"><span>Certain it does not</span><span>Unsure</span><span>Certain it does</span></div>
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
      <svg className="h-auto w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Confidence and evidence across study stages">
        {[0, 25, 50, 75, 100].map((value) => (
          <g key={value}>
            <line className="stroke-black/[0.07] stroke-1" x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} />
            <text className="fill-[#9a9995] text-[9px]" x="3" y={y(value) + 3}>{value}</text>
          </g>
        ))}
        <polyline className="fill-none stroke-[#b6b3ad] stroke-2 [stroke-dasharray:5_5]" points={points(evidence)} />
        <polyline className="fill-none stroke-[#79628a] stroke-[2.5] [stroke-linecap:round] [stroke-linejoin:round]" points={points(ratings)} />
        {ratings.map((value, index) => <circle className="fill-white stroke-[#79628a] stroke-2" cx={x(index)} cy={y(value)} r="4" key={`point-${index}`} />)}
        {ratings.map((_, index) => (
          <text className="fill-[#9a9995] text-[9px]" textAnchor="middle" x={x(index)} y={height - 8} key={`label-${index}`}>
            {index === 0 ? "Initial" : `Block ${index}`}
          </text>
        ))}
      </svg>
      <div className="mt-1 ml-[26px] flex gap-[18px] text-[10px] text-[#777673]">
        <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-[18px] bg-[#79628a]" />Your confidence</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-[18px] bg-[repeating-linear-gradient(90deg,#b6b3ad_0_5px,transparent_5px_8px)]" />Observed success rate</span>
      </div>
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
  const [hypothesisText, setHypothesisText] = useState("");
  const [round, setRound] = useState(0);
  const [ratings, setRatings] = useState<number[]>([]);
  const [confidence, setConfidence] = useState(70);
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [sequenceComplete, setSequenceComplete] = useState(false);
  const calibrationSequence = useMemo(() => buildCalibrationSequence(), []);
  const hypothesis = condition === "provided" ? PROVIDED_HYPOTHESIS : hypothesisText.trim();

  const reset = useCallback(() => {
    setScreen("setup");
    setCondition(null);
    setHypothesisText("");
    setRound(0);
    setRatings([]);
    setConfidence(70);
    setStartedAt(new Date().toISOString());
    setSequenceComplete(false);
  }, []);

  const downloadData = useCallback(() => {
    const payload = {
      version: "prototype-4-freeform-patterns",
      condition,
      hypothesis,
      standardizedEvidenceRule: PROVIDED_HYPOTHESIS,
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
  }, [condition, hypothesis, ratings, startedAt]);

  const diagnosticPairs = useMemo(() => {
    const sequence = buildSequence(8, 1197);
    const pairs: [Stimulus, Stimulus][] = [];
    for (let index = 0; index < sequence.length - 1; index += 1) {
      if (matchesPattern(sequence[index], DEFAULT_ANTECEDENT)) pairs.push([sequence[index], sequence[index + 1]]);
    }
    return pairs.slice(0, 10);
  }, []);

  const evidenceSequence = useMemo(() => {
    if (round >= EVIDENCE_RATES.length) return [];
    return buildSequence(EVIDENCE_RATES[round] / 10, 2400 + round * 73);
  }, [round]);

  const submitEvidenceRating = () => {
    setRatings((current) => [...current, confidence]);
    setSequenceComplete(false);
    if (round === EVIDENCE_RATES.length - 1) setScreen("results");
    else setRound((current) => current + 1);
  };

  return (
    <main className="grid min-h-screen grid-rows-[auto_1fr] px-4 pt-[18px] pb-[34px] sm:px-6 sm:pt-7 sm:pb-12">
      <header className="mx-auto grid min-h-9 w-full max-w-[920px] grid-cols-[1fr_auto] items-center">
        <div className="text-xs font-semibold text-[#4f4e4b]">EM2</div>
        {screen !== "setup" ? <button className="cursor-pointer border-0 bg-transparent py-2 text-[11px] text-[#a09f9c] hover:text-[#2c2c2b]" onClick={reset}>Exit demo</button> : <span />}
      </header>

      <section className={`m-auto w-full py-10 sm:py-[54px] ${["calibration", "hypothesis", "review", "evidence", "results"].includes(screen) ? "max-w-[720px]" : "max-w-[560px]"}`} key={`${screen}-${round}`}>
        {screen === "setup" && (
          <>
            <p className={EYEBROW}>Interactive prototype</p>
            <h1 className={HEADING}>Choose a condition</h1>
            <p className={LEDE}>Both conditions see the same evidence.</p>
            <div className="mt-9 grid gap-3">
              {([
                ["generated", "pencil", "Self-generated", "Find and describe a pattern."],
                ["provided", "receive", "Provided", "Evaluate a matched pattern."],
              ] as const).map(([value, iconName, title, description]) => (
                <button
                  className={`flex min-h-[92px] w-full cursor-pointer items-center gap-4 rounded-md bg-white px-[22px] py-5 text-left transition duration-150 motion-reduce:transition-none ${GRAPHITE_CARD} ${condition === value ? "border-black/[0.16] bg-[#f9f9f7]" : "hover:-translate-y-0.5 hover:border-black/[0.15]"}`}
                  onClick={() => setCondition(value)}
                  aria-pressed={condition === value}
                  type="button"
                  key={value}
                >
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-[11px] ${condition === value ? "bg-[#e5e0e9] text-[#715d82]" : "bg-black/[0.035] text-[#676561]"}`}><span className="h-[22px] w-[22px]"><Icon name={iconName} /></span></span>
                  <span className="grid gap-[5px]"><span className="text-sm font-semibold text-[#37352f]">{title}</span><span className="text-xs leading-[1.45] text-[#777673]">{description}</span></span>
                </button>
              ))}
            </div>
            <div className="mt-[26px] rounded-lg border border-[#715d82]/[0.12] bg-[#f5f2f7] px-4 py-3.5 text-xs leading-[1.55] text-[#675a70]">Condition assignment is visible in demo mode.</div>
            <div className={ACTIONS}><StrokeButton primary disabled={!condition} onClick={() => setScreen("intro")}>Begin</StrokeButton></div>
          </>
        )}

        {screen === "intro" && (
          <>
            <p className={EYEBROW}>Before you begin</p>
            <h1 className={HEADING}>Find a pattern</h1>
            <p className={LEDE}>A pattern can involve shape, color, or both.</p>
            <div className={BELIEF_CARD}><span className="text-[10px] font-semibold text-[#715d82]">Remember</span><p className="mt-3 text-[19px] leading-normal font-medium text-[#2c2c2b]">Patterns do not need to hold every time.</p></div>
            <div className={ACTIONS}><StrokeButton primary onClick={() => setScreen("calibration")}>I understand</StrokeButton></div>
          </>
        )}

        {screen === "calibration" && (
          <>
            <p className={EYEBROW}>Calibration sequence</p>
            <h1 className={HEADING}>Watch closely</h1>
            <p className={LEDE}>Each object stays visible long enough to inspect both features. The sequence takes about a minute.</p>
            <SequencePlayer sequence={calibrationSequence} label="Observation 1" onComplete={() => setSequenceComplete(true)} />
            {sequenceComplete && <div className={`${ACTIONS} mt-3.5`}><StrokeButton primary onClick={() => { setSequenceComplete(false); setScreen("hypothesis"); }}>Continue</StrokeButton></div>}
          </>
        )}

        {screen === "hypothesis" && condition === "provided" && (
          <>
            <p className={EYEBROW}>A possible regularity</p>
            <h1 className={HEADING}>Consider this pattern</h1>
            <p className={LEDE}>Proposed by the matched participant.</p>
            <div className={BELIEF_CARD}><span className="text-[10px] font-semibold text-[#715d82]">Provided hypothesis</span><p className="mt-3 whitespace-pre-wrap break-words text-[19px] leading-normal font-medium text-[#2c2c2b]">{hypothesis}</p></div>
            <div className={ACTIONS}><StrokeButton primary onClick={() => setScreen("review")}>Continue</StrokeButton></div>
          </>
        )}

        {screen === "hypothesis" && condition === "generated" && (
          <>
            <p className={EYEBROW}>Your observation</p>
            <h1 className={HEADING}>What did you notice?</h1>
            <p className={LEDE}>Describe the pattern in your own words.</p>
            <div className={FORM_CARD}>
              <label className={FIELD_LABEL} htmlFor="hypothesis">Your hypothesis</label>
              <div className="rounded-[10px] bg-linear-to-b from-[#f3f3f3] via-[#f3f3f3] to-[#eaeaea] p-px transition-colors duration-150 focus-within:from-[#ebebeb] focus-within:via-[#e8e8e8] focus-within:to-[#e0e0e0] motion-reduce:transition-none">
                <textarea
                  id="hypothesis"
                  className="block min-h-[138px] w-full resize-y overflow-hidden rounded-[9px] border-0 bg-white px-[15px] py-3.5 text-sm leading-[1.65] text-[#2c2c2b] shadow-[0_1px_2px_rgba(0,0,0,0.05)] outline-none placeholder:text-[#a09f9c] focus:bg-[#fdfdfc]"
                  value={hypothesisText}
                  rows={5}
                  placeholder="For example: A circle is usually followed by a triangle, no matter what color either shape is."
                  aria-describedby="hypothesis-help"
                  onChange={(event) => setHypothesisText(event.target.value)}
                  onInput={(event) => {
                    event.currentTarget.style.height = "auto";
                    event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                  }}
                />
              </div>
              <p className="mx-0.5 mt-[9px] text-[11px] leading-[1.45] text-[#a09f9c]" id="hypothesis-help">Use as much detail as you need. Color is optional.</p>
            </div>
            <div className={ACTIONS}><StrokeButton primary disabled={!hypothesisText.trim()} onClick={() => setScreen("review")}>Save pattern</StrokeButton></div>
          </>
        )}

        {screen === "review" && (
          <>
            <p className={EYEBROW}>Standardized review</p>
            <h1 className={HEADING}>Check the pattern</h1>
            <p className={LEDE}>The matched pair receives the same review.</p>
            <div className={BELIEF_CARD}><span className="text-[10px] font-semibold text-[#715d82]">Current hypothesis</span><p className="mt-3 whitespace-pre-wrap break-words text-[19px] leading-normal font-medium text-[#2c2c2b]">{hypothesis}</p></div>
            <div className="mt-6 grid grid-cols-2 gap-[9px] sm:grid-cols-5">
              {diagnosticPairs.map(([first, second], index) => (
                <div className={`flex min-w-0 items-center justify-center gap-[5px] rounded-lg border p-[11px_6px] ${matchesPattern(second, DEFAULT_CONSEQUENT) ? "border-[#715d82]/20 bg-[#f5f2f7]" : "border-black/10 bg-white"}`} key={index}>
                  <Shape stimulus={first} mini /><span className="text-[10px] text-[#aaa8a4]">→</span><Shape stimulus={second} mini />
                </div>
              ))}
            </div>
            <div className={ACTIONS}><StrokeButton primary onClick={() => { setConfidence(70); setScreen("confidence"); }}>Rate my confidence</StrokeButton></div>
          </>
        )}

        {screen === "confidence" && (
          <>
            <p className={EYEBROW}>Confidence rating</p>
            <h1 className={HEADING}>How confident are you?</h1>
            <p className={LEDE}>Does this pattern describe the sequence?</p>
            <div className={BELIEF_CARD}><span className="text-[10px] font-semibold text-[#715d82]">Your hypothesis</span><p className="mt-3 whitespace-pre-wrap break-words text-[19px] leading-normal font-medium text-[#2c2c2b]">{hypothesis}</p></div>
            <ConfidenceControl value={confidence} onChange={setConfidence} />
            <div className={ACTIONS}><StrokeButton primary onClick={() => { setRatings([confidence]); setRound(0); setSequenceComplete(false); setScreen("evidence"); }}>Submit rating</StrokeButton></div>
          </>
        )}

        {screen === "evidence" && (
          <>
            <span className="mb-3.5 inline-flex rounded-full bg-[#e5e0e9] px-[9px] py-1.5 text-[10px] font-semibold text-[#715d82]">Evidence block {round + 1} of {EVIDENCE_RATES.length}</span>
            <h1 className={HEADING}>Watch again</h1>
            <p className={LEDE}>Keep your pattern in mind.</p>
            <SequencePlayer sequence={evidenceSequence} label={`New evidence ${round + 1}`} onComplete={() => { setConfidence(ratings.at(-1) ?? 70); setSequenceComplete(true); }} />
            {sequenceComplete && (
              <>
                <div className={FORM_CARD}><label className={FIELD_LABEL}>Update your confidence</label><ConfidenceControl value={confidence} onChange={setConfidence} /></div>
                <div className={`${ACTIONS} mt-3.5`}><StrokeButton primary onClick={submitEvidenceRating}>{round === EVIDENCE_RATES.length - 1 ? "Finish" : "Submit and continue"}</StrokeButton></div>
              </>
            )}
          </>
        )}

        {screen === "results" && (
          <>
            <p className={EYEBROW}>Demo complete</p>
            <h1 className={HEADING}>Your confidence over time</h1>
            <p className={LEDE}>Prototype summary.</p>
            <div className={`mt-[30px] rounded-[13px] bg-white px-5 pt-6 pb-[18px] ${GRAPHITE_CARD}`}><Chart ratings={ratings} /></div>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="rounded-lg bg-[#f7f7f5] p-3.5"><div className="text-lg font-semibold">{ratings[0]}</div><div className="mt-1 text-[9px] leading-[1.3] text-[#a09f9c]">Initial confidence</div></div>
              <div className="rounded-lg bg-[#f7f7f5] p-3.5"><div className="text-lg font-semibold">{ratings.at(-1)}</div><div className="mt-1 text-[9px] leading-[1.3] text-[#a09f9c]">Final confidence</div></div>
              <div className="rounded-lg bg-[#f7f7f5] p-3.5"><div className="text-lg font-semibold">{(ratings.at(-1) ?? 0) - ratings[0] > 0 ? "+" : ""}{(ratings.at(-1) ?? 0) - ratings[0]}</div><div className="mt-1 text-[9px] leading-[1.3] text-[#a09f9c]">Total change</div></div>
            </div>
            <div className={ACTIONS}><StrokeButton onClick={reset}>Try other condition</StrokeButton><StrokeButton primary onClick={downloadData}>Download session data</StrokeButton></div>
          </>
        )}

        <div className="mt-[38px] h-[3px] w-full overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-[inherit] bg-[#917aa4] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progressFor(screen, round)}%` }} /></div>
      </section>
    </main>
  );
}
