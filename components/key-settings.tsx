"use client";
import { useRef, useState } from "react";
import { KeyRound, X } from "lucide-react";
import { readPhoneKey, storePhoneKey } from "@/lib/phone-key";
export function KeySettings() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(""),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  function open() {
    setValue("");
    setError("");
    setSaved(Boolean(readPhoneKey()));
    dialog.current?.showModal();
  }
  function save(key: string) {
    try {
      storePhoneKey(key);
      dialog.current?.close();
    } catch {
      setError("تأكد من المفتاح ومن صلاحية التخزين فالمتصفح.");
    }
  }
  return (
    <>
      <button className="btn light keyBtn" onClick={open}>
        <KeyRound size={16} />
        مفتاح الذكاء الاصطناعي
      </button>
      <dialog
        ref={dialog}
        className="keyDialog"
        aria-labelledby="key-title"
        onClose={() => setValue("")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(value);
          }}
        >
          <div className="dialogTitle">
            <h2 id="key-title">مفتاح الذكاء الاصطناعي</h2>
            <button
              type="button"
              aria-label="إغلاق"
              onClick={() => dialog.current?.close()}
            >
              <X size={20} />
            </button>
          </div>
          <p>
            المفتاح كيتحفظ فهاد المتصفح. فالمحادثة النصية كيدوز من سيرفر التطبيق
            لـ Google، وفالمكالمة كيتّصل هاتفك بـ Google مباشرة.
          </p>
          <label htmlFor="phone-key">
            {saved
              ? "كاين مفتاح محفوظ. تقدر تبدّلو هنا."
              : "دخل مفتاح Gemini ديالك"}
          </label>
          <input
            id="phone-key"
            type="password"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            maxLength={256}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <a
            className="inlineLink"
            href="https://aistudio.google.com/api-keys"
            target="_blank"
            rel="noreferrer"
          >
            جيب مفتاح من Google AI Studio
          </a>
          <p>باش تبقى فالاستعمال المجاني، استعمل مشروع بلا فوترة مفعّلة.</p>
          {error && <p role="alert">{error}</p>}
          <div className="heroActions">
            <button className="btn primary" disabled={!value.trim()}>
              حفظ المفتاح
            </button>
            {saved && (
              <button
                type="button"
                className="btn light"
                onClick={() => save("")}
              >
                مسح المفتاح
              </button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
