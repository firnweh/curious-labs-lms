import type { Metadata } from "next";
import { BaseView } from "@/components/BaseView";

export const metadata: Metadata = {
  title: "My Base — Curious Labs",
};

export default function BasePage() {
  return <BaseView />;
}
