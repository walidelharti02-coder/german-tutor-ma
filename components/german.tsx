"use client";
import { createContext, useContext, Fragment } from "react";
import { colors, type Grammar } from "@/lib/types";
export type Lexicon = Record<string, string>;
export const LexiconContext = createContext<Lexicon>({});
function annotate(text: string, dict: Lexicon) {
  return text.replace(
    /\b(der|die|das|den|dem|einen|einem|einer)\s+([A-ZÄÖÜ][\p{L}-]*)/giu,
    (match, article: string, noun: string, offset: number) => {
      const word = article.toLowerCase(),
        info = dict[noun.toLowerCase()];
      const before = text.slice(0, offset);
      let key: Grammar | undefined;
      if (
        word === "dem" ||
        word === "einem" ||
        (/\b(mit|bei|aus|von|zu|seit)\s*$/i.test(before) &&
          ["der", "den", "einer"].includes(word))
      )
        key = "d";
      else if (["den", "einen"].includes(word)) key = "a";
      else if (word === "die")
        key =
          info?.includes("p") &&
          (!info.includes("f") ||
            /\b(sind|kosten|liegen|stehen|haben)\b/i.test(text))
            ? "p"
            : info?.includes("f")
              ? "f"
              : undefined;
      else if (word === "das" && info?.includes("n")) key = "n";
      else if (word === "der" && info?.includes("m")) key = "m";
      return key ? "{" + key + ":" + article + "} " + noun : match;
    },
  );
}
export function German({ text }: { text: string }) {
  const dict = useContext(LexiconContext);
  const chunks = text
    .split(/(\{[mfnpda]:[^}]+\})/g)
    .map((piece) => (piece.startsWith("{") ? piece : annotate(piece, dict)))
    .join("")
    .split(/(\{[mfnpda]:[^}]+\})/g);
  return (
    <bdi lang="de" dir="ltr">
      {chunks.map((s, i) => {
        const m = s.match(/^\{([mfnpda]):(.+)\}$/);
        return m ? (
          <strong key={i} className={colors[m[1] as Grammar]}>
            {m[2]}
          </strong>
        ) : (
          <Fragment key={i}>{s}</Fragment>
        );
      })}
    </bdi>
  );
}
export function Legend() {
  return (
    <div className="legend" aria-label="دليل الألوان">
      {Object.entries({
        m: "der",
        f: "die",
        n: "das",
        p: "Plural",
        d: "Dativ",
        a: "Akkusativ",
      }).map(([k, v]) => (
        <span className={colors[k as Grammar]} key={v} lang="de">
          {v}
        </span>
      ))}
    </div>
  );
}
