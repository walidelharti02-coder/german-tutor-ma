import { z } from "zod";
import { modelStateSchema } from "./text-models";
export const modeNames = {
  free: "Freies Gespräch",
  role: "Rollenspiel",
  exam: "Prüfungstraining",
} as const;
export const scenarios = {
  bakery: "المخبزة",
  doctor: "الطبيب",
  housing: "السكن والبلدية",
  interview: "مقابلة التكوين المهني",
} as const;
export const mistakeSchema = z
  .object({
    sentence: z.string().trim().min(1).max(1500),
    correctedSentence: z.string().trim().min(1).max(1500),
    errorType: z.enum([
      "artikel",
      "case",
      "word_order",
      "vocabulary",
      "pronunciation",
      "style",
    ]),
    explanationDarija: z.string().max(1200),
  })
  .strict();
export const replySchema = z
  .object({
    germanReply: z.string().trim().min(1).max(2000),
    darijaNote: z.string().max(1500),
    mistakes: z.array(mistakeSchema).max(2),
  })
  .strict();
export type Reply = z.infer<typeof replySchema>;
export const requestSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  mode: z.enum(["free", "role", "exam"]),
  scenario: z.enum(["bakery", "doctor", "housing", "interview"]),
  turnId: z.string().uuid(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(4000),
      }),
    )
    .max(8)
    .default([]),
  modelState: modelStateSchema.default({}),
});
export type Turn = z.infer<typeof requestSchema>;
const roleTurns = {
  bakery: [
    [
      "Guten Morgen! Was möchten Sie kaufen?",
      "طلب شنو بغيتي باستعمال Ich möchte.",
    ],
    ["Wie viele Brötchen möchten Sie?", "جاوب بالعدد وزيد bitte."],
    ["Möchten Sie noch etwas?", "إلا ما بغيتي والو آخر قول Nein, danke."],
    [
      "Das macht vier Euro. Zahlen Sie bar oder mit Karte?",
      "اختار طريقة الخلاص.",
    ],
  ],
  doctor: [
    ["Guten Tag. Was tut Ihnen weh?", "سمّي الجزء ديال الجسم اللي كيضرّك."],
    ["Seit wann haben Sie diese Beschwerden?", "جرّب تقول Seit gestern."],
    [
      "Haben Sie Ihre Versicherungskarte dabei?",
      "جاوب بجملة قصيرة بحال Hier ist meine Karte.",
    ],
    ["Wann können Sie wiederkommen?", "قترح نهار وساعة."],
  ],
  housing: [
    ["Guten Tag! Möchten Sie sich anmelden?", "قول شنو بغيتي تدير فالبلدية."],
    ["Wie lautet Ihre neue Adresse?", "عطي عنوان خيالي فيه الزنقة ورقم الدار."],
    ["Wie schreibt man Ihren Nachnamen?", "تهجّى نسب خيالي حرف بحرف."],
    ["Können Sie hier unterschreiben?", "جاوب بأدب وطلب توضيح إلا احتجتيه."],
  ],
  interview: [
    ["Willkommen! Stellen Sie sich bitte kurz vor.", "عرّف براسك فشي جوج جمل."],
    [
      "Warum möchten Sie diese Ausbildung machen?",
      "عطي سبب ساهل باستعمال Ich … gern.",
    ],
    ["Was können Sie gut?", "هضر على مهارة باستعمال Ich kann."],
    ["Wann können Sie anfangen?", "عطي نهار تقدر تبدا فيه."],
  ],
};
const correctionRules: [
  RegExp,
  string,
  Reply["mistakes"][number]["errorType"],
  string,
][] = [
  [
    /\bich bin (\d+) jahre?(?=[.!?]?\s*$)/i,
    "Ich bin $1 Jahre alt",
    "vocabulary",
    "باش تعطي العمر ديالك قول Ich bin … Jahre alt.",
  ],
  [
    /\bich heißen\b/i,
    "Ich heiße",
    "vocabulary",
    "مع ich الفعل heißen كيولي heiße. خليه فالموضع الثاني.",
  ],
  [
    /\bich komme (?:von|aus dem) marokko\b/i,
    "Ich komme aus Marokko",
    "case",
    "كنقولو aus Marokko بلا أداة تعريف.",
  ],
  [
    /\b(?:der|die) brot\b/i,
    "das Brot",
    "artikel",
    "Brot محايد، كنقولو das Brot.",
  ],
  [
    /\b(ein|eine) apfel\b/i,
    "einen Apfel",
    "case",
    "من بعد kaufen ولا möchten، Apfel مفعول به مذكر. استعمل einen.",
  ],
  [
    /\bich bin (?:wohnen|wohne)\b/i,
    "Ich wohne",
    "word_order",
    "wohnen كيتصرف بوحدو، قول Ich wohne.",
  ],
  [
    /\bheute ich arbeite\b/i,
    "Heute arbeite ich",
    "word_order",
    "Heute خدات الموضع الأول، من بعدها كيجي الفعل ثم ich.",
  ],
];
export function mockReply(t: Turn): Reply {
  const mistakes: Reply["mistakes"] = [];
  const sentences = t.message.match(/[^.!?]+[.!?]?/g) ?? [t.message];
  for (const sentence of sentences) {
    for (const [rx, replace, errorType, explanationDarija] of correctionRules) {
      if (
        !rx.test(sentence) ||
        (replace === "einen Apfel" && !/kaufe|nehme|möchte/i.test(sentence)) ||
        (replace === "das Brot" && /\b(mit|von|in|zu)\b/i.test(sentence))
      )
        continue;
      mistakes.push({
        sentence: sentence.trim(),
        correctedSentence: sentence
          .trim()
          .replace(rx, replace)
          .replace(/^./, (c) => c.toUpperCase()),
        errorType,
        explanationDarija,
      });
      break;
    }
    if (mistakes.length === 2) break;
  }
  const prior = t.history.filter((h) => h.role === "user").length;
  const last =
    t.history.filter((h) => h.role === "assistant").at(-1)?.text || "";
  function next(turns: string[][]) {
    const previous = turns.findIndex(([de]) => last.includes(de));
    return turns[
      previous >= 0 ? (previous + 1) % turns.length : prior % turns.length
    ];
  }
  let pair: string[];
  if (t.mode === "role") {
    const sequence = roleTurns[t.scenario];
    if (
      !prior &&
      /hallo|guten (tag|morgen)|مرحبا/i.test(t.message) &&
      t.message.trim().split(/\s+/).length < 4
    ) {
      pair = sequence[0];
    } else if (
      !prior &&
      t.scenario === "bakery" &&
      /brot|kuchen|brezel/i.test(t.message)
    ) {
      pair = sequence[2];
    } else {
      pair = prior ? next(sequence) : sequence[1];
    }
  } else if (t.mode === "exam") {
    pair = next([
      [
        "Stellen Sie sich vor. Wo wohnen Sie und welche Sprachen sprechen Sie?",
        "تدريب تقريبي على التعارف. حاول تعطي جوج معلومات.",
      ],
      [
        "Thema Einkaufen. Fragen Sie nach dem Preis eines Brotes.",
        "دابا دورك تسول سؤال واضح على الثمن.",
      ],
      ["Bitten Sie um ein Glas Wasser.", "طلب بأدب باستعمال bitte."],
      [
        "Nennen Sie Ihren Namen und buchstabieren Sie ihn bitte.",
        "قول الاسم ومن بعد تهجّاه بشوية.",
      ],
    ]);
    let feedback = "جرّب تجاوب بجملة ألمانية كاملة باش نفهم الفكرة.";
    if (mistakes.length)
      feedback = "راجع التصحيح ديال هاد الجملة وعاود قولها بصوتك.";
    else if (/wie viel|was kostet|wie teuer/i.test(t.message))
      feedback = "السؤال ديالك على الثمن واضح ومناسب للتسوّق.";
    else if (/bitte|könnten sie|kann ich/i.test(t.message))
      feedback = "استعملتي صيغة مؤدبة. هادي كتعاونك فتمرين الطلب.";
    else if (/ich heiße|mein name ist|ich komme aus/i.test(t.message))
      feedback = "قدّمتي معلومة على راسك. زيد فين ساكن ولا شنو كتهضر.";
    else if (/\bich (?:bin|wohne|spreche|habe|möchte)\b/i.test(t.message))
      feedback = "بديتي الجملة بفاعل وفعل. زيد تفصيل صغير على نفس الموضوع.";
    pair = [pair[0], "ملاحظة تقريبية على النص: " + feedback + " " + pair[1]];
  } else if (/heiße|name ist|اسمي|سميتي/i.test(t.message))
    pair = [
      "Freut mich! Wo wohnen Sie jetzt?",
      "دابا زيد فين ساكن باستعمال Ich wohne in …",
    ];
  else if (/wohne|أسكن|ساكن/i.test(t.message))
    pair = [
      "Schön! Was machen Sie gern in Ihrer Stadt?",
      "هضر على حاجة كتعجبك فالمدينة ديالك.",
    ];
  else if (/aus marokko|von marokko|من المغرب/i.test(t.message))
    pair = [
      "Aus welcher Stadt kommen Sie? Erzählen Sie mir etwas über Ihre Stadt.",
      "زيد اسم المدينة ووصفها بكلمة بحال groß ولا klein.",
    ];
  else if (/spreche|sprachen|العربية/i.test(t.message))
    pair = [
      "Sehr schön! Mit wem sprechen Sie Deutsch?",
      "قول مع من كتمرّن على الألمانية، بحال mit einem Freund.",
    ];
  else if (/apfel|brot|kaufe/i.test(t.message))
    pair = [
      "Gut, wir üben im Laden. Was möchten Sie noch kaufen?",
      "قترح حاجة أخرى بغيتي تشريها.",
    ];
  else
    pair = next([
      [
        "Hallo! Ich bin Walid. Wie heißen Sie?",
        "مرحبا بيك! جاوب بـ Ich heiße وزيد سميتك.",
      ],
      ["Woher kommen Sie?", "قول منين نتا باستعمال Ich komme aus …"],
      [
        "Welche Sprachen sprechen Sie?",
        "قول اللغات اللي كتهضر، حتى إلا غير شوية.",
      ],
      [
        "Was machen Sie gern am Wochenende?",
        "عطيني مثال على شي حاجة كتعجبك فالويكاند.",
      ],
    ]);
  return { germanReply: pair[0], darijaNote: pair[1], mistakes };
}
