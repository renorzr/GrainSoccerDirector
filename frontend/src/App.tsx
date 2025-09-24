import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GameList } from './components/GameList';
import { GameDetail } from './components/GameDetail';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

function App() {
    return (
        <ErrorBoundary>
            <Router>
                <Layout>
                    <Routes>
                        <Route path="/" element={<GameList />} />
                        <Route path="/g/:gameId" element={<GameDetail />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Layout>
            </Router>
        </ErrorBoundary>
    );
}

export default App;
