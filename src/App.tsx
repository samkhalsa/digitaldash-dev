import { Route, Routes } from "react-router";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ProgressBar } from "./components/ProgressBar";
import { Manifesto } from "./pages/Manifesto";

export default function App() {
  return (
    <>
      <ProgressBar />
      <div className="page">
        <Header />
        <Routes>
          <Route path="/" element={<Manifesto />} />
          {/* future: <Route path="/journal" ... /> and "/journal/:slug" */}
          <Route path="*" element={<Manifesto />} />
        </Routes>
        <Footer />
      </div>
    </>
  );
}
