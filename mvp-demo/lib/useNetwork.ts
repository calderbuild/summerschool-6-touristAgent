"use client";

import { useEffect, useState } from "react";
import type { NetworkFacts } from "./idfm";

/**
 * The operator's accessibility record, fetched once per page load and shared by
 * every component that asks for it.
 *
 * The promise is held at module scope rather than in state because the spine and
 * the map card both want the same answer, and two requests for one 60KB dataset
 * on a phone is a waste nobody would see but everybody would pay for.
 */
let inFlight: Promise<NetworkFacts | null> | null = null;

function load(): Promise<NetworkFacts | null> {
  inFlight ??= fetch("/api/network")
    .then((res) => (res.ok ? (res.json() as Promise<NetworkFacts>) : null))
    .catch(() => null);
  return inFlight;
}

export type NetworkState = "loading" | "ready" | "unavailable";

export function useNetworkFacts(): { facts: NetworkFacts | null; state: NetworkState } {
  const [facts, setFacts] = useState<NetworkFacts | null>(null);
  const [state, setState] = useState<NetworkState>("loading");

  useEffect(() => {
    let live = true;
    load().then((value) => {
      if (!live) return;
      // An unreachable dataset is reported as unavailable, never as an empty
      // record: "no toilet here" and "we could not ask" are different answers.
      if (value) {
        setFacts(value);
        setState("ready");
      } else {
        setState("unavailable");
      }
    });
    return () => {
      live = false;
    };
  }, []);

  return { facts, state };
}
