import { Dashboard } from "@/components/dashboard";
import { modules, vocabulary } from "@/lib/curriculum";
export default function Home() {
  return (
    <Dashboard
      modules={modules.map(({ id, position, german, title, lessons }) => ({
        id,
        position,
        german,
        title,
        lessons: lessons.map(({ id }) => ({ id })),
      }))}
      words={vocabulary.length}
      date={new Intl.DateTimeFormat("ar-MA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date())}
    />
  );
}
