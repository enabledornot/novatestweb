import { NavLink, Route, Routes } from "react-router-dom";
import { SingleTestView } from "./views/SingleTestView";
import { AuthoringView } from "./views/AuthoringView";
import { BulkView } from "./views/BulkView";

export function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>CodeBench</h1>
        <nav className="tabs">
          <NavLink to="/" end>
            Single test
          </NavLink>
          <NavLink to="/authoring">Instructor authoring</NavLink>
          <NavLink to="/bulk">Bulk evaluator</NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<SingleTestView />} />
          <Route path="/authoring" element={<AuthoringView />} />
          <Route path="/bulk" element={<BulkView />} />
        </Routes>
      </main>
    </div>
  );
}
