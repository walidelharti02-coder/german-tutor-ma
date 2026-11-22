"use client";
import { useState } from "react";
import { BookOpenText, Search } from "lucide-react";
import { articleColor, colors } from "@/lib/types";
import { German, Legend } from "./german";
import { Listen } from "./listen";
type Word = {
  id: string;
  word: string;
  moduleId: string;
  article: string;
  plural: string;
  meaning: string;
  example: string;
};
export function Vocab({
  words,
  modules,
}: {
  words: Word[];
  modules: { id: string; title: string }[];
}) {
  const [module, setModule] = useState(""),
    [article, setArticle] = useState(""),
    [query, setQuery] = useState("");
  const filtered = words.filter(
    (w) =>
      (!module || module === w.moduleId) &&
      (!article || article === w.article) &&
      [w.word, w.meaning, w.plural].some((x) =>
        x.toLowerCase().includes(query.trim().toLowerCase()),
      ),
  );
  return (
    <>
      <div className="panel filters">
        <label className="search">
          <Search size={16} />
          <input
            aria-label="قلّب على كلمة"
            placeholder="قلّب على كلمة…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="الوحدة"
          value={module}
          onChange={(e) => setModule(e.target.value)}
        >
          <option value="">جميع الوحدات</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <select
          aria-label="أداة التعريف"
          value={article}
          onChange={(e) => setArticle(e.target.value)}
        >
          <option value="">جميع الأدوات</option>
          {["der", "die", "das"].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </div>
      <div className="listSummary">
        <span>{filtered.length} كلمة</span>
        <Legend />
      </div>
      <div className="vocabGrid">
        {filtered.map((w) => (
          <article className="panel wordCard" key={w.id}>
            <div className="wordHead">
              <bdi dir="ltr" lang="de">
                <strong
                  className={
                    articleColor[w.article as keyof typeof articleColor]
                  }
                >
                  {w.article}
                </strong>{" "}
                {w.word}
              </bdi>
              <Listen text={w.article + " " + w.word} />
            </div>
            <p>{w.meaning}</p>
            <small>
              الجمع{" "}
              <bdi className={colors.p} lang="de">
                die {w.plural}
              </bdi>
            </small>
            <div className="wordExample">
              <German text={w.example} />
              <Listen text={w.example} />
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className="empty">
          <BookOpenText />
          <h2>ما لقيناش هاد الكلمة</h2>
          <button
            className="btn light"
            onClick={() => {
              setQuery("");
              setArticle("");
              setModule("");
            }}
          >
            مسح الفلاتر
          </button>
        </div>
      )}
    </>
  );
}
