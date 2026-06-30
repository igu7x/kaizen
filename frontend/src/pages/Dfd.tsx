import { Layout } from "@/components/layout/Layout";
import { Hammer } from "lucide-react";

export default function Dfd() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center bg-white rounded-2xl border border-gray-200">
        <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
          <Hammer className="h-10 w-10 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">DFD</h2>
        <p className="text-gray-500 max-w-md">
          Em desenvolvimento.
        </p>
      </div>
    </Layout>
  );
}
