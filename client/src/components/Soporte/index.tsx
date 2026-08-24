import { useAuthStore } from '../../stores/authStore';
import ReportarForm from './ReportarForm';
import PanelSoporte from './PanelSoporte';

export default function Soporte() {
  const { user } = useAuthStore();

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {user.rol === 'desarrollador' ? <PanelSoporte /> : <ReportarForm />}
    </div>
  );
}
