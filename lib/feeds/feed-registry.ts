import { type BaseFeedAdapter } from "@/lib/feeds/base-adapter";
import {
  IowaDotWzdxAdapter,
  NcDotWzdxAdapter,
  MassDotWzdxAdapter,
  MnDotWzdxAdapter,
  WiDotWzdxAdapter,
  InDotWzdxAdapter,
  MoDotWzdxAdapter,
  NyDotWzdxAdapter,
  MdDotWzdxAdapter,
  WaDotWzdxAdapter,
  UtDotWzdxAdapter,
  KyDotWzdxAdapter,
  IdDotWzdxAdapter,
  NjWzdxAdapter,
  DeDotWzdxAdapter,
  NmDotWzdxAdapter,
  LaDotdWzdxAdapter,
  KsDotWzdxAdapter,
} from "@/lib/feeds/adapters/wzdx-adapter";

/**
 * Central registry of all active road event feed adapters.
 *
 * This is the ONLY file that imports concrete adapter classes.
 * To add a new state feed:
 *   1. Create /lib/feeds/adapters/{state}-adapter.ts
 *   2. Add one import + one array entry here
 *   3. Done — the scheduler picks it up automatically
 */
const FEED_REGISTRY: BaseFeedAdapter[] = [
  new IowaDotWzdxAdapter(),
  new NcDotWzdxAdapter(),
  new MassDotWzdxAdapter(),
  new MnDotWzdxAdapter(),
  new WiDotWzdxAdapter(),
  new InDotWzdxAdapter(),
  new MoDotWzdxAdapter(),
  new NyDotWzdxAdapter(),
  new MdDotWzdxAdapter(),
  new WaDotWzdxAdapter(),
  new UtDotWzdxAdapter(),
  new KyDotWzdxAdapter(),
  new IdDotWzdxAdapter(),
  new NjWzdxAdapter(),
  new DeDotWzdxAdapter(),
  new NmDotWzdxAdapter(),
  new LaDotdWzdxAdapter(),
  new KsDotWzdxAdapter(),
];

export function getAllAdapters(): BaseFeedAdapter[] {
  return FEED_REGISTRY;
}

export function getAdapterByName(name: string): BaseFeedAdapter | undefined {
  return FEED_REGISTRY.find((a) => a.feedName === name);
}

export function getAllFeedNames(): string[] {
  return FEED_REGISTRY.map((a) => a.feedName);
}
