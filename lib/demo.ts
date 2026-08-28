export type Pupil = { id: string; name: string; initials: string; colour: string; evidence: number; lastSeen: string; reflection: "Due" | "Reviewed" | "None"; goal: string };

export const pupils: Pupil[] = [
  { id: "mia", name: "Mia Chen", initials: "MC", colour: "#ffb08d", evidence: 8, lastSeen: "Today", reflection: "Due", goal: "Scan before receiving" },
  { id: "leo", name: "Leo Zhang", initials: "LZ", colour: "#f0ce78", evidence: 5, lastSeen: "Today", reflection: "Reviewed", goal: "Make decisions earlier" },
  { id: "ava", name: "Ava Wang", initials: "AW", colour: "#b9d7e8", evidence: 7, lastSeen: "Yesterday", reflection: "Due", goal: "Call for the ball" },
  { id: "ethan", name: "Ethan Li", initials: "EL", colour: "#c7dba8", evidence: 3, lastSeen: "12 Aug", reflection: "None", goal: "Keep my head up" },
  { id: "sophia", name: "Sophia Liu", initials: "SL", colour: "#dcbaea", evidence: 6, lastSeen: "Yesterday", reflection: "Reviewed", goal: "Use space after passing" },
  { id: "noah", name: "Noah Wu", initials: "NW", colour: "#a8d9cf", evidence: 4, lastSeen: "9 Aug", reflection: "None", goal: "Communicate in transition" },
  { id: "olivia", name: "Olivia Xu", initials: "OX", colour: "#ffd3c2", evidence: 6, lastSeen: "Today", reflection: "Due", goal: "Accelerate after a turn" },
  { id: "jack", name: "Jack Huang", initials: "JH", colour: "#bed1ff", evidence: 2, lastSeen: "2 Aug", reflection: "None", goal: "Maintain swim body line" }
];

export const recentEvidence = [
  { title: "3v2 fast break", pupils: "Mia, Leo, Ava + 1", tags: ["Basketball", "Decision Making", "SHOW"], time: "Today · 10:24", image: "court" },
  { title: "Receiving under pressure", pupils: "Sophia Liu", tags: ["Football", "Skill", "GROW"], time: "Yesterday · 14:10", image: "field" }
];
