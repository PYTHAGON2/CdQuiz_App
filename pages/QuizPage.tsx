import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Quiz, User, Question, QuestionType } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { shuffleArray, formatTime } from '../utils/helpers';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface QuizPageProps {
  quiz: Quiz;
  user: User;
  onFinish: (attempt: any) => void;
}

export const QuizPage: React.FC<QuizPageProps> = ({ quiz, user, onFinish }) => {
  const [questions] = useState(() => shuffleArray(quiz.questions).slice(0, quiz.questionsToSelect));
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const [quizState, setQuizState] = useLocalStorage(`quiz-state-${user.name}-${quiz.id}`, {
    answers: Array(questions.length).fill(null).map((_, i) => ({ questionId: questions[i].id, answer: null })),
    timeLeft: quiz.timer.type === 'total' ? quiz.timer.duration : quiz.timer.duration,
    submitted: {} as { [key: string]: true },
  });

  const { answers, timeLeft, submitted } = quizState;
  const currentQuestion = questions[currentQuestionIndex];
  const userAnswer = answers[currentQuestionIndex]?.answer;
  const isCurrentSubmitted = !!submitted[currentQuestion.id];

  const handleAnswer = (answer: string | string[]) => {
    if (isCurrentSubmitted) return;
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = { questionId: currentQuestion.id, answer };
    setQuizState(prev => ({ ...prev, answers: newAnswers }));
  };

  const handleCheckAnswer = () => {
    if (!userAnswer || (typeof userAnswer === 'string' && userAnswer.trim() === '')) {
      alert("Please provide an answer first.");
      return;
    }
    setQuizState(prev => ({ ...prev, submitted: { ...prev.submitted, [currentQuestion.id]: true } }));
  };

  const submitQuiz = useCallback(async () => {
    let correctCount = 0;
    let wrongCount = 0;

    questions.forEach((q, index) => {
      const userAnswer = answers[index].answer;
      if (userAnswer) {
        if (Array.isArray(q.correctAnswer)) {
          if (
            Array.isArray(userAnswer) &&
            q.correctAnswer.length === userAnswer.length &&
            q.correctAnswer.every(val => userAnswer.includes(val))
          ) correctCount++;
          else wrongCount++;
        } else {
          if (String(userAnswer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase())
            correctCount++;
          else wrongCount++;
        }
      }
    });

    const unansweredCount = answers.filter(a => a.answer === null).length;
    const attempt = {
      quizId: quiz.id,
      userName: user.name,
      ipAddress: user.ip,
      device: user.device,
      score: Math.round((correctCount / questions.length) * 100),
      totalCorrect: correctCount,
      totalWrong: wrongCount + unansweredCount,
      totalUnanswered: unansweredCount,
      answers,
      timestamp: new Date().toISOString(),
    };

    try {
      setIsSaving(true);
      const { error } = await supabase.from('quiz_attempts').insert([attempt]);
      if (error) throw error;
    } catch (err) {
      console.warn('⚠️ Could not save to Supabase. Saving locally instead.', err);
      const allAttempts = JSON.parse(localStorage.getItem('quiz-attempts') || '[]');
      localStorage.setItem('quiz-attempts', JSON.stringify([...allAttempts, attempt]));
    } finally {
      setIsSaving(false);
      localStorage.removeItem(`quiz-state-${user.name}-${quiz.id}`);
      onFinish(attempt);
    }
  }, [questions, answers, quiz.id, user, onFinish]);

  const handleExitQuiz = () => {
    if (window.confirm('Are you sure you want to end the quiz?')) {
      submitQuiz();
    }
  };

  // Timer logic unchanged
  useEffect(() => {
    if (timeLeft <= 0) {
      if (quiz.timer.type === 'total') submitQuiz();
      else if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setQuizState(prev => ({ ...prev, timeLeft: quiz.timer.duration }));
      } else submitQuiz();
      return;
    }

    const timerId = setInterval(() => {
      setQuizState(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeLeft, quiz.timer, currentQuestionIndex, questions.length, setQuizState, submitQuiz]);

  const goToNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      if (quiz.timer.type === 'per-question' && !submitted[questions[currentQuestionIndex + 1]?.id]) {
        setQuizState(prev => ({ ...prev, timeLeft: quiz.timer.duration }));
      }
    }
  };

  const goToPrev = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(prev => prev - 1);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{quiz.title}</h2>
        <div className="text-lg font-semibold bg-red-500 text-white px-4 py-1 rounded-md">
          {formatTime(timeLeft)}
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mb-6">
        <div
          className="bg-primary-600 h-2.5 rounded-full"
          style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
        ></div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-2">
          Question {currentQuestionIndex + 1} of {questions.length}
        </h3>
        <p className="text-xl mb-6">{currentQuestion.questionText}</p>

        {/* your QuestionDisplay here */}

        <div className="flex justify-between mt-8">
          <button onClick={goToPrev} disabled={currentQuestionIndex === 0} className="px-6 py-2 bg-gray-300 dark:bg-gray-600 rounded-md disabled:opacity-50">
            Previous
          </button>

          {!isCurrentSubmitted ? (
            <button
              onClick={handleCheckAnswer}
              disabled={!userAnswer}
              className="px-6 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:opacity-50"
            >
              Check Answer
            </button>
          ) : currentQuestionIndex === questions.length - 1 ? (
            <button
              onClick={submitQuiz}
              disabled={isSaving}
              className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              {isSaving ? 'Saving...' : 'Submit Quiz'}
            </button>
          ) : (
            <button onClick={goToNext} className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">
              Next
            </button>
          )}
        </div>

        <div className="mt-8 text-center">
          <button onClick={handleExitQuiz} className="text-sm text-gray-500 hover:underline">
            Exit Quiz & See Results
          </button>
        </div>
      </div>
    </div>
  );
};
