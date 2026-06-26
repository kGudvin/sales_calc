import { CalculationEditor } from "@/components/CalculationEditor";

export default function CalculationPage({ params }: { params: { id: string } }) {
  return <CalculationEditor id={params.id} />;
}
