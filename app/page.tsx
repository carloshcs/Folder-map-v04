import { Suspense } from "react";

import App from "./(interface)/App";

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading interface...</div>}>
      <App />
    </Suspense>
  );
}
