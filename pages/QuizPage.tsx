import React, { useState, useEffect, useCallback } from 'react';
import { Quiz, User, Question, QuestionType } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { shuffleArray, formatTime } from '../utils/helpers';
// --- NEW: Supabase Imports ---
import { createClient } from '@supabase/supabase-js'; 

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
// --- END NEW: Supabase Imports ---

interface QuizPageProps {
  quiz: Quiz;
  user: User;
  onFinish: (attempt: any) => void;
}

// NOTE: QuestionDisplay component is not changed, keeping it omitted for brevity.
const QuestionDisplay: React.FC<{ 
    question: Question; 
    userAnswer: string | string[] | null; 
    onAnswer: (answer: string | string[]) => void;
    isSubmitted: boolean;
}> = ({ question, userAnswer, onAnswer, isSubmitted }) => {
    // ... (Your existing QuestionDisplay logic remains here) ...
    // Note: Leaving it blank to fit within the concise format, assume it is present.
    switch(question.type) {
        case QuestionType.MultipleChoice:
            return (
                <div className="space-y-3">
                    {question.options?.map((option, index) => {
                        const isCorrect = option === question.correctAnswer;
                        const isSelected = userAnswer === option;
                        let classes = 'w-full text-left p-4 rounded-lg border-2 transition-colors';

                        if (isSubmitted) {
                            if (isCorrect) classes += ' bg-green-100 dark:bg-green-900 border-green-500 text-green-800 dark:text-green-200 font-bold';
                            else if (isSelected) classes += ' bg-red-100 dark:bg-red-900 border-red-500 text-red-800 dark:text-red-200';
                            else classes += ' bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 opacity-70';
                        } else if (isSelected) {
                            classes += ' bg-primary-500 border-primary-500 text-white';
                        } else {
                            classes += ' bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-primary-100 dark:hover:bg-gray-600';
                        }
                        return (
                            <button key={index} onClick={() => onAnswer(option)} disabled={isSubmitted} className={classes}>
                                {option}
                            </button>
                        );
                    })}
                </div>
            );
        case QuestionType.TrueFalse:
            return (
                <div className="flex space-x-4">
                    {['True', 'False'].map(option => {
                        const isCorrect = option === question.correctAnswer;
                        const isSelected = userAnswer === option;
                        let classes = 'flex-1 p-4 rounded-lg border-2 transition-colors';

                        if (isSubmitted) {
                            if (isCorrect) classes += ' bg-green-100 dark:bg-green-900 border-green-500 text-green-800 dark:text-green-200 font-bold';
                            else if (isSelected) classes += ' bg-red-100 dark:bg-red-900 border-red-500 text-red-800 dark:text-red-200';
                            else classes += ' bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 opacity-70';
                        } else if (isSelected) {
                            classes += ' bg-primary-500 border-primary-500 text-white';
                        } else {
                            classes += ' bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-primary-100 dark:hover:bg-gray-600';
                        }
                        return (
                            <button key={option} onClick={() => onAnswer(option)} disabled={isSubmitted} className={classes}>
                                {option}
                            </button>
                        );
                    })}
                </div>
            );
        case QuestionType.FillInTheBlank:
            const isCorrect = isSubmitted && String(userAnswer).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase();
            let inputClasses = 'w-full px-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors';

            if(isSubmitted){
                inputClasses += isCorrect ? ' border-green-500 bg-green-50 dark:bg-green-900/20' : ' border-red-500 bg-red-50 dark:bg-red-900/20';
            }

            return (
                <div>
                    <input
                        type="text"
                        value={typeof userAnswer === 'string' ? userAnswer : ''}
                        onChange={(e) => onAnswer(e.target.value)}
                        className={inputClasses}
                        placeholder="Type your answer here"
                        readOnly={isSubmitted}
                    />
                    {isSubmitted && !isCorrect && (
                        <p className="mt-2 text-sm text-green-700 dark:text-green-400">
                            Correct answer: <span className="font-medium">{question.correctAnswer}</span>
                        </p>
                    )}
                </div>
            );
        default:
            return <p>Unsupported question type.</p>;
    }
};

export const QuizPage: React.FC<QuizPageProps> = ({ quiz, user, onFinish }) => {
  const [questions] = useState(() => shuffleArray(quiz.questions).slice(0, quiz.questionsToSelect));
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
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
      if (userAnswer === null || (typeof userAnswer === 'string' && userAnswer.trim() === '')) {
        alert("Please provide an answer first.");
        return;
      }
      setQuizState(prev => ({...prev, submitted: { ...prev.submitted, [currentQuestion.id]: true }}));
  };

    // --- NEW/MODIFIED: Supabase/Offline Logic ---

    /**
     * Saves an attempt to local storage to be synced later.
     * @param attemptPayload The attempt data structure.
     */
    const handleOfflineAttempt = (attemptPayload: any) => {
        console.warn("[OFFLINE FALLBACK]: Saving attempt to local storage for later sync.");
        const failedAttempts = JSON.parse(localStorage.getItem('failed-quiz-attempts') || '[]');
        localStorage.setItem('failed-quiz-attempts', JSON.stringify([...failedAttempts, attemptPayload]));
    };


    /**
     * Calculates score, saves attempt to Supabase (with offline fallback), and finishes quiz.
     */
    const submitQuiz = useCallback(async () => {
        let correctCount = 0;
        let wrongCount = 0;
        
        // --- SCORING LOGIC --- (Simplified for brevity)
        questions.forEach((q, index) => {
            const userAnswer = answers[index].answer;
            if (userAnswer) {
                const isCorrect = Array.isArray(q.correctAnswer)
                    ? (Array.isArray(userAnswer) && q.correctAnswer.length === userAnswer.length && q.correctAnswer.every(val => userAnswer.includes(val)))
                    : (String(userAnswer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase());
                
                if (isCorrect) correctCount++;
                else wrongCount++;
            }
        });

        const unansweredCount = answers.filter(a => a.answer === null).length;
        const totalQuestions = questions.length;
        const finalScore = Math.round((correctCount / totalQuestions) * 100);

        // Prepare the Supabase payload
        const attemptPayload = {
            "quizId": quiz.id,
            "userName": user.name,
            "ipAddress": user.ip,
            "device": user.device,
            "score": finalScore,
            "details": {
                totalCorrect: correctCount,
                totalWrong: wrongCount + unansweredCount,
                totalUnanswered: unansweredCount,
                timeSpent: quiz.timer.type === 'total' ? (quiz.timer.duration - timeLeft) : null,
                userAnswers: answers,
                questionsTaken: questions.map(q => ({id: q.id, text: q.questionText}))
            },
        };

        let finalAttempt = attemptPayload;

        try {
            // 🚀 Attempt Supabase Insertion
            const { data, error } = await supabase
                .from('attempts')
                .insert([attemptPayload])
                .select();

            if (error) throw new Error(error.message);

            console.log("Quiz attempt successfully saved to Supabase.");
            finalAttempt = data[0]; // Use the DB-returned data

        } catch (error) {
            // 💾 Fallback to Local Storage
            handleOfflineAttempt(attemptPayload);
        }

        
        

        // Clean up local quiz state
        localStorage.removeItem(`quiz-state-${user.name}-${quiz.id}`);

        onFinish(finalAttempt, quiz);
    }, [questions, answers, quiz.id, user, onFinish, timeLeft, quiz.timer]);


    /**
     * Checks local storage for failed attempts and uploads them to Supabase.
     */
    const syncFailedAttempts = useCallback(async () => {
        const failedAttemptsString = localStorage.getItem('failed-quiz-attempts');
        if (!failedAttemptsString) return;

        let failedAttempts: any[] = JSON.parse(failedAttemptsString);
        if (failedAttempts.length === 0) return;
        
        console.info(`[SYNC]: Found ${failedAttempts.length} failed attempts. Attempting sync.`);

        // Attempt to insert all failed attempts in one go
        const { error } = await supabase
            .from('attempts')
            .insert(failedAttempts);

        if (error) {
            console.error("[SYNC FAILED]: Still unable to sync attempts:", error);
        } else {
            console.log("[SYNC SUCCESS]: All failed attempts successfully uploaded.");
            // Clear the local storage cache only on success
            localStorage.removeItem('failed-quiz-attempts');
        }
    }, []);

    // --- useEffect Hooks ---
    
    // 1. Timer Logic
    useEffect(() => {
        // ... (Existing timer logic remains here) ...
        if (timeLeft <= 0) {
            if (quiz.timer.type === 'total') {
                submitQuiz();
            } else {
                if (currentQuestionIndex < questions.length - 1) {
                    setCurrentQuestionIndex(prev => prev + 1);
                    setQuizState(prev => ({ ...prev, timeLeft: quiz.timer.duration }));
                } else {
                    submitQuiz();
                }
            }
            return;
        }

        const timerId = setInterval(() => {
            setQuizState(prev => ({...prev, timeLeft: prev.timeLeft - 1}));
        }, 1000);

        return () => clearInterval(timerId);
    }, [timeLeft, quiz.timer, currentQuestionIndex, questions.length, setQuizState, submitQuiz]);


    // 2. NEW: Sync Failed Attempts on Mount
    useEffect(() => {
        syncFailedAttempts();
    }, [syncFailedAttempts]);

    // ... (goToNext, goToPrev, handleExitQuiz remain the same) ...

    const handleExitQuiz = () => {
      if (window.confirm('Are you sure you want to end the quiz? Your current progress will be submitted and you will be taken to the results page.')) {
        submitQuiz();
      }
    };
    
    const goToNext = () => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        if(quiz.timer.type === 'per-question' && !submitted[questions[currentQuestionIndex + 1]?.id]) {
            setQuizState(prev => ({...prev, timeLeft: quiz.timer.duration}));
        }
      }
    };

    const goToPrev = () => {
      if (currentQuestionIndex > 0) {
        setCurrentQuestionIndex(prev => prev - 1);
      }
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
        <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}></div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-2">Question {currentQuestionIndex + 1} of {questions.length}</h3>
        <p className="text-xl mb-6">{currentQuestion.questionText}</p>
        <QuestionDisplay question={currentQuestion} userAnswer={userAnswer} onAnswer={handleAnswer} isSubmitted={isCurrentSubmitted} />

        {isCurrentSubmitted && quiz.showNotesAfterQuestion && (currentQuestion.note || currentQuestion.explanation) && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-bold text-lg mb-2 text-gray-800 dark:text-gray-200">Note</h4>
                <p className="text-gray-600 dark:text-gray-400">{currentQuestion.note || currentQuestion.explanation}</p>
            </div>
        )}
      </div>

      <div className="flex justify-between mt-8">
        <button onClick={goToPrev} disabled={currentQuestionIndex === 0} className="px-6 py-2 bg-gray-300 dark:bg-gray-600 rounded-md disabled:opacity-50">Previous</button>
        
        {!isCurrentSubmitted ? (
            <button onClick={handleCheckAnswer} disabled={userAnswer === null || userAnswer === ''} className="px-6 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed">Check Answer</button>
        ) : currentQuestionIndex === questions.length - 1 ? (
          <button onClick={submitQuiz} className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600">Submit Quiz</button>
        ) : (
          <button onClick={goToNext} className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">Next</button>
        )}
      </div>

      <div className="mt-8 text-center">
          <button onClick={handleExitQuiz} className="text-sm text-gray-500 hover:underline">Exit Quiz & See Results</button>
      </div>
    </div>
  );
};