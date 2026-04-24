"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ============ Types ============

type RoomId =
  | "content-creation"
  | "scalero-crm"
  | "marketing"
  | "personal-brand";

type Facing = "up" | "down" | "left" | "right";

type XpTier = 5 | 20 | 50 | 500;
type QuestType = "main" | "side" | "daily" | "boss";

interface Task {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  xpReward: XpTier;
  questType: QuestType;
}

interface QuickLink {
  emoji: string;
  label: string;
  href: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Room {
  id: RoomId;
  name: string;
  emoji: string;
  zone: Rect;
  floorBase: string;
  floorAlt: string;
  accent: string;
  links: QuickLink[];
  defaultTasks: string[];
}

// ============ Gamification ============

const XP_TIERS: { value: XpTier; label: string }[] = [
  { value: 5, label: "5 XP" },
  { value: 20, label: "20 XP" },
  { value: 50, label: "50 XP" },
  { value: 500, label: "500 XP" },
];

const QUEST_TYPES: { value: QuestType; emoji: string; label: string; color: string }[] = [
  { value: "main", emoji: "🔴", label: "Main Quest", color: "#f87171" },
  { value: "side", emoji: "🟡", label: "Side Quest", color: "#fbbf24" },
  { value: "daily", emoji: "🟢", label: "Daily Quest", color: "#4ade80" },
  { value: "boss", emoji: "💀", label: "Boss Fight", color: "#c084fc" },
];

const LEVEL_ANCHORS: [number, number][] = [
  [1, 0], [2, 100], [3, 250], [5, 800], [10, 5000],
  [20, 25000], [50, 500000],
];

function buildLevelThresholds(): number[] {
  const thresholds: number[] = [0];
  for (let i = 0; i < LEVEL_ANCHORS.length - 1; i++) {
    const [lvlA, xpA] = LEVEL_ANCHORS[i];
    const [lvlB, xpB] = LEVEL_ANCHORS[i + 1];
    for (let lvl = lvlA + 1; lvl <= lvlB; lvl++) {
      const t = (lvl - lvlA) / (lvlB - lvlA);
      const curved = t * t;
      thresholds[lvl - 1] = Math.round(xpA + (xpB - xpA) * curved);
    }
  }
  return thresholds;
}

const LEVEL_THRESHOLDS = buildLevelThresholds();

function xpToLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

function xpForLevel(lvl: number): number {
  return LEVEL_THRESHOLDS[Math.min(lvl - 1, LEVEL_THRESHOLDS.length - 1)] ?? 0;
}

function xpForNextLevel(lvl: number): number {
  if (lvl >= 50) return LEVEL_THRESHOLDS[49];
  return LEVEL_THRESHOLDS[lvl] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
}

function levelTitle(lvl: number): string {
  if (lvl >= 50) return "Legend";
  if (lvl >= 41) return "Mogul";
  if (lvl >= 31) return "Director";
  if (lvl >= 21) return "Executive";
  if (lvl >= 16) return "Commander";
  if (lvl >= 11) return "Specialist";
  if (lvl >= 6) return "Operator";
  return "Recruit";
}

function streakMultiplier(streak: number): number {
  if (streak >= 30) return 2.0;
  if (streak >= 14) return 1.8;
  if (streak >= 7) return 1.5;
  if (streak >= 3) return 1.2;
  return 1.0;
}

type RoomXP = Record<RoomId, number>;

interface DailyXPEntry {
  date: string;
  xp: number;
}

interface PlayerStats {
  totalXP: number;
  roomXP: RoomXP;
  streak: { count: number; lastDate: string };
  dailyXPLog: DailyXPEntry[];
  questsCompleted: { today: number; week: number; allTime: number };
  dailyQuestsCompletedToday: number;
  lastResetDate: string;
}

const EMPTY_ROOM_XP: RoomXP = {
  "content-creation": 0,
  "scalero-crm": 0,
  marketing: 0,
  "personal-brand": 0,
};

function defaultPlayerStats(): PlayerStats {
  const today = new Date().toISOString().slice(0, 10);
  return {
    totalXP: 0,
    roomXP: { ...EMPTY_ROOM_XP },
    streak: { count: 0, lastDate: "" },
    dailyXPLog: [],
    questsCompleted: { today: 0, week: 0, allTime: 0 },
    dailyQuestsCompletedToday: 0,
    lastResetDate: today,
  };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

const SKILL_TREES: Record<RoomId, { name: string; nodes: string[]; thresholds: number[] }> = {
  "content-creation": {
    name: "Content",
    nodes: ["Posting", "Batching", "Engagement", "Authority", "Monetization"],
    thresholds: [100, 500, 1500, 4000, 10000],
  },
  "scalero-crm": {
    name: "Sales",
    nodes: ["Cold DM", "Warm Call", "Closing", "Upselling", "Systemizing"],
    thresholds: [100, 500, 1500, 4000, 10000],
  },
  marketing: {
    name: "Marketing",
    nodes: ["Ads Basics", "Targeting", "Optimization", "Scaling", "Automation"],
    thresholds: [100, 500, 1500, 4000, 10000],
  },
  "personal-brand": {
    name: "Brand",
    nodes: ["Presence", "Consistency", "Voice", "Community", "Influence"],
    thresholds: [100, 500, 1500, 4000, 10000],
  },
};

function unlockedNodes(roomXP: number, thresholds: number[]): number {
  let count = 0;
  for (const t of thresholds) {
    if (roomXP >= t) count++;
    else break;
  }
  return count;
}

// ============ Multiplayer ============

const PLAYER_COLORS = ["#e8dcc8", "#c4a882", "#8b6f47", "#5c3d2e", "#d4a574", "#f0c8a0"];

interface RemotePlayer {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  lastSeen: number;
}

interface LobbyState {
  code: string;
  playerName: string;
  playerId: string;
  color: string;
}

function generateLobbyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getOrCreatePlayerId(): string {
  return crypto.randomUUID();
}

function getSavedLobby(): LobbyState | null {
  try {
    const raw = localStorage.getItem("hq_lobby");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveLobby(lobby: LobbyState) {
  localStorage.setItem("hq_lobby", JSON.stringify(lobby));
}

function clearSavedLobby() {
  localStorage.removeItem("hq_lobby");
}

// ============ World constants ============

const WORLD_W = 1400;
const WORLD_H = 900;
const CHAR_RADIUS = 6;
const SPEED = 3;

const OUTSIDE_COLOR = "#050505";
const WALL_BASE = "#14100b";
const WALL_TOP = "#2a1e12";
const CAMERA_SCALE = 2.6;

const ROOMS: Room[] = [
  {
    id: "content-creation",
    name: "Content Creation",
    emoji: "🎬",
    zone: { x: 100, y: 80, w: 450, h: 300 },
    floorBase: "#2d2438",
    floorAlt: "#261f30",
    accent: "#8b5cf6",
    links: [
      { emoji: "📸", label: "Instagram", href: "https://instagram.com" },
      { emoji: "🎬", label: "YouTube Studio", href: "https://studio.youtube.com" },
      { emoji: "✂️", label: "CapCut", href: "https://capcut.com" },
      { emoji: "📝", label: "Notion", href: "https://notion.so" },
    ],
    defaultTasks: [
      "Plan this week's reels",
      "Upload to Instagram",
      "Write YouTube script",
    ],
  },
  {
    id: "scalero-crm",
    name: "Scalero CRM",
    emoji: "📊",
    zone: { x: 850, y: 80, w: 450, h: 300 },
    floorBase: "#1e3241",
    floorAlt: "#1a2c39",
    accent: "#38bdf8",
    links: [
      { emoji: "📧", label: "Gmail", href: "https://mail.google.com" },
      { emoji: "🚀", label: "Apollo.io", href: "https://app.apollo.io" },
      { emoji: "📝", label: "Notion", href: "https://notion.so" },
      { emoji: "📅", label: "Calendly", href: "https://calendly.com" },
    ],
    defaultTasks: [
      "Follow up with leads",
      "Send cold DM batch",
      "Update pipeline in Notion",
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    emoji: "📈",
    zone: { x: 100, y: 520, w: 450, h: 300 },
    floorBase: "#3a2525",
    floorAlt: "#321f1f",
    accent: "#f87171",
    links: [
      { emoji: "📊", label: "Meta Ads", href: "https://adsmanager.facebook.com" },
      { emoji: "📈", label: "Google Analytics", href: "https://analytics.google.com" },
      { emoji: "🎨", label: "Canva", href: "https://canva.com" },
      { emoji: "📝", label: "Notion", href: "https://notion.so" },
    ],
    defaultTasks: [
      "Review Meta Ads performance",
      "Plan next campaign",
      "Update Canva creatives",
    ],
  },
  {
    id: "personal-brand",
    name: "Personal Brand",
    emoji: "✨",
    zone: { x: 850, y: 520, w: 450, h: 300 },
    floorBase: "#25352a",
    floorAlt: "#1f2e24",
    accent: "#4ade80",
    links: [
      { emoji: "📸", label: "Instagram", href: "https://instagram.com" },
      { emoji: "🎬", label: "YouTube Studio", href: "https://studio.youtube.com" },
      { emoji: "🎨", label: "Canva", href: "https://canva.com" },
      { emoji: "🐦", label: "Twitter/X", href: "https://x.com" },
    ],
    defaultTasks: [
      "Post to Instagram",
      "Record a build update",
      "Engage with comments",
    ],
  },
];

// Walkable corridors and doorways.
const CORRIDORS: Rect[] = [
  { x: 100, y: 410, w: 1200, h: 80 }, // main horizontal
  { x: 300, y: 370, w: 150, h: 50 }, // top-left doorway
  { x: 950, y: 370, w: 150, h: 50 }, // top-right doorway
  { x: 300, y: 480, w: 150, h: 50 }, // bottom-left doorway
  { x: 950, y: 480, w: 150, h: 50 }, // bottom-right doorway
];

// Walls (explicit rectangles that form the building envelope, with gaps at doorways).
const WALLS: Rect[] = [
  // Content Creation (top-left room)
  { x: 92, y: 72, w: 466, h: 8 },
  { x: 92, y: 80, w: 8, h: 300 },
  { x: 550, y: 80, w: 8, h: 300 },
  { x: 92, y: 380, w: 208, h: 8 },
  { x: 450, y: 380, w: 108, h: 8 },
  // Scalero CRM (top-right room)
  { x: 842, y: 72, w: 466, h: 8 },
  { x: 842, y: 80, w: 8, h: 300 },
  { x: 1300, y: 80, w: 8, h: 300 },
  { x: 842, y: 380, w: 108, h: 8 },
  { x: 1100, y: 380, w: 208, h: 8 },
  // Marketing (bottom-left room)
  { x: 92, y: 512, w: 208, h: 8 },
  { x: 450, y: 512, w: 108, h: 8 },
  { x: 92, y: 520, w: 8, h: 300 },
  { x: 550, y: 520, w: 8, h: 300 },
  { x: 92, y: 820, w: 466, h: 8 },
  // Personal Brand (bottom-right room)
  { x: 842, y: 512, w: 108, h: 8 },
  { x: 1100, y: 512, w: 208, h: 8 },
  { x: 842, y: 520, w: 8, h: 300 },
  { x: 1300, y: 520, w: 8, h: 300 },
  { x: 842, y: 820, w: 466, h: 8 },
  // Corridor top wall with doorway gaps
  { x: 100, y: 402, w: 200, h: 8 },
  { x: 450, y: 402, w: 500, h: 8 },
  { x: 1100, y: 402, w: 200, h: 8 },
  // Corridor bottom wall with doorway gaps
  { x: 100, y: 490, w: 200, h: 8 },
  { x: 450, y: 490, w: 500, h: 8 },
  { x: 1100, y: 490, w: 200, h: 8 },
  // Corridor end caps (left & right)
  { x: 92, y: 402, w: 8, h: 96 },
  { x: 1300, y: 402, w: 8, h: 96 },
];

// Furniture obstacles (block character movement).
const OBSTACLES: Rect[] = [
  // Content Creation
  { x: 270, y: 202, w: 90, h: 26 }, // desk
  { x: 112, y: 100, w: 52, h: 48 }, // bookshelf
  // Scalero CRM
  { x: 870, y: 160, w: 60, h: 24 },
  { x: 980, y: 160, w: 60, h: 24 },
  { x: 1090, y: 160, w: 60, h: 24 },
  { x: 862, y: 100, w: 18, h: 24 }, // cabinet
  { x: 1268, y: 95, w: 16, h: 32 }, // water cooler
  // Marketing
  { x: 370, y: 580, w: 110, h: 28 }, // desk
  { x: 120, y: 640, w: 130, h: 42 }, // couch
  { x: 140, y: 700, w: 90, h: 30 }, // coffee table
  // Personal Brand
  { x: 1050, y: 620, w: 110, h: 28 }, // desk
  { x: 862, y: 550, w: 52, h: 74 }, // bookshelf
];

// ---------- Interactables ----------
type InteractableKind = "pc" | "whiteboard";

interface Interactable {
  id: string;
  kind: InteractableKind;
  roomId: RoomId;
  // Trigger zone — when char center overlaps, the interaction opens.
  trigger: Rect;
  // Object zone — drawn highlight (the actual object on the map).
  highlight: Rect;
  label: string;
}

const INTERACTABLES: Interactable[] = [
  // PCs (sit at the chair in front of each desk monitor)
  {
    id: "pc-cc",
    kind: "pc",
    roomId: "content-creation",
    trigger: { x: 296, y: 226, w: 28, h: 24 },
    highlight: { x: 278, y: 188, w: 32, h: 14 },
    label: "Workstation",
  },
  {
    id: "pc-scrm-1",
    kind: "pc",
    roomId: "scalero-crm",
    trigger: { x: 877, y: 184, w: 28, h: 24 },
    highlight: { x: 876, y: 146, w: 14, h: 14 },
    label: "CRM Desk 1",
  },
  {
    id: "pc-scrm-2",
    kind: "pc",
    roomId: "scalero-crm",
    trigger: { x: 987, y: 184, w: 28, h: 24 },
    highlight: { x: 986, y: 146, w: 14, h: 14 },
    label: "CRM Desk 2",
  },
  {
    id: "pc-scrm-3",
    kind: "pc",
    roomId: "scalero-crm",
    trigger: { x: 1097, y: 184, w: 28, h: 24 },
    highlight: { x: 1096, y: 146, w: 14, h: 14 },
    label: "CRM Desk 3",
  },
  {
    id: "pc-mkt",
    kind: "pc",
    roomId: "marketing",
    trigger: { x: 403, y: 606, w: 28, h: 24 },
    highlight: { x: 398, y: 566, w: 32, h: 14 },
    label: "Marketing PC",
  },
  {
    id: "pc-pb",
    kind: "pc",
    roomId: "personal-brand",
    trigger: { x: 1078, y: 646, w: 28, h: 24 },
    highlight: { x: 1073, y: 606, w: 14, h: 14 },
    label: "Studio PC",
  },
  // Whiteboards
  {
    id: "wb-scrm",
    kind: "whiteboard",
    roomId: "scalero-crm",
    trigger: { x: 1170, y: 116, w: 44, h: 26 },
    highlight: { x: 1175, y: 90, w: 34, h: 22 },
    label: "Pipeline Board",
  },
  {
    id: "wb-mkt",
    kind: "whiteboard",
    roomId: "marketing",
    trigger: { x: 240, y: 558, w: 120, h: 26 },
    highlight: { x: 240, y: 530, w: 120, h: 26 },
    label: "Strategy Board",
  },
];

function detectInteractable(x: number, y: number): Interactable | null {
  for (const it of INTERACTABLES) {
    if (pointInRect(x, y, it.trigger)) return it;
  }
  return null;
}

// ============ Helpers ============

function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function isWalkable(x: number, y: number): boolean {
  const r = CHAR_RADIUS;
  const samples: [number, number][] = [
    [x, y],
    [x - r, y],
    [x + r, y],
    [x, y - r],
    [x, y + r],
  ];
  // Every sample must be inside a room or corridor…
  for (const [px, py] of samples) {
    let ok = false;
    for (const room of ROOMS) {
      if (pointInRect(px, py, room.zone)) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      for (const c of CORRIDORS) {
        if (pointInRect(px, py, c)) {
          ok = true;
          break;
        }
      }
    }
    if (!ok) return false;
  }
  // …and no sample may be inside an obstacle.
  for (const obs of OBSTACLES) {
    for (const [px, py] of samples) {
      if (pointInRect(px, py, obs)) return false;
    }
  }
  return true;
}

function detectRoom(x: number, y: number): RoomId | null {
  for (const room of ROOMS) {
    if (pointInRect(x, y, room.zone)) return room.id;
  }
  return null;
}

function storageKey(id: RoomId): string {
  return `hq_tasks_${id}`;
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function dirToFacing(dir: number, moving: boolean, prev: Facing): Facing {
  if (!moving) return prev;
  const deg = ((dir * 180) / Math.PI + 360) % 360;
  if (deg >= 45 && deg < 135) return "down";
  if (deg >= 135 && deg < 225) return "left";
  if (deg >= 225 && deg < 315) return "up";
  return "right";
}

// ============ Draw helpers ============

type Ctx = CanvasRenderingContext2D;

const WOOD_PALETTES = {
  light: {
    tones: ["#8a5a2e", "#9a6a38", "#7a4a22", "#a67844", "#6b3f1c"],
    seam: "#1f0e04",
    grainDark: "rgba(0,0,0,0.22)",
    grainLight: "rgba(255,255,255,0.05)",
  },
  dark: {
    tones: ["#5a3818", "#6b4522", "#4a2e12", "#7a4d26", "#3e2610"],
    seam: "#140700",
    grainDark: "rgba(0,0,0,0.3)",
    grainLight: "rgba(255,255,255,0.03)",
  },
} as const;

type WoodVariant = keyof typeof WOOD_PALETTES;

function drawPlankFloor(ctx: Ctx, zone: Rect, variant: WoodVariant = "light") {
  const p = WOOD_PALETTES[variant];
  const plankH = 20;
  ctx.fillStyle = p.tones[0];
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

  let row = 0;
  for (let y = zone.y; y < zone.y + zone.h; y += plankH) {
    const h = Math.min(plankH, zone.y + zone.h - y);
    // Stagger plank starts per row for brick-like offset.
    const rowOffset = (row * 37) % 90;
    let x = zone.x - rowOffset;
    let idx = row * 3;
    while (x < zone.x + zone.w) {
      const plankW = 60 + ((idx * 29) % 45);
      const x1 = Math.max(x, zone.x);
      const x2 = Math.min(x + plankW, zone.x + zone.w);
      if (x2 > x1) {
        const tone = p.tones[(idx + row) % p.tones.length];
        ctx.fillStyle = tone;
        ctx.fillRect(x1, y, x2 - x1, h);
        // Wood grain streaks
        ctx.fillStyle = p.grainDark;
        ctx.fillRect(x1, y + 4, x2 - x1, 1);
        ctx.fillRect(x1, y + Math.floor(h / 2), x2 - x1, 1);
        ctx.fillRect(x1, y + h - 4, x2 - x1, 1);
        ctx.fillStyle = p.grainLight;
        ctx.fillRect(x1, y + 2, x2 - x1, 1);
        ctx.fillRect(x1, y + Math.floor(h / 2) + 2, x2 - x1, 1);
        // Little knots
        if ((idx * 7) % 11 === 0 && x2 - x1 > 10) {
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillRect(x1 + 6, y + Math.floor(h / 2) - 1, 2, 2);
        }
      }
      // Vertical seam
      if (x + plankW < zone.x + zone.w && x + plankW > zone.x) {
        ctx.fillStyle = p.seam;
        ctx.fillRect(x + plankW, y, 1, h);
      }
      x += plankW;
      idx++;
    }
    // Horizontal seam between plank rows
    ctx.fillStyle = p.seam;
    ctx.fillRect(zone.x, y + h - 1, zone.w, 1);
    row++;
  }
}

function drawWalls(ctx: Ctx) {
  for (const w of WALLS) {
    ctx.fillStyle = WALL_BASE;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = WALL_TOP;
    ctx.fillRect(w.x, w.y, w.w, 1);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(w.x, w.y + w.h - 1, w.w, 1);
  }
}

function drawDesk(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x + 2, y + h, w, 2);
  ctx.fillStyle = "#5a3a20";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#6f4826";
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x, y + Math.floor(h / 2), w, 1);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x + w - 2, y, 2, h);
  // Edge tone
  ctx.fillStyle = "#3d2817";
  ctx.fillRect(x, y + h - 1, w, 1);
}

function drawMonitor(ctx: Ctx, x: number, y: number) {
  // Stand
  ctx.fillStyle = "#0f0f0f";
  ctx.fillRect(x + 5, y + 10, 2, 3);
  ctx.fillRect(x + 3, y + 13, 6, 1);
  // Frame
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(x, y, 12, 10);
  // Screen
  ctx.fillStyle = "#4488cc";
  ctx.fillRect(x + 1, y + 1, 10, 8);
  // Screen highlights
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(x + 2, y + 2, 4, 1);
  ctx.fillRect(x + 2, y + 4, 2, 1);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(x + 7, y + 6, 3, 1);
}

function drawKeyboard(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x, y, 14, 3);
  ctx.fillStyle = "#2d2d2d";
  for (let i = 1; i < 14; i += 2) {
    ctx.fillRect(x + i, y + 1, 1, 1);
  }
}

function drawChair(ctx: Ctx, x: number, y: number) {
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x + 1, y + 12, 12, 1);
  // Base
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x, y, 12, 12);
  // Backrest highlight
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(x + 1, y + 1, 10, 3);
  // Cushion highlight
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x + 1, y + 5, 10, 3);
  // Arms
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(x, y + 4, 1, 6);
  ctx.fillRect(x + 11, y + 4, 1, 6);
}

function drawPlant(ctx: Ctx, x: number, y: number) {
  // Pot
  ctx.fillStyle = "#6b3d1f";
  ctx.fillRect(x + 1, y + 11, 14, 7);
  ctx.fillStyle = "#8a4d29";
  ctx.fillRect(x + 1, y + 11, 14, 1);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x + 1, y + 17, 14, 1);
  // Leaves
  ctx.fillStyle = "#14532d";
  ctx.beginPath();
  ctx.arc(x + 8, y + 6, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.arc(x + 5, y + 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 11, y + 6, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(x + 6, y + 3, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawRug(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  primary: string,
  secondary: string
) {
  ctx.fillStyle = primary;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = secondary;
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  ctx.fillStyle = primary;
  ctx.fillRect(x + 10, y + 10, w - 20, h - 20);
  // Fringe
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(x, y + h - 1, w, 1);
  // Pattern dots
  ctx.fillStyle = secondary;
  for (let i = 12; i < w - 12; i += 16) {
    ctx.fillRect(x + i, y + 6, 2, 2);
    ctx.fillRect(x + i, y + h - 8, 2, 2);
  }
}

function drawBookshelf(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x + 1, y + h, w, 2);
  // Frame
  ctx.fillStyle = "#2a1808";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#4a2a12";
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = "#0a0604";
  ctx.fillRect(x + w - 1, y, 1, h);
  // Shelves with books
  const shelfCount = 3;
  const shelfH = Math.floor((h - 4) / shelfCount);
  const bookColors = [
    "#dc2626",
    "#2563eb",
    "#eab308",
    "#10b981",
    "#a855f7",
    "#f97316",
    "#06b6d4",
  ];
  for (let i = 0; i < shelfCount; i++) {
    const sy = y + 2 + i * shelfH;
    ctx.fillStyle = "#120800";
    ctx.fillRect(x + 2, sy, w - 4, shelfH - 1);
    let sx = x + 3;
    let idx = i * 5;
    while (sx < x + w - 3) {
      const bw = 2 + ((idx * 41) % 3);
      if (sx + bw > x + w - 3) break;
      ctx.fillStyle = bookColors[idx % bookColors.length];
      ctx.fillRect(sx, sy + 1, bw, shelfH - 3);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(sx, sy + 1, bw, 1);
      sx += bw + 1;
      idx++;
    }
    // Shelf board
    ctx.fillStyle = "#4a2a12";
    ctx.fillRect(x + 1, sy + shelfH - 1, w - 2, 1);
  }
}

function drawCouch(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(x + 2, y + h, w - 2, 2);
  // Base
  ctx.fillStyle = "#3f4758";
  ctx.fillRect(x, y, w, h);
  // Cushions
  ctx.fillStyle = "#525c73";
  ctx.fillRect(x + 3, y + 5, w - 6, h - 8);
  // Cushion dividers
  ctx.fillStyle = "#3f4758";
  const cushions = 3;
  const cw = (w - 6) / cushions;
  for (let i = 1; i < cushions; i++) {
    ctx.fillRect(x + 3 + i * cw, y + 5, 1, h - 8);
  }
  // Back highlight
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(x + 4, y + 6, w - 8, 1);
  // Armrests
  ctx.fillStyle = "#2d3341";
  ctx.fillRect(x, y + 3, 3, h - 3);
  ctx.fillRect(x + w - 3, y + 3, 3, h - 3);
  // Top highlight
  ctx.fillStyle = "#4f5a72";
  ctx.fillRect(x, y, w, 2);
}

function drawCoffeeTable(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(x + 2, y + h, w - 2, 2);
  ctx.fillStyle = "#3d2817";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#5a3a20";
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x, y + h - 1, w, 1);
  // Little book + cup on the table
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(x + 10, y + 8, 14, 8);
  ctx.fillStyle = "#fecaca";
  ctx.fillRect(x + 12, y + 10, 10, 1);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + w - 18, y + 9, 6, 6);
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(x + w - 17, y + 10, 4, 4);
  ctx.fillStyle = "#92400e";
  ctx.fillRect(x + w - 16, y + 11, 2, 2);
}

function drawWhiteboard(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number
) {
  // Frame
  ctx.fillStyle = "#1a100a";
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = "#4a2a12";
  ctx.fillRect(x, y, w, h);
  // White surface
  ctx.fillStyle = "#e8e8e8";
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  // Blue writing
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(x + 4, y + 5, 12, 1);
  ctx.fillRect(x + 4, y + 8, 16, 1);
  // Red writing
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(x + 4, y + 12, 8, 1);
  // Chart line
  ctx.fillStyle = "#16a34a";
  ctx.fillRect(x + 22, y + 15, 1, 1);
  ctx.fillRect(x + 23, y + 13, 1, 1);
  ctx.fillRect(x + 24, y + 14, 1, 1);
  ctx.fillRect(x + 25, y + 11, 1, 1);
  ctx.fillRect(x + 26, y + 10, 1, 1);
  ctx.fillRect(x + 27, y + 7, 1, 1);
}

function drawCabinet(ctx: Ctx, x: number, y: number) {
  const w = 18;
  const h = 24;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(x + 2, y + h, w - 2, 2);
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#6b7280";
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = "#2d3441";
  ctx.fillRect(x, y + 8, w, 1);
  ctx.fillRect(x, y + 16, w, 1);
  // Handles
  ctx.fillStyle = "#d1d5db";
  ctx.fillRect(x + 7, y + 4, 4, 1);
  ctx.fillRect(x + 7, y + 12, 4, 1);
  ctx.fillRect(x + 7, y + 20, 4, 1);
  // Side shade
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x + w - 1, y, 1, h);
}

function drawLamp(ctx: Ctx, x: number, y: number) {
  // Glow behind
  const glow = ctx.createRadialGradient(x + 5, y + 4, 0, x + 5, y + 4, 55);
  glow.addColorStop(0, "rgba(253, 224, 71, 0.3)");
  glow.addColorStop(0.5, "rgba(253, 224, 71, 0.1)");
  glow.addColorStop(1, "rgba(253, 224, 71, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x + 5, y + 4, 55, 0, Math.PI * 2);
  ctx.fill();
  // Shade
  ctx.fillStyle = "#b45309";
  ctx.beginPath();
  ctx.moveTo(x + 0, y + 8);
  ctx.lineTo(x + 10, y + 8);
  ctx.lineTo(x + 8, y + 1);
  ctx.lineTo(x + 2, y + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(x + 2, y + 1, 6, 1);
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(x + 3, y + 7, 4, 1);
  // Pole
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x + 4, y + 9, 2, 20);
  // Base
  ctx.fillRect(x + 2, y + 27, 6, 2);
  ctx.fillRect(x + 1, y + 29, 8, 1);
}

function drawTripod(ctx: Ctx, x: number, y: number) {
  // Legs
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x, y + 5, 2, 16);
  ctx.fillRect(x + 10, y + 5, 2, 16);
  ctx.fillRect(x + 5, y + 5, 2, 16);
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(x, y + 20, 2, 1);
  ctx.fillRect(x + 10, y + 20, 2, 1);
  ctx.fillRect(x + 5, y + 20, 2, 1);
  // Camera body
  ctx.fillStyle = "#2d2d2d";
  ctx.fillRect(x - 1, y, 14, 7);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x - 1, y, 14, 1);
  // Lens
  ctx.fillStyle = "#050505";
  ctx.fillRect(x + 3, y + 2, 7, 4);
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(x + 4, y + 3, 5, 2);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(x + 5, y + 3, 1, 1);
  // Viewfinder
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x + 3, y - 1, 4, 1);
  // Red record dot
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(x + 11, y + 2, 1, 1);
}

function drawRingLight(ctx: Ctx, x: number, y: number) {
  // Stand
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x + 10, y + 20, 2, 12);
  ctx.fillRect(x + 7, y + 31, 8, 2);
  ctx.fillRect(x + 6, y + 33, 10, 1);
  // Glow
  const glow = ctx.createRadialGradient(
    x + 11,
    y + 11,
    2,
    x + 11,
    y + 11,
    40
  );
  glow.addColorStop(0, "rgba(253, 224, 71, 0.25)");
  glow.addColorStop(1, "rgba(253, 224, 71, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x + 11, y + 11, 40, 0, Math.PI * 2);
  ctx.fill();
  // Ring (outer)
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(x + 11, y + 11, 10, 0, Math.PI * 2);
  ctx.fill();
  // Ring (inner hole)
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.arc(x + 11, y + 11, 6, 0, Math.PI * 2);
  ctx.fill();
  // Sparkle
  ctx.fillStyle = "#fef3c7";
  ctx.fillRect(x + 10, y + 2, 2, 1);
}

function drawMic(ctx: Ctx, x: number, y: number) {
  // Boom arm
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x + 2, y + 2, 1, 8);
  ctx.fillRect(x + 2, y + 9, 12, 1);
  // Capsule
  ctx.fillStyle = "#2d2d2d";
  ctx.fillRect(x + 12, y + 5, 5, 8);
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(x + 13, y + 6, 3, 6);
  // Grill pattern
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(x + 14, y + 7, 1, 1);
  ctx.fillRect(x + 14, y + 9, 1, 1);
  ctx.fillRect(x + 14, y + 11, 1, 1);
}

function drawWaterCooler(ctx: Ctx, x: number, y: number) {
  // Bottle
  ctx.fillStyle = "#60a5fa";
  ctx.fillRect(x + 2, y + 2, 12, 10);
  ctx.fillStyle = "#93c5fd";
  ctx.fillRect(x + 3, y + 3, 3, 3);
  ctx.fillStyle = "#1e40af";
  ctx.fillRect(x + 6, y, 4, 3);
  // Body
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(x, y + 12, 16, 18);
  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(x, y + 12, 16, 1);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(x + 15, y + 12, 1, 18);
  // Taps
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(x + 4, y + 18, 2, 2);
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(x + 10, y + 18, 2, 2);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x + 1, y + 29, 14, 1);
}

// ============ Per-room furniture draw ============

function drawRoomFurniture(ctx: Ctx, roomId: RoomId) {
  switch (roomId) {
    case "content-creation": {
      drawRug(ctx, 220, 230, 210, 120, "#4a1f1f", "#6b2d2d");
      drawBookshelf(ctx, 112, 100, 52, 48);
      drawPlant(ctx, 510, 96);
      drawPlant(ctx, 112, 340);
      drawRingLight(ctx, 395, 140);
      drawTripod(ctx, 445, 230);
      drawDesk(ctx, 270, 202, 90, 26);
      drawMonitor(ctx, 280, 190);
      drawMonitor(ctx, 297, 190);
      drawKeyboard(ctx, 303, 215);
      drawChair(ctx, 308, 232);
      break;
    }
    case "scalero-crm": {
      drawRug(ctx, 870, 240, 340, 110, "#1e3a5f", "#2b5076");
      drawCabinet(ctx, 862, 100);
      drawWaterCooler(ctx, 1268, 95);
      drawPlant(ctx, 1260, 340);
      drawWhiteboard(ctx, 1175, 90, 34, 22);
      drawDesk(ctx, 870, 160, 60, 24);
      drawMonitor(ctx, 878, 148);
      drawKeyboard(ctx, 893, 172);
      drawChair(ctx, 889, 190);
      drawDesk(ctx, 980, 160, 60, 24);
      drawMonitor(ctx, 988, 148);
      drawKeyboard(ctx, 1003, 172);
      drawChair(ctx, 999, 190);
      drawDesk(ctx, 1090, 160, 60, 24);
      drawMonitor(ctx, 1098, 148);
      drawKeyboard(ctx, 1113, 172);
      drawChair(ctx, 1109, 190);
      break;
    }
    case "marketing": {
      drawRug(ctx, 110, 625, 160, 130, "#5a2a2a", "#7a3d3d");
      drawWhiteboard(ctx, 240, 530, 120, 26);
      drawCouch(ctx, 120, 640, 130, 42);
      drawCoffeeTable(ctx, 140, 700, 90, 30);
      drawPlant(ctx, 515, 780);
      drawPlant(ctx, 510, 530);
      drawDesk(ctx, 370, 580, 110, 28);
      drawMonitor(ctx, 400, 568);
      drawMonitor(ctx, 418, 568);
      drawKeyboard(ctx, 410, 594);
      drawChair(ctx, 415, 612);
      break;
    }
    case "personal-brand": {
      drawRug(ctx, 940, 670, 220, 130, "#1e3a2a", "#2d5540");
      drawBookshelf(ctx, 862, 550, 52, 74);
      drawPlant(ctx, 1260, 540);
      drawPlant(ctx, 862, 780);
      drawLamp(ctx, 1260, 780);
      drawDesk(ctx, 1050, 620, 110, 28);
      drawMonitor(ctx, 1075, 608);
      drawMic(ctx, 1095, 610);
      drawKeyboard(ctx, 1085, 636);
      drawChair(ctx, 1090, 652);
      break;
    }
  }
}

function drawCorridorDecor(ctx: Ctx) {
  drawPlant(ctx, 610, 418);
  drawPlant(ctx, 780, 418);
  drawPlant(ctx, 610, 468);
  drawPlant(ctx, 780, 468);
}

function drawRoomLabel(ctx: Ctx, room: Room) {
  const cx = room.zone.x + room.zone.w / 2;
  const y = room.zone.y + 8;
  ctx.font =
    '10px "Press Start 2P", ui-monospace, SFMono-Regular, monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const label = room.name.toUpperCase();
  const metrics = ctx.measureText(label);
  const pad = 6;
  const bw = Math.ceil(metrics.width) + pad * 2;
  const bh = 16;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(Math.round(cx - bw / 2), y, bw, bh);
  ctx.fillStyle = room.accent;
  ctx.fillRect(Math.round(cx - bw / 2), y, bw, 1);
  ctx.fillRect(Math.round(cx - bw / 2), y + bh - 1, bw, 1);
  ctx.fillStyle = "#e5e5e5";
  ctx.fillText(label, cx, y + 3);
}

// ============ Character sprite ============

function drawCharacter(
  ctx: Ctx,
  cx: number,
  cy: number,
  facing: Facing,
  moving: boolean,
  tick: number
) {
  // Animated bob while moving
  const bob = moving ? (Math.floor(tick / 8) % 2 === 0 ? 0 : -1) : 0;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  const rx = Math.round(cx);
  const ry = Math.round(cy) + bob;

  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(rx + x, ry + y, w, h);
  };

  // Legs
  const legSwap = moving && Math.floor(tick / 6) % 2 === 0;
  px(-3, 4, 2, 4, legSwap ? "#1e3a8a" : "#1e40af");
  px(1, 4, 2, 4, legSwap ? "#1e40af" : "#1e3a8a");
  // Shoes
  px(-3, 8, 2, 1, "#050505");
  px(1, 8, 2, 1, "#050505");

  // Torso (shirt)
  px(-4, -2, 8, 6, "#10b981");
  px(-4, -2, 8, 1, "#34d399");
  // Shirt V
  px(-1, -2, 2, 1, "#f5d0a9");

  // Arms (match facing)
  if (facing === "left") {
    px(-5, -1, 1, 4, "#10b981");
    px(-5, 3, 1, 1, "#f5d0a9");
    px(3, 0, 1, 2, "#10b981");
  } else if (facing === "right") {
    px(4, -1, 1, 4, "#10b981");
    px(4, 3, 1, 1, "#f5d0a9");
    px(-4, 0, 1, 2, "#10b981");
  } else {
    px(-5, -1, 1, 4, "#10b981");
    px(4, -1, 1, 4, "#10b981");
    px(-5, 3, 1, 1, "#f5d0a9");
    px(4, 3, 1, 1, "#f5d0a9");
  }

  // Head
  px(-3, -9, 6, 7, "#f5d0a9");
  // Face shade
  px(2, -8, 1, 5, "#e3b98c");

  // Hair (top)
  px(-3, -9, 6, 2, "#2d1a0e");
  px(-3, -7, 1, 1, "#2d1a0e");
  px(2, -7, 1, 1, "#2d1a0e");

  // Eyes
  if (facing === "down") {
    px(-2, -5, 1, 1, "#050505");
    px(1, -5, 1, 1, "#050505");
  } else if (facing === "left") {
    px(-2, -5, 1, 1, "#050505");
    px(0, -5, 1, 1, "#050505");
  } else if (facing === "right") {
    px(0, -5, 1, 1, "#050505");
    px(2, -5, 1, 1, "#050505");
  }
  // 'up' facing: eyes hidden (back of head)

  // Tiny highlight on head
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(rx - 2, ry - 6, 1, 1);
}

// ============ Lobby Screen ============

function LobbyScreen({ onJoin }: { onJoin: (lobby: LobbyState) => void }) {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"menu" | "join">("menu");
  const [savedLobby, setSavedLobby] = useState<LobbyState | null>(null);

  useEffect(() => {
    setName(localStorage.getItem("hq_player_name") ?? "");
    setSavedLobby(getSavedLobby());
  }, []);

  const handleCreate = () => {
    if (!name.trim()) return;
    const lobby: LobbyState = {
      code: generateLobbyCode(),
      playerName: name.trim(),
      playerId: getOrCreatePlayerId(),
      color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
    };
    localStorage.setItem("hq_player_name", name.trim());
    saveLobby(lobby);
    onJoin(lobby);
  };

  const handleJoin = () => {
    if (!name.trim() || !joinCode.trim()) return;
    const lobby: LobbyState = {
      code: joinCode.trim().toUpperCase(),
      playerName: name.trim(),
      playerId: getOrCreatePlayerId(),
      color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
    };
    localStorage.setItem("hq_player_name", name.trim());
    saveLobby(lobby);
    onJoin(lobby);
  };

  const handleRejoin = () => {
    if (savedLobby) onJoin(savedLobby);
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0a] text-white">
      <div className="w-full max-w-sm space-y-6 px-6">
        <div className="text-center" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          <div className="text-2xl text-emerald-400">HQ</div>
          <div className="mt-2 text-[9px] text-white/40">YOUR COMMAND CENTER</div>
          {!supabaseConfigured && (
            <div className="mt-3 text-[8px] text-yellow-400/60">
              OFFLINE MODE — set NEXT_PUBLIC_SUPABASE_URL to enable multiplayer
            </div>
          )}
        </div>

        {/* Name input */}
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-white/40">
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={16}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-emerald-500/50 focus:outline-none"
          />
        </div>

        {mode === "menu" ? (
          <div className="space-y-3">
            {savedLobby && (
              <button
                type="button"
                onClick={handleRejoin}
                className="w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-3 text-sm text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                Rejoin {savedLobby.code}
              </button>
            )}
            <button
              type="button"
              onClick={handleCreate}
              disabled={!name.trim()}
              className="w-full rounded-lg border border-white/15 bg-white/[0.05] py-3 text-sm text-white transition-colors hover:bg-white/[0.1] disabled:opacity-30"
            >
              Create Lobby
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className="w-full rounded-lg border border-white/10 bg-transparent py-3 text-sm text-white/60 transition-colors hover:bg-white/[0.03]"
            >
              Join Lobby
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-white/40">
                Lobby Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                maxLength={6}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-lg tracking-[0.3em] text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none"
                style={{ fontFamily: "'Press Start 2P', monospace" }}
              />
            </div>
            <button
              type="button"
              onClick={handleJoin}
              disabled={!name.trim() || joinCode.length < 4}
              className="w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-3 text-sm text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-30"
            >
              Join
            </button>
            <button
              type="button"
              onClick={() => setMode("menu")}
              className="w-full text-center text-xs text-white/30 hover:text-white/60"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Component ============

export default function HQPage() {
  const [lobby, setLobby] = useState<LobbyState | null>(null);

  if (!lobby) {
    return <LobbyScreen onJoin={setLobby} />;
  }

  return <HQGame lobby={lobby} onLeave={() => { clearSavedLobby(); setLobby(null); }} />;
}

function HQGame({ lobby, onLeave }: { lobby: LobbyState; onLeave: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const charRef = useRef({
    x: 700,
    y: 450,
    dir: -Math.PI / 2,
    facing: "down" as Facing,
  });
  const rafRef = useRef<number>(0);
  const inputFocusedRef = useRef(false);
  const hasLoadedRef = useRef(false);

  // Multiplayer
  const channelRef = useRef<RealtimeChannel | null>(null);
  const remotePlayersRef = useRef<Map<string, RemotePlayer>>(new Map());
  const lastBroadcastRef = useRef(0);
  const tasksByRoomRef = useRef<Record<RoomId, Task[]>>({ "content-creation": [], "scalero-crm": [], marketing: [], "personal-brand": [] });
  const hasSyncedQuestsRef = useRef(false);
  const [onlineCount, setOnlineCount] = useState(1);

  const [currentRoom, setCurrentRoom] = useState<RoomId | null>(null);
  const [currentInteractable, setCurrentInteractable] =
    useState<Interactable | null>(null);
  const interactableRef = useRef<Interactable | null>(null);
  const [tasksByRoom, setTasksByRoom] = useState<Record<RoomId, Task[]>>({
    "content-creation": [],
    "scalero-crm": [],
    marketing: [],
    "personal-brand": [],
  });
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskXP, setNewTaskXP] = useState<XpTier>(20);
  const [newTaskQuest, setNewTaskQuest] = useState<QuestType>("side");
  const [pcTab, setPcTab] = useState<"tasks" | "apps">("tasks");
  const [playerStats, setPlayerStats] = useState<PlayerStats>(defaultPlayerStats);
  const [showQuestLog, setShowQuestLog] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [levelUpFlash, setLevelUpFlash] = useState<number | null>(null);

  // Load tasks.
  useEffect(() => {
    const loaded: Record<RoomId, Task[]> = {
      "content-creation": [],
      "scalero-crm": [],
      marketing: [],
      "personal-brand": [],
    };
    for (const room of ROOMS) {
      const key = storageKey(room.id);
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.tasks)) {
            loaded[room.id] = parsed.tasks;
          }
        } catch {
          loaded[room.id] = [];
        }
      } else {
        const now = Date.now();
        loaded[room.id] = room.defaultTasks.map((text, i) => ({
          id: genId(),
          text,
          done: false,
          createdAt: now + i,
          xpReward: 20 as XpTier,
          questType: "side" as QuestType,
        }));
        localStorage.setItem(key, JSON.stringify({ tasks: loaded[room.id] }));
      }
    }
    setTasksByRoom(loaded);
    hasLoadedRef.current = true;
  }, []);

  // Persist tasks + keep ref in sync.
  useEffect(() => {
    tasksByRoomRef.current = tasksByRoom;
    if (!hasLoadedRef.current) return;
    for (const room of ROOMS) {
      localStorage.setItem(
        storageKey(room.id),
        JSON.stringify({ tasks: tasksByRoom[room.id] ?? [] })
      );
    }
  }, [tasksByRoom]);

  // Load player stats + daily reset.
  useEffect(() => {
    const raw = localStorage.getItem("playerStats");
    let stats: PlayerStats = defaultPlayerStats();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        stats = { ...defaultPlayerStats(), ...parsed };
        if (!stats.roomXP) stats.roomXP = { ...EMPTY_ROOM_XP };
      } catch {
        stats = defaultPlayerStats();
      }
    }
    const today = todayStr();
    if (stats.lastResetDate !== today) {
      // Daily reset: reset daily quests, update streak
      const yesterday = yesterdayStr();
      if (stats.streak.lastDate === yesterday && stats.dailyQuestsCompletedToday >= 3) {
        stats.streak.count += 1;
        stats.streak.lastDate = today;
      } else if (stats.streak.lastDate !== today) {
        if (stats.dailyQuestsCompletedToday < 3) {
          stats.streak.count = 0;
        }
      }
      // Reset daily-only tasks across all rooms
      stats.dailyQuestsCompletedToday = 0;
      stats.questsCompleted.today = 0;
      // Week reset (Monday)
      const dow = new Date().getDay();
      if (dow === 1 && stats.lastResetDate < today) {
        stats.questsCompleted.week = 0;
      }
      stats.lastResetDate = today;
      // Reset daily quest tasks in each room
      setTasksByRoom((prev) => {
        const next = { ...prev };
        for (const rid of Object.keys(next) as RoomId[]) {
          next[rid] = next[rid].map((t) =>
            t.questType === "daily" ? { ...t, done: false } : t
          );
        }
        return next;
      });
    }
    setPlayerStats(stats);
    localStorage.setItem("playerStats", JSON.stringify(stats));
  }, []);

  // Persist player stats.
  useEffect(() => {
    localStorage.setItem("playerStats", JSON.stringify(playerStats));
  }, [playerStats]);

  // Award XP helper.
  const awardXP = useCallback(
    (roomId: RoomId, baseXP: XpTier, questType: QuestType) => {
      setPlayerStats((prev) => {
        const mult = streakMultiplier(prev.streak.count);
        const gained = Math.round(baseXP * mult);
        const prevLevel = xpToLevel(prev.totalXP);
        const newTotalXP = prev.totalXP + gained;
        const newLevel = xpToLevel(newTotalXP);
        if (newLevel > prevLevel) {
          setLevelUpFlash(newLevel);
          setTimeout(() => setLevelUpFlash(null), 2000);
        }
        const today = todayStr();
        const log = [...prev.dailyXPLog];
        const todayEntry = log.find((e) => e.date === today);
        if (todayEntry) {
          todayEntry.xp += gained;
        } else {
          log.push({ date: today, xp: gained });
        }
        // Keep only last 14 days
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 14);
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        const trimmedLog = log.filter((e) => e.date >= cutoffStr);

        const newDailyCompleted =
          questType === "daily"
            ? prev.dailyQuestsCompletedToday + 1
            : prev.dailyQuestsCompletedToday;
        const newStreak = { ...prev.streak };
        if (newDailyCompleted >= 3 && prev.dailyQuestsCompletedToday < 3) {
          newStreak.count += 1;
          newStreak.lastDate = today;
        }

        return {
          ...prev,
          totalXP: newTotalXP,
          roomXP: {
            ...prev.roomXP,
            [roomId]: (prev.roomXP[roomId] ?? 0) + gained,
          },
          streak: newStreak,
          dailyXPLog: trimmedLog,
          questsCompleted: {
            today: prev.questsCompleted.today + 1,
            week: prev.questsCompleted.week + 1,
            allTime: prev.questsCompleted.allTime + 1,
          },
          dailyQuestsCompletedToday: newDailyCompleted,
        };
      });
    },
    []
  );

  // Supabase Realtime channel.
  useEffect(() => {
    if (!supabaseConfigured) return;
    const channel = supabase.channel(`hq:${lobby.code}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "pos" }, ({ payload }) => {
        if (!payload || payload.id === lobby.playerId) return;
        const p = payload as {
          id: string;
          name: string;
          color: string;
          x: number;
          y: number;
          facing: Facing;
          moving: boolean;
        };
        remotePlayersRef.current.set(p.id, {
          ...p,
          lastSeen: Date.now(),
        });
      })
      .on("broadcast", { event: "leave" }, ({ payload }) => {
        if (payload?.id) remotePlayersRef.current.delete(payload.id);
      })
      .on("broadcast", { event: "quest_add" }, ({ payload }) => {
        if (!payload || payload.senderId === lobby.playerId) return;
        const { roomId, task } = payload as { roomId: RoomId; task: Task; senderId: string };
        setTasksByRoom((prev) => {
          const existing = prev[roomId] ?? [];
          if (existing.some((t) => t.id === task.id)) return prev;
          return { ...prev, [roomId]: [...existing, task] };
        });
      })
      .on("broadcast", { event: "quest_toggle" }, ({ payload }) => {
        if (!payload || payload.senderId === lobby.playerId) return;
        const { roomId, taskId } = payload as { roomId: RoomId; taskId: string; senderId: string };
        setTasksByRoom((prev) => ({
          ...prev,
          [roomId]: (prev[roomId] ?? []).map((t) =>
            t.id === taskId ? { ...t, done: !t.done } : t
          ),
        }));
      })
      .on("broadcast", { event: "quest_delete" }, ({ payload }) => {
        if (!payload || payload.senderId === lobby.playerId) return;
        const { roomId, taskId } = payload as { roomId: RoomId; taskId: string; senderId: string };
        setTasksByRoom((prev) => ({
          ...prev,
          [roomId]: (prev[roomId] ?? []).filter((t) => t.id !== taskId),
        }));
      })
      .on("broadcast", { event: "quest_sync_request" }, ({ payload }) => {
        if (!payload || payload.senderId === lobby.playerId) return;
        // Someone joined and wants the current quest state — send it
        channel.send({
          type: "broadcast",
          event: "quest_sync_response",
          payload: { senderId: lobby.playerId, tasks: tasksByRoomRef.current },
        });
      })
      .on("broadcast", { event: "quest_sync_response" }, ({ payload }) => {
        if (!payload || payload.senderId === lobby.playerId) return;
        if (!hasSyncedQuestsRef.current) {
          hasSyncedQuestsRef.current = true;
          const remoteTasks = payload.tasks as Record<RoomId, Task[]>;
          setTasksByRoom(remoteTasks);
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            id: lobby.playerId,
            name: lobby.playerName,
            color: lobby.color,
          });
          // Immediate position broadcast so others see us right away
          const char = charRef.current;
          channel.send({
            type: "broadcast",
            event: "pos",
            payload: {
              id: lobby.playerId,
              name: lobby.playerName,
              color: lobby.color,
              x: Math.round(char.x),
              y: Math.round(char.y),
              facing: char.facing,
              moving: false,
            },
          });
          // Request quest state from others already in the lobby
          setTimeout(() => {
            channel.send({
              type: "broadcast",
              event: "quest_sync_request",
              payload: { senderId: lobby.playerId },
            });
          }, 500);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.send({
        type: "broadcast",
        event: "leave",
        payload: { id: lobby.playerId },
      });
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [lobby.code, lobby.playerId, lobby.playerName, lobby.color]);

  // Broadcast position — ~15Hz when moving, ~2Hz when idle.
  const broadcastPosition = useCallback(() => {
    if (!supabaseConfigured) return;
    const ch = channelRef.current;
    if (!ch) return;
    const now = Date.now();
    const isMoving =
      keysRef.current.has("w") ||
      keysRef.current.has("s") ||
      keysRef.current.has("a") ||
      keysRef.current.has("d") ||
      keysRef.current.has("arrowup") ||
      keysRef.current.has("arrowdown") ||
      keysRef.current.has("arrowleft") ||
      keysRef.current.has("arrowright");
    const interval = isMoving ? 66 : 500;
    if (now - lastBroadcastRef.current < interval) return;
    lastBroadcastRef.current = now;
    const char = charRef.current;
    ch.send({
      type: "broadcast",
      event: "pos",
      payload: {
        id: lobby.playerId,
        name: lobby.playerName,
        color: lobby.color,
        x: Math.round(char.x),
        y: Math.round(char.y),
        facing: char.facing,
        moving: isMoving,
      },
    });
  }, [lobby.playerId, lobby.playerName, lobby.color]);

  // Keyboard.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (inputFocusedRef.current) return;
      const k = e.key.toLowerCase();
      if (
        k === "arrowup" ||
        k === "arrowdown" ||
        k === "arrowleft" ||
        k === "arrowright"
      ) {
        e.preventDefault();
      }
      keysRef.current.add(k);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    const onBlur = () => keysRef.current.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Game loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let viewW = window.innerWidth;
    let viewH = window.innerHeight;
    let dpr = window.devicePixelRatio || 1;

    const resize = () => {
      viewW = window.innerWidth;
      viewH = window.innerHeight;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewW * dpr);
      canvas.height = Math.floor(viewH * dpr);
      canvas.style.width = viewW + "px";
      canvas.style.height = viewH + "px";
    };
    resize();
    window.addEventListener("resize", resize);

    let lastRoom: RoomId | null = null;
    let lastInteractableId: string | null = null;
    let tick = 0;

    const loop = () => {
      tick++;

      // --- Input & movement ---
      const keys = keysRef.current;
      let dx = 0;
      let dy = 0;
      if (keys.has("w") || keys.has("arrowup")) dy -= 1;
      if (keys.has("s") || keys.has("arrowdown")) dy += 1;
      if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
      if (keys.has("d") || keys.has("arrowright")) dx += 1;

      const moving = dx !== 0 || dy !== 0;
      if (moving) {
        const mag = Math.hypot(dx, dy);
        dx = (dx / mag) * SPEED;
        dy = (dy / mag) * SPEED;
        charRef.current.dir = Math.atan2(dy, dx);
        charRef.current.facing = dirToFacing(
          charRef.current.dir,
          true,
          charRef.current.facing
        );
      }

      const char = charRef.current;
      const nx = char.x + dx;
      const ny = char.y + dy;

      if (isWalkable(nx, ny)) {
        char.x = nx;
        char.y = ny;
      } else if (isWalkable(nx, char.y)) {
        char.x = nx;
      } else if (isWalkable(char.x, ny)) {
        char.y = ny;
      }

      // Always broadcast — even when idle, so others see you
      broadcastPosition();

      // Room detection
      const room = detectRoom(char.x, char.y);
      if (room !== lastRoom) {
        lastRoom = room;
        setCurrentRoom(room);
      }

      // Interactable detection
      const nearby = detectInteractable(char.x, char.y);
      const nearbyId = nearby?.id ?? null;
      if (nearbyId !== lastInteractableId) {
        lastInteractableId = nearbyId;
        interactableRef.current = nearby;
        setCurrentInteractable(nearby);
      }

      // --- Draw ---
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = OUTSIDE_COLOR;
      ctx.fillRect(0, 0, viewW, viewH);

      // Camera follows character at fixed zoom.
      const scale = CAMERA_SCALE;
      const visibleW = viewW / scale;
      const visibleH = viewH / scale;

      let camX = char.x - visibleW / 2;
      let camY = char.y - visibleH / 2;
      if (WORLD_W > visibleW) {
        camX = Math.max(0, Math.min(WORLD_W - visibleW, camX));
      } else {
        camX = (WORLD_W - visibleW) / 2;
      }
      if (WORLD_H > visibleH) {
        camY = Math.max(0, Math.min(WORLD_H - visibleH, camY));
      } else {
        camY = (WORLD_H - visibleH) / 2;
      }

      ctx.save();
      ctx.scale(scale, scale);
      ctx.translate(-camX, -camY);

      // Outside ground texture (only covers what camera sees)
      ctx.fillStyle = "#060606";
      ctx.fillRect(camX, camY, visibleW, visibleH);
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      const gxStart = Math.floor(camX / 16) * 16;
      const gyStart = Math.floor(camY / 16) * 16;
      for (let gx = gxStart; gx < camX + visibleW; gx += 16) {
        for (let gy = gyStart; gy < camY + visibleH; gy += 16) {
          ctx.fillRect(gx, gy, 1, 1);
        }
      }

      // Room floors (wood planks)
      for (const r of ROOMS) {
        drawPlankFloor(ctx, r.zone, "light");
      }
      // Corridor + doorway floors (darker wood)
      for (const c of CORRIDORS) {
        drawPlankFloor(ctx, c, "dark");
      }

      // Walls
      drawWalls(ctx);

      // Corridor decor
      drawCorridorDecor(ctx);

      // Per-room furniture
      for (const r of ROOMS) {
        drawRoomFurniture(ctx, r.id);
      }

      // Room labels (drawn last so they stay readable)
      for (const r of ROOMS) {
        drawRoomLabel(ctx, r);
      }

      // Interactable highlight (pulsing outline)
      const activeIt = interactableRef.current;
      if (activeIt) {
        const pulse = 0.55 + 0.35 * Math.sin(tick * 0.15);
        const hl = activeIt.highlight;
        ctx.save();
        ctx.strokeStyle = `rgba(255, 230, 90, ${pulse.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(hl.x - 1, hl.y - 1, hl.w + 2, hl.h + 2);
        ctx.strokeStyle = `rgba(255, 230, 90, ${(pulse * 0.4).toFixed(3)})`;
        ctx.strokeRect(hl.x - 3, hl.y - 3, hl.w + 6, hl.h + 6);
        ctx.restore();
      }

      // Remote players
      const now = Date.now();
      remotePlayersRef.current.forEach((rp, id) => {
        if (now - rp.lastSeen > 30000) {
          remotePlayersRef.current.delete(id);
          return;
        }
        drawCharacter(ctx, rp.x, rp.y, rp.facing, rp.moving, tick);
        // Name label
        ctx.save();
        ctx.font = "5px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        const tw = ctx.measureText(rp.name).width;
        ctx.fillRect(rp.x - tw / 2 - 2, rp.y + 10, tw + 4, 8);
        ctx.fillStyle = rp.color;
        ctx.fillText(rp.name, rp.x, rp.y + 16);
        ctx.restore();
      });

      // Local character
      drawCharacter(ctx, char.x, char.y, char.facing, moving, tick);
      // Local name label
      ctx.save();
      ctx.font = "5px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      const myNameW = ctx.measureText(lobby.playerName).width;
      ctx.fillRect(char.x - myNameW / 2 - 2, char.y + 10, myNameW + 4, 8);
      ctx.fillStyle = "#4ade80";
      ctx.fillText(lobby.playerName, char.x, char.y + 16);
      ctx.restore();

      ctx.restore();

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Task handlers.
  const broadcastQuest = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      const ch = channelRef.current;
      if (!ch || !supabaseConfigured) return;
      ch.send({ type: "broadcast", event, payload: { ...payload, senderId: lobby.playerId } });
    },
    [lobby.playerId]
  );

  const addTask = useCallback(
    (roomId: RoomId, text: string, xpReward: XpTier = 20, questType: QuestType = "side") => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const task: Task = { id: genId(), text: trimmed, done: false, createdAt: Date.now(), xpReward, questType };
      setTasksByRoom((prev) => ({
        ...prev,
        [roomId]: [...(prev[roomId] ?? []), task],
      }));
      broadcastQuest("quest_add", { roomId, task });
    },
    [broadcastQuest]
  );

  const toggleTask = useCallback(
    (roomId: RoomId, id: string) => {
      setTasksByRoom((prev) => {
        const tasks = prev[roomId] ?? [];
        const task = tasks.find((t) => t.id === id);
        if (task && !task.done) {
          awardXP(roomId, task.xpReward ?? 20, task.questType ?? "side");
        }
        return {
          ...prev,
          [roomId]: tasks.map((t) =>
            t.id === id ? { ...t, done: !t.done } : t
          ),
        };
      });
      broadcastQuest("quest_toggle", { roomId, taskId: id });
    },
    [awardXP, broadcastQuest]
  );

  const deleteTask = useCallback((roomId: RoomId, id: string) => {
    setTasksByRoom((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] ?? []).filter((t) => t.id !== id),
    }));
    broadcastQuest("quest_delete", { roomId, taskId: id });
  }, [broadcastQuest]);

  const roomData = currentRoom
    ? ROOMS.find((r) => r.id === currentRoom) ?? null
    : null;
  const tasks = currentRoom ? tasksByRoom[currentRoom] ?? [] : [];
  const doneCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;
  const progress = totalCount ? (doneCount / totalCount) * 100 : 0;
  const allDone = totalCount > 0 && doneCount === totalCount;

  // Interactable modal state
  const interactableRoomData = currentInteractable
    ? ROOMS.find((r) => r.id === currentInteractable.roomId) ?? null
    : null;
  const interactableTasks = currentInteractable
    ? tasksByRoom[currentInteractable.roomId] ?? []
    : [];
  const showSidePanel = !currentInteractable && !!roomData;

  // Gamification derived values
  const level = xpToLevel(playerStats.totalXP);
  const currentLevelXP = xpForLevel(level);
  const nextLevelXP = xpForNextLevel(level);
  const xpInLevel = playerStats.totalXP - currentLevelXP;
  const xpNeeded = nextLevelXP - currentLevelXP;
  const levelProgress = xpNeeded > 0 ? Math.min((xpInLevel / xpNeeded) * 100, 100) : 100;
  const title = levelTitle(level);
  const streak = playerStats.streak.count;
  const mult = streakMultiplier(streak);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-[#0a0a0a] text-white select-none"
      style={{
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      {/* HUD Bar */}
      <div
        className="absolute top-0 left-0 right-0 z-30 flex h-11 items-center justify-between border-b border-white/[0.08] bg-[#0f0f0f]/95 px-4 backdrop-blur-sm"
      >
        {/* Left: Level + XP */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
            <span className="text-[9px] text-emerald-400">LV{level}</span>
            <span className="text-[8px] text-white/50">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className={`h-full transition-all duration-300 ${levelProgress > 85 ? "bg-emerald-400" : "bg-white/80"}`}
                style={{ width: `${levelProgress}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-white/40">
              {playerStats.totalXP.toLocaleString()} XP
            </span>
          </div>
        </div>

        {/* Right: Streak + Buttons */}
        <div className="flex items-center gap-3">
          {streak > 0 && (
            <div
              className="flex items-center gap-1.5"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              <span className="text-[10px]">🔥</span>
              <span className="text-[9px] text-orange-400">{streak}</span>
              {mult > 1 && (
                <span className="text-[8px] text-orange-300/70">{mult}x</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1">
            <span className="text-[8px] text-white/30">LOBBY</span>
            <span
              className="text-[9px] tracking-widest text-white/70"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              {lobby.code}
            </span>
            <span className="text-[8px] text-white/25">·</span>
            <span className="text-[9px] text-emerald-400">{onlineCount}</span>
            <span className="text-[8px] text-white/25">online</span>
          </div>
          <button
            type="button"
            onClick={() => setShowQuestLog(true)}
            className="rounded-md border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/60 transition-colors hover:border-white/25 hover:text-white"
          >
            Quests
          </button>
          <button
            type="button"
            onClick={() => setShowStats(true)}
            className="rounded-md border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/60 transition-colors hover:border-white/25 hover:text-white"
          >
            Stats
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-1 text-[10px] text-red-400/70 transition-colors hover:border-red-500/40 hover:text-red-400"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Level up flash */}
      {levelUpFlash !== null && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center animate-[fadeOut_2s_ease-out_forwards]">
          <div className="rounded-xl border border-emerald-400/30 bg-black/80 px-8 py-5 text-center backdrop-blur-md">
            <div
              className="text-[14px] text-emerald-400 animate-[pulse_0.5s_ease-in-out_3]"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              LEVEL UP!
            </div>
            <div
              className="mt-2 text-[24px] text-white"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              {levelUpFlash}
            </div>
            <div className="mt-1 text-xs text-white/50">{levelTitle(levelUpFlash)}</div>
          </div>
        </div>
      )}

      {/* Corner hint */}
      <div
        className="pointer-events-none absolute bottom-5 left-5 text-[10px] leading-relaxed text-white/40"
        style={{
          fontFamily:
            "'Press Start 2P', ui-monospace, SFMono-Regular, monospace",
        }}
      >
        WASD TO MOVE
      </div>

      {/* Side panel */}
      <aside
        className={`absolute top-0 right-0 h-full w-[360px] border-l border-white/10 bg-[#0f0f0f] shadow-[0_0_60px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out will-change-transform ${
          showSidePanel ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {roomData && (
          <div className="flex h-full flex-col pt-11">
            {/* Header */}
            <div className="border-b border-white/[0.06] px-6 pt-5 pb-4">
              <h1
                className="flex items-center gap-3 text-sm leading-snug text-white"
                style={{ fontFamily: "'Press Start 2P', monospace" }}
              >
                <span className="text-xl">{roomData.emoji}</span>
                <span>{roomData.name}</span>
              </h1>
              <p className="mt-2 text-[10px] text-white/40">
                Room XP: {(playerStats.roomXP[roomData.id] ?? 0).toLocaleString()}
              </p>
            </div>

            {/* Skill Tree */}
            {(() => {
              const tree = SKILL_TREES[roomData.id];
              const roomXP = playerStats.roomXP[roomData.id] ?? 0;
              const unlocked = unlockedNodes(roomXP, tree.thresholds);
              return (
                <div className="border-b border-white/[0.06] px-6 py-3">
                  <div className="mb-2 text-[9px] uppercase tracking-[0.15em] text-white/30">
                    {tree.name} Skill Tree — {unlocked}/{tree.nodes.length}
                  </div>
                  <div className="flex items-center gap-1">
                    {tree.nodes.map((node, i) => {
                      const isUnlocked = i < unlocked;
                      return (
                        <div key={node} className="flex items-center gap-1">
                          <div
                            className={`rounded-md border px-2 py-1 text-[8px] transition-all ${
                              isUnlocked
                                ? "border-white/30 bg-white/10 text-white shadow-[0_0_6px_rgba(255,255,255,0.15)]"
                                : "border-white/[0.06] bg-white/[0.02] text-white/25"
                            }`}
                            title={`${node} — ${tree.thresholds[i]} XP`}
                          >
                            {node}
                          </div>
                          {i < tree.nodes.length - 1 && (
                            <span className={`text-[8px] ${i < unlocked - 1 ? "text-white/40" : "text-white/10"}`}>→</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Progress */}
            <div className="border-b border-white/[0.06] px-6 py-3">
              <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider">
                <span className={allDone ? "text-emerald-400" : "text-white/50"}>
                  {allDone ? "All done 🎯" : `${doneCount} / ${totalCount} quests done`}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={`h-full transition-all duration-300 ${allDone ? "bg-emerald-500" : "bg-white"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Quest input */}
            <div className="flex flex-col gap-2 px-6 py-3 border-b border-white/[0.06]">
              <input
                type="text"
                value={newTaskText}
                onFocus={() => { inputFocusedRef.current = true; keysRef.current.clear(); }}
                onBlur={() => { inputFocusedRef.current = false; }}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addTask(roomData.id, newTaskText, newTaskXP, newTaskQuest);
                    setNewTaskText("");
                  }
                }}
                placeholder="+ New quest, press Enter"
                className="w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {QUEST_TYPES.map((qt) => (
                    <button
                      key={qt.value}
                      type="button"
                      onClick={() => setNewTaskQuest(qt.value)}
                      className={`rounded px-1.5 py-0.5 text-[9px] border transition-colors ${
                        newTaskQuest === qt.value
                          ? "border-white/30 bg-white/10 text-white"
                          : "border-transparent text-white/30 hover:text-white/60"
                      }`}
                      title={qt.label}
                    >
                      {qt.emoji}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex gap-1">
                  {XP_TIERS.map((tier) => (
                    <button
                      key={tier.value}
                      type="button"
                      onClick={() => setNewTaskXP(tier.value)}
                      className={`rounded px-1.5 py-0.5 text-[8px] tabular-nums border transition-colors ${
                        newTaskXP === tier.value
                          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                          : "border-transparent text-white/25 hover:text-white/50"
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quest list */}
            <div className="flex min-h-0 flex-1 flex-col px-6 py-3">
              <ul className="flex-1 space-y-0.5 overflow-y-auto pr-1">
                {tasks.length === 0 && (
                  <li className="py-6 text-center text-xs text-white/25">
                    No quests yet. Add one above.
                  </li>
                )}
                {tasks.map((task) => {
                  const qt = QUEST_TYPES.find((q) => q.value === task.questType);
                  return (
                    <li
                      key={task.id}
                      className="group flex items-center gap-2 rounded-md px-2 py-1.5 -mx-2 hover:bg-white/[0.03]"
                    >
                      <button
                        type="button"
                        onClick={() => toggleTask(roomData.id, task.id)}
                        aria-label={task.done ? "Mark incomplete" : "Mark complete"}
                        className={`flex h-4 w-4 flex-none items-center justify-center rounded-[3px] border transition-colors ${
                          task.done
                            ? "border-emerald-500 bg-emerald-500 text-black"
                            : "border-white/25 bg-transparent hover:border-white/60"
                        }`}
                      >
                        {task.done && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5.2L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <span className="text-[10px]" title={qt?.label}>{qt?.emoji ?? "🟡"}</span>
                      <span
                        onClick={() => toggleTask(roomData.id, task.id)}
                        className={`flex-1 cursor-pointer text-sm leading-snug ${
                          task.done ? "text-white/60 line-through opacity-40" : "text-white/90"
                        }`}
                      >
                        {task.text}
                      </span>
                      <span className="text-[8px] tabular-nums text-white/25">
                        {task.xpReward ?? 20}xp
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteTask(roomData.id, task.id)}
                        aria-label="Delete task"
                        className="opacity-0 transition-opacity group-hover:opacity-100 text-white/40 hover:text-white"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Quick launch */}
            <div className="border-t border-white/[0.06] px-6 py-3">
              <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-white/30">
                Quick Launch
              </div>
              <div className="grid grid-cols-2 gap-2">
                {roomData.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.015] px-3 py-2 transition-all duration-150 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <span className="text-base">{link.emoji}</span>
                    <span className="truncate text-xs text-white/80 group-hover:text-white">{link.label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* PC modal */}
      {currentInteractable?.kind === "pc" && interactableRoomData && (
        <PCModal
          label={currentInteractable.label}
          room={interactableRoomData}
          tasks={interactableTasks}
          tab={pcTab}
          onTabChange={setPcTab}
          onAddTask={(text, xp, quest) => addTask(interactableRoomData.id, text, xp, quest)}
          onToggleTask={(id) => toggleTask(interactableRoomData.id, id)}
          onDeleteTask={(id) => deleteTask(interactableRoomData.id, id)}
          onFocusInput={() => {
            inputFocusedRef.current = true;
            keysRef.current.clear();
          }}
          onBlurInput={() => {
            inputFocusedRef.current = false;
          }}
        />
      )}

      {/* Whiteboard modal */}
      {currentInteractable?.kind === "whiteboard" && (
        <WhiteboardModal
          id={currentInteractable.id}
          label={currentInteractable.label}
        />
      )}

      {/* Quest Log overlay */}
      {showQuestLog && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative flex h-[85vh] max-h-[800px] w-[90vw] max-w-[720px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0c] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <span className="text-sm text-white" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                Quest Log
              </span>
              <button
                type="button"
                onClick={() => setShowQuestLog(false)}
                className="text-white/40 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {QUEST_TYPES.map((qt) => {
                const questsInType: { roomId: RoomId; roomName: string; task: Task }[] = [];
                for (const room of ROOMS) {
                  for (const task of tasksByRoom[room.id] ?? []) {
                    if ((task.questType ?? "side") === qt.value) {
                      questsInType.push({ roomId: room.id, roomName: room.name, task });
                    }
                  }
                }
                return (
                  <div key={qt.value}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm">{qt.emoji}</span>
                      <span className="text-[10px] uppercase tracking-widest" style={{ color: qt.color }}>
                        {qt.label}
                      </span>
                      <span className="text-[9px] text-white/25">
                        ({questsInType.filter((q) => q.task.done).length}/{questsInType.length})
                      </span>
                    </div>
                    {questsInType.length === 0 ? (
                      <p className="text-xs text-white/20 pl-6">No quests</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {questsInType.map(({ roomId, roomName, task }) => (
                          <li
                            key={task.id}
                            className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.03]"
                          >
                            <button
                              type="button"
                              onClick={() => toggleTask(roomId, task.id)}
                              className={`flex h-4 w-4 flex-none items-center justify-center rounded-[3px] border transition-colors ${
                                task.done
                                  ? "border-emerald-500 bg-emerald-500 text-black"
                                  : "border-white/25 bg-transparent hover:border-white/60"
                              }`}
                            >
                              {task.done && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M1.5 5.2L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </button>
                            <span className={`flex-1 text-sm ${task.done ? "text-white/40 line-through" : "text-white/90"}`}>
                              {task.text}
                            </span>
                            <span className="text-[8px] text-white/20">{roomName}</span>
                            <span className="text-[8px] tabular-nums text-white/25">{task.xpReward ?? 20}xp</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stats overlay */}
      {showStats && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative flex h-[85vh] max-h-[800px] w-[90vw] max-w-[620px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0c] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <span className="text-sm text-white" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                Save Point
              </span>
              <button
                type="button"
                onClick={() => setShowStats(false)}
                className="text-white/40 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Character card */}
              <div className="flex items-center gap-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400"
                  style={{ fontFamily: "'Press Start 2P', monospace" }}
                >
                  <span className="text-xl">{level}</span>
                </div>
                <div>
                  <div className="text-sm text-white" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                    {title}
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    {playerStats.totalXP.toLocaleString()} Total XP
                  </div>
                </div>
              </div>

              {/* Streak */}
              <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
                <span className="text-2xl">🔥</span>
                <div>
                  <div className="text-sm text-white">
                    {streak} Day Streak
                  </div>
                  <div className="text-xs text-white/40">
                    Multiplier: {mult}x
                    {mult > 1 && " — bonus XP active!"}
                  </div>
                </div>
              </div>

              {/* Quest stats */}
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-white/30">
                  Quests Completed
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Today", value: playerStats.questsCompleted.today },
                    { label: "This Week", value: playerStats.questsCompleted.week },
                    { label: "All Time", value: playerStats.questsCompleted.allTime },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                      <div className="text-lg tabular-nums text-white" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                        {s.value}
                      </div>
                      <div className="mt-1 text-[9px] text-white/40">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* XP per day chart (last 7 days) */}
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-white/30">
                  XP Last 7 Days
                </div>
                {(() => {
                  const days: { label: string; xp: number }[] = [];
                  for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const ds = d.toISOString().slice(0, 10);
                    const entry = playerStats.dailyXPLog.find((e) => e.date === ds);
                    days.push({
                      label: d.toLocaleDateString("en", { weekday: "short" }),
                      xp: entry?.xp ?? 0,
                    });
                  }
                  const maxXP = Math.max(...days.map((d) => d.xp), 1);
                  return (
                    <div className="flex items-end gap-2 h-24">
                      {days.map((d, i) => (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                          <div className="flex flex-1 w-full items-end">
                            <div
                              className="w-full rounded-sm bg-white/80 transition-all duration-300"
                              style={{ height: `${Math.max((d.xp / maxXP) * 100, d.xp > 0 ? 4 : 0)}%` }}
                            />
                          </div>
                          <span className="text-[7px] text-white/30">{d.label}</span>
                          {d.xp > 0 && (
                            <span className="text-[7px] tabular-nums text-white/40">{d.xp}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Skill trees summary */}
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-white/30">
                  Skill Progress
                </div>
                <div className="space-y-2">
                  {ROOMS.map((room) => {
                    const tree = SKILL_TREES[room.id];
                    const rxp = playerStats.roomXP[room.id] ?? 0;
                    const unlocked = unlockedNodes(rxp, tree.thresholds);
                    return (
                      <div key={room.id} className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                        <span className="text-sm">{room.emoji}</span>
                        <span className="flex-1 text-xs text-white/80">{tree.name}</span>
                        <div className="flex gap-1">
                          {tree.nodes.map((_, i) => (
                            <div
                              key={i}
                              className={`h-2 w-2 rounded-full ${
                                i < unlocked ? "bg-white shadow-[0_0_4px_rgba(255,255,255,0.3)]" : "bg-white/10"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[9px] tabular-nums text-white/30">{unlocked}/{tree.nodes.length}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ PC Modal ============

interface PCModalProps {
  label: string;
  room: Room;
  tasks: Task[];
  tab: "tasks" | "apps";
  onTabChange: (tab: "tasks" | "apps") => void;
  onAddTask: (text: string, xp: XpTier, quest: QuestType) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onFocusInput: () => void;
  onBlurInput: () => void;
}

function PCModal({
  label,
  room,
  tasks,
  tab,
  onTabChange,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onFocusInput,
  onBlurInput,
}: PCModalProps) {
  const [draft, setDraft] = useState("");
  const [draftXP, setDraftXP] = useState<XpTier>(20);
  const [draftQuest, setDraftQuest] = useState<QuestType>("side");
  const doneCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div
        className="pointer-events-auto relative flex h-[78vh] max-h-[720px] w-[86vw] max-w-[980px] flex-col overflow-hidden rounded-[14px] border-[6px] border-[#2a2a2a] bg-[#0a0a0a] shadow-[0_30px_80px_rgba(0,0,0,0.8),0_0_0_2px_#000_inset]"
        style={{
          fontFamily:
            "'Press Start 2P', ui-monospace, SFMono-Regular, monospace",
        }}
      >
        {/* Monitor bezel top */}
        <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] bg-[#141414] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <span className="ml-3 text-[9px] tracking-widest text-white/50">
              {label.toUpperCase()} // {room.name.toUpperCase()}
            </span>
          </div>
          <span className="text-[9px] text-white/30">WALK AWAY TO EXIT</span>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-white/[0.08] bg-[#0d0d0d] px-4 pt-3">
          {(["tasks", "apps"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTabChange(t)}
              className={`rounded-t-md border border-b-0 px-4 py-2 text-[9px] tracking-widest transition-colors ${
                tab === t
                  ? "border-white/15 bg-[#0a0a0a] text-white"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {t === "tasks"
                ? `TASKS (${doneCount}/${totalCount})`
                : "APPS"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col bg-[#0a0a0a] p-6">
          {tab === "tasks" && (
            <>
              <input
                type="text"
                value={draft}
                onFocus={onFocusInput}
                onBlur={onBlurInput}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onAddTask(draft, draftXP, draftQuest);
                    setDraft("");
                  }
                }}
                placeholder="+ new quest, press Enter"
                className="w-full rounded-md border border-white/[0.1] bg-black/40 px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
              />
              <div className="mt-2 flex items-center gap-2 font-sans">
                <div className="flex gap-1">
                  {QUEST_TYPES.map((qt) => (
                    <button key={qt.value} type="button" onClick={() => setDraftQuest(qt.value)}
                      className={`rounded px-1.5 py-0.5 text-[9px] border transition-colors ${
                        draftQuest === qt.value ? "border-white/30 bg-white/10 text-white" : "border-transparent text-white/30 hover:text-white/60"
                      }`}>{qt.emoji}</button>
                  ))}
                </div>
                <div className="ml-auto flex gap-1">
                  {XP_TIERS.map((tier) => (
                    <button key={tier.value} type="button" onClick={() => setDraftXP(tier.value)}
                      className={`rounded px-1.5 py-0.5 text-[8px] tabular-nums border transition-colors ${
                        draftXP === tier.value ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-transparent text-white/25 hover:text-white/50"
                      }`}>{tier.label}</button>
                  ))}
                </div>
              </div>

              <ul className="mt-4 flex-1 space-y-0.5 overflow-y-auto pr-2 font-sans">
                {tasks.length === 0 && (
                  <li className="py-10 text-center text-xs text-white/25">
                    Empty queue. Add a task above.
                  </li>
                )}
                {tasks.map((task) => {
                  const qt = QUEST_TYPES.find((q) => q.value === task.questType);
                  return (
                  <li
                    key={task.id}
                    className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-white/[0.04]"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleTask(task.id)}
                      className={`flex h-4 w-4 flex-none items-center justify-center rounded-[3px] border transition-colors ${
                        task.done
                          ? "border-emerald-500 bg-emerald-500 text-black"
                          : "border-white/25 bg-transparent hover:border-white/60"
                      }`}
                    >
                      {task.done && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5.2L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span className="text-[10px]">{qt?.emoji ?? "🟡"}</span>
                    <span
                      onClick={() => onToggleTask(task.id)}
                      className={`flex-1 cursor-pointer text-sm ${
                        task.done ? "text-white/60 line-through opacity-50" : "text-white/90"
                      }`}
                    >
                      {task.text}
                    </span>
                    <span className="text-[8px] tabular-nums text-white/25">{task.xpReward ?? 20}xp</span>
                    <button
                      type="button"
                      onClick={() => onDeleteTask(task.id)}
                      className="opacity-0 transition-opacity group-hover:opacity-100 text-white/40 hover:text-white"
                      aria-label="Delete task"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 2L10 10M10 2L2 10"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </li>
                  );
                })}
              </ul>
            </>
          )}

          {tab === "apps" && (
            <div className="grid grid-cols-2 gap-3 font-sans sm:grid-cols-3">
              {room.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.06]"
                >
                  <span className="text-3xl">{link.emoji}</span>
                  <span className="truncate text-xs text-white/80 group-hover:text-white">
                    {link.label}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Whiteboard Modal ============

interface WhiteboardModalProps {
  id: string;
  label: string;
}

const BOARD_COLORS = ["#ffffff", "#ff5a5a", "#5aa8ff", "#5aff9b", "#ffd75a"];

function WhiteboardModal({ id, label }: WhiteboardModalProps) {
  const boardRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState<string>("#ffffff");
  const [size, setSize] = useState<number>(4);
  const [erasing, setErasing] = useState(false);
  const storageId = `hq_board_${id}`;

  // Load persisted drawing on mount
  useEffect(() => {
    const canvas = boardRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const raw = localStorage.getItem(storageId);
    if (!raw) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = raw;
  }, [storageId]);

  const persist = useCallback(() => {
    const canvas = boardRef.current;
    if (!canvas) return;
    try {
      localStorage.setItem(storageId, canvas.toDataURL("image/png"));
    } catch {
      /* ignore quota */
    }
  }, [storageId]);

  const getPt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = boardRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = getPt(e);
    lastPtRef.current = p;
    // Dot on click
    const canvas = boardRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.fillStyle = erasing ? "#0a0a0a" : color;
    ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = boardRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const p = getPt(e);
    const prev = lastPtRef.current;
    if (!prev) return;
    ctx.strokeStyle = erasing ? "#0a0a0a" : color;
    ctx.lineWidth = erasing ? size * 2.5 : size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPtRef.current = p;
  };

  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPtRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    persist();
  };

  const handleClear = () => {
    const canvas = boardRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    persist();
  };

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div
        className="pointer-events-auto relative flex h-[80vh] max-h-[760px] w-[88vw] max-w-[1040px] flex-col overflow-hidden rounded-[10px] border-[10px] border-[#2b1d0d] bg-[#0a0a0a] shadow-[0_30px_80px_rgba(0,0,0,0.85)]"
        style={{
          fontFamily:
            "'Press Start 2P', ui-monospace, SFMono-Regular, monospace",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] bg-[#141414] px-5 py-3">
          <span className="text-[10px] tracking-widest text-white/60">
            {label.toUpperCase()}
          </span>
          <span className="text-[9px] text-white/30">
            WALK AWAY TO CLOSE
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.08] bg-[#0d0d0d] px-4 py-3">
          <div className="flex items-center gap-1.5">
            {BOARD_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColor(c);
                  setErasing(false);
                }}
                className={`h-5 w-5 rounded-full border-2 transition-transform ${
                  color === c && !erasing
                    ? "scale-110 border-white"
                    : "border-white/20 hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="h-5 w-px bg-white/10" />
          <div className="flex items-center gap-2 text-[9px] text-white/50">
            SIZE
            <input
              type="range"
              min={1}
              max={20}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-24 accent-white"
            />
            <span className="w-6 text-white/80">{size}</span>
          </div>
          <div className="h-5 w-px bg-white/10" />
          <button
            type="button"
            onClick={() => setErasing((v) => !v)}
            className={`rounded-md border px-3 py-1.5 text-[9px] tracking-widest transition-colors ${
              erasing
                ? "border-yellow-400 bg-yellow-400/20 text-yellow-300"
                : "border-white/15 text-white/60 hover:border-white/30 hover:text-white"
            }`}
          >
            ERASER
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md border border-red-500/40 px-3 py-1.5 text-[9px] tracking-widest text-red-300 hover:border-red-400 hover:bg-red-500/10"
          >
            CLEAR
          </button>
        </div>

        {/* Board */}
        <div className="flex min-h-0 flex-1 items-stretch justify-stretch bg-[#0a0a0a] p-4">
          <canvas
            ref={boardRef}
            width={1200}
            height={720}
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
            className="h-full w-full cursor-crosshair rounded-md bg-[#0a0a0a] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
            style={{ touchAction: "none" }}
          />
        </div>
      </div>
    </div>
  );
}