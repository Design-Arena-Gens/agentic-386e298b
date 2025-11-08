import { NextResponse } from "next/server";

type CandlePoint = {
  timestamp: number;
  close: number;
};

type CycleComponent = {
  index: number;
  frequency: number;
  amplitude: number;
  phase: number;
  periodSamples: number;
};

const YAHOO_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";

const RANGE_MAP: Record<string, string> = {
  "3mo": "3mo",
  "6mo": "6mo",
  "1y": "1y",
  "2y": "2y",
  "5y": "5y",
};

const INTERVAL_MAP: Record<string, string> = {
  "3mo": "1d",
  "6mo": "1d",
  "1y": "1d",
  "2y": "1d",
  "5y": "1wk",
};

function sanitizeSymbol(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) {
    return "";
  }
  if (trimmed.includes(".")) {
    return trimmed;
  }
  return `${trimmed}.NS`;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((acc, val) => acc + val, 0) / values.length;
}

function computeTrendSlope(points: CandlePoint[]): number {
  const n = points.length;
  if (n < 2) return 0;

  const first = points[0].timestamp;
  const xs = points.map((point) => (point.timestamp - first) / 86400); // convert to days
  const ys = points.map((point) => point.close);

  const xMean = mean(xs);
  const yMean = mean(ys);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i += 1) {
    numerator += (xs[i] - xMean) * (ys[i] - yMean);
    denominator += (xs[i] - xMean) ** 2;
  }

  if (denominator === 0) return 0;
  return numerator / denominator;
}

function computeCycleComponents(values: number[]): CycleComponent[] {
  const n = values.length;
  const dataMean = mean(values);
  const centered = values.map((value) => value - dataMean);
  const limit = Math.floor(n / 2);
  const components: CycleComponent[] = [];

  for (let k = 1; k <= limit; k += 1) {
    let real = 0;
    let imag = 0;

    for (let t = 0; t < n; t += 1) {
      const angle = (-2 * Math.PI * k * t) / n;
      real += centered[t] * Math.cos(angle);
      imag += centered[t] * Math.sin(angle);
    }

    const magnitude = Math.sqrt(real ** 2 + imag ** 2);
    const amplitude = (2 * magnitude) / n;
    const phase = Math.atan2(imag, real);
    const frequency = k / n; // cycles per sample
    const periodSamples = frequency === 0 ? Number.POSITIVE_INFINITY : 1 / frequency;

    components.push({
      index: k,
      frequency,
      amplitude,
      phase,
      periodSamples,
    });
  }

  return components.sort((a, b) => b.amplitude - a.amplitude);
}

function summarizeCycles(
  symbol: string,
  dominantCycles: { periodDays: number; amplitude: number }[],
  range: string,
): string {
  if (!dominantCycles.length) {
    return `${symbol} এর জন্য বাছাই করা সময় সীমায় পর্যাপ্ত তথ্য পাওয়া যায়নি।`;
  }

  const primary = dominantCycles[0];
  const secondary = dominantCycles[1];

  const primaryText = `মূল চক্র ${primary.periodDays.toFixed(1)} দিনের কাছাকাছি, যার শক্তি ${primary.amplitude.toFixed(2)}।`;
  const secondaryText = secondary
    ? `দ্বিতীয় চক্র হিসেবে ${secondary.periodDays.toFixed(1)} দিনের একটি পুনরাবৃত্তি পাওয়া গেছে।`
    : "দ্বিতীয় শক্তিশালী চক্র তেমন প্রকট নয়।";

  return `${symbol} এর ${range} ডেটায় ${primaryText} ${secondaryText} এই তথ্যের ভিত্তিতে আপনার এন্ট্রি ও এক্সিট পরিকল্পনা করুন।`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawSymbol = searchParams.get("symbol") ?? "";
  const rangeParam = searchParams.get("range") ?? "1y";
  const range = RANGE_MAP[rangeParam] ?? "1y";
  const interval = INTERVAL_MAP[range] ?? "1d";

  const symbol = sanitizeSymbol(rawSymbol);

  if (!symbol) {
    return NextResponse.json(
      { error: "স্টক সিম্বল দিন (যেমন: INFY, RELIANCE)" },
      { status: 400 },
    );
  }

  const url = new URL(`${symbol}`, YAHOO_BASE_URL);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);
  url.searchParams.set("includeTimestamp", "true");
  url.searchParams.set("includePrePost", "false");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "cycle-analyser-bot",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      {
        error: "ডেটা আনা সম্ভব হয়নি। সিম্বল ঠিক আছে কিনা দেখুন।",
        details: await response.text(),
      },
      { status: response.status },
    );
  }

  const payload = (await response.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        meta?: {
          regularMarketPrice?: number;
          symbol?: string;
          exchangeName?: string;
        };
        indicators?: {
          quote?: Array<{
            close?: Array<number | null>;
          }>;
        };
      }>;
      error?: unknown;
    };
  };

  const chart = payload.chart?.result?.[0];

  if (!chart?.timestamp?.length || !chart.indicators?.quote?.[0]?.close?.length) {
    return NextResponse.json(
      { error: "প্রদত্ত সিম্বলের জন্য পর্যাপ্ত ঐতিহাসিক মূল্য পাওয়া যায়নি।" },
      { status: 404 },
    );
  }

  const closes: CandlePoint[] = chart.timestamp
    .map((stamp, index) => {
      const closeValue = chart.indicators?.quote?.[0]?.close?.[index];
      if (closeValue == null) {
        return null;
      }
      return {
        timestamp: stamp,
        close: closeValue,
      };
    })
    .filter((point): point is CandlePoint => Boolean(point));

  if (closes.length < 32) {
    return NextResponse.json(
      { error: "চক্র বিশ্লেষণের জন্য অন্তত ৩২টি ডেটা পয়েন্ট প্রয়োজন।" },
      { status: 422 },
    );
  }

  const secondsDiffs: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    secondsDiffs.push(closes[i].timestamp - closes[i - 1].timestamp);
  }
  const avgSeconds =
    secondsDiffs.length > 0
      ? secondsDiffs.reduce((acc, val) => acc + val, 0) / secondsDiffs.length
      : 86400;
  const samplePeriodDays = avgSeconds / 86400;

  const priceValues = closes.map((point) => point.close);
  const components = computeCycleComponents(priceValues);

  const dominantCycles = components
    .slice(0, 6)
    .map((component) => ({
      index: component.index,
      amplitude: component.amplitude,
      phase: component.phase,
      frequency: component.frequency,
      periodSamples: component.periodSamples,
      periodDays: component.periodSamples * samplePeriodDays,
    }))
    .filter((component) => Number.isFinite(component.periodDays) && component.amplitude > 0)
    .slice(0, 4);

  const weightedPeriod =
    dominantCycles.length > 0
      ? dominantCycles.reduce(
          (acc, component) => acc + component.periodDays * component.amplitude,
          0,
        ) /
        dominantCycles.reduce((acc, component) => acc + component.amplitude, 0)
      : null;

  const trendSlope = computeTrendSlope(closes);

  const latestTimestamp = closes[closes.length - 1].timestamp * 1000;

  const summary = summarizeCycles(symbol, dominantCycles, range);

  return NextResponse.json({
    ok: true,
    requestedSymbol: rawSymbol.trim().toUpperCase(),
    resolvedSymbol: symbol,
    exchange: chart.meta?.exchangeName ?? "NSE",
    lastUpdated: new Date(latestTimestamp).toISOString(),
    range,
    interval,
    sampleSize: closes.length,
    samplePeriodDays,
    closes: closes.map((point) => ({
      time: new Date(point.timestamp * 1000).toISOString(),
      close: point.close,
    })),
    analytics: {
      dominantCycles,
      averageCycleLengthDays: weightedPeriod,
      trendSlope,
      summary,
    },
  });
}

