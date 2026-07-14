import { useAppStore } from './hooks/useAppStore';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inbox from './components/Inbox';
import Draft from './components/Draft';
import Library from './components/Library';
import Schedule from './components/Schedule';

export default function App() {
  const store = useAppStore();

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      <Sidebar store={store} />
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', position: 'relative' }}>
        {store.activeTab === 'dashboard' && <Dashboard store={store} />}
        {store.activeTab === 'inbox' && <Inbox store={store} />}
        {store.activeTab === 'draft' && <Draft store={store} />}
        {store.activeTab === 'library' && <Library store={store} />}
        {store.activeTab === 'schedule' && <Schedule store={store} />}
      </main>
      {store.toastMessage && <div className="toast">{store.toastMessage}</div>}
    </div>
  );
}
