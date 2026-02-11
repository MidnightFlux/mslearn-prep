import { ExamSession } from './exam-session.js?v=2';

// ==================== Constants ====================
const STORAGE_KEY = 'exam-simulator-progress';
const STORAGE_VERSION = '1.0';

// ==================== Global State ====================
let examSession = null;
let uploadedFileData = null;
let selectedAnswers = [];
let categoryCountsData = {};
let selectedCategoriesList = [];
let categoriesExpanded = false;

// ==================== DOM Elements Cache ====================
let elements = {};

function cacheElements() {
    elements = {
        fileUpload: document.getElementById('file-upload'),
        dropZone: document.getElementById('drop-zone'),
        uploadSection: document.getElementById('upload-section'),
        configSection: document.getElementById('config-section'),
        errorMessage: document.getElementById('error-message'),
        startScreen: document.getElementById('start-screen'),
        examScreen: document.getElementById('exam-screen'),
        summaryScreen: document.getElementById('summary-screen'),
        selectedFile: document.getElementById('selected-file'),
        configFilename: document.getElementById('config-filename'),
        totalQuestions: document.getElementById('total-questions'),
        totalCategories: document.getElementById('total-categories'),
        questionCount: document.getElementById('question-count'),
        questionCountHelp: document.getElementById('question-count-help'),
        categoryGrid: document.getElementById('category-grid'),
        progressFill: document.getElementById('progress-fill'),
        progressText: document.getElementById('progress-text'),
        questionNumber: document.getElementById('question-number'),
        questionType: document.getElementById('question-type'),
        questionText: document.getElementById('question-text'),
        options: document.getElementById('options'),
        feedback: document.getElementById('feedback'),

        submitBtn: document.getElementById('submit-btn'),
        nextBtn: document.getElementById('next-btn'),
        finishBtn: document.getElementById('finish-btn'),
        markBtn: document.getElementById('mark-btn'),
        questionGrid: document.getElementById('question-grid'),
        passStatus: document.getElementById('pass-status'),
        statTotal: document.getElementById('stat-total'),
        statCorrect: document.getElementById('stat-correct'),
        statIncorrect: document.getElementById('stat-incorrect'),
        statPercentage: document.getElementById('stat-percentage'),
        summaryGrid: document.getElementById('summary-grid'),
        reviewDetails: document.getElementById('review-details'),
        selectedCategoriesList: document.getElementById('selected-categories-list'),
        selectedCategoriesHeader: document.getElementById('selected-categories-header'),
        categoriesToggleIcon: document.getElementById('categories-toggle-icon'),
        summaryMarkBtn: document.getElementById('summary-mark-btn')
    };
}

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    setupEventListeners();
    await loadDefaultQuestions();
});

async function loadDefaultQuestions() {
    try {
        const response = await fetch('sample-questions/ai-102-full.json');
        if (!response.ok) {
            throw new Error('Failed to load default questions');
        }
        const questions = await response.json();
        
        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('Invalid question file: no questions found');
        }
        
        const valid = questions.every(q => 
            q.question_number && 
            q.question_text && 
            Array.isArray(q.options) && 
            Array.isArray(q.correct_answers)
        );
        
        if (!valid) {
            throw new Error('Invalid question format: missing required fields');
        }
        
        uploadedFileData = {
            file: { name: 'ai-102-full.json' },
            questions: questions,
            totalCount: questions.length
        };
        
        showConfigSection();
    } catch (err) {
        console.log('Auto-load failed:', err.message);
    }
}

function setupEventListeners() {
    // File upload
    elements.fileUpload.addEventListener('change', handleFileSelect);
    elements.dropZone.addEventListener('click', () => elements.fileUpload.click());
    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('dragover');
    });
    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('dragover');
    });
    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            elements.fileUpload.files = files;
            handleFileSelect({ target: elements.fileUpload });
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (elements.examScreen.classList.contains('hidden')) return;
        
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prevQuestion();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            nextQuestion();
        }
    });

    // Global function assignments for inline event handlers
    window.resetFile = resetFile;
    window.startExam = startExam;
    window.prevQuestion = prevQuestion;
    window.nextQuestion = nextQuestion;
    window.submitAnswer = submitAnswer;
    window.finishExam = finishExam;
    window.toggleMarkQuestion = toggleMarkQuestion;
    window.startNewExam = startNewExam;
    window.toggleMarkFromSummaryButton = toggleMarkFromSummaryButton;
}

// ==================== File Upload Handlers ====================
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    hideError();
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            const questions = JSON.parse(content);
            
            if (!Array.isArray(questions) || questions.length === 0) {
                throw new Error('Invalid question file: no questions found');
            }
            
            const valid = questions.every(q => 
                q.question_number && 
                q.question_text && 
                Array.isArray(q.options) && 
                Array.isArray(q.correct_answers)
            );
            
            if (!valid) {
                throw new Error('Invalid question format: missing required fields');
            }
            
            uploadedFileData = {
                file: file,
                questions: questions,
                totalCount: questions.length
            };
            
            showConfigSection();
        } catch (err) {
            showError('Error reading file: ' + err.message);
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

function showConfigSection() {
    elements.uploadSection.classList.add('hidden');
    elements.configSection.classList.remove('hidden');
    
    elements.configFilename.textContent = uploadedFileData.file.name;
    elements.totalQuestions.textContent = uploadedFileData.totalCount;
    
    const categories = populateCategories();
    elements.totalCategories.textContent = categories.length;
}

function populateCategories() {
    const questions = uploadedFileData.questions;
    
    categoryCountsData = {};
    questions.forEach(q => {
        const cat = q.category || 'Uncategorized';
        categoryCountsData[cat] = (categoryCountsData[cat] || 0) + 1;
    });
    
    const categories = Object.keys(categoryCountsData).sort();
    elements.categoryGrid.innerHTML = '';
    
    categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'category-item';
        div.innerHTML = `
            <input type="checkbox" id="cat-${encodeURIComponent(cat)}" value="${cat}" checked>
            <label for="cat-${encodeURIComponent(cat)}">${cat}</label>
            <span class="category-count">(${categoryCountsData[cat]})</span>
        `;
        elements.categoryGrid.appendChild(div);
    });
    
    const selectAllCheckbox = document.getElementById('select-all-categories');
    selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = elements.categoryGrid.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateQuestionCountMax();
    });
    
    const checkboxes = elements.categoryGrid.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', updateQuestionCountMax);
    });
    
    updateQuestionCountMax();
    
    return categories;
}

function getSelectedCategoryTotal() {
    const selectedCategories = Array.from(
        document.querySelectorAll('#category-grid input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    
    let totalSelected = 0;
    selectedCategories.forEach(cat => {
        totalSelected += categoryCountsData[cat] || 0;
    });
    
    return totalSelected;
}

function updateQuestionCountMax() {
    const totalSelected = getSelectedCategoryTotal();
    
    elements.questionCount.max = totalSelected;
    
    if (totalSelected > 0) {
        elements.questionCount.value = totalSelected;
    }
    
    elements.questionCountHelp.textContent = `Enter a number between 1 and ${totalSelected} (selected categories)`;
}

function resetFile() {
    uploadedFileData = null;
    elements.fileUpload.value = '';
    elements.configSection.classList.add('hidden');
    elements.uploadSection.classList.remove('hidden');
    hideError();
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
}

function hideError() {
    elements.errorMessage.textContent = '';
    elements.errorMessage.classList.add('hidden');
}

// ==================== Exam Control ====================
function startExam(skipResumeCheck = false) {
    hideError();
    
    if (!uploadedFileData) {
        showError('Please select a JSON question file');
        return;
    }
    
    if (!skipResumeCheck) {
        const savedState = loadExamState();
        if (savedState && savedState.filename === uploadedFileData.file.name) {
            showResumePrompt(savedState);
            return;
        }
    }
    
    const questionCount = parseInt(elements.questionCount.value, 10);
    
    if (isNaN(questionCount) || questionCount < 1) {
        showError('Please enter a valid number of questions (at least 1)');
        return;
    }
    
    const categoryCheckboxes = document.querySelectorAll('#category-grid input[type="checkbox"]:checked');
    const selectedCategories = Array.from(categoryCheckboxes).map(cb => cb.value);
    
    if (selectedCategories.length === 0) {
        showError('Please select at least one category');
        return;
    }
    
    let questions = uploadedFileData.questions.filter(q => {
        const cat = q.category || 'Uncategorized';
        return selectedCategories.includes(cat);
    });
    
    if (questions.length === 0) {
        showError('No questions found in the selected categories');
        return;
    }
    
    if (questionCount > questions.length) {
        showError(`Cannot select more than ${questions.length} questions from the selected categories`);
        return;
    }
    
    const shuffle = document.getElementById('shuffle-checkbox').checked;
    const shuffleOptions = document.getElementById('shuffle-options-checkbox').checked;
    
    if (shuffle) {
        questions = [...questions];
        for (let i = questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questions[i], questions[j]] = [questions[j], questions[i]];
        }
    }
    
    if (questionCount < questions.length) {
        questions = questions.slice(0, questionCount);
    }
    
    selectedCategoriesList = selectedCategories;
    
    examSession = new ExamSession(questions, false, shuffleOptions);
    
    clearExamState();
    
    elements.startScreen.classList.add('hidden');
    elements.examScreen.classList.remove('hidden');
    
    renderSelectedCategories();
    renderQuestion();
}

// ==================== Progress Persistence ====================
function saveExamState() {
    if (!examSession || !uploadedFileData) return;
    
    const state = {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        filename: uploadedFileData.file.name,
        questions: examSession.questions,
        currentIndex: examSession.currentIndex,
        answers: examSession.answers,
        results: examSession.results,
        markedQuestions: Array.from(examSession.markedQuestions),
        score: examSession.score,
        selectedCategories: selectedCategoriesList,
        config: {
            shuffleOptions: document.getElementById('shuffle-options-checkbox').checked
        }
    };
    
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('Failed to save exam progress:', e);
    }
}

function loadExamState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return null;
        
        const state = JSON.parse(saved);
        
        if (state.version !== STORAGE_VERSION) {
            clearExamState();
            return null;
        }
        
        return state;
    } catch (e) {
        console.warn('Failed to load exam progress:', e);
        return null;
    }
}

function clearExamState() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.warn('Failed to clear exam progress:', e);
    }
}

function showResumePrompt(savedState) {
    const answeredCount = Object.keys(savedState.results || {}).length;
    const totalCount = savedState.questions.length;
    const progressPercent = Math.round((answeredCount / totalCount) * 100);
    const isFinished = answeredCount >= totalCount;
    
    const resumeHtml = `
        <div id="resume-prompt" class="modal-overlay">
            <div class="modal-content">
                <h3 style="margin-bottom: 15px; color: #333;">📚 Resume Previous Session?</h3>
                <p style="margin-bottom: 10px; color: #666; line-height: 1.5;">
                    ${isFinished 
                        ? `You have a <strong>completed</strong> exam from <strong>${new Date(savedState.timestamp).toLocaleString()}</strong>.`
                        : `You have an unfinished exam from <strong>${new Date(savedState.timestamp).toLocaleString()}</strong>.`
                    }
                </p>
                <p style="margin-bottom: 20px; color: #667eea; font-weight: 500;">
                    ${isFinished 
                        ? `All ${totalCount} questions completed (${progressPercent}%)`
                        : `Progress: ${answeredCount}/${totalCount} answered (${progressPercent}%)`
                    }
                </p>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-secondary" onclick="startNewFromPrompt();" style="flex: 1;">
                        Start New
                    </button>
                    <button class="btn btn-primary" onclick="${isFinished ? 'viewSummary()' : 'resumeExam()'};" style="flex: 2;">
                        ${isFinished ? 'View Summary' : 'Resume Exam'}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', resumeHtml);
}

function hideResumePrompt() {
    const prompt = document.getElementById('resume-prompt');
    if (prompt) prompt.remove();
}

function startNewFromPrompt() {
    clearExamState();
    hideResumePrompt();
    startExam(true);
}

function startNewExam() {
    if (confirm('Are you sure you want to start a new exam?\n\nYour current exam progress and results will be cleared. This action cannot be undone.')) {
        clearExamState();
        location.reload();
    }
}

function resumeExam() {
    const state = loadExamState();
    if (!state) {
        hideResumePrompt();
        return;
    }
    
    const answeredCount = Object.keys(state.results || {}).length;
    const totalCount = state.questions.length;
    
    if (answeredCount >= totalCount) {
        resumeToSummary(state);
        return;
    }
    
    uploadedFileData = {
        file: { name: state.filename },
        questions: state.questions,
        totalCount: state.questions.length
    };
    
    selectedCategoriesList = state.selectedCategories || [];
    
    examSession = new ExamSession(state.questions, false, false);
    examSession.currentIndex = state.currentIndex;
    examSession.answers = state.answers || {};
    examSession.results = state.results || {};
    examSession.score = state.score || 0;
    
    if (state.markedQuestions && Array.isArray(state.markedQuestions)) {
        state.markedQuestions.forEach(qNum => examSession.markedQuestions.add(qNum));
    }
    
    hideResumePrompt();
    
    elements.startScreen.classList.add('hidden');
    elements.examScreen.classList.remove('hidden');
    
    renderSelectedCategories();
    renderQuestion();
}

function viewSummary() {
    const state = loadExamState();
    if (!state) {
        hideResumePrompt();
        return;
    }
    resumeToSummary(state);
}

function resumeToSummary(state) {
    uploadedFileData = {
        file: { name: state.filename },
        questions: state.questions,
        totalCount: state.questions.length
    };
    
    selectedCategoriesList = state.selectedCategories || [];
    
    examSession = new ExamSession(state.questions, false, false);
    examSession.answers = state.answers || {};
    examSession.results = state.results || {};
    examSession.score = state.score || 0;
    
    if (state.markedQuestions && Array.isArray(state.markedQuestions)) {
        state.markedQuestions.forEach(qNum => examSession.markedQuestions.add(qNum));
    }
    
    hideResumePrompt();
    showSummaryFromSession();
}

function showSummaryFromSession() {
    const summary = examSession.getSummary();
    
    elements.startScreen.classList.add('hidden');
    elements.examScreen.classList.add('hidden');
    elements.summaryScreen.classList.remove('hidden');
    
    elements.passStatus.className = 'pass-status ' + (summary.passed ? 'passed' : 'failed');
    elements.passStatus.innerHTML = `
        <h2>${summary.passed ? '✓ PASSED!' : '✗ DID NOT PASS'}</h2>
        <p>Score: ${summary.percentage}% (70% required to pass)</p>
    `;
    
    elements.statTotal.textContent = summary.total;
    elements.statCorrect.textContent = summary.correct;
    elements.statIncorrect.textContent = summary.incorrect;
    elements.statPercentage.textContent = summary.percentage + '%';
    
    refreshSummaryGrid();
}

// ==================== UI Rendering ====================
function renderSelectedCategories() {
    if (selectedCategoriesList.length > 0) {
        elements.selectedCategoriesList.innerHTML = '<ul style="margin: 0; padding-left: 20px; color: #667eea;">' +
            selectedCategoriesList.map(cat => `<li style="margin-bottom: 4px;">${cat}</li>`).join('') +
            '</ul>';
    } else {
        elements.selectedCategoriesList.innerHTML = '<span style="margin-left: 0;">All</span>';
    }
    
    elements.selectedCategoriesHeader.onclick = toggleCategories;
}

function toggleCategories() {
    categoriesExpanded = !categoriesExpanded;
    
    if (categoriesExpanded) {
        elements.selectedCategoriesList.classList.remove('categories-collapsed');
        elements.selectedCategoriesList.classList.add('categories-expanded');
        elements.categoriesToggleIcon.style.transform = 'rotate(180deg)';
    } else {
        elements.selectedCategoriesList.classList.remove('categories-expanded');
        elements.selectedCategoriesList.classList.add('categories-collapsed');
        elements.categoriesToggleIcon.style.transform = 'rotate(0deg)';
    }
}

function renderQuestion() {
    const question = examSession.getCurrentQuestion();
    const index = examSession.currentIndex;
    const total = examSession.questions.length;
    const answered = Object.keys(examSession.results).length;
    
    const progress = (answered / total) * 100;
    elements.progressFill.style.width = progress + '%';
    elements.progressText.textContent = 
        `Progress: ${answered}/${total} questions answered (${Math.round(progress)}%)`;
    
    elements.questionNumber.textContent = `Question ${index + 1} of ${total}`;
    elements.questionType.textContent = 
        question.correct_answers.length > 1 
            ? `Select ${question.correct_answers.length} answers` 
            : 'Select 1 answer';
    elements.questionText.textContent = question.question_text;
    
    elements.options.innerHTML = '';
    selectedAnswers = [];
    
    const isAnswered = examSession.answers[question.question_number] !== undefined;
    const userAnswers = isAnswered ? examSession.answers[question.question_number] : [];
    const isCorrect = examSession.results[question.question_number];
    
    question.options.forEach(opt => {
        const div = document.createElement('div');
        div.className = 'option';
        
        if (isAnswered) {
            div.classList.add('disabled');
            div.style.pointerEvents = 'none';
            
            const isSelected = userAnswers.includes(opt.letter);
            const shouldBeSelected = question.correct_answers.includes(opt.letter);
            
            if (shouldBeSelected) {
                div.classList.add('correct');
            } else if (isSelected && !shouldBeSelected) {
                div.classList.add('incorrect');
            }
            
            div.innerHTML = `
                <label class="option-content">
                    <input type="${question.correct_answers.length > 1 ? 'checkbox' : 'radio'}" 
                           ${isSelected ? 'checked' : ''} disabled>
                    <span class="option-label">${opt.letter})</span>
                    <span class="option-text">${opt.text}</span>
                </label>
            `;
        } else {
            div.onclick = () => toggleOption(opt.letter, question.correct_answers.length > 1);
            div.innerHTML = `
                <label class="option-content" onclick="event.stopPropagation();">
                    <input type="${question.correct_answers.length > 1 ? 'checkbox' : 'radio'}" 
                           name="answer" value="${opt.letter}"
                           onchange="handleOptionChange(event, '${opt.letter}', ${question.correct_answers.length > 1})">
                    <span class="option-label">${opt.letter})</span>
                    <span class="option-text">${opt.text}</span>
                </label>
            `;
        }
        
        elements.options.appendChild(div);
    });
    
    if (isAnswered) {
        elements.feedback.classList.remove('hidden');
        const resultClass = isCorrect ? 'correct' : 'incorrect';
        elements.feedback.className = 'card result-feedback ' + resultClass;
        elements.feedback.innerHTML = `
            <h3>${isCorrect ? '✓ Correct!' : '✗ Incorrect'}</h3>
            <p>Your answer: ${userAnswers.join(', ') || 'None'}</p>
            <p>Correct answer: ${question.correct_answers.join(', ')}</p>
            ${question.explanation ? `
                <div class="explanation">
                    <h4>Explanation</h4>
                    <p>${question.explanation}</p>
                </div>
            ` : ''}
            ${question.references && question.references.length ? `
                <div class="references">
                    <h4>References</h4>
                    ${question.references.map(r => `<a href="${r}" target="_blank">${r}</a>`).join('')}
                </div>
            ` : ''}
        `;
    } else {
        elements.feedback.classList.add('hidden');
    }
    
    elements.submitBtn.classList.toggle('hidden', isAnswered);
    elements.nextBtn.classList.toggle('hidden', !isAnswered || index === total - 1);
    elements.finishBtn.classList.toggle('hidden', !isAnswered || index !== total - 1);
    
    updateMarkButton();
    renderNavigator();
}

function handleOptionChange(event, letter, isMulti) {
    event.stopPropagation();
    
    const input = document.querySelector(`input[value="${letter}"]`);
    const isChecked = input ? input.checked : false;
    
    if (input) input.blur();
    
    if (!isMulti) {
        selectedAnswers = isChecked ? [letter] : [];
        document.querySelectorAll('input[name="answer"]').forEach(inp => {
            inp.checked = (inp.value === letter);
        });
    } else {
        const idx = selectedAnswers.indexOf(letter);
        if (isChecked && idx === -1) {
            selectedAnswers.push(letter);
        } else if (!isChecked && idx > -1) {
            selectedAnswers.splice(idx, 1);
        }
    }
    
    updateOptionStyles();
}

function toggleOption(letter, isMulti) {
    const input = document.querySelector(`input[value="${letter}"]`);
    if (!input) return;
    
    if (document.activeElement) document.activeElement.blur();
    
    if (!isMulti) {
        selectedAnswers = [letter];
        document.querySelectorAll('input[name="answer"]').forEach(inp => {
            inp.checked = (inp.value === letter);
        });
    } else {
        input.checked = !input.checked;
        const idx = selectedAnswers.indexOf(letter);
        if (idx > -1) {
            selectedAnswers.splice(idx, 1);
        } else {
            selectedAnswers.push(letter);
        }
    }
    
    updateOptionStyles();
}

function updateOptionStyles() {
    const options = document.querySelectorAll('.option');
    const inputs = document.querySelectorAll('input[name="answer"]');
    
    options.forEach((opt, i) => {
        const optLetter = examSession.getCurrentQuestion().options[i].letter;
        const isSelected = selectedAnswers.includes(optLetter);
        
        opt.classList.toggle('selected', isSelected);
        
        if (inputs[i]) {
            inputs[i].checked = isSelected;
        }
    });
}

function renderNavigator() {
    elements.questionGrid.innerHTML = '';
    
    examSession.questions.forEach((q, i) => {
        const result = examSession.results[q.question_number];
        const isCurrent = i === examSession.currentIndex;
        const isMarked = examSession.isMarked(q.question_number);
        
        const dot = document.createElement('div');
        let className = 'question-dot ';
        
        if (result === undefined) {
            className += 'unanswered ';
        } else if (result) {
            className += 'correct ';
        } else {
            className += 'incorrect ';
        }
        
        if (isCurrent) {
            className += 'current ';
        }
        
        dot.className = className.trim();
        dot.textContent = i + 1;
        dot.title = isMarked ? 'Marked for review' : (result === undefined ? 'Unanswered' : (result ? 'Correct' : 'Incorrect'));
        dot.onclick = () => goToQuestion(i);
        
        if (isMarked) {
            const pin = document.createElement('span');
            pin.className = 'pin-icon';
            pin.textContent = '📌';
            dot.appendChild(pin);
        }
        
        elements.questionGrid.appendChild(dot);
    });
}

function updateMarkButton() {
    if (!examSession || !elements.markBtn) return;
    
    const question = examSession.getCurrentQuestion();
    if (!question) return;
    
    const isMarked = examSession.isMarked(question.question_number);
    elements.markBtn.innerHTML = isMarked ? '📌 Unmark Question' : '📌 Mark for Review';
    elements.markBtn.style.background = isMarked ? '#ff9800' : '#f5f5f5';
    elements.markBtn.style.color = isMarked ? 'white' : '#666';
}

// ==================== Question Navigation ====================
function submitAnswer() {
    const inputs = document.querySelectorAll('input[name="answer"]:checked');
    const answers = Array.from(inputs).map(input => input.value);
    
    if (answers.length === 0) {
        alert('Please select at least one answer');
        return;
    }
    
    const question = examSession.getCurrentQuestion();
    const correctCount = question.correct_answers.length;
    
    if (correctCount > 1 && answers.length !== correctCount) {
        alert(`Please select exactly ${correctCount} answers. You selected ${answers.length}.`);
        return;
    }
    
    if (correctCount === 1 && answers.length > 1) {
        alert('This question has only one correct answer. Please select a single option.');
        return;
    }
    
    examSession.submitAnswer(answers);
    selectedAnswers = [];
    saveExamState();
    renderQuestion();
}

function nextQuestion() {
    examSession.nextQuestion();
    saveExamState();
    scrollToQuestionNumber();
    renderQuestion();
}

function prevQuestion() {
    examSession.prevQuestion();
    saveExamState();
    scrollToQuestionNumber();
    renderQuestion();
}

function goToQuestion(index) {
    examSession.goToQuestion(index);
    saveExamState();
    scrollToQuestionNumber();
    renderQuestion();
}

function scrollToQuestionNumber() {
    const questionNumber = document.querySelector('.question-number');
    if (questionNumber) {
        questionNumber.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
}

function toggleMarkQuestion() {
    if (!examSession) return;
    
    const question = examSession.getCurrentQuestion();
    if (!question) return;
    
    examSession.toggleMark(question.question_number);
    updateMarkButton();
    renderNavigator();
    saveExamState();
}

function finishExam() {
    const summary = examSession.getSummary();
    
    elements.examScreen.classList.add('hidden');
    elements.summaryScreen.classList.remove('hidden');
    
    elements.passStatus.className = 'pass-status ' + (summary.passed ? 'passed' : 'failed');
    elements.passStatus.innerHTML = `
        <h2>${summary.passed ? '✓ PASSED!' : '✗ DID NOT PASS'}</h2>
        <p>Score: ${summary.percentage}% (70% required to pass)</p>
    `;
    
    elements.statTotal.textContent = summary.total;
    elements.statCorrect.textContent = summary.correct;
    elements.statIncorrect.textContent = summary.incorrect;
    elements.statPercentage.textContent = summary.percentage + '%';
    
    refreshSummaryGrid();
}

// ==================== Summary Review ====================
function showReviewDetail(q, result, userAnswer, displayNumber) {
    elements.reviewDetails.innerHTML = '';
    
    window.currentReviewIndex = displayNumber - 1;
    refreshSummaryGrid();
    
    const isMarked = examSession.isMarked(q.question_number);
    
    window.currentReviewQuestionNumber = q.question_number;
    window.currentReviewDisplayNumber = displayNumber;
    
    updateSummaryMarkButton(isMarked);
    
    const optionsHtml = q.options.map(opt => {
        const isCorrect = q.correct_answers.includes(opt.letter);
        const isSelected = (userAnswer || []).includes(opt.letter);
        let optionClass = 'option';
        let icon = '';
        
        if (isCorrect) {
            optionClass += ' correct';
            icon = ' ✓';
        } else if (isSelected && !isCorrect) {
            optionClass += ' incorrect';
            icon = ' ✗';
        }
        
        return `<div class="${optionClass} disabled" style="pointer-events: none; margin-bottom: 12px;">
            <label class="option-content">
                <input type="${q.correct_answers.length > 1 ? 'checkbox' : 'radio'}" 
                       ${isSelected ? 'checked' : ''} disabled>
                <span class="option-label">${opt.letter})</span>
                <span class="option-text">${opt.text}${icon}</span>
            </label>
        </div>`;
    }).join('');
    
    const div = document.createElement('div');
    div.id = `review-${displayNumber}`;
    div.className = 'card';
    div.style.marginTop = '20px';
    div.innerHTML = `
        <div style="margin-bottom: 15px;">
            <h3 style="margin: 0;">Question ${displayNumber}</h3>
        </div>
        <p style="margin: 15px 0; white-space: pre-wrap;">${q.question_text}</p>
        <div style="margin: 20px 0;">
            ${optionsHtml}
        </div>
        <p><strong>Your answer:</strong> ${(userAnswer || []).join(', ') || 'None'}</p>
        <p><strong>Correct answer:</strong> ${q.correct_answers.join(', ')}</p>
        <p style="color: ${result ? '#4caf50' : '#f44336'}; font-weight: 600; margin-top: 10px;">
            ${result ? '✓ Correct' : '✗ Incorrect'}
        </p>
        ${q.explanation ? `<div class="explanation"><h4>Explanation</h4><p>${q.explanation}</p></div>` : ''}
        ${q.references && q.references.length ? `
            <div class="references">
                <h4>References</h4>
                ${q.references.map(r => `<a href="${r}" target="_blank">${r}</a>`).join('')}
            </div>
        ` : ''}
    `;
    elements.reviewDetails.appendChild(div);
}

function updateSummaryMarkButton(isMarked) {
    if (elements.summaryMarkBtn) {
        elements.summaryMarkBtn.innerHTML = isMarked ? '📌 Unmark Question' : '📌 Mark for Review';
        elements.summaryMarkBtn.style.background = isMarked ? '#ff9800' : '#f5f5f5';
        elements.summaryMarkBtn.style.color = isMarked ? 'white' : '#666';
    }
}

function toggleMarkFromSummaryButton() {
    if (!examSession || !window.currentReviewQuestionNumber) return;
    
    const isMarked = examSession.toggleMark(window.currentReviewQuestionNumber);
    
    updateSummaryMarkButton(isMarked);
    refreshSummaryGrid();
    saveExamState();
}

function refreshSummaryGrid() {
    if (!elements.summaryGrid || !examSession) return;
    
    elements.summaryGrid.innerHTML = '';
    examSession.questions.forEach((q, i) => {
        const result = examSession.results[q.question_number];
        const isMarked = examSession.isMarked(q.question_number);
        const isCurrent = window.currentReviewIndex === i;
        const dot = document.createElement('div');
        let className = 'question-dot ' + (result === undefined ? 'unanswered' : (result ? 'correct' : 'incorrect'));
        if (isCurrent) {
            className += ' current';
        }
        dot.className = className;
        dot.textContent = i + 1;
        dot.title = isMarked ? 'Marked for review' : (result === undefined ? 'Unanswered' : (result ? 'Correct' : 'Incorrect'));
        dot.onclick = ((idx) => () => {
            const question = examSession.questions[idx];
            const res = examSession.results[question.question_number];
            showReviewDetail(question, res, examSession.answers[question.question_number], idx + 1);
        })(i);
        
        if (isMarked) {
            const pin = document.createElement('span');
            pin.className = 'pin-icon';
            pin.textContent = '📌';
            dot.appendChild(pin);
        }
        
        elements.summaryGrid.appendChild(dot);
    });
}

// Global assignments for inline handlers
window.startNewFromPrompt = startNewFromPrompt;
window.viewSummary = viewSummary;
window.resumeExam = resumeExam;
