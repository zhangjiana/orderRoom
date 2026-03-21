export type AppView = "student" | "teacher";

export type TaskCategory = "morning" | "focus" | "reading" | "exercise" | "kindness";

export type AccentTone = "sunrise" | "lagoon" | "peach" | "mint" | "ember";

export type PetStyleKey = "cute" | "fantasy" | "pixel" | "scifi" | "china";

export type Task = {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  duration: number;
  rewardXp: number;
  rewardHearts: number;
  accent: AccentTone;
};

export type CheckinRecord = {
  taskId: string;
  completedAt: string;
};

export type FeedEntry = {
  id: string;
  type: "checkin" | "reward" | "teacher";
  title: string;
  detail: string;
  createdAt: string;
};

export type Classmate = {
  id: string;
  name: string;
  petName: string;
  completionRate: number;
  streak: number;
  glow: number;
};

export type Profile = {
  studentName: string;
  className: string;
  teacherName: string;
  schoolName: string;
};

export type PetState = {
  name: string;
  species: string;
  style: PetStyleKey;
  xp: number;
  mood: number;
  energy: number;
  hearts: number;
  lastInteractionAt: string;
};

export type AppState = {
  profile: Profile;
  pet: PetState;
  tasks: Task[];
  checkinsByDate: Record<string, CheckinRecord[]>;
  classmates: Classmate[];
  feed: FeedEntry[];
  teacherTheme: string;
};
