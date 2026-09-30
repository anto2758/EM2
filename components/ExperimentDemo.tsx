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
type PatternStep = { id: number; color: ColorName | "any"; shape: ShapeName | "any" };
type IconName = "pencil" | "receive";

const COLOR_OPTIONS: Array<{ value: ColorName | "any"; label: string }> = [
  { value: "any", label: "Any color" },
  ...COLOR_NAMES.map((color) => ({ value: color, label: color })),
];
const SHAPE_OPTIONS: Array<{ value: ShapeName | "any"; label: string }> = [
  { value: "any", label: "Any shape" },
  ...SHAPES.map((shape) => ({ value: shape, label: shape })),
];

const DEFAULT_MACHINE_PATTERN: StimulusPattern[] = [{ shape: "circle" }, { shape: "triangle" }];
const DEFAULT_PATTERN_STEPS: PatternStep[] = [
  { id: 1, color: "any", shape: "circle" },
  { id: 2, color: "any", shape: "triangle" },
];
const PROVIDED_HYPOTHESIS = "Circle (any color) → triangle (any color)";
const MINI_SOFT_SHADOW = "shadow-[0_5px_10px_rgba(0,0,0,0.03),0_0.25px_0.5px_rgba(0,0,0,0.05),0_1px_1.5px_rgba(0,0,0,0.04),0_2.5px_5px_rgba(0,0,0,0.04),0_0.5px_1px_rgba(0,0,0,0.02)]";
const GRAPHITE_CARD = `border-[0.5px] border-black/[0.08] ${MINI_SOFT_SHADOW}`;
const HEADING = "m-0 text-[clamp(26px,4vw,34px)] font-semibold leading-[1.18] text-[#2c2c2b]";
const LEDE = "mt-3.5 max-w-130 text-sm leading-[1.7] text-[#777673]";
const EYEBROW = "mb-3 text-[11px] font-semibold text-[#715d82]";
const ACTIONS = "mt-8 flex justify-end gap-2.5";
const BELIEF_CARD = `mt-7.5 rounded-[13px] bg-linear-to-br from-white to-[#faf8fb] p-7 ${GRAPHITE_CARD}`;
const FORM_CARD = `mt-8 rounded-xl bg-white p-6 ${GRAPHITE_CARD}`;
const FIELD_LABEL = "mb-2.25 block text-[11px] font-semibold text-[#777673]";
const CALIBRATION_PATTERNS: Array<{
  antecedent: StimulusPattern;
  consequent: StimulusPattern;
  successes: number;
}> = [
  { antecedent: DEFAULT_MACHINE_PATTERN[0], consequent: DEFAULT_MACHINE_PATTERN[1], successes: 6 },
  { antecedent: { color: "red" }, consequent: { color: "blue" }, successes: 6 },
  { antecedent: { color: "green", shape: "pentagon" }, consequent: { color: "yellow", shape: "square" }, successes: 5 },
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

function buildPatternTrials(successes: number, seed: number, pattern: StimulusPattern[]) {
  const random = seededRandom(seed);
  const outcomes = shuffled(Array.from({ length: 10 }, (_, index) => index < successes), random);

  return outcomes.map((success) => {
    const failingIndex = success ? -1 : 1 + Math.floor(random() * (pattern.length - 1));
    return pattern.map((step, index) => (
      index === failingIndex ? randomStimulus(random, [step]) : matchingStimulus(step, random)
    ));
  });
}

function buildSequence(successes: number, seed: number, pattern: StimulusPattern[] = DEFAULT_MACHINE_PATTERN) {
  const random = seededRandom(seed + 991);
  const trials = buildPatternTrials(successes, seed, pattern);
  const sequence: Stimulus[] = [];

  trials.forEach((trial, index) => {
    if (index > 0) {
      sequence.push(randomStimulus(random, [pattern[0]]));
    }
    sequence.push(...trial);
  });

  return sequence;
}

function describePatternStep(pattern: StimulusPattern) {
  if (pattern.color && pattern.shape) return `${pattern.color} ${pattern.shape}`;
  if (pattern.shape) return `${pattern.shape} (any color)`;
  if (pattern.color) return `${pattern.color} object (any shape)`;
  return "unspecified object";
}

function describePattern(pattern: StimulusPattern[]) {
  return pattern.map(describePatternStep).join(" → ");
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

function StrokeButton({ children, onClick, disabled = false }: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <span className={`inline-flex w-fit rounded-[10px] p-px ${disabled ? "bg-[#e4e4e2]" : "bg-linear-to-b from-[#f3f3f3] via-[#f3f3f3] to-[#eaeaea]"}`}>
      <button
        className="flex h-full w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[9px] border-0 bg-white px-3 py-2 text-xs text-[#2c2c2b] shadow-sm transition-colors duration-200 enabled:hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 disabled:opacity-100 disabled:shadow-none motion-reduce:transition-none"
        onClick={onClick}
        disabled={disabled}
        type="button"
      >
        {children}
      </button>
    </span>
  );
}

function PatternSelect<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="grid min-w-0 flex-1 gap-1.5">
      <span className="text-[10px] font-semibold text-[#777673]">{label}</span>
      <span className="relative rounded-[10px] bg-linear-to-b from-[#f3f3f3] via-[#f3f3f3] to-[#eaeaea] p-px focus-within:from-[#ebebeb] focus-within:via-[#e8e8e8] focus-within:to-[#e0e0e0]">
        <select
          className="block h-9 w-full cursor-pointer appearance-none rounded-[9px] border-0 bg-white px-3 pr-8 text-xs capitalize text-[#2c2c2b] shadow-sm outline-none focus:bg-[#fdfdfc]"
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
        >
          {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
        <svg className="pointer-events-none absolute top-1/2 right-3 h-3 w-3 -translate-y-1/2 text-[#8d8c88]" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </label>
  );
}

function ProgressBar({ value, className = "", label = "Progress" }: { value: number; className?: string; label?: string }) {
  const percentage = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-1 overflow-hidden rounded-full bg-black/5 ${className}`}
    >
      <div
        className="h-full rounded-full bg-neutral-800 transition-[width] duration-450 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-0"
        style={{ width: `${percentage}%` }}
      />
    </div>
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
      className={mini ? "h-4.5 w-4.5 overflow-visible" : "h-48 w-48 overflow-visible drop-shadow-[0_4px_8px_rgba(28,27,24,0.04)]"}
      viewBox="0 0 140 140"
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

function SequencePlayer({ sequence, onComplete }: { sequence: Stimulus[]; onComplete: () => void }) {
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
  const playing = started && index < sequence.length;
  const progress = playing ? (((index ?? 0) + 1) / sequence.length) * 100 : 0;

  return (
    <>
      {playing && (
        <div className="fixed inset-0 z-100 grid place-items-center bg-[#fbfbfa]">
          <Shape stimulus={sequence[index ?? 0]} />
          <ProgressBar
            value={progress}
            label="Sequence progress"
            className="absolute right-[clamp(24px,7vw,96px)] bottom-[clamp(28px,6vh,64px)] left-[clamp(24px,7vw,96px)]"
          />
        </div>
      )}
      {!started && <div className="mt-8 flex justify-end gap-2.5"><StrokeButton onClick={() => setIndex(0)}>Start sequence</StrokeButton></div>}
    </>
  );
}

function ConfidenceControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="mt-8.5">
      <div className="mb-5 text-5xl font-medium text-[#2c2c2b]"><output>{value}</output><span className="ml-1.25 text-[15px] text-[#a09f9c]">/ 100</span></div>
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
      <div className="mt-1 ml-6.5 flex gap-4.5 text-[10px] text-[#777673]">
        <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4.5 bg-[#79628a]" />Your confidence</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4.5 bg-[repeating-linear-gradient(90deg,#b6b3ad_0_5px,transparent_5px_8px)]" />Observed success rate</span>
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
  const [patternSteps, setPatternSteps] = useState<PatternStep[]>(() => DEFAULT_PATTERN_STEPS.map((step) => ({ ...step })));
  const [round, setRound] = useState(0);
  const [ratings, setRatings] = useState<number[]>([]);
  const [confidence, setConfidence] = useState(70);
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [sequenceComplete, setSequenceComplete] = useState(false);
  const nextPatternStepId = useRef(3);
  const calibrationSequence = useMemo(() => buildCalibrationSequence(), []);
  const machinePattern = useMemo<StimulusPattern[]>(() => patternSteps.map((step) => ({
    ...(step.color !== "any" ? { color: step.color } : {}),
    ...(step.shape !== "any" ? { shape: step.shape } : {}),
  })), [patternSteps]);
  const patternValid = machinePattern.every((step) => step.color || step.shape);
  const activePattern = condition === "provided" ? DEFAULT_MACHINE_PATTERN : machinePattern;
  const checkedPattern = activePattern.every((step) => step.color || step.shape) ? activePattern : DEFAULT_MACHINE_PATTERN;
  const hypothesis = condition === "provided" ? PROVIDED_HYPOTHESIS : describePattern(machinePattern);

  const reset = useCallback(() => {
    setScreen("setup");
    setCondition(null);
    setPatternSteps(DEFAULT_PATTERN_STEPS.map((step) => ({ ...step })));
    nextPatternStepId.current = 3;
    setRound(0);
    setRatings([]);
    setConfidence(70);
    setStartedAt(new Date().toISOString());
    setSequenceComplete(false);
  }, []);

  const downloadData = useCallback(() => {
    const payload = {
      version: "prototype-5-structured-patterns",
      condition,
      hypothesis,
      pattern: activePattern,
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
  }, [activePattern, condition, hypothesis, ratings, startedAt]);

  const diagnosticTrials = useMemo(() => buildPatternTrials(8, 1197, checkedPattern), [checkedPattern]);

  const evidenceSequence = useMemo(() => {
    if (round >= EVIDENCE_RATES.length) return [];
    return buildSequence(EVIDENCE_RATES[round] / 10, 2400 + round * 73, checkedPattern);
  }, [checkedPattern, round]);

  const updatePatternStep = (id: number, update: Partial<Pick<PatternStep, "color" | "shape">>) => {
    setPatternSteps((current) => current.map((step) => step.id === id ? { ...step, ...update } : step));
  };

  const addPatternStep = () => {
    const id = nextPatternStepId.current;
    nextPatternStepId.current += 1;
    setPatternSteps((current) => [...current, { id, color: "any", shape: "circle" }]);
  };

  const removePatternStep = (id: number) => {
    setPatternSteps((current) => current.filter((step) => step.id !== id));
  };

  const submitEvidenceRating = () => {
    setRatings((current) => [...current, confidence]);
    setSequenceComplete(false);
    if (round === EVIDENCE_RATES.length - 1) setScreen("results");
    else setRound((current) => current + 1);
  };

  return (
    <main className="grid min-h-screen grid-rows-[auto_1fr] px-4 pt-4.5 pb-8.5 sm:px-6 sm:pt-7 sm:pb-12">
      <header className="mx-auto grid min-h-9 w-full max-w-230 grid-cols-[1fr_auto] items-center">
        <div className="text-xs font-semibold text-[#4f4e4b]">EM2</div>
        {screen !== "setup" ? <button className="cursor-pointer border-0 bg-transparent py-2 text-[11px] text-[#a09f9c] hover:text-[#2c2c2b]" onClick={reset}>Exit demo</button> : <span />}
      </header>

      <section className={`m-auto w-full py-10 sm:py-13.5 ${["calibration", "hypothesis", "review", "evidence", "results"].includes(screen) ? "max-w-180" : "max-w-140"}`} key={`${screen}-${round}`}>
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
                  className={`flex min-h-23 w-full cursor-pointer items-center gap-4 rounded-md bg-white px-5.5 py-5 text-left transition duration-150 motion-reduce:transition-none ${GRAPHITE_CARD} ${condition === value ? "border-black/16 bg-[#f9f9f7]" : "hover:-translate-y-0.5 hover:border-black/15"}`}
                  onClick={() => setCondition(value)}
                  aria-pressed={condition === value}
                  type="button"
                  key={value}
                >
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-[11px] ${condition === value ? "bg-[#e5e0e9] text-[#715d82]" : "bg-black/[0.035] text-[#676561]"}`}><span className="h-5.5 w-5.5"><Icon name={iconName} /></span></span>
                  <span className="grid gap-1.25"><span className="text-sm font-semibold text-[#37352f]">{title}</span><span className="text-xs leading-[1.45] text-[#777673]">{description}</span></span>
                </button>
              ))}
            </div>
            <div className="mt-6.5 rounded-lg border border-[#715d82]/12 bg-[#f5f2f7] px-4 py-3.5 text-xs leading-[1.55] text-[#675a70]">Condition assignment is visible in demo mode.</div>
            <div className={ACTIONS}><StrokeButton disabled={!condition} onClick={() => setScreen("intro")}>Begin</StrokeButton></div>
          </>
        )}

        {screen === "intro" && (
          <>
            <p className={EYEBROW}>Before you begin</p>
            <h1 className={HEADING}>Find a pattern</h1>
            <p className={LEDE}>A pattern can involve shape, color, or both.</p>
            <div className={BELIEF_CARD}><span className="text-[10px] font-semibold text-[#715d82]">Remember</span><p className="mt-3 text-[19px] leading-normal font-medium text-[#2c2c2b]">Patterns do not need to hold every time.</p></div>
            <div className={ACTIONS}><StrokeButton onClick={() => setScreen("calibration")}>I understand</StrokeButton></div>
          </>
        )}

        {screen === "calibration" && (
          <>
            <p className={EYEBROW}>Calibration sequence</p>
            <h1 className={HEADING}>Watch closely</h1>
            <p className={LEDE}>Each object stays visible long enough to inspect both features. The sequence takes about a minute.</p>
            <SequencePlayer sequence={calibrationSequence} onComplete={() => setSequenceComplete(true)} />
            {sequenceComplete && <div className={`${ACTIONS} mt-3.5`}><StrokeButton onClick={() => { setSequenceComplete(false); setScreen("hypothesis"); }}>Continue</StrokeButton></div>}
          </>
        )}

        {screen === "hypothesis" && condition === "provided" && (
          <>
            <p className={EYEBROW}>A possible regularity</p>
            <h1 className={HEADING}>Consider this pattern</h1>
            <p className={LEDE}>Proposed by the matched participant.</p>
            <div className={BELIEF_CARD}><span className="text-[10px] font-semibold text-[#715d82]">Provided hypothesis</span><p className="mt-3 whitespace-pre-wrap wrap-break-word text-[19px] leading-normal font-medium text-[#2c2c2b]">{hypothesis}</p></div>
            <div className={ACTIONS}><StrokeButton onClick={() => setScreen("review")}>Continue</StrokeButton></div>
          </>
        )}

        {screen === "hypothesis" && condition === "generated" && (
          <>
            <p className={EYEBROW}>Your observation</p>
            <h1 className={HEADING}>Build the pattern</h1>
            <p className={LEDE}>Add each object in order. Use color, shape, or both.</p>
            <div className={FORM_CARD}>
              <div className="grid gap-3">
                {patternSteps.map((step, index) => {
                  const empty = step.color === "any" && step.shape === "any";
                  return (
                    <div className={`rounded-xl border p-3.5 ${empty ? "border-[#b9786d]/35 bg-[#fffafa]" : "border-black/8 bg-[#fafaf9]"}`} key={step.id}>
                      <div className="mb-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-[#715d82]">Step {index + 1}</span>
                        {patternSteps.length > 2 && <button className="cursor-pointer border-0 bg-transparent px-1 py-0.5 text-[10px] text-[#a09f9c] hover:text-[#5e5d59]" type="button" onClick={() => removePatternStep(step.id)}>Remove</button>}
                      </div>
                      <div className="flex gap-2.5">
                        <PatternSelect label="Color" value={step.color} options={COLOR_OPTIONS} onChange={(color) => updatePatternStep(step.id, { color })} />
                        <PatternSelect label="Shape" value={step.shape} options={SHAPE_OPTIONS} onChange={(shape) => updatePatternStep(step.id, { shape })} />
                      </div>
                      {empty && <p className="mt-2 text-[10px] text-[#a05f54]">Choose a color or shape for this step.</p>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3.5"><StrokeButton onClick={addPatternStep}>Add another step</StrokeButton></div>
              <div className="mt-5 rounded-lg bg-[#f5f2f7] px-4 py-3.5">
                <span className="text-[10px] font-semibold text-[#715d82]">Machine-readable pattern</span>
                <p className="mt-2 wrap-break-word text-sm leading-[1.55] text-[#403a44]">{hypothesis}</p>
              </div>
            </div>
            <div className={ACTIONS}><StrokeButton disabled={!patternValid} onClick={() => setScreen("review")}>Save pattern</StrokeButton></div>
          </>
        )}

        {screen === "review" && (
          <>
            <p className={EYEBROW}>Standardized review</p>
            <h1 className={HEADING}>Check the pattern</h1>
            <p className={LEDE}>The matched pair receives the same review.</p>
            <div className={BELIEF_CARD}><span className="text-[10px] font-semibold text-[#715d82]">Current hypothesis</span><p className="mt-3 whitespace-pre-wrap wrap-break-word text-[19px] leading-normal font-medium text-[#2c2c2b]">{hypothesis}</p></div>
            <div className="mt-6 grid gap-2.25 sm:grid-cols-2">
              {diagnosticTrials.map((trial, index) => {
                const success = trial.every((stimulus, stepIndex) => matchesPattern(stimulus, checkedPattern[stepIndex]));
                return (
                  <div className={`min-w-0 overflow-x-auto rounded-lg border px-3 py-2.75 ${success ? "border-[#715d82]/20 bg-[#f5f2f7]" : "border-black/10 bg-white"}`} key={index}>
                    <div className="flex w-max min-w-full items-center justify-center gap-1.25">
                      {trial.map((stimulus, stepIndex) => (
                        <span className="contents" key={`${index}-${stepIndex}`}>
                          {stepIndex > 0 && <span className="text-[10px] text-[#aaa8a4]">→</span>}
                          <Shape stimulus={stimulus} mini />
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={ACTIONS}><StrokeButton onClick={() => { setConfidence(70); setScreen("confidence"); }}>Rate my confidence</StrokeButton></div>
          </>
        )}

        {screen === "confidence" && (
          <>
            <p className={EYEBROW}>Confidence rating</p>
            <h1 className={HEADING}>How confident are you?</h1>
            <p className={LEDE}>Does this pattern describe the sequence?</p>
            <div className={BELIEF_CARD}><span className="text-[10px] font-semibold text-[#715d82]">Your hypothesis</span><p className="mt-3 whitespace-pre-wrap wrap-break-word text-[19px] leading-normal font-medium text-[#2c2c2b]">{hypothesis}</p></div>
            <ConfidenceControl value={confidence} onChange={setConfidence} />
            <div className={ACTIONS}><StrokeButton onClick={() => { setRatings([confidence]); setRound(0); setSequenceComplete(false); setScreen("evidence"); }}>Submit rating</StrokeButton></div>
          </>
        )}

        {screen === "evidence" && (
          <>
            <span className="mb-3.5 inline-flex rounded-full bg-[#e5e0e9] px-2.25 py-1.5 text-[10px] font-semibold text-[#715d82]">Evidence block {round + 1} of {EVIDENCE_RATES.length}</span>
            <h1 className={HEADING}>Watch again</h1>
            <p className={LEDE}>Keep your pattern in mind.</p>
            <SequencePlayer sequence={evidenceSequence} onComplete={() => { setConfidence(ratings.at(-1) ?? 70); setSequenceComplete(true); }} />
            {sequenceComplete && (
              <>
                <div className={FORM_CARD}><label className={FIELD_LABEL}>Update your confidence</label><ConfidenceControl value={confidence} onChange={setConfidence} /></div>
                <div className={`${ACTIONS} mt-3.5`}><StrokeButton onClick={submitEvidenceRating}>{round === EVIDENCE_RATES.length - 1 ? "Finish" : "Submit and continue"}</StrokeButton></div>
              </>
            )}
          </>
        )}

        {screen === "results" && (
          <>
            <p className={EYEBROW}>Demo complete</p>
            <h1 className={HEADING}>Your confidence over time</h1>
            <p className={LEDE}>Prototype summary.</p>
            <div className={`mt-7.5 rounded-[13px] bg-white px-5 pt-6 pb-4.5 ${GRAPHITE_CARD}`}><Chart ratings={ratings} /></div>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="rounded-lg bg-[#f7f7f5] p-3.5"><div className="text-lg font-semibold">{ratings[0]}</div><div className="mt-1 text-[9px] leading-[1.3] text-[#a09f9c]">Initial confidence</div></div>
              <div className="rounded-lg bg-[#f7f7f5] p-3.5"><div className="text-lg font-semibold">{ratings.at(-1)}</div><div className="mt-1 text-[9px] leading-[1.3] text-[#a09f9c]">Final confidence</div></div>
              <div className="rounded-lg bg-[#f7f7f5] p-3.5"><div className="text-lg font-semibold">{(ratings.at(-1) ?? 0) - ratings[0] > 0 ? "+" : ""}{(ratings.at(-1) ?? 0) - ratings[0]}</div><div className="mt-1 text-[9px] leading-[1.3] text-[#a09f9c]">Total change</div></div>
            </div>
            <div className={ACTIONS}><StrokeButton onClick={reset}>Try other condition</StrokeButton><StrokeButton onClick={downloadData}>Download session data</StrokeButton></div>
          </>
        )}

        <ProgressBar value={progressFor(screen, round)} label="Study progress" className="mt-4" />
      </section>
    </main>
  );
}
