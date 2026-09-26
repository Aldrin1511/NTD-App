import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { StoreProvider, useStore } from "@/store";
import { Toaster } from "@/components/ui/sonner";
import ScrollToTop from "@/components/ScrollToTop";
import Login from "@/pages/Login";
import Patients from "@/pages/Patients";
import PatientNew from "@/pages/PatientNew";
import PatientRecord from "@/pages/PatientRecord";
import ScabiesEncounter from "@/pages/Encounter";
import AntenatalEncounter from "@/pages/AntenatalEncounter";
import WellBabyEncounter from "@/pages/WellBabyEncounter";
import MalnutritionEncounter from "@/pages/MalnutritionEncounter";
import SchoolHealth, { SchoolHealthVisit } from "@/pages/SchoolHealth";
import SuspectScreen from "@/pages/SuspectScreen";
import Admin from "@/pages/Admin";
import Sync from "@/pages/Sync";

const Guard = ({ children }) => {
  const { user } = useStore();
  const loc = useLocation();
  if (!user) return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  return children;
};

/** Remount when switching edit ↔ new encounter so form state does not carry over. */
const EncounterRoute = () => {
  const { id, diseaseId } = useParams();
  const [params] = useSearchParams();
  const enc = params.get("enc") || "new";
  const fresh = params.get("new") || enc;
  return <ScabiesEncounter key={`${id}-${diseaseId}-${fresh}`} />;
};

function Shell() {
  const { user } = useStore();
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/patients" replace /> : <Login />} />
      {/* MIS dashboard hidden for now — redirect to patients */}
      <Route path="/dashboard" element={<Guard><Navigate to="/patients" replace /></Guard>} />
      <Route path="/patients" element={<Guard><Patients /></Guard>} />
      <Route path="/appointments" element={<Guard><Patients /></Guard>} />

      <Route path="/patients/new" element={<Guard><PatientNew /></Guard>} />
      <Route path="/patients/:id/edit" element={<Guard><PatientNew /></Guard>} />
      <Route path="/patients/:id" element={<Guard><PatientRecord /></Guard>} />
      <Route path="/patients/:id/suspect" element={<Guard><SuspectScreen /></Guard>} />
      <Route path="/patients/:id/encounter/:diseaseId" element={<Guard><ScabiesEncounter /></Guard>} />
      <Route path="/patients/:id/antenatal" element={<Guard><AntenatalEncounter /></Guard>} />
      <Route path="/patients/:id/wellbaby" element={<Guard><WellBabyEncounter /></Guard>} />
      <Route path="/patients/:id/malnutrition" element={<Guard><MalnutritionEncounter /></Guard>} />
      <Route path="/school-health" element={<Guard><SchoolHealth /></Guard>} />
      <Route path="/school-health/:visitId" element={<Guard><SchoolHealthVisit /></Guard>} />
      <Route path="/patients/:id/disease/:diseaseId" element={<Guard><PatientRecord /></Guard>} />
      <Route path="/admin" element={<Guard><Admin /></Guard>} />
      <Route path="/sync" element={<Guard><Sync /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Shell />
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </StoreProvider>
  );
}
