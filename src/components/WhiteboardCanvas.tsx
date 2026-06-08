import { useMemo, useState, useEffect } from "react";

export type IconName =
  | "brain" | "bulb" | "box" | "stick" | "chart" | "star"
  | "ship" | "mountain" | "castle" | "mosque" | "crown"
  | "king" | "queen" | "sword" | "flag" | "tower"
  | "scroll" | "book" | "sun" | "tree" | "globe"
  | "scale" | "horse" | "shield" | "gear" | "heart"
  | "rocket" | "computer" | "person" | "money" | "clock"
  | "target" | "document" | "megaphone" | "cloud" | "phone"
  | "robot" | "leaf" | "fire" | "lock" | "key" | "chat"
  | "checkmark" | "cross" | "question" | "house" | "car"
  | "graph" | "pencil" | "camera" | "music"
  | "mail" | "calendar" | "search" | "settings" | "trophy"
  | "gift" | "bag" | "cart" | "bell" | "users"
  | "puzzle" | "plane" | "bolt" | "moon" | "coffee"
  | "smile" | "atom" | "flask" | "magnet" | "wand"
  | "battery" | "wifi" | "droplet" | "snowflake" | "umbrella"
  | "pizza" | "bicycle" | "factory" | "school" | "hospital";

export type TimelineItem =
  | {
      type: "text";
      content: string;
      x: number;
      y: number;
      delay?: number;
      duration?: number;
      size?: number;
      scene?: number;
      color?: string;
      align?: "left" | "center" | "right";
    }
  | {
      type: "title";
      content: string;
      delay?: number;
      duration?: number;
      size?: number;
      scene?: number;
    }
  | {
      type: "caption";
      content: string;
      delay?: number;
      duration?: number;
      position?: "bottom-left" | "bottom-right" | "top-right";
      scene?: number;
    }
  | {
      type: "icon";
      name: IconName;
      x: number;
      y: number;
      delay?: number;
      duration?: number;
      size?: number;
      label?: string;
      scene?: number;
      color?: string;
    }
  | {
      type: "arrow";
      from: [number, number];
      to: [number, number];
      delay?: number;
      duration?: number;
      curve?: number;
      scene?: number;
    }
  | {
      type: "circle";
      x: number;
      y: number;
      r: number;
      delay?: number;
      duration?: number;
      scene?: number;
      color?: string;
    }
  | {
      type: "underline";
      from: [number, number];
      to: [number, number];
      delay?: number;
      duration?: number;
      scene?: number;
    };

export interface WhiteboardCanvasProps {
  timeline: TimelineItem[];
  mode?: "marker" | "chalk" | "sketch";
  loop?: boolean;
  className?: string;
}

const WIDTH = 1920;
const HEIGHT = 1080;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Default color palette per icon (warm illustration look)
const ICON_COLORS: Record<string, string> = {
  ship: "#2a4d6e",
  mountain: "#d6b785",
  castle: "#c97b63",
  mosque: "#3aa57a",
  crown: "#e8b54a",
  king: "#c8423a",
  queen: "#8d4ea0",
  sword: "#9aa3ad",
  flag: "#2f8f4e",
  tower: "#6b8caf",
  scroll: "#e8d8a8",
  book: "#7b4a2a",
  sun: "#f2b134",
  tree: "#3d8a4a",
  globe: "#4a90c4",
  scale: "#b58a3d",
  horse: "#7a5a3a",
  shield: "#4a6fa5",
  gear: "#7a7f87",
  heart: "#d94a5c",
  brain: "#e88aab",
  bulb: "#f2c94c",
  box: "#a0a0a0",
  stick: "#1a1a1a",
  chart: "#4a90c4",
  star: "#f2b134",
  rocket: "#e85d3a",
  computer: "#5b6b7d",
  person: "#4a90c4",
  money: "#3d8a4a",
  clock: "#e88aab",
  target: "#d94a5c",
  document: "#f5f5f0",
  megaphone: "#f2b134",
  cloud: "#a8c5dc",
  phone: "#3d8a4a",
  robot: "#6b8caf",
  leaf: "#3d8a4a",
  fire: "#e85d3a",
  lock: "#7a7f87",
  key: "#e8b54a",
  chat: "#4a90c4",
  checkmark: "#3d8a4a",
  cross: "#d94a5c",
  question: "#8d4ea0",
  house: "#c97b63",
  car: "#d94a5c",
  graph: "#4a90c4",
  pencil: "#f2b134",
  camera: "#5b6b7d",
  music: "#8d4ea0",
  mail: "#4a90c4",
  calendar: "#d94a5c",
  search: "#5b6b7d",
  settings: "#7a7f87",
  trophy: "#e8b54a",
  gift: "#d94a5c",
  bag: "#7b4a2a",
  cart: "#3d8a4a",
  bell: "#f2b134",
  users: "#4a90c4",
  puzzle: "#8d4ea0",
  plane: "#5b6b7d",
  bolt: "#f2c94c",
  moon: "#a8c5dc",
  coffee: "#7b4a2a",
  smile: "#f2b134",
  atom: "#4a90c4",
  flask: "#3aa57a",
  magnet: "#d94a5c",
  wand: "#8d4ea0",
  battery: "#3d8a4a",
  wifi: "#4a90c4",
  droplet: "#4a90c4",
  snowflake: "#a8c5dc",
  umbrella: "#d94a5c",
  pizza: "#e85d3a",
  bicycle: "#5b6b7d",
  factory: "#7a7f87",
  school: "#c97b63",
  hospital: "#d94a5c",
};

// Returns an array of "parts" (filled shape, stroked path, etc.)
// Each part is rendered sequentially so the icon "builds up" like a hand drawing.
type IconPart =
  | { kind: "fill"; d: string; fill: string; stroke?: string }
  | { kind: "stroke"; d: string; stroke?: string; width?: number };

function iconParts(name: IconName, size: number, color: string, ink: string): IconPart[] {
  const s = size;
  switch (name) {
    case "ship":
      return [
        { kind: "fill", d: `M ${-s*0.6} ${s*0.15} L ${s*0.6} ${s*0.15} L ${s*0.45} ${s*0.45} L ${-s*0.45} ${s*0.45} Z`, fill: color },
        { kind: "stroke", d: `M 0 ${s*0.15} L 0 ${-s*0.55}` },
        { kind: "fill", d: `M 0 ${-s*0.55} L ${s*0.35} ${-s*0.1} L 0 ${-s*0.1} Z`, fill: "#fafafa" },
        { kind: "fill", d: `M 0 ${-s*0.55} L ${-s*0.32} ${-s*0.1} L 0 ${-s*0.1} Z`, fill: "#fafafa" },
        { kind: "stroke", d: `M ${-s*0.75} ${s*0.55} q ${s*0.2} ${-s*0.1} ${s*0.4} 0 t ${s*0.4} 0 t ${s*0.4} 0`, width: 4 },
      ];
    case "mountain":
      return [
        { kind: "fill", d: `M ${-s*0.6} ${s*0.45} L ${-s*0.1} ${-s*0.35} L ${s*0.25} ${s*0.05} L ${s*0.5} ${-s*0.15} L ${s*0.65} ${s*0.45} Z`, fill: color },
        { kind: "fill", d: `M ${-s*0.2} ${-s*0.18} L ${-s*0.1} ${-s*0.35} L ${0} ${-s*0.18} Z`, fill: "#ffffff" },
      ];
    case "castle":
      return [
        { kind: "fill", d: `M ${-s*0.5} ${-s*0.2} L ${-s*0.5} ${s*0.5} L ${s*0.5} ${s*0.5} L ${s*0.5} ${-s*0.2} L ${s*0.35} ${-s*0.2} L ${s*0.35} ${-s*0.05} L ${s*0.15} ${-s*0.05} L ${s*0.15} ${-s*0.2} L ${-s*0.15} ${-s*0.2} L ${-s*0.15} ${-s*0.05} L ${-s*0.35} ${-s*0.05} L ${-s*0.35} ${-s*0.2} Z`, fill: color },
        { kind: "fill", d: `M ${-s*0.1} ${s*0.15} L ${-s*0.1} ${s*0.5} L ${s*0.1} ${s*0.5} L ${s*0.1} ${s*0.15} Z`, fill: "#3a2a1a" },
      ];
    case "mosque":
      return [
        { kind: "fill", d: `M ${-s*0.5} ${s*0.5} L ${-s*0.5} ${-s*0.05} L ${s*0.5} ${-s*0.05} L ${s*0.5} ${s*0.5} Z`, fill: "#f5f5f0", stroke: ink },
        { kind: "fill", d: `M 0 ${-s*0.55} a ${s*0.35} ${s*0.35} 0 1 0 0.01 0 Z`, fill: color },
        { kind: "stroke", d: `M 0 ${-s*0.62} L 0 ${-s*0.78} M ${-s*0.05} ${-s*0.72} a ${s*0.05} ${s*0.05} 0 1 0 ${s*0.1} 0`, width: 3 },
        { kind: "fill", d: `M ${-s*0.5} ${-s*0.05} a ${s*0.08} ${s*0.15} 0 1 0 ${-s*0.16} 0 L ${-s*0.66} ${s*0.5} L ${-s*0.5} ${s*0.5} Z`, fill: color },
        { kind: "fill", d: `M ${s*0.5} ${-s*0.05} a ${s*0.08} ${s*0.15} 0 1 1 ${s*0.16} 0 L ${s*0.66} ${s*0.5} L ${s*0.5} ${s*0.5} Z`, fill: color },
      ];
    case "crown":
      return [
        { kind: "fill", d: `M ${-s*0.5} ${s*0.3} L ${-s*0.5} ${-s*0.2} L ${-s*0.25} ${s*0.05} L 0 ${-s*0.35} L ${s*0.25} ${s*0.05} L ${s*0.5} ${-s*0.2} L ${s*0.5} ${s*0.3} Z`, fill: color },
        { kind: "fill", d: `M ${-s*0.45} ${-s*0.18} a ${s*0.06} ${s*0.06} 0 1 0 0.01 0`, fill: "#c0392b" },
        { kind: "fill", d: `M ${s*0.45} ${-s*0.18} a ${s*0.06} ${s*0.06} 0 1 0 0.01 0`, fill: "#c0392b" },
        { kind: "fill", d: `M 0 ${-s*0.33} a ${s*0.06} ${s*0.06} 0 1 0 0.01 0`, fill: "#c0392b" },
      ];
    case "king":
    case "queen": {
      const robe = name === "king" ? color : "#8d4ea0";
      return [
        { kind: "fill", d: `M 0 ${-s*0.25} a ${s*0.18} ${s*0.18} 0 1 0 0.01 0 Z`, fill: "#f5d6b0" },
        { kind: "fill", d: `M ${-s*0.18} ${-s*0.45} L ${-s*0.18} ${-s*0.3} L ${-s*0.05} ${-s*0.4} L 0 ${-s*0.5} L ${s*0.05} ${-s*0.4} L ${s*0.18} ${-s*0.3} L ${s*0.18} ${-s*0.45} Z`, fill: "#e8b54a" },
        { kind: "fill", d: `M ${-s*0.3} ${s*0.55} L ${-s*0.25} ${-s*0.05} Q 0 ${-s*0.18} ${s*0.25} ${-s*0.05} L ${s*0.3} ${s*0.55} Z`, fill: robe },
      ];
    }
    case "sword":
      return [
        { kind: "fill", d: `M ${-s*0.05} ${-s*0.5} L ${s*0.05} ${-s*0.5} L ${s*0.05} ${s*0.2} L ${-s*0.05} ${s*0.2} Z`, fill: "#cfd6dc" },
        { kind: "fill", d: `M ${-s*0.2} ${s*0.18} L ${s*0.2} ${s*0.18} L ${s*0.2} ${s*0.26} L ${-s*0.2} ${s*0.26} Z`, fill: color },
        { kind: "fill", d: `M ${-s*0.05} ${s*0.26} L ${s*0.05} ${s*0.26} L ${s*0.05} ${s*0.5} L ${-s*0.05} ${s*0.5} Z`, fill: color },
      ];
    case "flag":
      return [
        { kind: "stroke", d: `M ${-s*0.35} ${-s*0.5} L ${-s*0.35} ${s*0.5}`, width: 4 },
        { kind: "fill", d: `M ${-s*0.35} ${-s*0.5} L ${s*0.45} ${-s*0.35} L ${-s*0.35} ${-s*0.1} Z`, fill: color },
      ];
    case "tower":
      return [
        { kind: "fill", d: `M ${-s*0.3} ${s*0.5} L ${-s*0.3} ${-s*0.3} L ${-s*0.4} ${-s*0.3} L 0 ${-s*0.55} L ${s*0.4} ${-s*0.3} L ${s*0.3} ${-s*0.3} L ${s*0.3} ${s*0.5} Z`, fill: color },
      ];
    case "scroll":
      return [
        { kind: "fill", d: `M ${-s*0.45} ${-s*0.35} L ${s*0.45} ${-s*0.35} L ${s*0.45} ${s*0.35} L ${-s*0.45} ${s*0.35} Z`, fill: color },
        { kind: "stroke", d: `M ${-s*0.3} ${-s*0.15} L ${s*0.3} ${-s*0.15} M ${-s*0.3} 0 L ${s*0.3} 0 M ${-s*0.3} ${s*0.15} L ${s*0.15} ${s*0.15}`, width: 3 },
      ];
    case "book":
      return [
        { kind: "fill", d: `M ${-s*0.45} ${-s*0.4} L ${s*0.45} ${-s*0.4} L ${s*0.45} ${s*0.4} L ${-s*0.45} ${s*0.4} Z`, fill: color },
        { kind: "stroke", d: `M 0 ${-s*0.4} L 0 ${s*0.4}`, width: 3 },
      ];
    case "sun":
      return [
        { kind: "fill", d: `M 0 ${-s*0.3} a ${s*0.3} ${s*0.3} 0 1 0 0.01 0 Z`, fill: color },
        { kind: "stroke", d: `M 0 ${-s*0.5} L 0 ${-s*0.4} M 0 ${s*0.5} L 0 ${s*0.4} M ${-s*0.5} 0 L ${-s*0.4} 0 M ${s*0.5} 0 L ${s*0.4} 0 M ${-s*0.36} ${-s*0.36} L ${-s*0.28} ${-s*0.28} M ${s*0.36} ${-s*0.36} L ${s*0.28} ${-s*0.28} M ${-s*0.36} ${s*0.36} L ${-s*0.28} ${s*0.28} M ${s*0.36} ${s*0.36} L ${s*0.28} ${s*0.28}`, width: 4 },
      ];
    case "tree":
      return [
        { kind: "fill", d: `M ${-s*0.07} ${s*0.5} L ${-s*0.07} ${s*0.15} L ${s*0.07} ${s*0.15} L ${s*0.07} ${s*0.5} Z`, fill: "#6b4423" },
        { kind: "fill", d: `M 0 ${-s*0.5} a ${s*0.35} ${s*0.35} 0 1 0 0.01 0 Z`, fill: color },
      ];
    case "globe":
      return [
        { kind: "fill", d: `M 0 ${-s*0.45} a ${s*0.45} ${s*0.45} 0 1 0 0.01 0 Z`, fill: color },
        { kind: "stroke", d: `M ${-s*0.45} 0 L ${s*0.45} 0 M 0 ${-s*0.45} q ${s*0.25} ${s*0.45} 0 ${s*0.9} M 0 ${-s*0.45} q ${-s*0.25} ${s*0.45} 0 ${s*0.9}`, width: 3 },
      ];
    case "scale":
      return [
        { kind: "stroke", d: `M 0 ${-s*0.5} L 0 ${s*0.4} M ${-s*0.4} ${-s*0.4} L ${s*0.4} ${-s*0.4} M ${-s*0.18} ${s*0.4} L ${s*0.18} ${s*0.4}`, width: 4 },
        { kind: "fill", d: `M ${-s*0.55} ${-s*0.4} L ${-s*0.25} ${-s*0.4} L ${-s*0.3} ${-s*0.2} L ${-s*0.5} ${-s*0.2} Z`, fill: color },
        { kind: "fill", d: `M ${s*0.25} ${-s*0.4} L ${s*0.55} ${-s*0.4} L ${s*0.5} ${-s*0.2} L ${s*0.3} ${-s*0.2} Z`, fill: color },
      ];
    case "horse":
      return [
        { kind: "fill", d: `M ${-s*0.4} ${s*0.1} L ${s*0.3} ${s*0.1} L ${s*0.3} ${s*0.35} L ${s*0.18} ${s*0.35} L ${s*0.18} ${s*0.5} L ${s*0.05} ${s*0.5} L ${s*0.05} ${s*0.35} L ${-s*0.25} ${s*0.35} L ${-s*0.25} ${s*0.5} L ${-s*0.38} ${s*0.5} L ${-s*0.38} ${s*0.35} L ${-s*0.4} ${s*0.35} Z`, fill: color },
        { kind: "fill", d: `M ${s*0.3} ${-s*0.05} L ${s*0.45} ${-s*0.2} L ${s*0.5} ${s*0.1} L ${s*0.3} ${s*0.15} Z`, fill: color },
      ];
    case "shield":
      return [
        { kind: "fill", d: `M 0 ${-s*0.5} L ${s*0.4} ${-s*0.35} L ${s*0.35} ${s*0.2} L 0 ${s*0.5} L ${-s*0.35} ${s*0.2} L ${-s*0.4} ${-s*0.35} Z`, fill: color },
        { kind: "stroke", d: `M 0 ${-s*0.3} L 0 ${s*0.2} M ${-s*0.2} ${-s*0.05} L ${s*0.2} ${-s*0.05}`, width: 4 },
      ];
    case "gear":
      return [
        { kind: "fill", d: `M 0 ${-s*0.45} L ${s*0.08} ${-s*0.4} L ${s*0.18} ${-s*0.42} L ${s*0.22} ${-s*0.3} L ${s*0.35} ${-s*0.25} L ${s*0.32} ${-s*0.12} L ${s*0.42} ${0} L ${s*0.32} ${s*0.12} L ${s*0.35} ${s*0.25} L ${s*0.22} ${s*0.3} L ${s*0.18} ${s*0.42} L ${s*0.08} ${s*0.4} L 0 ${s*0.45} L ${-s*0.08} ${s*0.4} L ${-s*0.18} ${s*0.42} L ${-s*0.22} ${s*0.3} L ${-s*0.35} ${s*0.25} L ${-s*0.32} ${s*0.12} L ${-s*0.42} 0 L ${-s*0.32} ${-s*0.12} L ${-s*0.35} ${-s*0.25} L ${-s*0.22} ${-s*0.3} L ${-s*0.18} ${-s*0.42} L ${-s*0.08} ${-s*0.4} Z`, fill: color },
        { kind: "fill", d: `M 0 ${-s*0.15} a ${s*0.15} ${s*0.15} 0 1 0 0.01 0 Z`, fill: "#fafaf5" },
      ];
    case "heart":
      return [
        { kind: "fill", d: `M 0 ${s*0.4} C ${-s*0.55} ${s*0.05} ${-s*0.5} ${-s*0.4} ${-s*0.2} ${-s*0.4} C ${-s*0.05} ${-s*0.4} 0 ${-s*0.2} 0 ${-s*0.15} C 0 ${-s*0.2} ${s*0.05} ${-s*0.4} ${s*0.2} ${-s*0.4} C ${s*0.5} ${-s*0.4} ${s*0.55} ${s*0.05} 0 ${s*0.4} Z`, fill: color },
      ];
    case "brain":
      return [
        { kind: "fill", d: `M ${-s*0.4} 0 q ${-s*0.15} ${-s*0.4} ${s*0.1} ${-s*0.5} q ${s*0.2} ${-s*0.1} ${s*0.25} ${s*0.1} q ${s*0.25} ${-s*0.2} ${s*0.45} 0 q ${s*0.2} ${s*0.15} ${s*0.05} ${s*0.35} q ${s*0.05} ${s*0.25} ${-s*0.15} ${s*0.3} q ${-s*0.2} ${s*0.15} ${-s*0.4} 0 q ${-s*0.25} ${-s*0.05} ${-s*0.25} ${-s*0.25} q ${-s*0.2} ${-s*0.05} ${-s*0.1} ${-s*0.25} Z`, fill: color },
      ];
    case "bulb":
      return [
        { kind: "fill", d: `M ${-s*0.35} ${-s*0.05} a ${s*0.4} ${s*0.4} 0 1 1 ${s*0.7} 0 q -${s*0.05} ${s*0.2} -${s*0.15} ${s*0.3} l 0 ${s*0.2} l -${s*0.4} 0 l 0 -${s*0.2} q -${s*0.1} -${s*0.1} -${s*0.15} -${s*0.3} z`, fill: color },
        { kind: "stroke", d: `M ${-s*0.2} ${s*0.5} l ${s*0.4} 0 M ${-s*0.15} ${s*0.62} l ${s*0.3} 0`, width: 4 },
      ];
    case "box":
      return [
        { kind: "fill", d: `M ${-s*0.5} ${-s*0.5} L ${s*0.5} ${-s*0.5} L ${s*0.5} ${s*0.5} L ${-s*0.5} ${s*0.5} Z`, fill: color },
      ];
    case "chart":
      return [
        { kind: "stroke", d: `M ${-s*0.5} ${s*0.5} L ${-s*0.5} ${-s*0.5} M ${-s*0.5} ${s*0.5} L ${s*0.5} ${s*0.5}`, width: 4 },
        { kind: "fill", d: `M ${-s*0.35} ${s*0.5} L ${-s*0.35} ${s*0.15} L ${-s*0.18} ${s*0.15} L ${-s*0.18} ${s*0.5} Z`, fill: color },
        { kind: "fill", d: `M ${-s*0.08} ${s*0.5} L ${-s*0.08} ${-s*0.05} L ${s*0.08} ${-s*0.05} L ${s*0.08} ${s*0.5} Z`, fill: color },
        { kind: "fill", d: `M ${s*0.18} ${s*0.5} L ${s*0.18} ${-s*0.25} L ${s*0.35} ${-s*0.25} L ${s*0.35} ${s*0.5} Z`, fill: color },
      ];
    case "star":
      return [
        { kind: "fill", d: `M 0 ${-s*0.5} L ${s*0.15} ${-s*0.15} L ${s*0.5} ${-s*0.1} L ${s*0.22} ${s*0.12} L ${s*0.3} ${s*0.45} L 0 ${s*0.27} L ${-s*0.3} ${s*0.45} L ${-s*0.22} ${s*0.12} L ${-s*0.5} ${-s*0.1} L ${-s*0.15} ${-s*0.15} Z`, fill: color },
      ];
    case "rocket":
      return [
        { kind: "fill", d: `M 0 ${-s*0.5} C ${s*0.2} ${-s*0.3} ${s*0.2} ${s*0.1} ${s*0.15} ${s*0.3} L ${-s*0.15} ${s*0.3} C ${-s*0.2} ${s*0.1} ${-s*0.2} ${-s*0.3} 0 ${-s*0.5} Z`, fill: color },
        { kind: "fill", d: `M 0 ${-s*0.1} a ${s*0.08} ${s*0.08} 0 1 0 0.01 0 Z`, fill: "#a8c5dc" },
        { kind: "fill", d: `M ${-s*0.15} ${s*0.3} L ${-s*0.35} ${s*0.45} L ${-s*0.1} ${s*0.3} Z`, fill: "#e85d3a" },
        { kind: "fill", d: `M ${s*0.15} ${s*0.3} L ${s*0.35} ${s*0.45} L ${s*0.1} ${s*0.3} Z`, fill: "#e85d3a" },
        { kind: "stroke", d: `M ${-s*0.08} ${s*0.35} L ${-s*0.12} ${s*0.5} M 0 ${s*0.35} L 0 ${s*0.55} M ${s*0.08} ${s*0.35} L ${s*0.12} ${s*0.5}`, stroke: "#f2b134", width: 5 },
      ];
    case "computer":
      return [
        { kind: "fill", d: `M ${-s*0.5} ${-s*0.4} L ${s*0.5} ${-s*0.4} L ${s*0.5} ${s*0.2} L ${-s*0.5} ${s*0.2} Z`, fill: color },
        { kind: "fill", d: `M ${-s*0.42} ${-s*0.32} L ${s*0.42} ${-s*0.32} L ${s*0.42} ${s*0.12} L ${-s*0.42} ${s*0.12} Z`, fill: "#a8d5e8" },
        { kind: "fill", d: `M ${-s*0.6} ${s*0.3} L ${s*0.6} ${s*0.3} L ${s*0.5} ${s*0.4} L ${-s*0.5} ${s*0.4} Z`, fill: color },
      ];
    case "person":
      return [
        { kind: "fill", d: `M 0 ${-s*0.3} a ${s*0.18} ${s*0.18} 0 1 0 0.01 0 Z`, fill: "#f5d6b0" },
        { kind: "fill", d: `M ${-s*0.3} ${s*0.5} Q ${-s*0.3} ${-s*0.05} 0 ${-s*0.1} Q ${s*0.3} ${-s*0.05} ${s*0.3} ${s*0.5} Z`, fill: color },
      ];
    case "money":
      return [
        { kind: "fill", d: `M ${-s*0.45} ${-s*0.3} L ${s*0.45} ${-s*0.3} L ${s*0.45} ${s*0.3} L ${-s*0.45} ${s*0.3} Z`, fill: color },
        { kind: "fill", d: `M 0 0 a ${s*0.18} ${s*0.18} 0 1 0 0.01 0 Z`, fill: "#f5f5d0" },
        { kind: "stroke", d: `M ${-s*0.05} ${-s*0.13} L ${s*0.05} ${-s*0.13} L 0 ${-s*0.13} L 0 ${s*0.13} L ${-s*0.05} ${s*0.13} L ${s*0.05} ${s*0.13}`, width: 4 },
      ];
    case "clock":
      return [
        { kind: "fill", d: `M 0 ${-s*0.45} a ${s*0.45} ${s*0.45} 0 1 0 0.01 0 Z`, fill: "#fafaf5", stroke: ink },
        { kind: "stroke", d: `M 0 0 L 0 ${-s*0.3} M 0 0 L ${s*0.2} ${s*0.1}`, width: 5 },
        { kind: "fill", d: `M 0 0 a ${s*0.04} ${s*0.04} 0 1 0 0.01 0 Z`, fill: color },
      ];
    case "target":
      return [
        { kind: "fill", d: `M 0 ${-s*0.45} a ${s*0.45} ${s*0.45} 0 1 0 0.01 0 Z`, fill: color },
        { kind: "fill", d: `M 0 ${-s*0.3} a ${s*0.3} ${s*0.3} 0 1 0 0.01 0 Z`, fill: "#fafaf5" },
        { kind: "fill", d: `M 0 ${-s*0.15} a ${s*0.15} ${s*0.15} 0 1 0 0.01 0 Z`, fill: color },
      ];
    case "document":
      return [
        { kind: "fill", d: `M ${-s*0.35} ${-s*0.5} L ${s*0.2} ${-s*0.5} L ${s*0.35} ${-s*0.35} L ${s*0.35} ${s*0.5} L ${-s*0.35} ${s*0.5} Z`, fill: color, stroke: ink },
        { kind: "stroke", d: `M ${-s*0.2} ${-s*0.15} L ${s*0.2} ${-s*0.15} M ${-s*0.2} 0 L ${s*0.2} 0 M ${-s*0.2} ${s*0.15} L ${s*0.1} ${s*0.15}`, width: 3 },
      ];
    case "megaphone":
      return [
        { kind: "fill", d: `M ${-s*0.4} ${-s*0.2} L ${s*0.3} ${-s*0.4} L ${s*0.3} ${s*0.4} L ${-s*0.4} ${s*0.2} Z`, fill: color },
        { kind: "fill", d: `M ${s*0.3} ${-s*0.3} L ${s*0.45} ${-s*0.3} L ${s*0.45} ${s*0.3} L ${s*0.3} ${s*0.3} Z`, fill: "#7a4a2a" },
        { kind: "stroke", d: `M ${-s*0.5} ${-s*0.4} L ${-s*0.55} ${-s*0.5} M ${-s*0.55} 0 L ${-s*0.7} 0 M ${-s*0.5} ${s*0.4} L ${-s*0.55} ${s*0.5}`, width: 4 },
      ];
    case "cloud":
      return [
        { kind: "fill", d: `M ${-s*0.4} ${s*0.1} a ${s*0.2} ${s*0.2} 0 0 1 ${s*0.15} ${-s*0.3} a ${s*0.22} ${s*0.22} 0 0 1 ${s*0.4} ${-s*0.05} a ${s*0.2} ${s*0.2} 0 0 1 ${s*0.2} ${s*0.35} Z`, fill: color },
      ];
    case "phone":
      return [
        { kind: "fill", d: `M ${-s*0.25} ${-s*0.5} L ${s*0.25} ${-s*0.5} L ${s*0.25} ${s*0.5} L ${-s*0.25} ${s*0.5} Z`, fill: color },
        { kind: "fill", d: `M ${-s*0.2} ${-s*0.4} L ${s*0.2} ${-s*0.4} L ${s*0.2} ${s*0.35} L ${-s*0.2} ${s*0.35} Z`, fill: "#a8d5e8" },
        { kind: "fill", d: `M 0 ${s*0.42} a ${s*0.04} ${s*0.04} 0 1 0 0.01 0 Z`, fill: "#fafaf5" },
      ];
    case "robot":
      return [
        { kind: "fill", d: `M ${-s*0.3} ${-s*0.4} L ${s*0.3} ${-s*0.4} L ${s*0.3} ${s*0.1} L ${-s*0.3} ${s*0.1} Z`, fill: color },
        { kind: "fill", d: `M ${-s*0.2} ${-s*0.25} a ${s*0.06} ${s*0.06} 0 1 0 0.01 0 Z`, fill: "#fafaf5" },
        { kind: "fill", d: `M ${s*0.2} ${-s*0.25} a ${s*0.06} ${s*0.06} 0 1 0 0.01 0 Z`, fill: "#fafaf5" },
        { kind: "stroke", d: `M ${-s*0.1} ${-s*0.08} L ${s*0.1} ${-s*0.08}`, width: 4 },
        { kind: "fill", d: `M ${-s*0.4} ${s*0.1} L ${s*0.4} ${s*0.1} L ${s*0.4} ${s*0.4} L ${-s*0.4} ${s*0.4} Z`, fill: color },
        { kind: "stroke", d: `M 0 ${-s*0.4} L 0 ${-s*0.55} M ${-s*0.04} ${-s*0.55} a ${s*0.04} ${s*0.04} 0 1 0 ${s*0.08} 0`, width: 3 },
      ];
    case "leaf":
      return [
        { kind: "fill", d: `M ${-s*0.3} ${s*0.4} Q ${-s*0.5} 0 0 ${-s*0.5} Q ${s*0.5} 0 ${s*0.3} ${s*0.4} Z`, fill: color },
        { kind: "stroke", d: `M ${-s*0.2} ${s*0.3} Q 0 0 ${s*0.2} ${-s*0.3}`, width: 3 },
      ];
    case "fire":
      return [
        { kind: "fill", d: `M 0 ${s*0.5} C ${-s*0.4} ${s*0.3} ${-s*0.35} ${-s*0.1} ${-s*0.05} ${-s*0.3} C 0 ${-s*0.1} ${s*0.1} ${-s*0.3} ${s*0.05} ${-s*0.5} C ${s*0.35} ${-s*0.2} ${s*0.4} ${s*0.3} 0 ${s*0.5} Z`, fill: color },
        { kind: "fill", d: `M 0 ${s*0.4} C ${-s*0.2} ${s*0.3} ${-s*0.15} ${0} 0 ${-s*0.1} C ${s*0.15} 0 ${s*0.2} ${s*0.3} 0 ${s*0.4} Z`, fill: "#f2b134" },
      ];
    case "lock":
      return [
        { kind: "stroke", d: `M ${-s*0.2} ${-s*0.1} L ${-s*0.2} ${-s*0.3} a ${s*0.2} ${s*0.2} 0 1 1 ${s*0.4} 0 L ${s*0.2} ${-s*0.1}`, width: 5 },
        { kind: "fill", d: `M ${-s*0.3} ${-s*0.1} L ${s*0.3} ${-s*0.1} L ${s*0.3} ${s*0.4} L ${-s*0.3} ${s*0.4} Z`, fill: color },
      ];
    case "key":
      return [
        { kind: "fill", d: `M ${-s*0.45} 0 a ${s*0.18} ${s*0.18} 0 1 0 0.01 0 Z`, fill: color },
        { kind: "fill", d: `M ${-s*0.3} ${-s*0.05} L ${s*0.45} ${-s*0.05} L ${s*0.45} ${s*0.05} L ${s*0.35} ${s*0.05} L ${s*0.35} ${s*0.15} L ${s*0.25} ${s*0.15} L ${s*0.25} ${s*0.05} L ${-s*0.3} ${s*0.05} Z`, fill: color },
      ];
    case "chat":
      return [
        { kind: "fill", d: `M ${-s*0.45} ${-s*0.35} L ${s*0.45} ${-s*0.35} L ${s*0.45} ${s*0.15} L ${-s*0.15} ${s*0.15} L ${-s*0.3} ${s*0.4} L ${-s*0.3} ${s*0.15} L ${-s*0.45} ${s*0.15} Z`, fill: color },
        { kind: "fill", d: `M ${-s*0.2} ${-s*0.1} a ${s*0.04} ${s*0.04} 0 1 0 0.01 0 Z`, fill: "#fafaf5" },
        { kind: "fill", d: `M 0 ${-s*0.1} a ${s*0.04} ${s*0.04} 0 1 0 0.01 0 Z`, fill: "#fafaf5" },
        { kind: "fill", d: `M ${s*0.2} ${-s*0.1} a ${s*0.04} ${s*0.04} 0 1 0 0.01 0 Z`, fill: "#fafaf5" },
      ];
    case "checkmark":
      return [
        { kind: "fill", d: `M 0 ${-s*0.45} a ${s*0.45} ${s*0.45} 0 1 0 0.01 0 Z`, fill: color },
        { kind: "stroke", d: `M ${-s*0.2} 0 L ${-s*0.05} ${s*0.18} L ${s*0.25} ${-s*0.15}`, stroke: "#fafaf5", width: 7 },
      ];
    case "cross":
      return [
        { kind: "fill", d: `M 0 ${-s*0.45} a ${s*0.45} ${s*0.45} 0 1 0 0.01 0 Z`, fill: color },
        { kind: "stroke", d: `M ${-s*0.2} ${-s*0.2} L ${s*0.2} ${s*0.2} M ${s*0.2} ${-s*0.2} L ${-s*0.2} ${s*0.2}`, stroke: "#fafaf5", width: 7 },
      ];
    case "question":
      return [
        { kind: "fill", d: `M 0 ${-s*0.45} a ${s*0.45} ${s*0.45} 0 1 0 0.01 0 Z`, fill: color },
        { kind: "stroke", d: `M ${-s*0.13} ${-s*0.15} a ${s*0.13} ${s*0.13} 0 1 1 ${s*0.13} ${s*0.13} L 0 ${s*0.1}`, stroke: "#fafaf5", width: 6 },
        { kind: "fill", d: `M 0 ${s*0.25} a ${s*0.04} ${s*0.04} 0 1 0 0.01 0 Z`, fill: "#fafaf5" },
      ];
    case "house":
      return [
        { kind: "fill", d: `M ${-s*0.45} ${s*0.5} L ${-s*0.45} 0 L 0 ${-s*0.45} L ${s*0.45} 0 L ${s*0.45} ${s*0.5} Z`, fill: color },
        { kind: "fill", d: `M ${-s*0.12} ${s*0.5} L ${-s*0.12} ${s*0.15} L ${s*0.12} ${s*0.15} L ${s*0.12} ${s*0.5} Z`, fill: "#3a2a1a" },
      ];
    case "car":
      return [
        { kind: "fill", d: `M ${-s*0.5} ${s*0.1} L ${-s*0.35} ${-s*0.15} L ${s*0.35} ${-s*0.15} L ${s*0.5} ${s*0.1} L ${s*0.5} ${s*0.3} L ${-s*0.5} ${s*0.3} Z`, fill: color },
        { kind: "fill", d: `M ${-s*0.3} ${s*0.3} a ${s*0.1} ${s*0.1} 0 1 0 0.01 0 Z`, fill: "#1a1a1a" },
        { kind: "fill", d: `M ${s*0.3} ${s*0.3} a ${s*0.1} ${s*0.1} 0 1 0 0.01 0 Z`, fill: "#1a1a1a" },
      ];
    case "graph":
      return [
        { kind: "stroke", d: `M ${-s*0.5} ${s*0.5} L ${-s*0.5} ${-s*0.5} M ${-s*0.5} ${s*0.5} L ${s*0.5} ${s*0.5}`, width: 4 },
        { kind: "stroke", d: `M ${-s*0.4} ${s*0.3} L ${-s*0.1} ${0} L ${s*0.1} ${s*0.15} L ${s*0.45} ${-s*0.3}`, stroke: color, width: 6 },
      ];
    case "pencil":
      return [
        { kind: "fill", d: `M ${-s*0.5} ${s*0.4} L ${s*0.3} ${-s*0.4} L ${s*0.45} ${-s*0.25} L ${-s*0.35} ${s*0.55} Z`, fill: color },
        { kind: "fill", d: `M ${s*0.3} ${-s*0.4} L ${s*0.45} ${-s*0.55} L ${s*0.6} ${-s*0.4} L ${s*0.45} ${-s*0.25} Z`, fill: "#e88aab" },
        { kind: "fill", d: `M ${-s*0.5} ${s*0.4} L ${-s*0.35} ${s*0.55} L ${-s*0.55} ${s*0.6} Z`, fill: ink },
      ];
    case "camera":
      return [
        { kind: "fill", d: `M ${-s*0.5} ${-s*0.2} L ${-s*0.3} ${-s*0.2} L ${-s*0.2} ${-s*0.35} L ${s*0.2} ${-s*0.35} L ${s*0.3} ${-s*0.2} L ${s*0.5} ${-s*0.2} L ${s*0.5} ${s*0.35} L ${-s*0.5} ${s*0.35} Z`, fill: color },
        { kind: "fill", d: `M 0 ${s*0.05} a ${s*0.18} ${s*0.18} 0 1 0 0.01 0 Z`, fill: "#a8d5e8" },
      ];
    case "music":
      return [
        { kind: "stroke", d: `M ${-s*0.2} ${s*0.3} L ${-s*0.2} ${-s*0.45} L ${s*0.3} ${-s*0.5} L ${s*0.3} ${s*0.2}`, width: 6 },
        { kind: "fill", d: `M ${-s*0.3} ${s*0.3} a ${s*0.12} ${s*0.1} 0 1 0 ${s*0.2} 0 a ${s*0.12} ${s*0.1} 0 1 0 ${-s*0.2} 0 Z`, fill: color },
        { kind: "fill", d: `M ${s*0.2} ${s*0.2} a ${s*0.12} ${s*0.1} 0 1 0 ${s*0.2} 0 a ${s*0.12} ${s*0.1} 0 1 0 ${-s*0.2} 0 Z`, fill: color },
      ];
    case "stick":
    default:
      return [
        { kind: "stroke", d: `M 0 ${-s*0.5} a ${s*0.15} ${s*0.15} 0 1 1 0.01 0 Z M 0 ${-s*0.35} L 0 ${s*0.05} M ${-s*0.3} ${-s*0.15} L ${s*0.3} ${-s*0.15} M 0 ${s*0.05} L ${-s*0.25} ${s*0.5} M 0 ${s*0.05} L ${s*0.25} ${s*0.5}`, width: 4 },
      ];
  }
}

function arrowPath(from: [number, number], to: [number, number], curve = 0.15): string {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = mx - dy * curve;
  const cy = my + dx * curve;
  const angle = Math.atan2(y2 - cy, x2 - cx);
  const headLen = 26;
  const hx1 = x2 - headLen * Math.cos(angle - Math.PI / 7);
  const hy1 = y2 - headLen * Math.sin(angle - Math.PI / 7);
  const hx2 = x2 - headLen * Math.cos(angle + Math.PI / 7);
  const hy2 = y2 - headLen * Math.sin(angle + Math.PI / 7);
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2} M ${x2} ${y2} L ${hx1} ${hy1} M ${x2} ${y2} L ${hx2} ${hy2}`;
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M ${cx + r} ${cy} a ${r} ${r} 0 1 1 -${r * 2} 0 a ${r} ${r} 0 1 1 ${r * 2} 0`;
}

export function WhiteboardCanvas({ timeline, mode = "marker", loop = false, className }: WhiteboardCanvasProps) {
  const isChalk = mode === "chalk";
  const isSketch = mode === "sketch";
  const ink = isChalk ? "#f5f5f0" : isSketch ? "#1d3557" : "#1a1a1a";
  const bg = isChalk ? "#0f2a1f" : isSketch ? "#fdf6e3" : "#fafaf5";
  const animKey = useMemo(() => uid(), []);

  // Compute scene boundaries (start delay + clear delay per scene)
  const sceneBounds = useMemo(() => {
    const map = new Map<number, { start: number; end: number }>();
    for (const it of timeline) {
      const scene = it.scene ?? 0;
      const start = it.delay ?? 0;
      const end = start + (it.duration ?? 1.2);
      const b = map.get(scene);
      if (!b) map.set(scene, { start, end });
      else map.set(scene, { start: Math.min(b.start, start), end: Math.max(b.end, end) });
    }
    return map;
  }, [timeline]);

  // For each scene, the next scene's start defines when this one fades out
  const sceneFadeOut = useMemo(() => {
    const sortedScenes = [...sceneBounds.entries()].sort((a, b) => a[1].start - b[1].start);
    const map = new Map<number, number | null>();
    for (let i = 0; i < sortedScenes.length; i++) {
      const [scene] = sortedScenes[i];
      const next = sortedScenes[i + 1];
      map.set(scene, next ? next[1].start - 0.4 : null);
    }
    return map;
  }, [sceneBounds]);

  const [cycle, setCycle] = useState(0);
  const totalDuration = useMemo(
    () =>
      timeline.reduce((m, it) => {
        const d = (it.delay ?? 0) + (it.duration ?? 1.2);
        return Math.max(m, d);
      }, 0) + 1.5,
    [timeline],
  );

  useEffect(() => {
    if (!loop) return;
    const id = setInterval(() => setCycle((c) => c + 1), totalDuration * 1000);
    return () => clearInterval(id);
  }, [loop, totalDuration]);

  function itemFadeOut(item: TimelineItem): number | null {
    const scene = item.scene ?? 0;
    return sceneFadeOut.get(scene) ?? null;
  }

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: bg,
        backgroundImage: isChalk
          ? "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.04), transparent 60%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.03), transparent 60%)"
          : "radial-gradient(circle at 30% 20%, rgba(0,0,0,0.025), transparent 60%), radial-gradient(circle at 70% 80%, rgba(0,0,0,0.02), transparent 60%)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Patrick+Hand&display=swap"
      />
      <style>{`
        @keyframes wb-draw-${animKey} { to { stroke-dashoffset: 0; } }
        @keyframes wb-fillin-${animKey} { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
        @keyframes wb-blob-${animKey} {
          0% { opacity: 0; transform: scale(0.2); }
          30% { opacity: 0.9; transform: scale(1.4); }
          100% { opacity: 0; transform: scale(1); }
        }
        @keyframes wb-fade-${animKey} { to { opacity: 1; } }
        @keyframes wb-fadeout-${animKey} { to { opacity: 0; } }
        @keyframes wb-text-sweep-${animKey} { to { width: ${WIDTH}px; } }
        .wb-path-${animKey} {
          stroke-dasharray: var(--len);
          stroke-dashoffset: var(--len);
          animation: wb-draw-${animKey} var(--dur, 1.2s) linear var(--delay, 0s) forwards;
        }
        .wb-fill-${animKey} {
          opacity: 0;
          transform-origin: center;
          transform-box: fill-box;
          animation: wb-fillin-${animKey} var(--dur, 0.5s) ease-out var(--delay, 0s) forwards;
        }
        .wb-blob-${animKey} {
          opacity: 0;
          transform-origin: center;
          transform-box: fill-box;
          animation: wb-blob-${animKey} 0.4s ease-out var(--delay, 0s) forwards;
        }
        .wb-text-${animKey} {
          opacity: 0;
          animation: wb-fade-${animKey} 0.25s linear var(--delay, 0s) forwards;
          font-family: ${isChalk ? "'Patrick Hand', cursive" : "'Caveat', cursive"};
          fill: ${ink};
        }
        .wb-text-clip-${animKey} rect {
          animation: wb-text-sweep-${animKey} var(--dur, 1s) linear var(--delay, 0s) forwards;
        }
        .wb-scene-out-${animKey} {
          animation: wb-fadeout-${animKey} 0.5s ease-in var(--fadeout, 999s) forwards;
        }
      `}</style>

      <svg
        key={cycle}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", maxHeight: "100vh" }}
      >
        <defs>
          <filter id={`wb-rough-${animKey}`}>
            <feTurbulence baseFrequency="0.9" numOctaves="2" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="1.2" />
          </filter>
        </defs>

        {timeline.map((item, i) => {
          const delay = item.delay ?? 0;
          const duration = item.duration ?? 1.2;
          const key = `${cycle}-${i}`;
          const fadeOut = itemFadeOut(item);
          const groupStyle = fadeOut !== null
            ? ({ ["--fadeout" as string]: `${fadeOut}s` } as React.CSSProperties)
            : undefined;
          const groupClass = fadeOut !== null ? `wb-scene-out-${animKey}` : undefined;

          if (item.type === "title") {
            const size = item.size ?? 110;
            const text = item.content;
            const approxW = text.length * size * 0.42;
            const x = WIDTH / 2;
            const y = 140;
            const clipId = `wb-clip-${animKey}-${i}-${cycle}`;
            return (
              <g key={key} className={groupClass} style={groupStyle}>
                <defs>
                  <clipPath id={clipId} className={`wb-text-clip-${animKey}`}
                    style={{ ["--delay" as string]: `${delay}s`, ["--dur" as string]: `${duration}s` } as React.CSSProperties}>
                    <rect x={x - approxW / 2 - 20} y={y - size} width="0" height={size * 2} />
                  </clipPath>
                </defs>
                <text x={x} y={y} fontSize={size} textAnchor="middle"
                  className={`wb-text-${animKey}`}
                  clipPath={`url(#${clipId})`}
                  style={{ ["--delay" as string]: `${delay}s`, fontWeight: 700 } as React.CSSProperties}>
                  {text}
                </text>
                <path
                  d={`M ${x - approxW / 2} ${y + 20} Q ${x} ${y + 32} ${x + approxW / 2} ${y + 20}`}
                  fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round"
                  pathLength={1000}
                  className={`wb-path-${animKey}`}
                  style={{
                    ["--len" as string]: "1000",
                    ["--delay" as string]: `${delay + duration * 0.6}s`,
                    ["--dur" as string]: `0.5s`,
                  } as React.CSSProperties}
                />
              </g>
            );
          }

          if (item.type === "caption") {
            const pos = item.position ?? "bottom-left";
            const size = 44;
            const padding = 60;
            let x = padding, y = HEIGHT - padding, anchor: "start" | "end" = "start";
            if (pos === "bottom-right") { x = WIDTH - padding; anchor = "end"; }
            else if (pos === "top-right") { x = WIDTH - padding; y = padding + size; anchor = "end"; }
            return (
              <g key={key} className={groupClass} style={groupStyle}>
                <text x={x} y={y} fontSize={size} textAnchor={anchor}
                  className={`wb-text-${animKey}`}
                  style={{ ["--delay" as string]: `${delay}s`, fontWeight: 700 } as React.CSSProperties}>
                  {item.content}
                </text>
              </g>
            );
          }

          if (item.type === "text") {
            const size = item.size ?? 56;
            const clipId = `wb-clip-${animKey}-${i}-${cycle}`;
            const approxW = item.content.length * size * 0.55;
            const anchor = item.align === "center" ? "middle" : item.align === "right" ? "end" : "start";
            const clipX = anchor === "middle" ? item.x - approxW / 2 - 10 : anchor === "end" ? item.x - approxW - 10 : item.x - 10;
            return (
              <g key={key} className={groupClass} style={groupStyle}>
                <defs>
                  <clipPath id={clipId} className={`wb-text-clip-${animKey}`}
                    style={{ ["--delay" as string]: `${delay}s`, ["--dur" as string]: `${duration}s` } as React.CSSProperties}>
                    <rect x={clipX} y={item.y - size} width="0" height={size * 2} />
                  </clipPath>
                </defs>
                <text x={item.x} y={item.y} fontSize={size} textAnchor={anchor}
                  className={`wb-text-${animKey}`}
                  clipPath={`url(#${clipId})`}
                  style={{ ["--delay" as string]: `${delay}s`, fill: item.color ?? ink } as React.CSSProperties}>
                  {item.content}
                </text>
              </g>
            );
          }

          if (item.type === "icon") {
            const size = item.size ?? 160;
            const color = item.color ?? ICON_COLORS[item.name] ?? ink;
            const parts = iconParts(item.name, size, color, ink);
            const partDur = Math.max(0.18, duration / Math.max(parts.length, 1));
            return (
              <g key={key} className={groupClass} style={groupStyle}>
                <g transform={`translate(${item.x} ${item.y})`}>
                  {parts.map((p, pi) => {
                    const pDelay = delay + pi * partDur * 0.85;
                    if (p.kind === "fill") {
                      return (
                        <g key={pi}>
                          <path d={p.d} fill={p.fill}
                            stroke={p.stroke ?? ink}
                            strokeWidth={2.5}
                            strokeLinejoin="round"
                            className={`wb-fill-${animKey}`}
                            style={{ ["--delay" as string]: `${pDelay}s`, ["--dur" as string]: `${partDur}s` } as React.CSSProperties}
                          />
                        </g>
                      );
                    }
                    return (
                      <path key={pi} d={p.d} fill="none"
                        stroke={p.stroke ?? ink}
                        strokeWidth={p.width ?? 3.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        pathLength={1000}
                        className={`wb-path-${animKey}`}
                        filter={(isChalk || isSketch) ? `url(#wb-rough-${animKey})` : undefined}
                        style={{
                          ["--len" as string]: "1000",
                          ["--delay" as string]: `${pDelay}s`,
                          ["--dur" as string]: `${partDur}s`,
                        } as React.CSSProperties}
                      />
                    );
                  })}
                </g>
                {item.label ? (
                  <text
                    x={item.x}
                    y={item.y + size * 0.7}
                    fontSize={42}
                    textAnchor="middle"
                    className={`wb-text-${animKey}`}
                    style={{ ["--delay" as string]: `${delay + duration * 0.6}s`, fontWeight: 600 } as React.CSSProperties}
                  >
                    {item.label}
                  </text>
                ) : null}
              </g>
            );
          }

          if (item.type === "arrow") {
            const d = arrowPath(item.from, item.to, item.curve ?? 0.12);
            return (
              <g key={key} className={groupClass} style={groupStyle}>
                <circle cx={item.from[0]} cy={item.from[1]} r={5} fill={ink}
                  className={`wb-blob-${animKey}`}
                  style={{ ["--delay" as string]: `${delay}s` } as React.CSSProperties} />
                <path d={d} fill="none" stroke={ink} strokeWidth={4}
                  strokeLinecap="round" strokeLinejoin="round"
                  pathLength={1000}
                  className={`wb-path-${animKey}`}
                  filter={(isChalk || isSketch) ? `url(#wb-rough-${animKey})` : undefined}
                  style={{
                    ["--len" as string]: "1000",
                    ["--delay" as string]: `${delay}s`,
                    ["--dur" as string]: `${duration}s`,
                  } as React.CSSProperties} />
              </g>
            );
          }

          if (item.type === "circle") {
            const d = circlePath(item.x, item.y, item.r);
            return (
              <g key={key} className={groupClass} style={groupStyle}>
                <path d={d} fill="none" stroke={item.color ?? ink} strokeWidth={4}
                  strokeLinecap="round" pathLength={1000}
                  className={`wb-path-${animKey}`}
                  filter={(isChalk || isSketch) ? `url(#wb-rough-${animKey})` : undefined}
                  style={{
                    ["--len" as string]: "1000",
                    ["--delay" as string]: `${delay}s`,
                    ["--dur" as string]: `${duration}s`,
                  } as React.CSSProperties} />
              </g>
            );
          }

          if (item.type === "underline") {
            const [x1, y1] = item.from;
            const [x2, y2] = item.to;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2 + 6;
            const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
            return (
              <g key={key} className={groupClass} style={groupStyle}>
                <path d={d} fill="none" stroke={ink} strokeWidth={5}
                  strokeLinecap="round" pathLength={1000}
                  className={`wb-path-${animKey}`}
                  style={{
                    ["--len" as string]: "1000",
                    ["--delay" as string]: `${delay}s`,
                    ["--dur" as string]: `${duration}s`,
                  } as React.CSSProperties} />
              </g>
            );
          }

          return null;
        })}
      </svg>
    </div>
  );
}

export default WhiteboardCanvas;
