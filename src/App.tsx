import { Route, Routes } from "react-router";
import { Header } from "./components/Header";
import { ProgressBar } from "./components/ProgressBar";
import { Manifesto } from "./pages/Manifesto";
import { DitherBackground } from "./components/DitherBackground";
import { SongPlayer } from "./components/SongPlayer";

export default function App() {
  return (
    <>
      <DitherBackground />
      <ProgressBar />
      <div className="page">
        <Header />
        <Routes>
          <Route path="/" element={<Manifesto />} />
          {/* future: <Route path="/journal" ... /> and "/journal/:slug" */}
          <Route path="*" element={<Manifesto />} />
        </Routes>
      </div>
      <SongPlayer />
    </>
  );
}
