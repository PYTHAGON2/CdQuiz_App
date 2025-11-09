import React, { useState, useEffect, useCallback } from 'react';
import { HomePage } from './pages/HomePage';
import { QuizPage } from './pages/QuizPage';
import { ResultPage } from './pages/ResultPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { User, Quiz, QuizAttempt } from './types';
import { DarkModeToggle } from './components/DarkModeToggle';
import { getDeviceType } from './utils/helpers';

export type View = 'home' | 'quiz' | 'result' | 'admin';

const AdminLoginModal: React.FC<{onLogin: (password: string) => void; onClose: () => void}> = ({ onLogin, onClose }) => {
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(password);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-sm transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale">
                <style>{`
                    @keyframes fade-in-scale {
                        0% { opacity: 0; transform: scale(0.95); }
                        100% { opacity: 1; transform: scale(1); }
                    }
                    .animate-fade-in-scale { animation: fade-in-scale 0.3s forwards; }
                `}</style>
                <h2 className="text-2xl font-bold mb-4 text-center">Admin Login</h2>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="admin-password" className="sr-only">Password</label>
                    <input
                        id="admin-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full px-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                        autoFocus
                    />
                    <div className="flex gap-4 mt-6">
                         <button type="button" onClick={onClose} className="w-full bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 transition-colors">
                            Login
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [view, setView] = useState<View>('home');
  const [user, setUser] = useState<User | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [lastAttempt, setLastAttempt] = useState<QuizAttempt | null>(null);
  const [lastQuiz, setLastQuiz] = useState<Quiz | null>(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (user: User) => {
    setUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    setView('home');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
    setView('home');
  };

  const handleAdminLogin = (password: string) => {
    if (password === 'FUTURE') {
      const adminUser: User = { name: 'Admin', ip: 'local', device: getDeviceType() };
      setUser(adminUser);
      localStorage.setItem('currentUser', JSON.stringify(adminUser));
      setView('admin');
      setShowAdminLogin(false);
    } else {
      alert('Incorrect admin password.');
    }
  };

  const startQuiz = useCallback((quiz: Quiz) => {
    setActiveQuiz(quiz);
    setView('quiz');
  }, []);

  const finishQuiz = useCallback((attempt: QuizAttempt, quiz: Quiz) => {
    setLastAttempt(attempt);
    setLastQuiz(quiz);
    setView('result');
  }, []);

  const backToHome = useCallback(() => {
    setActiveQuiz(null);
    setLastAttempt(null);
    setLastQuiz(null);
    if(user?.name.toLowerCase() === 'admin') {
      setView('admin');
    } else {
      setView('home');
    }
  }, [user]);

  const renderView = () => {
    switch (view) {
      case 'quiz':
        return activeQuiz && user ? (
          <QuizPage quiz={activeQuiz} user={user} onFinish={finishQuiz} />
        ) : null;
      case 'result':
        return lastAttempt && lastQuiz ? (
          <ResultPage attempt={lastAttempt} quiz={lastQuiz} onRestart={startQuiz} onBackToHome={backToHome} />
        ) : null;
      case 'admin':
        return <AdminDashboard onLogout={handleLogout} />;
      case 'home':
      default:
        return <HomePage onLogin={handleLogin} onStartQuiz={startQuiz} user={user} onLogout={handleLogout}/>;
    }
  };

  return (
    <div className="min-h-screen container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl md:text-4xl font-bold text-primary-600 dark:text-primary-400 cursor-pointer" onClick={backToHome}>
          CDCFIB MOCK ONLINE TEST
        </h1>
        <div className="flex items-center gap-4">
          {!user && (
            <button 
              onClick={() => setShowAdminLogin(true)} 
              className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              Admin Login
            </button>
          )}
          <DarkModeToggle />
        </div>
      </header>
      <main>
        {showAdminLogin && <AdminLoginModal onLogin={handleAdminLogin} onClose={() => setShowAdminLogin(false)} />}
        {renderView()}
      </main>
       <footer className="text-center mt-12 text-gray-500 dark:text-gray-400 text-sm">
        <p>&copy; {new Date().getFullYear()} CDCFIB Mock Test Platform. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default App;