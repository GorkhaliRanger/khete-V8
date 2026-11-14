"use client";

import { useMemo, useState } from "react";
import { FlaskConical, Play } from "lucide-react";
import { KhetSathiChat } from "@/components/ai-chat/chat-widget";
import { MockConversationEngine } from "@/lib/ai-chat/engine";

/**
 * Prototype page for khetE कृषि साथी. Isolated at /ai-demo — the launcher is
 * rendered inside this page only and is not globally visible until approved.
 */

type ScenarioStep = { user: string; assistant: string };
type ScenarioResult = { name: string; steps: ScenarioStep[]; stateJson: string };

const SCENARIOS: Array<{ key: string; name: string; language: "en" | "ne"; script: string[] }> = [
  { key: "A", name: "A — Power tiller, hilly, NPR 120,000", language: "en", script: ["I need a power tiller", "Around 1.2 lakh", "Hilly", "8 ropani"] },
  { key: "B", name: "B — Paddy seeds for Chitwan (monsoon)", language: "en", script: ["I want paddy seeds for Chitwan", "Monsoon (kharif)"] },
  { key: "C", name: "C — 5,000-chick hatchery experts", language: "en", script: ["I want to build a 5,000-chick hatchery in Chitwan", "Yes", "5,000 chicks", "Yes", "Complete consultancy", "Around 20 lakh"] },
  { key: "D", name: "D — Tractor rental for 2 days", language: "en", script: ["I want to rent a tractor for 2 days"] },
  { key: "E", name: "E — Budget too low (NPR 30,000 tiller)", language: "en", script: ["I need a power tiller", "30000"] },
  { key: "A-ne", name: "A (नेपाली) — पावर टिलर", language: "ne", script: ["मलाई पावर टिलर चाहिन्छ", "१ लाख २० हजार", "पहाडी", "८ रोपनी"] },
];

export default function AiDemoPage() {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<ScenarioResult[]>([]);

  function runScenario(key: string) {
    const scenario = SCENARIOS.find((item) => item.key === key);
    if (!scenario || running) return;
    setRunning(key);
    const engine = new MockConversationEngine(scenario.language);
    const steps: ScenarioStep[] = [];
    engine.greet();
    for (const line of scenario.script) {
      const reply = engine.reply(line);
      steps.push({ user: line, assistant: reply.text.split("\n")[0] });
    }
    const stateJson = JSON.stringify(engine.getState(), null, 2);
    window.setTimeout(() => {
      setResults((current) => [...current.filter((item) => item.name !== scenario.name), { name: scenario.name, steps, stateJson }]);
      setRunning(null);
    }, 250);
  }

  const demoPoints = useMemo(
    () => [
      "Bilingual Nepali / English conversations with language switch mid-chat (state is preserved).",
      "Budget understanding: 1.2 lakh, डेढ लाख, १ लाख २० हजार, 80 hajar and plain numerals.",
      "Product recommendations: suitability first, then budget fit, then availability — max 3, over-budget items flagged with the excess.",
      "Professional matching for projects (hatchery example) by discipline and skills.",
      "Browser-native voice input (ne-NP / en-US) and read-aloud where the browser supports it — no paid speech APIs.",
      "Demo data only: no orders, no inventory changes, no private data, no recordings stored.",
    ],
    [],
  );

  return (
    <main className="aidemo-page">
      <section className="aidemo-hero site-container">
        <p className="eyebrow">Prototype · isolated demo route</p>
        <h1>
          khetE <em>कृषि साथी</em> — AI assistant prototype
        </h1>
        <p>
          A free, bilingual (Nepali / English) agricultural shopping and services assistant. This page hosts the prototype in isolation:
          the floating launcher below previews how the assistant would appear on the live website once approved. All responses are simulated
          by a local rule-based engine — no paid AI APIs are called.
        </p>
        <span className="aidemo-pill">Simulated conversation engine — not a live language model</span>
      </section>

      <section className="aidemo-grid site-container">
        <article className="aidemo-panel">
          <h2>What the prototype covers</h2>
          <ul>
            {demoPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <h2>How production AI connects later</h2>
          <p>
            Every capability is hidden behind an interface in <code>lib/ai-chat/types.ts</code>: the mock conversation engine is swapped for
            <strong> Gemini 2.5 Flash-Lite</strong>, the browser speech recognizer for <strong>Groq Whisper</strong>, and browser speech synthesis for a
            tested Nepali TTS provider. Product and professional search stay deterministic and server-authorized, so the AI never receives the
            whole catalog.
          </p>
        </article>

        <article className="aidemo-panel">
          <h2>
            <FlaskConical size={18} /> Developer test panel — replay scenarios
          </h2>
          <p>Runs a scripted conversation through the mock engine and shows the extracted constraints it accumulated.</p>
          <div className="aidemo-scenarios">
            {SCENARIOS.map((scenario) => (
              <button key={scenario.key} type="button" disabled={running !== null} onClick={() => runScenario(scenario.key)}>
                <Play size={14} /> {scenario.name}
              </button>
            ))}
          </div>
          {results.map((result) => (
            <details key={result.name} className="aidemo-result" open>
              <summary>{result.name}</summary>
              <ol>
                {result.steps.map((step) => (
                  <li key={step.user}>
                    <strong>You:</strong> {step.user}
                    <br />
                    <strong>Assistant:</strong> {step.assistant}
                  </li>
                ))}
              </ol>
              <pre>{result.stateJson}</pre>
            </details>
          ))}
        </article>
      </section>

      <KhetSathiChat />
    </main>
  );
}
