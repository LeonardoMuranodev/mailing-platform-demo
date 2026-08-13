import { Routes, Route } from 'react-router-dom';
import ListaCampanas from './components/ListaCampanas';
import DetalleCampana from './components/DetalleCampana';
import CrearCampana from './components/CrearCampana';
import VistaPrevia from './components/VistaPrevia';

function App() {
  return (
    <Routes>
      <Route path="/" element={<ListaCampanas />} />
      <Route path="/nueva" element={<CrearCampana />} />
      <Route path="/campanas/:id" element={<DetalleCampana />} />
      <Route path="/preview" element={<VistaPrevia />} />
    </Routes>
  );
}

export default App;
