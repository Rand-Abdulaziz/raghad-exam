// Application State
let examData = null;
const state = {
    currentScreen: 'start', // 'start', 'exam', 'results'
    currentQuestionIndex: 0,
    userAnswers: [], // Array of objects: { answer: string, isCorrect: boolean }
    score: 0,
    timeLeft: 2 * 60 * 60, // 2 hours in seconds
    timerInterval: null,
    hasAnsweredCurrent: false // To track if the user has answered the current question
};

// DOM Elements
const appDiv = document.getElementById('app');

// App Initialization
async function initApp() {
    try {
        const response = await fetch('exam.json');
        if (!response.ok) {
            throw new Error(`Failed to load exam.json: ${response.status}`);
        }
        examData = await response.json();
        
        // Initialize user answers array
        state.userAnswers = new Array(examData.questions.length).fill(null);
        
        render();
    } catch (error) {
        console.error('Error loading exam data (likely CORS due to running statically):', error);
        
        // Provide a fallback local-file uploader (FileReader) bypasses CORS.
        appDiv.innerHTML = `
            <div class="start-screen" style="max-width: 500px; text-align: center;">
                <h2>Local Verification Required</h2>
                <p class="text-secondary mt-4 mb-6" style="line-height: 1.5;">
                    Browser security prevents automatically loading local JSON files. 
                    Please manually select the <strong>exam.json</strong> file from your folder to continue.
                </p>
                
                <input type="file" id="local-file-upload" accept=".json" style="display: none;" />
                <label for="local-file-upload" class="btn-primary" style="cursor: pointer; display: inline-block;">
                    Select exam.json
                </label>
            </div>
        `;
        
        const fileInput = document.getElementById('local-file-upload');
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    examData = JSON.parse(e.target.result);
                    state.userAnswers = new Array(examData.questions.length).fill(null);
                    render();
                } catch (parseError) {
                    alert('Invalid JSON file selected. Please make sure it is the correct exam.json.');
                }
            };
            reader.readAsText(file);
        });
    }
}

// Rendering Logic
function render() {
    if (!examData) return;

    appDiv.innerHTML = '';
    
    appDiv.classList.remove('animate-fade-in');
    void appDiv.offsetWidth; 
    appDiv.classList.add('animate-fade-in');

    if (state.currentScreen === 'start') {
        renderStartScreen();
    } else if (state.currentScreen === 'exam') {
        renderExamScreen();
    } else if (state.currentScreen === 'results') {
        renderResultsScreen();
    }
}

// --- Start Screen ---
function renderStartScreen() {
    const container = document.createElement('div');
    container.className = 'start-screen';

    container.innerHTML = `
        <h1>${examData.exam_title || 'Mock Exam'}</h1>
        <p class="text-secondary text-center mt-4 mb-6">
            Welcome to your mock exam. There are ${examData.questions.length} questions in total.<br/>
            You must answer each question to reveal the correct answer and proceed.
        </p>
        <button class="btn-primary" id="start-btn">Start Exam &rarr;</button>
    `;

    appDiv.appendChild(container);
    document.getElementById('start-btn').addEventListener('click', startExam);
}

// --- Exam Screen ---
function renderExamScreen() {
    const question = examData.questions[state.currentQuestionIndex];
    const isAnswered = state.hasAnsweredCurrent;
    const userAnswerData = state.userAnswers[state.currentQuestionIndex];

    const container = document.createElement('div');
    
    const header = document.createElement('div');
    header.className = 'exam-header';
    header.innerHTML = `
        <div class="progress-text">
            Question ${state.currentQuestionIndex + 1} of ${examData.questions.length}
        </div>
        <div class="timer" id="timer-display">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>${formatTime(state.timeLeft)}</span>
        </div>
    `;
    container.appendChild(header);

    const qContent = document.createElement('div');
    qContent.innerHTML = `
        <h2 class="mb-6">${question.prompt || question.question}</h2>
        <div class="options-grid" id="options-container"></div>
    `;
    container.appendChild(qContent);

    const footer = document.createElement('div');
    footer.className = 'mt-6';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    
    // Add "End Exam" Button
    const endExamBtn = document.createElement('button');
    endExamBtn.className = 'btn-primary';
    endExamBtn.style.background = 'var(--danger-color)';
    endExamBtn.textContent = 'End Exam';
    endExamBtn.onclick = finishExam;
    footer.appendChild(endExamBtn);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn-primary';
    nextBtn.style.display = isAnswered ? 'block' : 'none'; // Only show when answered
    
    if (state.currentQuestionIndex < examData.questions.length - 1) {
        nextBtn.textContent = 'Next Question &rarr;';
        nextBtn.onclick = () => {
            state.currentQuestionIndex++;
            state.hasAnsweredCurrent = state.userAnswers[state.currentQuestionIndex] !== null;
            render();
        };
    } else {
        nextBtn.textContent = 'Finish Exam';
        nextBtn.style.background = 'var(--success-color)';
        nextBtn.onclick = finishExam;
    }
    footer.appendChild(nextBtn);

    container.appendChild(footer);
    appDiv.appendChild(container);

    const optionsContainer = document.getElementById('options-container');

    // Display options or text input
    if (question.options && question.options.length > 0) {
        // Multiple Choice
        question.options.forEach((opt, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            
            if (isAnswered) {
                btn.disabled = true;
                
                if (opt === question.answer || opt === question.correct_answer) {
                    btn.classList.add('correct');
                } else if (userAnswerData && opt === userAnswerData.answer && !userAnswerData.isCorrect) {
                    btn.classList.add('incorrect');
                } else if (userAnswerData && opt === userAnswerData.answer) {
                    btn.classList.add('correct');
                }
            }

            const letter = String.fromCharCode(65 + index);
            btn.innerHTML = `
                <span class="option-letter" style="${opt === question.answer || opt === question.correct_answer && isAnswered ? 'color: var(--text-primary);' : ''}">
                    ${letter}.
                </span>
                <span>${opt}</span>
            `;
            
            btn.onclick = () => handleAnswerSelect(opt, question);
            optionsContainer.appendChild(btn);
        });
    } else {
        // Text Question
        const inputDiv = document.createElement('div');
        inputDiv.style.display = 'flex';
        inputDiv.style.flexDirection = 'column';
        inputDiv.style.gap = '10px';

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'text-input';
        textInput.placeholder = 'Type your answer here...';
        
        if (isAnswered) {
            textInput.disabled = true;
            textInput.value = userAnswerData ? userAnswerData.answer : '';
            
            if (userAnswerData && userAnswerData.isCorrect) {
                textInput.classList.add('correct-input');
            } else {
                textInput.classList.add('incorrect-input');
            }
        }
        
        inputDiv.appendChild(textInput);

        if (!isAnswered) {
            const submitBtn = document.createElement('button');
            submitBtn.className = 'btn-primary';
            submitBtn.style.width = 'fit-content';
            submitBtn.textContent = 'Submit Answer';
            submitBtn.onclick = () => {
                if (textInput.value.trim() !== '') {
                    handleAnswerSelect(textInput.value.trim(), question);
                }
            };
            inputDiv.appendChild(submitBtn);
            
            // Allow pressing Enter
            textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && textInput.value.trim() !== '') {
                    handleAnswerSelect(textInput.value.trim(), question);
                }
            });
        }

        optionsContainer.appendChild(inputDiv);
    }
    
    // Feedback Message
    if (isAnswered) {
        const feedback = document.createElement('div');
        feedback.className = 'feedback-message fade-in';
        
        const correctAnswer = question.answer || question.correct_answer || 'No specific answer provided';
        
        if (userAnswerData && userAnswerData.isCorrect) {
            feedback.innerHTML = `<span style="color: var(--success-color); font-weight: bold;">✓ Correct!</span>`;
        } else {
            feedback.innerHTML = `
                <span style="color: var(--danger-color); font-weight: bold;">✗ Incorrect.</span><br/>
                <span style="color: var(--text-secondary); font-size: 0.95rem; display: inline-block; margin-top: 5px;">
                    Correct Answer: <strong style="color: var(--success-color);">${correctAnswer}</strong>
                </span>
            `;
        }
        optionsContainer.appendChild(feedback);
    }
}

// --- Results Screen ---
function renderResultsScreen() {
    let answeredQuestions = 0;
    let correctCount = 0;
    
    state.userAnswers.forEach(ans => {
        if (ans !== null) {
            answeredQuestions++;
            if (ans.isCorrect) correctCount++;
        }
    });

    const percentage = answeredQuestions > 0 ? Math.round((correctCount / answeredQuestions) * 100) : 0;
    
    const container = document.createElement('div');
    container.className = 'results-screen';

    container.innerHTML = `
        <h1 style="font-size: 2rem;">Exam Completed!</h1>
        <div class="score-display">${percentage}%</div>
        <p class="text-secondary" style="margin-top: -1.5rem; margin-bottom: 2rem;">(Based on ${answeredQuestions} answered questions)</p>
        
        <div class="score-details" style="flex-wrap: wrap;">
            <div class="stat-box">
                <div class="stat-value">${answeredQuestions} / ${examData.questions.length}</div>
                <div class="stat-label">Answered</div>
            </div>
            <div class="stat-box">
                <div class="stat-value" style="color: var(--success-color)">${correctCount}</div>
                <div class="stat-label">Correct</div>
            </div>
            <div class="stat-box">
                <div class="stat-value" style="color: var(--danger-color)">${answeredQuestions - correctCount}</div>
                <div class="stat-label">Incorrect</div>
            </div>
        </div>

        <button class="btn-primary mt-4 mb-6" id="restart-btn">Take Exam Again</button>
    `;

    appDiv.appendChild(container);

    document.getElementById('restart-btn').addEventListener('click', () => {
        state.currentScreen = 'start';
        state.currentQuestionIndex = 0;
        state.userAnswers = new Array(examData.questions.length).fill(null);
        state.hasAnsweredCurrent = false;
        state.score = 0;
        state.timeLeft = 2 * 60 * 60;
        render();
    });
}

// --- Interaction Logic ---
function startExam() {
    state.currentScreen = 'exam';
    startTimer();
    render();
}

function handleAnswerSelect(selectedAnswer, questionObj) {
    const correctAnswer = questionObj.answer || questionObj.correct_answer;
    let isCorrect = false;

    if (correctAnswer) {
        // Simple string comparison (case-insensitive for text questions, exact for mcq usually)
        isCorrect = selectedAnswer.toString().toLowerCase().trim() === correctAnswer.toString().toLowerCase().trim();
    } else {
        // If there's no answer key, we might count it as correct or incorrect. Let's assume text questions without answers are just marked correct for participation
        isCorrect = true;     
    }

    state.userAnswers[state.currentQuestionIndex] = {
        answer: selectedAnswer,
        isCorrect: isCorrect
    };
    
    state.hasAnsweredCurrent = true;
    render(); 
}

function finishExam() {
    stopTimer();
    state.currentScreen = 'results';
    render();
}

// --- Timer Logic ---
function startTimer() {
    state.timerInterval = setInterval(() => {
        state.timeLeft--;
        
        const timerDisplay = document.querySelector('#timer-display span');
        if (timerDisplay) {
            timerDisplay.textContent = formatTime(state.timeLeft);
        }

        if (state.timeLeft <= 0) {
            finishExam();
        }
    }, 1000);
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
}

function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Run the app wrapper
window.addEventListener('DOMContentLoaded', initApp);
