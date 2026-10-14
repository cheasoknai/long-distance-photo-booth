import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// No StrictMode on purpose: its dev-only double mount would ask for the camera twice.
createRoot(document.getElementById('root')).render(<App />);
