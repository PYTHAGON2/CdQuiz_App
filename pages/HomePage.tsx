import React, { useState, useEffect, useCallback } from 'react';
import { Quiz, User } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { getDeviceType } from '../utils/helpers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

interface HomePageProps {
  user: User | null;
  onLogin: (user: User) => void;
  onStartQuiz: (quiz: Quiz) => void;
  onLogout: () => void;
}

const DifficultyBadge: React.FC<{ difficulty: string }> = ({ difficulty }) => {
  const colorClasses = {
    Easy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    Medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    Hard: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  };
  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${colorClasses[difficulty] || 'bg-gray-100 text-gray-800'}`}
    >
      {difficulty}
    </span>
  );
};

export const HomePage: React.FC<HomePageProps> = ({ user, onLogin, onStartQuiz, onLogout }) => {
  const [name, setName] = useState('');
  const [ip, setIp] = useState<string | null>(null);
  const [isIpIdentified, setIsIpIdentified] = useState(false);
  const [quizzes, setQuizzes] = useLocalStorage<Quiz[]>('quizzes', []);
  const [ipUserMap, setIpUserMap] = useLocalStorage<{ [key: string]: string }>('ip-user-map', {});
  const [loading, setLoading] = useState(false);

  const fetchIp = useCallback(async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      setIp(data.ip);
    } catch (error) {
      console.error('Failed to fetch IP address:', error);
      setIp('unknown');
    }
  }, []);


// --- Function to log visit to Supabase ---
const logVisit = useCallback(async (currentIp: string | null, currentUser: User | null) => {
  if (!currentIp) return; // Don't log without an IP

  const visitData = {
    ipAddress: currentIp,
    device: getDeviceType(),
    isLoggedIn: !!currentUser,
    userName: currentUser ? currentUser.name : null,
    // isBot is defaulted to FALSE in the DB, can be updated later
  };
  const { error } = await supabase
      .from('visits') // The new table
      .insert([visitData]);

    if (error) {
      console.error('Failed to log visit to Supabase:', error);
    }
  }, []);
  // --- END---

  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('quizzes').select('*').order('createdAt', { ascending: false });
      if (error) throw error;
      if (data) setQuizzes(data);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) fetchIp();
  }, [fetchIp, user]);

  // --- MODIFIED useEffect: Call logVisit after IP is fetched ---
  useEffect(() => {
    if (ip) {
      logVisit(ip, user); // Log the visit as soon as the IP is available
      if (ipUserMap[ip]) {
        setName(ipUserMap[ip]);
        setIsIpIdentified(true);
      }
    }
  }, [ip, ipUserMap, logVisit, user]); // Added logVisit and user to dependencies

  useEffect(() => {
    if (user) fetchQuizzes();
  }, [user, fetchQuizzes]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && ip) {
      if (!isIpIdentified) setIpUserMap((prev) => ({ ...prev, [ip]: name.trim() }));
      const device = getDeviceType();
      onLogin({ name: name.trim(), ip, device });
    }
  };

  return (
    <div className="space-y-8">
      {!user ? (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg text-center max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-4">Welcome to the Quiz Platform</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Please enter your name to begin. Your name will be linked to your IP address for future visits.
          </p>
          <form onSubmit={handleLoginSubmit}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              readOnly={isIpIdentified}
              className="w-full px-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
            {isIpIdentified && <p className="text-sm text-gray-500 mt-2">Welcome back, {name}!</p>}
            <button
              type="submit"
              className="mt-4 w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 transition-colors"
            >
              Login / Start
            </button>
          </form>
        </div>
      ) : (
        <div className="text-center">
          <h2 className="text-3xl font-bold">Welcome, {user.name}!</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Choose a quiz to start.</p>
          <button
            onClick={onLogout}
            className="mt-4 text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            Logout
          </button>
        </div>
      )}

      {user && user.name.toLowerCase() !== 'admin' && (
        <div>
          <h3 className="text-2xl font-semibold mb-4 text-center">Available Quizzes</h3>
          {loading ? (
            <p className="text-center text-gray-500">Loading quizzes...</p>
          ) : quizzes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-xl font-bold">{quiz.title}</h4>
                      <DifficultyBadge difficulty={quiz.difficulty} />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4 h-20 overflow-auto">
                      {quiz.description}
                    </p>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-300 mb-4">
                      <p>
                        {quiz.questionsToSelect} questions from {quiz.totalQuestions}
                      </p>
                      <p>
                        Time: {quiz.timer?.type === 'total'
                          ? `${quiz.timer.duration / 60} mins total`
                          : `${quiz.timer.duration}s per question`}
                      </p>
                    </div>
                    <button
                      onClick={() => onStartQuiz(quiz)}
                      className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 transition-colors"
                    >
                      Start Quiz
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500">
              No quizzes available yet. Please ask an admin to upload one.
            </p>
          )}
        </div>
      )}
    </div>
  );
};