/**
 * AI Analyzer Module for Sacred Stream
 * Независимый модуль для анализа результатов поиска
 */

   
    <!-- AI Analyzer Module (загружается отдельно) -->

        // Встраиваем AI модуль прямо в страницу
        class AIAnalyzer {
          constructor(config) {
            this.config = {
              API_KEY: config.apiKey || '',
              API_URL: config.apiUrl || 'https://api.groq.com/openai/v1/chat/completions',
              MODEL_NAME: config.modelName || 'meta-llama/llama-4-maverick-17b-128e-instruct'
            };
            this.enabled = true;
            this.isAnalyzing = false;
            this.lastQuery = '';
            console.log('✅ AI Analyzer Module loaded');
          }

          async analyzeSearchResults(query) {
            if (!this.enabled || this.isAnalyzing) return;
            this.lastQuery = query;
            this.isAnalyzing = true;
            
            try {
              this.showLoadingState();
              await this.wait(1500);
              const results = this.parseGoogleResults();
              
              if (results.length === 0) {
                this.showError('Результаты ещё не загрузились. Попробуйте ещё раз.');
                return;
              }
              
              const analysis = await this.sendToAI(query, results);
              this.displayAnalysis(analysis);
            } catch (error) {
              console.error('AI Analyzer error:', error);
              this.showError('AI временно недоступен');
              if (error.message.includes('401') || error.message.includes('API key')) {
                this.disable();
              }
            } finally {
              this.isAnalyzing = false;
            }
          }

          parseGoogleResults() {
            const results = [];
            const items = document.querySelectorAll('.gsc-result');
            items.forEach((item, index) => {
              if (index >= 5) return;
              const titleEl = item.querySelector('.gs-title');
              const snippetEl = item.querySelector('.gs-snippet');
              const urlEl = item.querySelector('.gs-visibleUrl');
              if (titleEl && snippetEl) {
                results.push({
                  title: titleEl.innerText.trim(),
                  snippet: snippetEl.innerText.trim(),
                  url: urlEl ? urlEl.innerText.trim() : ''
                });
              }
            });
            return results;
          }

          async sendToAI(query, results) {
            const prompt = this.buildPrompt(query, results);
            const response = await fetch(this.config.API_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.API_KEY}`
              },
              body: JSON.stringify({
                model: this.config.MODEL_NAME,
                messages: [
                  { role: 'system', content: 'Ты эксперт по христианской музыке. Анализируй результаты поиска и давай краткую полезную сводку на русском языке. Будь конкретным и структурированным.' },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 300
              })
            });

            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            return data.choices[0].message.content;
          }

          buildPrompt(query, results) {
            let prompt = `Пользователь искал: "${query}"\n\nНайдены следующие результаты:\n\n`;
            results.forEach((r, i) => {
              prompt += `${i + 1}. ${r.title}\n   ${r.snippet}\n`;
              if (r.url) prompt += `   ${r.url}\n`;
              prompt += `\n`;
            });
            prompt += `Проанализируй результаты и дай краткую сводку (3-4 предложения):\n- Что конкретно нашлось (аккорды, минуса, альбомы, тексты)?\n- Какой результат кажется наиболее релевантным?\n- Есть ли полезная дополнительная информация?`;
            return prompt;
          }

          showLoadingState() {
            let container = document.getElementById('ai-analysis-container');
            if (!container) {
              container = document.createElement('div');
              container.id = 'ai-analysis-container';
              container.style.cssText = 'width: 95%; max-width: 950px; margin: 20px auto; background: linear-gradient(135deg, rgba(167, 139, 250, 0.15), rgba(56, 189, 248, 0.15)); border: 1px solid rgba(167, 139, 250, 0.3); border-radius: 16px; padding: 20px; color: #f8fafc;';
              const resultsArea = document.getElementById('results-area');
              resultsArea.parentNode.insertBefore(container, resultsArea);
            }
            container.innerHTML = '<div style="display: flex; align-items: center; gap: 12px;"><i class="fa-solid fa-robot" style="font-size: 1.5rem; color: #a78bfa;"></i><div><div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 5px;">🤖 AI анализирует результаты...</div><div style="color: #94a3b8; font-size: 0.9rem;">Обрабатываю найденную информацию</div></div></div>';
          }

          displayAnalysis(analysisText) {
            const container = document.getElementById('ai-analysis-container');
            if (!container) return;
            container.innerHTML = `<div style="display: flex; gap: 15px;"><div style="flex-shrink: 0;"><i class="fa-solid fa-lightbulb" style="font-size: 1.8rem; color: #fbbf24;"></i></div><div style="flex: 1;"><div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 10px; color: #a78bfa;">💡 AI Анализ результатов</div><div style="line-height: 1.6; color: #f8fafc; font-size: 0.95rem;">${analysisText}</div><button onclick="window.aiAnalyzer.retry()" style="margin-top: 12px; background: rgba(167, 139, 250, 0.2); border: 1px solid #a78bfa; color: #a78bfa; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 600;"><i class="fa-solid fa-rotate"></i> Обновить анализ</button></div></div>`;
          }

          showError(message) {
            const container = document.getElementById('ai-analysis-container');
            if (!container) return;
            container.innerHTML = `<div style="display: flex; align-items: center; gap: 12px; color: #f87171;"><i class="fa-solid fa-triangle-exclamation" style="font-size: 1.5rem;"></i><div><div style="font-weight: 700; margin-bottom: 3px;">⚠️ ${message}</div><div style="font-size: 0.85rem; color: #94a3b8;">Поисковик работает в обычном режиме</div></div></div>`;
            setTimeout(() => { if (container) container.style.display = 'none'; }, 5000);
          }

          retry() {
            if (this.lastQuery) this.analyzeSearchResults(this.lastQuery);
          }

          disable() {
            this.enabled = false;
            console.warn('⚠️ AI Analyzer disabled due to errors');
            const checkbox = document.getElementById('ai-toggle');
            if (checkbox) {
              checkbox.checked = false;
              checkbox.disabled = true;
            }
            this.showError('AI модуль отключён из-за проблем с ключом');
          }

          enable() {
            this.enabled = true;
            console.log('✅ AI Analyzer enabled');
          }

          wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
          }
        }

        window.AIAnalyzer = AIAnalyzer;
