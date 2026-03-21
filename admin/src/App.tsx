import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CatAudioEngine } from "./audio";
import { getLocalDateKey } from "./demo";
import { loadAppState, persistAppState, resetAppState } from "./storage";
import type { AccentTone, AppState, AppView, FeedEntry, Task, TaskCategory } from "./types";

type RewardFlash = {
  taskTitle: string;
  xp: number;
  hearts: number;
  stageUnlocked: string | null;
};

type PetReactionMode = "checkin" | "comfort" | "spark" | "surprised" | "play";

type PetReaction = {
  mode: PetReactionMode;
  id: number;
};

type CatExpression = "idle" | "delighted" | "purr" | "surprised" | "sleepy" | "eating" | "playful";

type CatIdleMotion = "none" | "blink" | "look" | "ear" | "tail";

type TaskDraft = {
  title: string;
  description: string;
  duration: string;
  rewardXp: string;
  rewardHearts: string;
  category: TaskCategory;
  accent: AccentTone;
};

type PetMeta = {
  level: number;
  stage: "egg" | "bloom" | "glide" | "radiant";
  stageLabel: string;
  xpIntoLevel: number;
  xpForNext: number;
};

const navItems: Array<{ key: AppView; label: string; hint: string }> = [
  { key: "student", label: "学生视角", hint: "今天打卡、养宠物、领奖励" },
  { key: "teacher", label: "老师视角", hint: "发任务、看班级状态、调节节奏" },
];

const toneLabels: Record<AccentTone, string> = {
  sunrise: "晨曦",
  lagoon: "湖光",
  peach: "桃雾",
  mint: "薄荷",
  ember: "暖焰",
};

const categoryLabels: Record<TaskCategory, string> = {
  morning: "晨间启动",
  focus: "专注练习",
  reading: "阅读沉浸",
  exercise: "身体唤醒",
  kindness: "善意行动",
};

const particles = Array.from({ length: 12 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 7) % 80)}%`,
  delay: `${(index % 4) * 90}ms`,
  duration: `${1700 + (index % 5) * 140}ms`,
}));

const draftTemplate: TaskDraft = {
  title: "",
  description: "",
  duration: "15",
  rewardXp: "28",
  rewardHearts: "3",
  category: "focus",
  accent: "lagoon",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function formatDateTimeLabel(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatShortDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return `${month} 月 ${day} 日`;
}

function derivePetMeta(xp: number): PetMeta {
  const level = Math.floor(xp / 72) + 1;
  const xpIntoLevel = xp % 72;
  const stage =
    xp < 90 ? "egg" : xp < 220 ? "bloom" : xp < 420 ? "glide" : "radiant";
  const stageLabel =
    stage === "egg" ? "蛋期" : stage === "bloom" ? "幼崽期" : stage === "glide" ? "成长期" : "完全体";

  return {
    level,
    stage,
    stageLabel,
    xpIntoLevel,
    xpForNext: 72,
  };
}

function computeStreak(checkinsByDate: AppState["checkinsByDate"]) {
  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = getLocalDateKey(cursor);
    if (!checkinsByDate[key] || checkinsByDate[key].length === 0) {
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getFeedTone(type: FeedEntry["type"]) {
  return {
    teacher: "feed-item--teacher",
    reward: "feed-item--reward",
    checkin: "feed-item--checkin",
  }[type];
}

function completionLabel(rate: number) {
  if (rate >= 90) {
    return "节奏稳定";
  }
  if (rate >= 75) {
    return "持续向上";
  }
  if (rate >= 60) {
    return "需要一点加速";
  }
  return "建议老师关照";
}

function getIdleBubble() {
  return "摸摸脑袋、肚皮、尾巴，看看糖糖会怎么回应你。";
}

function App() {
  const [activeView, setActiveView] = useState<AppView>("student");
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [rewardFlash, setRewardFlash] = useState<RewardFlash | null>(null);
  const [petReaction, setPetReaction] = useState<PetReaction | null>(null);
  const [catExpression, setCatExpression] = useState<CatExpression>("idle");
  const [catIdleMotion, setCatIdleMotion] = useState<CatIdleMotion>("none");
  const [catBubble, setCatBubble] = useState(getIdleBubble);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    const stored = window.localStorage.getItem("classpet-cat-sound");
    return stored !== "off";
  });
  const [burstSeed, setBurstSeed] = useState(0);
  const [draft, setDraft] = useState<TaskDraft>(draftTemplate);
  const [teacherSearch, setTeacherSearch] = useState("");
  const deferredTeacherSearch = useDeferredValue(teacherSearch);
  const audioRef = useRef<CatAudioEngine | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const expressionTimerRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);

  const todayKey = getLocalDateKey();
  const todayRecords = state.checkinsByDate[todayKey] ?? [];
  const completedTaskIds = new Set(todayRecords.map((item) => item.taskId));
  const todayCompletion = state.tasks.length === 0 ? 0 : Math.round((todayRecords.length / state.tasks.length) * 100);
  const streak = computeStreak(state.checkinsByDate);
  const petMeta = derivePetMeta(state.pet.xp);
  const filteredTeacherTasks = useMemo(() => {
    const keyword = deferredTeacherSearch.trim().toLowerCase();
    if (!keyword) {
      return state.tasks;
    }

    return state.tasks.filter((task) => {
      return (
        task.title.toLowerCase().includes(keyword) ||
        task.description.toLowerCase().includes(keyword) ||
        categoryLabels[task.category].toLowerCase().includes(keyword)
      );
    });
  }, [deferredTeacherSearch, state.tasks]);

  const weeklyBars = useMemo(() => {
    return Array.from({ length: 5 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (4 - index));
      const key = getLocalDateKey(date);
      const count = state.checkinsByDate[key]?.length ?? 0;
      return {
        key,
        count,
        rate: state.tasks.length === 0 ? 0 : Math.round((count / state.tasks.length) * 100),
      };
    });
  }, [state.checkinsByDate, state.tasks.length]);

  const classBoard = useMemo(() => {
    const selfGlow = clamp(Math.round((todayCompletion * 0.55 + state.pet.mood * 0.45)), 48, 100);
    const selfEntry = {
      id: "self",
      name: state.profile.studentName,
      petName: state.pet.name,
      completionRate: todayCompletion,
      streak,
      glow: selfGlow,
    };

    return [selfEntry, ...state.classmates].sort((left, right) => {
      if (right.completionRate !== left.completionRate) {
        return right.completionRate - left.completionRate;
      }

      return right.streak - left.streak;
    });
  }, [state.classmates, state.pet.mood, state.pet.name, state.profile.studentName, streak, todayCompletion]);

  useEffect(() => {
    persistAppState(state);
  }, [state]);

  useEffect(() => {
    audioRef.current = new CatAudioEngine();

    return () => {
      if (bubbleTimerRef.current) {
        window.clearTimeout(bubbleTimerRef.current);
      }
      if (expressionTimerRef.current) {
        window.clearTimeout(expressionTimerRef.current);
      }
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("classpet-cat-sound", soundEnabled ? "on" : "off");
    }
  }, [soundEnabled]);

  useEffect(() => {
    setState((current) => {
      const normalizedFeed = current.feed
        .filter((entry) => !entry.title.includes("切换到"))
        .map((entry) => ({
          ...entry,
          title: entry.title.replaceAll("泡芙", "糖糖"),
          detail: entry.detail.replaceAll("泡芙", "糖糖").replaceAll("星糖", "小鱼干"),
        }));

      if (
        current.pet.name === "糖糖" &&
        current.pet.species === "奶油猫" &&
        current.pet.style === "cute" &&
        normalizedFeed.length === current.feed.length
      ) {
        return current;
      }

      return {
        ...current,
        pet: {
          ...current.pet,
          name: "糖糖",
          species: "奶油猫",
          style: "cute",
        },
        feed: normalizedFeed,
      };
    });
  }, []);

  useEffect(() => {
    if (!rewardFlash) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRewardFlash(null);
    }, 2300);

    return () => window.clearTimeout(timer);
  }, [rewardFlash]);

  useEffect(() => {
    if (!petReaction) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPetReaction(null);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [petReaction]);

  useEffect(() => {
    function scheduleIdle() {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }

      const nextDelay = 1400 + Math.round(Math.random() * 1800);
      idleTimerRef.current = window.setTimeout(() => {
        setCatIdleMotion((current) => {
          if (current !== "none" || catExpression !== "idle") {
            scheduleIdle();
            return current;
          }

          const nextMotion = (["blink", "look", "ear", "tail"] as const)[Math.floor(Math.random() * 4)];
          window.setTimeout(() => {
            setCatIdleMotion("none");
          }, nextMotion === "blink" ? 260 : 620);
          scheduleIdle();
          return nextMotion;
        });
      }, nextDelay);
    }

    scheduleIdle();

    return () => {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }
    };
  }, [catExpression]);

  function scheduleCatPresence(expression: CatExpression, bubble: string, duration = 1500) {
    if (bubbleTimerRef.current) {
      window.clearTimeout(bubbleTimerRef.current);
    }
    if (expressionTimerRef.current) {
      window.clearTimeout(expressionTimerRef.current);
    }

    setCatExpression(expression);
    setCatBubble(bubble);
    setCatIdleMotion("none");

    bubbleTimerRef.current = window.setTimeout(() => {
      setCatBubble(getIdleBubble());
    }, duration);

    expressionTimerRef.current = window.setTimeout(() => {
      setCatExpression("idle");
    }, duration);
  }

  async function withSound(action: (engine: CatAudioEngine) => Promise<void> | void) {
    if (!soundEnabled || !audioRef.current) {
      return;
    }

    try {
      await action(audioRef.current);
    } catch {
      setCatBubble("声音没成功启动，不过我还是会继续回应你。");
    }
  }

  function handleCompleteTask(task: Task) {
    if (completedTaskIds.has(task.id)) {
      return;
    }

    setState((current) => {
      const previousMeta = derivePetMeta(current.pet.xp);
      const nextXp = current.pet.xp + task.rewardXp;
      const nextMeta = derivePetMeta(nextXp);
      const nextRecords = [
        ...(current.checkinsByDate[todayKey] ?? []),
        { taskId: task.id, completedAt: new Date().toISOString() },
      ];
      const nextFeed: FeedEntry[] = [
        {
          id: createId("feed"),
          type: "checkin",
          title: `完成任务：${task.title}`,
          detail: `${current.pet.name}吸收了 ${task.rewardXp} 点成长值，眼睛也亮了一点。`,
          createdAt: new Date().toISOString(),
        },
        ...current.feed,
      ];

      if (previousMeta.stage !== nextMeta.stage) {
        nextFeed.unshift({
          id: createId("feed"),
          type: "reward",
          title: `${current.pet.name}进入${nextMeta.stageLabel}`,
          detail: "新的形态已经解锁，舞台上的光晕与动作会更鲜明。",
          createdAt: new Date().toISOString(),
        });
      }

      setRewardFlash({
        taskTitle: task.title,
        xp: task.rewardXp,
        hearts: task.rewardHearts,
        stageUnlocked: previousMeta.stage !== nextMeta.stage ? nextMeta.stageLabel : null,
      });
      const reactionId = Date.now();
      setBurstSeed(reactionId);
      setPetReaction({ mode: "checkin", id: reactionId });
      scheduleCatPresence("delighted", `任务完成啦，${task.title} 真厉害。再奖励我一条小鱼干？`, 2100);
      void withSound(async (engine) => {
        await engine.playChime();
        await engine.playMeow("happy");
      });

      return {
        ...current,
        pet: {
          ...current.pet,
          xp: nextXp,
          mood: clamp(current.pet.mood + 6, 0, 100),
          energy: clamp(current.pet.energy + 4, 0, 100),
          hearts: current.pet.hearts + task.rewardHearts,
          lastInteractionAt: new Date().toISOString(),
        },
        checkinsByDate: {
          ...current.checkinsByDate,
          [todayKey]: nextRecords,
        },
        feed: nextFeed.slice(0, 9),
      };
    });
  }

  function triggerReaction(mode: PetReactionMode) {
    const reactionId = Date.now() + Math.floor(Math.random() * 50);
    setBurstSeed(reactionId);
    setPetReaction({ mode, id: reactionId });
  }

  function updatePetStats(options: {
    mood: number;
    energy: number;
    hearts: number;
    title: string;
    detail: string;
  }) {
    setState((current) => ({
      ...current,
      pet: {
        ...current.pet,
        mood: clamp(current.pet.mood + options.mood, 0, 100),
        energy: clamp(current.pet.energy + options.energy, 0, 100),
        hearts: current.pet.hearts + options.hearts,
        lastInteractionAt: new Date().toISOString(),
      },
      feed: [
        {
          id: createId("feed"),
          type: "reward",
          title: options.title,
          detail: options.detail,
          createdAt: new Date().toISOString(),
        } satisfies FeedEntry,
        ...current.feed,
      ].slice(0, 9),
    }));
  }

  function handleCatTouch(zone: "head" | "cheek" | "belly" | "tail" | "paw") {
    if (zone === "head") {
      updatePetStats({
        mood: 4,
        energy: 1,
        hearts: 1,
        title: "你摸了摸糖糖的小脑袋",
        detail: "它眯起眼睛蹭了蹭你的手，耳尖也跟着抖了一下。",
      });
      triggerReaction("comfort");
      scheduleCatPresence("delighted", "呼噜呼噜，脑袋这里最喜欢你摸了。");
      void withSound((engine) => engine.playMeow("soft"));
      return;
    }

    if (zone === "cheek") {
      updatePetStats({
        mood: 5,
        energy: 1,
        hearts: 1,
        title: "你轻轻揉了糖糖的脸颊",
        detail: "它发出了低低的呼噜声，胡须也一起晃了起来。",
      });
      triggerReaction("comfort");
      scheduleCatPresence("purr", "喵呜...脸颊也可以再揉一下。", 1700);
      void withSound((engine) => engine.playPurr(0.8));
      return;
    }

    if (zone === "belly") {
      updatePetStats({
        mood: 6,
        energy: 2,
        hearts: 2,
        title: "糖糖翻出圆肚皮让你摸",
        detail: "小爪子缩起来了，整只猫都软成了一团。",
      });
      triggerReaction("spark");
      scheduleCatPresence("purr", "今天心情很好，肚皮也给你摸。", 1800);
      void withSound(async (engine) => {
        await engine.playPurr(1);
        await engine.playMeow("soft");
      });
      return;
    }

    if (zone === "tail") {
      updatePetStats({
        mood: 0,
        energy: 0,
        hearts: 0,
        title: "你碰到了糖糖的尾巴",
        detail: "它一下子回头看你，尾巴快速甩了两下，像是在提醒你轻一点。",
      });
      triggerReaction("surprised");
      scheduleCatPresence("surprised", "尾巴这里要轻一点喵，我会先警觉一下。", 1500);
      void withSound(async (engine) => {
        await engine.playSwipe();
        await engine.playMeow("surprised");
      });
      return;
    }

    updatePetStats({
      mood: 3,
      energy: 1,
      hearts: 1,
      title: "糖糖跟你击了个掌",
      detail: "小爪子啪地搭上来，随后又开心地缩了回去。",
    });
    triggerReaction("spark");
    scheduleCatPresence("delighted", "喵！再来一下，我还想玩。", 1400);
    void withSound(async (engine) => {
      await engine.playSwipe();
      await engine.playMeow("happy");
    });
  }

  function handleCatButton(mode: "pet" | "feed" | "rest" | "play") {
    if (mode === "pet") {
      handleCatTouch("head");
      return;
    }

    if (mode === "feed") {
      updatePetStats({
        mood: 7,
        energy: 4,
        hearts: 2,
        title: "你喂了糖糖一条小鱼干",
        detail: "它咔嚓咔嚓地吃完了，眼睛亮得像玻璃珠一样。",
      });
      triggerReaction("spark");
      scheduleCatPresence("eating", "小鱼干好香，再来一条我就更乖。", 1700);
      void withSound(async (engine) => {
        await engine.playMunch();
        await engine.playMeow("happy");
      });
      return;
    }

    if (mode === "play") {
      updatePetStats({
        mood: 6,
        energy: 3,
        hearts: 2,
        title: "你晃了晃逗猫球",
        detail: "糖糖前爪跟着扑了两下，尾巴也立刻精神起来。",
      });
      triggerReaction("play");
      scheduleCatPresence("playful", "再晃一下，我还想扑一次。", 1600);
      void withSound(async (engine) => {
        await engine.playSwipe();
        await engine.playMeow("happy");
      });
      return;
    }

    updatePetStats({
      mood: 2,
      energy: -4,
      hearts: 1,
      title: "糖糖蜷起来打了个盹",
      detail: "尾巴慢慢绕到身前，呼吸也变得更平稳了。",
    });
    triggerReaction("comfort");
    scheduleCatPresence("sleepy", "先让我眯一会儿，醒来再陪你玩。", 1800);
    void withSound(async (engine) => {
      await engine.playPurr(0.55);
    });
  }

  function handleDraftChange<Key extends keyof TaskDraft>(key: Key, value: TaskDraft[Key]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleCreateTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.title.trim() || !draft.description.trim()) {
      return;
    }

    const nextTask: Task = {
      id: createId("task"),
      title: draft.title.trim(),
      description: draft.description.trim(),
      category: draft.category,
      duration: Number(draft.duration) || 15,
      rewardXp: Number(draft.rewardXp) || 30,
      rewardHearts: Number(draft.rewardHearts) || 3,
      accent: draft.accent,
    };

    setState((current) => ({
      ...current,
      tasks: [nextTask, ...current.tasks],
      feed: [
        {
          id: createId("feed"),
          type: "teacher",
          title: `周老师新增任务：${nextTask.title}`,
          detail: nextTask.description,
          createdAt: new Date().toISOString(),
        } satisfies FeedEntry,
        ...current.feed,
      ].slice(0, 9),
    }));
    setDraft(draftTemplate);
  }

  function handleReset() {
    startTransition(() => {
      setState(resetAppState());
      setRewardFlash(null);
      setPetReaction(null);
      setCatExpression("idle");
      setCatIdleMotion("none");
      setCatBubble(getIdleBubble());
      setDraft(draftTemplate);
      setTeacherSearch("");
    });
  }

  const classAverage = Math.round(
    classBoard.reduce((total, item) => total + item.completionRate, 0) / Math.max(classBoard.length, 1),
  );

  return (
    <div className="app-shell">
      <div className="ambient ambient--left" />
      <div className="ambient ambient--right" />

      <header className="topbar">
        <div>
          <p className="eyebrow">Class Pet Garden</p>
          <h1>班级打卡养宠物</h1>
          <p className="topbar__subtitle">纯前端原型，所有进度与状态均保存在当前浏览器中。</p>
        </div>

        <div className="topbar__actions">
          <div className="segmented">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={item.key === activeView ? "segmented__item segmented__item--active" : "segmented__item"}
                onClick={() => startTransition(() => setActiveView(item.key))}
                type="button"
              >
                <span>{item.label}</span>
                <small>{item.hint}</small>
              </button>
            ))}
          </div>
          <button className="ghost-button" onClick={handleReset} type="button">
            重置演示数据
          </button>
        </div>
      </header>

      {activeView === "student" ? (
        <main className="layout-grid layout-grid--student">
          <section className="hero-card hero-card--showcase">
            <div className="hero-card__copy hero-card__copy--center">
              <p className="eyebrow">今日主线</p>
              <h2>{state.pet.name} 是今天的主角</h2>
              <p>
                {state.teacherTheme} · {state.profile.schoolName} · {state.profile.className} · {state.profile.teacherName}
              </p>
              <div className="hero-metrics">
                <article>
                  <span>今日完成</span>
                  <strong>{todayCompletion}%</strong>
                </article>
                <article>
                  <span>连续打卡</span>
                  <strong>{streak} 天</strong>
                </article>
                <article>
                  <span>成长等级</span>
                  <strong>Lv.{petMeta.level}</strong>
                </article>
              </div>
            </div>

            <div className="stage-card stage-card--showcase">
              <div
                className={`pet-stage pet-stage--${petMeta.stage} ${
                  petReaction ? `pet-stage--react-${petReaction.mode}` : ""
                } pet-stage--cat`}
              >
                <div className="cat-stage__speech">
                  <p>{catBubble}</p>
                </div>
                <div className="pet-stage__centerpiece">
                  <div className="pet-stage__halo" />
                  <div className="pet-stage__ground" />
                  <div className="pet-stage__floaties" aria-hidden="true">
                    <span className="pet-stage__floaty pet-stage__floaty--one" />
                    <span className="pet-stage__floaty pet-stage__floaty--two" />
                    <span className="pet-stage__floaty pet-stage__floaty--three" />
                    <span className="pet-stage__floaty pet-stage__floaty--four" />
                  </div>
                  {petReaction ? (
                    <div className="pet-stage__burst" key={burstSeed}>
                      {particles.map((particle) => (
                        <span
                          key={`${burstSeed}-${particle.id}`}
                          className={`pet-stage__particle pet-stage__particle--${petReaction.mode}`}
                          style={{
                            left: particle.left,
                            animationDelay: particle.delay,
                            animationDuration: particle.duration,
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                  {petReaction ? (
                    <div className={`pet-stage__reaction pet-stage__reaction--${petReaction.mode}`} key={petReaction.id}>
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}
                  <div
                    className={`pet-avatar pet-avatar--${petMeta.stage} ${
                    petReaction ? `pet-avatar--react-${petReaction.mode}` : ""
                    } pet-avatar--cat cat-avatar cat-avatar--${catExpression} cat-avatar--idle-${catIdleMotion}`}
                  >
                    <span className="pet-shadow" />
                    <button
                      aria-label="摸摸脑袋"
                      className="cat-hotspot cat-hotspot--head"
                      onClick={() => handleCatTouch("head")}
                      type="button"
                    />
                    <button
                      aria-label="揉揉脸颊"
                      className="cat-hotspot cat-hotspot--cheek"
                      onClick={() => handleCatTouch("cheek")}
                      type="button"
                    />
                    <button
                      aria-label="摸摸肚皮"
                      className="cat-hotspot cat-hotspot--belly"
                      onClick={() => handleCatTouch("belly")}
                      type="button"
                    />
                    <button
                      aria-label="碰一下尾巴"
                      className="cat-hotspot cat-hotspot--tail"
                      onClick={() => handleCatTouch("tail")}
                      type="button"
                    />
                    <button
                      aria-label="和猫咪击掌"
                      className="cat-hotspot cat-hotspot--paw"
                      onClick={() => handleCatTouch("paw")}
                      type="button"
                    />
                    <span className="pet-tail cat-tail" />
                    <span className="pet-ear pet-ear--left cat-ear" />
                    <span className="pet-ear pet-ear--right cat-ear" />
                    <span className="pet-body">
                      <span className="pet-body__shine" />
                      <span className="pet-body__tuft cat-tuft" />
                      <span className="pet-body__belly" />
                      <span className="pet-body__paw pet-body__paw--left" />
                      <span className="pet-body__paw pet-body__paw--right" />
                      <span className="cat-stripe cat-stripe--one" />
                      <span className="cat-stripe cat-stripe--two" />
                      <span className="cat-stripe cat-stripe--three" />
                      <span className="pet-face pet-face__eye pet-face__eye--left">
                        <span className="pet-face__spark" />
                        <span className="pet-face__pupil" />
                      </span>
                      <span className="pet-face pet-face__eye pet-face__eye--right">
                        <span className="pet-face__spark" />
                        <span className="pet-face__pupil" />
                      </span>
                      <span className="pet-face pet-face__nose" />
                      <span className="pet-face pet-face__mouth" />
                      <span className="cat-whisker cat-whisker--left cat-whisker--top" />
                      <span className="cat-whisker cat-whisker--left cat-whisker--bottom" />
                      <span className="cat-whisker cat-whisker--right cat-whisker--top" />
                      <span className="cat-whisker cat-whisker--right cat-whisker--bottom" />
                      <span className="pet-face pet-face__blush pet-face__blush--left" />
                      <span className="pet-face pet-face__blush pet-face__blush--right" />
                    </span>
                  </div>
                </div>
              </div>

              <div className="pet-panel pet-panel--showcase">
                <div>
                  <p className="eyebrow">你的伙伴</p>
                  <h3>
                    {state.pet.name} <small>{state.pet.species}</small>
                  </h3>
                  <div className="pet-style-summary pet-style-summary--cat">
                    <span>互动奶油猫</span>
                    <small>像电子宠物那样，摸它、喂它、逗它，它会立刻给你反应。</small>
                  </div>
                </div>
                <div className="pet-level">
                  <div
                    className="pet-level__ring"
                    style={{
                      background: `conic-gradient(#ff9966 ${(petMeta.xpIntoLevel / petMeta.xpForNext) * 360}deg, rgba(255,255,255,0.2) 0deg)`,
                    }}
                  >
                    <div className="pet-level__center">
                      <strong>Lv.{petMeta.level}</strong>
                      <span>{petMeta.stageLabel}</span>
                    </div>
                  </div>
                  <div className="pet-level__stats">
                    <label>
                      心情
                      <progress max={100} value={state.pet.mood} />
                      <span>{state.pet.mood}%</span>
                    </label>
                    <label>
                      精力
                      <progress max={100} value={state.pet.energy} />
                      <span>{state.pet.energy}%</span>
                    </label>
                  </div>
                </div>
                <div className="pet-panel__actions">
                  <button className="action-button" onClick={() => handleCatButton("pet")} type="button">
                    摸摸脑袋
                  </button>
                  <button className="action-button action-button--accent" onClick={() => handleCatButton("feed")} type="button">
                    喂小鱼干
                  </button>
                </div>
                <div className="style-selector style-selector--cat">
                  <p className="eyebrow">互动控制</p>
                  <div className="cat-control-grid">
                    <button className="style-chip style-chip--cat" onClick={() => handleCatButton("rest")} type="button">
                      <strong>让它打盹</strong>
                      <span>猫咪会变困，呼噜声更低。</span>
                    </button>
                    <button className="style-chip style-chip--cat" onClick={() => handleCatButton("play")} type="button">
                      <strong>晃逗猫球</strong>
                      <span>会触发更明显的前扑和尾巴反应。</span>
                    </button>
                    <button
                      className={`style-chip style-chip--cat ${soundEnabled ? "style-chip--active" : ""}`}
                      onClick={() => setSoundEnabled((current) => !current)}
                      type="button"
                    >
                      <strong>{soundEnabled ? "声音已开启" : "声音已静音"}</strong>
                      <span>{soundEnabled ? "触碰、投喂和玩耍都会发声。" : "再次点击恢复所有猫咪声音。"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {rewardFlash ? (
              <aside className="reward-toast">
                <p>完成「{rewardFlash.taskTitle}」</p>
                <strong>+{rewardFlash.xp} 成长值</strong>
                <span>+{rewardFlash.hearts} 爱心值</span>
                {rewardFlash.stageUnlocked ? <em>已解锁 {rewardFlash.stageUnlocked}</em> : null}
              </aside>
            ) : null}
          </section>

          <section className="task-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">今日任务</p>
                <h2>一步步打卡，动作要轻，反馈要快</h2>
              </div>
              <span className="panel-chip">{formatShortDate(todayKey)}</span>
            </div>

            <div className="task-list">
              {state.tasks.map((task) => {
                const completed = completedTaskIds.has(task.id);

                return (
                  <article key={task.id} className={`task-card task-card--${task.accent} ${completed ? "task-card--done" : ""}`}>
                    <div className="task-card__header">
                      <div>
                        <span className="task-card__category">{categoryLabels[task.category]}</span>
                        <h3>{task.title}</h3>
                      </div>
                      <span className="task-card__duration">{task.duration} min</span>
                    </div>
                    <p>{task.description}</p>
                    <div className="task-card__footer">
                      <div className="task-card__reward">
                        <span>+{task.rewardXp} 成长值</span>
                        <span>+{task.rewardHearts} 爱心</span>
                      </div>
                      <button
                        className={completed ? "task-card__button task-card__button--done" : "task-card__button"}
                        onClick={() => handleCompleteTask(task)}
                        type="button"
                      >
                        {completed ? "已完成" : "立即打卡"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="stats-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">连续反馈</p>
                <h2>让每天都有明确进度感</h2>
              </div>
            </div>
            <div className="weekly-bars">
              {weeklyBars.map((item) => (
                <article key={item.key} className="weekly-bar">
                  <div className="weekly-bar__track">
                    <span style={{ height: `${Math.max(item.rate, 10)}%` }} />
                  </div>
                  <strong>{item.count}</strong>
                  <small>{formatShortDate(item.key)}</small>
                </article>
              ))}
            </div>

            <div className="feed-list">
              {state.feed.map((entry) => (
                <article key={entry.id} className={`feed-item ${getFeedTone(entry.type)}`}>
                  <div className="feed-item__dot" />
                  <div>
                    <h3>{entry.title}</h3>
                    <p>{entry.detail}</p>
                    <small>{formatDateTimeLabel(entry.createdAt)}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="leader-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">班级状态</p>
                <h2>排行榜不是施压，而是让节奏可见</h2>
              </div>
              <span className="panel-chip">班级均值 {classAverage}%</span>
            </div>

            <div className="leaderboard">
              {classBoard.map((item, index) => (
                <article key={item.id} className={`leaderboard-item ${item.id === "self" ? "leaderboard-item--self" : ""}`}>
                  <div className="leaderboard-item__rank">{index + 1}</div>
                  <div className="leaderboard-item__identity">
                    <strong>{item.name}</strong>
                    <span>{item.petName}</span>
                  </div>
                  <div className="leaderboard-item__meter">
                    <div>
                      <span style={{ width: `${Math.max(item.completionRate, 8)}%` }} />
                    </div>
                    <small>{completionLabel(item.completionRate)}</small>
                  </div>
                  <div className="leaderboard-item__meta">
                    <strong>{item.completionRate}%</strong>
                    <span>{item.streak} 天</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      ) : (
        <main className="teacher-layout">
          <section className="teacher-overview">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">班级概览</p>
                <h2>今天的班级氛围应该一眼看懂</h2>
              </div>
              <span className="panel-chip">当前主题：{state.teacherTheme}</span>
            </div>

            <div className="teacher-overview__grid">
              <article className="teacher-metric">
                <span>任务数</span>
                <strong>{state.tasks.length}</strong>
                <small>当前浏览器配置</small>
              </article>
              <article className="teacher-metric">
                <span>班级均值</span>
                <strong>{classAverage}%</strong>
                <small>含当前学生模拟数据</small>
              </article>
              <article className="teacher-metric">
                <span>高光学生</span>
                <strong>{classBoard[0]?.name ?? state.profile.studentName}</strong>
                <small>完成率与连续天数综合靠前</small>
              </article>
              <article className="teacher-metric">
                <span>宠物热度</span>
                <strong>{state.pet.hearts}</strong>
                <small>累计互动与打卡奖励</small>
              </article>
            </div>
          </section>

          <section className="teacher-main">
            <div className="teacher-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">创建任务</p>
                  <h2>先把老师操作成本压下来</h2>
                </div>
              </div>
              <form className="task-form" onSubmit={handleCreateTask}>
                <label>
                  任务标题
                  <input
                    onChange={(event) => handleDraftChange("title", event.target.value)}
                    placeholder="例如：晚饭后复盘 10 分钟"
                    value={draft.title}
                  />
                </label>
                <label>
                  任务说明
                  <textarea
                    onChange={(event) => handleDraftChange("description", event.target.value)}
                    placeholder="用一句话说清楚做什么、为什么做。"
                    rows={4}
                    value={draft.description}
                  />
                </label>
                <div className="task-form__row">
                  <label>
                    类别
                    <select
                      onChange={(event) => handleDraftChange("category", event.target.value as TaskCategory)}
                      value={draft.category}
                    >
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    气质
                    <select
                      onChange={(event) => handleDraftChange("accent", event.target.value as AccentTone)}
                      value={draft.accent}
                    >
                      {Object.entries(toneLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="task-form__row">
                  <label>
                    时长
                    <input
                      min="5"
                      onChange={(event) => handleDraftChange("duration", event.target.value)}
                      type="number"
                      value={draft.duration}
                    />
                  </label>
                  <label>
                    成长值
                    <input
                      min="10"
                      onChange={(event) => handleDraftChange("rewardXp", event.target.value)}
                      type="number"
                      value={draft.rewardXp}
                    />
                  </label>
                  <label>
                    爱心值
                    <input
                      min="1"
                      onChange={(event) => handleDraftChange("rewardHearts", event.target.value)}
                      type="number"
                      value={draft.rewardHearts}
                    />
                  </label>
                </div>
                <button className="primary-button" type="submit">
                  发布到学生端
                </button>
              </form>
            </div>

            <div className="teacher-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">任务列表</p>
                  <h2>老师必须能快速扫一眼全局</h2>
                </div>
                <input
                  className="teacher-search"
                  onChange={(event) => setTeacherSearch(event.target.value)}
                  placeholder="搜索任务或类别"
                  value={teacherSearch}
                />
              </div>

              <div className="teacher-task-list">
                {filteredTeacherTasks.map((task) => (
                  <article key={task.id} className={`teacher-task-card teacher-task-card--${task.accent}`}>
                    <div>
                      <span>{categoryLabels[task.category]}</span>
                      <h3>{task.title}</h3>
                      <p>{task.description}</p>
                    </div>
                    <div className="teacher-task-card__meta">
                      <strong>{task.duration} min</strong>
                      <small>
                        +{task.rewardXp} 成长值 / +{task.rewardHearts} 爱心
                      </small>
                    </div>
                  </article>
                ))}
                {filteredTeacherTasks.length === 0 ? (
                  <div className="empty-state">当前没有符合关键词的任务。</div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="teacher-class">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">班级成员</p>
                <h2>把重点关注对象自然地暴露出来</h2>
              </div>
            </div>

            <div className="teacher-class__grid">
              {classBoard.map((item) => (
                <article key={item.id} className={`student-pulse ${item.id === "self" ? "student-pulse--self" : ""}`}>
                  <div className="student-pulse__header">
                    <strong>{item.name}</strong>
                    <span>{item.petName}</span>
                  </div>
                  <div className="student-pulse__meter">
                    <span style={{ width: `${Math.max(item.glow, 18)}%` }} />
                  </div>
                  <div className="student-pulse__meta">
                    <label>完成率 {item.completionRate}%</label>
                    <label>连续 {item.streak} 天</label>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

export default App;
