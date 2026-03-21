import type { AppState, FeedEntry, Task } from "./types";

const demoTasks: Task[] = [
  {
    id: "task-morning-reading",
    title: "晨读 15 分钟",
    description: "带着节奏读出声，把今天的状态先点亮。",
    category: "morning",
    duration: 15,
    rewardXp: 32,
    rewardHearts: 3,
    accent: "sunrise",
  },
  {
    id: "task-word-notes",
    title: "整理 5 个知识点",
    description: "写下今天最关键的 5 个知识点，形成自己的卡片。",
    category: "focus",
    duration: 20,
    rewardXp: 40,
    rewardHearts: 4,
    accent: "lagoon",
  },
  {
    id: "task-quiet-reading",
    title: "安静阅读 20 分钟",
    description: "读完一段内容后，用一句话写下你的理解。",
    category: "reading",
    duration: 20,
    rewardXp: 36,
    rewardHearts: 3,
    accent: "mint",
  },
  {
    id: "task-stretching",
    title: "眼保健与拉伸",
    description: "离开座位 8 分钟，让身体也一起完成今日任务。",
    category: "exercise",
    duration: 8,
    rewardXp: 24,
    rewardHearts: 2,
    accent: "peach",
  },
];

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function createEntry(entry: Omit<FeedEntry, "id">, index: number): FeedEntry {
  return {
    id: `feed-${index}-${entry.createdAt}`,
    ...entry,
  };
}

export function createDemoState(): AppState {
  const today = new Date();
  const yesterday = shiftDate(-1);
  const twoDaysAgo = shiftDate(-2);

  return {
    profile: {
      studentName: "林沐",
      className: "三年二班",
      teacherName: "周老师",
      schoolName: "星河实验小学",
    },
    pet: {
      name: "糖糖",
      species: "奶油猫",
      style: "cute",
      xp: 146,
      mood: 78,
      energy: 72,
      hearts: 56,
      lastInteractionAt: today.toISOString(),
    },
    tasks: demoTasks,
    checkinsByDate: {
      [getLocalDateKey(twoDaysAgo)]: [
        { taskId: "task-morning-reading", completedAt: new Date(twoDaysAgo.setHours(7, 36, 0, 0)).toISOString() },
        { taskId: "task-word-notes", completedAt: new Date(twoDaysAgo.setHours(18, 18, 0, 0)).toISOString() },
      ],
      [getLocalDateKey(yesterday)]: [
        { taskId: "task-morning-reading", completedAt: new Date(yesterday.setHours(7, 28, 0, 0)).toISOString() },
        { taskId: "task-stretching", completedAt: new Date(yesterday.setHours(16, 6, 0, 0)).toISOString() },
      ],
    },
    classmates: [
      { id: "mate-01", name: "顾言", petName: "栗球", completionRate: 92, streak: 11, glow: 88 },
      { id: "mate-02", name: "许诺", petName: "星芽", completionRate: 84, streak: 8, glow: 76 },
      { id: "mate-03", name: "江禾", petName: "橘风", completionRate: 77, streak: 6, glow: 69 },
      { id: "mate-04", name: "季然", petName: "蓝仔", completionRate: 71, streak: 4, glow: 62 },
    ],
    feed: [
      createEntry(
        {
          type: "teacher",
          title: "周老师发布了新主题",
          detail: "这周主线是“晨读与专注力”，坚持 4 天会解锁流光项圈。",
          createdAt: new Date(today.setHours(6, 50, 0, 0)).toISOString(),
        },
        0,
      ),
      createEntry(
        {
          type: "reward",
          title: "糖糖升到了 Lv.3",
          detail: "它的表情更灵动了，摸摸脑袋时还会更明显地回应你。",
          createdAt: new Date(yesterday.setHours(19, 20, 0, 0)).toISOString(),
        },
        1,
      ),
      createEntry(
        {
          type: "checkin",
          title: "连续打卡第 2 天",
          detail: "班级花园里新增了一株薄荷色小旗，代表今日专注完成。",
          createdAt: new Date(yesterday.setHours(19, 10, 0, 0)).toISOString(),
        },
        2,
      ),
    ],
    teacherTheme: "晨读与专注周",
  };
}

export { getLocalDateKey };
