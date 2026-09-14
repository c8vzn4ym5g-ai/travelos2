import { notFound } from "next/navigation";
import { EditionPreview } from "@/components/edition-preview";
export default function ReviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <EditionPreview />;
}
