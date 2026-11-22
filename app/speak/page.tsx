import { SpeakModes } from "@/components/speak-modes";
export const metadata = { title: "غرفة المحادثة" };
export default function Page() {
  return (
    <>
      <div className="pageHeading">
        <div>
          <h1>غرفة المحادثة</h1>
          <p>تمرّن مع الأستاذ وليد بالصوت ولا بالكتابة.</p>
        </div>
      </div>
      <SpeakModes />
    </>
  );
}
