"use client";
import { useEffect, useRef, useState } from "react";
import { KeyRound, X } from "lucide-react";
import { readPhoneKey, storePhoneKey } from "@/lib/phone-key";
export function KeySettings({ hasServerKey }: { hasServerKey: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(""),
    [saved, setSaved] = useState(false),
    [notice, setNotice] = useState("");
  function open() {
    setValue("");
    setNotice("");
    setSaved(Boolean(readPhoneKey()));
    dialog.current?.showModal();
  }
  function save(key: string) {
    const scope = storePhoneKey(key);
    dialog.current?.close();
    setNotice(!key.trim() ? "تم مسح المفتاح." : scope === "local" ? "تحفظ المفتاح فهاد المتصفح." : scope === "session" ? "تحفظ المفتاح حتى تسدّ هاد التبويب." : "المفتاح واجد حتى تعاود تحمّل الصفحة.");
  }
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  return (
    <>
      <button className="btn light keyBtn" onClick={open}>
        <KeyRound size={16} />
        مفتاح الذكاء الاصطناعي
      </button>
      {notice && <span className="keyToast" role="status">{notice}</span>}
      <dialog
        ref={dialog}
        className="keyDialog inset-0 z-50 pointer-events-auto"
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
              : hasServerKey ? "مفتاح التطبيق واجد. تقدر تستعمل مفتاحك الخاص هنا." : "دخل مفتاح Gemini ديالك"}
          </label>
          <input
            id="phone-key"
            type="password"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
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
          <div className="heroActions">
            <button
              type="button"
              className="btn primary relative z-10 pointer-events-auto touch-manipulation"
              style={{ minHeight: 48 }}
              onClick={() => save(value)}
              onTouchEnd={(event) => {
                event.preventDefault();
                save(value);
              }}
            >
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
