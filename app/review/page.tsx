import { Reviews } from "@/components/reviews";
export const metadata = { title: "المراجعة اليومية" };
export default async function Page() {
  return (
    <>
      <div className="pageHeading">
        <div>
          <h1>المراجعة اليومية</h1>
          <p>راجع بطاقات اليوم واللي فاتو باش يثبتو فبالك.</p>
        </div>
      </div>
      <Reviews />
    </>
  );
}
