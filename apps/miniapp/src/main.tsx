import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  return (
    <main style={{ maxWidth: 720, margin: "24px auto", fontFamily: "sans-serif" }}>
      <h1>DGP Telegram Mini App</h1>
      <p>Mini App bootstrap is ready. Integrate Telegram WebApp SDK in the next phase.</p>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
