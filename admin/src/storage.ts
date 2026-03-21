import { createDemoState } from "./demo";
import type { AppState, CheckinRecord, Classmate, FeedEntry, PetState, PetStyleKey, Profile, Task } from "./types";

const STORAGE_KEY = "class-pet-garden:v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPetStyleKey(value: unknown): value is PetStyleKey {
  return value === "cute" || value === "fantasy" || value === "pixel" || value === "scifi" || value === "china";
}

function asProfile(value: unknown, fallback: Profile): Profile {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    studentName: typeof value.studentName === "string" ? value.studentName : fallback.studentName,
    className: typeof value.className === "string" ? value.className : fallback.className,
    teacherName: typeof value.teacherName === "string" ? value.teacherName : fallback.teacherName,
    schoolName: typeof value.schoolName === "string" ? value.schoolName : fallback.schoolName,
  };
}

function asPet(value: unknown, fallback: PetState): PetState {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    name: typeof value.name === "string" ? value.name : fallback.name,
    species: typeof value.species === "string" ? value.species : fallback.species,
    style: isPetStyleKey(value.style) ? value.style : fallback.style,
    xp: typeof value.xp === "number" ? value.xp : fallback.xp,
    mood: typeof value.mood === "number" ? value.mood : fallback.mood,
    energy: typeof value.energy === "number" ? value.energy : fallback.energy,
    hearts: typeof value.hearts === "number" ? value.hearts : fallback.hearts,
    lastInteractionAt:
      typeof value.lastInteractionAt === "string" ? value.lastInteractionAt : fallback.lastInteractionAt,
  };
}

function asTasks(value: unknown, fallback: Task[]): Task[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const tasks = value.filter((item): item is Task => {
    return (
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      typeof item.description === "string" &&
      typeof item.category === "string" &&
      typeof item.duration === "number" &&
      typeof item.rewardXp === "number" &&
      typeof item.rewardHearts === "number" &&
      typeof item.accent === "string"
    );
  });

  return tasks.length > 0 ? tasks : fallback;
}

function asCheckins(value: unknown, fallback: Record<string, CheckinRecord[]>) {
  if (!isRecord(value)) {
    return fallback;
  }

  const mapped: Record<string, CheckinRecord[]> = {};

  Object.entries(value).forEach(([date, records]) => {
    if (!Array.isArray(records)) {
      return;
    }

    mapped[date] = records.filter((item): item is CheckinRecord => {
      return isRecord(item) && typeof item.taskId === "string" && typeof item.completedAt === "string";
    });
  });

  return Object.keys(mapped).length > 0 ? mapped : fallback;
}

function asClassmates(value: unknown, fallback: Classmate[]): Classmate[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const classmates = value.filter((item): item is Classmate => {
    return (
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.petName === "string" &&
      typeof item.completionRate === "number" &&
      typeof item.streak === "number" &&
      typeof item.glow === "number"
    );
  });

  return classmates.length > 0 ? classmates : fallback;
}

function asFeed(value: unknown, fallback: FeedEntry[]): FeedEntry[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const feed = value.filter((item): item is FeedEntry => {
    return (
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.type === "string" &&
      typeof item.title === "string" &&
      typeof item.detail === "string" &&
      typeof item.createdAt === "string"
    );
  });

  return feed.length > 0 ? feed : fallback;
}

export function loadAppState(): AppState {
  const fallback = createDemoState();

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return fallback;
    }

    return {
      profile: asProfile(parsed.profile, fallback.profile),
      pet: asPet(parsed.pet, fallback.pet),
      tasks: asTasks(parsed.tasks, fallback.tasks),
      checkinsByDate: asCheckins(parsed.checkinsByDate, fallback.checkinsByDate),
      classmates: asClassmates(parsed.classmates, fallback.classmates),
      feed: asFeed(parsed.feed, fallback.feed),
      teacherTheme: typeof parsed.teacherTheme === "string" ? parsed.teacherTheme : fallback.teacherTheme,
    };
  } catch {
    return fallback;
  }
}

export function persistAppState(state: AppState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetAppState() {
  const nextState = createDemoState();

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  }

  return nextState;
}
