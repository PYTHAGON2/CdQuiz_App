// AdminDashboard.tsx - Supabase Live Data Version

import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

import React, { useState, useCallback, useEffect } from 'react'; // Added useEffect
import { Quiz, QuizAttempt } from '../types';
// import { useLocalStorage } from '../hooks/useLocalStorage'; // REMOVED
import { UploadIcon, TrashIcon } from '../components/Icons';

interface AdminDashboardProps {
  onLogout: () => void;
}

// Define a new type for the log data
interface VisitLog {
  id: string;
  ipAddress: string;
  device: string;
  isBot: boolean;
  isLoggedIn: boolean;
  userName: string | null;
  visitedAt: string;
}

const sampleQuizJSON = `[
  {
    "title": "Sample Quiz",
    "description": "This is a sample quiz to show the format.",
    "difficulty": "Easy",
    "totalQuestions": 3,
    "questionsToSelect": 2,
    "timer": { "type": "total", "duration": 300 },
    "showNotesAfterQuestion": true,
    "questions": [
      {
        "id": "sq1",
        "questionText": "What is 2 + 2?",
        "type": "MCQ",
        "options": ["3", "4", "5"],
        "correctAnswer": "4",
        "note": "This is a basic arithmetic operation. The sum of 2 and 2 is 4."
      },
      {
        "id": "sq2",
        "questionText": "The sky is blue.",
        "type": "TF",
        "correctAnswer": "True",
        "note": "The sky appears blue to the human eye primarily due to Rayleigh scattering of sunlight by the Earth's atmosphere."
      },
      {
        "id": "sq3",
        "questionText": "The capital of Japan is __.",
        "type": "FIB",
        "correctAnswer": "Tokyo",
        "note": "Tokyo has been the de facto capital of Japan since 1868 when the Emperor moved the Imperial Court there."
      }
    ]
  }
]`;

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  // Switched from useLocalStorage to useState for live data
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<VisitLog[]>([]);

  // --- Supabase Data Handlers ---

  const fetchQuizzes = useCallback(async () => {
    const { data, error } = await supabase
      .from('quizzes') // Supabase table name for quizzes
      .select('*');

    if (error) {
      console.error('Error fetching quizzes:', error);
      // Removed alert to avoid spamming on simple data load failure
    } else {
      setQuizzes(data as Quiz[]);
    }
  }, []);

  const fetchAttempts = useCallback(async () => {
    const { data, error } = await supabase
      .from('attempts') // Supabase table name for attempts
      .select('*');

    if (error) {
      console.error('Error fetching attempts:', error);
    } else {
      setAttempts(data as QuizAttempt[]);
    }
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchQuizzes();
      await fetchAttempts();
      setLoading(false);
    };
    loadData();
  }, [fetchQuizzes, fetchAttempts]);
  
  const uploadQuizzes = useCallback(async (newQuizzes: Quiz[]) => {
    // Add ID logic for non-DB-generated IDs
    const quizzesToInsert = newQuizzes.map(q => ({
      ...q,
      id: q.id || `${q.title.replace(/\s+/g, '-')}-${Date.now()}`,
    }));

    const { error } = await supabase
      .from('quizzes')
      .insert(quizzesToInsert); // Supabase bulk insert

    if (error) {
      console.error('Error uploading quizzes:', error);
      alert('Failed to upload quizzes to Supabase: ' + error.message);
    } else {
      alert(`${quizzesToInsert.length} quiz(zes) uploaded successfully!`);
      fetchQuizzes(); // Refresh the live quiz list
    }
  }, [fetchQuizzes]);

  // Unified logic for parsing and uploading JSON
  const parseAndUpload = useCallback((jsonString: string) => {
    try {
      const newQuizzes = JSON.parse(jsonString) as Quiz[];
      // Simple validation
      if (Array.isArray(newQuizzes) && newQuizzes.every(q => q.title && q.questions)) {
        uploadQuizzes(newQuizzes);
        setJsonInput('');
      } else {
        alert('Invalid JSON format. Expected an array of quizzes with title and questions.');
      }
    } catch (error) {
      alert('Failed to parse JSON.');
      console.error(error);
    }
  }, [uploadQuizzes]);
  
  // Re-wired file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        parseAndUpload(e.target?.result as string);
      };
      reader.readAsText(file);
      event.target.value = ''; // Clear file input
    }
  };
  
  // Re-wired JSON paste
  const handleJsonPaste = () => {
    if (!jsonInput.trim()) {
      alert('Please paste JSON content first.');
      return;
    }
    parseAndUpload(jsonInput);
  };
  
  const deleteQuiz = useCallback(async (quizId: string) => { // Made async
    if (window.confirm('Are you sure you want to delete this quiz and all its attempts?')) {
      // Supabase delete - assumes cascade delete is set up on your database foreign key
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId);

      if (error) {
        console.error('Error deleting quiz:', error);
        alert('Failed to delete quiz from Supabase: ' + error.message);
        return;
      }
      
      // Update local state by re-fetching live data
      fetchQuizzes(); 
      fetchAttempts(); 

      if (selectedQuizId === quizId) {
        setSelectedQuizId(null);
      }
    }
  }, [selectedQuizId, fetchQuizzes, fetchAttempts]);

  const fetchVisits = useCallback(async () => {
    const { data, error } = await supabase
      .from('visits')
      .select('*')
      .order('visitedAt', { ascending: false }) // Show newest visits first
      .limit(100); // Limit to last 100 for dashboard sanity
  
    if (error) {
      console.error('Error fetching visits:', error);
    } else {
      setVisits(data as VisitLog[]);
    }
  }, []);

// ... Update your initial useEffect to call fetchVisits ...
useEffect(() => {
  const loadData = async () => {
    setLoading(true);
    await fetchQuizzes();
    await fetchAttempts();
    await fetchVisits(); // <--- NEW CALL
    setLoading(false);
  };
  loadData();
}, [fetchQuizzes, fetchAttempts, fetchVisits]); // <--- NEW DEPENDENCY


  // --- End Supabase Data Handlers ---

  const filteredAttempts = attempts.filter(a => a.quizId === selectedQuizId);

  const getSuspiciousIPs = () => {
    const ipCounts: { [ip: string]: { count: number, names: Set<string> }} = {};
    attempts.forEach(attempt => {
      if (!ipCounts[attempt.ipAddress]) {
        ipCounts[attempt.ipAddress] = { count: 0, names: new Set() };
      }
      ipCounts[attempt.ipAddress].count++;
      ipCounts[attempt.ipAddress].names.add(attempt.userName);
    });
    return Object.entries(ipCounts).filter(([_, data]) => data.count > 3 || data.names.size > 1);
  }

  const suspiciousIPs = getSuspiciousIPs();

  if (loading) {
    // Render a loading state while fetching data
    return (
      <div className="flex justify-center items-center h-screen text-2xl">
        Loading live data... Don't panic.
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Admin Dashboard</h2>
        <button onClick={onLogout} className="bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition-colors">
          Logout
        </button>
      </div>
      

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quiz Management */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">Manage Quizzes</h3>
          <label className="w-full flex items-center justify-center px-4 py-3 bg-primary-600 text-white rounded-md cursor-pointer hover:bg-primary-700 transition-colors">
            <UploadIcon />
            <span>Upload Quizzes (JSON)</span>
            <input type="file" className="hidden" accept=".json" onChange={handleFileUpload} />
          </label>
            <div className="mt-4">
            <textarea
              className="w-full h-32 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Or paste quiz JSON here..."
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              aria-label="Paste quiz JSON"
            ></textarea>
            <button
              onClick={handleJsonPaste}
              className="mt-2 w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
            >
              Add Quiz from Pasted JSON
            </button>
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-primary-600 dark:text-primary-400 hover:underline">
              View Sample Quiz JSON Format
            </summary>
            <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-900 rounded-md text-xs overflow-x-auto">
                <code>{sampleQuizJSON}</code>
            </pre>
          </details>

          <div className="mt-6 space-y-2 max-h-72 overflow-y-auto">
            {quizzes.length === 0 ? (
                <p className="text-center text-gray-500">No quizzes found in Supabase.</p>
            ) : (
                quizzes.map(quiz => (
                    <div key={quiz.id} className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                        <span>{quiz.title}</span>
                        <button onClick={() => deleteQuiz(quiz.id)} className="text-red-500 hover:text-red-700" aria-label={`Delete ${quiz.title}`}>
                            <TrashIcon />
                        </button>
                    </div>
                ))
            )}
          </div>
        </div>

        {/* User Attempts */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">View User Attempts</h3>
          <select 
            onChange={e => setSelectedQuizId(e.target.value)} 
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 mb-4"
            value={selectedQuizId || ""}
          >
            <option value="" disabled>Select a quiz to see attempts</option>
            {quizzes.map(quiz => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}
          </select>
          <div className="max-h-96 overflow-y-auto">
            {selectedQuizId ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b dark:border-gray-600">
                    <th className="p-2">User</th>
                    <th className="p-2">IP</th>
                    <th className="p-2">Device</th>
                    <th className="p-2">Score</th>
                    <th className="p-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttempts.map(attempt => (
                    <tr key={attempt.id} className="border-b dark:border-gray-700">
                      <td className="p-2">{attempt.userName}</td>
                      <td className="p-2">{attempt.ipAddress}</td>
                      <td className="p-2">{attempt.device}</td>
                      <td className="p-2">{attempt.score}%</td>
                      <td className="p-2 text-sm">{new Date(attempt.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-center text-gray-500">Please select a quiz.</p>}
          </div>
        </div>
      </div>
      
      {/* Suspicious Activity */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4 text-yellow-500">Suspicious Activity</h3>
             <div className="max-h-64 overflow-y-auto">
                {suspiciousIPs.length > 0 ? (
                    <ul className="space-y-2">
                        {suspiciousIPs.map(([ip, data]) => (
                            <li key={ip} className="p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-md">
                                <p className="font-bold">IP: {ip}</p>
                                <p>Attempts: {data.count}</p>
                                <p>Usernames: {Array.from(data.names).join(', ')}</p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-gray-500">No suspicious activity detected.</p>
                )}
            </div>
        </div>
       
        {/* 🌟 New Traffic & Bot Log Section 🌟 */}
<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
    <h3 className="text-xl font-semibold mb-4 text-primary-500">
        Site Traffic Log (Last 100 Visits)
    </h3>
    <div className="max-h-64 overflow-y-auto">
        {visits.length > 0 ? (
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b dark:border-gray-600">
                        <th className="p-2">Time</th>
                        <th className="p-2">IP</th>
                        <th className="p-2">User</th>
                        <th className="p-2">Device</th>
                    </tr>
                </thead>
                <tbody>
                    {visits.map((log) => (
                        <tr key={log.id} className="border-b dark:border-gray-700">
                            <td className="p-2 text-xs">
                                {new Date(log.visitedAt).toLocaleTimeString()}
                            </td>
                            <td className="p-2">{log.ipAddress}</td>
                            <td className="p-2">
                                {log.userName || (
                                    <span className="text-gray-400">Guest</span>
                                )}
                            </td>
                            <td className="p-2">{log.device}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        ) : (
            <p className="text-center text-gray-500">No recent traffic logs available.</p>
        )}
    </div>
</div>
        
    </div>
    



  );
};