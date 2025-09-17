import { Link, useLocation } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import './Layout.css';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const location = useLocation();
    const isGameDetail = location.pathname.startsWith('/game/');

    return (
        <div className="app">
            <header className="app-header">
                <nav className="nav">
                    <Link to="/" className="nav-brand">
                        ⚽ 足球导演
                    </Link>
                    <div className="nav-links">
                        {isGameDetail && (
                            <Link to="/" className="nav-link">
                                <ArrowLeft size={16} style={{ marginRight: '0.5rem' }} />
                                返回比赛管理
                            </Link>
                        )}
                        <Link to="/" className="nav-link">
                            <Home size={16} style={{ marginRight: '0.5rem' }} />
                            首页
                        </Link>
                    </div>
                </nav>
            </header>

            <main className="app-main">
                <div className="container">
                    {children}
                </div>
            </main>

            <footer className="app-footer">
                <p>Soccer Director - 智能足球视频制作系统</p>
            </footer>
        </div>
    );
};
