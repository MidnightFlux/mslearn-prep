/**
 * ExamSession - Core exam logic and state management
 * Handles question shuffling, answer tracking, scoring, and progress persistence
 */
class ExamSession {
    constructor(questions, shuffle = false, shuffleOptions = false) {
        this.originalQuestions = JSON.parse(JSON.stringify(questions));
        this.questions = JSON.parse(JSON.stringify(questions));
        
        if (shuffle) {
            this.shuffleArray(this.questions);
        }
        
        if (shuffleOptions) {
            this.shuffleOptions();
        }
        
        this.currentIndex = 0;
        this.answers = {};
        this.results = {};
        this.markedQuestions = new Set();
        this.score = 0;
    }
    
    shuffleOptions() {
        this.questions.forEach(q => {
            if (q.options && q.options.length > 1) {
                q.options.forEach(opt => {
                    opt.original_letter = opt.letter;
                });
                this.shuffleArray(q.options);
                
                const letters = ['a', 'b', 'c', 'd', 'e', 'f'];
                q.options.forEach((opt, idx) => {
                    opt.letter = letters[idx];
                });
                
                const newCorrectAnswers = q.correct_answers.map(oldLetter => {
                    const opt = q.options.find(o => o.original_letter === oldLetter);
                    return opt ? opt.letter : oldLetter;
                });
                q.correct_answers = newCorrectAnswers.sort();
            }
        });
    }
    
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    getCurrentQuestion() {
        if (this.currentIndex >= 0 && this.currentIndex < this.questions.length) {
            return this.questions[this.currentIndex];
        }
        return null;
    }
    
    submitAnswer(answers) {
        const question = this.getCurrentQuestion();
        if (!question) return false;
        
        const qNum = question.question_number;
        this.answers[qNum] = answers;
        
        const correctAnswers = new Set(question.correct_answers);
        const userSet = new Set(answers);
        const isCorrect = this.setsEqual(userSet, correctAnswers);
        
        this.results[qNum] = isCorrect;
        if (isCorrect) {
            this.score++;
        }
        
        return isCorrect;
    }
    
    setsEqual(a, b) {
        if (a.size !== b.size) return false;
        for (const item of a) {
            if (!b.has(item)) return false;
        }
        return true;
    }
    
    nextQuestion() {
        if (this.currentIndex < this.questions.length - 1) {
            this.currentIndex++;
            return true;
        }
        return false;
    }
    
    prevQuestion() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            return true;
        }
        return false;
    }
    
    goToQuestion(index) {
        if (index >= 0 && index < this.questions.length) {
            this.currentIndex = index;
            return true;
        }
        return false;
    }
    
    getSummary() {
        const total = this.questions.length;
        const answered = Object.keys(this.results).length;
        const correct = Object.values(this.results).filter(v => v).length;
        const incorrect = answered - correct;
        const unanswered = total - answered;
        const percentage = total > 0 ? Math.round((correct / total) * 100 * 10) / 10 : 0;
        const passed = percentage >= 70;
        
        return {
            total,
            answered,
            unanswered,
            correct,
            incorrect,
            percentage,
            passed,
            score: this.score
        };
    }
    
    isMarked(questionNumber) {
        return this.markedQuestions.has(String(questionNumber));
    }
    
    toggleMark(questionNumber) {
        const qNum = String(questionNumber);
        if (this.markedQuestions.has(qNum)) {
            this.markedQuestions.delete(qNum);
            return false;
        } else {
            this.markedQuestions.add(qNum);
            return true;
        }
    }
    
    getMarkedCount() {
        return this.markedQuestions.size;
    }
}

export { ExamSession };
