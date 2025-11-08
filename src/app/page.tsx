"use client";

import { useMemo, useState } from "react";
import type { ChartData, ChartOptions, TooltipItem } from "chart.js";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import "chartjs-adapter-date-fns";
import { format } from "date-fns";

type CycleComponent = {
  index: number;
  amplitude: number;
  phase: number;
  frequency: number;
  periodSamples: number;
  periodDays: number;
};

type ApiResponse = {
  ok: boolean;
  requestedSymbol: string;
  resolvedSymbol: string;
  exchange: string;
  lastUpdated: string;
  range: string;
  interval: string;
  sampleSize: number;
  samplePeriodDays: number;
  closes: { time: string; close: number }[];
  analytics: {
    dominantCycles: CycleComponent[];
    averageCycleLengthDays: number | null;
    trendSlope: number;
    summary: string;
  };
};

const RANGE_OPTIONS = [
  { label: "৩ মাস", value: "3mo" },
  { label: "৬ মাস", value: "6mo" },
  { label: "১ বছর", value: "1y" },
  { label: "২ বছর", value: "2y" },
  { label: "৫ বছর", value: "5y" },
];

const formatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-IN", {
  style: "percent",
  maximumFractionDigits: 2,
});

const slopeDescriptor = (slope: number) => {
  if (Math.abs(slope) < 0.05) return "নিরপেক্ষ প্রবণতা";
  if (slope > 0) return "উর্ধ্বমুখী ট্রেন্ড";
  return "নিম্নমুখী ট্রেন্ড";
};

export default function HomePage() {
  const [symbol, setSymbol] = useState("INFY");
  const [range, setRange] = useState("1y");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        symbol,
        range,
      });
      const response = await fetch(`/api/cycle-analysis?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "চক্র বিশ্লেষণে অসুবিধা হয়েছে।");
      }
      const payload = (await response.json()) as ApiResponse;
      setData(payload);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "অজানা ত্রুটি");
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo<ChartData<"line", { x: string; y: number }[], string> | null>(() => {
    if (!data) return null;

    return {
      datasets: [
        {
          label: `${data.resolvedSymbol} মূল্য`,
          data: data.closes.map((point) => ({
            x: point.time,
            y: point.close,
          })),
          borderColor: "rgb(37 99 235)",
          backgroundColor: "rgba(37, 99, 235, 0.15)",
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2,
          fill: true,
        },
      ],
    };
  }, [data]);

  const chartOptions = useMemo<ChartOptions<"line"> | null>(() => {
    if (!data) return null;

    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: "time" as const,
          time: {
            tooltipFormat: "PPP",
          },
          ticks: {
            autoSkip: true,
            maxTicksLimit: 10,
          },
          grid: {
            display: false,
          },
        },
        y: {
          ticks: {
            callback: (value: number | string) =>
              typeof value === "number" ? formatter.format(value) : value,
          },
          grid: {
            color: "rgba(148, 163, 184, 0.2)",
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context: TooltipItem<"line">) => {
              const value = context.parsed.y;
              return typeof value === "number"
                ? `₹ ${formatter.format(value)}`
                : "";
            },
          },
        },
      },
    };
  }, [data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 pb-16 text-slate-100">
      <header className="mx-auto w-full max-w-6xl px-6 pt-12">
        <div className="rounded-3xl bg-gradient-to-br from-blue-500/10 via-blue-400/10 to-sky-300/10 p-10 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-blue-200">
            সাইকেল অ্যানালাইসিস টুল
          </p>
          <h1 className="mt-4 text-4xl font-extrabold text-white sm:text-5xl">
            যেকোনো ভারতীয় স্টকের সাইক্লিকাল প্যাটার্ন খুঁজে পান
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-blue-100">
            ইয়াহু ফাইন্যান্সের ডেটার উপর ভিত্তি করে শক্তিশালী ফোরিয়ার বিশ্লেষণ
            প্রয়োগ করে প্রধান চক্র, ট্রেন্ড এবং সম্ভাব্য রিভার্সাল জোন সম্পর্কে
            ধারণা নিন। দ্বিধা না করে আপনার সিম্বল লিখে বিশ্লেষণ শুরু করুন।
          </p>
        </div>
      </header>

      <main className="mx-auto mt-12 w-full max-w-6xl space-y-10 px-6">
        <section className="grid gap-8 lg:grid-cols-[320px,1fr]">
          <form
            onSubmit={handleSubmit}
            className="flex h-fit flex-col gap-6 rounded-2xl border border-white/10 bg-slate-950/60 p-8 shadow-2xl shadow-blue-900/10"
          >
            <div>
              <label
                htmlFor="symbol"
                className="text-sm font-semibold uppercase tracking-wide text-blue-200"
              >
                স্টক সিম্বল (NSE)
              </label>
              <input
                id="symbol"
                name="symbol"
                value={symbol}
                onChange={(event) => setSymbol(event.currentTarget.value.toUpperCase())}
                placeholder="উদাহরণ: INFY, RELIANCE, HDFCBANK"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-lg font-semibold text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/60"
                required
                autoComplete="off"
              />
              <p className="mt-2 text-xs text-slate-400">
                স্বয়ংক্রিয়ভাবে .NS যোগ হবে। BSE কোড চাইলে .BO উল্লেখ করুন (যেমন:
                500325.BO)।
              </p>
            </div>

            <div>
              <label
                htmlFor="range"
                className="text-sm font-semibold uppercase tracking-wide text-blue-200"
              >
                সময় সীমা
              </label>
              <select
                id="range"
                name="range"
                value={range}
                onChange={(event) => setRange(event.currentTarget.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-lg font-semibold text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/60"
              >
                {RANGE_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-slate-900 text-white"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex items-center justify-center rounded-xl bg-blue-500 px-5 py-3 text-lg font-semibold text-white transition hover:bg-blue-400 disabled:bg-blue-500/60"
            >
              {loading ? "বিশ্লেষণ চলছে..." : "সাইকেল বিশ্লেষণ করুন"}
            </button>
            <div className="rounded-xl bg-slate-900/80 p-4 text-sm text-slate-300">
              <p className="font-semibold text-blue-200">টিপস:</p>
              <ul className="mt-2 space-y-1 marker:text-blue-300">
                <li>• INFY, TCS, RELIANCE, HDFCBANK ইত্যাদি NSE সিম্বল ব্যবহার করুন।</li>
                <li>• ডেটা লোড হতে কয়েক সেকেন্ড সময় লাগতে পারে।</li>
                <li>• ৬ মাসের কম ডেটায় চক্র স্পষ্ট নাও হতে পারে।</li>
              </ul>
            </div>
          </form>

          <div className="space-y-6">
            {error ? (
              <div className="rounded-2xl border border-red-500/50 bg-red-950/40 p-6 text-red-100">
                <h2 className="text-xl font-bold">ত্রুটি</h2>
                <p className="mt-2">{error}</p>
              </div>
            ) : null}

            {data ? (
              <>
                <section className="grid gap-6 rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-inner shadow-slate-900/40 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <p className="text-sm uppercase tracking-wide text-blue-200">
                      বিশ্লেষণের সারাংশ
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-white">
                      {data.requestedSymbol} → {data.resolvedSymbol} ({data.exchange})
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-slate-300">
                      {data.analytics.summary}
                    </p>
                  </div>
                  <div className="space-y-4 md:col-span-2">
                    <div className="rounded-xl border border-white/5 bg-slate-900/70 p-4">
                      <p className="text-xs uppercase tracking-wide text-blue-200">
                        নমুনা
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-white">
                        {data.sampleSize} ক্যান্ডেল
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        গড় স্যাম্পল গ্যাপ {data.samplePeriodDays.toFixed(2)} দিন
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-slate-900/70 p-4">
                      <p className="text-xs uppercase tracking-wide text-blue-200">
                        গড় চক্র দৈর্ঘ্য
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-white">
                        {data.analytics.averageCycleLengthDays
                          ? `${data.analytics.averageCycleLengthDays.toFixed(1)} দিন`
                          : "প্রকট নয়"}
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        ট্রেন্ড: {slopeDescriptor(data.analytics.trendSlope)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-slate-900/70 p-4">
                      <p className="text-xs uppercase tracking-wide text-blue-200">
                        শেষ আপডেট
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {format(new Date(data.lastUpdated), "PPP")}
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        ডেটা রেঞ্জ: {data.range} · ইন্টারভাল: {data.interval}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr),360px]">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
                    <h3 className="text-lg font-semibold text-white">
                      প্রাইস অ্যাকশন
                    </h3>
                    <div className="mt-4 h-72 w-full">
                      {chartData && chartOptions ? (
                        <Line data={chartData} options={chartOptions} />
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
                    <h3 className="text-lg font-semibold text-white">
                      ডমিন্যান্ট চক্রসমূহ
                    </h3>
                    <ul className="mt-4 space-y-3">
                      {data.analytics.dominantCycles.map((cycle, index) => (
                        <li
                          key={cycle.index}
                          className="rounded-xl border border-white/5 bg-slate-900/70 p-4"
                        >
                          <p className="text-sm uppercase tracking-wide text-blue-200">
                            চক্র #{index + 1}
                          </p>
                          <p className="mt-2 text-xl font-bold text-white">
                            {cycle.periodDays.toFixed(1)} দিন
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            তীব্রতা (Amplitude): {formatter.format(cycle.amplitude)}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            ফেজ: {cycle.phase.toFixed(2)} রেডিয়ান
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            ফ্রিকোয়েন্সি: {percentFormatter.format(cycle.frequency)}
                          </p>
                        </li>
                      ))}
                      {data.analytics.dominantCycles.length === 0 ? (
                        <li className="rounded-xl border border-white/5 bg-slate-900/70 p-4 text-sm text-slate-400">
                          প্রকট চক্র পাওয়া যায়নি।
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </section>
              </>
            ) : (
              <div className="space-y-6 text-slate-300">
                <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-8">
                  <h2 className="text-2xl font-bold text-white">
                    কীভাবে সাইকেল অ্যানালাইসিস করবেন?
                  </h2>
                  <ol className="mt-4 space-y-4 text-base leading-relaxed">
                    <li>
                      <span className="font-semibold text-blue-200">ধাপ ১:</span>{" "}
                      NSE এর ইচ্ছাকৃত সিম্বল বেছে নিন। উদাহরণস্বরূপ, INFY (Infosys), TCS,
                      RELIANCE।
                    </li>
                    <li>
                      <span className="font-semibold text-blue-200">ধাপ ২:</span>{" "}
                      আপনার বিশ্লেষণের সময় সীমা নির্ধারণ করুন। স্বল্পমেয়াদী ট্রেডের ক্ষেত্রে
                      ৬ মাস, সুইং/পজিশনাল ক্ষেত্রে ১-২ বছর নির্বাচন করুন।
                    </li>
                    <li>
                      <span className="font-semibold text-blue-200">ধাপ ৩:</span>{" "}
                      উপরের ইনপুট বক্সে সিম্বল লিখে “সাইকেল বিশ্লেষণ করুন” বাটনে ক্লিক করুন।
                      সিস্টেম স্বয়ংক্রিয়ভাবে ইয়াহু ফাইন্যান্স থেকে ডেটা এনে ফোরিয়ার ট্রান্সফর্ম
                      চালাবে।
                    </li>
                    <li>
                      <span className="font-semibold text-blue-200">ধাপ ৪:</span>{" "}
                      “ডমিন্যান্ট চক্র” সেকশনে যে সময়কালগুলো দেখবেন, সেগুলো সবচেয়ে শক্তিশালী
                      পুনরাবৃত্তি নির্দেশ করে। এগুলোই সম্ভাব্য এন্ট্রি/এক্সিট উইন্ডো।
                    </li>
                    <li>
                      <span className="font-semibold text-blue-200">ধাপ ৫:</span>{" "}
                      প্রাইস চার্টে চক্রের দৈর্ঘ্য অনুযায়ী সাপোর্ট/রেজিস্ট্যান্স জোন
                      শনাক্ত করুন এবং অন্যান্য টেকনিক্যাল সূচকের সাথে মিলিয়ে সিদ্ধান্ত নিন।
                    </li>
                  </ol>
                </section>

                <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-8">
                  <h3 className="text-xl font-semibold text-white">টেকনিক্যাল কৌশল</h3>
                  <div className="mt-4 space-y-4 text-base leading-relaxed">
                    <p>
                      এই টুল টাইম-ডোমেইন মূল্য ডেটাকে ফ্রিকোয়েন্সি-ডোমেইনে রূপান্তরিত করে।
                      ফলে কোন সময়কালগুলোতে স্টকটির পুনরাবৃত্তি বা সাইক্লিক্যাল আচরণ প্রাধান্য
                      পাচ্ছে তা সহজে বোঝা যায়।
                    </p>
                    <ul className="space-y-2">
                      <li>• ৭০ দিনের উপরের চক্র সাধারণত মধ্য-মেয়াদি সুইং নির্দেশ করে।</li>
                      <li>• ৩০ দিনের নিচের চক্র ইনট্রা-মাস ভোলাটিলিটি সম্পর্কে ধারণা দেয়।</li>
                      <li>
                        • ট্রেন্ড স্লোপ ধনাত্মক হলে চক্রের হাই অঞ্চলে প্রফিট বুকিং, ঋণাত্মক হলে
                        লো অঞ্চলে এন্ট্রি ভাবুন।
                      </li>
                    </ul>
                    <p>
                      বাজারের খবর, ফান্ডামেন্টাল এবং ভলিউম বিশ্লেষণের সাথে মিলিয়ে এই ফলাফল
                      ব্যবহার করলে নির্ভুলতা বাড়ে।
                    </p>
                  </div>
                </section>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
