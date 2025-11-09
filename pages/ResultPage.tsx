import React, { useState, useRef } from 'react';
import { QuizAttempt, Quiz } from '../types';
import { createClient } from '@supabase/supabase-js';

// ✅ Initialize Supabase client (Client should be initialized consistently)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ResultPageProps {
  attempt: QuizAttempt & { questions: any[] }; // questions are passed for review
  quiz: Quiz; // <<< CRITICAL FIX: Pass the quiz object directly
  onRestart: (quiz: Quiz) => void;
  onBackToHome: () => void;
}

const getAnswerStatus = (question: any, userAnswer: any) => {
  if (userAnswer === null) return 'unanswered';
  
  // Handle array/multi-select
  if (Array.isArray(question.correctAnswer)) {
    if (
      Array.isArray(userAnswer) &&
      question.correctAnswer.length === userAnswer.length &&
      question.correctAnswer.every((val: any) => userAnswer.includes(val))
    ) {
      return 'correct';
    }
  } 
  // Handle string/single-select/fill-in-the-blank
  else if (
    String(userAnswer).toLowerCase() ===
    String(question.correctAnswer).toLowerCase()
  ) {
    return 'correct';
  }
  return 'wrong';
};

export const ResultPage: React.FC<ResultPageProps> = ({
  attempt,
  quiz, // Use the passed quiz object
  onRestart,
  onBackToHome,
}) => {
  const [isReviewing, setIsReviewing] = useState(false);
  const [comment, setComment] = useState('');
  // Removed local storage quiz lookup - using 'quiz' prop directly
  const resultCardRef = useRef<HTMLDivElement>(null);

  const quizToRestart = quiz; // CRITICAL FIX: Use the passed prop

  const handleDownloadImage = () => {
    if (resultCardRef.current) {
      // @ts-ignore
      html2canvas(resultCardRef.current).then(canvas => {
        const link = document.createElement('a');
        link.download = `quiz-result-${attempt.userName}.png`;
        link.href = canvas.toDataURL();
        link.click();
      });
    }
  };

  const handleDownloadText = () => {
    const content = `
Quiz Result for: ${attempt.userName}
Quiz: ${attempt.quizTitle}
Date: ${new Date(attempt.timestamp).toLocaleString()}

Score: ${attempt.score}%
Correct Answers: ${attempt.totalCorrect}
Wrong/Unanswered: ${attempt.totalWrong}
---
Review:
${attempt.questions
  .map((q, i) => {
    const userAnswerObj = attempt.answers.find(a => a.questionId === q.id);
    const status = getAnswerStatus(q, userAnswerObj?.answer);
    return `
Q${i + 1}: ${q.questionText}
Your Answer: ${userAnswerObj?.answer || 'Not answered'} (${status})
Correct Answer: ${
      Array.isArray(q.correctAnswer)
        ? q.correctAnswer.join(', ')
        : q.correctAnswer
    }
`;
  })
  .join('\n')}
    `;
    const blob = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `quiz-result-${attempt.userName}.txt`;
    link.click();
  };

  // ✅ Supabase + Smart Local Fallback comment submit (REWRITTEN)
  const handleCommentSubmit = async () => {
    // Check if the ID looks like a Supabase-generated UUID (contains a dash)
    const isSyncedToSupabase = attempt.id && String(attempt.id).length > 10 && String(attempt.id).includes('-');

    if (comment.trim() === '') {
        alert("Please enter a comment before submitting.");
        return;
    }

    if (isSyncedToSupabase) {
        // --- ONLINE PATH: Update Supabase ---
        try {
            // Updating the 'comment' inside the 'details' JSONB column
            const { error } = await supabase
                .from('attempts') // Assuming your table is named 'attempts'
                .update({ details: { ...attempt.details, comment: comment.trim() } }) 
                .eq('id', attempt.id); 

            if (error) throw error;
            alert('Comment submitted successfully to Supabase!');
        } catch (err) {
            console.warn('⚠️ Supabase update failed during comment submission. The attempt is already in the DB, but the update failed.', err);
            alert('Comment update failed. Please try again later.'); 
        }
    } else {
        // --- OFFLINE PATH: Update Local Sync Cache ---
        console.warn('⚠️ Attempt is not yet synced to Supabase. Updating local cache.');
        try {
            let failedAttempts: any[] = JSON.parse(
                localStorage.getItem('failed-quiz-attempts') || '[]'
            );
            
            // Find the attempt in the cache using quizId and userName/ip (since it lacks a DB ID)
            const updatedAttempts = failedAttempts.map(a =>
                (a.quizId === attempt.quizId && a.userName === attempt.userName && a.ipAddress === attempt.ipAddress) 
                    ? { ...a, details: { ...a.details, comment: comment.trim() } } 
                    : a
            );
            localStorage.setItem('failed-quiz-attempts', JSON.stringify(updatedAttempts));
            alert('Comment saved locally for sync.');

        } catch (e) {
             console.error('Failed to update local cache:', e);
             alert('Could not save comment locally.');
        }
    }
    setComment('');
  };

  if (isReviewing) {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-6">
          Reviewing: {attempt.quizTitle}
        </h2>
        <div className="space-y-4">
          {attempt.questions.map((question, index) => {
            const userAnswerObj = attempt.answers.find(
              a => a.questionId === question.id
            );
            const status = getAnswerStatus(question, userAnswerObj?.answer);
            const statusClasses = {
              correct: 'border-green-500 bg-green-50 dark:bg-green-900/50',
              wrong: 'border-red-500 bg-red-50 dark:bg-red-900/50',
              unanswered: 'border-gray-400 bg-gray-50 dark:bg-gray-700/50',
            };

            return (
              <div
                key={question.id}
                className={`p-4 rounded-lg border-2 ${statusClasses[status]}`}
              >
                <p className="font-semibold">
                  {index + 1}. {question.questionText}
                </p>
                <p className="mt-2 text-sm">
                  Your answer:{' '}
                  <span className="font-medium">
                    {userAnswerObj?.answer || 'Not answered'}
                  </span>
                </p>
                {status !== 'correct' && (
                  <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                    Correct answer:{' '}
                    <span className="font-medium">
                      {Array.isArray(question.correctAnswer)
                        ? question.correctAnswer.join(', ')
                        : question.correctAnswer}
                    </span>
                  </p>
                )}
                {(question.note || question.explanation) && (
                  <p className="mt-2 text-xs italic text-gray-600 dark:text-gray-400">
                    Note: {question.note || question.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-center mt-8">
          <button
            onClick={() => setIsReviewing(false)}
            className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Back to Results
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto text-center">
      <div
        ref={resultCardRef}
        className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg"
      >
        <h2 className="text-3xl font-bold mb-2">Quiz Completed!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Well done, {attempt.userName}!
        </p>
        <div className="mb-6">
          <div
            className={`text-6xl font-bold ${
              attempt.score >= 70
                ? 'text-green-500'
                : attempt.score >= 40
                ? 'text-yellow-500'
                : 'text-red-500'
            }`}
          >
            {attempt.score}%
          </div>
          <p className="text-xl">Your Score</p>
        </div>
        <div className="flex justify-around text-lg">
          <div>
            <p className="font-bold">{attempt.totalCorrect}</p>
            <p className="text-sm text-gray-500">Correct</p>
          </div>
          <div>
            <p className="font-bold">{attempt.totalWrong}</p>
            <p className="text-sm text-gray-500">Wrong</p>
          </div>
          <div>
            <p className="font-bold">{attempt.totalUnanswered}</p>
            <p className="text-sm text-gray-500">Unanswered</p>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Drop a comment about the quiz..."
          className="w-full h-24 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
        />
        <button
          onClick={handleCommentSubmit}
          className="w-full px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
        >
          Submit Comment
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => setIsReviewing(true)}
          className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Review Answers
        </button>
        {quizToRestart && (
          <button
            onClick={() => onRestart(quizToRestart)}
            className="px-6 py-3 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            Restart Quiz
          </button>
        )}
        <button
          onClick={handleDownloadImage}
          className="px-6 py-3 bg-purple-500 text-white rounded-md hover:bg-purple-600"
        >
          Download as Image
        </button>
        <button
          onClick={handleDownloadText}
          className="px-6 py-3 bg-orange-500 text-white rounded-md hover:bg-orange-600"
        >
          Download as Text
        </button>
      </div>
      <div className="mt-8">
        <button
          onClick={onBackToHome}
          className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};