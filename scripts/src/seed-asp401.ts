import {
  db,
  examsTable,
  questionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

type RawQuestion = {
  topic: string;
  q: string;
  opts: string[];
  correct: number;
  exp: string;
  ref: string;
  repeats?: string;
};

const rawBank: RawQuestion[] = [
  {
    topic: "Scope & Objectives",
    q: "What is the main objective of African Studies? To _________.",
    opts: [
      "find African solutions to African problems",
      "know African people",
      "know how Africans achieve independence",
      "appreciate African resources",
    ],
    correct: 0,
    exp: "African Studies aims to equip present and future generations with requisite skills for appreciating contemporary problems and finding solutions from an African perspective.",
    ref: "Unit 1 Section 4.1",
    repeats:
      "Appears 3 times in Exams:\n- 2018/2019 Q1\n- 2016/2017 Q1\n- 2014/2015 Q1",
  },
  {
    topic: "Political Systems",
    q: "Which of the following societies are acephalous?",
    opts: ["Konkomba", "Ga", "Ewe", "Asante"],
    correct: 0,
    exp: "Acephalous (stateless) societies lack centralized authority structures. The Konkomba are a classic example.",
    ref: "Unit 2 Section 6.3",
    repeats:
      "Appears 2 times in Exams:\n- 2018/2019 Q2\n- 2017/2018 Q2",
  },
  {
    topic: "African Family & Marriage",
    q: "The practice in Africa where a man marries more than one wife is known as ____________.",
    opts: ["polygamy", "polygyny", "polyandry", "polilocality"],
    correct: 1,
    exp: "Polygyny specifically refers to one man marrying multiple wives. Polygamy is an umbrella term.",
    ref: "Unit 3 Section 4",
    repeats:
      "Appears 4 times in Exams:\n- 2020/2021 Q3 & Q4\n- 2019/2020 Q3\n- 2016/2017 Q2",
  },
  {
    topic: "Cold War & Africa",
    q: "What was responsible for the new wave of enthusiasm for African Studies since the 1990's?",
    opts: [
      "The collapse of capitalism",
      "The Cold War",
      "The Apartheid System",
      "Resurgence of multi-party democracy",
    ],
    correct: 3,
    exp: "The end of the Cold War and the subsequent resurgence of multi-party democracy in the 1990s brought new enthusiasm to the discipline.",
    ref: "Unit 6 Section 3.1-8",
    repeats:
      "Appears 3 times in Exams:\n- 2019/2020 Q4\n- 2017/2018 Q4\n- 2016/2017 Q4",
  },
  {
    topic: "Governance Systems",
    q: "Which of the following is NOT an example of a non-centralized society? (Adapted)",
    opts: ["Nuer", "Yako", "Ibo", "Asante"],
    correct: 3,
    exp: "The Asante operated a highly centralized state system, whereas the Nuer, Yako, and Ibo are often cited as non-centralized (acephalous).",
    ref: "Unit 2 Section 6.6",
    repeats:
      "Appears 2 times in Exams:\n- 2020/2021 Q1\n- 2019/2020 Q2",
  },
  {
    topic: "Beliefs & Rituals",
    q: "Which of the following is the source for a belief in God by Africans?",
    opts: [
      "Ancestral veneration",
      "People's reflection on the universe",
      "The idea of God",
      "The study of the Cosmos",
    ],
    correct: 1,
    exp: "Through observation and reflection on the universe, indigenous Africans conceptualized the existence of a Supreme Being.",
    ref: "Unit 2 Section 4.7",
    repeats:
      "Appears 2 times in Exams:\n- 2016/2017 Q3\n- 2016/2017(Resit) Q3",
  },
  {
    topic: "Cold War & Africa",
    q: "How did the Cold War negatively affect governance in Africa?",
    opts: [
      "It forced African countries to industrialize too quickly.",
      "Superpowers supported dictators and brutal regimes to maintain alliances.",
      "It eliminated the presence of military weapons.",
      "It immediately collapsed the Apartheid system.",
    ],
    correct: 1,
    exp: "During the Cold War, superpowers frequently supported authoritarian dictators in Africa as long as they aligned with their ideological bloc.",
    ref: "Unit 6 Section 3.1-8",
    repeats:
      "Appears 2 times in Exams:\n- 2016/2017 Q4\n- 2016/2017(Resit) Q4",
  },
  {
    topic: "Scope & Objectives",
    q: "Which countries in Africa are known as Lusophone countries?",
    opts: [
      "Countries colonized by Belgium",
      "Former German colonies",
      "Former colonies of Portugal",
      "Countries once colonized by the Dutch",
    ],
    correct: 2,
    exp: "Lusophone countries are those that speak Portuguese, stemming from Portuguese colonization.",
    ref: "Unit 1 Section p.63",
  },
  {
    topic: "Early History",
    q: "Which of the following was discovered by Dr. Louis Leakey around Lake Victoria?",
    opts: ["Primates", "Rusinga", "Fossils", "Proconsul"],
    correct: 3,
    exp: "Dr. Louis Leakey discovered the skull of Proconsul (an early Miocene ape) near Lake Victoria.",
    ref: "Unit 1 Section p.41",
  },
  {
    topic: "African Family",
    q: "Under which rule of residence may a couple live in the man's mother's brother's house?",
    opts: ["Patrilocal", "Duolocal", "Avunculocal", "Neolocal"],
    correct: 2,
    exp: "Avunculocal residence involves the couple settling with or near the maternal uncle of the groom.",
    ref: "Unit 3 Section 4 p.132",
  },
  {
    topic: "Conceptual History",
    q: "What is the main thesis in the Hamitic theory?",
    opts: [
      "Any achievements in Africa are attributable to the Caucasian race",
      "Civilization started from Africa",
      "Africans contributed a lot to the development of writing",
      "All continents were formed out of Africa",
    ],
    correct: 0,
    exp: "The historically racist Hamitic Theory incorrectly asserted that any evidence of complex civilization in Africa was brought by Caucasoid invaders.",
    ref: "Unit 2 Section p.37",
  },
  {
    topic: "African Family",
    q: "Which African society practices Ghost Marriage?",
    opts: ["Asante", "Nuer", "Khoikoi", "Zulu"],
    correct: 1,
    exp: "Among the Nuer, a woman can be married to a deceased man's ghost, with a relative acting as a stand-in to produce heirs for the deceased.",
    ref: "Unit 3 Section 4 p.128",
  },
  {
    topic: "History of the Discipline",
    q: "Who came out with the thesis that Africa was not only the cradle of humanity but also the cradle of civilization?",
    opts: [
      "Basil Davidson",
      "Cheikh Anta Diop",
      "Adu Boahen",
      "Molefi Asante",
    ],
    correct: 1,
    exp: "Senegalese scholar Cheikh Anta Diop championed the assertion that Africa is the cradle of both humanity and civilization.",
    ref: "Unit 1",
  },
  {
    topic: "Sociology & Culture",
    q: "The process of transmitting culture from one generation to the next is known as ____________.",
    opts: ["acculturation", "acclimatization", "enculturation", "socialization"],
    correct: 2,
    exp: "Enculturation is the process where individuals learn the requirements of their surrounding culture and acquire the values necessary.",
    ref: "Unit 2 Section p.81",
  },
  {
    topic: "History of the Discipline",
    q: "In which year was the African Studies Association formed?",
    opts: ["1957", "1958", "1959", "1960"],
    correct: 0,
    exp: "The African Studies Association was established in 1957.",
    ref: "Unit 1 Section p.15",
  },
];

async function main() {
  const TITLE = "ASP 401: African Studies";
  const COURSE = "ASP 401";
  const INSTITUTION = "University of Cape Coast";

  const existing = await db
    .select()
    .from(examsTable)
    .where(eq(examsTable.title, TITLE));
  if (existing.length > 0) {
    console.log(`Exam "${TITLE}" already exists — skipping seed.`);
    return;
  }

  const [exam] = await db
    .insert(examsTable)
    .values({
      title: TITLE,
      courseCode: COURSE,
      institution: INSTITUTION,
      description:
        "Past Questions & Exams Drill for African Studies. Questions marked with a star repeat across multiple final exams.",
    })
    .returning();
  if (!exam) {
    throw new Error("Failed to insert exam");
  }
  console.log(`Created exam ${exam.id} — ${exam.title}`);

  const inserts = rawBank.map((q, idx) => ({
    examId: exam.id,
    topic: q.topic,
    prompt: q.q,
    options: q.opts,
    correctIndex: q.correct,
    explanation: q.exp,
    reference: q.ref,
    repeatNote: q.repeats ?? null,
    position: idx,
  }));

  await db.insert(questionsTable).values(inserts);
  console.log(`Inserted ${inserts.length} questions.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
