import { Routes, Route } from 'react-router-dom';
import CrearCampana from './components/CrearCampana';
import VistaPrevia from './components/VistaPrevia';

function App() {
  return (
    <Routes>
      <Route path="/" element={<CrearCampana />} />
      <Route path="/preview" element={<VistaPrevia />} />
    </Routes>
  );
}

export default App;
