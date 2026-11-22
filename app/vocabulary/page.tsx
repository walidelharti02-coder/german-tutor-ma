import { Vocab } from "@/components/vocab";
import { modules, vocabulary as words } from "@/lib/curriculum";
export const metadata = { title: "بنك المفردات" };
export default async function Page() {
  return (
    <>
      <div className="pageHeading">
        <div>
          <h1>بنك المفردات</h1>
          <p>تعلّم الكلمة مع الأداة ديالها، وسمع كيفاش كتتنطق.</p>
        </div>
      </div>
      <Vocab
        words={words}
        modules={modules.map(({ id, title }) => ({ id, title }))}
      />
    </>
  );
}
