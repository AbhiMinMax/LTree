class LifePredictionApp {
    constructor() {
        this.currentScreen = 'age-input';
        this.currentQuestionIndex = 0;
        this.choiceHistory = [];
        this.questions = this.initializeQuestions();
        this.db = null;
        this.userDOB = null;
        this.userDiseases = [];
        this.lifeExpectancies = null;
        this.countdownInterval = null;
        this.lastMinute = null;
        this.lastSecond = null;
        this.currentMinuteBoxes = 0;
        this.currentSecondBoxes = 0;
        this.boxesPerRow = 5;
        this.totalMinutes = 0;
        this.totalSeconds = 0;
        this.content = null;
        
        this.loadContent().then(() => {
            this.initDatabase().then(async () => {
                await this.loadChoiceHistory();
                await this.loadLifeParameters();
                this.init();
                this.updateUIWithContent();
            });
        });
    }

    async loadContent() {
        try {
            const response = await fetch('content.json');
            this.content = await response.json();
        } catch (error) {
            console.error('Failed to load content.json, using fallback text:', error);
            this.content = {
                app: {
                    title: "Life Prediction App",
                    subtitle: "Predict your trajectory based on choices within your control"
                }
            };
        }
    }

    updateUIWithContent() {
        if (!this.content) return;
        
        // Update app title and subtitle in header
        const titleElement = document.querySelector('header h1');
        if (titleElement && this.content.app?.title) {
            titleElement.textContent = this.content.app.title;
        }
        
        const subtitleElement = document.querySelector('header p');
        if (subtitleElement && this.content.app?.subtitle) {
            subtitleElement.textContent = this.content.app.subtitle;
        }
    }

    async initDatabase() {
        return new Promise((resolve) => {
            try {
                // Try to open existing database first
                const request = indexedDB.open('LifePredictionDB', 2);
                
                request.onerror = () => {
                    console.error('Database failed to open:', request.error);
                    this.db = null;
                    resolve();
                };
                
                request.onsuccess = () => {
                    this.db = request.result;
                    console.log('Database opened successfully');
                    
                    // Verify object stores exist
                    if (!this.db.objectStoreNames.contains('choices') || 
                        !this.db.objectStoreNames.contains('lifeParameters')) {
                        console.error('Object stores not found, disabling database');
                        this.db = null;
                    }
                    
                    resolve();
                };
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    try {
                        // Create stores if they don't exist
                        if (!db.objectStoreNames.contains('choices')) {
                            const choicesStore = db.createObjectStore('choices', { keyPath: 'id', autoIncrement: true });
                            choicesStore.createIndex('timestamp', 'timestamp', { unique: false });
                            choicesStore.createIndex('category', 'category', { unique: false });
                        }
                        
                        if (!db.objectStoreNames.contains('lifeParameters')) {
                            const paramStore = db.createObjectStore('lifeParameters', { keyPath: 'id' });
                        }
                        
                        console.log('Database schema created successfully');
                    } catch (error) {
                        console.error('Error creating database schema:', error);
                        this.db = null;
                    }
                };
                
            } catch (error) {
                console.error('Failed to initialize database:', error);
                this.db = null;
                resolve();
            }
        });
    }

    init() {
        this.bindEvents();
        console.log('Init called with:', {
            userDOB: this.userDOB,
            userDiseases: this.userDiseases,
            lifeExpectancies: this.lifeExpectancies
        });
        
        if (this.userDOB && this.userDiseases !== null && this.lifeExpectancies) {
            console.log('Going to intro screen');
            this.showScreen('intro');
            this.startCountdown();
        } else {
            console.log('Going to age-input screen');
            this.showScreen('age-input');
            this.setMaxDate();
        }
    }

    bindEvents() {
        document.getElementById('set-parameters-btn').addEventListener('click', () => {
            this.setLifeParameters();
        });

        // Handle "None" checkbox exclusivity
        document.getElementById('none-condition').addEventListener('change', (e) => {
            this.handleNoneConditionChange(e.target.checked);
        });

        // Handle other checkboxes to uncheck "None" when selected
        const otherCheckboxes = document.querySelectorAll('#health-conditions input[type="checkbox"]:not(#none-condition)');
        otherCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    document.getElementById('none-condition').checked = false;
                }
            });
        });

        document.getElementById('start-btn').addEventListener('click', () => {
            this.startAssessment();
        });
        
        document.getElementById('continue-btn').addEventListener('click', () => {
            this.startAssessment();
        });
        
        document.getElementById('complete-assessment-btn').addEventListener('click', () => {
            this.showPrediction();
        });
        
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetHistory();
        });

        document.getElementById('export-json-btn').addEventListener('click', () => {
            this.exportData('json');
        });

        document.getElementById('export-csv-btn').addEventListener('click', () => {
            this.exportData('csv');
        });

        document.getElementById('import-btn').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });

        document.getElementById('import-file').addEventListener('change', (event) => {
            this.importData(event.target.files[0]);
        });

        // Configuration and navigation events
        document.getElementById('config-btn').addEventListener('click', () => {
            this.showConfigurationPage();
        });

        document.getElementById('direct-predictions-btn').addEventListener('click', () => {
            this.showDirectPredictions();
        });

        document.getElementById('back-to-predictions-btn').addEventListener('click', () => {
            this.showScreen('prediction');
        });

        document.getElementById('back-to-main-btn').addEventListener('click', () => {
            this.showScreen('intro');
        });

        document.getElementById('new-assessment-btn').addEventListener('click', () => {
            this.startAssessment();
        });

        document.getElementById('update-parameters-btn').addEventListener('click', () => {
            this.updateConfigurationParameters();
        });

        // Configuration checkboxes
        document.getElementById('show-global-clock').addEventListener('change', (e) => {
            this.toggleGlobalClock(e.target.checked);
        });

        document.getElementById('show-minute-boxes').addEventListener('change', (e) => {
            this.toggleMinuteBoxes(e.target.checked);
        });

        document.getElementById('show-second-boxes').addEventListener('change', (e) => {
            this.toggleSecondBoxes(e.target.checked);
        });

        document.getElementById('show-scenario-clocks').addEventListener('change', (e) => {
            this.toggleScenarioClocks(e.target.checked);
        });

        // Additional navigation buttons from intro screen
        document.getElementById('intro-config-btn').addEventListener('click', () => {
            this.showConfigurationPage();
        });

        document.getElementById('intro-direct-predictions-btn').addEventListener('click', () => {
            this.showDirectPredictions();
        });

        document.getElementById('config-back-to-intro-btn').addEventListener('click', () => {
            this.showScreen('intro');
        });
    }

    handleNoneConditionChange(isChecked) {
        if (isChecked) {
            // Uncheck all other conditions when "None" is selected
            const otherCheckboxes = document.querySelectorAll('#health-conditions input[type="checkbox"]:not(#none-condition)');
            otherCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
        }
    }

    setMaxDate() {
        const dobInput = document.getElementById('dob-input-field');
        if (dobInput) {
            const today = new Date();
            const maxDate = today.toISOString().split('T')[0];
            dobInput.max = maxDate;
        }
    }

    async setLifeParameters() {
        const dobInput = document.getElementById('dob-input-field');
        const healthCheckboxes = document.querySelectorAll('#health-conditions input[type="checkbox"]:checked');
        
        const dobValue = dobInput.value;
        const selectedDiseases = Array.from(healthCheckboxes).map(cb => cb.value);
        
        if (!dobValue) {
            alert('Please select your date of birth');
            return;
        }
        
        if (selectedDiseases.length === 0) {
            alert('Please select at least one health condition (including "None/Healthy" if applicable)');
            return;
        }
        
        const dob = new Date(dobValue);
        const today = new Date();
        
        if (dob > today) {
            alert('Date of birth cannot be in the future');
            return;
        }
        
        const age = this.calculateAge(dob);
        if (age < 1 || age > 120) {
            alert('Age must be between 1 and 120 years');
            return;
        }
        
        this.userDOB = dobValue;
        this.userDiseases = selectedDiseases;
        this.lifeExpectancies = this.calculateLifeExpectancy(age, selectedDiseases);
        
        await this.saveLifeParameters();
        this.showScreen('intro');
        this.startCountdown();
    }

    calculateAge(birthDate) {
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }

    calculateLifeExpectancy(age, diseases) {
        // Base life expectancy (global average)
        let baseExpectancy = 73;
        
        // Disease impact on life expectancy (years reduced)
        const diseaseImpact = {
            none: 0,
            diabetes: -6,
            heart_disease: -8,
            cancer: -10,
            hypertension: -4,
            obesity: -5,
            smoking: -10,
            mental_health: -7,
            other: -5
        };
        
        // Calculate cumulative impact of all diseases
        let totalImpact = 0;
        
        if (diseases.includes('none')) {
            totalImpact = 0;
        } else {
            // Apply individual disease impacts
            diseases.forEach(disease => {
                totalImpact += diseaseImpact[disease] || 0;
            });
            
            // Apply diminishing returns for multiple conditions
            if (diseases.length > 1) {
                totalImpact = totalImpact * (1 - (diseases.length - 1) * 0.1);
            }
        }0
        
        // Calculate realistic expectation
        const realisticAge = Math.max(age + 1, baseExpectancy + totalImpact);
        
        // Calculate optimistic scenario (5-10 years longer)
        const optimisticAge = realisticAge + (diseases.includes('none') ? 10 : 7);
        
        // Calculate pessimistic scenario (3-8 years shorter)
        const pessimisticAge = Math.max(age + 1, realisticAge - (diseases.includes('none') ? 3 : 6));
        
        return {
            optimistic: optimisticAge,
            realistic: realisticAge,
            pessimistic: pessimisticAge
        };
    }

    startCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        this.updateCountdownDisplay();
        this.countdownInterval = setInterval(() => {
            this.updateCountdownDisplay();
        }, 1000);
    }

    updateCountdownDisplay() {
        if (!this.userDOB || !this.lifeExpectancies) return;
        
        const now = new Date();
        const birthDate = new Date(this.userDOB);
        
        // Calculate choice impact
        const currentScores = this.calculateScores();
        const avgAbstract = Object.values(currentScores.abstract).length > 0 
            ? Object.values(currentScores.abstract).reduce((sum, score) => sum + score, 0) / Object.values(currentScores.abstract).length 
            : 50;
        
        // Better choices can extend life by up to 3 years, poor choices reduce by up to 2 years
        const choiceImpactDays = ((avgAbstract - 50) / 50) * 1095; // days
        
        // Calculate and display the main total countdown (realistic scenario)
        const realisticLifeExpectancy = this.lifeExpectancies.realistic;
        const realisticDeathDate = new Date(birthDate);
        realisticDeathDate.setFullYear(birthDate.getFullYear() + realisticLifeExpectancy);
        
        const realisticAdjustedDeathDate = new Date(realisticDeathDate.getTime() + (choiceImpactDays * 24 * 60 * 60 * 1000));
        const realisticTimeDiff = realisticAdjustedDeathDate.getTime() - now.getTime();
        
        if (realisticTimeDiff <= 0) {
            this.displayTotalCountdown(0, 0, 0, 0);
            this.updateGlobalClock(0, 0, 0, 0);
            this.manageTimeBoxes(0, 0);
        } else {
            // Calculate absolute totals for each time unit
            const absoluteDays = Math.floor(realisticTimeDiff / (1000 * 60 * 60 * 24));
            const absoluteHours = Math.floor(realisticTimeDiff / (1000 * 60 * 60));
            const absoluteMinutes = Math.floor(realisticTimeDiff / (1000 * 60));
            const absoluteSeconds = Math.floor(realisticTimeDiff / 1000);
            
            // Calculate traditional breakdown for global clock
            const days = Math.floor(realisticTimeDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((realisticTimeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((realisticTimeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((realisticTimeDiff % (1000 * 60)) / 1000);
            
            this.displayTotalCountdown(absoluteDays, absoluteHours, absoluteMinutes, absoluteSeconds);
            this.updateGlobalClock(days, hours, minutes, seconds);
            this.manageTimeBoxes(absoluteMinutes, absoluteSeconds);
        }
        
        // Calculate all three scenarios for breakdown
        ['optimistic', 'realistic', 'pessimistic'].forEach(scenario => {
            const lifeExpectancy = this.lifeExpectancies[scenario];
            const deathDate = new Date(birthDate);
            deathDate.setFullYear(birthDate.getFullYear() + lifeExpectancy);
            
            // Apply choice impact (more conservative for pessimistic, more generous for optimistic)
            let adjustedChoiceImpact = choiceImpactDays;
            if (scenario === 'pessimistic') {
                adjustedChoiceImpact *= 0.5; // Choices have less positive impact in pessimistic scenario
            } else if (scenario === 'optimistic') {
                adjustedChoiceImpact *= 1.5; // Choices have more positive impact in optimistic scenario
            }
            
            const adjustedDeathDate = new Date(deathDate.getTime() + (adjustedChoiceImpact * 24 * 60 * 60 * 1000));
            const timeDiff = adjustedDeathDate.getTime() - now.getTime();
            
            if (timeDiff <= 0) {
                this.displayCountdownForScenario(scenario, 0, 0, 0, 0);
                return;
            }
            
            const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
            
            this.displayCountdownForScenario(scenario, days, hours, minutes, seconds);
        });
    }

    displayCountdownForScenario(scenario, days, hours, minutes, seconds) {
        const countdownDisplay = document.getElementById(`countdown-${scenario}`);
        if (!countdownDisplay) return;
        
        countdownDisplay.innerHTML = `
            <div class="countdown-unit">
                <span class="countdown-number">${days.toLocaleString()}</span>
                <span class="countdown-label">Days</span>
            </div>
            <div class="countdown-unit">
                <span class="countdown-number">${hours.toString().padStart(2, '0')}</span>
                <span class="countdown-label">Hours</span>
            </div>
            <div class="countdown-unit">
                <span class="countdown-number">${minutes.toString().padStart(2, '0')}</span>
                <span class="countdown-label">Minutes</span>
            </div>
            <div class="countdown-unit">
                <span class="countdown-number">${seconds.toString().padStart(2, '0')}</span>
                <span class="countdown-label">Seconds</span>
            </div>
        `;
    }
    
    displayTotalCountdown(totalDays, totalHours, totalMinutes, totalSeconds) {
        const countdownDisplay = document.getElementById('countdown-total');
        if (!countdownDisplay) return;
        
        countdownDisplay.innerHTML = `
            <div class="countdown-unit">
                <span class="countdown-number">${totalDays.toLocaleString()}</span>
                <span class="countdown-label">Total Days</span>
            </div>
            <div class="countdown-unit">
                <span class="countdown-number">${totalHours.toLocaleString()}</span>
                <span class="countdown-label">Total Hours</span>
            </div>
            <div class="countdown-unit">
                <span class="countdown-number">${totalMinutes.toLocaleString()}</span>
                <span class="countdown-label">Total Minutes</span>
            </div>
            <div class="countdown-unit">
                <span class="countdown-number">${totalSeconds.toLocaleString()}</span>
                <span class="countdown-label">Total Seconds</span>
            </div>
        `;
    }
    
    updateGlobalClock(days, hours, minutes, seconds) {
        const globalClock = document.getElementById('global-life-clock');
        if (this.userDOB && this.lifeExpectancies) {
            globalClock.style.display = 'block';
            
            document.getElementById('global-days').textContent = days.toLocaleString();
            document.getElementById('global-hours').textContent = hours.toString().padStart(2, '0');
            document.getElementById('global-minutes').textContent = minutes.toString().padStart(2, '0');
            document.getElementById('global-seconds').textContent = seconds.toString().padStart(2, '0');
        } else {
            globalClock.style.display = 'none';
        }
    }
    
    manageTimeBoxes(minutes, seconds) {
        // Check if a minute has passed (for animation) - target specific number
        if (this.lastMinute !== null && this.lastMinute !== minutes && this.lastMinute > minutes) {
            this.popSpecificMinute(this.lastMinute);
        }
        
        // Check if a second has passed (for animation) - target specific number
        if (this.lastSecond !== null && this.lastSecond !== seconds && this.lastSecond > seconds) {
            this.popSpecificSecond(this.lastSecond);
        }
        
        // Update total counts and refresh boxes
        this.totalMinutes = minutes;
        this.totalSeconds = seconds;
        this.updateTimeBoxes();
        
        this.lastMinute = minutes;
        this.lastSecond = seconds;
    }
    
    updateTimeBoxes() {
        this.updateMinuteBoxes();
        this.updateSecondBoxes();
    }
    
    updateMinuteBoxes() {
        const container = document.getElementById('minute-boxes');
        
        // Calculate maximum boxes that can fit in the grid area
        const containerRect = container.getBoundingClientRect();
        const containerHeight = containerRect.height - 24; // Account for padding
        const containerWidth = containerRect.width - 24; // Account for padding
        const boxSize = 32; // 28px + 4px gap
        const boxesPerRow = Math.floor(containerWidth / boxSize);
        const maxRows = Math.floor(containerHeight / boxSize);
        const maxBoxes = boxesPerRow * maxRows;
        
        // Limit to 1000 boxes maximum for performance
        const performanceLimit = 1000;
        const effectiveMaxBoxes = Math.min(maxBoxes, performanceLimit);
        
        // Show as many boxes as possible up to the total minutes available
        const boxesNeeded = Math.min(this.totalMinutes, effectiveMaxBoxes);
        
        // Only recreate if count changed significantly to avoid constant rebuilding
        const currentBoxes = container.children.length;
        if (Math.abs(currentBoxes - boxesNeeded) > 1) {
            container.innerHTML = '';
            
            for (let i = 0; i < boxesNeeded; i++) {
                const box = document.createElement('div');
                box.className = 'time-box minute-box';
                const number = this.totalMinutes - i;
                box.textContent = number;
                box.dataset.number = number;
                container.appendChild(box);
            }
        }
        
        this.currentMinuteBoxes = boxesNeeded;
    }
    
    updateSecondBoxes() {
        const container = document.getElementById('second-boxes');
        
        // Calculate maximum boxes that can fit in the grid area
        const containerRect = container.getBoundingClientRect();
        const containerHeight = containerRect.height - 24; // Account for padding
        const containerWidth = containerRect.width - 24; // Account for padding
        const boxSize = 32; // 28px + 4px gap
        const boxesPerRow = Math.floor(containerWidth / boxSize);
        const maxRows = Math.floor(containerHeight / boxSize);
        const maxBoxes = boxesPerRow * maxRows;
        
        // Limit to 1000 boxes maximum for performance
        const performanceLimit = 1000;
        const effectiveMaxBoxes = Math.min(maxBoxes, performanceLimit);
        
        // Show as many boxes as possible up to the total seconds available
        const boxesNeeded = Math.min(this.totalSeconds, effectiveMaxBoxes);
        
        // Only recreate if count changed significantly to avoid constant rebuilding
        const currentBoxes = container.children.length;
        if (Math.abs(currentBoxes - boxesNeeded) > 1) {
            container.innerHTML = '';
            
            for (let i = 0; i < boxesNeeded; i++) {
                const box = document.createElement('div');
                box.className = 'time-box second-box';
                const number = this.totalSeconds - i;
                box.textContent = number;
                box.dataset.number = number;
                container.appendChild(box);
            }
        }
        
        this.currentSecondBoxes = boxesNeeded;
    }
    
    popSpecificMinute(minuteNumber) {
        const container = document.getElementById('minute-boxes');
        const targetBox = container.querySelector(`.minute-box[data-number="${minuteNumber}"]`);
        
        if (targetBox) {
            targetBox.classList.add('popping');
            
            // Remove the box after animation completes
            setTimeout(() => {
                if (targetBox.parentNode) {
                    targetBox.remove();
                }
            }, 1200);
        }
    }
    
    popSpecificSecond(secondNumber) {
        const container = document.getElementById('second-boxes');
        const targetBox = container.querySelector(`.second-box[data-number="${secondNumber}"]`);
        
        if (targetBox) {
            targetBox.classList.add('popping');
            
            // Remove the box after animation completes
            setTimeout(() => {
                if (targetBox.parentNode) {
                    targetBox.remove();
                }
            }, 1200);
        }
    }
    
    
    displayCountdown(days, hours, minutes, seconds) {
        // Legacy method - redirect to realistic scenario for backward compatibility
        this.displayCountdownForScenario('realistic', days, hours, minutes, seconds);
    }

    async saveLifeParameters() {
        if (!this.db) {
            console.warn('Database not initialized, life parameters not saved');
            return;
        }
        
        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction(['lifeParameters'], 'readwrite');
                const store = transaction.objectStore('lifeParameters');
                const data = {
                    id: 'user',
                    dob: this.userDOB,
                    diseases: this.userDiseases,
                    lifeExpectancies: this.lifeExpectancies,
                    timestamp: new Date().toISOString()
                };
                const request = store.put(data);
                
                request.onsuccess = () => resolve();
                request.onerror = () => {
                    console.error('Error saving life parameters:', request.error);
                    resolve(); // Don't throw, just log and continue
                };
                
                transaction.onerror = () => {
                    console.error('Transaction error saving life parameters:', transaction.error);
                    resolve(); // Don't throw, just log and continue
                };
            } catch (error) {
                console.error('Database transaction failed while saving life parameters:', error);
                resolve(); // Don't throw, just log and continue
            }
        });
    }

    async loadLifeParameters() {
        if (!this.db) {
            console.warn('Database not initialized, using default life parameters');
            return;
        }
        
        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction(['lifeParameters'], 'readonly');
                const store = transaction.objectStore('lifeParameters');
                const request = store.get('user');
                
                request.onsuccess = () => {
                    const result = request.result;
                    if (result) {
                        this.userDOB = result.dob;
                        this.userDiseases = result.diseases || [];
                        
                        // Handle backward compatibility for old single lifeExpectancy format
                        if (result.lifeExpectancies) {
                            this.lifeExpectancies = result.lifeExpectancies;
                        } else if (result.lifeExpectancy) {
                            // Convert old format to new format
                            const oldExpectancy = result.lifeExpectancy;
                            this.lifeExpectancies = {
                                optimistic: oldExpectancy + 7,
                                realistic: oldExpectancy,
                                pessimistic: Math.max(this.calculateAge(new Date(this.userDOB)) + 1, oldExpectancy - 5)
                            };
                        }
                        
                        console.log('Loaded life parameters:', {
                            dob: this.userDOB,
                            diseases: this.userDiseases,
                            lifeExpectancies: this.lifeExpectancies
                        });
                    }
                    resolve();
                };
                
                request.onerror = () => {
                    console.error('Error loading life parameters:', request.error);
                    resolve(); // Continue with defaults
                };
                
                transaction.onerror = () => {
                    console.error('Transaction error loading life parameters:', transaction.error);
                    resolve(); // Continue with defaults
                };
            } catch (error) {
                console.error('Database transaction failed while loading life parameters:', error);
                resolve(); // Continue with defaults
            }
        });
    }

    initializeQuestions() {
        return [
            {
                category: 'mindfulness',
                question: 'Right now, how do you choose to engage with this moment?',
                choices: [
                    { text: 'Actively direct my full attention to this present experience', value: 'mindful', weight: 100 },
                    { text: 'Allow my mind to wander to other tasks and distractions', value: 'mindless', weight: 0 }
                ]
            },
            {
                category: 'intention',
                question: 'How do you choose to approach this assessment process?',
                choices: [
                    { text: 'Set a clear intention to learn about myself without attachment to results', value: 'intending', weight: 100 },
                    { text: 'Hope for favorable outcomes and judge myself based on the results', value: 'expecting', weight: 0 }
                ]
            },
            {
                category: 'action',
                question: 'There\'s a difficult task you\'ve been postponing. What do you decide to do?',
                choices: [
                    { text: 'Commit to tackling it today, despite the discomfort', value: 'acting', weight: 100 },
                    { text: 'Continue delaying it and find reasons to put it off further', value: 'avoiding', weight: 0 }
                ]
            },
            {
                category: 'appreciation',
                question: 'How do you choose to view your current life circumstances?',
                choices: [
                    { text: 'Actively look for and acknowledge what I can appreciate right now', value: 'appreciating', weight: 100 },
                    { text: 'Focus on cataloging what\'s lacking or problematic', value: 'dismissing', weight: 0 }
                ]
            },
            {
                category: 'presence',
                question: 'Where do you decide to place your attention right now?',
                choices: [
                    { text: 'Deliberately anchor my awareness in this present moment', value: 'present', weight: 100 },
                    { text: 'Let my mind drift to past regrets or future anxieties', value: 'escaping', weight: 0 }
                ]
            },
            {
                category: 'selfBelief',
                question: 'How do you choose to define your self-worth in this moment?',
                choices: [
                    { text: 'Affirm my inherent value independent of any external achievements', value: 'selfAssertive', weight: 100 },
                    { text: 'Base my worth on others\' approval and external accomplishments', value: 'selfDoubting', weight: 0 }
                ]
            },
            {
                category: 'agency',
                question: 'When facing your current challenges, what approach do you choose?',
                choices: [
                    { text: 'Identify and act on what I can directly influence and control', value: 'personalAgency', weight: 100 },
                    { text: 'Dwell on how external forces are limiting my options', value: 'victimMindset', weight: 0 }
                ]
            },
            {
                category: 'validation',
                question: 'How do you choose to cultivate your sense of value?',
                choices: [
                    { text: 'Practice recognizing and honoring my inherent worth', value: 'internalWorth', weight: 100 },
                    { text: 'Seek praise, achievements, and external recognition', value: 'externalValidation', weight: 0 }
                ]
            }
        ];
    }

    startAssessment() {
        this.createAccordionQuestions();
        this.showScreen('question');
    }

    createAccordionQuestions() {
        const accordionContainer = document.getElementById('questions-accordion');
        accordionContainer.innerHTML = '';
        
        this.questions.forEach((question, index) => {
            const accordionItem = this.createAccordionItem(question, index);
            accordionContainer.appendChild(accordionItem);
        });
        
        this.updateCompleteButton();
    }
    
    createAccordionItem(question, index) {
        const item = document.createElement('div');
        item.className = 'question-item';
        item.dataset.questionIndex = index;
        
        const categoryLabels = {
            mindfulness: 'Mindfulness',
            intention: 'Intention',
            action: 'Action',
            appreciation: 'Appreciation',
            presence: 'Presence',
            selfBelief: 'Self-Belief',
            agency: 'Agency',
            validation: 'Validation'
        };
        
        item.innerHTML = `
            <div class="question-header">
                <div class="question-info">
                    <span class="question-number">${index + 1}</span>
                    <span class="question-category">${categoryLabels[question.category]}</span>
                </div>
                <h3 class="question-text">${question.question}</h3>
                <button class="toggle-question-btn">Show Choices</button>
            </div>
            <div class="question-content" style="display: none;">
                <div id="current-prediction-${index}" class="current-prediction">
                    <h4>Current Impact Preview</h4>
                    <div class="category-impact-${index}"></div>
                </div>
                <div class="crossroads-container">
                    <div class="crossroads-visual">
                        <div class="path-center">
                            <div class="pumpkin-signpost">
                                <svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 614.7 512" viewBox="0 0 614.7 512" width="100" height="auto">
                                    <g>
                                        <g>
                                            <g>
                                                <path fill="#B17A2A" d="M438.5,19.3c0,0-6.2,47.1-0.6,74.1c5.7,27.1-8.4,244.7-7,270.8c1.5,26.1,0.9,103-15.2,115.2c0,8.5-5.4c0,0,3.4-39.9,10-75.5c6.6-35.6,6.3-40.5,1.2-57.7c-5.1-17.3,1.7-280.1,6.7-327.3c0,0,19-8.4,43.2-5.4C422.6,11.1,432.9,12.1,438.5,19.3z"/>
                                                <path fill="#915933" d="M438.5 19.3c0 0 2.6-6.2-9.4-12s-27.7-7.8-43.8-7.2c-16.1.7-32 9.2-30.1 13.4 0 0 .5 15.6 24.7 16.8C404 31.6 431.8 32.3 438.5 19.3zM406.5 265.4c0 0-3.4-12.6-11.5-7-8.1 5.6-12.4 14.8-4.5 22.6 7.9 7.8 16 1.9 16.8-2.2C408 274.8 408.6 271.9 406.5 265.4zM380.8 273.8c0 0-1.7-6.2-5.7-3.5-4 2.8-6.1 7.3-2.2 11.2s7.9.9 8.3-1.1C381.5 278.4 381.8 277 380.8 273.8zM401 305c0 0 1.7 6.2 5.7 3.5s6.1-7.3 2.2-11.2-7.9-.9-8.3 1.1C400.3 300.3 400 301.7 401 305zM370.8 389.7c0 0 9.2-11.9 11.2-19.2 2-7.3 4.5-30.3 2.4-36.9-2-6.7-6.7-18.7-10.4-21.3-3.7-2.6.7 26.6.3 38.6C373.8 364.6 375 374.9 370.8 389.7zM407.1 377c0 0 7.3 25.9 7.3 32.4 0 6.6-.3 26.2-3.6 34.1S390 465 390 465s10.8-18.8 11.1-23.7c.4-4.9 0-9 0-9s-4 8.2-5.6 12.4c-1.6 4.2-12.2 11.1-12.2 11.1s3.8-9.9 6.9-16.6c5.5-11.6 6.7-29.5 6.9-34.4.2-4.9-4.2-33.6-4.2-33.6l12.2 27L407.1 377z"/>
                                                <path fill="#915933" d="M388.8,381.7c0,0,5.8,10,6.8,16.7c1,6.7,4.7,13.4-1.5,22.4c-1.6,2.4-8.8,18.5-8.8,18.5s3.6-27.7,2.9-31.5S388.8,381.7,388.8,381.7z"/>
                                            </g>
                                            <path fill="#915933" d="M200.6,242.9c0,0-7.3-6.6-6.5-26.7c0.8-20,1-48,0.2-54.7c-0.7-6.7,52.5-12,52.5-12s-47.2-1.5-52.8-4c-5.6-2.5-2-41.5,0-50.9c2-9.4-4-42-0.2-48.4c3.8-6.4,25.3-2.5,51.2-2.5s153.5-1.4,198-1.2c44.4,0.2,98.6,9.1,98.6,9.1s29.1,31.1,32.3,39.3c3.2,8.2,45.3,46.7,40.4,55.6c-4.8,8.9-74.3,85.2-84.9,88.2c-10.5,3-155.2,5.2-174.6,3.7S209.5,243.6,200.6,242.9z"/>
                                            <path fill="#B17A2A" d="M537 62.9c0 0-26 10.4-45.7 6.6S458 60.3 458 60.3s26.5 1.7 40.3 3C513.3 64.7 537 62.9 537 62.9zM292.6 206.1c0 0-24 14.5-44.1 13.9s-34.3-3.7-34.3-3.7 26.4-2.6 40.3-3.6C269.6 211.7 292.6 206.1 292.6 206.1zM234.7 169.4c0 0 7.9.9 24.9.1 17.1-.8 36.6-5 36.6-5s-14.9 6.8-17.3 8.1c0 0 15.7-2.6 19.3-3.8 0 0-10.9 8.2-13.7 10.3s-18.5 5.3-18.5 5.3 15 1.7 23.1-3.4c0 0-9.9 6.4-15.7 8.5-5.8 2.1-11 3.8-11 3.8l13-.1c0 0-20.7 10.4-25.5 11.3-4.8 1-33.6 3.9-33.6 3.9s15.9-7.1 19.8-7.6c3.9-.5 7.2-3.6 7.2-3.6s-16.3 1.6-18.7 1.2c-2.4-.4-17.1-2.6-17.1-2.6s15.9-1.1 19-2.7c3.2-1.5 10.5-4.1 10.5-4.1s-20 2.1-22.4 1.5-13-2.9-13-2.9 25.5-5.4 27-6.2 10.7-4.4 10.7-4.4-18.7.9-21.2 1.2c-2.5.3-9.7-2.8-9.7-2.8s11.3-3 14.7-3.8c0 0-5.5-.6-6.2-1.4C216.3 169.4 234.7 169.4 234.7 169.4z"/>
                                            <path fill="#B17A2A" d="M531,85.9c0,0-23.5,8.3-29.6,8.7s-24.3,1.3-31.8-1.3s-21.1-18-21.1-18s18,8.8,22.6,8.9c4.5,0,8.3-0.6,8.3-0.6s-7.8-3.2-11.8-4.5c-4-1.3-11-10.6-11-10.6s17.1,3.4,24.8,5.7c11.4,3.3,22.8,1.5,27.3,1.4c4.5-0.1,26.8-3.2,26.8-3.2l-24.3,12.9L531,85.9z"/>
                                        </g>
                                        <g>
                                            <path fill="#DC9440" d="M85.3,473.7c0,0-11.6-35.4-8.7-48.7s6.4-40.8,19.7-50.8s13.3-10,13.3-10s-7.1-15.3,0-28c7.1-12.8,16.8-20.9,20.7-21.2c3.9-0.4,12.7,0,12.7,0s7-29.7,18.5-36.3c11.6-6.6,22-14.3,46.7-13.9c0,0,41-18,65.9-12.3s55.6,2.5,74.8,36.3c19.1,33.8,22,53.6,22,53.6s29,35.8,22.6,77c-6.4,41.1-19.7,54.5-19.7,54.5s-2.9,23.2-13.9,30.7c-11,7.5-34.8,5.2-43.5,2.9c0,0-11.6-15.5-11.6-16.6s9.7-8.9,10-11.6c0.4-2.7-28.2-24-32.5-25.1c-4.2-1.2,17.8,22.4,16.6,22.8s-8.9,8.5-8.9,8.5l2.3,15.5c0,0-13.5,6.6-20.9,5.8s-19.3-11.6-21.2-12.7c-1.9-1.2,8.1-24,7.3-25.5c-0.8-1.5-42.5-15.1-44.8-16.6c-2.3-1.5,13.9-21.2,12.7-22s-46-13.5-48.3-14.7s24.3,20.9,24.3,20.9s-9.3,20.9-10.8,20.5c-1.5-0.4,44.4,19.7,44.4,19.7l-11.1,16.6l5,12c0,0-13.1,0.8-16.2,1.2c-3.1,0.4-17.4,6.6-22.4,6.2c-5-0.4-22.4-16.2-22.4-16.2s12.4-21.2,10.8-22c-1.5-0.8-31.7-14.3-36.7-15.5c-5-1.2,17.8,20.5,17.8,20.5l-12.4,12c0,0,6.6,14.7,4.6,13.9c-1.9-0.8-11.2,1.9-20.5-3.9c0,0-33.2-4.6-39-12C87,481.5,85.3,473.7,85.3,473.7z"/>
                                        </g>
                                    </g>
                                </svg>
                            </div>
                        </div>
                        <div class="choices-visual-${index}"></div>
                    </div>
                </div>
            </div>
        `;
        
        // Add click handler for toggle button
        const toggleBtn = item.querySelector('.toggle-question-btn');
        const content = item.querySelector('.question-content');
        
        toggleBtn.addEventListener('click', () => {
            const isVisible = content.style.display !== 'none';
            if (isVisible) {
                content.style.display = 'none';
                toggleBtn.textContent = 'Show Choices';
                item.classList.remove('expanded');
            } else {
                content.style.display = 'block';
                toggleBtn.textContent = 'Hide Choices';
                item.classList.add('expanded');
                
                // Show current impact and create visual crossroads
                this.showCurrentImpact(question.category, index);
                this.createVisualCrossroads(question, index);
            }
        });
        
        return item;
    }
    
    toggleAccordion(item) {
        const wasActive = item.classList.contains('active');
        
        // Close all other accordions
        document.querySelectorAll('.accordion-item').forEach(accordion => {
            accordion.classList.remove('active');
        });
        
        // Toggle current accordion
        if (!wasActive) {
            item.classList.add('active');
        }
    }
    
    async selectChoiceForQuestion(question, choice, questionIndex, pathElement) {
        const questionItem = pathElement.closest('.question-item');
        
        // Remove selected class from all choices in this question
        questionItem.querySelectorAll('.choice-path').forEach(path => {
            path.classList.remove('selected');
        });
        
        // Add selected class to chosen path
        pathElement.classList.add('selected');
        
        // Mark question as answered
        questionItem.classList.add('answered');
        
        // Record the choice
        const choiceRecord = {
            timestamp: new Date().toISOString(),
            question: question.question,
            choice: choice.text,
            category: question.category,
            value: choice.value,
            weight: choice.weight
        };
        
        await this.saveChoice(choiceRecord);
        
        // Update the complete button
        this.updateCompleteButton();
        
        // Update toggle button text to show selection
        const toggleBtn = questionItem.querySelector('.toggle-question-btn');
        toggleBtn.textContent = 'Choice Made ✓';
        toggleBtn.style.background = '#28a745';
    }
    
    async selectChoice(question, choice, questionIndex, optionElement) {
        const accordionItem = optionElement.closest('.accordion-item');
        
        // Remove selected class from all choices in this question
        accordionItem.querySelectorAll('.choice-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Add selected class to chosen option
        optionElement.classList.add('selected');
        
        // Mark accordion as answered
        accordionItem.classList.add('answered');
        
        // Record the choice
        const choiceRecord = {
            timestamp: new Date().toISOString(),
            question: question.question,
            choice: choice.text,
            category: question.category,
            value: choice.value,
            weight: choice.weight
        };
        
        await this.saveChoice(choiceRecord);
        
        // Update the complete button
        this.updateCompleteButton();
        
        // Close the accordion after selection
        setTimeout(() => {
            accordionItem.classList.remove('active');
        }, 500);
    }
    
    updateCompleteButton() {
        const answeredQuestions = document.querySelectorAll('.question-item.answered').length;
        const totalQuestions = this.questions.length;
        const completeButton = document.getElementById('complete-assessment-btn');
        
        if (answeredQuestions === totalQuestions) {
            completeButton.style.display = 'block';
            completeButton.textContent = 'View Your Predictions';
        } else {
            completeButton.style.display = 'block';
            completeButton.textContent = `Continue (${answeredQuestions}/${totalQuestions} answered)`;
        }
    }

    showCurrentImpact(category, questionIndex = null) {
        const currentScores = this.calculateScores();
        const categoryScore = currentScores.abstract[category] || 50;
        const avgAbstract = Object.values(currentScores.abstract).length > 0 
            ? Object.values(currentScores.abstract).reduce((sum, score) => sum + score, 0) / Object.values(currentScores.abstract).length 
            : 50;
        
        const categoryLabels = {
            mindfulness: 'Mindfulness Level',
            intention: 'Intention Clarity', 
            action: 'Action Consistency',
            appreciation: 'Appreciation Capacity',
            presence: 'Present Moment Awareness',
            selfBelief: 'Self-Belief Strength',
            agency: 'Personal Agency',
            validation: 'Internal Worth Recognition'
        };

        const categoryImpacts = {
            mindfulness: {
                abstract: ['Emotional resilience', 'Decision clarity', 'Stress management'],
                concrete: ['Relationship conflicts', 'Work performance', 'Health outcomes']
            },
            intention: {
                abstract: ['Goal achievement', 'Mental clarity', 'Purpose alignment'],
                concrete: ['Career advancement', 'Financial stability', 'Life satisfaction']
            },
            action: {
                abstract: ['Self-confidence', 'Momentum building', 'Discipline strength'],
                concrete: ['Opportunity capture', 'Skill development', 'Achievement rate']
            },
            appreciation: {
                abstract: ['Contentment level', 'Optimism', 'Resilience'],
                concrete: ['Relationship quality', 'Social connections', 'Life enjoyment']
            },
            presence: {
                abstract: ['Focus capacity', 'Anxiety levels', 'Awareness depth'],
                concrete: ['Productivity', 'Relationship intimacy', 'Learning ability']
            },
            selfBelief: {
                abstract: ['Confidence level', 'Risk tolerance', 'Assertiveness'],
                concrete: ['Career progress', 'Income potential', 'Social respect']
            },
            agency: {
                abstract: ['Control feeling', 'Motivation', 'Problem-solving'],
                concrete: ['Life trajectory', 'External outcomes', 'Opportunity creation']
            },
            validation: {
                abstract: ['Inner stability', 'Authentic expression', 'Self-worth'],
                concrete: ['Independence', 'Relationship dynamics', 'Decision freedom']
            }
        };

        const containerSelector = questionIndex !== null ? `category-impact-${questionIndex}` : 'category-impact';
        const container = document.querySelector(`.${containerSelector}`);
        if (!container) return;
        container.innerHTML = '';

        const impactData = categoryImpacts[category];
        const currentLabel = categoryLabels[category];

        const abstractImpactDiv = document.createElement('div');
        abstractImpactDiv.className = 'impact-item';
        abstractImpactDiv.innerHTML = `
            <span class="impact-label">${currentLabel}</span>
            <span class="impact-current">Current: ${Math.round(categoryScore)}%</span>
        `;
        container.appendChild(abstractImpactDiv);

        const concreteDiv = document.createElement('div');
        concreteDiv.className = 'concrete-impact';
        concreteDiv.innerHTML = `
            <div class="concrete-impact-label">This choice directly affects:</div>
            <div class="concrete-range">
                Abstract: ${impactData.abstract.join(', ')}<br>
                External: ${impactData.concrete.join(', ')} 
                <br><em>(External outcomes remain largely unpredictable regardless of your choice)</em>
            </div>
        `;
        container.appendChild(concreteDiv);
    }

    createVisualCrossroads(question, questionIndex = null) {
        const containerSelector = questionIndex !== null ? `choices-visual-${questionIndex}` : 'choices-visual';
        const container = document.querySelector(`.${containerSelector}`);
        if (!container) return;
        container.innerHTML = '';
        
        question.choices.forEach((choice, index) => {
            const pathDiv = document.createElement('div');
            pathDiv.className = `choice-path ${index === 0 ? 'left' : 'right'} ${choice.weight > 50 ? 'positive' : 'negative'}`;
            
            const impactData = this.getChoiceImpactData(question.category, choice.weight);
            
            // Create separate elements for path line and destination
            const pathLine = document.createElement('div');
            pathLine.className = 'path-line';
            
            const destination = document.createElement('div');
            destination.className = 'choice-destination';
            destination.innerHTML = `
                <div class="choice-title">${choice.text.substring(0, 50)}${choice.text.length > 50 ? '...' : ''}</div>
                <div class="choice-impact-summary">${impactData.category}: ${impactData.delta}</div>
                <div class="choice-outcome">${impactData.outcome}</div>
            `;
            
            // For left path, counter-rotate the destination to keep it readable
            if (index === 0) {
                destination.style.transform = 'translate(0%, -40%) rotate(-180deg)';
                destination.style.transformOrigin = 'top center';
            }
            
            pathDiv.appendChild(pathLine);
            pathDiv.appendChild(destination);
            
            pathDiv.addEventListener('click', () => {
                if (questionIndex !== null) {
                    this.selectChoiceForQuestion(question, choice, questionIndex, pathDiv);
                } else {
                    this.recordChoice(question, choice);
                }
            });
            
            container.appendChild(pathDiv);
        });
    }

    getChoiceImpactData(category, choiceWeight) {
        const currentScores = this.calculateScores();
        const currentScore = currentScores.abstract[category] || 50;
        
        const impactMagnitude = Math.abs(choiceWeight - 50) / 2;
        const newScore = Math.min(100, Math.max(0, currentScore + (choiceWeight > 50 ? impactMagnitude : -impactMagnitude)));
        const scoreDelta = newScore - currentScore;
        
        const categoryLabels = {
            mindfulness: 'Mindfulness',
            intention: 'Intention',
            action: 'Action',
            appreciation: 'Appreciation',
            presence: 'Presence',
            selfBelief: 'Self-Belief',
            agency: 'Agency',
            validation: 'Validation'
        };

        const outcomes = {
            mindfulness: {
                positive: 'Builds emotional resilience and clarity',
                negative: 'Weakens awareness and increases reactivity'
            },
            intention: {
                positive: 'Strengthens purposeful action',
                negative: 'Increases frustration and complaints'
            },
            action: {
                positive: 'Builds momentum and confidence',
                negative: 'Reinforces avoidance patterns'
            },
            appreciation: {
                positive: 'Enhances contentment and relationships',
                negative: 'Increases dissatisfaction and negativity'
            },
            presence: {
                positive: 'Improves focus and connection',
                negative: 'Strengthens escapist tendencies'
            },
            selfBelief: {
                positive: 'Builds unshakeable inner confidence',
                negative: 'Increases dependency on others'
            },
            agency: {
                positive: 'Strengthens sense of control',
                negative: 'Reinforces victim mindset'
            },
            validation: {
                positive: 'Builds authentic self-worth',
                negative: 'Increases need for external approval'
            }
        };

        const deltaText = scoreDelta > 0 ? `+${Math.round(scoreDelta)}%` : `${Math.round(scoreDelta)}%`;
        const outcome = outcomes[category][choiceWeight > 50 ? 'positive' : 'negative'];
        
        return {
            category: categoryLabels[category],
            delta: deltaText,
            outcome: outcome
        };
    }

    getChoiceImpact(category, choiceWeight) {
        const currentScores = this.calculateScores();
        const currentScore = currentScores.abstract[category] || 50;
        
        // Simulate impact of this choice
        const impactDirection = choiceWeight > 50 ? 'positive' : 'negative';
        const impactMagnitude = Math.abs(choiceWeight - 50) / 2; // Scale impact
        
        const newScore = Math.min(100, Math.max(0, currentScore + (choiceWeight > 50 ? impactMagnitude : -impactMagnitude)));
        const scoreDelta = newScore - currentScore;
        
        const categoryLabels = {
            mindfulness: 'Mindfulness',
            intention: 'Intention Clarity', 
            action: 'Action Consistency',
            appreciation: 'Appreciation',
            presence: 'Present Awareness',
            selfBelief: 'Self-Belief',
            agency: 'Personal Agency',
            validation: 'Internal Worth'
        };

        const concreteOutcomes = {
            mindfulness: 'Emotional stability, decision quality',
            intention: 'Goal achievement, life direction',
            action: 'Momentum, opportunities seized',
            appreciation: 'Life satisfaction, relationships',
            presence: 'Focus, productivity, connection',
            selfBelief: 'Confidence, risk-taking ability',
            agency: 'Control feeling, problem-solving',
            validation: 'Independence, authentic expression'
        };

        const deltaText = scoreDelta > 0 ? `+${Math.round(scoreDelta)}` : `${Math.round(scoreDelta)}`;
        const deltaClass = scoreDelta > 0 ? 'positive' : 'negative';
        
        return `
            <div class="impact-score">
                <span class="impact-category">${categoryLabels[category]}</span>
                <span class="impact-delta ${deltaClass}">${deltaText}%</span>
            </div>
            <div class="impact-concrete">
                <span class="impact-affects">Affects: ${concreteOutcomes[category]}</span>
                <div class="reality-note">${choiceWeight > 50 ? 'Builds inner strength' : 'Weakens internal foundation'}</div>
            </div>
        `;
    }

    async recordChoice(question, choice) {
        const choiceRecord = {
            timestamp: new Date().toISOString(),
            question: question.question,
            choice: choice.text,
            category: question.category,
            value: choice.value,
            weight: choice.weight
        };
        
        await this.saveChoice(choiceRecord);
        
        this.currentQuestionIndex++;
        
        if (this.currentQuestionIndex < this.questions.length) {
            this.showQuestion();
        } else {
            this.showPrediction();
        }
    }

    showPrediction() {
        const scores = this.calculateScores();
        this.displayHealthLifespanInfo();
        this.displayAbstractScores(scores.abstract);
        this.displayConcretePredictions(scores.concrete);
        this.showScreen('prediction');
        
        // Update countdown when predictions change
        if (this.countdownInterval) {
            this.updateCountdownDisplay();
        }
    }

    calculateScores() {
        const recentChoices = this.getRecentChoices(30);
        const categories = ['mindfulness', 'intention', 'action', 'appreciation', 'presence', 'selfBelief', 'agency', 'validation'];
        
        const abstract = {};
        
        categories.forEach(category => {
            const categoryChoices = recentChoices.filter(choice => choice.category === category);
            if (categoryChoices.length > 0) {
                const avgWeight = categoryChoices.reduce((sum, choice) => sum + choice.weight, 0) / categoryChoices.length;
                const trend = this.calculateTrend(categoryChoices);
                abstract[category] = Math.min(100, Math.max(0, avgWeight + trend));
            } else {
                abstract[category] = 50;
            }
        });

        const avgAbstract = Object.values(abstract).reduce((sum, score) => sum + score, 0) / Object.values(abstract).length;
        
        const concrete = this.calculateConcreteOutcomes(avgAbstract);
        
        return { abstract, concrete };
    }

    calculateTrend(choices) {
        if (choices.length < 2) return 0;
        
        const recent = choices.slice(-3);
        const older = choices.slice(0, -3);
        
        const recentAvg = recent.reduce((sum, choice) => sum + choice.weight, 0) / recent.length;
        const olderAvg = older.length > 0 ? older.reduce((sum, choice) => sum + choice.weight, 0) / older.length : recentAvg;
        
        return (recentAvg - olderAvg) * 0.2;
    }

    calculateConcreteOutcomes(abstractScore) {
        const murphyMultiplier = 0.7;
        const unpredictabilityFactor = 0.4;
        const baseInfluence = abstractScore * 0.3;
        
        return {
            financial: {
                optimistic: Math.round(Math.min(80, baseInfluence + 40)),
                realistic: Math.round(Math.min(60, (baseInfluence + 20) * murphyMultiplier)),
                pessimistic: Math.round(Math.min(40, baseInfluence * murphyMultiplier)),
                blackSwanRisk: "Economic collapse, automation displacement, or systemic failure could override all personal efforts"
            },
            respect: {
                optimistic: Math.round(Math.min(70, baseInfluence + 30)),
                realistic: Math.round(Math.min(50, (baseInfluence + 15) * murphyMultiplier)),
                pessimistic: Math.round(Math.min(30, baseInfluence * murphyMultiplier * unpredictabilityFactor)),
                volatilityWarning: "Social respect is highly volatile and often depends on factors beyond personal character"
            },
            relationships: {
                optimistic: Math.round(Math.min(75, baseInfluence + 35)),
                realistic: Math.round(Math.min(55, (baseInfluence + 20) * murphyMultiplier)),
                pessimistic: Math.round(Math.min(35, baseInfluence * murphyMultiplier * unpredictabilityFactor)),
                disappointmentNote: "Even strong personal development cannot guarantee relationship outcomes due to others' unpredictable choices"
            },
            opportunities: {
                optimistic: Math.round(Math.min(65, baseInfluence + 25)),
                realistic: Math.round(Math.min(45, (baseInfluence + 10) * murphyMultiplier)),
                pessimistic: Math.round(Math.min(25, baseInfluence * murphyMultiplier * unpredictabilityFactor)),
                blockageNote: "External forces, timing, and systemic barriers often block opportunities regardless of preparation"
            }
        };
    }

    displayAbstractScores(scores) {
        const container = document.getElementById('abstract-scores');
        container.innerHTML = '';
        
        const labels = {
            mindfulness: 'Mindfulness Level',
            intention: 'Intention Clarity',
            action: 'Action Consistency',
            appreciation: 'Appreciation Capacity',
            presence: 'Present Moment Awareness',
            selfBelief: 'Self-Belief Strength',
            agency: 'Personal Agency',
            validation: 'Internal Worth Recognition'
        };

        const abstractTimeframes = {
            mindfulness: {
                shortTerm: {
                    high: 'You will catch yourself in reactive moments and pause more frequently',
                    medium: 'You will have some moments of awareness but still react automatically often',
                    low: 'You will continue reacting impulsively with minimal self-awareness'
                },
                midTerm: {
                    high: 'You will develop a strong habit of observing thoughts before responding',
                    medium: 'You will build some mindfulness skills but struggle with consistency',
                    low: 'You will remain largely reactive with occasional bursts of awareness'
                },
                longTerm: {
                    high: 'You will maintain deep, stable awareness that becomes your natural way of being',
                    medium: 'You will have developed mindfulness skills but still lose awareness under stress',
                    low: 'You will show minimal improvement in conscious awareness over time'
                }
            },
            intention: {
                shortTerm: {
                    high: 'You will set clearer daily intentions and act with more purpose',
                    medium: 'You will have some clarity about goals but still expect specific outcomes',
                    low: 'You will continue expecting particular results and complaining when disappointed'
                },
                midTerm: {
                    high: 'You will consistently act from intention while accepting whatever outcomes arise',
                    medium: 'You will develop better clarity but still struggle with attachment to results',
                    low: 'You will remain focused on expectations rather than clear intentions'
                },
                longTerm: {
                    high: 'You will embody purposeful action completely detached from specific outcomes',
                    medium: 'You will have developed intention-setting skills with occasional attachment',
                    low: 'You will continue the pattern of expecting and complaining about unmet expectations'
                }
            },
            action: {
                shortTerm: {
                    high: 'You will tackle avoided tasks more readily and build momentum',
                    medium: 'You will take action on some important things but still procrastinate on others',
                    low: 'You will continue avoiding difficult tasks and making excuses'
                },
                midTerm: {
                    high: 'You will develop a strong pattern of facing challenges despite discomfort',
                    medium: 'You will improve at taking action but still avoid the most difficult tasks',
                    low: 'You will show minimal improvement in overcoming avoidance patterns'
                },
                longTerm: {
                    high: 'You will embody consistent action-taking as a fundamental part of your character',
                    medium: 'You will have developed better action habits but still struggle with major challenges',
                    low: 'You will remain stuck in chronic avoidance and procrastination patterns'
                }
            },
            appreciation: {
                shortTerm: {
                    high: 'You will notice and acknowledge good things in your daily experience',
                    medium: 'You will appreciate some things but often focus on what\'s lacking',
                    low: 'You will continue dismissing your current reality and focusing on problems'
                },
                midTerm: {
                    high: 'You will cultivate a genuine appreciation practice that becomes natural',
                    medium: 'You will develop some appreciation skills but inconsistently apply them',
                    low: 'You will remain focused on what\'s wrong or missing in your life'
                },
                longTerm: {
                    high: 'You will maintain deep gratitude and appreciation regardless of circumstances',
                    medium: 'You will have developed appreciation abilities but lose them during difficult times',
                    low: 'You will continue the pattern of dismissing present reality and focusing on lack'
                }
            },
            presence: {
                shortTerm: {
                    high: 'You will anchor your attention in the present moment more frequently',
                    medium: 'You will be present sometimes but often drift into mental wandering',
                    low: 'You will continue escaping into thoughts about past and future'
                },
                midTerm: {
                    high: 'You will develop strong present-moment awareness as a stable practice',
                    medium: 'You will improve at staying present but struggle during stressful periods',
                    low: 'You will remain largely lost in mental distractions and fantasies'
                },
                longTerm: {
                    high: 'You will embody present-moment awareness as your natural state of being',
                    medium: 'You will have good presence skills but lose them during major life challenges',
                    low: 'You will continue habitually escaping the present moment through mental activity'
                }
            },
            selfBelief: {
                shortTerm: {
                    high: 'You will recognize your worth more often independent of external validation',
                    medium: 'You will have some self-confidence but still seek others\' approval regularly',
                    low: 'You will continue depending on external praise and achievements for self-worth'
                },
                midTerm: {
                    high: 'You will develop unshakeable self-worth that doesn\'t require external confirmation',
                    medium: 'You will build stronger self-belief but still need some external validation',
                    low: 'You will remain dependent on others\' opinions and external achievements'
                },
                longTerm: {
                    high: 'You will maintain rock-solid self-worth completely independent of external circumstances',
                    medium: 'You will have strong self-belief that occasionally wavers during major setbacks',
                    low: 'You will continue the cycle of needing external validation to feel worthy'
                }
            },
            agency: {
                shortTerm: {
                    high: 'You will focus more on what you can influence and control in daily situations',
                    medium: 'You will sometimes take charge but often feel overwhelmed by circumstances',
                    low: 'You will continue feeling like a victim of forces beyond your control'
                },
                midTerm: {
                    high: 'You will consistently take responsibility for your responses and choices',
                    medium: 'You will develop better agency skills but struggle during major challenges',
                    low: 'You will remain stuck in victim mindset with minimal sense of personal power'
                },
                longTerm: {
                    high: 'You will embody complete personal responsibility and focus solely on what you control',
                    medium: 'You will have strong agency abilities but lose them during overwhelming situations',
                    low: 'You will continue feeling powerless and blaming external circumstances'
                }
            },
            validation: {
                shortTerm: {
                    high: 'You will recognize your inherent value more often without needing external confirmation',
                    medium: 'You will have some internal stability but still need achievements to feel good',
                    low: 'You will continue depending on others\' opinions and external success for self-worth'
                },
                midTerm: {
                    high: 'You will develop stable internal worth that doesn\'t fluctuate with external events',
                    medium: 'You will build better internal validation skills but still seek some external approval',
                    low: 'You will remain dependent on praise, achievements, and others\' opinions'
                },
                longTerm: {
                    high: 'You will maintain complete internal worth independent of any external circumstances',
                    medium: 'You will have strong internal validation but occasionally doubt yourself during setbacks',
                    low: 'You will continue the pattern of needing external success and approval to feel valuable'
                }
            }
        };
        
        Object.entries(scores).forEach(([key, score]) => {
            const item = document.createElement('div');
            item.className = 'score-item-detailed';
            
            const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
            const timeframes = abstractTimeframes[key];
            
            // Calculate progression predictions based on current score
            const shortTermScore = this.calculateTimeframeScore(score, 'short');
            const midTermScore = this.calculateTimeframeScore(score, 'mid'); 
            const longTermScore = this.calculateTimeframeScore(score, 'long');
            
            const shortLevel = shortTermScore >= 70 ? 'high' : shortTermScore >= 40 ? 'medium' : 'low';
            const midLevel = midTermScore >= 70 ? 'high' : midTermScore >= 40 ? 'medium' : 'low';
            const longLevel = longTermScore >= 70 ? 'high' : longTermScore >= 40 ? 'medium' : 'low';
            
            item.innerHTML = `
                <div class="score-header">
                    <span class="score-label">${labels[key]}</span>
                    <div class="score-display">
                        <div class="score-bar">
                            <div class="score-fill" style="width: ${score}%"></div>
                        </div>
                        <span class="score-value">Current: ${Math.round(score)}%</span>
                    </div>
                </div>
                
                <div class="abstract-timeframe-section">
                    <div class="timeframe-header">
                        <h5 class="abstract-timeframe-title">Weeks (1-8 weeks)</h5>
                        <span class="timeframe-percentage">${Math.round(shortTermScore)}%</span>
                    </div>
                    <div class="abstract-description">${timeframes.shortTerm[shortLevel]}</div>
                </div>

                <div class="abstract-timeframe-section">
                    <div class="timeframe-header">
                        <h5 class="abstract-timeframe-title">Months (2-18 months)</h5>
                        <span class="timeframe-percentage">${Math.round(midTermScore)}%</span>
                    </div>
                    <div class="abstract-description">${timeframes.midTerm[midLevel]}</div>
                </div>

                <div class="abstract-timeframe-section">
                    <div class="timeframe-header">
                        <h5 class="abstract-timeframe-title">Years (2+ years)</h5>
                        <span class="timeframe-percentage">${Math.round(longTermScore)}%</span>
                    </div>
                    <div class="abstract-description">${timeframes.longTerm[longLevel]}</div>
                </div>
            `;
            
            container.appendChild(item);
        });
    }
    
    calculateTimeframeScore(currentScore, timeframe) {
        // Scores evolve over time based on current level and momentum
        const momentum = currentScore > 60 ? 'positive' : currentScore < 40 ? 'negative' : 'neutral';
        
        let change = 0;
        
        switch (timeframe) {
            case 'short':
                // Weeks (1-8 weeks): small but noticeable changes
                if (momentum === 'positive') {
                    change = Math.random() * 8 + 2; // 2-10% improvement
                } else if (momentum === 'negative') {
                    change = -(Math.random() * 6 + 1); // 1-7% decline
                } else {
                    change = (Math.random() - 0.5) * 6; // -3% to +3%
                }
                break;
                
            case 'mid':
                // Months (2-18 months): moderate changes
                if (momentum === 'positive') {
                    change = Math.random() * 20 + 8; // 8-28% improvement
                } else if (momentum === 'negative') {
                    change = -(Math.random() * 15 + 4); // 4-19% decline
                } else {
                    change = (Math.random() - 0.5) * 16; // -8% to +8%
                }
                break;
                
            case 'long':
                // Years (2+ years): substantial changes possible
                if (momentum === 'positive') {
                    change = Math.random() * 40 + 15; // 15-55% improvement
                } else if (momentum === 'negative') {
                    change = -(Math.random() * 35 + 10); // 10-45% decline
                } else {
                    change = (Math.random() - 0.5) * 35; // -17.5% to +17.5%
                }
                break;
        }
        
        // Apply diminishing returns for high scores and floor effects for low scores
        if (currentScore > 80 && change > 0) {
            change *= 0.5; // Harder to improve when already high
        } else if (currentScore < 20 && change < 0) {
            change *= 0.5; // Harder to get worse when already low
        }
        
        const newScore = Math.max(5, Math.min(95, currentScore + change));
        return newScore;
    }

    displayHealthLifespanInfo() {
        const container = document.getElementById('health-lifespan-info');
        if (!container) return;
        
        if (!this.userDOB || !this.lifeExpectancies) {
            container.innerHTML = '<p>Complete life parameters setup to see health and lifespan information.</p>';
            return;
        }
        
        const birthDate = new Date(this.userDOB);
        const currentAge = this.calculateAge(birthDate);
        
        // Get health conditions display
        const healthConditions = this.userDiseases.includes('none') ? 
            ['None / Healthy'] : 
            this.userDiseases.map(disease => {
                const diseaseLabels = {
                    diabetes: 'Diabetes',
                    heart_disease: 'Heart Disease', 
                    cancer: 'Cancer (in remission)',
                    hypertension: 'High Blood Pressure',
                    obesity: 'Obesity',
                    smoking: 'Smoking Habit',
                    mental_health: 'Mental Health Condition',
                    other: 'Other Chronic Condition'
                };
                return diseaseLabels[disease] || disease;
            });
        
        container.innerHTML = `
            <div class="health-overview">
                <div class="health-item">
                    <span class="health-label">Current Age:</span>
                    <span class="health-value">${currentAge} years</span>
                </div>
                <div class="health-item">
                    <span class="health-label">Health Conditions:</span>
                    <span class="health-value">${healthConditions.join(', ')}</span>
                </div>
                <div class="health-item">
                    <span class="health-label">Life Expectancy Range:</span>
                    <span class="health-value">${this.lifeExpectancies.pessimistic} - ${this.lifeExpectancies.optimistic} years</span>
                </div>
                <div class="health-item">
                    <span class="health-label">Most Likely Lifespan:</span>
                    <span class="health-value">${this.lifeExpectancies.realistic} years</span>
                </div>
                <div class="health-item">
                    <span class="health-label">Remaining Years (Realistic):</span>
                    <span class="health-value">${Math.max(0, this.lifeExpectancies.realistic - currentAge)} years</span>
                </div>
            </div>
        `;
    }

    displayConcretePredictions(predictions) {
        const container = document.getElementById('concrete-predictions');
        container.innerHTML = '';
        
        const labels = {
            financial: 'Financial Stability',
            respect: 'Social Respect',
            relationships: 'Relationship Quality',
            opportunities: 'Career Opportunities'
        };

        const timeframePredictions = {
            financial: {
                shortTerm: {
                    optimistic: 'You will manage daily expenses comfortably and start building emergency savings',
                    realistic: 'You will meet basic needs but will struggle with unexpected expenses',
                    pessimistic: 'You will face financial stress despite careful budgeting and effort'
                },
                midTerm: {
                    optimistic: 'You will achieve financial stability with growing investments and career advancement',
                    realistic: 'You will maintain basic financial security but with limited growth',
                    pessimistic: 'You will experience setbacks that erode financial progress despite discipline'
                },
                longTerm: {
                    optimistic: 'You will build substantial wealth and achieve financial independence',
                    realistic: 'You will have modest retirement savings but remain vulnerable to economic shifts',
                    pessimistic: 'You will struggle financially into old age despite lifelong efforts'
                }
            },
            respect: {
                shortTerm: {
                    optimistic: 'You will earn recognition from immediate peers and colleagues',
                    realistic: 'You will gain some respect but also face social challenges',
                    pessimistic: 'You will experience disappointing social responses despite good character'
                },
                midTerm: {
                    optimistic: 'You will become widely respected in your community and professional circles',
                    realistic: 'You will maintain moderate respect but with ongoing social volatility',
                    pessimistic: 'You will face social setbacks that undermine respect despite personal growth'
                },
                longTerm: {
                    optimistic: 'You will be remembered as a respected and influential person',
                    realistic: 'You will be moderately regarded but largely forgotten',
                    pessimistic: 'You will lack the social legacy you hoped for despite character development'
                }
            },
            relationships: {
                shortTerm: {
                    optimistic: 'You will deepen current relationships and attract quality new connections',
                    realistic: 'You will maintain some good relationships while others remain challenging',
                    pessimistic: 'You will face relationship disappointments despite emotional maturity'
                },
                midTerm: {
                    optimistic: 'You will build a strong network of meaningful, supportive relationships',
                    realistic: 'You will have several good relationships but ongoing interpersonal struggles',
                    pessimistic: 'You will experience significant relationship losses despite personal growth'
                },
                longTerm: {
                    optimistic: 'You will have deep, lasting relationships that provide mutual support through life',
                    realistic: 'You will have some enduring connections but many relationships will fade',
                    pessimistic: 'You will face increasing isolation despite continued efforts to connect'
                }
            },
            opportunities: {
                shortTerm: {
                    optimistic: 'You will recognize and successfully capture emerging opportunities',
                    realistic: 'You will see some opportunities but many will be blocked by external factors',
                    pessimistic: 'You will miss opportunities due to timing, competition, or systemic barriers'
                },
                midTerm: {
                    optimistic: 'You will consistently create and seize major opportunities for advancement',
                    realistic: 'You will occasionally benefit from opportunities but face significant obstacles',
                    pessimistic: 'You will be repeatedly blocked from opportunities by external forces'
                },
                longTerm: {
                    optimistic: 'You will achieve major life goals through accumulated opportunities',
                    realistic: 'You will accomplish some goals but many dreams will remain unfulfilled',
                    pessimistic: 'You will face systematic exclusion from life-changing opportunities'
                }
            }
        };
        
        Object.entries(predictions).forEach(([key, pred]) => {
            const item = document.createElement('div');
            item.className = 'prediction-item-detailed';
            
            const note = pred.blackSwanRisk || pred.volatilityWarning || pred.disappointmentNote || pred.blockageNote;
            const timeframes = timeframePredictions[key];
            
            item.innerHTML = `
                <div class="prediction-header">
                    <div class="prediction-label">${labels[key]}</div>
                    <div class="prediction-subtitle">Future predictions across timeframes:</div>
                </div>
                
                <div class="timeframe-section">
                    <h4 class="timeframe-title">Weeks (1-8 weeks)</h4>
                    <div class="prediction-ranges">
                        <div class="range-item optimistic">
                            <span class="range-label">Optimistic (${pred.optimistic}%)</span>
                            <span class="range-desc">${timeframes.shortTerm.optimistic}</span>
                        </div>
                        <div class="range-item realistic">
                            <span class="range-label">Realistic (${pred.realistic}%)</span>
                            <span class="range-desc">${timeframes.shortTerm.realistic}</span>
                        </div>
                        <div class="range-item pessimistic">
                            <span class="range-label">Pessimistic (${pred.pessimistic}%)</span>
                            <span class="range-desc">${timeframes.shortTerm.pessimistic}</span>
                        </div>
                    </div>
                </div>

                <div class="timeframe-section">
                    <h4 class="timeframe-title">Months (2-18 months)</h4>
                    <div class="prediction-ranges">
                        <div class="range-item optimistic">
                            <span class="range-label">Optimistic (${Math.round(pred.optimistic * 0.9)}%)</span>
                            <span class="range-desc">${timeframes.midTerm.optimistic}</span>
                        </div>
                        <div class="range-item realistic">
                            <span class="range-label">Realistic (${Math.round(pred.realistic * 0.8)}%)</span>
                            <span class="range-desc">${timeframes.midTerm.realistic}</span>
                        </div>
                        <div class="range-item pessimistic">
                            <span class="range-label">Pessimistic (${Math.round(pred.pessimistic * 1.2)}%)</span>
                            <span class="range-desc">${timeframes.midTerm.pessimistic}</span>
                        </div>
                    </div>
                </div>

                <div class="timeframe-section">
                    <h4 class="timeframe-title">Years (2+ years)</h4>
                    <div class="prediction-ranges">
                        <div class="range-item optimistic">
                            <span class="range-label">Optimistic (${Math.round(pred.optimistic * 0.8)}%)</span>
                            <span class="range-desc">${timeframes.longTerm.optimistic}</span>
                        </div>
                        <div class="range-item realistic">
                            <span class="range-label">Realistic (${Math.round(pred.realistic * 0.7)}%)</span>
                            <span class="range-desc">${timeframes.longTerm.realistic}</span>
                        </div>
                        <div class="range-item pessimistic">
                            <span class="range-label">Pessimistic (${Math.round(pred.pessimistic * 1.4)}%)</span>
                            <span class="range-desc">${timeframes.longTerm.pessimistic}</span>
                        </div>
                    </div>
                </div>
                
                <div class="prediction-reality-note">${note}</div>
            `;
            
            container.appendChild(item);
        });
    }

    getRecentChoices(days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        return this.choiceHistory.filter(choice => 
            new Date(choice.timestamp) > cutoffDate
        );
    }

    showScreen(screenName) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenName).classList.add('active');
        this.currentScreen = screenName;
        
        // Ensure countdown continues on all screens if life parameters are set
        if (this.userDOB && this.lifeExpectancies && !this.countdownInterval) {
            this.startCountdown();
        }
    }

    async loadChoiceHistory() {
        if (!this.db) {
            console.warn('Database not initialized, using empty choice history');
            this.choiceHistory = [];
            return;
        }
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['choices'], 'readonly');
                const store = transaction.objectStore('choices');
                const request = store.getAll();
                
                request.onsuccess = () => {
                    this.choiceHistory = request.result || [];
                    resolve();
                };
                
                request.onerror = () => {
                    console.error('Error loading choice history:', request.error);
                    this.choiceHistory = [];
                    resolve(); // Still resolve to continue app initialization
                };
                
                transaction.onerror = () => {
                    console.error('Transaction error loading choices:', transaction.error);
                    this.choiceHistory = [];
                    resolve(); // Still resolve to continue app initialization
                };
            } catch (error) {
                console.error('Database transaction failed while loading choices:', error);
                this.choiceHistory = [];
                resolve(); // Still resolve to continue app initialization
            }
        });
    }

    async saveChoice(choiceRecord) {
        if (!this.db) {
            console.warn('Database not initialized, choice not saved');
            // Still add to memory for current session
            this.choiceHistory.push({...choiceRecord, id: Date.now()});
            return;
        }
        
        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction(['choices'], 'readwrite');
                const store = transaction.objectStore('choices');
                const request = store.add(choiceRecord);
                
                request.onsuccess = () => {
                    this.choiceHistory.push({...choiceRecord, id: request.result});
                    resolve();
                };
                
                request.onerror = () => {
                    console.error('Error saving choice:', request.error);
                    // Still add to memory for current session
                    this.choiceHistory.push({...choiceRecord, id: Date.now()});
                    resolve();
                };
                
                transaction.onerror = () => {
                    console.error('Transaction error:', transaction.error);
                    // Still add to memory for current session
                    this.choiceHistory.push({...choiceRecord, id: Date.now()});
                    resolve();
                };
            } catch (error) {
                console.error('Database transaction failed:', error);
                // Still add to memory for current session
                this.choiceHistory.push({...choiceRecord, id: Date.now()});
                resolve();
            }
        });
    }

    async resetHistory() {
        if (confirm('This will permanently delete all your choice history. Are you sure?')) {
            if (this.db) {
                const transaction = this.db.transaction(['choices'], 'readwrite');
                const store = transaction.objectStore('choices');
                store.clear();
            }
            this.choiceHistory = [];
            this.showScreen('intro');
        }
    }

    exportData(format) {
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `life-prediction-data-${timestamp}`;
        
        if (format === 'json') {
            const data = {
                exportDate: new Date().toISOString(),
                choiceHistory: this.choiceHistory,
                currentScores: this.calculateScores()
            };
            this.downloadFile(JSON.stringify(data, null, 2), `${filename}.json`, 'application/json');
        } else if (format === 'csv') {
            const csvContent = this.convertToCSV();
            this.downloadFile(csvContent, `${filename}.csv`, 'text/csv');
        }
    }

    convertToCSV() {
        const headers = ['Date', 'Time', 'Category', 'Question', 'Choice', 'Value', 'Weight'];
        const rows = this.choiceHistory.map(choice => {
            const date = new Date(choice.timestamp);
            return [
                date.toDateString(),
                date.toTimeString().split(' ')[0],
                choice.category,
                `"${choice.question.replace(/"/g, '""')}"`,
                `"${choice.choice.replace(/"/g, '""')}"`,
                choice.value,
                choice.weight
            ];
        });
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    async importData(file) {
        if (!file) return;
        
        const text = await file.text();
        
        try {
            if (file.name.endsWith('.json')) {
                const data = JSON.parse(text);
                if (data.choiceHistory && Array.isArray(data.choiceHistory)) {
                    await this.importChoices(data.choiceHistory);
                }
            } else if (file.name.endsWith('.csv')) {
                await this.importFromCSV(text);
            }
            
            alert('Data imported successfully!');
            await this.loadChoiceHistory();
        } catch (error) {
            alert('Error importing data: ' + error.message);
        }
    }

    async importChoices(choices) {
        if (!this.db) return;
        
        const transaction = this.db.transaction(['choices'], 'readwrite');
        const store = transaction.objectStore('choices');
        
        for (const choice of choices) {
            // Remove id if present to avoid conflicts
            const { id, ...choiceData } = choice;
            store.add(choiceData);
        }
    }

    async importFromCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',');
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            
            const values = this.parseCSVLine(lines[i]);
            const choice = {
                timestamp: new Date(`${values[0]} ${values[1]}`).toISOString(),
                category: values[2],
                question: values[3].replace(/^"|"$/g, '').replace(/""/g, '"'),
                choice: values[4].replace(/^"|"$/g, '').replace(/""/g, '"'),
                value: values[5],
                weight: parseInt(values[6])
            };
            
            if (this.db) {
                const transaction = this.db.transaction(['choices'], 'readwrite');
                const store = transaction.objectStore('choices');
                store.add(choice);
            }
        }
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    showConfigurationPage() {
        // Load current settings into the configuration form
        this.loadConfigurationSettings();
        this.showScreen('configuration');
    }

    loadConfigurationSettings() {
        // Set date of birth
        if (this.userDOB) {
            document.getElementById('config-dob').value = this.userDOB;
        }
        
        // Set max date for config DOB
        const configDobInput = document.getElementById('config-dob');
        if (configDobInput) {
            const today = new Date();
            const maxDate = today.toISOString().split('T')[0];
            configDobInput.max = maxDate;
        }
        
        // Set health conditions
        const configHealthCheckboxes = document.querySelectorAll('#config-health-conditions input[type="checkbox"]');
        configHealthCheckboxes.forEach(checkbox => {
            checkbox.checked = this.userDiseases && this.userDiseases.includes(checkbox.value);
        });
    }

    async updateConfigurationParameters() {
        const configDobInput = document.getElementById('config-dob');
        const configHealthCheckboxes = document.querySelectorAll('#config-health-conditions input[type="checkbox"]:checked');
        
        const dobValue = configDobInput.value;
        const selectedDiseases = Array.from(configHealthCheckboxes).map(cb => cb.value);
        
        if (!dobValue) {
            alert('Please select your date of birth');
            return;
        }
        
        if (selectedDiseases.length === 0) {
            alert('Please select at least one health condition (including "None/Healthy" if applicable)');
            return;
        }
        
        const dob = new Date(dobValue);
        const today = new Date();
        
        if (dob > today) {
            alert('Date of birth cannot be in the future');
            return;
        }
        
        const age = this.calculateAge(dob);
        if (age < 1 || age > 120) {
            alert('Age must be between 1 and 120 years');
            return;
        }
        
        this.userDOB = dobValue;
        this.userDiseases = selectedDiseases;
        this.lifeExpectancies = this.calculateLifeExpectancy(age, selectedDiseases);
        
        await this.saveLifeParameters();
        
        // Restart countdown with new parameters
        this.startCountdown();
        
        alert('Life parameters updated successfully!');
    }

    showDirectPredictions() {
        if (!this.userDOB || !this.lifeExpectancies) {
            alert('Please set your life parameters first before viewing predictions.');
            return;
        }
        
        // Start countdown for quick predictions
        this.updateQuickCountdownDisplay();
        
        // Show current predictions
        const scores = this.calculateScores();
        this.displayQuickHealthLifespanInfo();
        this.displayQuickAbstractScores(scores.abstract);
        this.displayQuickConcretePredictions(scores.concrete);
        
        this.showScreen('direct-predictions');
    }

    updateQuickCountdownDisplay() {
        if (!this.userDOB || !this.lifeExpectancies) return;
        
        const now = new Date();
        const birthDate = new Date(this.userDOB);
        
        // Calculate choice impact
        const currentScores = this.calculateScores();
        const avgAbstract = Object.values(currentScores.abstract).length > 0 
            ? Object.values(currentScores.abstract).reduce((sum, score) => sum + score, 0) / Object.values(currentScores.abstract).length 
            : 50;
        
        const choiceImpactDays = ((avgAbstract - 50) / 50) * 1095;
        
        // Calculate and display the main total countdown (realistic scenario)
        const realisticLifeExpectancy = this.lifeExpectancies.realistic;
        const realisticDeathDate = new Date(birthDate);
        realisticDeathDate.setFullYear(birthDate.getFullYear() + realisticLifeExpectancy);
        
        const realisticAdjustedDeathDate = new Date(realisticDeathDate.getTime() + (choiceImpactDays * 24 * 60 * 60 * 1000));
        const realisticTimeDiff = realisticAdjustedDeathDate.getTime() - now.getTime();
        
        if (realisticTimeDiff <= 0) {
            this.displayQuickTotalCountdown(0, 0, 0, 0);
        } else {
            const absoluteDays = Math.floor(realisticTimeDiff / (1000 * 60 * 60 * 24));
            const absoluteHours = Math.floor(realisticTimeDiff / (1000 * 60 * 60));
            const absoluteMinutes = Math.floor(realisticTimeDiff / (1000 * 60));
            const absoluteSeconds = Math.floor(realisticTimeDiff / 1000);
            
            this.displayQuickTotalCountdown(absoluteDays, absoluteHours, absoluteMinutes, absoluteSeconds);
        }
        
        // Calculate all three scenarios for breakdown
        ['optimistic', 'realistic', 'pessimistic'].forEach(scenario => {
            const lifeExpectancy = this.lifeExpectancies[scenario];
            const deathDate = new Date(birthDate);
            deathDate.setFullYear(birthDate.getFullYear() + lifeExpectancy);
            
            let adjustedChoiceImpact = choiceImpactDays;
            if (scenario === 'pessimistic') {
                adjustedChoiceImpact *= 0.5;
            } else if (scenario === 'optimistic') {
                adjustedChoiceImpact *= 1.5;
            }
            
            const adjustedDeathDate = new Date(deathDate.getTime() + (adjustedChoiceImpact * 24 * 60 * 60 * 1000));
            const timeDiff = adjustedDeathDate.getTime() - now.getTime();
            
            if (timeDiff <= 0) {
                this.displayQuickCountdownForScenario(scenario, 0, 0, 0, 0);
                return;
            }
            
            const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
            
            this.displayQuickCountdownForScenario(scenario, days, hours, minutes, seconds);
        });
    }

    displayQuickTotalCountdown(totalDays, totalHours, totalMinutes, totalSeconds) {
        const countdownDisplay = document.getElementById('quick-countdown-total');
        if (!countdownDisplay) return;
        
        countdownDisplay.innerHTML = `
            <div class="countdown-unit">
                <span class="countdown-number">${totalDays.toLocaleString()}</span>
                <span class="countdown-label">Total Days</span>
            </div>
            <div class="countdown-unit">
                <span class="countdown-number">${totalHours.toLocaleString()}</span>
                <span class="countdown-label">Total Hours</span>
            </div>
            <div class="countdown-unit">
                <span class="countdown-number">${totalMinutes.toLocaleString()}</span>
                <span class="countdown-label">Total Minutes</span>
            </div>
            <div class="countdown-unit">
                <span class="countdown-number">${totalSeconds.toLocaleString()}</span>
                <span class="countdown-label">Total Seconds</span>
            </div>
        `;
    }

    displayQuickCountdownForScenario(scenario, days, hours, minutes, seconds) {
        const countdownDisplay = document.getElementById(`quick-countdown-${scenario}`);
        if (!countdownDisplay) return;
        
        countdownDisplay.innerHTML = `
            <div class="countdown-unit">
                <span class="countdown-number">${days.toLocaleString()}</span>
                <span class="countdown-label">Days</span>
            </div>
            <div class="countdown-unit">
                <span class="countdown-number">${hours.toString().padStart(2, '0')}</span>
                <span class="countdown-label">Hours</span>
            </div>
            <div class="countdown-unit">
                <span class="countdown-number">${minutes.toString().padStart(2, '0')}</span>
                <span class="countdown-label">Minutes</span>
            </div>
            <div class="countdown-unit">
                <span class="countdown-number">${seconds.toString().padStart(2, '0')}</span>
                <span class="countdown-label">Seconds</span>
            </div>
        `;
    }

    displayQuickHealthLifespanInfo() {
        const container = document.getElementById('quick-health-lifespan-info');
        
        // Temporarily store current container content
        const originalContainer = document.getElementById('health-lifespan-info');
        const originalContent = originalContainer.innerHTML;
        
        // Use the existing method to populate the original container
        this.displayHealthLifespanInfo();
        
        // Copy the content to the quick container
        container.innerHTML = originalContainer.innerHTML;
        
        // Restore original content
        originalContainer.innerHTML = originalContent;
    }

    displayQuickAbstractScores(scores) {
        const container = document.getElementById('quick-abstract-scores');
        
        // Temporarily store current container content
        const originalContainer = document.getElementById('abstract-scores');
        const originalContent = originalContainer.innerHTML;
        
        // Use the existing method to populate the original container
        this.displayAbstractScores(scores);
        
        // Copy the content to the quick container
        container.innerHTML = originalContainer.innerHTML;
        
        // Restore original content
        originalContainer.innerHTML = originalContent;
    }

    displayQuickConcretePredictions(predictions) {
        const container = document.getElementById('quick-concrete-predictions');
        
        // Temporarily store current container content
        const originalContainer = document.getElementById('concrete-predictions');
        const originalContent = originalContainer.innerHTML;
        
        // Use the existing method to populate the original container
        this.displayConcretePredictions(predictions);
        
        // Copy the content to the quick container
        container.innerHTML = originalContainer.innerHTML;
        
        // Restore original content
        originalContainer.innerHTML = originalContent;
    }

    toggleGlobalClock(show) {
        const globalClock = document.getElementById('global-life-clock');
        if (globalClock) {
            globalClock.style.display = show ? 'block' : 'none';
        }
    }

    toggleMinuteBoxes(show) {
        const minuteBoxes = document.getElementById('minute-boxes');
        if (minuteBoxes) {
            minuteBoxes.style.display = show ? 'flex' : 'none';
        }
    }

    toggleSecondBoxes(show) {
        const secondBoxes = document.getElementById('second-boxes');
        if (secondBoxes) {
            secondBoxes.style.display = show ? 'flex' : 'none';
        }
    }

    toggleScenarioClocks(show) {
        const scenarioClocks = document.querySelector('.countdown-scenarios');
        if (scenarioClocks) {
            scenarioClocks.style.display = show ? 'flex' : 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LifePredictionApp();
});