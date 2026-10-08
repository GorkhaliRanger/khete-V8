"use client";

import { useState, useSyncExternalStore } from "react";

export function IntroGate() {
  const [dismissed, setDismissed] = useState(false);
  const unseenThisSession = useSyncExternalStore(
    () => () => undefined,
    () => sessionStorage.getItem("khete-intro-seen") !== "yes",
    () => false,
  );

  const enter = () => {
    sessionStorage.setItem("khete-intro-seen", "yes");
    setDismissed(true);
  };

  if (!unseenThisSession || dismissed) return null;

  return (
    <button className="intro-gate" type="button" onClick={enter} aria-label="Enter khetE marketplace">
      <span className="intro-sun" aria-hidden="true" />
      <span className="intro-glow intro-glow-one" />
      <span className="intro-glow intro-glow-two" />
      <span className="intro-field intro-field-one" aria-hidden="true" />
      <span className="intro-field intro-field-two" aria-hidden="true" />
      <span className="intro-content">
        <span className="intro-kicker">Nepal&apos;s agricultural marketplace</span>
        <span className="intro-mark">
          <span className="intro-logo" role="img" aria-label="khetE" />
        </span>
        <strong>Everything agriculture, closer to you.</strong>
        <span className="intro-description">
          Fresh produce, farm machinery, livestock and trusted agricultural services in one place.
        </span>
        <em><span aria-hidden="true" />Click anywhere to enter</em>
      </span>
    </button>
  );
}
